import {
  Data,
  Code,
  ColorHarmony,
  DominantColors,
  BaseConfiguration,
  ThemeConfiguration,
  PaletteData,
  ColorSpaceConfiguration,
  Channel,
  HarmonyType,
} from '@a_ng_d/utils-ui-color-palette'
import decodeJpeg from '@jsquash/jpeg/decode'
import decodePng from '@jsquash/png/decode'

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

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' }
    const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

    const actions: Record<string, () => Promise<Response>> = {
      '/get-full-palette': async () => {
        try {
          const body = request.body ? ((await request.json()) as { base: BaseConfiguration; themes: Array<ThemeConfiguration> }) : null
          const data = new Data({
            base: body!.base,
            themes: body!.themes,
          }).makePaletteData()

          if (data === null || data === undefined) {
            return new Response(JSON.stringify({ message: 'The provided palette is not valid' }) as BodyInit, {
              status: 400,
              headers: corsHeaders,
            })
          }

          return new Response(JSON.stringify(data) as BodyInit, {
            status: 200,
            headers: jsonHeaders,
          })
        } catch (error) {
          return new Response(JSON.stringify({ message: error }) as BodyInit, {
            status: 500,
            headers: corsHeaders,
          })
        }
      },

      '/create-color-harmony': async () => {
        try {
          const body = (await request.json()) as {
            baseColor: Channel
            analogousSpread?: number
            returnFormat?: 'rgb' | 'hex' | 'both'
            type?: HarmonyType | 'ALL'
          }

          const harmony = new ColorHarmony({
            baseColor: body.baseColor,
            analogousSpread: body.analogousSpread,
            returnFormat: body.returnFormat,
          })

          const result = !body.type || body.type === 'ALL' ? harmony.getAllHarmonies() : harmony.generateHarmony(body.type)

          return new Response(JSON.stringify(result) as BodyInit, {
            status: 200,
            headers: jsonHeaders,
          })
        } catch (error) {
          return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
            status: 500,
            headers: corsHeaders,
          })
        }
      },

      '/extract-dominant-colors': async () => {
        try {
          const contentType = request.headers.get('Content-Type') ?? ''

          let imageData: { data: Uint8ClampedArray; width: number; height: number }
          let options: { colorCount?: number; maxIterations?: number; tolerance?: number; skipTransparent?: boolean } = {}

          if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData()
            const file = formData.get('image') as unknown as File

            if (!file) {
              return new Response(JSON.stringify({ message: 'Missing "image" field in form data' }) as BodyInit, {
                status: 400,
                headers: corsHeaders,
              })
            }

            const arrayBuffer = await file.arrayBuffer()
            const mimeType = file.type

            if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
              imageData = await decodeJpeg(arrayBuffer)
            } else if (mimeType === 'image/png') {
              imageData = await decodePng(arrayBuffer)
            } else {
              return new Response(JSON.stringify({ message: `Unsupported image type: ${mimeType}. Use image/jpeg or image/png.` }) as BodyInit, {
                status: 400,
                headers: corsHeaders,
              })
            }

            const colorCount = formData.get('colorCount')
            const maxIterations = formData.get('maxIterations')
            const tolerance = formData.get('tolerance')
            const skipTransparent = formData.get('skipTransparent')

            options = {
              colorCount: colorCount !== null ? Number(colorCount) : undefined,
              maxIterations: maxIterations !== null ? Number(maxIterations) : undefined,
              tolerance: tolerance !== null ? Number(tolerance) : undefined,
              skipTransparent: skipTransparent !== null ? skipTransparent === 'true' : undefined,
            }
          } else {
            const body = (await request.json()) as {
              imageData: { data: number[]; width: number; height: number }
              colorCount?: number
              maxIterations?: number
              tolerance?: number
              skipTransparent?: boolean
            }

            imageData = {
              data: new Uint8ClampedArray(body.imageData.data),
              width: body.imageData.width,
              height: body.imageData.height,
            }
            options = {
              colorCount: body.colorCount,
              maxIterations: body.maxIterations,
              tolerance: body.tolerance,
              skipTransparent: body.skipTransparent,
            }
          }

          const dominantColors = new DominantColors({ imageData, ...options })
          const result = dominantColors.extractDominantColors()

          return new Response(JSON.stringify(result) as BodyInit, {
            status: 200,
            headers: jsonHeaders,
          })
        } catch (error) {
          return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
            status: 500,
            headers: corsHeaders,
          })
        }
      },

      '/generate-code': async () => {
        try {
          const body = (await request.json()) as {
            paletteData: PaletteData
            format?: string
            colorSpace?: ColorSpaceConfiguration
          }

          const code = new Code(body.paletteData)
          const format = body.format ?? 'css'
          const colorSpace = body.colorSpace ?? 'RGB'

          let result: unknown

          switch (format) {
            case 'css':
              result = code.makeCssCustomProps(colorSpace)
              break
            case 'scss':
              result = code.makeScssVariables(colorSpace)
              break
            case 'less':
              result = code.makeLessVariables(colorSpace)
              break
            case 'tailwind-v3':
              result = code.makeTailwindV3Config()
              break
            case 'tailwind-v4':
              result = code.makeTailwindV4Config()
              break
            case 'swift-ui':
              result = code.makeSwiftUI()
              break
            case 'ui-kit':
              result = code.makeUIKit()
              break
            case 'compose':
              result = code.makeCompose()
              break
            case 'resources':
              result = code.makeResources()
              break
            case 'csv':
              result = code.makeCsv()
              break
            case 'native-tokens':
              result = code.makeNativeTokens()
              break
            case 'dtcg-tokens':
              result = code.makeDtcgTokens(colorSpace)
              break
            case 'style-dictionary-v3':
              result = code.makeStyleDictionaryV3Tokens()
              break
            case 'universal-json':
              result = code.makeUniversalJson()
              break
            default:
              return new Response(JSON.stringify({ message: `Unknown format: ${format}` }) as BodyInit, {
                status: 400,
                headers: corsHeaders,
              })
          }

          return new Response(JSON.stringify(result) as BodyInit, {
            status: 200,
            headers: jsonHeaders,
          })
        } catch (error) {
          return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
            status: 500,
            headers: corsHeaders,
          })
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
