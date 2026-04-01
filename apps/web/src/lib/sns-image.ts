const API_BASE = import.meta.env.VITE_API_BASE_URL

/**
 * ヒーロー画像を1080×1080正方形にスマートクロップ（Canvas API）
 */
export async function generateFeedImage(imageUrl: string, slug: string): Promise<string> {
  const img = await loadImage(imageUrl)

  const size = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')!

  // 中央基準でクロップ
  const sx = Math.floor((img.width - size) / 2)
  const sy = Math.floor((img.height - size) / 2)
  ctx.drawImage(img, sx, sy, size, size, 0, 0, 1080, 1080)

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
  const key = `sns/feed/${slug}.jpg`
  await uploadBlob(key, blob, 'image/jpeg')

  return `${API_BASE}/api/image/${key}`
}

/**
 * ヒーロー画像を1200×630にクロップ + 車名 + ロゴオーバーレイ（Canvas API）
 */
export async function generateOgpImage(
  imageUrl: string,
  slug: string,
  carName: string,
): Promise<string> {
  const img = await loadImage(imageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')!

  // Cover crop
  const imgRatio = img.width / img.height
  const canvasRatio = 1200 / 630
  let sw: number, sh: number, sx: number, sy: number
  if (imgRatio > canvasRatio) {
    sh = img.height
    sw = sh * canvasRatio
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = sw / canvasRatio
    sx = 0
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1200, 630)

  // 下部ダークバー
  const grad = ctx.createLinearGradient(0, 480, 0, 630)
  grad.addColorStop(0, 'rgba(10,10,10,0)')
  grad.addColorStop(0.3, 'rgba(10,10,10,0.7)')
  grad.addColorStop(1, 'rgba(10,10,10,0.92)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 420, 1200, 210)

  // 車名テキスト
  ctx.fillStyle = '#F5F5F0'
  ctx.font = '700 28px "Satoshi", "Helvetica Neue", sans-serif'
  ctx.fillText(carName, 40, 560)

  // HI-TOP ブランド
  ctx.fillStyle = '#C4A265'
  ctx.font = '400 14px "Satoshi", "Helvetica Neue", sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillText('HI-TOP CORPORATION', 40, 595)

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
  const key = `sns/ogp/${slug}.jpg`
  await uploadBlob(key, blob, 'image/jpeg')

  return `${API_BASE}/api/image/${key}`
}

// ── Helpers ──

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas blob conversion failed'))),
      type,
      quality,
    )
  })
}

async function uploadBlob(key: string, blob: Blob, contentType: string): Promise<void> {
  const buffer = await blob.arrayBuffer()
  const res = await fetch(`${API_BASE}/api/upload/${key}`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: buffer,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
}
