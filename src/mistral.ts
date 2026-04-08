import { Mistral } from '@mistralai/mistralai'

export interface MistralColor {
  name: string
  hex: string
  rgb: { r: number; g: number; b: number }
  description?: string
}

export interface MistralColorPalette {
  primary: MistralColor
  text: MistralColor
  success: MistralColor
  warning: MistralColor
  alert: MistralColor
}

export async function generateColorsFromPrompt(apiKey: string, userPrompt: string): Promise<MistralColorPalette> {
  const mistral = new Mistral({ apiKey })

  const result = await mistral.agents.complete({
    agentId: 'ag_019a9254590972e1af106aecc7a13cfe',
    messages: [
      {
        role: 'user',
        content: `You are an expert in design and color theory. Generate a 5-color palette for "${userPrompt}".`,
      },
    ],
  })

  const content = result.choices[0]?.message?.content

  if (!content) throw new Error('No response received from Mistral AI agent')

  const rawText = typeof content === 'string' ? content : content.map((chunk) => ('text' in chunk ? chunk.text : '')).join('')

  const jsonMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  const cleanedContent = jsonMatch?.[1]?.trim() ?? rawText.trim()

  let palette: MistralColorPalette

  try {
    palette = JSON.parse(cleanedContent)
  } catch {
    throw new Error('Malformed response from Mistral AI agent (invalid JSON)')
  }

  if (!palette.primary || !palette.text || !palette.success || !palette.warning || !palette.alert)
    throw new Error('Incomplete response from Mistral AI agent - missing colors')

  return palette
}
