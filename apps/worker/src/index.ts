import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'

type Env = {
  ANTHROPIC_API_KEY: string
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
  type Entry = { slug: string; name: string; nameJa: string; year: number; price: string; heroUrl: string }
  const entries: Entry[] = obj ? await obj.json() : []

  const cards = entries.map(e => `
    <a class="card" href="/${e.slug}">
      <div class="card-img">
        ${e.heroUrl ? `<img src="${e.heroUrl}" alt="${e.name}" loading="lazy">` : '<div class="card-img-placeholder"></div>'}
        <div class="card-img-grad"></div>
      </div>
      <div class="card-body">
        <p class="card-year sans">${e.year}</p>
        <h2 class="card-name en">${e.name}</h2>
        ${e.nameJa ? `<p class="card-name-ja">${e.nameJa}</p>` : ''}
        <p class="card-price en">${e.price}</p>
      </div>
    </a>`).join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HI-TOP CORPORATION — Selection</title>
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
.nav-brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.nav-shield{width:40px;height:40px;object-fit:contain}
.nav-text{display:flex;flex-direction:column;gap:2px}
.nav-logo{font-family:'Satoshi',sans-serif;font-size:12px;letter-spacing:0.18em;color:#fff;text-transform:uppercase;line-height:1}
.nav-logo-ja{font-family:'Noto Sans JP',sans-serif;font-size:7px;letter-spacing:0.2em;color:rgba(255,255,255,0.3);line-height:1}
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

/* FOOTER */
footer{border-top:1px solid rgba(255,255,255,0.05);padding:40px clamp(24px,5vw,80px);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
footer p{font-family:'Satoshi',sans-serif;font-weight:300;font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.15em}

@media(max-width:640px){
  .grid{grid-template-columns:1fr}
  footer{flex-direction:column;text-align:center}
}
</style>
</head>
<body>
<nav class="nav">
  <a href="https://hi-top.net" class="nav-brand">
    <img src="https://hitoplp-api.hitopcorp.workers.dev/api/image/assets/logo.png" class="nav-shield" alt="HI-TOP">
    <div class="nav-text">
      <span class="nav-logo en">HI-TOP</span>
      <span class="nav-logo-ja sans">ハイトップコーポレーション</span>
    </div>
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
  headers.set('cache-control', 'public, max-age=300, stale-while-revalidate=3600')

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
  headers.set('cache-control', 'public, max-age=31536000')

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

// ── AI記事生成 ──
app.post('/api/generate', async (c) => {
  const { prompt, carName } = await c.req.json<{ prompt: string; carName?: string }>()
  if (!prompt) return c.json({ error: 'prompt required' }, 400)

  // Wikipedia から背景知識を取得
  const wikiContext = carName ? await fetchWikiContext(carName) : ''

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

  const SYSTEM_PROMPT = `あなたはLEONやCar Magazineに寄稿する自動車ジャーナリスト。
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

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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

export default app
