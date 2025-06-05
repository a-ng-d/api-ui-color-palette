![GitHub package.json version](https://img.shields.io/github/package-json/v/a-ng-d/utils-ui-color-palette?color=informational) ![GitHub last commit](https://img.shields.io/github/last-commit/a-ng-d/utils-ui-color-palette?color=informational) ![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/a-ng-d/utils-ui-color-palette/npm.yml?label=npm)
![GitHub](https://img.shields.io/github/license/a-ng-d/utils-ui-color-palette?color=informational)

# UI Color Palette Utils

Core utilities library for UI Color Palette - a color management plugin for design tools. This library provides the foundational color manipulation, contrast calculation, and palette generation features used in the plugin.

## Design Tools Compatibility

UI Color Palette is available for:

- Figma - Create and manage color primitives directly in your Figma designs
- FigJam - Collaborate on color decisions with your team
- Penpot - Open-source design tool alternative with full color management support

## Features

- **Color Contrast Tools**:

  - APCA contrast calculations
  - WCAG 2.1 compliance checking
  - Contrast ratio calculations between colors

- **Color Manipulation**:

  - Color space conversions (RGB, HSL, HSLuv, LAB)
  - Color mixing and blending
  - Brightness and saturation adjustments

- **Palette Generation**:
  - Create harmonious color schemes
  - Generate accessible color combinations
  - Scale generation for design systems

## Installation

```bash
npm install @a_ng_d/utils-ui-color-palette
# or
yarn add @a_ng_d/utils-ui-color-palette
```

## Usage

```typescript
import { Color, Contrast, Data } from '@a_ng_d/utils-ui-color-palette'

// Use Color class for color manipulation
const color = new Color({
  sourceColor: [255, 0, 0], // RGB values
  lightness: 50,
  hueShifting: 0,
  chromaShifting: 100,
})

// Use Contrast class for accessibility checks
const contrast = new Contrast({
  backgroundColor: [255, 255, 255],
  textColor: '#000000',
})

// Use Data class for palette generation
const data = new Data({
  base: baseConfig,
  themes: themesConfig,
  meta: metaConfig,
})
```

## Examples

### Color Manipulation

```typescript
import { Color } from '@a_ng_d/utils-ui-color-palette'

// Create a color instance
const color = new Color({
  sourceColor: [255, 0, 0], // Red in RGB
  lightness: 50,
  chromaShifting: 100,
})

// Convert to different color spaces
const lchColor = color.lch() // Returns LCH color
const oklchColor = color.oklch() // Returns OKLCH color
const hslColor = color.hsl() // Returns HSL color
const labColor = color.lab() // Returns LAB color

// Mix colors
const mixedRgb = color.mixColorsRgb(
  [255, 0, 0, 0.5], // Semi-transparent red
  [0, 0, 255, 1] // Solid blue
)

const mixedHex = color.mixColorsHex('#FF0000', '#0000FF')
```

### Contrast Calculations

```typescript
import { Contrast } from '@a_ng_d/utils-ui-color-palette'

// Create a contrast checker instance
const contrast = new Contrast({
  backgroundColor: [255, 255, 255], // White background
  textColor: '#000000', // Black text
})

// Get contrast values
const wcagContrast = contrast.getWCAGContrast() // WCAG 2.1 contrast ratio
const apcaContrast = contrast.getAPCAContrast() // APCA contrast value
const wcagScore = contrast.getWCAGScore() // Returns: 'AAA', 'AA', or 'A'

// Get accessibility recommendations
const usage = contrast.getRecommendedUsage() // Returns usage recommendation
const minSizes = contrast.getMinFontSizes() // Returns minimum font sizes

// Find specific contrast values
const lightness = contrast.getLightnessForContrastRatio(4.5) // For WCAG AA
```

### Palette Generation

```typescript
import { Data } from '@a_ng_d/utils-ui-color-palette'

// Configure your palette
const config = {
  base: {
    name: 'My Palette',
    colors: [
      /* your colors */
    ],
    colorSpace: 'LAB',
    algorithmVersion: 'v3',
  },
  themes: [
    {
      id: 'light',
      name: 'Light Theme',
      scale: {
        /* lightness values */
      },
      visionSimulationMode: 'NONE',
    },
  ],
  meta: {
    /* metadata */
  },
}

// Create a data instance
const data = new Data(config)

// Generate palette data
const paletteData = data.makePaletteData()
const fullData = data.makePaletteFullData()
```

## Testing

```bash
npm test
# or
yarn test
```

## Code Coverage

Current test coverage results:

```
File          | % Stmts | % Branch | % Funcs | % Lines
--------------|---------|----------|---------|--------
All files     |   76.09 |    62.63 |   75.86 |   76.09
 color.ts     |   72.06 |    68.05 |   66.66 |   72.06
 contrast.ts  |   81.51 |    65.51 |     100 |   81.51
 data.ts      |   80.14 |     57.3 |     100 |   80.14
```

To run coverage tests:

```bash
npm run test:coverage
```

## Credits

This project relies on several excellent open source packages:

### Color Processing

- [chroma.js](https://gka.github.io/chroma.js/) - A powerful library for color manipulations and conversions
  - Author: Gregor Aisch
  - License: BSD-3-Clause

### Contrast Calculation

- [APCA-W3](https://github.com/Myndex/SAPC-APCA) - Advanced Perceptual Contrast Algorithm
  - Author: Andrew Somers
  - License: W3C Software and Document Notice and License

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
