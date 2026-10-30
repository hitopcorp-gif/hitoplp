// 試験用の道具: 偽の R2（etag つき条件付き書き込みまで再現）と、Firebase ID トークンの偽造用の鍵

export class FakeR2Object {
  constructor(
    readonly key: string,
    private readonly data: Uint8Array,
    readonly etag: string,
    readonly contentType: string | undefined,
  ) {}

  get body(): ReadableStream {
    return new Response(this.data).body as ReadableStream
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this.data)
  }

  writeHttpMetadata(headers: Headers): void {
    if (this.contentType) headers.set('content-type', this.contentType)
  }
}

type PutOptions = { httpMetadata?: { contentType?: string }; onlyIf?: { etagMatches?: string } | Headers }

function preconditionHolds(current: FakeR2Object | undefined, onlyIf: PutOptions['onlyIf']): boolean {
  if (!onlyIf) return true
  if (onlyIf instanceof Headers) {
    // 本物の R2 と同じく If-None-Match: * は「まだ無い時だけ」
    return onlyIf.get('If-None-Match') === '*' ? current === undefined : true
  }
  return onlyIf.etagMatches === undefined || current?.etag === onlyIf.etagMatches
}

export class FakeR2Bucket {
  readonly objects = new Map<string, FakeR2Object>()
  private seq = 0
  // 試験で「読んだ直後に他の人が書いた」状況を作るためのフック
  beforePut: ((key: string) => Promise<void>) | null = null
  // 試験で R2 の回数制限（429）を起こす回数
  failNextPuts = 0

  async get(key: string): Promise<FakeR2Object | null> {
    return this.objects.get(key) ?? null
  }

  async put(key: string, value: string | ArrayBuffer | Uint8Array, opts: PutOptions = {}): Promise<FakeR2Object | null> {
    if (this.beforePut) {
      const hook = this.beforePut
      this.beforePut = null
      await hook(key)
    }
    if (this.failNextPuts > 0) {
      this.failNextPuts--
      throw new Error('put: Reduce your concurrent request rate for the same object. (10058)')
    }
    if (!preconditionHolds(this.objects.get(key), opts.onlyIf)) return null
    const data = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
    const obj = new FakeR2Object(key, data, `etag-${++this.seq}`, opts.httpMetadata?.contentType)
    this.objects.set(key, obj)
    return obj
  }

  asR2(): R2Bucket {
    return this as unknown as R2Bucket // 試験で使うメソッドだけを持つ偽物
  }
}

export const PROJECT_ID = 'hitoplp'
export const ALLOWED_UID = 'allowed-uid-0001'

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type TestSigner = {
  kid: string
  jwks: { keys: JsonWebKey[] }
  sign: (payload: Record<string, unknown>, header?: Record<string, unknown>) => Promise<string>
}

export async function makeSigner(kid = 'test-kid-1'): Promise<TestSigner> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey) as JsonWebKey
  return {
    kid,
    jwks: { keys: [{ ...pub, kid, alg: 'RS256', use: 'sig' } as JsonWebKey] },
    sign: async (payload, header = {}) => {
      const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT', ...header }))
      const body = b64url(JSON.stringify(payload))
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`))
      return `${head}.${body}.${b64url(new Uint8Array(sig))}`
    },
  }
}

export function validClaims(nowSec: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: ALLOWED_UID,
    user_id: ALLOWED_UID,
    iat: nowSec - 10,
    exp: nowSec + 3600,
    auth_time: nowSec - 100,
    ...overrides,
  }
}

export function jwksFetcher(jwks: unknown): (url: string) => Promise<Response> {
  return async () => new Response(JSON.stringify(jwks), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  })
}
