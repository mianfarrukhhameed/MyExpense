/** FCM HTTP v1 helpers for Cloudflare Workers (Web Crypto, zero deps). */

export type FcmCredentials = {
  projectId: string
  clientEmail: string
  /** PEM PKCS8; may contain literal `\n` from wrangler secrets. */
  privateKeyPem: string
}

function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n').trim()
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = normalizePem(pem)
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** Mint a short-lived OAuth2 access token for FCM HTTP v1. */
export async function getFcmAccessToken(
  credentials: FcmCredentials,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: credentials.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claims),
  )}`
  const key = await importPrivateKey(credentials.privateKeyPem)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = (await res.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `OAuth token exchange failed: ${data.error_description || data.error || res.status}`,
    )
  }

  return data.access_token
}

export type SendResult = {
  token: string
  ok: boolean
  status: number
  errorCode?: string
  errorMessage?: string
}

const DEFAULT_TITLE = 'MyExpense'
const DEFAULT_BODY = "Time to log today's expenses"

/** Send one FCM HTTP v1 notification to a device token. */
export async function sendFcmNotification(
  credentials: FcmCredentials,
  accessToken: string,
  deviceToken: string,
  options?: { title?: string; body?: string },
): Promise<SendResult> {
  const title = options?.title ?? DEFAULT_TITLE
  const body = options?.body ?? DEFAULT_BODY

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          webpush: {
            notification: {
              title,
              body,
              icon: '/icons/icon-192.png',
            },
            fcm_options: {
              link: '/',
            },
          },
        },
      }),
    },
  )

  if (res.ok) {
    return { token: deviceToken, ok: true, status: res.status }
  }

  let errorCode: string | undefined
  let errorMessage: string | undefined
  try {
    const err = (await res.json()) as {
      error?: { status?: string; message?: string; details?: unknown[] }
    }
    errorCode = err.error?.status
    errorMessage = err.error?.message
  } catch {
    errorMessage = await res.text().catch(() => undefined)
  }

  return {
    token: deviceToken,
    ok: false,
    status: res.status,
    errorCode,
    errorMessage,
  }
}

export async function sendFcmToTokens(
  credentials: FcmCredentials,
  tokens: string[],
  options?: { title?: string; body?: string },
): Promise<{ sent: number; failed: number; unregistered: string[]; results: SendResult[] }> {
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, unregistered: [], results: [] }
  }

  const accessToken = await getFcmAccessToken(credentials)
  const results: SendResult[] = []

  // Sequential — personal app; keeps Worker subrequest limits predictable
  for (const token of tokens) {
    results.push(await sendFcmNotification(credentials, accessToken, token, options))
  }

  const unregistered = results
    .filter(
      (row) =>
        !row.ok &&
        (row.errorCode === 'NOT_FOUND' ||
          /UNREGISTERED|Requested entity was not found/i.test(
            row.errorMessage ?? '',
          )),
    )
    .map((row) => row.token)

  return {
    sent: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    unregistered,
    results,
  }
}
