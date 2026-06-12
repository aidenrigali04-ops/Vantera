import { dailyAllowance, paceWithJitter } from "./safety-limits";
import type { DispatchableSend, SendDispatchDeps, SendDispatchSummary } from "./types";

export const INVITE_EXPIRY_DAYS = 30;
export const STALE_TASK_MINUTES = 30;
const BASE_GAP_MS = 15 * 60_000; // ~human pacing between sends per account

function seedFrom(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function dayStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * The send gatekeeper (rules 04/11): every outbound send passes here first.
 * Kill switch → nothing moves. Caps clamp, never raise. Times jitter like a human.
 */
export async function runSendDispatch(deps: SendDispatchDeps): Promise<SendDispatchSummary> {
  const now = deps.now?.() ?? new Date();
  if (await deps.store.isKillSwitchOn()) {
    return { status: "halted", scheduled: 0, canceled: 0, skipped: 0 };
  }
  const staleCutoff = new Date(now.getTime() - STALE_TASK_MINUTES * 60_000);
  const sends = await deps.store.getDispatchableSends(staleCutoff);
  const dayStart = dayStartUtc(now);

  const byAccount = new Map<string, DispatchableSend[]>();
  for (const s of sends) {
    const list = byAccount.get(s.accountId) ?? [];
    list.push(s);
    byAccount.set(s.accountId, list);
  }

  let scheduled = 0;
  let canceled = 0;
  let skipped = 0;

  for (const [accountId, rows] of byAccount) {
    if (rows[0]?.accountPaused) {
      skipped += rows.length;
      continue;
    }
    const active = rows.filter((r) => r.campaignStatus === "active");
    skipped += rows.length - active.length;
    let offsetMs = 0;

    const schedule = async (row: DispatchableSend) => {
      offsetMs += paceWithJitter(BASE_GAP_MS, seedFrom(row.id));
      const runAt = new Date(now.getTime() + offsetMs);
      await deps.store.markScheduled(row.id, runAt);
      await deps.enqueue(row.id, runAt);
      scheduled += 1;
    };

    // email
    const emails = active.filter((r) => r.channel === "email");
    if (emails.length > 0) {
      if (!emails[0]!.hasSenderAddress) {
        skipped += emails.length; // rule 11: no physical address, no cold email
      } else {
        let capacity = await deps.store.getEmailCapacity(accountId, dayStart);
        for (const row of emails) {
          if (capacity <= 0) {
            skipped += 1;
            continue;
          }
          await schedule(row);
          capacity -= 1;
        }
      }
    }

    // linkedin
    const lis = active.filter((r) => r.channel === "linkedin");
    if (lis.length > 0) {
      const ageDays = await deps.store.getLinkedInAccountAgeDays(accountId, now);
      if (ageDays === null) {
        skipped += lis.length; // no connected identity
        continue;
      }
      let inviteBudget =
        dailyAllowance("linkedin", ageDays) -
        (await deps.store.countLinkedInSentToday(accountId, "invite", dayStart));
      let messageBudget =
        dailyAllowance("linkedin", ageDays, { kind: "message" }) -
        (await deps.store.countLinkedInSentToday(accountId, "message", dayStart));

      for (const row of lis) {
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
          if (messageBudget <= 0) {
            skipped += 1;
            continue;
          }
          messageBudget -= 1;
        } else {
          if (row.leadInvitedAt) {
            skipped += 1; // invite already went out (stale-row safety)
            continue;
          }
          if (inviteBudget <= 0) {
            skipped += 1;
            continue;
          }
          inviteBudget -= 1;
        }
        await schedule(row);
      }
    }
  }

  return { status: "completed", scheduled, canceled, skipped };
}
