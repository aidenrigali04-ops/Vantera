import type {
  UnipileAccount,
  UnipileHostedAuthResponse,
  UnipileSendConnectionResponse,
  UnipileSendMessageResponse,
} from './types'

function getCredentials() {
  const apiKey = process.env.UNIPILE_API_KEY
  const dsn = process.env.UNIPILE_DSN
  if (!apiKey || !dsn) {
    throw new Error(
      'UNIPILE_API_KEY and UNIPILE_DSN are required. Add them in Vercel → Environment Variables.',
    )
  }
  const base = dsn.replace(/\/$/, '')
  return { apiKey, base }
}

async function unipileFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { apiKey, base } = getCredentials()
  const url = `${base}/api/v1${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Unipile ${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

/**
 * Generate a hosted-auth URL. The user visits this URL in their browser to
 * connect their LinkedIn account to Unipile. After auth, Unipile calls the
 * `notify_url` webhook with `type: account_connected`.
 */
export async function createHostedAuthLink(options: {
  /** Opaque identifier stored on the Unipile user (e.g. Vantera accountId:userId). */
  name: string
  /** Where to redirect the user on success. */
  successRedirectUrl: string
  /** Where to redirect the user on failure / cancel. */
  failureRedirectUrl: string
  /** Webhook that Unipile POSTs to when the account is connected. */
  notifyUrl: string
  /** ISO date for link expiry (default 15 min from now). */
  expiresOn?: string
}): Promise<UnipileHostedAuthResponse> {
  const expiresOn =
    options.expiresOn ?? new Date(Date.now() + 15 * 60 * 1000).toISOString()

  return unipileFetch<UnipileHostedAuthResponse>('/users/create', {
    method: 'POST',
    body: JSON.stringify({
      name: options.name,
      providers_filters: ['LINKEDIN'],
      success_redirect_url: options.successRedirectUrl,
      failure_redirect_url: options.failureRedirectUrl,
      notify_url: options.notifyUrl,
      expiresOn,
    }),
  })
}

/** Fetch a connected Unipile account by its ID. */
export async function getUnipileAccount(unipileAccountId: string): Promise<UnipileAccount> {
  return unipileFetch<UnipileAccount>(`/accounts/${unipileAccountId}`)
}

/** List all accounts — useful for debugging. */
export async function listUnipileAccounts(): Promise<{ items: UnipileAccount[] }> {
  return unipileFetch<{ items: UnipileAccount[] }>('/accounts')
}

/**
 * Send a LinkedIn connection request with an optional note (≤300 chars).
 * `linkedinUrl` is the prospect's full LinkedIn profile URL.
 */
export async function sendLinkedInConnectionRequest(
  unipileAccountId: string,
  linkedinUrl: string,
  message: string,
): Promise<UnipileSendConnectionResponse> {
  return unipileFetch<UnipileSendConnectionResponse>('/linkedin/profiles/invite', {
    method: 'POST',
    body: JSON.stringify({
      account_id: unipileAccountId,
      linkedin_url: linkedinUrl,
      message: message.slice(0, 300),
    }),
  })
}

/**
 * Send a LinkedIn DM to an existing connection.
 * Use this for follow-up messages after the connection has been accepted.
 */
export async function sendLinkedInMessage(
  unipileAccountId: string,
  linkedinUrl: string,
  text: string,
): Promise<UnipileSendMessageResponse> {
  return unipileFetch<UnipileSendMessageResponse>('/messaging/new/message', {
    method: 'POST',
    body: JSON.stringify({
      account_id: unipileAccountId,
      linkedin_url: linkedinUrl,
      text,
    }),
  })
}

/** Delete / disconnect an account from Unipile. */
export async function deleteUnipileAccount(unipileAccountId: string): Promise<void> {
  await unipileFetch(`/accounts/${unipileAccountId}`, { method: 'DELETE' })
}
