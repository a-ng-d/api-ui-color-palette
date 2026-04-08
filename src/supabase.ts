import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const createSupabaseClient = (url: string, anonKey: string): SupabaseClient => {
  return createClient(url, anonKey)
}

export const createSupabaseClientWithToken = (url: string, anonKey: string, accessToken: string): SupabaseClient => {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export const extractBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export const verifyToken = async (url: string, anonKey: string, token: string) => {
  const supabase = createSupabaseClient(url, anonKey)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Invalid or expired token')
  return data.user
}
