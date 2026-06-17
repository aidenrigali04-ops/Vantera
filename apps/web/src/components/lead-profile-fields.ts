// Server-safe constant (NOT a client module): the columns a Supabase
// `leads(...)` select needs to fully hydrate the lead profiler. Kept out of
// lead-profile.tsx ("use client") so Server Components can interpolate it into
// a select string — a runtime value exported from a client module becomes an
// unusable client-reference proxy on the server.
export const LEAD_PROFILE_FIELDS =
  "id, first_name, last_name, title, company_name, company_size, industry, location, tech_stack, status, ai_score, ai_rationale, ai_insights, scored_at, email, email_status, phone, phone_status, linkedin_url";
