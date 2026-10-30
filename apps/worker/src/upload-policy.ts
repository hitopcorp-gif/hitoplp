// ── PUT /api/upload で書いてよいキー・中身の種類・大きさ ──
// 管理画面（apps/web）と /lp-publish スキルが実際に使っているものだけを許す。
// 一覧 lp/index.json はここでは書かせない（POST /api/lp-index が読み直してから書く）。

// 車名から作るので長いものや "-" で始まるものもある（実例: 83文字、"-se-4wd-…"）
const SLUG = '[a-z0-9-]{1,200}'
const MB = 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']

export type UploadRule = {
  contentTypes: string[]
  maxBytes: number
  storeAs?: string      // 保存する content-type を固定する時
  allowEmpty?: boolean  // LP の削除は空の HTML で上書きしている
}

const RULES: Array<{ pattern: RegExp; rule: UploadRule }> = [
  // 管理画面の写真（lib/upload.ts）: v-<時刻>-<乱数>[_<幅>].<拡張子>
  {
    pattern: /^v-\d{10,16}-[a-z0-9]{1,16}(?:_\d{2,5})?\.[A-Za-z0-9]{1,8}$/,
    rule: { contentTypes: IMAGE_TYPES, maxBytes: 25 * MB },
  },
  // /lp-publish の写真: vehicles/<車両ID>/<YYYYMMDD-HHMMSS>/<元ファイル名>[_<幅>].webp
  {
    // ファイル名部分は / \ と制御文字を除く
    pattern: /^vehicles\/[A-Za-z0-9_-]{1,64}\/\d{8}-\d{6}\/[^/\\\u0000-\u001f\u007f]{1,160}\.webp$/,
    rule: { contentTypes: ['image/webp'], maxBytes: 25 * MB },
  },
  // SNS 用画像（lib/sns-image.ts・lib/reel.ts）
  {
    pattern: new RegExp(`^sns/(?:feed|ogp|vertical)/${SLUG}\\.jpg$`),
    rule: { contentTypes: ['image/jpeg'], maxBytes: 25 * MB },
  },
  // リール動画（lib/reel.ts）
  {
    pattern: new RegExp(`^sns/reel/${SLUG}\\.mp4$`),
    rule: { contentTypes: ['video/mp4'], maxBytes: 95 * MB },
  },
  // LP 本文（VehicleDetailPage の公開・売約・削除）
  {
    pattern: new RegExp(`^lp/${SLUG}\\.html$`),
    rule: { contentTypes: ['text/html'], maxBytes: 5 * MB, storeAs: 'text/html; charset=utf-8', allowEmpty: true },
  },
]

export function uploadRuleFor(key: string): UploadRule | null {
  return RULES.find((r) => r.pattern.test(key))?.rule ?? null
}

// "image/jpeg; charset=..." → "image/jpeg"
export function normalizeContentType(raw: string | undefined): string {
  return (raw ?? '').split(';')[0].trim().toLowerCase()
}

// 中身の先頭から画像の形式を見分ける。画像でなければ null。
// 管理画面の WebP 変換はブラウザによって PNG のまま返り、fal.ai の縦長画像は既定で PNG で届くため、
// 申告と実際の形式が食い違うことがある。食い違いは許し、実際の形式で保存する（画像でない物だけ断る）。
export function detectImageType(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(4, 8) === 'ftyp') {
    // ftyp は動画（isom / mp42 等）にも使われるので、画像の brand だけを画像とみなす
    const brand = ascii(8, 12)
    if (AVIF_BRANDS.includes(brand)) return 'image/avif'
    if (HEIF_BRANDS.includes(brand)) return 'image/heic'
  }
  return null
}

const AVIF_BRANDS = ['avif', 'avis']
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

// 保存する content-type を決める。中身が申告した種類として成り立たなければ null（→ 415）。
export function storedContentType(rule: UploadRule, declared: string, bytes: Uint8Array): string | null {
  if (rule.storeAs) return rule.storeAs // LP 本文（HTML）は中身を見ない
  if (declared === 'video/mp4') return String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp' ? declared : null
  if (declared.startsWith('image/')) {
    const actual = detectImageType(bytes)
    if (!actual) return null
    // HEIC / HEIF / AVIF は同じ ftyp 形式なので、申告がそのどれかなら申告どおりにする
    return actual === 'image/heic' && ['image/heic', 'image/heif', 'image/avif'].includes(declared) ? declared : actual
  }
  return null
}

// GET /api/image で返してよいか。保存済み LP の生 HTML（lp/*.html）は出さない。
// 一覧 lp/index.json は在庫ページが読むので残す。
export function isPublicObjectKey(key: string): boolean {
  if (key.startsWith('lp/')) return key === 'lp/index.json'
  return true
}

export const SLUG_PATTERN = new RegExp(`^${SLUG}$`)
