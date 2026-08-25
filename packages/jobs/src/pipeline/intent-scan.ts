import { applyRulesGate, type IntentObservationInput, type IntentVerdict, type RankCandidate, type RulesGateResult } from "@vantera/agent-brains";
import type { IcpCriteria, ProspectCandidate } from "@vantera/prospect-data";
import type { LinkedInPost, LinkedInProfile } from "@vantera/linkedin-infra";
import {
  INTENT_DEFAULTS,
  INTENT_ENGAGERS_PER_POST,
  INTENT_POSTS_PER_RUN,
  type IntentObservationRow,
  type IntentScanDeps,
  type IntentScanSummary,
} from "./types";
import { mapWithConcurrency } from "./concurrency";
import { rankWithCompleteness } from "./rank-complete";

/** LinkedIn profile reads run at a LOW bounded concurrency — rule-04 account safety caps read volume. */
const INTENT_READ_CONCURRENCY = 3;
/** Score-write concurrency for rank persistence; under the DB pool max of 10. */
const WRITE_CONCURRENCY = 8;

type FreshObs = IntentObservationInput & { postRef: string; profileUrl: string };

const obsKey = (profileUrl: string, postRef: string) => `${profileUrl}|${postRef}`;

/** A LinkedIn profile read becomes a discovery-shaped candidate (headline ≈ title, no firmographics). */
function candidateFromProfile(p: LinkedInProfile): ProspectCandidate {
  return {
    externalRef: p.profileUrl,
    companyName: p.companyName ?? "",
    firstName: p.firstName ?? undefined,
    lastName: p.lastName ?? undefined,
    title: p.headline ?? undefined,
    location: p.location ?? undefined,
    linkedinUrl: p.profileUrl,
  };
}

/** Fields the rules gate actually checks — empty criteria still defer-pass. */
function hasGateCriteria(criteria: IcpCriteria): boolean {
  return [criteria.industries, criteria.companySizes, criteria.titles, criteria.seniorities, criteria.geos].some(
    (arr) => (arr?.length ?? 0) > 0
  );
}

/** Pass if any live ICP's rules gate passes; reject only when every non-empty ICP fails. */
function gateAgainstIcps(
  candidate: ProspectCandidate,
  icps: { id: string; criteria: IcpCriteria }[]
): { gate: RulesGateResult; icpId?: string } {
  const scored = icps.filter((i) => hasGateCriteria(i.criteria));
  if (scored.length === 0) {
    const first = icps[0];
    return { gate: applyRulesGate(candidate, first?.criteria ?? {}), icpId: first?.id };
  }
  const failures: string[] = [];
  for (const icp of scored) {
    const gate = applyRulesGate(candidate, icp.criteria);
    if (gate.passed) return { gate, icpId: icp.id };
    failures.push(...gate.reasons);
  }
  return { gate: { passed: false, reasons: failures } };
}

/** high/medium buying-intent → the intent-signal strength the rank reads (prospect-data levels). */
const INTENT_LEVEL: Record<string, string> = { high: "in_depth", medium: "active" };

/**
 * The buying-intent verdict IS this lead's timing signal — feed it to the rank as a first-class,
 * just-observed `intent` signal (the strongest "why now"), so the score reflects "they're asking
 * for this" instead of judging a bare LinkedIn headline (rule 06). A LinkedIn read carries no
 * firmographics, so size/industry stay undefined — the rank weighs intent + plausible fit.
 */
function toRankCandidate(leadId: string, c: ProspectCandidate, v: IntentVerdict, observedAt: Date): RankCandidate {
  return {
    leadId,
    companyName: c.companyName,
    companySize: c.companySize,
    industry: c.industry,
    location: c.location,
    title: c.title,
    signals: [
      {
        kind: "intent",
        label: v.why_now,
        detail: v.why_now,
        level: INTENT_LEVEL[v.level] ?? "active",
        observedAt: observedAt.toISOString(),
      },
    ],
  };
}

/**
 * One Intent Agent run (rule 13 pipeline core, pure + deps-injected). Watches LinkedIn for
 * in-market behavior around the customer's niche and feeds the people showing it into the SAME
 * qualify → draft → outreach engine as the Scout. Flow: read posts per watch target → build
 * observations (content authors + engagement) → dedupe (within-run + the intent_observations
 * ledger) → classify buying intent → resolve profile → suppression check (rule 11) → ICP rules
 * gate + AI rank (rule 06) → enroll the qualified via the Copy chain. LinkedIn reads are ceilinged
 * for account-safety (rule 04). Intent is a SECOND filter, never a bypass.
 */
export async function runIntentScan(agentId: string, deps: IntentScanDeps): Promise<IntentScanSummary> {
  const now = deps.now ?? (() => new Date());
  const skipped: IntentScanSummary = {
    status: "skipped", targets: 0, sourcingErrors: 0, observed: 0, intent: 0, qualified: 0, chained: false,
    rankMissed: 0, rankErrors: 0,
  };

  const ctx = await deps.store.getIntentContext(agentId);
  if (!ctx || ctx.agent.status !== "live") return skipped;
  if (!ctx.connectedAccountId) return { ...skipped, reason: "no_connection" };
  const { accountId } = ctx.agent;

  const cfg = ctx.agent.config;
  const config = {
    ...INTENT_DEFAULTS,
    ...cfg,
    watch: { ...INTENT_DEFAULTS.watch, ...cfg.watch },
    signals: { ...INTENT_DEFAULTS.signals, ...cfg.signals },
  };

  // A creator/competitor given as a URL is watched as a profile (its own posts); given as a NAME
  // it's watched as a search query (posts mentioning it). This lets the auto-derived watchlist
  // (competitor names, no URLs) work with zero hunting, while pasted URLs still profile-watch.
  const asTarget = (value: string) =>
    /^https?:\/\//i.test(value) ? { kind: "profile" as const, value } : { kind: "query" as const, value };
  const targets = [
    ...config.watch.creators.map(asTarget),
    ...config.watch.competitors.map(asTarget),
    ...config.watch.keywords.map((value) => ({ kind: "query" as const, value })),
    ...config.watch.hashtags.map((v) => ({ kind: "query" as const, value: v.startsWith("#") ? v : `#${v}` })),
  ];
  if (targets.length === 0) return { ...skipped, reason: "empty_watchlist" };

  const acct = ctx.connectedAccountId;
  const perTarget = Math.max(1, Math.floor(INTENT_POSTS_PER_RUN / targets.length));

  // 1. gather posts per watch target (account-safety: capped reads, rule 04)
  const sourced: { post: LinkedInPost; watchTarget: string }[] = [];
  let sourcingErrors = 0;
  for (const t of targets) {
    try {
      const found =
        t.kind === "query"
          ? await deps.linkedin.searchPosts({ connectedAccountId: acct, query: t.value, limit: perTarget })
          : await deps.linkedin.listProfilePosts({ connectedAccountId: acct, profileUrl: t.value, limit: perTarget });
      for (const post of found) sourced.push({ post, watchTarget: t.value });
    } catch {
      // a broken target never sinks the whole run — but the COUNT surfaces in the summary,
      // because every target failing (dead connection) must never read as a quiet day
      sourcingErrors += 1;
    }
  }

  // every watch-target read failed — the connection is dead, not a quiet day
  if (targets.length > 0 && sourcingErrors === targets.length) {
    await deps.store.completeRun(agentId, now());
    return {
      status: "failed",
      reason: "all_targets_failed",
      targets: targets.length,
      sourcingErrors,
      observed: 0,
      intent: 0,
      qualified: 0,
      chained: false,
      rankMissed: 0,
      rankErrors: 0,
    };
  }

  // 2. build observations: content (post authors) + engagement (post engagers)
  const raw: FreshObs[] = [];
  for (const { post, watchTarget } of sourced) {
    if (config.signals.content && post.authorProfileUrl) {
      raw.push({
        ref: post.authorProfileUrl, profileUrl: post.authorProfileUrl, postRef: post.postRef,
        name: post.authorName, headline: post.authorHeadline, signalKind: "content", action: "posted",
        text: post.text, watchTarget,
      });
    }
    if (config.signals.engagement) {
      try {
        const engagers = await deps.linkedin.listPostEngagers({ connectedAccountId: acct, postRef: post.postRef, limit: INTENT_ENGAGERS_PER_POST });
        for (const e of engagers) {
          raw.push({
            ref: e.profileUrl, profileUrl: e.profileUrl, postRef: post.postRef,
            name: e.name, headline: e.headline, signalKind: "engagement",
            action: e.kind === "comment" ? "commented" : "reacted",
            // evidence = THEIR words only. Never substitute the post they liked (that is context).
            text: e.text ?? "",
            context: post.text,
            watchTarget,
          });
        }
      } catch {
        // skip this post's engagers
      }
    }
  }

  // dedupe within-run by (profile, post), then against the persisted ledger (cross-run)
  const withinRun = new Map<string, FreshObs>();
  for (const o of raw) withinRun.set(obsKey(o.profileUrl, o.postRef), withinRun.get(obsKey(o.profileUrl, o.postRef)) ?? o);
  const candidates = [...withinRun.values()];
  const seen = await deps.store.seenObservationKeys(accountId, candidates.map((o) => ({ profileUrl: o.profileUrl, postRef: o.postRef })));
  const fresh = candidates.filter((o) => !seen.has(obsKey(o.profileUrl, o.postRef)));
  if (fresh.length === 0) {
    await deps.store.completeRun(agentId, now());
    return {
      status: "completed", targets: targets.length, sourcingErrors,
      observed: 0, intent: 0, qualified: 0, chained: false,
      rankMissed: 0, rankErrors: 0,
    };
  }

  // 3. classify buying intent (the filter before any enrichment/qualification spend)
  const verdicts = await deps.classifyFn(fresh, { accountIndustry: ctx.account.industry, valueProp: ctx.account.valueProp });
  const verdictByRef = new Map(verdicts.map((v) => [v.ref, v]));

  const rows: IntentObservationRow[] = [];
  const obsRow = (o: FreshObs, outcome: IntentObservationRow["outcome"], detail: string | null, leadId: string | null): IntentObservationRow => ({
    profileUrl: o.profileUrl, postRef: o.postRef, signalKind: o.signalKind, watchTarget: o.watchTarget ?? null,
    headline: o.headline ?? null, detail, outcome, leadId,
  });

  // one primary intent observation per PERSON (others recorded as observed, person-deduped at the lead).
  // Empty evidence (a like with no comment) can never enter primary even if the classifier over-claims.
  const hasEvidence = (o: FreshObs) => o.text.trim().length > 0;
  const primary = new Map<string, { o: FreshObs; v: IntentVerdict }>();
  for (const o of fresh) {
    const v = verdictByRef.get(o.ref);
    if (v?.is_intent && hasEvidence(o) && !primary.has(o.profileUrl)) primary.set(o.profileUrl, { o, v });
    else rows.push(obsRow(o, "observed", v?.why_now ?? null, null));
  }

  // 4. resolve → suppress → ICP rules gate; collect gate survivors for rank.
  // Each person is independent, so run at a LOW bounded concurrency: the per-survivor profile
  // fetch is the dominant cost, and rule-04 caps LinkedIn read volume. Order-independent — rows
  // feed recordObservations and survivors feed the leadId-keyed rank.
  type Survivor = { o: FreshObs; v: IntentVerdict; leadId: string; candidate: ProspectCandidate };
  const resolved = await mapWithConcurrency(
    [...primary.values()],
    INTENT_READ_CONCURRENCY,
    async ({ o, v }): Promise<{ row: IntentObservationRow | null; survivor: Survivor | null }> => {
      const profile = await deps.linkedin.getProfile({ connectedAccountId: acct, profileUrl: o.profileUrl });
      if (!profile) return { row: obsRow(o, "observed", v.why_now, null), survivor: null };
      // Suppression on the CANONICAL profile url (rule 11): engagement reads can return provider-id
      // urls while the suppression ledger holds public slugs, so resolve first, then check.
      if (await deps.store.isSuppressed(accountId, "linkedin", profile.profileUrl))
        return { row: obsRow(o, "suppressed", v.why_now, null), survivor: null };
      const candidate = candidateFromProfile(profile);
      const { gate, icpId } = gateAgainstIcps(candidate, ctx.icps);
      const { leadId } = await deps.store.upsertIntentLead(accountId, candidate, gate.passed ? icpId : undefined);
      await deps.store.markRulesGate(leadId, gate);
      if (!gate.passed) return { row: obsRow(o, "rejected", v.why_now, leadId), survivor: null };
      return { row: null, survivor: { o, v, leadId, candidate } };
    }
  );
  const survivors: Survivor[] = [];
  for (const r of resolved) {
    if (r.row) rows.push(r.row);
    if (r.survivor) survivors.push(r.survivor);
  }

  // 5. AI rank the survivors; enroll those clearing the bar
  const qualifiedLeadIds: string[] = [];
  let rankMissed = 0;
  let rankErrors = 0;
  if (survivors.length > 0) {
    const rankNow = now();
    const ranked = await rankWithCompleteness(
      deps.rankFn,
      survivors.map((s) => toRankCandidate(s.leadId, s.candidate, s.v, rankNow)),
      {
        accountIndustry: ctx.account.industry,
        valueProp: ctx.account.valueProp,
        icpDescription: ctx.icps.map((i) => `${i.name}: ${JSON.stringify(i.criteria)}`).join(" | "),
      }
    );
    rankMissed = ranked.rankMissed;
    rankErrors = ranked.rankErrors;
    const byLead = new Map(ranked.insights.map((i) => [i.lead_id, i]));
    const scored = survivors.map((s) => {
      const ins = byLead.get(s.leadId)!;
      return { s, ins, qualified: ins.score >= config.minScore };
    });
    await mapWithConcurrency(scored, WRITE_CONCURRENCY, ({ s, ins, qualified }) =>
      deps.store.saveScore(s.leadId, ins, qualified)
    );
    for (const { s, qualified } of scored) {
      if (qualified) {
        await deps.store.saveIntentSignal(s.leadId, accountId, { label: s.v.why_now, detail: s.v.why_now });
        qualifiedLeadIds.push(s.leadId);
        rows.push(obsRow(s.o, "enrolled", s.v.why_now, s.leadId));
      } else {
        rows.push(obsRow(s.o, "rejected", s.v.why_now, s.leadId));
      }
    }
  }

  await deps.store.recordObservations(accountId, agentId, rows);
  await deps.store.completeRun(agentId, now());

  // 6. hand the qualified intent leads to the Copy agent, if one is live (same chain as the Scout)
  let chained = false;
  if (qualifiedLeadIds.length > 0) {
    const copyAgent = await deps.store.getLiveCopyAgent(accountId);
    if (copyAgent) {
      await deps.triggerCopyDraft({ copyAgentId: copyAgent.id, accountId, leadIds: qualifiedLeadIds });
      chained = true;
    }
  }

  return {
    status: "completed", targets: targets.length, sourcingErrors,
    observed: fresh.length, intent: primary.size, qualified: qualifiedLeadIds.length, chained,
    rankMissed, rankErrors,
  };
}
