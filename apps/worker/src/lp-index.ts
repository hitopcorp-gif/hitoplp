import { SLUG_PATTERN } from './upload-policy'

// ── LP 一覧（R2 の lp/index.json）の更新 ──
// 以前は管理画面が「読む → 足す → 丸ごと書く」をしていたため、
//   - 読めなかった時に空の一覧で上書きしうる
//   - 2台を同時に公開すると、後から書いた方が先の1台を消しうる
// という穴があった。ここでは Worker が読み直し、読んだ版（etag）のままの時だけ書く。
// 書けなければ読み直してやり直す。一覧が壊れて読めない時は書かずに止める。

export const LP_INDEX_KEY = 'lp/index.json'
const MAX_ATTEMPTS = 8
const BACKOFF_BASE_MS = 20

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export type LpIndexEntry = {
  slug: string
  name: string
  nameJa: string
  year: number
  price: string
  heroUrl: string
  status: 'published' | 'sold'
}

export type LpIndexUpdate = { slug: string; entry: LpIndexEntry | null }

export class LpIndexUnreadableError extends Error {}
export class LpIndexConflictError extends Error {}

function isText(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

// 入力の形を確かめる。正しければ更新内容、だめなら理由の文字列。
export function parseLpIndexUpdate(body: unknown): LpIndexUpdate | string {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const { slug, entry } = body as { slug?: unknown; entry?: unknown }
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return 'slug required, format: [a-z0-9-]+'
  if (entry === null) return { slug, entry: null }
  if (!entry || typeof entry !== 'object') return 'entry must be an object or null'

  const e = entry as Record<string, unknown>
  if (e.slug !== slug) return 'entry.slug must equal slug'
  if (!isText(e.name, 300) || e.name.trim() === '') return 'entry.name required'
  if (!isText(e.nameJa, 300)) return 'entry.nameJa must be a string'
  if (typeof e.year !== 'number' || !Number.isInteger(e.year) || e.year < 1900 || e.year > 2100) {
    return 'entry.year must be an integer year'
  }
  if (!isText(e.price, 100)) return 'entry.price must be a string'
  if (!isText(e.heroUrl, 2000) || (e.heroUrl !== '' && !e.heroUrl.startsWith('https://'))) {
    return 'entry.heroUrl must be empty or an https URL'
  }
  if (e.status !== 'published' && e.status !== 'sold') return 'entry.status must be published or sold'

  return {
    slug,
    entry: {
      slug, name: e.name, nameJa: e.nameJa, year: e.year, price: e.price, heroUrl: e.heroUrl, status: e.status,
    },
  }
}

const hasSlug = (x: unknown, slug: string) =>
  !!x && typeof x === 'object' && (x as { slug?: unknown }).slug === slug

function applyUpdate(current: unknown[], update: LpIndexUpdate): unknown[] {
  const rest = current.filter((x) => !hasSlug(x, update.slug))
  return update.entry ? [update.entry, ...rest] : rest // 新しい順に先頭へ
}

async function readIndex(bucket: R2Bucket): Promise<{ obj: R2ObjectBody | null; current: unknown[] }> {
  const obj = await bucket.get(LP_INDEX_KEY)
  if (!obj) return { obj: null, current: [] }
  try {
    const parsed: unknown = JSON.parse(await obj.text())
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return { obj, current: parsed }
  } catch (e) {
    throw new LpIndexUnreadableError(`lp/index.json を読めません（上書きしません）: ${String(e)}`)
  }
}

export async function updateLpIndex(bucket: R2Bucket, update: LpIndexUpdate): Promise<{ count: number }> {
  const httpMetadata = { contentType: 'application/json' }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1) + Math.random() * 50)

    const { obj, current } = await readIndex(bucket)
    const next = applyUpdate(current, update)
    // 読んだ版のままの時だけ書く。一覧がまだ無い時（初回だけ）は「まだ無ければ作る」。
    // どちらも途中で他の更新が入っていたら null が返る → 読み直す
    const onlyIf = obj ? { etagMatches: obj.etag } : new Headers({ 'If-None-Match': '*' })
    const written = await bucket.put(LP_INDEX_KEY, JSON.stringify(next), { httpMetadata, onlyIf })
    if (written) return { count: next.length }
  }
  throw new LpIndexConflictError('lp/index.json の更新が混み合っています。少し待ってやり直してください')
}
