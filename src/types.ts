export interface Env {
  MISTRAL_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_PALETTES_TABLE: string
  SUPABASE_PALETTES_VIEW: string
  AUTH_WORKER_URL: string
  AUTH_URL: string
}

export type HandlerContext = {
  request: Request
  env: Env
  ctx: ExecutionContext
  corsHeaders: Record<string, string>
  jsonHeaders: Record<string, string>
}
