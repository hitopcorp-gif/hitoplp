import { fal } from '@fal-ai/client'
import { uploadObject } from './api'

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

const REEL_PROMPT = 'Cinematic luxury car showcase. The car is parked in a showroom, engine off. First half: slow camera orbit around the car showing the full body and studio environment. Second half: camera smoothly zooms in toward the front, focusing on headlights, grille and badge details. Keep the wall-mounted logo and shield sign visible throughout. Premium studio lighting with sharp reflections on bodywork. High detail, photorealistic, 4K quality. No text, no people, no watermarks.'
// fal.ai で生成できたが R2 への保存がまだの成果物（入力ごと）。
// 保存だけ失敗した時に、やり直しで生成から繰り返して料金が二重にかからないようにする（このタブを開いている間だけ）
const unsavedOutputs = new Map<string, string>()

async function generateOnce(cacheKey: string, generate: () => Promise<string>): Promise<string> {
  const cached = unsavedOutputs.get(cacheKey)
  if (cached) return cached
  const url = await generate()
  unsavedOutputs.set(cacheKey, url)
  return url
}

// 「作り直し」の時は、保存できていない成果物も使わずに生成し直す
export function forgetUnsavedReelOutputs(slug: string): void {
  for (const key of [...unsavedOutputs.keys()]) {
    if (key.startsWith(`vertical:${slug}:`) || key.startsWith(`reel:${slug}:`)) unsavedOutputs.delete(key)
  }
}

// 生成物を R2 へ保存する。成功したら覚えていた成果物を忘れる。
// 生成物を取得できない時（期限切れ等）も忘れて、次のやり直しでは生成し直す
async function saveOutput(cacheKey: string, outputUrl: string, key: string, contentType: string): Promise<string> {
  const res = await fetch(outputUrl)
  if (!res.ok) {
    unsavedOutputs.delete(cacheKey)
    throw new Error(`生成物の取得に失敗しました: ${res.status}`)
  }
  const { url } = await uploadObject(key, await res.arrayBuffer(), contentType)
  unsavedOutputs.delete(cacheKey)
  return url
}

const REEL_NEGATIVE = 'blur, distort, low quality, text, watermark, people, cartoon, anime, drawing, spinning wheels, rotating wheels, driving, moving car'

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

  const cacheKey = `vertical:${slug}:${imageUrl}`
  const outputUrl = await generateOnce(cacheKey, async () => {
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
    return outputImages[0].url
  })

  // R2に保存（中身が PNG でも Worker が実際の形式で保存する）
  onProgress?.('縦長画像を保存中...')
  return saveOutput(cacheKey, outputUrl, `sns/vertical/${slug}.jpg`, 'image/jpeg')
}

/**
 * Step 2: 縦長画像 → 15秒リール動画（2カット構成）
 * fal.ai Kling v3 Pro を使用
 * カット1: 8秒 オービット（車の周りを回る）
 * カット2: 7秒 ズームイン（フロント詳細に寄る）
 */
export async function generateReelVideo(
  verticalImageUrl: string,
  slug: string,
  onProgress?: (phase: string) => void,
): Promise<string> {
  if (!FAL_KEY) throw new Error('FAL_KEY が設定されていません')

  onProgress?.('リール動画を生成中（5〜10分）...')

  const cacheKey = `reel:${slug}:${verticalImageUrl}`
  const outputUrl = await generateOnce(cacheKey, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe('fal-ai/kling-video/v2.5-turbo/pro/image-to-video' as any, {
      input: {
        prompt: REEL_PROMPT,
        image_url: verticalImageUrl,
        duration: '10',
        negative_prompt: REEL_NEGATIVE,
        aspect_ratio: '9:16',
      },
    })

    const video = (result as { data?: { video?: { url: string } }; video?: { url: string } })
    const videoUrl = video.data?.video?.url ?? video.video?.url
    if (!videoUrl) throw new Error('リール動画の生成に失敗しました')
    return videoUrl
  })

  // R2に保存
  onProgress?.('リール動画を保存中...')
  return saveOutput(cacheKey, outputUrl, `sns/reel/${slug}.mp4`, 'video/mp4')
}
