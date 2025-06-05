import { Data } from '@a_ng_d/utils-ui-color-palette'

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const endpoint = new URL(request.url).pathname

    console.log(`Request received for endpoint: ${endpoint}`)

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

    const actions = {
      '/get-full-palette': async () => {
        try {
          const body = request.body ? await request.json() : null
          const data = new Data({
            base: body.base,
            themes: body.themes,
          }).makePaletteData(body.previous !== undefined ? body.previous : undefined)

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
          console.error(`KV returned error: ${error}`)
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
