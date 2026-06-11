const KNOWN: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password.",
  "Email not confirmed": "Confirm your email first — check your inbox for the link.",
  "User already registered": "An account with this email already exists. Try signing in.",
};

export function friendlyAuthError(message: string): string {
  return KNOWN[message] ?? "Something went wrong. Please try again.";
}
