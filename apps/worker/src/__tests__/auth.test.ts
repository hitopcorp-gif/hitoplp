import { beforeEach, describe, expect, it } from 'vitest'
import { AuthUnavailableError, parseUidList, resetJwksCacheForTest, safeEqual, verifyFirebaseIdToken } from '../auth'
import { jwksFetcher, makeSigner, PROJECT_ID, validClaims, ALLOWED_UID } from './helpers'

const NOW_MS = Date.UTC(2026, 9, 31, 0, 0, 0)
const NOW_SEC = NOW_MS / 1000

describe('verifyFirebaseIdToken', () => {
  beforeEach(() => resetJwksCacheForTest())

  it('正しいトークンを受け付ける', async () => {
    const signer = await makeSigner()
    const token = await signer.sign(validClaims(NOW_SEC))
    const user = await verifyFirebaseIdToken(token, PROJECT_ID, { nowMs: NOW_MS, fetcher: jwksFetcher(signer.jwks) })
    expect(user).toEqual({ uid: ALLOWED_UID })
  })

  const rejects: Array<[string, Record<string, unknown>]> = [
    ['期限切れ', { exp: NOW_SEC - 1 }],
    ['別プロジェクト宛て（aud）', { aud: 'other-project' }],
    ['発行元が違う（iss）', { iss: 'https://securetoken.google.com/other-project' }],
    ['sub が空', { sub: '' }],
    ['未来に発行（iat）', { iat: NOW_SEC + 3600 }],
    ['未来にログイン（auth_time）', { auth_time: NOW_SEC + 3600 }],
    ['auth_time なし', { auth_time: undefined }],
  ]
  for (const [label, overrides] of rejects) {
    it(`拒否: ${label}`, async () => {
      const signer = await makeSigner()
      const token = await signer.sign(validClaims(NOW_SEC, overrides))
      expect(await verifyFirebaseIdToken(token, PROJECT_ID, { nowMs: NOW_MS, fetcher: jwksFetcher(signer.jwks) })).toBeNull()
    })
  }

  it('拒否: 別の鍵で署名（公開鍵一覧に無い署名者）', async () => {
    const real = await makeSigner('kid-a')
    const forger = await makeSigner('kid-a') // 同じ kid を名乗る別の鍵
    const token = await forger.sign(validClaims(NOW_SEC))
    expect(await verifyFirebaseIdToken(token, PROJECT_ID, { nowMs: NOW_MS, fetcher: jwksFetcher(real.jwks) })).toBeNull()
  })

  it('拒否: 中身を書き換えたトークン', async () => {
    const signer = await makeSigner()
    const token = await signer.sign(validClaims(NOW_SEC, { sub: 'someone-else' }))
    const [h, , s] = token.split('.')
    const good = (await signer.sign(validClaims(NOW_SEC))).split('.')[1]
    expect(await verifyFirebaseIdToken(`${h}.${good}.${s}`, PROJECT_ID, { nowMs: NOW_MS, fetcher: jwksFetcher(signer.jwks) })).toBeNull()
  })

  it('拒否: alg=none・知らない kid・形の崩れたトークン', async () => {
    const signer = await makeSigner()
    const opts = { nowMs: NOW_MS, fetcher: jwksFetcher(signer.jwks) }
    expect(await verifyFirebaseIdToken(await signer.sign(validClaims(NOW_SEC), { alg: 'none' }), PROJECT_ID, opts)).toBeNull()
    expect(await verifyFirebaseIdToken(await signer.sign(validClaims(NOW_SEC), { kid: 'unknown' }), PROJECT_ID, opts)).toBeNull()
    expect(await verifyFirebaseIdToken('a.b', PROJECT_ID, opts)).toBeNull()
    expect(await verifyFirebaseIdToken('!!!.###.$$$', PROJECT_ID, opts)).toBeNull()
  })

  it('公開鍵が取れない時は AuthUnavailableError（通さない）', async () => {
    const signer = await makeSigner()
    const token = await signer.sign(validClaims(NOW_SEC))
    const down = async () => new Response('down', { status: 503 })
    await expect(verifyFirebaseIdToken(token, PROJECT_ID, { nowMs: NOW_MS, fetcher: down })).rejects.toBeInstanceOf(AuthUnavailableError)
  })

  it('でたらめな kid が続いても公開鍵の取り直しは60秒に1回まで', async () => {
    const signer = await makeSigner()
    let calls = 0
    const counting = async (url: string) => { calls++; return jwksFetcher(signer.jwks)(url) }
    for (let i = 0; i < 5; i++) {
      const token = await signer.sign(validClaims(NOW_SEC), { kid: `random-${i}` })
      await verifyFirebaseIdToken(token, PROJECT_ID, { nowMs: NOW_MS + i * 1000, fetcher: counting })
    }
    expect(calls).toBe(1)
  })
})

describe('safeEqual / parseUidList', () => {
  it('一致と不一致', async () => {
    expect(await safeEqual('abc', 'abc')).toBe(true)
    expect(await safeEqual('abc', 'abd')).toBe(false)
    expect(await safeEqual('abc', 'abcd')).toBe(false)
  })

  it('UID 一覧は空白と空要素を無視する', () => {
    expect([...parseUidList(' a , b,,c ')]).toEqual(['a', 'b', 'c'])
    expect(parseUidList(undefined).size).toBe(0)
    expect(parseUidList('').size).toBe(0)
  })
})
