import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'
import { generateLpHtml } from './lp-generator'
import { SITUATION_DEFAULT_COLOR } from './types'
import type {
  Vehicle,
  CarBasicInfo,
  CarPhoto,
  ColorTemplate,
  GeneratedContent,
  Situation,
} from './types'

type Env = {
  ANTHROPIC_API_KEY: string
  ELEVENLABS_API_KEY: string
  ELEVENLABS_VOICE_ID: string
  ADMIN_API_KEY: string
  ALLOWED_ORIGIN: string
  IMAGES: R2Bucket
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  return cors({ origin: '*', allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'] })(c, next)
})

app.get('/health', (c) => c.json({ ok: true }))

// ── LP一覧ギャラリーページ ──
app.get('/', async (c) => {
  const obj = await c.env.IMAGES.get('lp/index.json')
  type Entry = { slug: string; name: string; nameJa: string; year: number; price: string; heroUrl: string; status?: 'published' | 'sold' }
  const entries: Entry[] = obj ? await obj.json() : []

  // Sort: published first, then sold
  const sorted = entries.sort((a, b) => {
    if (a.status === 'sold' && b.status !== 'sold') return 1
    if (a.status !== 'sold' && b.status === 'sold') return -1
    return 0 // preserve existing order within same status
  })

  const cards = sorted.map(e => {
    const isSold = e.status === 'sold'
    return `
    <a class="card${isSold ? ' card-sold' : ''}" href="/${e.slug}">
      <div class="card-img">
        ${e.heroUrl ? `<img src="${e.heroUrl}" alt="${e.name}" loading="lazy">` : '<div class="card-img-placeholder"></div>'}
        <div class="card-img-grad"></div>
        ${isSold ? '<div class="card-sold-badge sans">SOLD</div>' : ''}
      </div>
      <div class="card-body">
        <p class="card-year sans">${e.year}</p>
        <h2 class="card-name en">${e.name}</h2>
        ${e.nameJa ? `<p class="card-name-ja">${e.nameJa}</p>` : ''}
        <p class="card-price en">${isSold ? 'SOLD' : e.price}</p>
      </div>
    </a>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HI-TOP JOURNAL — Selection</title>
<meta name="description" content="HI-TOP CORPORATIONが選び抜いた一台。福岡・北九州。">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@700,400,300&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500&family=Cormorant+Garamond:ital,wght@1,300&family=Noto+Sans+JP:wght@300;400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#0A0A0A;color:#F5F5F0;font-family:'Shippori Mincho B1',serif;font-weight:300;min-height:100vh}
a{text-decoration:none;color:inherit}
img{display:block;width:100%;height:100%;object-fit:cover}
.sans{font-family:'Noto Sans JP',sans-serif}

/* NAV */
.nav{padding:18px clamp(24px,5vw,80px);display:flex;justify-content:space-between;align-items:center}
.nav-brand{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none}
.nav-shield{width:44px;height:44px;object-fit:contain}
.nav-logo{font-family:'Satoshi',sans-serif;font-size:9px;font-weight:400;letter-spacing:0.28em;color:rgba(255,255,255,0.7);text-transform:uppercase;line-height:1}
.nav-tag{font-family:'Noto Sans JP',sans-serif;font-size:8px;letter-spacing:0.45em;color:rgba(255,255,255,0.25);text-transform:uppercase}

/* HERO */
.hero{padding:clamp(80px,12vh,140px) clamp(24px,5vw,80px) clamp(40px,6vh,80px)}
.hero-label{font-family:'Noto Sans JP',sans-serif;font-size:8px;letter-spacing:0.65em;color:#C4A265;margin-bottom:24px}
.hero-title{font-family:'Satoshi',sans-serif;font-weight:700;letter-spacing:-0.02em;font-size:clamp(36px,5.5vw,72px);line-height:1.0;color:#fff;margin-bottom:20px}
.hero-sub{font-family:'Shippori Mincho B1',serif;font-weight:200;font-size:clamp(13px,1.1vw,15px);color:rgba(245,245,240,0.35);letter-spacing:0.08em}

/* GRID */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(280px,30vw,420px),1fr));gap:clamp(16px,2.5vw,40px);padding:0 clamp(24px,5vw,80px) 120px}
.empty{padding:80px clamp(24px,5vw,80px);font-family:'Noto Sans JP',sans-serif;font-size:12px;color:rgba(255,255,255,0.2);letter-spacing:0.2em}

/* CARD */
.card{display:block;cursor:pointer;transition:opacity 0.3s}
.card:hover{opacity:0.85}
.card-img{position:relative;overflow:hidden;aspect-ratio:16/10}
.card-img img{transition:transform 8s ease}
.card:hover .card-img img{transform:scale(1.04)}
.card-img-placeholder{width:100%;height:100%;background:#111}
.card-img-grad{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.4))}
.card-body{padding:20px 0 0}
.card-year{font-family:'Noto Sans JP',sans-serif;font-size:9px;letter-spacing:0.4em;color:#C4A265;margin-bottom:8px}
.card-name{font-family:'Satoshi',sans-serif;font-weight:700;letter-spacing:-0.02em;font-size:clamp(18px,2vw,26px);line-height:1.1;color:#F5F5F0;margin-bottom:6px}
.card-name-ja{font-family:'Shippori Mincho B1',serif;font-weight:200;font-size:11px;color:rgba(245,245,240,0.3);letter-spacing:0.2em;margin-bottom:10px}
.card-price{font-family:'Satoshi',sans-serif;font-weight:300;font-size:clamp(14px,1.5vw,18px);color:rgba(245,245,240,0.55)}
.card-sold{opacity:0.6}
.card-sold:hover{opacity:0.5}
.card-sold-badge{position:absolute;top:12px;right:12px;background:rgba(10,10,10,0.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);padding:4px 14px;font-size:10px;letter-spacing:0.25em;color:rgba(255,255,255,0.6);z-index:2}

/* FOOTER */
footer{border-top:1px solid rgba(255,255,255,0.05);padding:40px clamp(24px,5vw,80px);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
footer p{font-family:'Satoshi',sans-serif;font-weight:300;font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.15em}

@media(max-width:640px){
  .grid{grid-template-columns:1fr}
  footer{flex-direction:column;text-align:center}
  .nav-shield{width:32px;height:32px}
  .nav-logo{font-size:7px;letter-spacing:0.22em}
  .nav-brand{gap:4px}
}
</style>
</head>
<body>
<nav class="nav">
  <a href="https://hi-top.net" class="nav-brand">
    <img src="https://hitoplp-api.hitopcorp.workers.dev/api/image/assets/logo.png" class="nav-shield" alt="HI-TOP">
    <span class="nav-logo">HI-TOP JOURNAL</span>
  </a>
  <span class="nav-tag sans">Selection</span>
</nav>
<div class="hero">
  <p class="hero-label sans">Current Selection</p>
  <h1 class="hero-title en">One Car.<br>One Story.</h1>
  <p class="hero-sub">HI-TOP CORPORATIONが選び抜いた、今この一台。</p>
</div>
${entries.length > 0
  ? `<div class="grid">${cards}</div>`
  : '<p class="empty">現在公開中の車両はありません。</p>'}
<footer>
  <a href="https://hi-top.net" style="text-decoration:none;"><p class="en">HI-TOP CORPORATION</p></a>
  <p class="sans">福岡県北九州市 ｜ <a href="https://hi-top.net" style="color:inherit;border-bottom:1px solid rgba(255,255,255,0.15);">hi-top.net</a></p>
</footer>
</body>
</html>`

  return c.html(html)
})

// ── LP配信（R2から静的HTML） ──
app.get('/:slug{[a-z0-9-]+}', async (c) => {
  const slug = c.req.param('slug')
  const obj = await c.env.IMAGES.get(`lp/${slug}.html`)
  if (!obj) return c.notFound()

  const headers = new Headers()
  headers.set('content-type', 'text/html; charset=utf-8')
  headers.set('cache-control', 'no-cache, must-revalidate')

  return new Response(obj.body, { headers })
})

// ── 画像アップロード（直接R2へ）──
app.put('/api/upload/:key{.+}', async (c) => {
  const key = c.req.param('key')
  const contentType = c.req.header('content-type') ?? 'image/jpeg'
  const body = await c.req.arrayBuffer()

  await c.env.IMAGES.put(key, body, {
    httpMetadata: { contentType },
  })

  return c.json({ key, url: `/api/image/${key}` })
})

// ── 画像取得 ──
app.get('/api/image/:key{.+}', async (c) => {
  const key = c.req.param('key')
  const obj = await c.env.IMAGES.get(key)
  if (!obj) return c.notFound()

  const headers = new Headers()
  obj.writeHttpMetadata(headers)

  // Ensure content-type is always set (Mac Safari rejects images without it)
  if (!headers.has('content-type')) {
    const ext = key.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
      heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
      mp3: 'audio/mpeg', mp4: 'video/mp4', json: 'application/json', html: 'text/html',
    }
    headers.set('content-type', mimeMap[ext ?? ''] ?? 'image/jpeg')
  }

  // index.json changes frequently — don't cache it; images are immutable — cache forever
  headers.set('cache-control', key === 'lp/index.json'
    ? 'no-cache, no-store, must-revalidate'
    : 'public, max-age=31536000')

  return new Response(obj.body, { headers })
})

// ── カーセンサー等URLから車両情報スクレイプ ──
app.post('/api/scrape', async (c) => {
  const { url } = await c.req.json<{ url: string }>()
  if (!url) return c.json({ error: 'url required' }, 400)

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })
    if (!res.ok) return c.json({ error: `fetch failed: ${res.status}` }, 400)
    html = await res.text()
  } catch (e) {
    return c.json({ error: 'URL取得に失敗しました' }, 400)
  }

  // HTMLタグ除去・圧縮
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 8000)

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `以下の中古車販売ページのテキストから車両情報を抽出してください。
必ずJSON形式のみで返してください。前置き・説明文は不要。

${text}

以下のJSON形式で返してください：
{
  "name": "車名フルネーム（英語表記、例: Land Rover Defender 110 X-Dynamic HSE）",
  "year": 年式（数値、西暦）,
  "mileage": "走行距離（例: 3.0万km）",
  "price": "価格（例: ¥9,770,000）。ASKまたは価格応相談の場合はnull",
  "isAsk": 価格がASK/応相談ならtrue,
  "shaken": "車検（例: 2026年10月）",
  "transmission": "AT / MT / CVT / DCT / other のいずれか",
  "drive": "駆動方式（例: AWD）",
  "engine": "エンジン（例: 2.0L 直列4気筒 ターボ）",
  "maxPower": "最高出力（例: 300ps / 5,500rpm）または null",
  "maxTorque": "最大トルク（例: 400Nm / 2,000rpm）または null",
  "hasRepairHistory": 修復歴ありならtrue、なしならfalse
}`,
      }],
    })

    const text2 = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text2.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return c.json({ error: 'parse failed' }, 500)

    return c.json(JSON.parse(jsonMatch[0]))
  } catch (e) {
    console.error('Scrape error:', e)
    return c.json({ error: 'AI抽出に失敗しました' }, 500)
  }
})

// ── LP記事生成のシステムプロンプト（/api/generate と /api/admin/lp/create で共有）──
const LP_SYSTEM_PROMPT = `あなたはLEONやCar Magazineに寄稿する自動車ジャーナリスト。
HI-TOP CORPORATIONが福岡・北九州で手がけた1台について記事を書く。
哲学：「My Passion is One Code」——1台だけを選び抜く店だ。

【文章スタイル：LEONジャーナリスト文体】
「実は〜」「知られていないのが〜」「〜という事実がある」「意外なことに〜」
——読者が「へえ、そうだったのか」と膝を打つ事実と豆知識を文章の核に置く。

技術的な事実 → 読者の驚き → この個体への着地、という流れで書く。

【文章の例】
「新型Defenderがアルミモノコックを採用した時、旧来のオフローダーファンは
 眉をひそめた。だが実は、このボディこそが全てを変えた。錆びない。軽い。
 剛性の取り方が根本から違う。そのアルミの地肌に纏わせたサテングレーは、
 従来の塗装では出せない深みを出す。光の角度で表情を変える。それがHI-TOPの選択だ。」

「ランドローバーの開発チームが2リッター直4をDefenderに積んだ理由を、
 批判した人が多かった。だが低回転域から500Nm近いトルクを絞り出すこの設計は、
 実は都市部での扱いやすさと高速の余裕を同時に解決した答えだった。
 3万kmという距離は、まだこのエンジンが本来のキャラクターを見せていない時期だ。」

【ルール】
- モデル固有の技術・歴史・開発背景の豆知識を必ず盛り込む
- 「実は」「意外にも」的な"知識の驚き"を1セクションに最低1つ入れる
- 豆知識はHI-TOPカスタムまたはこの個体に必ず着地させる
- 一文は短く（最長50字）。体言止め多用
- 五感描写（視覚・音・振動・温度）を入れる
- スペック数値は文中に自然に溶け込ませる
- 「あなた」不使用

【禁止】
圧倒的、至高、官能的、ラグジュアリーな、プレミアムな、極上、贅沢、珠玉、
唯一無二、最高峰、「まさに」「まるで」「特別な体験」「非日常」

必ずJSON形式のみで回答。前置き・後書き・説明文は一切不要。`

// ── シチュエーション別プロンプト（apps/web/src/lib/ai.ts のミラー）──
const SITUATION_PROMPTS: Record<Situation, string> = {
  city: '都市の風景の中での存在感。信号待ち、合流、駐車場。周囲の視線。',
  coast: '風、光、水平線。窓を開けた空気の変化。ゆったりとした時間。',
  travel: '距離と時間の感覚。景色の変化。目的地は書かない。過程を書く。荷物、同乗者の快適性。',
  night: '光と影のコントラスト。街灯、ヘッドライト、ネオン。音は低く、空気は冷たい。',
  speed: '加速、ブレーキング、コーナリング。Gの描写。排気音の変化。法定速度内。',
  possession: 'ガレージ、ディテール、歴史。素材感。年月の味わい。眺める時間の価値。',
}

const SITUATION_LABELS: Record<Situation, string> = {
  city: '街を走る',
  coast: '海岸線を流す',
  travel: '旅に出る',
  night: '夜を纏う',
  speed: '速さを味わう',
  possession: '所有する歓び',
}

// ── basicInfo + situation + colorTemplate から /api/generate に渡す prompt を組み立てる
//    （apps/web/src/lib/ai.ts の generateContent と同等のテンプレートを Worker 内で再現）──
function buildLpUserPrompt(
  basicInfo: CarBasicInfo,
  situation: Situation,
  colorTemplate: ColorTemplate,
): string {
  return `
━━ 車両データ ━━
車名: ${basicInfo.name}
年式: ${basicInfo.year}年
走行距離: ${basicInfo.mileage}
修復歴: ${basicInfo.hasRepairHistory ? 'あり' : 'なし'}
車検: ${basicInfo.shaken}
ミッション: ${basicInfo.transmission}
駆動方式: ${basicInfo.drive}
エンジン: ${basicInfo.engine}${basicInfo.maxPower ? `\n最高出力: ${basicInfo.maxPower}` : ''}${basicInfo.maxTorque ? `\n最大トルク: ${basicInfo.maxTorque}` : ''}
価格: ${basicInfo.isAsk ? 'ASK' : basicInfo.price}

━━ HI-TOPカスタム内容 ━━
${basicInfo.customContent}

━━ シチュエーション ━━
${SITUATION_LABELS[situation]}：${SITUATION_PROMPTS[situation]}
${basicInfo.tagline ? `\n一行コピー指定: ${basicInfo.tagline}` : ''}
カラーテンプレート: ${colorTemplate}

以下のJSON形式で出力してください（他のテキスト不要）：
{
  "nameJa": "（車名の日本語表記。例: ランドローバー ディフェンダー 110 / ポルシェ 911 カレラ）",
  "subtitle": "（15〜25文字。車の本質を詩的に）",
  "englishCopy": "（2〜4 words）",
  "section1": {
    "title": "（4〜10文字。視覚的・存在感）",
    "subtitle": "（5〜10文字。英語可）",
    "story": "（150〜200文字。シチュエーション + LEON文体 + 豆知識）"
  },
  "section2": {
    "title": "（4〜10文字。素材感・職人技・所有感）",
    "subtitle": "（5〜10文字。英語可）",
    "story": "（150〜200文字。素材・歴史・LEON文体 + 豆知識）"
  },
  "section3": {
    "title": "（4〜10文字。ディテール）",
    "subtitle": "（5〜10文字。英語可）",
    "details": [
      { "caption": "（10文字以内）", "description": "（25〜40文字。豆知識交じり）" },
      { "caption": "（10文字以内）", "description": "（25〜40文字。豆知識交じり）" },
      { "caption": "（10文字以内）", "description": "（25〜40文字。豆知識交じり）" },
      { "caption": "（10文字以内）", "description": "（25〜40文字。豆知識交じり）" }
    ]
  },
  "pullQuote1": "（30〜50文字。LEON調キャッチ）",
  "pullQuote2": "（30〜50文字。閉じ。任意）",
  "igCaption": "（120文字以内。Instagram用）",
  "igHashtags": "（5〜8タグ、半角スペース区切り。#から始まる）",
  "tweetText": "（120文字以内。Twitter用）",
  "narrationText": "（150〜180文字。音声ナレーション台本。一文を短く、間を意識）",
  "reelNarration": "（80〜120文字。15秒リール用ナレーション。冒頭フック・中盤特徴・末尾ブランド着地）",
  "seo": {
    "metaDescription": "（120〜140文字。検索表示用）",
    "keywords": "（5〜8語、カンマ区切り）",
    "ogDescription": "（80〜100文字。SNS共有時表示）"
  }
}
`.trim()
}

// ── Anthropic を呼んで GeneratedContent を返す共通関数 ──
async function generateLpContent(
  apiKey: string,
  basicInfo: CarBasicInfo,
  situation: Situation,
  colorTemplate: ColorTemplate,
): Promise<GeneratedContent> {
  const wikiContext = await fetchWikiContext(basicInfo.name)
  const userPrompt = buildLpUserPrompt(basicInfo, situation, colorTemplate)

  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: LP_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: wikiContext
        ? `【このモデルの参考知識（Wikipedia）】\n${wikiContext}\n\n━━━━━━━━━━\n\n${userPrompt}`
        : userPrompt,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSON not found in Anthropic response')

  return JSON.parse(jsonMatch[0]) as GeneratedContent
}

// ── Wikipedia知識取得ヘルパー ──
async function fetchWikiContext(carName: string): Promise<string> {
  try {
    // 日本語Wikipediaで検索
    const searchUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(carName)}&srlimit=1&format=json&origin=*`
    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json() as { query?: { search?: Array<{ title: string }> } }
    const title = searchData.query?.search?.[0]?.title
    if (!title) throw new Error('not found')

    const extractUrl = `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&format=json&origin=*`
    const extractRes = await fetch(extractUrl)
    const extractData = await extractRes.json() as { query?: { pages?: Record<string, { extract?: string }> } }
    const pages = extractData.query?.pages ?? {}
    const extract = Object.values(pages)[0]?.extract ?? ''
    return extract.slice(0, 1200)
  } catch {
    return ''
  }
}

// ── TTS音声生成（ElevenLabs Eleven v3）──
app.post('/api/tts', async (c) => {
  const { text, slug } = await c.req.json<{ text: string; slug: string }>()
  if (!text || !slug) return c.json({ error: 'text and slug required' }, 400)
  if (!c.env.ELEVENLABS_API_KEY || !c.env.ELEVENLABS_VOICE_ID) {
    return c.json({ error: 'ElevenLabs not configured' }, 500)
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${c.env.ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': c.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_v3',
          language_code: 'ja',
          voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.4 },
        }),
      }
    )
    if (!response.ok) {
      const err = await response.text()
      console.error('ElevenLabs error:', err)
      return c.json({ error: `ElevenLabs API error: ${response.status}` }, 502)
    }

    const audioBuffer = await response.arrayBuffer()
    const key = `audio/${slug}.mp3`
    await c.env.IMAGES.put(key, audioBuffer, {
      httpMetadata: { contentType: 'audio/mpeg' },
    })

    const audioUrl = `https://hitoplp-api.hitopcorp.workers.dev/api/image/${key}`
    return c.json({ audioUrl })
  } catch (e) {
    console.error('TTS error:', e)
    return c.json({ error: 'TTS generation failed' }, 500)
  }
})

// ── AI記事生成（既存：Webアプリから利用、prebuilt prompt）──
app.post('/api/generate', async (c) => {
  const { prompt, carName } = await c.req.json<{ prompt: string; carName?: string }>()
  if (!prompt) return c.json({ error: 'prompt required' }, 400)

  const wikiContext = carName ? await fetchWikiContext(carName) : ''
  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: LP_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: wikiContext
          ? `【このモデルの参考知識（Wikipedia）】\n${wikiContext}\n\n━━━━━━━━━━\n\n${prompt}`
          : prompt,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found in response')

    const parsed = JSON.parse(jsonMatch[0])
    return c.json(parsed)
  } catch (e) {
    console.error('Generation error:', e)
    return c.json({ error: 'AI generation failed' }, 500)
  }
})

// ── Admin API: API キー認証ミドルウェア ──
//    `X-Admin-API-Key` ヘッダで Cloudflare Workers Secret と照合。
//    ADMIN_API_KEY が未設定の Worker では常に 503（誤って認証バイパスしないため）。
async function requireAdmin(c: any, next: () => Promise<void>) {
  const expected = c.env.ADMIN_API_KEY as string | undefined
  if (!expected) {
    return c.json({ error: 'Admin API not configured (ADMIN_API_KEY secret missing)' }, 503)
  }
  const provided = c.req.header('X-Admin-API-Key')
  if (!provided || provided !== expected) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}

// ── Admin API: 車両LPの自動生成（外部スキル `/lp-publish` 用エンドポイント）──
//    入力: vehicleId, slug, basicInfo, situation, colorTemplate, photos (配列)
//    動作:
//      1. Anthropic で LEON 文体 content 生成
//      2. lp-generator.ts で HTML 生成
//      3. R2 に `lp/{slug}.html` として配置（Cache-Control: no-cache）
//      4. **draft 扱い**: `lp/index.json` には追加しない → ギャラリー (/) に出ない
//    返却: { slug, previewUrl, status: 'draft', generatedContent }
//    認証: X-Admin-API-Key ヘッダ必須
app.post('/api/admin/lp/create', requireAdmin, async (c) => {
  type AdminLpCreateBody = {
    vehicleId: string
    slug: string
    basicInfo: CarBasicInfo
    situation?: Situation
    colorTemplate?: ColorTemplate
    photos: CarPhoto[]
    detailPhotoUrls?: [string, string, string, string]
    audioUrl?: string
    overrideContent?: GeneratedContent  // 既に生成済みの content を再利用したい場合
  }

  let body: AdminLpCreateBody
  try {
    body = await c.req.json<AdminLpCreateBody>()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  // 入力バリデーション
  if (!body.vehicleId) return c.json({ error: 'vehicleId required' }, 400)
  if (!body.slug || !/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json({ error: 'slug required, format: [a-z0-9-]+' }, 400)
  }
  if (!body.basicInfo?.name) return c.json({ error: 'basicInfo.name required' }, 400)
  if (!body.photos || body.photos.length === 0) {
    return c.json({ error: 'photos required (at least 1)' }, 400)
  }

  const situation: Situation = body.situation ?? 'possession'
  const colorTemplate: ColorTemplate =
    body.colorTemplate ?? SITUATION_DEFAULT_COLOR[situation]

  try {
    // 1. content 生成（既存ある場合はスキップ）
    const content =
      body.overrideContent ??
      (await generateLpContent(c.env.ANTHROPIC_API_KEY, body.basicInfo, situation, colorTemplate))

    // 2. Vehicle オブジェクトを構築（R2書込前のスナップショット）
    const now = new Date()
    const vehicle: Vehicle = {
      id: body.vehicleId,
      slug: body.slug,
      basicInfo: body.basicInfo,
      situation,
      colorTemplate,
      photos: body.photos,
      generatedContent: content,
      detailPhotoUrls: body.detailPhotoUrls,
      audioUrl: body.audioUrl,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }

    // 3. HTML 生成
    const html = generateLpHtml(vehicle, content, false)

    // 4. R2 にdraft として配置（index.json は更新しない＝公開しない）
    await c.env.IMAGES.put(`lp/${body.slug}.html`, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    })

    // 5. 結果返却
    return c.json({
      slug: body.slug,
      vehicleId: body.vehicleId,
      previewUrl: `https://hitoplp-api.hitopcorp.workers.dev/${body.slug}`,
      status: 'draft',
      situation,
      colorTemplate,
      generatedContent: content,
    })
  } catch (e: any) {
    console.error('Admin LP create error:', e)
    return c.json({ error: 'LP creation failed', detail: String(e?.message ?? e) }, 500)
  }
})

export default app
