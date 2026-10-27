import type { ProofInput, ProofLead } from "./types";

export const lead = (id: string, o: Partial<ProofLead> = {}): ProofLead => ({
  id, status: "sourced", source: "discovery",
  linkedin_invited_at: null, linkedin_connected_at: null, meeting_booked_at: null, ...o,
});
export const empty = (): ProofInput => ({
  leads: [], sendLeadIds: [], replies: [], signals: [], observations: [], watch: null, capped: false,
});
