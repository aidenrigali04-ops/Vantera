/** Rules-gate criteria stored in icps.criteria (rule 06). All matching is case-insensitive. */
export interface IcpCriteria {
  industries?: string[];
  companySizes?: string[];
  titles?: string[];
  seniorities?: string[];
  geos?: string[];
  techStack?: string[];
}

export interface ProspectFilters {
  industries?: string[];
  companySizes?: string[];
  titles?: string[];
  seniorities?: string[];
  geos?: string[];
  techStack?: string[];
  /** buying signals to bias discovery toward: hiring, funding, tech_change, intent */
  signals?: string[];
}

/** Discovery output — cheap fields only; enrichment is spent on gate survivors (rule 05). */
export interface ProspectCandidate {
  externalRef: string;
  /** Provider company id — needed to fetch firmographics (industry/size) at enrichment time. */
  businessId?: string;
  companyName: string;
  companyDomain?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  linkedinUrl?: string;
}

/** A prospect to enrich. businessId (from discovery) unlocks firmographics; refs without it get contacts only. */
export interface ProspectRef {
  externalRef: string;
  businessId?: string;
}

export interface ProspectSignal {
  /** normalized category: funding, exec_hire, m_and_a, office_opening, product_launch, partnership,
   *  award, hiring, workforce, cost_cutting, legal, security, intent, or other */
  kind: string;
  /** the human one-line "why now" shown in the UI; falls back to `detail` when absent */
  label?: string;
  detail: string;
  /** intent signals only: in_depth | active | early */
  level?: string;
  observedAt?: string;
}

export interface EnrichedProspect extends ProspectCandidate {
  email?: string;
  emailStatus?: "valid" | "invalid" | "risky";
  phone?: string;
  phoneStatus?: "valid" | "invalid";
  firmographics?: Record<string, unknown>;
  technographics?: string[];
  signals?: ProspectSignal[];
}

/** Provider-agnostic prospect discovery + enrichment interface (rule 05). Explorium is an implementation detail behind it. */
export interface ProspectDataSource {
  discoverProspects(filters: ProspectFilters, limit: number): Promise<ProspectCandidate[]>;
  enrichProspects(refs: ProspectRef[]): Promise<EnrichedProspect[]>;
}
