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

export interface ProspectSignal {
  kind: string;
  detail: string;
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
  enrichProspects(externalRefs: string[]): Promise<EnrichedProspect[]>;
}
