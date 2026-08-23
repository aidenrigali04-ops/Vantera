import type { ConnectedAccount } from "@vantera/linkedin-infra";

/** The columns the reconcile needs from an existing `linkedin_accounts` row. */
export interface ExistingRow {
  id: string;
  account_id: string;
  provider_ref: string;
  profile_url: string | null;
  status: string;
  connected_at: string | null;
}

export type ReconcileOp =
  | {
      kind: "update";
      rowId: string;
      /** null ⇒ leave the stored status alone (the provider had nothing definitive to say). */
      status: ConnectedAccount["status"] | null;
      profileUrl: string | null;
      displayName: string | null;
      setConnectedAt: boolean;
    }
  | {
      kind: "reconnect";
      rowId: string;
      providerRef: string;
      /** The provider seat this reconnect replaced — released so it stops billing. */
      supersededRef: string;
      profileUrl: string | null;
      displayName: string | null;
    }
  | {
      kind: "insert";
      providerRef: string;
      profileUrl: string | null;
      displayName: string | null;
      status: ConnectedAccount["status"];
      setConnectedAt: boolean;
    };

export interface ReconcilePlan {
  ops: ReconcileOp[];
  /** Provider accounts nobody can be shown to own, which this run deliberately left alone. */
  unclaimed: number;
}

export interface ReconcileOptions {
  /**
   * True only when the caller is handling a return from the connect flow — i.e. a user is
   * standing right there having just finished a hosted login, so exactly one new connection
   * is expected. A background refresh must never adopt.
   */
  adoptNew: boolean;
  /** Injected for tests. */
  now?: number;
}

/**
 * How recently a provider account must have been created to be adoptable on return from a
 * connect. Comfortably longer than a hosted login takes, far shorter than the "forever"
 * window that let one tenant pick up an account another tenant had left unclaimed.
 */
export const ADOPTION_WINDOW_MS = 15 * 60_000;

/** Profile-identity key: the same human under any URL casing/trailing-slash variant. */
export function identityOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Decide what the reconcile should write, given the provider's view and ours. Pure, so the
 * ownership rules — the part that can leak one tenant's LinkedIn identity to another — are
 * testable without a database.
 *
 * The provider lists every account in the shared workspace with no tenant marker on them
 * (the hosted-auth `name` metadata is overwritten with the LinkedIn profile name, verified
 * against the live API), so ownership has to be inferred:
 *
 *  1. A ref or profile we already hold proves the account is ours.
 *  2. A ref or profile ANOTHER tenant holds is never touched.
 *  3. Anything else is unclaimed. It is adopted only on an explicit return from a connect,
 *     only if the provider created it inside ADOPTION_WINDOW_MS, and only the newest one —
 *     because one connect flow produces exactly one new connection. The old behaviour
 *     adopted every unclaimed account, of any age, on any reconcile, which handed accounts
 *     to whichever tenant happened to reconcile next.
 */
export function planLinkedInReconcile(
  accountId: string,
  provider: ConnectedAccount[],
  rows: ExistingRow[],
  options: ReconcileOptions = { adoptNew: false }
): ReconcilePlan {
  const now = options.now ?? Date.now();
  const byRef = new Map(rows.map((r) => [r.provider_ref, r]));
  const ops: ReconcileOp[] = [];
  const candidates: ConnectedAccount[] = [];

  // Reconnects mutate our local view (a revived row now answers to the new ref), so the
  // walk stays consistent when the provider lists several accounts for one human.
  const ourRowIds = new Set(rows.filter((r) => r.account_id === accountId).map((r) => r.id));

  for (const a of provider) {
    const existing = byRef.get(a.providerRef);
    if (existing) {
      if (existing.account_id !== accountId) continue; // held by another tenant — never steal it
      // 'connecting' is "no news yet", never a demotion of something we already know.
      const status = a.status === "connecting" ? null : a.status;
      ops.push({
        kind: "update",
        rowId: existing.id,
        status,
        profileUrl: a.profileUrl,
        displayName: a.displayName,
        // Backfill only — a refresh must never restart the rule-04 ramp clock on a row
        // that already has one.
        setConnectedAt: status === "active" && existing.connected_at === null,
      });
      continue;
    }

    // A ref we don't hold. Match by profile identity before considering anything else.
    const identity = identityOf(a.profileUrl);
    const sameIdentity = identity ? rows.filter((r) => identityOf(r.profile_url) === identity) : [];
    if (sameIdentity.some((r) => r.account_id !== accountId)) continue; // another tenant's human
    const ours = sameIdentity.find((r) => ourRowIds.has(r.id));

    if (ours) {
      if (a.status !== "active") continue; // don't adopt a dead or still-settling duplicate
      ops.push({
        kind: "reconnect",
        rowId: ours.id,
        providerRef: a.providerRef,
        supersededRef: ours.provider_ref,
        profileUrl: a.profileUrl,
        displayName: a.displayName,
      });
      ours.provider_ref = a.providerRef;
      byRef.set(a.providerRef, ours);
      continue;
    }

    candidates.push(a);
  }

  if (!options.adoptNew) return { ops, unclaimed: candidates.length };

  // Exactly one connect flow just finished, so adopt at most one account: the newest one
  // the provider created inside the window. An account with no creation time can't be
  // bounded, so it is never adopted.
  const adoptable = candidates
    .filter((a) => {
      const created = a.createdAt ? Date.parse(a.createdAt) : NaN;
      return Number.isFinite(created) && now - created <= ADOPTION_WINDOW_MS && created <= now;
    })
    .sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!));

  const newest = adoptable[0];
  if (newest) {
    ops.push({
      kind: "insert",
      providerRef: newest.providerRef,
      profileUrl: newest.profileUrl,
      displayName: newest.displayName,
      status: newest.status,
      setConnectedAt: newest.status === "active",
    });
  }
  return { ops, unclaimed: candidates.length - (newest ? 1 : 0) };
}
