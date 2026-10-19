/** Hard ceiling from the research governor. A subject may be stricter. It may not be looser. */
export const MAX_HARM_TOLERANCE = 0.15;

/** The live experiment table allows one running experiment per account. */
export const MAX_CONCURRENT_EXPERIMENTS = 1;

export type SubjectGuardrails = {
  maxConcurrentExperiments: typeof MAX_CONCURRENT_EXPERIMENTS;
  harmTolerance: number;
  autoAdopt: boolean;
};

export type SubjectDraft = {
  name: string;
  guardrails: SubjectGuardrails;
};

export type SubjectConfig = {
  enabled: true;
  active_strategy_id: null;
  guardrails: {
    max_concurrent_experiments: typeof MAX_CONCURRENT_EXPERIMENTS;
    harm_tolerance: number;
    auto_adopt: boolean;
  };
  auto_adopt: boolean;
  max_concurrent_experiments: typeof MAX_CONCURRENT_EXPERIMENTS;
  bootstrap_completed_at: null;
};

const NAME_MAX = 80;

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function defaultGuardrails(): SubjectGuardrails {
  return {
    maxConcurrentExperiments: MAX_CONCURRENT_EXPERIMENTS,
    harmTolerance: MAX_HARM_TOLERANCE,
    autoAdopt: false,
  };
}

/** The assisted start. Names the subject from the workspace. Does not invent a strategy. */
export function draftFirstSubject(companyName: string | null | undefined): SubjectDraft {
  const company = cleanName(companyName ?? "");
  const name = (company ? `${company} learning` : "Learning").slice(0, NAME_MAX);
  return { name, guardrails: defaultGuardrails() };
}

export function parseSubjectForm(
  formData: FormData
): { ok: true; values: SubjectDraft } | { ok: false; error: string } {
  const name = cleanName(String(formData.get("name") ?? ""));
  if (!name) return { ok: false, error: "Give the subject a name." };
  if (name.length > NAME_MAX) return { ok: false, error: "That name is too long." };

  const rawHarm = String(formData.get("harm_tolerance") ?? "").trim();
  const harmTolerance = rawHarm === "" ? MAX_HARM_TOLERANCE : Number(rawHarm);
  if (!Number.isFinite(harmTolerance) || harmTolerance < 0 || harmTolerance > MAX_HARM_TOLERANCE) {
    return { ok: false, error: "Harm tolerance has to stay within the safety floor." };
  }

  return {
    ok: true,
    values: {
      name,
      guardrails: {
        maxConcurrentExperiments: MAX_CONCURRENT_EXPERIMENTS,
        harmTolerance,
        autoAdopt: formData.get("auto_adopt") === "on",
      },
    },
  };
}

export function subjectConfig(draft: SubjectDraft): SubjectConfig {
  return {
    enabled: true,
    active_strategy_id: null,
    guardrails: {
      max_concurrent_experiments: draft.guardrails.maxConcurrentExperiments,
      harm_tolerance: draft.guardrails.harmTolerance,
      auto_adopt: draft.guardrails.autoAdopt,
    },
    auto_adopt: draft.guardrails.autoAdopt,
    max_concurrent_experiments: draft.guardrails.maxConcurrentExperiments,
    bootstrap_completed_at: null,
  };
}

/** Scout and intent keep their tasks. An optimizer never falls through to a scout run. */
export function taskForDueAgent(kind: string): "optimizer" | "intent-scan" | "scout-run" | null {
  if (kind === "optimizer") return "optimizer";
  if (kind === "intent") return "intent-scan";
  if (kind === "scout") return "scout-run";
  return null;
}
