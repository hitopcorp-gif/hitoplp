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
${situationConfig.label}：${situationPrompt}
${basicInfo.tagline ? `\n一行コピー指定: ${basicInfo.tagline}` : ''}
カラーテンプレート: ${colorTemplate}

以下のJSON形式で出力してください（他のテキスト不要）：
{
  "nameJa": "（車名の日本語表記。例: ランドローバー ディフェンダー 110 / ポルシェ 911 カレラ）",
  "subtitle": "（15〜25文字。車の本質を詩的に）",
  "englishCopy": "（2〜4 words）",
  "section1": {
    "title": "（英語1word）",
    "subtitle": "（日本語10〜20文字）",
    "story": "（300〜400文字。このモデル固有の設計哲学・エンジニアリングの豆知識・歴史的背景を入れつつ、HI-TOPカスタムと五感描写で結びつける）"
  },
  "section2": {
    "title": "（英語1word）",
    "subtitle": "（日本語10〜20文字）",
    "story": "（300〜400文字。走り・機能・スペックの話をモデル固有の特性と絡めて書く）"
  },
  "section3": {
    "title": "（英語1word）",
    "subtitle": "（日本語10〜20文字）",
    "details": [
      {"caption": "（10〜20文字）", "description": "（70〜90文字。カスタムの技術的な背景や面白い事実を含める）"},
      {"caption": "（10〜20文字）", "description": "（70〜90文字）"},
      {"caption": "（10〜20文字）", "description": "（70〜90文字）"},
      {"caption": "（10〜20文字）", "description": "（70〜90文字）"}
    ]
  },
  "pullQuote1": "（20〜40文字。このモデルの本質を突いた、思わず膝を打つ一文）",
  "pullQuote2": "（20〜40文字、任意）",
  "igCaption": "（Instagram投稿文。300文字以内。改行OK）",
  "igHashtags": "（ハッシュタグ10〜15個）",
  "tweetText": "（140文字以内のツイート文）",
  "seo": {
    "metaDescription": "（60〜120文字。検索結果に表示される説明文。車名・年式・特徴を自然に含める。HI-TOP CORPORATIONの名前も入れる）",
    "keywords": "（カンマ区切り10〜15個。車名、ブランド、車種カテゴリ、年式、特徴的なスペック、HI-TOP等）",
    "ogDescription": "（80〜120文字。SNSシェア時の説明文。感性に訴える表現で。subtitleより詳しく）"
  },
  "narrationText": "（音声読み上げ用テキスト。記事全体を1つの連続したナレーションとして構成する。【重要：数字の読み方】音声合成が正しく読めるよう、数字はすべて日本語の読みで書くこと。数字はカタカナで音を書くこと。例: 2.0→ニーテンゼロ、V8→ブイハチ、4WD→ヨンダブリューディー、300ps→サンビャクピーエス、6速→ロクソク、1960年→センキュウヒャクロクジュウネン、110→ヒャクジュウ。アルファベット略語もカタカナで書く（AMG→エーエムジー、GT→ジーティー）。固有名詞の読み：HI-TOP→ハイトップ、HI-TOP JOURNAL→ハイトップジャーナル、HI-TOP CORPORATION→ハイトップコーポレーション。以下のElevenLabs v3オーディオタグを適切に挿入すること：[calm]落ち着いたトーン（本文ベース）、[whispers]囁き（五感の繊細な描写）、[confident]自信のあるトーン（プルクォート・決め台詞）、[slow pace]ゆっくり（冒頭・重要フレーズ）、[pause Xs]間（セクション間に1〜2秒）。冒頭は[deep, authoritative]＋[pause 1.5s]で車名から始め、セクション間に[pause 1.5s]を入れ、プルクォートは[confident]で読む。【締めくくり】ナレーションの最後は必ず[confident]でハイトップのブランドメッセージを入れて締める。毎回異なる表現で、以下を自然に織り交ぜること：会社名『ハイトップ』『ハイトップコーポレーション』、スローガン『マイ パッション イズ ワン コード』。例：『ハイトップが、この一台に込めた想い。マイ パッション イズ ワン コード。』『マイ パッション イズ ワン コード。それがハイトップの選んだ答えです。』『ハイトップコーポレーションが贈る、ただ一台の物語。』など。定型文にせず、車や記事の内容に合わせて毎回変えること。1500文字程度）"
}
`

  const API_BASE = import.meta.env.VITE_API_BASE_URL
  const resp = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt, carName: basicInfo.name }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(err || 'AI生成に失敗しました')
  }

  const data = await resp.json()
  return data as GeneratedContent
}
