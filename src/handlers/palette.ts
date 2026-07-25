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
} from '@yelbolt/engine-ui-color-palette'
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
    const utilsModule = (await import('@yelbolt/engine-ui-color-palette')) as any
    const SystemClass = utilsModule.System
    if (typeof SystemClass !== 'function') {
      return new Response(
        JSON.stringify({ message: 'System class unavailable. Requires @yelbolt/engine-ui-color-palette >= 1.10.0' }) as BodyInit,
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
      const utilsModule = (await import('@yelbolt/engine-ui-color-palette')) as any
      const SystemClass = utilsModule.System
      if (typeof SystemClass !== 'function')
        return new Response(
          JSON.stringify({ message: 'System class unavailable. Requires @yelbolt/engine-ui-color-palette >= 1.10.0' }) as BodyInit,
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

// ─── Preview ──────────────────────────────────────────────────────────────────

type PreviewCell = {
  theme: string
  color: string
  shade: string
  hex: string
}

const escapeXml = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const hexToTextColor = (hex: string): string => {
  if (!HEX_RE.test(hex)) return '#000000'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return L > 0.179 ? '#000000' : '#ffffff'
}

const buildPreviewSVG = (cells: PreviewCell[]): string => {
  const PADDING = 16
  const COLOR_LABEL_W = 88
  const SWATCH_W = 52
  const SWATCH_H = 64
  const THEME_HEADER_H = 28
  const THEME_GAP = 16
  const FONT = 'system-ui,-apple-system,sans-serif'

  // Group: theme → color → shades[]
  const themes = new Map<string, Map<string, Array<{ shade: string; hex: string }>>>()
  for (const cell of cells) {
    if (!themes.has(cell.theme)) themes.set(cell.theme, new Map())
    const colors = themes.get(cell.theme)!
    if (!colors.has(cell.color)) colors.set(cell.color, [])
    colors.get(cell.color)!.push({ shade: cell.shade, hex: cell.hex })
  }

  // Max number of shades across all colors
  const numShades = Math.max(...[...themes.values()].flatMap((colors) => [...colors.values()].map((s) => s.length)), 1)
  const totalWidth = PADDING + COLOR_LABEL_W + numShades * SWATCH_W + PADDING

  // Compute total height
  let totalHeight = PADDING
  let themeIdx = 0
  for (const colors of themes.values()) {
    totalHeight += THEME_HEADER_H + colors.size * SWATCH_H
    if (themeIdx < themes.size - 1) totalHeight += THEME_GAP
    themeIdx++
  }
  totalHeight += PADDING

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
  )
  parts.push(`<rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>`)

  let y = PADDING
  themeIdx = 0

  for (const [themeName, colors] of themes) {
    // Theme name header
    parts.push(
      `<text x="${PADDING}" y="${y + 18}" font-family="${FONT}" font-size="12" font-weight="600" fill="#111111">${escapeXml(themeName)}</text>`,
    )
    y += THEME_HEADER_H

    for (const [colorName, shades] of colors) {
      // Color label vertically centered in the row
      parts.push(
        `<text x="${PADDING}" y="${y + SWATCH_H / 2 + 4}" font-family="${FONT}" font-size="10" font-weight="500" fill="#555555">${escapeXml(colorName)}</text>`,
      )

      let x = PADDING + COLOR_LABEL_W
      for (const { shade, hex } of shades) {
        const safeHex = HEX_RE.test(hex) ? hex : '#cccccc'
        const textFill = hexToTextColor(safeHex)

        parts.push(`<rect x="${x}" y="${y}" width="${SWATCH_W}" height="${SWATCH_H}" fill="${safeHex}"/>`)
        parts.push(
          `<text x="${x + SWATCH_W / 2}" y="${y + SWATCH_H - 18}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="${textFill}">${escapeXml(shade)}</text>`,
        )
        parts.push(
          `<text x="${x + SWATCH_W / 2}" y="${y + SWATCH_H - 6}" text-anchor="middle" font-family="${FONT}" font-size="8" fill="${textFill}" opacity="0.7">${escapeXml(safeHex.toUpperCase())}</text>`,
        )
        x += SWATCH_W
      }
      y += SWATCH_H
    }

    if (themeIdx < themes.size - 1) y += THEME_GAP
    themeIdx++
  }

  parts.push('</svg>')
  return parts.join('')
}

// Compact format: `<theme>~<color>~<shade>:<hex6>,<shade>:<hex6>;...|-theme2~...`
// Separators: `|` = themes, `;` = colors, `~` = name/shades, `,` = shades, `:` = shade/hex
const parseCompactData = (raw: string): PreviewCell[] => {
  const cells: PreviewCell[] = []
  for (const themeChunk of raw.split('|')) {
    const tildeIdx = themeChunk.indexOf('~')
    if (tildeIdx < 0) continue
    const theme = decodeURIComponent(themeChunk.slice(0, tildeIdx))
    const rest = themeChunk.slice(tildeIdx + 1)
    for (const colorChunk of rest.split(';')) {
      const tIdx = colorChunk.indexOf('~')
      if (tIdx < 0) continue
      const color = decodeURIComponent(colorChunk.slice(0, tIdx))
      for (const shadeChunk of colorChunk.slice(tIdx + 1).split(',')) {
        const [shade, hex6] = shadeChunk.split(':')
        if (!shade || !hex6) continue
        cells.push({ theme, color, shade: decodeURIComponent(shade), hex: `#${hex6}` })
      }
    }
  }
  return cells
}

export const handlePreviewPalette = ({ request, corsHeaders }: HandlerContext): Response => {
  const url = new URL(request.url)
  const dataParam = url.searchParams.get('data')

  if (!dataParam) {
    return new Response('Missing "data" query parameter', { status: 400, headers: corsHeaders })
  }

  let cells: PreviewCell[]
  try {
    cells = parseCompactData(dataParam)
    if (cells.length === 0) throw new Error('No valid cells')
  } catch {
    return new Response('Invalid "data" parameter', { status: 400, headers: corsHeaders })
  }

  const svg = buildPreviewSVG(cells)

  return new Response(svg, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
