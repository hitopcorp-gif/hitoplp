const API_BASE = import.meta.env.VITE_API_BASE_URL

export async function uploadImageToR2(file: File): Promise<{ key: string; url: string }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  // スラッシュを使わないフラットなキー
  const key = `v-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const resp = await fetch(`${API_BASE}/api/upload/${key}`, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  })

  if (!resp.ok) {
    const msg = await resp.text().catch(() => '')
    throw new Error(`アップロード失敗: ${resp.status} ${msg}`)
  }

  const data = await resp.json() as { key: string; url: string }
  return {
    key: data.key,
    url: `${API_BASE}${data.url}`,
  }
}
