import { generateColorsFromPrompt } from '../mistral'
import type { HandlerContext } from '../types'

export async function handleGenerateColorsFromPrompts({ request, env, corsHeaders, jsonHeaders }: HandlerContext): Promise<Response> {
  try {
    const body = (await request.json()) as { prompt: string }

    if (!body.prompt) {
      return new Response(JSON.stringify({ message: 'Missing "prompt" field' }) as BodyInit, {
        status: 400,
        headers: corsHeaders,
      })
    }

    const palette = await generateColorsFromPrompt(env.MISTRAL_API_KEY, body.prompt)
    return new Response(JSON.stringify(palette) as BodyInit, { status: 200, headers: jsonHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ message: String(error) }) as BodyInit, { status: 500, headers: corsHeaders })
  }
}
