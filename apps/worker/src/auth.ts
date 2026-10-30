import { createMiddleware } from 'hono/factory'

// ── 書き込み・課金系の窓口を守る認証 ──
//   1. X-Admin-API-Key … /lp-publish スキル等のスクリプト用。Workers Secret ADMIN_API_KEY と照合
//   2. Authorization: Bearer <Firebase ID トークン> … 管理画面（LP Studio）用。
//      Google の公開鍵で署名を確かめ、aud / iss / 期限を見たうえで UID を ALLOWED_UIDS で絞る。
//      Firebase Auth は誰でも新規登録できる設定のため、本物のトークンでも一覧に無い UID は通さない。
//   設定が欠けている時は通さない（503）。誤って認証なしで開かないため。

export type AuthBindings = {
  ADMIN_API_KEY?: string
  FIREBASE_PROJECT_ID?: string
  ALLOWED_UIDS?: string
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const CLOCK_SKEW_SEC = 60
// 知らない kid が来ても Google へ取りに行くのは最短この間隔まで（でたらめな kid での連打を防ぐ）
const JWKS_MIN_REFRESH_MS = 60_000
const JWKS_DEFAULT_TTL_MS = 60 * 60 * 1000

export class AuthUnavailableError extends Error {}

type JwksCache = { keys: Map<string, CryptoKey>; expiresAt: number; fetchedAt: number }
let jwksCache: JwksCache | null = null

export function resetJwksCacheForTest(): void {
  jwksCache = null
}

type Fetcher = (url: string) => Promise<Response>

async function loadJwks(nowMs: number, fetcher: Fetcher): Promise<JwksCache> {
  let res: Response
  try {
    res = await fetcher(JWKS_URL)
  } catch (e) {
    throw new AuthUnavailableError(`JWKS fetch failed: ${String(e)}`)
  }
  if (!res.ok) throw new AuthUnavailableError(`JWKS fetch failed: ${res.status}`)
  const body = await res.json() as { keys?: Array<JsonWebKey & { kid?: string }> }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    )
    keys.set(jwk.kid, key)
  }
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')
  const ttl = maxAge ? Number(maxAge[1]) * 1000 : JWKS_DEFAULT_TTL_MS
  return { keys, expiresAt: nowMs + ttl, fetchedAt: nowMs }
}

async function getSigningKey(kid: string, nowMs: number, fetcher: Fetcher): Promise<CryptoKey | null> {
  const stale = !jwksCache || jwksCache.expiresAt <= nowMs
  const unknownKid = !!jwksCache && !jwksCache.keys.has(kid) && nowMs - jwksCache.fetchedAt >= JWKS_MIN_REFRESH_MS
  if (stale || unknownKid) jwksCache = await loadJwks(nowMs, fetcher)
  return jwksCache?.keys.get(kid) ?? null
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJsonPart(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)))
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    // 壊れたトークン（base64url / JSON として読めない）は「無効」として扱う
    return null
  }
}

export type VerifiedUser = { uid: string }

// Firebase ID トークンを確かめる（https://firebase.google.com/docs/auth/admin/verify-id-tokens の手順）。
// 無効なら null。公開鍵が取れない時は AuthUnavailableError。
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  opts: { nowMs?: number; fetcher?: Fetcher } = {},
): Promise<VerifiedUser | null> {
  const nowMs = opts.nowMs ?? Date.now()
  const fetcher = opts.fetcher ?? ((url: string) => fetch(url))
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = decodeJsonPart(parts[0])
  const payload = decodeJsonPart(parts[1])
  if (!header || !payload) return null
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  const nowSec = nowMs / 1000
  const { aud, iss, sub, exp, iat, auth_time: authTime } = payload
  if (aud !== projectId) return null
  if (iss !== `https://securetoken.google.com/${projectId}`) return null
  if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) return null
  if (typeof exp !== 'number' || exp <= nowSec) return null
  if (typeof iat !== 'number' || iat > nowSec + CLOCK_SKEW_SEC) return null
  if (typeof authTime !== 'number' || authTime > nowSec + CLOCK_SKEW_SEC) return null

  const key = await getSigningKey(header.kid, nowMs, fetcher)
  if (!key) return null
  let signature: Uint8Array
  try {
    signature = base64UrlToBytes(parts[2])
  } catch {
    // 署名部が base64url として読めない＝無効
    return null
  }
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed)
  return ok ? { uid: sub } : null
}

// 長さ・内容にかかわらず同じ手間で比べる（キーの一致を時間差から推測させない）
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

export function parseUidList(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map((s) => s.trim()).filter(Boolean))
}

// スクリプト専用の窓口（/api/admin/*）。ADMIN_API_KEY 未設定なら常に 503。
export const requireAdmin = createMiddleware<{ Bindings: AuthBindings }>(async (c, next) => {
  const expected = c.env.ADMIN_API_KEY
  if (!expected) {
    return c.json({ error: 'Admin API not configured (ADMIN_API_KEY secret missing)' }, 503)
  }
  const provided = c.req.header('X-Admin-API-Key')
  if (!provided || !(await safeEqual(provided, expected))) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
})

// 管理画面とスクリプトの両方が使う窓口（アップロード・AI生成・音声・取り込み・一覧更新）
export const requireStaff = createMiddleware<{ Bindings: AuthBindings }>(async (c, next) => {
  const provided = c.req.header('X-Admin-API-Key')
  if (provided !== undefined) {
    const expected = c.env.ADMIN_API_KEY
    if (expected && (await safeEqual(provided, expected))) return next()
    return c.json({ error: 'unauthorized' }, 401)
  }

  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(c.req.header('Authorization') ?? '')
  if (!match) return c.json({ error: 'unauthorized' }, 401)

  const projectId = c.env.FIREBASE_PROJECT_ID
  const allowed = parseUidList(c.env.ALLOWED_UIDS)
  if (!projectId || allowed.size === 0) {
    return c.json({ error: 'staff auth not configured (FIREBASE_PROJECT_ID / ALLOWED_UIDS)' }, 503)
  }

  let user: VerifiedUser | null
  try {
    user = await verifyFirebaseIdToken(match[1], projectId)
  } catch (e) {
    if (e instanceof AuthUnavailableError) {
      console.error('staff auth unavailable:', e.message)
      return c.json({ error: 'auth temporarily unavailable' }, 503)
    }
    throw e
  }
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (!allowed.has(user.uid)) return c.json({ error: 'forbidden' }, 403)
  await next()
})
