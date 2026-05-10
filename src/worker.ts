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
import { trackApiEvent, FORMAT_FEATURE_MAP } from './analytics'

async function peekJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.clone().json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

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
      '/generate-colors-from-prompts': handleGenerateColorsFromPrompts,
      '/authenticate': handleAuthenticate,
      '/list-published-palettes': handleListPublishedPalettes,
      '/list-my-published-palettes': handleListMyPublishedPalettes,
    }

    if (endpoint && staticRoutes[endpoint]) {
      const response = await staticRoutes[endpoint](hctx)
      trackApiEvent(ctx, env, request, endpoint)
      return response
    }

    if (endpoint === '/generate-code') {
      const body = await peekJsonBody(request)
      const format = typeof body.format === 'string' ? body.format : 'css'
      const colorSpace = typeof body.colorSpace === 'string' ? body.colorSpace : undefined
      const feature = FORMAT_FEATURE_MAP[format]
      const response = await handleGenerateCode(hctx)
      trackApiEvent(ctx, env, request, '/generate-code', {
        ...(feature ? { Feature: feature } : {}),
        ...(colorSpace ? { 'Color Space': colorSpace } : {}),
      })
      return response
    }

    if (endpoint === '/publish-palette') {
      const body = await peekJsonBody(request)
      const type = body.is_shared === true ? 'COMMUNITY' : 'SELF'
      const response = await handlePublishPalette(hctx)
      trackApiEvent(ctx, env, request, '/publish-palette', { Type: type })
      return response
    }

    const getMatch = endpoint.match(/^\/get-published-palette\/(.+)$/)
    if (getMatch) {
      const response = await handleGetPublishedPalette(hctx, getMatch[1])
      trackApiEvent(ctx, env, request, '/get-published-palette')
      return response
    }

    const shareMatch = endpoint.match(/^\/share-published-palette\/(.+)$/)
    if (shareMatch) {
      const response = await handleSharePublishedPalette(hctx, shareMatch[1])
      trackApiEvent(ctx, env, request, '/share-published-palette')
      return response
    }

    const unpublishMatch = endpoint.match(/^\/unpublish-palette\/(.+)$/)
    if (unpublishMatch) {
      const response = await handleUnpublishPalette(hctx, unpublishMatch[1])
      trackApiEvent(ctx, env, request, '/unpublish-palette')
      return response
    }

    const unshareMatch = endpoint.match(/^\/unshare-published-palette\/(.+)$/)
    if (unshareMatch) {
      const response = await handleUnsharePublishedPalette(hctx, unshareMatch[1])
      trackApiEvent(ctx, env, request, '/unshare-published-palette')
      return response
    }

    const updateMatch = endpoint.match(/^\/update-published-palette\/(.+)$/)
    if (updateMatch) {
      const body = await peekJsonBody(request)
      const type = body.is_shared === true ? 'COMMUNITY' : body.is_shared === false ? 'SELF' : undefined
      const response = await handleUpdatePublishedPalette(hctx, updateMatch[1])
      trackApiEvent(ctx, env, request, '/update-published-palette', { ...(type ? { Type: type } : {}) })
      return response
    }

    return new Response('Invalid action type', { status: 400 })
  },
}

