import imageCompression from 'browser-image-compression'

/**
 * LP用の画像圧縮。
 * - ヒーロー写真（フルブリード背景 + SNS素材のソース）: 最大幅2560px / quality 0.95
 * - その他: 最大幅1920px / quality 0.90
 * - WebPに変換（ブラウザ対応時）
 * - 最大ファイルサイズ: 4MB（ヒーロー）/ 1.5MB（その他）
 *   ※ サイズ上限を緩めることで browser-image-compression による画質の自動低下を防ぐ
 * - 元画像が小さければ拡大しない
 */
export async function compressForLp(
  file: File,
  role: 'hero' | 'other' = 'other',
): Promise<File> {
  const isHero = role === 'hero'

  const options = {
    maxSizeMB: isHero ? 4 : 1.5,
    maxWidthOrHeight: isHero ? 2560 : 1920,
    useWebWorker: true,
    fileType: 'image/webp' as const,
    initialQuality: isHero ? 0.95 : 0.9,
    preserveExif: false,
  }

  try {
    const compressed = await imageCompression(file, options)

    // ファイル名をwebp拡張子に統一
    const baseName = file.name.replace(/\.[^.]+$/, '')
    const webpFile = new File([compressed], `${baseName}.webp`, {
      type: 'image/webp',
    })

    // 圧縮後が元より大きい場合は元を返す（稀だが安全策）
    if (webpFile.size >= file.size) {
      return file
    }

    return webpFile
  } catch (e) {
    // 圧縮失敗時は元画像をそのまま返す（アップロードを止めない）
    console.warn('Image compression failed, using original:', e)
    return file
  }
}

/**
 * レスポンシブ配信向けの多サイズバリアント生成。
 * - 全写真共通で 3 サイズ（2560 / 1280 / 640）を生成
 * - 元画像幅より大きいサイズはスキップ（拡大しない）
 * - 各 variant は WebP 化
 * - 圧縮失敗 / 元画像が小さすぎる場合は最低 1 つ（元画像）は返す
 */
export async function compressForLpVariants(
  file: File,
  role: 'hero' | 'other' = 'other',
): Promise<Array<{ width: number; file: File }>> {
  // hero/other の区別は今のところ仕様上同じ variant 群を返す。将来 hero のみ更に大きなサイズを足す等の拡張余地として引数を残す。
  void role

  const targets: Array<{ width: number; quality: number; maxSizeMB: number }> = [
    { width: 2560, quality: 0.95, maxSizeMB: 4 },
    { width: 1280, quality: 0.92, maxSizeMB: 1.5 },
    { width: 640, quality: 0.9, maxSizeMB: 0.5 },
  ]

  // 元画像の幅取得（拡大しないため）
  const sourceWidth = await readImageWidth(file).catch(() => Infinity)

  const baseName = file.name.replace(/\.[^.]+$/, '')

  const variants = await Promise.all(
    targets
      .filter((t) => sourceWidth >= t.width || t.width === targets[targets.length - 1].width)
      .map(async (t) => {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: t.maxSizeMB,
            maxWidthOrHeight: t.width,
            useWebWorker: true,
            fileType: 'image/webp' as const,
            initialQuality: t.quality,
            preserveExif: false,
          })
          const out = new File([compressed], `${baseName}_${t.width}.webp`, {
            type: 'image/webp',
          })
          // 圧縮後が元より大きい稀ケースは元を採用
          return { width: t.width, file: out.size < file.size ? out : file }
        } catch (e) {
          console.warn(`Variant compression failed (${t.width}px), falling back to source:`, e)
          return { width: t.width, file }
        }
      }),
  )

  // 重複（同じ File 参照）の連続を避けつつ最低 1 つ保証
  return variants.length > 0 ? variants : [{ width: targets[targets.length - 1].width, file }]
}

async function readImageWidth(file: File): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img.naturalWidth)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
