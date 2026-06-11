/** Base URL for auth email redirects. NEXT_PUBLIC_APP_URL is set per environment (rule 10). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
