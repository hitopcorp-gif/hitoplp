import imageCompression from 'browser-image-compression'

/**
 * LP用の画像圧縮。
 * - ヒーロー写真（フルブリード背景）: 最大幅2400px / quality 0.85
 * - その他: 最大幅1800px / quality 0.82
 * - WebPに変換（ブラウザ対応時）
 * - 最大ファイルサイズ: 800KB（ヒーロー）/ 500KB（その他）
 * - 元画像が小さければ拡大しない
 */
export async function compressForLp(
  file: File,
  role: 'hero' | 'other' = 'other',
): Promise<File> {
  const isHero = role === 'hero'

  const options = {
    maxSizeMB: isHero ? 0.8 : 0.5,
    maxWidthOrHeight: isHero ? 2400 : 1800,
    useWebWorker: true,
    fileType: 'image/webp' as const,
    initialQuality: isHero ? 0.85 : 0.82,
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
