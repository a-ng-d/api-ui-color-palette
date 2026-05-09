import { ColorConfiguration, ThemeConfiguration, PaletteData } from '@a_ng_d/utils-ui-color-palette'
import { uid } from 'uid'

export const toCompactPaletteData = (data: PaletteData): Array<Record<string, unknown>> =>
  data.themes.flatMap((theme) =>
    theme.colors.flatMap((color) =>
      color.shades.map((shade) => ({
        themeId: theme.id,
        theme: theme.name,
        colorId: color.id,
        color: color.name,
        shade: shade.name,
        hex: shade.hex,
        ...(shade.alpha !== undefined && { alpha: shade.alpha }),
        contrast: shade.contrast,
        textContrast: shade.textContrast,
        isClosestToRef: shade.isClosestToRef,
        isSourceColorLocked: shade.isSourceColorLocked,
        isTransparent: shade.isTransparent,
        type: shade.type,
      })),
    ),
  )

export const fillColorDefaults = (c: Partial<ColorConfiguration> & { id?: string }): ColorConfiguration =>
  ({
    description: '',
    hue: { shift: 0, isLocked: false },
    chroma: { shift: 0, isLocked: false },
    alpha: { isEnabled: false, backgroundColor: '#FFFFFF' },
    ...c,
    id: c.id ?? uid(11),
  }) as ColorConfiguration

export const fillThemeDefaults = (
  t: Partial<ThemeConfiguration>,
  preset: { stops: Array<number>; min: number; max: number },
): ThemeConfiguration => {
  const scale: Record<string, number> =
    t.scale ??
    (() => {
      const { stops, min, max } = preset
      const n = stops.length - 1
      return Object.fromEntries(stops.map((stop, i) => [String(stop), parseFloat((max - ((max - min) * i) / n).toFixed(1))]))
    })()
  return {
    description: '',
    visionSimulationMode: 'NONE',
    textColorsTheme: { lightColor: '#FFFFFF', darkColor: '#000000' },
    paletteBackground: '#FFFFFF',
    isEnabled: true,
    type: 'default theme',
    ...t,
    id: t.id ?? uid(11),
    scale,
  } as ThemeConfiguration
}
