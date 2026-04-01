import { fal } from '@fal-ai/client'

const FAL_KEY = import.meta.env.VITE_FAL_KEY

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY })
}

const VERTICAL_PROMPT = `Extend this image vertically to 9:16 aspect ratio (1080x1920). High quality, photorealistic, sharp details.

Rules:
- Do NOT crop, resize, or modify the car in any way
- Do NOT add any text or watermark
- Keep the existing "HitopCorp" logo and shield on the wall, but reposition it: place it centered horizontally, near the top of the image, and make it approximately 20% larger than the original
- Only extend the background upward and downward
- Keep the exact same studio background color, lighting, and floor reflection
- The car must remain fully visible with no parts cut off
- Center the car vertically in the final image
- Maintain sharp edges, reflections, and fine details of the original image`

const REEL_PROMPT = 'Slow cinematic camera orbit around a luxury car. Premium studio lighting with sharp reflections on bodywork. High detail, photorealistic, 4K quality. No text, no people, no watermarks.'

/**
 * Step 1: 横長ヒーロー写真 → 縦長9:16画像に背景拡張
 * fal.ai Nano Banana Pro を使用
 */
export async function generateVerticalImage(
  imageUrl: string,
  slug: string,
  onProgress?: (phase: string) => void,
): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY が設定されていません')

  onProgress?.('縦長画像を生成中...')

  const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
    input: {
      image_urls: [imageUrl],
      aspect_ratio: '9:16',
      prompt: VERTICAL_PROMPT,
    },
  })

  const images = (result as { data?: { images?: Array<{ url: string }> }; images?: Array<{ url: string }> })
  const outputImages = images.data?.images ?? images.images
  if (!outputImages?.[0]?.url) throw new Error('縦長画像の生成に失敗しました')

  // R2に保存
  onProgress?.('縦長画像を保存中...')
  const imageBuffer = await fetch(outputImages[0].url).then(r => r.arrayBuffer())
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const key = `sns/vertical/${slug}.jpg`

  await fetch(`${API_BASE}/api/upload/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: imageBuffer,
  })

  return `${API_BASE}/api/image/${key}`
}

/**
 * Step 2: 縦長画像 → 10秒リール動画
 * fal.ai Kling 2.5 Turbo を使用
 */
export async function generateReelVideo(
  verticalImageUrl: string,
  slug: string,
  onProgress?: (phase: string) => void,
): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY が設定されていません')

  onProgress?.('リール動画を生成中（5〜10分）...')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe('fal-ai/kling-video/v2.5/pro/image-to-video' as any, {
    input: {
      prompt: REEL_PROMPT,
      image_url: verticalImageUrl,
      duration: '10',
      aspect_ratio: '9:16',
    },
  })

  const video = (result as { data?: { video?: { url: string } }; video?: { url: string } })
  const videoUrl = video.data?.video?.url ?? video.video?.url
  if (!videoUrl) throw new Error('リール動画の生成に失敗しました')

  // R2に保存
  onProgress?.('リール動画を保存中...')
  const videoBuffer = await fetch(videoUrl).then(r => r.arrayBuffer())
  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const key = `sns/reel/${slug}.mp4`

  await fetch(`${API_BASE}/api/upload/${key}`, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4' },
    body: videoBuffer,
  })

  return `${API_BASE}/api/image/${key}`
}
