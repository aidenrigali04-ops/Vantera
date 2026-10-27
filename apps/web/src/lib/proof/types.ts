export const PROOF_ROW_CAP = 5000;
export type ProofStageKey =
  | "found" | "qualified" | "contacted" | "accepted"
  | "replied" | "interested" | "meetings" | "closed";
export type ProofStage = { key: ProofStageKey; label: string; count: number; pct: number | null };
export type ProofLead = {
  id: string;
  status: string;
  source: string;
  linkedin_invited_at: string | null;
  linkedin_connected_at: string | null;
  meeting_booked_at: string | null;
};
export type ProofInput = {
  leads: ProofLead[];
  sendLeadIds: string[];
  replies: { lead_id: string; classification: string | null }[];
  signals: { lead_id: string; kind: string }[];
  observations: { lead_id: string; watch_target: string | null }[];
  watch: { keywords: string[]; competitors: string[]; creators: string[]; hashtags: string[] } | null;
  capped: boolean;
};
export type ProofRow = {
  key: string;
  label: string;
  group: "signal" | "intent" | "other" | "agent";
  found: number | null;
  contacted: number;
  accepted: number;
  replied: number;
  interested: number;
  closed: number;
};
export type ProofModel = {
  funnel: ProofStage[];
  sources: ProofRow[];
  agents: ProofRow[];
  capped: boolean;
  nonMonotonic: boolean;
};
