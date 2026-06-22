import { applyRulesGate, type IntentObservationInput, type IntentVerdict, type RankCandidate } from "@vantera/agent-brains";
import type { ProspectCandidate } from "@vantera/prospect-data";
import type { LinkedInPost, LinkedInProfile } from "@vantera/linkedin-infra";
import {
  INTENT_DEFAULTS,
  INTENT_ENGAGERS_PER_POST,
  INTENT_POSTS_PER_RUN,
  type IntentObservationRow,
  type IntentScanDeps,
  type IntentScanSummary,
} from "./types";

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

const toRankCandidate = (leadId: string, c: ProspectCandidate): RankCandidate => ({
  leadId,
  companyName: c.companyName,
  companySize: c.companySize,
  industry: c.industry,
  location: c.location,
  title: c.title,
});

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
  const skipped: IntentScanSummary = { status: "skipped", observed: 0, intent: 0, qualified: 0, chained: false };

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

  const targets = [
    ...config.watch.creators.map((value) => ({ kind: "profile" as const, value })),
    ...config.watch.competitors.map((value) => ({ kind: "profile" as const, value })),
    ...config.watch.keywords.map((value) => ({ kind: "query" as const, value })),
    ...config.watch.hashtags.map((v) => ({ kind: "query" as const, value: v.startsWith("#") ? v : `#${v}` })),
  ];
  if (targets.length === 0) return { ...skipped, reason: "empty_watchlist" };

  const acct = ctx.connectedAccountId;
  const perTarget = Math.max(1, Math.floor(INTENT_POSTS_PER_RUN / targets.length));

  // 1. gather posts per watch target (account-safety: capped reads, rule 04)
  const sourced: { post: LinkedInPost; watchTarget: string }[] = [];
  for (const t of targets) {
    try {
      const found =
        t.kind === "query"
          ? await deps.linkedin.searchPosts({ connectedAccountId: acct, query: t.value, limit: perTarget })
          : await deps.linkedin.listProfilePosts({ connectedAccountId: acct, profileUrl: t.value, limit: perTarget });
      for (const post of found) sourced.push({ post, watchTarget: t.value });
    } catch {
      // a broken target never sinks the whole run
    }
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
            text: e.text ?? post.text, watchTarget,
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
    return { status: "completed", observed: 0, intent: 0, qualified: 0, chained: false };
  }

  // 3. classify buying intent (the filter before any enrichment/qualification spend)
  const verdicts = await deps.classifyFn(fresh, { accountIndustry: ctx.account.industry, valueProp: ctx.account.valueProp });
  const verdictByRef = new Map(verdicts.map((v) => [v.ref, v]));

  const rows: IntentObservationRow[] = [];
  const obsRow = (o: FreshObs, outcome: IntentObservationRow["outcome"], detail: string | null, leadId: string | null): IntentObservationRow => ({
    profileUrl: o.profileUrl, postRef: o.postRef, signalKind: o.signalKind, watchTarget: o.watchTarget ?? null,
    headline: o.headline ?? null, detail, outcome, leadId,
  });

  // one primary intent observation per PERSON (others recorded as observed, person-deduped at the lead)
  const primary = new Map<string, { o: FreshObs; v: IntentVerdict }>();
  for (const o of fresh) {
    const v = verdictByRef.get(o.ref);
    if (v?.is_intent && !primary.has(o.profileUrl)) primary.set(o.profileUrl, { o, v });
    else rows.push(obsRow(o, "observed", v?.why_now ?? null, null));
  }

  // 4. resolve → suppress → ICP rules gate; collect gate survivors for rank
  const survivors: { o: FreshObs; v: IntentVerdict; leadId: string; candidate: ProspectCandidate }[] = [];
  const icpCriteria = ctx.icps[0]?.criteria ?? {};
  for (const { o, v } of primary.values()) {
    if (await deps.store.isSuppressed(accountId, "linkedin", o.profileUrl)) {
      rows.push(obsRow(o, "suppressed", v.why_now, null));
      continue;
    }
    const profile = await deps.linkedin.getProfile({ connectedAccountId: acct, profileUrl: o.profileUrl });
    if (!profile) {
      rows.push(obsRow(o, "observed", v.why_now, null));
      continue;
    }
    const candidate = candidateFromProfile(profile);
    const { leadId } = await deps.store.upsertIntentLead(accountId, candidate);
    const gate = applyRulesGate(candidate, icpCriteria);
    await deps.store.markRulesGate(leadId, gate);
    if (!gate.passed) {
      rows.push(obsRow(o, "rejected", v.why_now, leadId));
      continue;
    }
    survivors.push({ o, v, leadId, candidate });
  }

  // 5. AI rank the survivors; enroll those clearing the bar
  const qualifiedLeadIds: string[] = [];
  if (survivors.length > 0) {
    const insights = await deps.rankFn(
      survivors.map((s) => toRankCandidate(s.leadId, s.candidate)),
      {
        accountIndustry: ctx.account.industry,
        valueProp: ctx.account.valueProp,
        icpDescription: ctx.icps.map((i) => `${i.name}: ${JSON.stringify(i.criteria)}`).join(" | "),
      }
    );
    const byLead = new Map(insights.map((i) => [i.lead_id, i]));
    for (const s of survivors) {
      const ins = byLead.get(s.leadId);
      const qualified = !!ins && ins.score >= config.minScore;
      if (ins) await deps.store.saveScore(s.leadId, ins, qualified);
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

  return { status: "completed", observed: fresh.length, intent: primary.size, qualified: qualifiedLeadIds.length, chained };
}
