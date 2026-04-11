import { describe, it, expect, vi } from 'vitest'
import { env as _env } from 'cloudflare:workers'

// @jsquash WASM packages don't run in Miniflare — mock them
const fakeImageData = { data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), width: 2, height: 1 }
vi.mock('@jsquash/jpeg/decode', () => ({ default: async () => fakeImageData }))
vi.mock('@jsquash/png/decode', () => ({ default: async () => fakeImageData }))

// @supabase/realtime-js uses net.Socket (Node.js) which isn't available in Miniflare
// Mock at the module level; the Supabase tests run against the deployed worker instead
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const mockRange = vi.fn().mockResolvedValue({ data: [], error: null })
const mockIlike = vi.fn(() => ({ range: mockRange }))
const mockOrder = vi.fn(() => ({ range: mockRange, order: vi.fn(() => ({ range: mockRange })), ilike: mockIlike }))
const mockEq = vi.fn(() => ({ eq: mockEq, order: mockOrder, single: mockSingle, select: vi.fn(() => ({ single: mockSingle })) }))
const mockSelect = vi.fn(() => ({ eq: mockEq, order: mockOrder, single: mockSingle }))
const mockQuery = { select: mockSelect, eq: mockEq, order: mockOrder, range: mockRange, ilike: mockIlike, single: mockSingle }
const mockFrom = vi.fn(() => mockQuery)
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id', email: 'test@test.com' } }, error: null })
const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { palette_id: 'new-id' }, error: null }) })),
}))
const mockUpdate = vi.fn(() => ({
  eq: vi.fn().mockReturnThis(),
  select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { palette_id: 'test-id', is_shared: true }, error: null }) })),
}))
const mockDelete = vi.fn(() => ({
  eq: vi.fn().mockReturnThis(),
  select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { palette_id: 'test-id' }, error: null }) })),
}))
const mockClient = { from: mockFrom, auth: { getUser: mockGetUser, signInWithPassword: vi.fn() } }

vi.mock('./supabase', () => ({
  createSupabaseClient: vi.fn(() => ({ ...mockClient, from: vi.fn(() => ({ ...mockQuery, data: [], error: null })) })),
  createSupabaseClientWithToken: vi.fn(() => ({
    ...mockClient,
    from: vi.fn(() => ({ ...mockQuery, insert: mockInsert, update: mockUpdate, delete: mockDelete })),
  })),
  extractBearerToken: vi.fn((req: Request) => req.headers.get('Authorization')?.slice(7) ?? null),
  verifyToken: vi.fn().mockResolvedValue({ id: 'test-user-id', email: 'test@test.com' }),
}))

import worker from './worker'

type Env = Parameters<typeof worker.fetch>[1]
const env = _env as unknown as Env

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext

function call(path: string, init?: RequestInit) {
  return worker.fetch(new Request(`http://localhost${path}`, init), env, ctx)
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

describe('CORS preflight', () => {
  it('OPTIONS returns 204 with CORS headers', async () => {
    const res = await call('/', { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// ─── Color harmony ────────────────────────────────────────────────────────────

describe('POST /create-color-harmony', () => {
  it('returns all 6 harmonies when type is omitted', async () => {
    const res = await call('/create-color-harmony', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseColor: [255, 0, 0] }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as unknown[]
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(6)
  })

  it('returns a single COMPLEMENTARY harmony', async () => {
    const res = await call('/create-color-harmony', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseColor: [0, 128, 255], type: 'COMPLEMENTARY' }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { type: string; colors: unknown[] }
    expect(data.type).toBe('COMPLEMENTARY')
    expect(data.colors).toHaveLength(2)
  })
})

// ─── Dominant colors ──────────────────────────────────────────────────────────

describe('POST /extract-dominant-colors', () => {
  it('returns dominant colors from a 2x2 pixel image', async () => {
    // 2×2 RGBA: red, green, blue, white
    const pixels = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]
    const res = await call('/extract-dominant-colors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: { data: pixels, width: 2, height: 2 }, colorCount: 3 }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as unknown[]
    expect(Array.isArray(data)).toBe(true)
  })
})

// ─── Supabase — public endpoints ──────────────────────────────────────────────

describe('GET /list-published-palettes', () => {
  it('returns 200 with an array', async () => {
    const res = await call('/list-published-palettes')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('respects the limit param', async () => {
    const res = await call('/list-published-palettes?page=1&limit=3')
    expect(res.status).toBe(200)
  })
})

describe('GET /get-published-palette/:id', () => {
  it('returns 404 when palette is not found', async () => {
    const res = await call('/get-published-palette/non-existent-id-000')
    // mock returns { data: null } → worker responds 404
    expect(res.status).toBe(404)
  })
})

// ─── Supabase — authenticated endpoints ───────────────────────────────────────

describe('GET /list-my-published-palettes', () => {
  it('returns 200 with an array when authenticated', async () => {
    const res = await call('/list-my-published-palettes', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('DELETE /unpublish-palette/:id', () => {
  it('returns 200 with the deleted palette', async () => {
    const res = await call('/unpublish-palette/test-id', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { palette_id: string }
    expect(data.palette_id).toBe('test-id')
  })
})

// ─── Auth guard ───────────────────────────────────────────────────────────────

describe('Protected endpoints return 401 without token', () => {
  const cases: { method: string; path: string }[] = [
    { method: 'GET', path: '/list-my-published-palettes' },
    { method: 'POST', path: '/publish-palette' },
    { method: 'PUT', path: '/share-published-palette/x' },
    { method: 'PUT', path: '/unshare-published-palette/x' },
    { method: 'PATCH', path: '/update-published-palette/x' },
    { method: 'DELETE', path: '/unpublish-palette/x' },
  ]

  for (const { method, path } of cases) {
    it(`${method} ${path} → 401`, async () => {
      const res = await call(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'DELETE' && method !== 'GET' && method !== 'PUT' ? JSON.stringify({}) : undefined,
      })
      expect(res.status).toBe(401)
    })
  }
})

// ─── Unknown route ────────────────────────────────────────────────────────────

describe('Unknown endpoint', () => {
  it('returns 400', async () => {
    const res = await call('/does-not-exist')
    expect(res.status).toBe(400)
  })
})
