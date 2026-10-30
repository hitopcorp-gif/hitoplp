import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../index'
import { resetJwksCacheForTest } from '../auth'
import { ALLOWED_UID, FakeR2Bucket, jwksFetcher, makeSigner, PROJECT_ID, validClaims, type TestSigner } from './helpers'

const ADMIN_KEY = 'test-admin-key-xyz'
// 中身の先頭が WebP の形をした最小のバイト列（RIFF....WEBP）
const WEBP_BYTES = new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ')

function makeEnv(bucket: FakeR2Bucket, overrides: Record<string, string> = {}) {
  return {
    ANTHROPIC_API_KEY: 'unused',
    ELEVENLABS_API_KEY: '',
    ELEVENLABS_VOICE_ID: '',
    ADMIN_API_KEY: ADMIN_KEY,
    ALLOWED_ORIGIN: '*',
    FIREBASE_PROJECT_ID: PROJECT_ID,
    ALLOWED_UIDS: ALLOWED_UID,
    IMAGES: bucket.asR2(),
    ...overrides,
  }
}

const WRITE_ENDPOINTS: Array<[string, string, RequestInit]> = [
  ['PUT', '/api/upload/lp/some-car.html', { body: '<html>x</html>', headers: { 'content-type': 'text/html' } }],
  ['POST', '/api/scrape', { body: JSON.stringify({ url: 'https://example.com/' }), headers: { 'content-type': 'application/json' } }],
  ['POST', '/api/tts', { body: JSON.stringify({ text: 'x', slug: 'some-car' }), headers: { 'content-type': 'application/json' } }],
  ['POST', '/api/generate', { body: JSON.stringify({ prompt: 'x' }), headers: { 'content-type': 'application/json' } }],
  ['POST', '/api/lp-index', { body: JSON.stringify({ slug: 'some-car', entry: null }), headers: { 'content-type': 'application/json' } }],
]

describe('書き込み・課金系の窓口は認証なしでは通らない', () => {
  let bucket: FakeR2Bucket
  let signer: TestSigner
  const realFetch = globalThis.fetch

  beforeEach(async () => {
    resetJwksCacheForTest()
    bucket = new FakeR2Bucket()
    signer = await makeSigner()
    const fetcher = jwksFetcher(signer.jwks)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.includes('securetoken@system.gserviceaccount.com')) return fetcher(url)
      throw new Error(`試験中は外へ通信しない: ${url}`)
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
  })

  const nowSec = () => Math.floor(Date.now() / 1000)

  for (const [method, path, init] of WRITE_ENDPOINTS) {
    it(`${method} ${path}: ヘッダなし → 401、何も書かれない`, async () => {
      const res = await app.request(path, { method, ...init }, makeEnv(bucket))
      expect(res.status).toBe(401)
      expect(bucket.objects.size).toBe(0)
    })

    it(`${method} ${path}: 違う管理キー → 401`, async () => {
      const headers = { ...(init.headers as Record<string, string>), 'X-Admin-API-Key': 'wrong' }
      const res = await app.request(path, { method, ...init, headers }, makeEnv(bucket))
      expect(res.status).toBe(401)
      expect(bucket.objects.size).toBe(0)
    })

    it(`${method} ${path}: 本物のトークンでも許可一覧に無い UID → 403`, async () => {
      const token = await signer.sign(validClaims(nowSec(), { sub: 'stranger-signed-up-uid' }))
      const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
      const res = await app.request(path, { method, ...init, headers }, makeEnv(bucket))
      expect(res.status).toBe(403)
      expect(bucket.objects.size).toBe(0)
    })

    it(`${method} ${path}: 偽造トークン → 401`, async () => {
      const forger = await makeSigner(signer.kid)
      const token = await forger.sign(validClaims(nowSec()))
      const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
      const res = await app.request(path, { method, ...init, headers }, makeEnv(bucket))
      expect(res.status).toBe(401)
    })
  }

  it('許可一覧が空なら Firebase トークンは通さない（503）', async () => {
    const token = await signer.sign(validClaims(nowSec()))
    const res = await app.request('/api/upload/lp/some-car.html', {
      method: 'PUT', body: '<html></html>', headers: { 'content-type': 'text/html', Authorization: `Bearer ${token}` },
    }, makeEnv(bucket, { ALLOWED_UIDS: '' }))
    expect(res.status).toBe(503)
    expect(bucket.objects.size).toBe(0)
  })

  it('管理キーが未設定の Worker では管理キーを送っても通らない', async () => {
    const res = await app.request('/api/upload/lp/some-car.html', {
      method: 'PUT', body: '<html></html>', headers: { 'content-type': 'text/html', 'X-Admin-API-Key': '' },
    }, makeEnv(bucket, { ADMIN_API_KEY: '' }))
    expect(res.status).toBe(401)
  })

  it('許可された UID のトークンなら LP をアップロードできる', async () => {
    const token = await signer.sign(validClaims(nowSec()))
    const res = await app.request('/api/upload/lp/some-car.html', {
      method: 'PUT', body: '<html>ok</html>', headers: { 'content-type': 'text/html', Authorization: `Bearer ${token}` },
    }, makeEnv(bucket))
    expect(res.status).toBe(200)
    expect(await bucket.objects.get('lp/some-car.html')?.text()).toBe('<html>ok</html>')
    expect(bucket.objects.get('lp/some-car.html')?.contentType).toBe('text/html; charset=utf-8')
  })

  it('管理キーなら /lp-publish の写真キーへ書ける', async () => {
    const res = await app.request('/api/upload/vehicles/V0013/20261031-010203/01_hero_1280.webp', {
      method: 'PUT', body: WEBP_BYTES, headers: { 'content-type': 'image/webp', 'X-Admin-API-Key': ADMIN_KEY },
    }, makeEnv(bucket))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      key: 'vehicles/V0013/20261031-010203/01_hero_1280.webp',
      url: '/api/image/vehicles/V0013/20261031-010203/01_hero_1280.webp',
    })
  })

  it('認証があっても決められたキー・種類以外は書けない', async () => {
    const h = { 'X-Admin-API-Key': ADMIN_KEY }
    const put = (path: string, type: string, body: BodyInit = 'x') =>
      app.request(path, { method: 'PUT', body, headers: { ...h, 'content-type': type } }, makeEnv(bucket))
    expect((await put('/api/upload/lp/index.json', 'application/json', '[]')).status).toBe(400)
    expect((await put('/api/upload/assets/logo.png', 'image/png')).status).toBe(400)
    expect((await put('/api/upload/audio/some-car.mp3', 'audio/mpeg')).status).toBe(400)
    expect((await put('/api/upload/v-1761868800000-abc123.jpg', 'text/html')).status).toBe(415)
    expect((await put('/api/upload/v-1761868800000-abc123.svg', 'image/svg+xml')).status).toBe(415)
    expect((await put('/api/upload/v-1761868800000-abc123.jpg', 'image/jpeg', '')).status).toBe(400)
    // 申告は画像でも中身が HTML なら断る
    expect((await put('/api/upload/v-1761868800000-abc123.jpg', 'image/jpeg', '<html><script>alert(1)</script>')).status).toBe(415)
    expect((await put('/api/upload/sns/reel/some-car.mp4', 'video/mp4', '<svg onload=alert(1)>')).status).toBe(415)
    expect(bucket.objects.size).toBe(0)
  })
})

describe('GET /api/image', () => {
  it('保存済み LP の生 HTML は返さず、一覧 JSON と画像は返す', async () => {
    const bucket = new FakeR2Bucket()
    await bucket.put('lp/some-car.html', '<html>secret draft</html>', { httpMetadata: { contentType: 'text/html' } })
    await bucket.put('lp/index.json', '[]', { httpMetadata: { contentType: 'application/json' } })
    await bucket.put('v-1761868800000-abc123.webp', new Uint8Array([1]), { httpMetadata: { contentType: 'image/webp' } })
    const env = makeEnv(bucket)
    expect((await app.request('/api/image/lp/some-car.html', {}, env)).status).toBe(404)
    expect((await app.request('/api/image/lp/index.json', {}, env)).status).toBe(200)
    const img = await app.request('/api/image/v-1761868800000-abc123.webp', {}, env)
    expect(img.status).toBe(200)
    expect(img.headers.get('x-content-type-options')).toBe('nosniff')
    // LP そのものの配信（/:slug）は今まで通り
    expect((await app.request('/some-car', {}, env)).status).toBe(200)
  })
})
