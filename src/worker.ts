import type { Env, HandlerContext } from './types'
import { handleGetColorSystem, handleGetPalette, handleCreateColorHarmony, handleExtractDominantColors, handleGenerateCode } from './handlers/palette'
import {
  handleListPublishedPalettes,
  handleListMyPublishedPalettes,
  handlePublishPalette,
  handleGetPublishedPalette,
  handleSharePublishedPalette,
  handleUnpublishPalette,
  handleUnsharePublishedPalette,
  handleUpdatePublishedPalette,
} from './handlers/community'
import { handleAuthenticate } from './handlers/auth'
import { handleGenerateColorsFromPrompts } from './handlers/ai'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rawPathname = new URL(request.url).pathname
    const endpoint = rawPathname.replace(/^\/v1(?=\/|$)/, '')

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
    const hctx: HandlerContext = { request, env, ctx, corsHeaders, jsonHeaders }

    const staticRoutes: Record<string, (ctx: HandlerContext) => Promise<Response>> = {
      '/get-color-system': handleGetColorSystem,
      '/get-palette': handleGetPalette,
      '/create-color-harmony': handleCreateColorHarmony,
      '/extract-dominant-colors': handleExtractDominantColors,
      '/generate-code': handleGenerateCode,
      '/generate-colors-from-prompts': handleGenerateColorsFromPrompts,
      '/authenticate': handleAuthenticate,
      '/list-published-palettes': handleListPublishedPalettes,
      '/list-my-published-palettes': handleListMyPublishedPalettes,
      '/publish-palette': handlePublishPalette,
    }

    if (endpoint && staticRoutes[endpoint]) {
      return staticRoutes[endpoint](hctx)
    }

    const getMatch = endpoint.match(/^\/get-published-palette\/(.+)$/)
    if (getMatch) return handleGetPublishedPalette(hctx, getMatch[1])

    const shareMatch = endpoint.match(/^\/share-published-palette\/(.+)$/)
    if (shareMatch) return handleSharePublishedPalette(hctx, shareMatch[1])

    const unpublishMatch = endpoint.match(/^\/unpublish-palette\/(.+)$/)
    if (unpublishMatch) return handleUnpublishPalette(hctx, unpublishMatch[1])

    const unshareMatch = endpoint.match(/^\/unshare-published-palette\/(.+)$/)
    if (unshareMatch) return handleUnsharePublishedPalette(hctx, unshareMatch[1])

    const updateMatch = endpoint.match(/^\/update-published-palette\/(.+)$/)
    if (updateMatch) return handleUpdatePublishedPalette(hctx, updateMatch[1])

    return new Response('Invalid action type', { status: 400 })
  },
}

