import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null

/**
 * FFmpeg WASM を初回のみロード（~25MB、キャッシュされる）
 */
async function getFFmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg

  onProgress?.('FFmpegを読み込み中（初回のみ）...')
  ffmpeg = new FFmpeg()

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  return ffmpeg
}

/**
 * 動画(.mp4) + 音声(.mp3) → 結合済み動画(.mp4)
 * 再エンコードなし（コピー）なので数秒で完了
 */
export async function mergeVideoAudio(
  videoUrl: string,
  audioUrl: string,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  const ff = await getFFmpeg(onProgress)

  onProgress?.('ファイルを取得中...')
  const [videoData, audioData] = await Promise.all([
    fetchFile(videoUrl),
    fetchFile(audioUrl),
  ])

  await ff.writeFile('input.mp4', videoData)
  await ff.writeFile('input.mp3', audioData)

  onProgress?.('動画と音声を結合中...')
  // -c:v copy: 映像は再エンコードなし
  // -c:a aac: MP3→AAC変換（MP4コンテナとの互換性のため）
  // -shortest: 短い方に合わせる
  await ff.exec([
    '-i', 'input.mp4',
    '-i', 'input.mp3',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v',
    '-map', '1:a',
    '-shortest',
    '-movflags', '+faststart',
    'output.mp4',
  ])

  const data = await ff.readFile('output.mp4')
  const blob = new Blob([data], { type: 'video/mp4' })

  // Cleanup
  await ff.deleteFile('input.mp4')
  await ff.deleteFile('input.mp3')
  await ff.deleteFile('output.mp4')

  onProgress?.('')
  return blob
}
