const API_BASE = import.meta.env.VITE_API_BASE_URL

export async function uploadImageToR2(file: File): Promise<{ key: string; url: string }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `vehicles/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const resp = await fetch(`${API_BASE}/api/upload/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  })

  if (!resp.ok) throw new Error('画像のアップロードに失敗しました')

  const data = await resp.json() as { key: string; url: string }
  // フルURLに変換
  return {
    key: data.key,
    url: `${API_BASE}${data.url}`,
  }
}
