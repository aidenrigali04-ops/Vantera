/** Exchanges a service-account JSON (with domain-wide delegation) for an access token.
 *  Thin + dependency-light so it can be swapped/mocked. */
export async function googleAccessToken(serviceAccountJson: string): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user",
      "https://www.googleapis.com/auth/admin.directory.domain",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("failed to obtain Google access token");
  return token.token;
}
