import {
  ColorConfiguration,
  PresetConfiguration,
  ShiftConfiguration,
  ColorSpaceConfiguration,
  AlgorithmVersionConfiguration,
  ThemeConfiguration,
} from '@yelbolt/engine-ui-color-palette'
import { uid } from 'uid'
import { createSupabaseClient, createSupabaseClientWithToken, extractBearerToken, verifyToken } from '../supabase'
import { PUBLISH_ALLOWED_FIELDS, validatePublishBody, validateUpdateBody } from '../validation'
import type { HandlerContext } from '../types'

export const handleListPublishedPalettes = async ({ request, env, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
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

    return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleListMyPublishedPalettes = async ({ request, env, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
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

    return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handlePublishPalette = async ({ request, env, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> => {
  try {
    const token = extractBearerToken(request)
    if (!token) {
      return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
        status: 401,
        headers: corsHeaders,
      })
    }

    const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
    const rawBody = await request.json()

    const validation = validatePublishBody(rawBody)
    if (!validation.ok) {
      return new Response(JSON.stringify({ message: `Invalid field "${validation.field}": ${validation.message}` }) as BodyInit, {
        status: 400,
        headers: corsHeaders,
      })
    }

    const body = Object.fromEntries(
      Object.entries(rawBody as Record<string, unknown>).filter(([k]) =>
        PUBLISH_ALLOWED_FIELDS.includes(k as (typeof PUBLISH_ALLOWED_FIELDS)[number]),
      ),
    ) as {
      name: string
      description?: string
      preset: PresetConfiguration
      shift: ShiftConfiguration
      are_source_colors_locked?: boolean
      colors: Array<ColorConfiguration>
      themes: Array<ThemeConfiguration>
      color_space: ColorSpaceConfiguration
      algorithm_version: AlgorithmVersionConfiguration
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
      return new Response(JSON.stringify({ message: error.message }) as BodyInit, { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify(data) as BodyInit, { status: 201, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleGetPublishedPalette = async (
  { env, corsHeaders, jsonHeaders }: HandlerContext,
  paletteId: string,
): Promise<Response> => {
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
      return new Response(JSON.stringify({ message: 'Palette not found' }) as BodyInit, { status: 404, headers: corsHeaders })
    }

    return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleSharePublishedPalette = async (
  { request, env, corsHeaders, jsonHeaders }: HandlerContext,
  paletteId: string,
): Promise<Response> => {
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
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from(env.SUPABASE_PALETTES_TABLE)
      .update({ is_shared: true, updated_at: now, published_at: now })
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

    return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleUnpublishPalette = async (
  { request, env, corsHeaders, jsonHeaders }: HandlerContext,
  paletteId: string,
): Promise<Response> => {
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
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleUnsharePublishedPalette = async (
  { request, env, corsHeaders, jsonHeaders }: HandlerContext,
  paletteId: string,
): Promise<Response> => {
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
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from(env.SUPABASE_PALETTES_TABLE)
      .update({ is_shared: false, updated_at: now, published_at: now })
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

    return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}

export const handleUpdatePublishedPalette = async (
  { request, env, corsHeaders, jsonHeaders }: HandlerContext,
  paletteId: string,
): Promise<Response> => {
  try {
    const token = extractBearerToken(request)
    if (!token) {
      return new Response(JSON.stringify({ message: 'Missing Authorization header' }) as BodyInit, {
        status: 401,
        headers: corsHeaders,
      })
    }

    const user = await verifyToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token)
    const rawBody = await request.json()

    const validation = validateUpdateBody(rawBody)
    if (!validation.ok) {
      return new Response(JSON.stringify({ message: `Invalid field "${validation.field}": ${validation.message}` }) as BodyInit, {
        status: 400,
        headers: corsHeaders,
      })
    }

    const body = Object.fromEntries(
      Object.entries(rawBody as Record<string, unknown>).filter(([k]) =>
        PUBLISH_ALLOWED_FIELDS.includes(k as (typeof PUBLISH_ALLOWED_FIELDS)[number]),
      ),
    )

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

    return new Response(JSON.stringify(data) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}
