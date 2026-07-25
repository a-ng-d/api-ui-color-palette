# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-25

### Added

- OpenAPI description rewritten as a full onboarding guide: "Getting started" section with the passkey/SSE authentication flow, an endpoint-group overview table, and the complete list of `generate-code` output formats
- CHANGELOG and README project badges

### Changed

- Production server URL updated to `https://api.ui-color-palette.com/v1` in the OpenAPI specification

## [1.0.0] - 2026-05-14

### Added

- Complete OpenAPI 3.x specification for all endpoints
- Public asset serving via Cloudflare Workers static assets

## [0.5.4] - 2026-05-14

### Changed

- `share_published_palette` and `unshare_published_palette` now set and clear the `published_at` timestamp on palette records

## [0.5.3] - 2026-05-10

### Added

- `/v1/preview` endpoint — generates an SVG image from compact palette data

## [0.5.2] - 2026-05-10

### Changed

- Updated Wrangler to 4.86.0

## [0.5.1] - 2026-05-10

### Added

- Mixpanel integration for API event tracking per endpoint call

### Changed

- Converted function declarations to arrow functions for consistency

## [0.5.0] - 2026-05-10

No substantive changes — version bump only.

## [0.4.6] - 2026-05-10

### Added

- `toCompactPaletteData` transform — converts full palette output into a flat array of shade rows
- Validation functions and types for publish and update request bodies
- Palette and theme helper utilities; updated worker route registrations

## [0.4.5] - 2026-05-09

### Added

- `fillColorDefaults` and `fillThemeDefaults` — missing optional fields in request bodies are filled with sensible defaults

## [0.4.4] - 2026-05-08

### Added

- Palette generation endpoints now accept an optional `system` configuration (`schema` + `bindings`) and return library data alongside palette shades

### Changed

- Updated `@a_ng_d/utils-ui-color-palette` to 1.10.1

## [0.4.3] - 2026-04-28

### Changed

- README updated to document versioned endpoint paths (`/v1/...`) and clarify endpoint descriptions

## [0.4.2] - 2026-04-24

### Fixed

- Request bodies now support partial configurations — missing fields are filled with defaults
- Preset, color, and theme entries without an `id` are assigned unique IDs automatically

## [0.4.1] - 2026-04-23

### Changed

- Documented `/v1/generate-code` input structure in README

## [0.4.0] - 2026-04-19

### Added

- Supabase environment variables wired into `wrangler.toml`
- Cloudflare Workers observability logs enabled

### Changed

- Updated `@a_ng_d/utils-ui-color-palette` to 1.9.0

## [0.3.1] - 2026-04-18

### Fixed

- Corrected project name in `wrangler.toml` to match API naming convention

## [0.3.0] - 2026-04-12

### Added

- Passkey authentication flow with Server-Sent Events (SSE) support
- Full palette CRUD via Supabase: create, read, update, delete operations for published palettes
- `uid` for deterministic palette ID generation
- URL fetching and WASM PNG decoding for dominant color extraction
- Vitest test suite with Supabase mocks for authenticated endpoints

## [0.2.0] - 2026-04-09

### Added

- Supabase integration for user authentication and palette data persistence

## [0.1.0] - 2026-04-09

### Added

- `/v1/generate-colors-from-prompts` — AI color generation from a natural language prompt using Mistral
- `/v1/create-color-harmony` — generates complementary, analogous, triadic, tetradic, compound, and square harmonies from an RGB base color
- `/v1/extract-dominant-colors` — extracts dominant colors from an image using k-means clustering with WASM PNG decoding
- TypeScript types and `tsconfig.json`

## [0.0.2] - 2025-06-05

### Added

- Initial release: Cloudflare Workers, TypeScript, Wrangler, Prettier
- `/v1/get-palette` — generates a complete color palette from base configuration and themes
- `/v1/generate-code` — exports palette tokens in multiple formats
- `/v1/get-color-system` — builds a semantic color system from taxonomy bindings
- `/v1/get-published-palette` and `/v1/list-published-palettes` — community read endpoints

[1.0.1]: https://github.com/a-ng-d/api-ui-color-palette/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.5.4...v1.0.0
[0.5.4]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.6...v0.5.0
[0.4.6]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/a-ng-d/api-ui-color-palette/compare/v0.0.2...v0.1.0
[0.0.2]: https://github.com/a-ng-d/api-ui-color-palette/releases/tag/v0.0.2
