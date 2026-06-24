import { dailyAllowance, paceWithJitter } from "./safety-limits";
import { assignSender, inviteBudget } from "./sender-assignment";
import {
  TRIAL_SEND_CAP,
  type DispatchSender,
  type DispatchableSend,
  type SendDispatchDeps,
  type SendDispatchSummary,
} from "./types";

export const INVITE_EXPIRY_DAYS = 30;
export const STALE_TASK_MINUTES = 30;
const BASE_GAP_MS = 15 * 60_000; // ~human pacing between sends per sender account

function seedFrom(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

/** Mutable per-sender budget while we hand out this run's sends. */
interface SenderState {
  sender: DispatchSender; // sentToday/last7d/lastAssignedAt mutated as we consume invites
  messageBudget: number;
  offsetMs: number; // each sender paces independently, like its own human
}

/**
 * The send gatekeeper (rules 04/11): every outbound send passes here first.
 * Kill switch → nothing moves. Caps clamp per SENDER account, never raise. Times jitter
 * like a human. Multi-sender (rule 04/13): a tenant's connected accounts each carry their
 * own daily/weekly budget, so total capacity is the SUM across senders while no single
 * account exceeds its safe pace. Each lead is stuck to one sender for its lifecycle.
 */
export async function runSendDispatch(deps: SendDispatchDeps): Promise<SendDispatchSummary> {
  const now = deps.now?.() ?? new Date();
  if (await deps.store.isKillSwitchOn()) {
    return { status: "halted", scheduled: 0, canceled: 0, skipped: 0 };
  }
  const staleCutoff = new Date(now.getTime() - STALE_TASK_MINUTES * 60_000);
  const sends = await deps.store.getDispatchableSends(staleCutoff);

  const byAccount = new Map<string, DispatchableSend[]>();
  for (const s of sends) {
    const list = byAccount.get(s.accountId) ?? [];
    list.push(s);
    byAccount.set(s.accountId, list);
  }

  let scheduled = 0;
  let canceled = 0;
  let skipped = 0;
  let assignTick = 0; // monotonic, so within-run assignments sort as most-recent (even spread)

  for (const [accountId, rows] of byAccount) {
    if (rows[0]?.accountPaused) {
      skipped += rows.length;
      continue;
    }
    const active = rows.filter((r) => r.campaignStatus === "active");
    skipped += rows.length - active.length;

    // Trial send cap: a trialing account dispatches at most TRIAL_SEND_CAP sends total
    // (rule 04/11 channel ceilings still apply on top). Bounds deliverability and per-send
    // COGS until conversion; paid accounts are unbounded here.
    let trialRemaining = Number.POSITIVE_INFINITY;
    if (rows[0]?.subscriptionStatus === "trialing") {
      trialRemaining = Math.max(0, TRIAL_SEND_CAP - (await deps.store.countAccountSends(accountId)));
      if (trialRemaining <= 0) {
        skipped += active.length;
        continue;
      }
    }

    const lis = active.filter((r) => r.channel === "linkedin");
    if (lis.length === 0) continue;

    // Per-sender safety state. Empty → no connected identity for this tenant.
    const senders = await deps.store.listSenderCandidates(accountId, now);
    if (senders.length === 0) {
      skipped += lis.length;
      continue;
    }
    const state = new Map<string, SenderState>();
    for (const s of senders) {
      state.set(s.linkedinAccountId, {
        sender: { ...s },
        messageBudget: Math.max(
          0,
          dailyAllowance("linkedin", s.ageDays, { kind: "message" }) - s.sentTodayMessages
        ),
        offsetMs: 0,
      });
    }

    const schedule = async (row: DispatchableSend, st: SenderState) => {
      st.offsetMs += paceWithJitter(BASE_GAP_MS, seedFrom(row.id));
      const runAt = new Date(now.getTime() + st.offsetMs);
      await deps.store.markScheduled(row.id, runAt);
      await deps.enqueue(row.id, runAt);
      scheduled += 1;
      trialRemaining -= 1;
    };

    for (const row of lis) {
      if (trialRemaining <= 0) {
        skipped += 1; // trial ceiling reached mid-run
        continue;
      }

      if (row.linkedinStage === "message") {
        if (!row.leadConnectedAt) {
          const invitedMs = row.leadInvitedAt ? now.getTime() - row.leadInvitedAt.getTime() : 0;
          if (row.leadInvitedAt && invitedMs > INVITE_EXPIRY_DAYS * 86_400_000) {
            await deps.store.cancelSend(row.id, "invite expired unaccepted");
            canceled += 1;
          } else {
            skipped += 1; // parked until acceptance
          }
          continue;
        }
        // Locked to the sender that connected this lead — never sent from another account.
        const st = resolveMessageSender(row, state);
        if (!st || st.messageBudget <= 0) {
          skipped += 1;
          continue;
        }
        st.messageBudget -= 1;
        await schedule(row, st);
        continue;
      }

      // invite stage
      if (row.leadInvitedAt) {
        skipped += 1; // invite already went out (stale-row safety)
        continue;
      }
      const st = pickInviteSender(row, state);
      if (!st) {
        skipped += 1; // no healthy sender with budget
        continue;
      }
      if (row.leadAssignedSenderId !== st.sender.linkedinAccountId) {
        await deps.store.assignLeadSender(row.leadId, st.sender.linkedinAccountId);
      }
      // consume this sender's daily AND weekly invite budget; bump recency for even spread
      st.sender.sentToday += 1;
      st.sender.last7d += 1;
      st.sender.lastAssignedAt = now.getTime() + assignTick++;
      await schedule(row, st);
    }
  }

  return { status: "completed", scheduled, canceled, skipped };
}

/** A connected lead's message can only come from the account that connected it. */
function resolveMessageSender(
  row: DispatchableSend,
  state: Map<string, SenderState>
): SenderState | undefined {
  if (row.leadAssignedSenderId) {
    const st = state.get(row.leadAssignedSenderId);
    return st && st.sender.healthy ? st : undefined; // locked; no fallback to another account
  }
  // Legacy lead with no recorded assignment (connected before multi-sender): single-sender
  // tenants are unambiguous; otherwise best-effort to the first healthy sender.
  return [...state.values()].find((s) => s.sender.healthy);
}

/** Pick the sender for an invite: keep a healthy existing assignment, else capacity-weighted least-loaded. */
function pickInviteSender(
  row: DispatchableSend,
  state: Map<string, SenderState>
): SenderState | undefined {
  if (row.leadAssignedSenderId) {
    const st = state.get(row.leadAssignedSenderId);
    if (st && st.sender.healthy && inviteBudget(st.sender) > 0) return st;
  }
  const chosenId = assignSender([...state.values()].map((s) => s.sender));
  return chosenId ? state.get(chosenId) : undefined;
}
