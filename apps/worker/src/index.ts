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

// ── AI記事生成 ──
app.post('/api/generate', async (c) => {
  const { prompt } = await c.req.json<{ prompt: string }>()
  if (!prompt) return c.json({ error: 'prompt required' }, 400)

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

  const SYSTEM_PROMPT = `あなたはHI-TOP CORPORATIONの専属コピーライター。
福岡県北九州市の高級輸入車専門店HI-TOPが手がけた、この1台だけの車を紹介する。

【絶対に守るルール】
メーカーの歴史・ブランドの物語は書かない。
この個体のカスタム内容・スペック・状態について書く。
読んだ人が「この車を見に行きたい」と感じる文章を書く。

【HI-TOPについて】
哲学：「My Passion is One Code」
北九州市のショールームで、センスとクオリティにこだわり抜いた1台だけを売る。
HI-TOPカスタムの内容は文章の核心として必ず盛り込む。

【スタイルルール】
- 一文は短く。最長でも50文字
- 形容詞は1センテンスに1つまで
- 体言止めを効果的に使う
- 「あなた」は使わない
- 乗った時の体験を五感で描写する（視覚・音・振動・匂い・温度）
- スペックの数字は文中に自然に溶け込ませる
  ×「最高出力300ps」→ ○「3リッター直6が静かに唸りを上げる」
  ×「走行距離1.2万km」→ ○「1.2万kmという、まだ序章の距離」
- カスタム内容は必ず具体的に言及する
  ○「サテングレーのラッピングは、光の角度で表情が変わる」
  ○「Vossen 22インチが、このボディバランスを完成させた」
- 修復歴なしなら「修復歴のない一台」として自信を持って書く

【禁止ワード】
圧倒的、至高、官能的、ラグジュアリーな、プレミアムな、エクスクルーシブ、
極上、贅沢、珠玉、唯一無二、最高峰、ワンランク上、大人の〇〇、
「まさに」「まるで」「〇〇と言っても過言ではない」「特別な体験」「非日常」
ランドローバーの歴史・BMWの哲学・ポルシェの伝説など（メーカー物語一切禁止）

必ずJSON形式のみで回答。前置き・後書き・説明文は一切不要。`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
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
