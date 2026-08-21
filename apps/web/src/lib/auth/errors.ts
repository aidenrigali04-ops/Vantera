const KNOWN: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password.",
  "Email not confirmed": "Confirm your email first — check your inbox for the link.",
  "User already registered": "An account with this email already exists. Try signing in.",
};

// Substring matches for errors whose message carries variable detail (limits, counts).
const PARTIAL: [needle: string, friendly: string][] = [
  [
    "rate limit",
    "Too many attempts right now — please wait a few minutes and try again.",
  ],
  // The admin createUser path (confirmation-free signup) words duplicates differently
  // from the public signUp endpoint.
  [
    "already been registered",
    "An account with this email already exists. Try signing in.",
  ],
];

export function friendlyAuthError(message: string): string {
  if (KNOWN[message]) return KNOWN[message];
  const lower = message.toLowerCase();
  const partial = PARTIAL.find(([needle]) => lower.includes(needle));
  if (partial) return partial[1];
  // Unmapped: surface the raw message in logs so the generic fallback is diagnosable.
  console.error("Unmapped auth error:", message);
  return "Something went wrong. Please try again.";
}
