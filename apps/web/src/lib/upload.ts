const API_BASE = import.meta.env.VITE_API_BASE_URL

async function putToR2(key: string, file: File): Promise<{ key: string; url: string }> {
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

export async function uploadImageToR2(file: File): Promise<{ key: string; url: string }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  // スラッシュを使わないフラットなキー
  const key = `v-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  return putToR2(key, file)
}

/**
 * レスポンシブ用にバリアント群をまとめて R2 にアップロード。
 * - ベース key は 1 度だけ生成し、最大幅を拡張子のみのキー（後方互換）に、他は `_${width}` サフィックス付きで保存
 * - 並列 PUT で時間を短縮
 * - 戻り値の `url` は最大幅 variant の URL（既存 `CarPhoto.url` が指すのと同じ）
 * - `urlVariants` は { "2560": url, "1280": url, "640": url } 形式
 */
export async function uploadVariantsToR2(
  variants: Array<{ width: number; file: File }>,
): Promise<{ key: string; url: string; urlVariants: Record<string, string> }> {
  if (variants.length === 0) throw new Error('variants が空です')

  // 最大幅を判定（ベース URL に充てるため）
  const sorted = [...variants].sort((a, b) => b.width - a.width)
  const maxWidth = sorted[0].width

  // ベース key（既存命名規則を踏襲、ext は webp 固定）
  const baseId = `v-${Date.now()}-${Math.random().toString(36).slice(2)}`

  // 並列アップロード
  const results = await Promise.all(
    sorted.map(async ({ width, file }) => {
      const key = width === maxWidth ? `${baseId}.webp` : `${baseId}_${width}.webp`
      const r = await putToR2(key, file)
      return { width, key: r.key, url: r.url }
    }),
  )

  const urlVariants: Record<string, string> = {}
  for (const r of results) {
    urlVariants[String(r.width)] = r.url
  }

  const baseResult = results.find((r) => r.width === maxWidth)
  if (!baseResult) throw new Error('ベース variant が見つかりません')

  return {
    key: baseResult.key,
    url: baseResult.url,
    urlVariants,
  }
}
