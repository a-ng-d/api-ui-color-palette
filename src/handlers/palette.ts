import {
  Data,
  Code,
  ColorHarmony,
  DominantColors,
  BaseConfiguration,
  ThemeConfiguration,
  ColorSpaceConfiguration,
  Channel,
  HarmonyType,
} from '@a_ng_d/utils-ui-color-palette'
import decodeJpeg from '@jsquash/jpeg/decode'
import decodePng, { init as initPng } from '@jsquash/png/decode'
// @ts-ignore
import PNG_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm'
import { uid } from 'uid'
import type { HandlerContext } from '../types'
import { toCompactPaletteData, fillColorDefaults, fillThemeDefaults } from '../helpers'

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

export const handleGetColorSystem = async ({ request, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
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
      colors: (body.base!.colors ?? []).map(fillColorDefaults),
    } as BaseConfiguration
    const themes: Array<ThemeConfiguration> = (body.themes ?? []).map((t) => fillThemeDefaults(t, body.base!.preset!))
    const paletteData = new Data({ base, themes }).makePaletteData()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const utilsModule = (await import('@a_ng_d/utils-ui-color-palette')) as any
    const SystemClass = utilsModule.System
    if (typeof SystemClass !== 'function') {
      return new Response(
        JSON.stringify({ message: 'System class unavailable. Requires @a_ng_d/utils-ui-color-palette >= 1.10.0' }) as BodyInit,
        { status: 501, headers: jsonHeaders },
      )
    }
    const systemData = new SystemClass({ paletteData, system: body.system }).makeSystemData()

    return new Response(JSON.stringify(systemData) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleGetPalette = async ({ request, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
  try {
    const body = request.body
      ? ((await request.json()) as {
          base: Partial<BaseConfiguration>
          themes: Array<Partial<ThemeConfiguration>>
          includeLibraryData?: boolean
          compact?: boolean
        })
      : null
    const base: BaseConfiguration = {
      ...body!.base,
      preset: { ...body!.base!.preset!, id: body!.base!.preset?.id ?? uid(11) },
      colors: (body!.base!.colors ?? []).map(fillColorDefaults),
    } as BaseConfiguration
    const themes: Array<ThemeConfiguration> = (body!.themes ?? []).map((t) => fillThemeDefaults(t, body!.base!.preset!))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (new Data({ base, themes }).makePaletteData as any)({ includeLibraryData: body!.includeLibraryData })

    if (data === null || data === undefined) {
      return new Response(JSON.stringify({ message: 'The provided palette is not valid' }) as BodyInit, {
        status: 400,
        headers: corsHeaders,
      })
    }

    const responseData = body!.compact ? toCompactPaletteData(data) : data
    return new Response(JSON.stringify(responseData) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: error }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleCreateColorHarmony = async ({ request, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
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
    return new Response(JSON.stringify(result) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleExtractDominantColors = async ({ request, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
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
          { status: 400, headers: corsHeaders },
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
          return new Response(
            JSON.stringify({ message: `Failed to fetch image: ${res.status} ${res.statusText}` }) as BodyInit,
            { status: 400, headers: corsHeaders },
          )
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
            { status: 400, headers: corsHeaders },
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
    return new Response(JSON.stringify(result) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleGenerateCode = async ({ request, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
  try {
    const body = (await request.json()) as {
      base: BaseConfiguration
      themes: Array<ThemeConfiguration>
      format?: string
      colorSpace?: ColorSpaceConfiguration
      system?: SystemConfigurationLocal
    }
    const data = new Data({
      base: {
        ...body!.base,
        preset: { ...body!.base!.preset!, id: body!.base!.preset?.id ?? uid(11) },
        colors: (body!.base!.colors ?? []).map(fillColorDefaults),
      } as BaseConfiguration,
      themes: (body!.themes ?? []).map((t) => fillThemeDefaults(t, body!.base!.preset!)),
    }).makePaletteData()

    let systemData: unknown
    if (body.system) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utilsModule = (await import('@a_ng_d/utils-ui-color-palette')) as any
      const SystemClass = utilsModule.System
      if (typeof SystemClass !== 'function')
        return new Response(
          JSON.stringify({ message: 'System class unavailable. Requires @a_ng_d/utils-ui-color-palette >= 1.10.0' }) as BodyInit,
          { status: 501, headers: jsonHeaders },
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

    return new Response(JSON.stringify(result) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}
