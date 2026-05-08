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
import decodePng, { init as initPng } from '@jsquash/png/decode'
// @ts-ignore
import PNG_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm'
import { uid } from 'uid'
import { generateColorsFromPrompt } from './mistral'
import { createSupabaseClient, createSupabaseClientWithToken, extractBearerToken, verifyToken } from './supabase'

// Local types until @a_ng_d/utils-ui-color-palette 1.10.0 is published.
// Mirror the shapes defined in utils-ui-color-palette/src/types/configuration.types.ts
interface TaxonomyGroupMemberLocal {
  id: string
  name: string
}
interface TaxonomyGroupLocal {
  id: string
  name: string
  members: Array<TaxonomyGroupMemberLocal>
}
interface TaxonomySchemaLocal {
  groups: Array<TaxonomyGroupLocal>
}
interface TaxonomyBindingLocal {
  path: Array<string>
  description?: string
  ref: string
  overrides?: Record<string, string>
  isExcluded?: boolean
}
interface SystemConfigurationLocal {
  schema: TaxonomySchemaLocal
  bindings?: Array<TaxonomyBindingLocal>
}

interface Env {
  MISTRAL_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_PALETTES_TABLE: string
  SUPABASE_PALETTES_VIEW: string
  AUTH_WORKER_URL: string
  AUTH_URL: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rawPathname = new URL(request.url).pathname
    const endpoint = rawPathname.replace(/^\/v1(?=\/|$)/, '')

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
      '/get-color-system': async () => {
        try {
          const body = request.body
            ? ((await request.json()) as {
                base: Partial<BaseConfiguration>
                themes: Array<Partial<ThemeConfiguration>>
                system: SystemConfigurationLocal
              })
            : null
          if (!body || !body.system) {
            return new Response(JSON.stringify({ message: 'Missing system configuration' }) as BodyInit, {
              status: 400,
              headers: corsHeaders,
            })
          }
          const base: BaseConfiguration = {
            ...body.base,
            preset: { ...body.base!.preset!, id: body.base!.preset?.id ?? uid(11) },
            colors: (body.base!.colors ?? []).map((c) => ({ ...c, id: c.id ?? uid(11) })),
          } as BaseConfiguration
          const themes: Array<ThemeConfiguration> = (body.themes ?? []).map((t) => ({
            ...t,
            id: t.id ?? uid(11),
          })) as Array<ThemeConfiguration>
          const paletteData = new Data({ base, themes }).makePaletteData()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const utilsModule = (await import('@a_ng_d/utils-ui-color-palette')) as any
          const SystemClass = utilsModule.System
          if (typeof SystemClass !== 'function') {
            return new Response(
              JSON.stringify({
                message: 'System class unavailable. Requires @a_ng_d/utils-ui-color-palette >= 1.10.0',
              }) as BodyInit,
              { status: 501, headers: jsonHeaders }
            )
          }
          const systemData = new SystemClass({
            paletteData,
            system: body.system,
          }).makeSystemData()

          return new Response(JSON.stringify(systemData) as BodyInit, {
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

      '/get-palette': async () => {
        try {
          const body = request.body
            ? ((await request.json()) as {
                base: Partial<BaseConfiguration>
                themes: Array<Partial<ThemeConfiguration>>
                includeLibraryData?: boolean
              })
            : null
          const base: BaseConfiguration = {
            ...body!.base,
            preset: { ...body!.base!.preset!, id: body!.base!.preset?.id ?? uid(11) },
            colors: (body!.base!.colors ?? []).map((c) => ({ ...c, id: c.id ?? uid(11) })),
          } as BaseConfiguration
          const themes: Array<ThemeConfiguration> = (body!.themes ?? []).map((t) => ({
            ...t,
            id: t.id ?? uid(11),
          })) as Array<ThemeConfiguration>
          // The `includeLibraryData` option is available in utils >= 1.10.0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: PaletteData = (new Data({ base, themes }).makePaletteData as any)({
            includeLibraryData: body!.includeLibraryData,
          })

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
              await initPng(PNG_WASM)
              imageData = await decodePng(arrayBuffer)
            } else {
              return new Response(
                JSON.stringify({ message: `Unsupported image type: ${mimeType}. Use image/jpeg or image/png.` }) as BodyInit,
                {
                  status: 400,
                  headers: corsHeaders,
                },
              )
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
              imageUrl?: string
              imageData?: { data: number[]; width: number; height: number }
              colorCount?: number
              maxIterations?: number
              tolerance?: number
              skipTransparent?: boolean
            }

            if (body.imageUrl) {
              const res = await fetch(body.imageUrl)
              if (!res.ok) {
                return new Response(JSON.stringify({ message: `Failed to fetch image: ${res.status} ${res.statusText}` }) as BodyInit, {
                  status: 400,
                  headers: corsHeaders,
                })
              }
              const mimeType = res.headers.get('Content-Type') ?? ''
              const arrayBuffer = await res.arrayBuffer()

              if (mimeType.includes('image/jpeg') || mimeType.includes('image/jpg')) {
                imageData = await decodeJpeg(arrayBuffer)
              } else if (mimeType.includes('image/png')) {
                await initPng(PNG_WASM)
                imageData = await decodePng(arrayBuffer)
              } else {
                return new Response(
                  JSON.stringify({ message: `Unsupported image type: ${mimeType}. Use image/jpeg or image/png.` }) as BodyInit,
                  {
                    status: 400,
                    headers: corsHeaders,
                  },
                )
              }
            } else if (body.imageData) {
              imageData = {
                data: new Uint8ClampedArray(body.imageData.data),
                width: body.imageData.width,
                height: body.imageData.height,
              }
            } else {
              return new Response(JSON.stringify({ message: 'Missing "imageUrl" or "imageData" field' }) as BodyInit, {
                status: 400,
                headers: corsHeaders,
              })
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
            base: BaseConfiguration
            themes: Array<ThemeConfiguration>
            format?: string
            colorSpace?: ColorSpaceConfiguration
            system?: SystemConfigurationLocal
          }
          const data = new Data({
            base: body!.base,
            themes: body!.themes,
          }).makePaletteData()

          // Build SystemData if a system config is provided
          let systemData: unknown
          if (body.system) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const utilsModule = (await import('@a_ng_d/utils-ui-color-palette')) as any
            const SystemClass = utilsModule.System
            if (typeof SystemClass !== 'function')
              return new Response(
                JSON.stringify({
                  message:
                    'System class unavailable. Requires @a_ng_d/utils-ui-color-palette >= 1.10.0',
                }) as BodyInit,
                { status: 501, headers: jsonHeaders }
              )
            systemData = new SystemClass({ paletteData: data, system: body.system }).makeSystemData()
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const code = new (Code as any)({ paletteData: data, systemData })
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
            .select(
              'palette_id, name, description, preset, shift, are_source_colors_locked, colors, themes, color_space, algorithm_version, creator_full_name, creator_avatar_url, is_shared, star_count',
            )
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

      '/list-my-published-palettes': async () => {
        try {
          const token = extractBearerToken(request)
          if (!token) {
            return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
              status: 401,
              headers: corsHeaders,
            })
          }

          const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
          const url = new URL(request.url)
          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)))
          const search = url.searchParams.get('search') ?? ''

          const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

          let query = supabase
            .from(env.SUPABASE_PALETTES_TABLE)
            .select(
              'palette_id, name, description, preset, shift, are_source_colors_locked, colors, themes, color_space, algorithm_version, is_shared, created_at, updated_at, published_at',
            )
            .eq('creator_id', user.id)
            .order('published_at', { ascending: false })
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
            name: string
            description?: string
            preset: Record<string, unknown>
            shift: unknown
            are_source_colors_locked: unknown
            colors: Array<Record<string, unknown>>
            themes: Array<Record<string, unknown>>
            color_space: string
            algorithm_version: string
            is_shared?: boolean
          }

          const preset = { ...body.preset, id: body.preset?.id ?? uid(11) }
          const colors = (body.colors ?? []).map((c) => ({ ...c, id: c.id ?? uid(11) }))
          const themes = (body.themes ?? []).map((t) => ({ ...t, id: t.id ?? uid(11) }))

          const now = new Date().toISOString()
          const supabase = createSupabaseClientWithToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)

          const { data, error } = await supabase
            .from(env.SUPABASE_PALETTES_TABLE)
            .insert([
              {
                ...body,
                preset,
                colors,
                themes,
                palette_id: uid(11),
                is_shared: body.is_shared ?? false,
                creator_id: user.id,
                created_at: now,
                updated_at: now,
                published_at: now,
              },
            ])
            .select()
            .single()

          if (error) {
            return new Response(JSON.stringify({ message: error.message }) as BodyInit, {
              status: 500,
              headers: corsHeaders,
            })
          }

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
          .select(
            'palette_id, name, description, preset, shift, are_source_colors_locked, colors, themes, color_space, algorithm_version, creator_full_name, creator_avatar_url, is_shared, star_count',
          )
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

        const { data, error } = await supabase
          .from(env.SUPABASE_PALETTES_TABLE)
          .delete()
          .eq('palette_id', paletteId)
          .eq('creator_id', user.id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
      } catch (error) {
        return new Response(JSON.stringify({ message: String(error) }) as BodyInit, {
          status: 500,
          headers: corsHeaders,
        })
      }
    }

    const unshareMatch = endpoint.match(/^\/unshare-published-palette\/(.+)$/)
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

        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from(env.SUPABASE_PALETTES_TABLE)
          .update({ ...body, updated_at: now, published_at: now })
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
