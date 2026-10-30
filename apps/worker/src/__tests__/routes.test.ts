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

  it('申告と実際の画像形式が食い違っても保存し、実際の形式で記録する（Safari の WebP 変換・fal.ai の PNG）', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const h = { 'X-Admin-API-Key': ADMIN_KEY }
    const put = (path: string, type: string) =>
      app.request(path, { method: 'PUT', body: png, headers: { ...h, 'content-type': type } }, makeEnv(bucket))
    expect((await put('/api/upload/sns/vertical/some-car.jpg', 'image/jpeg')).status).toBe(200)
    expect(bucket.objects.get('sns/vertical/some-car.jpg')?.contentType).toBe('image/png')
    expect((await put('/api/upload/v-1761868800000-abc123_1280.webp', 'image/webp')).status).toBe(200)
    expect(bucket.objects.get('v-1761868800000-abc123_1280.webp')?.contentType).toBe('image/png')
    // 動画キーに画像は入れられない
    expect((await put('/api/upload/sns/reel/some-car.mp4', 'video/mp4')).status).toBe(415)
  })

  it('ftyp は画像の brand（heic / avif 等）だけを画像とみなし、mp4 は画像キーに入れられない', async () => {
    const ftyp = (brand: string) => new TextEncoder().encode(`\x00\x00\x00\x18ftyp${brand}\x00\x00\x00\x00`)
    const h = { 'X-Admin-API-Key': ADMIN_KEY }
    const put = (path: string, type: string, body: Uint8Array) =>
      app.request(path, { method: 'PUT', body, headers: { ...h, 'content-type': type } }, makeEnv(bucket))
    expect((await put('/api/upload/v-1761868800000-abc123.heic', 'image/heic', ftyp('heic'))).status).toBe(200)
    expect(bucket.objects.get('v-1761868800000-abc123.heic')?.contentType).toBe('image/heic')
    expect((await put('/api/upload/v-1761868800000-abc124.avif', 'image/jpeg', ftyp('avif'))).status).toBe(200)
    expect(bucket.objects.get('v-1761868800000-abc124.avif')?.contentType).toBe('image/avif')
    expect((await put('/api/upload/v-1761868800000-abc125.jpg', 'image/jpeg', ftyp('isom'))).status).toBe(415)
    expect((await put('/api/upload/sns/reel/some-car.mp4', 'video/mp4', ftyp('isom'))).status).toBe(200)
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

describe('LP配信（/:slug）と一覧（/）', () => {
  const W = 'https://hitoplp-api.hitopcorp.workers.dev'
  const lpHtml = (slug: string) =>
    `<html><head><link rel="canonical" href="${W}/${slug}"></head><body><img src="${W}/api/image/v-1.webp"><a href="${W}/">一覧へ</a></body></html>`
  const entry = (slug: string, extra: Record<string, unknown> = {}) =>
    ({ slug, name: 'Car', nameJa: '', year: 2020, price: '100万円', heroUrl: '', status: 'published', ...extra })

  async function setup(index: unknown[], slugs: string[]) {
    const bucket = new FakeR2Bucket()
    for (const s of slugs) await bucket.put(`lp/${s}.html`, lpHtml(s), { httpMetadata: { contentType: 'text/html' } })
    await bucket.put('lp/index.json', JSON.stringify(index), { httpMetadata: { contentType: 'application/json' } })
    return makeEnv(bucket)
  }

  it('一覧に載った車は住所を hi-top.net/stock/ に書き換え、画像の住所はそのまま', async () => {
    const env = await setup([entry('listed-car')], ['listed-car'])
    const res = await app.request('/listed-car', {}, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBeNull()
    const html = await res.text()
    expect(html).toContain('href="https://hi-top.net/stock/listed-car"')
    expect(html).toContain('href="https://hi-top.net/stock/"')
    expect(html).toContain(`src="${W}/api/image/v-1.webp"`)
  })

  it('下書き（一覧に無い車）は住所を書き換えず、検索にも載せない', async () => {
    const env = await setup([entry('listed-car')], ['listed-car', 'draft-car'])
    const res = await app.request('/draft-car', {}, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    const html = await res.text()
    expect(html).toContain(`href="${W}/draft-car"`)
    expect(html).not.toContain('hi-top.net/stock')
  })

  it('一覧の車名・価格・画像の住所はHTMLとして解釈されない', async () => {
    const env = await setup([
      entry('ok-car', { name: '<img src=x onerror=alert(1)>', nameJa: '"><script>x</script>', price: '1&2', heroUrl: 'javascript:alert(1)' }),
      entry('bad"slug'),
    ], [])
    const html = await (await app.request('/', {}, env)).text()
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>x')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('bad"slug')
    expect(html).toContain('&#60;img src=x onerror=alert(1)&#62;')
    expect(html).toContain('1&#38;2')
    expect(html).toContain('href="/ok-car"')
  })
})
