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
import { generateColorsFromPrompt } from './mistral'
import { createSupabaseClient, createSupabaseClientWithToken, extractBearerToken, verifyToken } from './supabase'

interface Env {
  MISTRAL_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_PALETTES_TABLE: string
  SUPABASE_PALETTES_VIEW: string
}

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

      '/generate-colors-from-prompts': async () => {
        try {
          const body = (await request.json()) as { prompt: string }

          if (!body.prompt) {
            return new Response(JSON.stringify({ message: 'Missing "prompt" field' }) as BodyInit, {
              status: 400,
              headers: corsHeaders,
            })
          }

          const palette = await generateColorsFromPrompt(env.MISTRAL_API_KEY, body.prompt)

          return new Response(JSON.stringify(palette) as BodyInit, {
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

      '/authenticate': async () => {
        try {
          const body = (await request.json()) as { email: string; password: string }

          if (!body.email || !body.password) {
            return new Response(JSON.stringify({ message: 'Missing "email" or "password" field' }) as BodyInit, {
              status: 400,
              headers: corsHeaders,
            })
          }

          const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
          const { data, error } = await supabase.auth.signInWithPassword({
            email: body.email,
            password: body.password,
          })

          if (error || !data.session) {
            return new Response(JSON.stringify({ message: error?.message ?? 'Authentication failed' }) as BodyInit, {
              status: 401,
              headers: corsHeaders,
            })
          }

          return new Response(
            JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_in: data.session.expires_in,
              user: { id: data.user.id, email: data.user.email },
            }) as BodyInit,
            { status: 200, headers: jsonHeaders },
          )
        } catch (error) {
          return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
            status: 500,
            headers: corsHeaders,
          })
        }
      },

      '/list-published-palettes': async () => {
        try {
          const url = new URL(request.url)
          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)))
          const search = url.searchParams.get('search') ?? ''

          const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

          let query = supabase
            .from(env.SUPABASE_PALETTES_VIEW)
            .select('palette_id, name, description, preset, shift, are_source_colors_locked, colors, themes, color_space, algorithm_version, creator_full_name, creator_avatar_url, is_shared, star_count')
            .eq('is_shared', true)
            .order('published_at', { ascending: false })
            .order('add_count', { ascending: false })
            .range(limit * (page - 1), limit * page - 1)

          if (search !== '') query = query.ilike('name', `%${search}%`)

          const { data, error } = await query

          if (error) throw error

          return new Response(JSON.stringify(data) as BodyInit, {
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

      '/publish-palette': async () => {
        try {
          const token = extractBearerToken(request)
          if (!token) {
            return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
              status: 401,
              headers: corsHeaders,
            })
          }

          const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
          const body = (await request.json()) as {
            palette_id: string
            name: string
            description?: string
            preset: unknown
            shift: unknown
            are_source_colors_locked: unknown
            colors: unknown
            themes: unknown
            color_space: string
            algorithm_version: string
            is_shared?: boolean
            created_at: string
          }

          const now = new Date().toISOString()
          const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

          const { data, error } = await supabase
            .from(env.SUPABASE_PALETTES_TABLE)
            .insert([
              {
                ...body,
                is_shared: body.is_shared ?? false,
                creator_id: user.id,
                updated_at: now,
                published_at: now,
              },
            ])
            .select()
            .single()

          if (error) throw error

          return new Response(JSON.stringify(data) as BodyInit, {
            status: 201,
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

    // Dynamic routes with palette_id
    const getMatch = endpoint.match(/^\/get-published-palette\/(.+)$/)
    if (getMatch) {
      const paletteId = getMatch[1]
      try {
        const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
        const { data, error } = await supabase
          .from(env.SUPABASE_PALETTES_VIEW)
          .select('palette_id, name, description, preset, shift, are_source_colors_locked, colors, themes, color_space, algorithm_version, creator_full_name, creator_avatar_url, is_shared, star_count')
          .eq('palette_id', paletteId)
          .eq('is_shared', true)
          .single()

        if (error) throw error
        if (!data) {
          return new Response(JSON.stringify({ message: 'Palette not found' }) as BodyInit, {
            status: 404,
            headers: corsHeaders,
          })
        }

        return new Response(JSON.stringify(data) as BodyInit, {
          status: 200,
          headers: jsonHeaders,
        })
      } catch (error) {
        return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
          status: 500,
          headers: corsHeaders,
        })
      }
    }

    const shareMatch = endpoint.match(/^\/share-published-palette\/(.+)$/)
    if (shareMatch) {
      const paletteId = shareMatch[1]
      try {
        const token = extractBearerToken(request)
        if (!token) {
          return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
            status: 401,
            headers: corsHeaders,
          })
        }

        const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
        const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

        const { data, error } = await supabase
          .from(env.SUPABASE_PALETTES_TABLE)
          .update({ is_shared: true, updated_at: new Date().toISOString() })
          .eq('palette_id', paletteId)
          .eq('creator_id', user.id)
          .select()
          .single()

        if (error) throw error
        if (!data) {
          return new Response(JSON.stringify({ message: 'Palette not found or unauthorized' }) as BodyInit, {
            status: 404,
            headers: corsHeaders,
          })
        }

        return new Response(JSON.stringify(data) as BodyInit, {
          status: 200,
          headers: jsonHeaders,
        })
      } catch (error) {
        return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
          status: 500,
          headers: corsHeaders,
        })
      }
    }

    const unpublishMatch = endpoint.match(/^\/unpublish-palette\/(.+)$/)
    if (unpublishMatch) {
      const paletteId = unpublishMatch[1]
      try {
        const token = extractBearerToken(request)
        if (!token) {
          return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
            status: 401,
            headers: corsHeaders,
          })
        }

        const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
        const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

        const { error } = await supabase
          .from(env.SUPABASE_PALETTES_TABLE)
          .delete()
          .eq('palette_id', paletteId)
          .eq('creator_id', user.id)

        if (error) throw error

        return new Response(null, { status: 204, headers: corsHeaders })
      } catch (error) {
        return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
          status: 500,
          headers: corsHeaders,
        })
      }
    }

    const unshareMatch = endpoint.match(/^\/unshare-palette\/(.+)$/)
    if (unshareMatch) {
      const paletteId = unshareMatch[1]
      try {
        const token = extractBearerToken(request)
        if (!token) {
          return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
            status: 401,
            headers: corsHeaders,
          })
        }

        const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
        const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

        const { data, error } = await supabase
          .from(env.SUPABASE_PALETTES_TABLE)
          .update({ is_shared: false, updated_at: new Date().toISOString() })
          .eq('palette_id', paletteId)
          .eq('creator_id', user.id)
          .select()
          .single()

        if (error) throw error
        if (!data) {
          return new Response(JSON.stringify({ message: 'Palette not found or unauthorized' }) as BodyInit, {
            status: 404,
            headers: corsHeaders,
          })
        }

        return new Response(JSON.stringify(data) as BodyInit, {
          status: 200,
          headers: jsonHeaders,
        })
      } catch (error) {
        return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
          status: 500,
          headers: corsHeaders,
        })
      }
    }

    const updateMatch = endpoint.match(/^\/update-published-palette\/(.+)$/)
    if (updateMatch) {
      const paletteId = updateMatch[1]
      try {
        const token = extractBearerToken(request)
        if (!token) {
          return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
            status: 401,
            headers: corsHeaders,
          })
        }

        const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
        const body = (await request.json()) as Partial<{
          name: string
          description: string
          preset: unknown
          shift: unknown
          are_source_colors_locked: unknown
          colors: unknown
          themes: unknown
          color_space: string
          algorithm_version: string
          is_shared: boolean
        }>

        const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

        const { data, error } = await supabase
          .from(env.SUPABASE_PALETTES_TABLE)
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq('palette_id', paletteId)
          .eq('creator_id', user.id)
          .select()
          .single()

        if (error) throw error
        if (!data) {
          return new Response(JSON.stringify({ message: 'Palette not found or unauthorized' }) as BodyInit, {
            status: 404,
            headers: corsHeaders,
          })
        }

        return new Response(JSON.stringify(data) as BodyInit, {
          status: 200,
          headers: jsonHeaders,
        })
      } catch (error) {
        return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
          status: 500,
          headers: corsHeaders,
        })
      }
    }

    return new Response('Invalid action type', {
      status: 400,
    })
  },
}
