import {
  ColorSpaceConfiguration,
  AlgorithmVersionConfiguration,
  VisionSimulationModeConfiguration,
  EasingConfiguration,
} from '@yelbolt/engine-ui-color-palette'

// ─── Allowed Fields ───────────────────────────────────────────────────────────

export const COLOR_SPACES: readonly ColorSpaceConfiguration[] = [
  'LCH',
  'OKLCH',
  'LAB',
  'OKLAB',
  'HSL',
  'HSLUV',
  'HSV',
  'CMYK',
  'RGB',
  'HEX',
  'P3',
]
export const ALGORITHM_VERSIONS: readonly AlgorithmVersionConfiguration[] = ['v1', 'v2', 'v3']
export const EASING_VALUES: readonly EasingConfiguration[] = [
  'NONE',
  'LINEAR',
  'EASEIN_SINE',
  'EASEOUT_SINE',
  'EASEINOUT_SINE',
  'EASEIN_QUAD',
  'EASEOUT_QUAD',
  'EASEINOUT_QUAD',
  'EASEIN_CUBIC',
  'EASEOUT_CUBIC',
  'EASEINOUT_CUBIC',
]
export const VISION_MODES: readonly VisionSimulationModeConfiguration[] = [
  'NONE',
  'PROTANOMALY',
  'PROTANOPIA',
  'DEUTERANOMALY',
  'DEUTERANOPIA',
  'TRITANOMALY',
  'TRITANOPIA',
  'ACHROMATOMALY',
  'ACHROMATOPSIA',
]
export const PUBLISH_ALLOWED_FIELDS = [
  'name',
  'description',
  'preset',
  'shift',
  'are_source_colors_locked',
  'colors',
  'themes',
  'color_space',
  'algorithm_version',
  'is_shared',
] as const

// ─── Result Type ──────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true } | { ok: false; field: string; message: string }

// ─── Primitive Guards ─────────────────────────────────────────────────────────

export const isStr = (v: unknown): v is string => typeof v === 'string'
export const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isArr = (v: unknown): v is unknown[] => Array.isArray(v)
export const isHex = (v: unknown): v is string => isStr(v) && /^#[0-9a-fA-F]{3,8}$/.test(v)
export const isEnum = <T extends string>(v: unknown, values: readonly T[]): v is T => isStr(v) && (values as readonly string[]).includes(v)

// ─── Sub-validators ───────────────────────────────────────────────────────────

export const vPreset = (p: unknown, f: string): ValidationResult => {
  if (!isObj(p)) return { ok: false, field: f, message: 'must be an object' }
  if (!isStr(p.id) || !p.id) return { ok: false, field: `${f}.id`, message: 'must be a non-empty string' }
  if (!isStr(p.name) || !p.name) return { ok: false, field: `${f}.name`, message: 'must be a non-empty string' }
  if (!isArr(p.stops) || p.stops.length === 0 || !p.stops.every((s) => isNum(s) && Number.isInteger(s) && (s as number) >= 0))
    return { ok: false, field: `${f}.stops`, message: 'must be a non-empty array of non-negative integers' }
  if (!isNum(p.min) || p.min < 0 || p.min > 100) return { ok: false, field: `${f}.min`, message: 'must be a number 0–100' }
  if (!isNum(p.max) || p.max < 0 || p.max > 100) return { ok: false, field: `${f}.max`, message: 'must be a number 0–100' }
  if (!isEnum(p.easing, EASING_VALUES)) return { ok: false, field: `${f}.easing`, message: `must be one of: ${EASING_VALUES.join(', ')}` }
  return { ok: true }
}

export const vShift = (s: unknown, f: string): ValidationResult => {
  if (!isObj(s)) return { ok: false, field: f, message: 'must be an object' }
  if (!isNum(s.chroma)) return { ok: false, field: `${f}.chroma`, message: 'must be a number' }
  if (!isNum(s.hue)) return { ok: false, field: `${f}.hue`, message: 'must be a number' }
  return { ok: true }
}

export const vColor = (c: unknown, f: string): ValidationResult => {
  if (!isObj(c)) return { ok: false, field: f, message: 'must be an object' }
  if (!isStr(c.name) || !c.name) return { ok: false, field: `${f}.name`, message: 'must be a non-empty string' }
  if (!isObj(c.rgb)) return { ok: false, field: `${f}.rgb`, message: 'must be an object {r, g, b}' }
  const { r, g, b } = c.rgb as Record<string, unknown>
  for (const [k, v] of [
    ['r', r],
    ['g', g],
    ['b', b],
  ] as [string, unknown][]) {
    if (!isNum(v) || (v as number) < 0 || (v as number) > 1)
      return { ok: false, field: `${f}.rgb.${k}`, message: 'must be a number between 0 and 1' }
  }
  const hue = c.hue as Record<string, unknown>
  if (!isObj(c.hue) || !isNum(hue.shift) || !isBool(hue.isLocked))
    return { ok: false, field: `${f}.hue`, message: 'must be {shift: number, isLocked: boolean}' }
  const chroma = c.chroma as Record<string, unknown>
  if (!isObj(c.chroma) || !isNum(chroma.shift) || !isBool(chroma.isLocked))
    return { ok: false, field: `${f}.chroma`, message: 'must be {shift: number, isLocked: boolean}' }
  const alpha = c.alpha as Record<string, unknown>
  if (!isObj(c.alpha) || !isBool(alpha.isEnabled) || !isHex(alpha.backgroundColor))
    return { ok: false, field: `${f}.alpha`, message: 'must be {isEnabled: boolean, backgroundColor: hex string}' }
  return { ok: true }
}

export const vTheme = (t: unknown, f: string): ValidationResult => {
  if (!isObj(t)) return { ok: false, field: f, message: 'must be an object' }
  if (!isStr(t.name) || !t.name) return { ok: false, field: `${f}.name`, message: 'must be a non-empty string' }
  if (
    t.scale !== undefined &&
    (!isObj(t.scale) || !Object.values(t.scale).every((v) => isNum(v) && (v as number) >= 0 && (v as number) <= 100))
  )
    return { ok: false, field: `${f}.scale`, message: 'must be an object mapping string keys to numbers 0–100' }
  if (t.paletteBackground !== undefined && !isHex(t.paletteBackground))
    return { ok: false, field: `${f}.paletteBackground`, message: 'must be a valid hex color string' }
  if (t.textColorsTheme !== undefined) {
    const tct = t.textColorsTheme as Record<string, unknown>
    if (!isObj(tct) || !isHex(tct.lightColor) || !isHex(tct.darkColor))
      return { ok: false, field: `${f}.textColorsTheme`, message: 'must be {lightColor: hex, darkColor: hex}' }
  }
  if (t.visionSimulationMode !== undefined && !isEnum(t.visionSimulationMode, VISION_MODES))
    return { ok: false, field: `${f}.visionSimulationMode`, message: `must be one of: ${VISION_MODES.join(', ')}` }
  if (t.type !== undefined && t.type !== 'default theme' && t.type !== 'custom theme')
    return { ok: false, field: `${f}.type`, message: 'must be "default theme" or "custom theme"' }
  return { ok: true }
}

// ─── Body Validators ──────────────────────────────────────────────────────────

export const validatePublishBody = (body: unknown): ValidationResult => {
  if (!isObj(body)) return { ok: false, field: 'body', message: 'must be a JSON object' }
  if (!isStr(body.name) || !body.name) return { ok: false, field: 'name', message: 'must be a non-empty string' }
  if (body.description !== undefined && !isStr(body.description)) return { ok: false, field: 'description', message: 'must be a string' }
  if (body.are_source_colors_locked !== undefined && !isBool(body.are_source_colors_locked))
    return { ok: false, field: 'are_source_colors_locked', message: 'must be a boolean' }
  if (body.is_shared !== undefined && !isBool(body.is_shared)) return { ok: false, field: 'is_shared', message: 'must be a boolean' }
  const p = vPreset(body.preset, 'preset')
  if (!p.ok) return p
  const s = vShift(body.shift, 'shift')
  if (!s.ok) return s
  if (!isArr(body.colors) || body.colors.length === 0) return { ok: false, field: 'colors', message: 'must be a non-empty array' }
  for (let i = 0; i < body.colors.length; i++) {
    const r = vColor(body.colors[i], `colors[${i}]`)
    if (!r.ok) return r
  }
  if (!isArr(body.themes) || body.themes.length === 0) return { ok: false, field: 'themes', message: 'must be a non-empty array' }
  for (let i = 0; i < body.themes.length; i++) {
    const r = vTheme(body.themes[i], `themes[${i}]`)
    if (!r.ok) return r
  }
  if (!isEnum(body.color_space, COLOR_SPACES))
    return { ok: false, field: 'color_space', message: `must be one of: ${COLOR_SPACES.join(', ')}` }
  if (!isEnum(body.algorithm_version, ALGORITHM_VERSIONS))
    return { ok: false, field: 'algorithm_version', message: `must be one of: ${ALGORITHM_VERSIONS.join(', ')}` }
  return { ok: true }
}

export const validateUpdateBody = (body: unknown): ValidationResult => {
  if (!isObj(body)) return { ok: false, field: 'body', message: 'must be a JSON object' }
  if (body.name !== undefined && (!isStr(body.name) || !body.name))
    return { ok: false, field: 'name', message: 'must be a non-empty string' }
  if (body.description !== undefined && !isStr(body.description)) return { ok: false, field: 'description', message: 'must be a string' }
  if (body.are_source_colors_locked !== undefined && !isBool(body.are_source_colors_locked))
    return { ok: false, field: 'are_source_colors_locked', message: 'must be a boolean' }
  if (body.is_shared !== undefined && !isBool(body.is_shared)) return { ok: false, field: 'is_shared', message: 'must be a boolean' }
  if (body.preset !== undefined) {
    const r = vPreset(body.preset, 'preset')
    if (!r.ok) return r
  }
  if (body.shift !== undefined) {
    const r = vShift(body.shift, 'shift')
    if (!r.ok) return r
  }
  if (body.colors !== undefined) {
    if (!isArr(body.colors) || body.colors.length === 0) return { ok: false, field: 'colors', message: 'must be a non-empty array' }
    for (let i = 0; i < body.colors.length; i++) {
      const r = vColor(body.colors[i], `colors[${i}]`)
      if (!r.ok) return r
    }
  }
  if (body.themes !== undefined) {
    if (!isArr(body.themes) || body.themes.length === 0) return { ok: false, field: 'themes', message: 'must be a non-empty array' }
    for (let i = 0; i < body.themes.length; i++) {
      const r = vTheme(body.themes[i], `themes[${i}]`)
      if (!r.ok) return r
    }
  }
  if (body.color_space !== undefined && !isEnum(body.color_space, COLOR_SPACES))
    return { ok: false, field: 'color_space', message: `must be one of: ${COLOR_SPACES.join(', ')}` }
  if (body.algorithm_version !== undefined && !isEnum(body.algorithm_version, ALGORITHM_VERSIONS))
    return { ok: false, field: 'algorithm_version', message: `must be one of: ${ALGORITHM_VERSIONS.join(', ')}` }
  return { ok: true }
}
