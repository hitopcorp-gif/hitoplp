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
