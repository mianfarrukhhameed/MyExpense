/**
 * Cloudflare Worker — daily FCM HTTP v1 reminders for MyExpense.
 *
 * Required secrets (wrangler secret put …):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - FCM_PROJECT_ID
 * - FCM_CLIENT_EMAIL
 * - FCM_PRIVATE_KEY (PEM; newlines as \n)
 *
 * Optional:
 * - REMINDER_TRIGGER_SECRET — if set, POST /send?secret=… triggers a send (manual test)
 */

import { sendFcmToTokens, type FcmCredentials } from './fcm'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  FCM_PROJECT_ID: string
  FCM_CLIENT_EMAIL: string
  FCM_PRIVATE_KEY: string
  REMINDER_TRIGGER_SECRET?: string
}

function fcmCredentials(env: Env): FcmCredentials {
  return {
    projectId: env.FCM_PROJECT_ID,
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKeyPem: env.FCM_PRIVATE_KEY,
  }
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
  const tokens = rows
    .map((row) => row.fcm_token)
    .filter((t): t is string => Boolean(t))
  return [...new Set(tokens)]
}

/** Clear dead tokens so cron does not keep failing on them. */
async function clearUnregisteredTokens(
  env: Env,
  tokens: string[],
): Promise<number> {
  if (tokens.length === 0) return 0
  let cleared = 0
  for (const token of tokens) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?fcm_token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ fcm_token: null }),
      },
    )
    if (res.ok) cleared += 1
  }
  return cleared
}

async function runReminderJob(env: Env): Promise<{
  tokenCount: number
  sent: number
  failed: number
  cleared: number
}> {
  const tokens = await listTokens(env)
  const outcome = await sendFcmToTokens(fcmCredentials(env), tokens)
  const cleared = await clearUnregisteredTokens(env, outcome.unregistered)

  console.log(
    JSON.stringify({
      projectId: env.FCM_PROJECT_ID,
      tokenCount: tokens.length,
      sent: outcome.sent,
      failed: outcome.failed,
      unregistered: outcome.unregistered.length,
      cleared,
    }),
  )

  return {
    tokenCount: tokens.length,
    sent: outcome.sent,
    failed: outcome.failed,
    cleared,
  }
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runReminderJob(env))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        ok: true,
        service: 'myexpense-daily-reminder',
        hint: 'Cron runs daily; POST /send?secret=… to trigger manually when REMINDER_TRIGGER_SECRET is set.',
      })
    }

    if (request.method === 'POST' && url.pathname === '/send') {
      const secret = env.REMINDER_TRIGGER_SECRET
      if (!secret) {
        return Response.json(
          { error: 'REMINDER_TRIGGER_SECRET is not configured' },
          { status: 501 },
        )
      }
      const provided =
        url.searchParams.get('secret') ||
        request.headers.get('x-reminder-secret') ||
        ''
      if (provided !== secret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      try {
        const result = await runReminderJob(env)
        return Response.json({ ok: true, ...result })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Send failed'
        return Response.json({ ok: false, error: message }, { status: 500 })
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  },
}
