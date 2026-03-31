import type { CarBasicInfo, ColorTemplate, GeneratedContent, Situation } from '@/types'
import { SITUATION_CONFIG } from '@/types'

const SITUATION_PROMPTS: Record<Situation, string> = {
  city: '都市の風景の中での存在感。信号待ち、合流、駐車場。周囲の視線。',
  coast: '風、光、水平線。窓を開けた空気の変化。ゆったりとした時間。',
  travel: '距離と時間の感覚。景色の変化。目的地は書かない。過程を書く。荷物、同乗者の快適性。',
  night: '光と影のコントラスト。街灯、ヘッドライト、ネオン。音は低く、空気は冷たい。',
  speed: '加速、ブレーキング、コーナリング。Gの描写。排気音の変化。法定速度内。',
  possession: 'ガレージ、ディテール、歴史。素材感。年月の味わい。眺める時間の価値。',
}

export async function generateContent({
  basicInfo,
  situation,
  colorTemplate,
}: {
  basicInfo: CarBasicInfo
  situation: Situation
  colorTemplate: ColorTemplate
}): Promise<GeneratedContent> {
  const situationConfig = SITUATION_CONFIG[situation]
  const situationPrompt = SITUATION_PROMPTS[situation]

  const userPrompt = `
【車両情報】
車名: ${basicInfo.name}
年式: ${basicInfo.year}年
走行距離: ${basicInfo.mileage}
価格: ${basicInfo.isAsk ? 'ASK（要問合せ）' : basicInfo.price}
車検: ${basicInfo.shaken}
ミッション: ${basicInfo.transmission}
駆動方式: ${basicInfo.drive}
エンジン: ${basicInfo.engine}
${basicInfo.maxPower ? `最高出力: ${basicInfo.maxPower}` : ''}
${basicInfo.maxTorque ? `最大トルク: ${basicInfo.maxTorque}` : ''}
修復歴: ${basicInfo.hasRepairHistory ? 'あり' : 'なし'}
HI-TOPカスタム内容: ${basicInfo.customContent}
${basicInfo.tagline ? `一行コピー（使用してください）: ${basicInfo.tagline}` : ''}

【シチュエーション】
${situationConfig.label} — ${situationPrompt}

【カラーテンプレート】
${colorTemplate}

以下のJSON形式で出力してください（他のテキスト不要）：
{
  "subtitle": "（15〜25文字。車の本質を詩的に）",
  "englishCopy": "（2〜4 words）",
  "section1": {
    "title": "（英語1word）",
    "subtitle": "（日本語10〜20文字）",
    "story": "（250〜350文字。五感描写、体験ベース）"
  },
  "section2": {
    "title": "（英語1word）",
    "subtitle": "（日本語10〜20文字。スペックの数字を自然に）",
    "story": "（250〜350文字）"
  },
  "section3": {
    "title": "（英語1word）",
    "subtitle": "（日本語10〜20文字）",
    "details": [
      {"caption": "（10〜20文字）", "description": "（60〜80文字）"},
      {"caption": "（10〜20文字）", "description": "（60〜80文字）"},
      {"caption": "（10〜20文字）", "description": "（60〜80文字）"},
      {"caption": "（10〜20文字）", "description": "（60〜80文字）"}
    ]
  },
  "pullQuote1": "（20〜40文字の印象的な一文）",
  "pullQuote2": "（20〜40文字、任意）",
  "igCaption": "（Instagram投稿文。300文字以内。改行OK）",
  "igHashtags": "（ハッシュタグ10〜15個）",
  "tweetText": "（140文字以内のツイート文）"
}
`

  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const resp = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(err || 'AI生成に失敗しました')
  }

  const data = await resp.json()
  return data as GeneratedContent
}
