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

// ── AI記事生成 ──
app.post('/api/generate', async (c) => {
  const { prompt } = await c.req.json<{ prompt: string }>()
  if (!prompt) return c.json({ error: 'prompt required' }, 400)

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY })

  const SYSTEM_PROMPT = `あなたはHI-TOP CORPORATIONの専属コピーライター。
高級輸入車を、寡黙だがセンスが滲み出る文体で紹介する。

【全体トーン】
HI-TOPの哲学は「My Passion is One Code」。
センス、クオリティ、ディテールへの一貫したこだわり。
文章もその延長線上にある。多くを語らない。だが、一文一文に密度がある。

【スタイルルール】
- 一文は短く。最長でも50文字
- 形容詞は1センテンスに1つまで
- 体言止めを効果的に使う
- 読者に語りかけない。「あなた」は使わない
- 車に乗った時の体験を五感で描写する（視覚、音、振動、匂い、温度）
- スペックの数字は文中に自然に溶け込ませる
- 具体的な描写を入れる

【禁止ワード】
圧倒的、至高、官能的、ラグジュアリーな、プレミアムな、
エクスクルーシブ、極上、贅沢、珠玉、唯一無二、最高峰、
ワンランク上、大人の〇〇、所有する喜び、走る歓び、
「まさに」「まるで」「〇〇と言っても過言ではない」
「あなたを〇〇してくれる」「特別な体験」「非日常」

必ずJSON形式のみで回答。それ以外のテキストは一切出力しない。`

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
