import { auth } from './firebase'

// Worker（hitoplp-api）の書き込み・課金系の窓口はログイン必須。
// ここを通すと Firebase の ID トークンを Authorization に付ける（期限が近ければ自動で取り直される）。

export const API_BASE = import.meta.env.VITE_API_BASE_URL

async function idToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('ログインが切れています。画面を開き直してログインしてください')
  return user.getIdToken()
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${await idToken()}`)
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

async function failMessage(res: Response, label: string): Promise<string> {
  const detail = await res.text().catch(() => '')
  return `${label}: ${res.status} ${detail}`.trim()
}

// R2 へ保存する（キーの形と種類は Worker 側の upload-policy.ts で決まっている）
export async function uploadObject(
  key: string,
  body: BodyInit,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const res = await apiFetch(`/api/upload/${key}`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body,
  })
  if (!res.ok) throw new Error(await failMessage(res, 'アップロード失敗'))
  const data = await res.json() as { key: string; url: string }
  return { key: data.key, url: `${API_BASE}${data.url}` }
}

export interface LpIndexEntry {
  slug: string
  name: string
  nameJa: string
  year: number
  price: string
  heroUrl: string
  status: 'published' | 'sold'
}

// 公開一覧（lp/index.json）への追加・差し替え（entry）と取り外し（null）。
// 読み直しと書き込みは Worker が行うので、同時に公開しても他の車が一覧から落ちない。
export async function updateLpIndex(slug: string, entry: LpIndexEntry | null): Promise<void> {
  const res = await apiFetch('/api/lp-index', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, entry }),
  })
  if (!res.ok) throw new Error(await failMessage(res, '公開一覧の更新に失敗'))
}
