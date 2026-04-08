import { Data, BaseConfiguration, ThemeConfiguration } from '@a_ng_d/utils-ui-color-palette'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Env {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const endpoint = new URL(request.url).pathname

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, distinct-id, passkey, tokens, baggage, type, sentry-trace',
        },
      })
    }

    const actions: Record<string, () => Promise<Response>> = {
      '/get-full-palette': async () => {
        try {
          const body = request.body ? ((await request.json()) as { base: BaseConfiguration; themes: Array<ThemeConfiguration> }) : null
          const data = new Data({
            base: body!.base,
            themes: body!.themes,
          }).makePaletteData()

          if (data === null || data === undefined) {
            return new Response(
              JSON.stringify({
                message: 'The provided palette is not valid',
              }) as BodyInit,
              {
                status: 400,
                headers: {
                  'Access-Control-Allow-Origin': '*',
                },
              },
            )
          } else {
            return new Response(JSON.stringify(data) as BodyInit, {
              status: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
              },
            })
          }
        } catch (error) {
          return new Response(
            JSON.stringify({
              message: error,
            }) as BodyInit,
            {
              status: 500,
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
            },
          )
        }
      },
    }

    if (endpoint && actions[endpoint]) {
      return actions[endpoint]()
    }

    return new Response('Invalid action type', {
      status: 400,
    })
  },
}
