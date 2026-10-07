/**
 * Cloudflare Worker cron stub — sends a daily FCM reminder to profiles with fcm_token.
 *
 * Required secrets (wrangler secret put …):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - FCM_PROJECT_ID
 * - FCM_CLIENT_EMAIL
 * - FCM_PRIVATE_KEY (PEM; newlines as \n)
 *
 * This is intentionally minimal for personal use. Prefer Firebase Console “Send test
 * message” while developing; wire real OAuth2 JWT minting for FCM HTTP v1 in production.
 */

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  FCM_PROJECT_ID: string
  FCM_CLIENT_EMAIL: string
  FCM_PRIVATE_KEY: string
}

async function listTokens(env: Env): Promise<string[]> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?select=fcm_token&fcm_token=not.is.null`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Supabase profiles query failed: ${res.status}`)
  }
  const rows = (await res.json()) as Array<{ fcm_token: string | null }>
  return rows.map((row) => row.fcm_token).filter((t): t is string => Boolean(t))
}

/**
 * Placeholder sender — logs intent. Replace with FCM HTTP v1 using a Google
 * service-account JWT (see Firebase docs) before production use.
 */
async function sendReminderStub(env: Env, tokens: string[]): Promise<void> {
  console.log(
    JSON.stringify({
      projectId: env.FCM_PROJECT_ID,
      clientEmail: env.FCM_CLIENT_EMAIL,
      tokenCount: tokens.length,
      note: 'Stub only — implement FCM HTTP v1 send with service account JWT',
    }),
  )
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const tokens = await listTokens(env)
        await sendReminderStub(env, tokens)
      })(),
    )
  },
}
