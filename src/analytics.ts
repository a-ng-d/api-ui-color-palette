import type { Env } from './types'

// ─── Event Map ────────────────────────────────────────────────────────────────

type EventConfig = {
  name: string
  props?: Record<string, unknown>
}

const ENDPOINT_EVENTS: Record<string, EventConfig> = {
  '/get-palette': { name: 'Action Triggered', props: { Feature: 'CREATE_PALETTE' } },
  '/get-color-system': { name: 'Action Triggered', props: { Feature: 'CREATE_COLOR_SYSTEM' } },
  '/create-color-harmony': { name: 'Colors Imported', props: { Feature: 'CREATE_COLOR_HARMONY' } },
  '/extract-dominant-colors': { name: 'Colors Imported', props: { Feature: 'EXTRACT_DOMINANT_COLORS' } },
  '/generate-code': { name: 'Color Shades Exported' },
  '/generate-colors-from-prompts': { name: 'Colors Imported', props: { Feature: 'GENERATE_AI_COLORS' } },
  '/publish-palette': { name: 'Palette Managed', props: { Feature: 'PUBLISH_PALETTE' } },
  '/get-published-palette': { name: 'Palette Managed', props: { Feature: 'SEE_PALETTE' } },
  '/share-published-palette': { name: 'Palette Managed', props: { Feature: 'SHARE_PALETTE' } },
  '/unpublish-palette': { name: 'Palette Managed', props: { Feature: 'UNPUBLISH_PALETTE' } },
  '/unshare-published-palette': { name: 'Palette Managed', props: { Feature: 'SHARE_PALETTE' } },
  '/update-published-palette': { name: 'Palette Managed', props: { Feature: 'PUSH_PALETTE' } },
}

export const FORMAT_FEATURE_MAP: Record<string, string> = {
  css: 'STYLESHEET_CSS',
  scss: 'STYLESHEET_SCSS',
  less: 'STYLESHEET_LESS',
  'tailwind-v3': 'TAILWIND_V3',
  'tailwind-v4': 'TAILWIND_V4',
  'swift-ui': 'APPLE_SWIFTUI',
  'ui-kit': 'APPLE_UIKIT',
  compose: 'ANDROID_COMPOSE',
  resources: 'ANDROID_XML',
  csv: 'CSV',
  'native-tokens': 'TOKENS_NATIVE',
  'dtcg-tokens': 'TOKENS_DTCG',
  'style-dictionary-v3': 'TOKENS_STYLE_DICTIONARY_V3',
  'universal-json': 'TOKENS_UNIVERSAL',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getEnvironment = (request: Request): 'production' | 'development' =>
  request.headers.get('CF-Ray') !== null ? 'production' : 'development'

const getAuthenticatedUserId = (request: Request): string | null => {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const base64Payload = authHeader.slice(7).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(base64Payload)) as Record<string, unknown>
      if (typeof payload.sub === 'string' && payload.sub !== '') return payload.sub
    } catch {
      // ignore malformed JWT — fall through
    }
  }
  return null
}

// ─── Tracker ──────────────────────────────────────────────────────────────────

export const trackApiEvent = (
  ctx: ExecutionContext,
  env: Env,
  request: Request,
  endpoint: string,
  extraProps?: Record<string, unknown>,
): void => {
  if (!env.MIXPANEL_TOKEN) return

  const config = ENDPOINT_EVENTS[endpoint]
  if (!config) return

  const userId = getAuthenticatedUserId(request)

  const payload = [
    {
      event: config.name,
      properties: {
        token: env.MIXPANEL_TOKEN,
        ...(userId ? { distinct_id: userId } : {}),
        Editor: 'REST API',
        Env: getEnvironment(request),
        $insert_id: crypto.randomUUID(),
        time: Date.now(),
        ...(config.props ?? {}),
        ...(extraProps ?? {}),
      },
    },
  ]

  ctx.waitUntil(
    fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
      body: JSON.stringify(payload),
    }).catch(() => undefined),
  )
}
