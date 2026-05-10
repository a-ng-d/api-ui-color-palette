import { verifyToken } from '../supabase'
import type { HandlerContext } from '../types'

export const handleAuthenticate = async ({ env, ctx, corsHeaders }: HandlerContext): Promise<Response> => {
  const sseHeaders = {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  }

  const passkeyResponse = await fetch(`${env.AUTH_WORKER_URL}/passkey`, { method: 'GET' })

  if (!passkeyResponse.ok) {
    return new Response(JSON.stringify({ message: 'Failed to fetch passkey' }) as BodyInit, {
      status: 502,
      headers: corsHeaders,
    })
  }

  const { passkey } = (await passkeyResponse.json()) as { passkey: string }
  const authUrl = `${env.AUTH_URL}/?passkey=${passkey}`
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  const send = (data: object) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  ctx.waitUntil(
    (async () => {
      await send({
        status: 'pending',
        passkey,
        auth_url: authUrl,
        message: `Please authenticate by opening the following URL in your browser: ${authUrl}`,
      })

      const timeout = Date.now() + 2 * 60 * 1000

      while (Date.now() < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const res = await fetch(`${env.AUTH_WORKER_URL}/tokens?passkey=${passkey}`, { method: 'GET' })
        const result = (await res.json()) as { message?: string; tokens?: { access_token: string; refresh_token: string } }

        if (result.message !== 'No token found') {
          await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, result.tokens!.access_token)
          await send({ status: 'success', access_token: result.tokens!.access_token, refresh_token: result.tokens!.refresh_token })
          break
        }
      }

      writer.close()
    })(),
  )

  return new Response(readable, { status: 200, headers: sseHeaders })
}
