// Worker側で使う型定義（apps/web/src/types/index.ts のサブセット）
// LP生成・Admin APIで参照する型のみをミラーリング

export type Situation =
  | 'city'
  | 'coast'
  | 'travel'
  | 'night'
  | 'speed'
  | 'possession'

export type ColorTemplate = 'dark' | 'warm' | 'open'

export type Transmission = 'AT' | 'MT' | 'CVT' | 'DCT' | 'other'

export type PhotoTag = 'hero' | 'exterior' | 'interior' | 'detail'

export interface CarPhoto {
  id: string
  url: string
  storageRef?: string
  tag: PhotoTag
  order: number
  urlVariants?: Record<string, string>
}

export interface CarBasicInfo {
  name: string
  year: number
  mileage: string
  price: string
  isAsk: boolean
  shaken: string
  transmission: Transmission
  drive: string
  engine: string
  maxPower?: string
  maxTorque?: string
  hasRepairHistory: boolean
  customContent: string
  tagline?: string
}

export interface GeneratedContent {
  nameJa?: string
  subtitle: string
  englishCopy: string
  section1: { title: string; subtitle: string; story: string }
  section2: { title: string; subtitle: string; story: string }
  section3: {
    title: string
    subtitle: string
    details: Array<{ caption: string; description: string }>
  }
  pullQuote1: string
  pullQuote2?: string
  igCaption: string
  igHashtags: string
  tweetText: string
  narrationText?: string
  reelNarration?: string
  seo?: {
    metaDescription: string
    keywords: string
    ogDescription: string
  }
}

export interface Vehicle {
  id: string
  slug: string
  basicInfo: CarBasicInfo
  situation: Situation
  colorTemplate: ColorTemplate
  photos: CarPhoto[]
  generatedContent?: GeneratedContent
  detailPhotoUrls?: [string, string, string, string]
  audioUrl?: string
  reelVideoUrl?: string
  reelAudioUrl?: string
  reelNarration?: string
  feedImageUrl?: string
  ogpImageUrl?: string
  verticalImageUrl?: string
  caption?: string
  hashtags?: string
  status: 'draft' | 'published' | 'sold'
  publishedAt?: Date
  soldAt?: Date
  createdAt: Date
  updatedAt: Date
}

// シチュエーション → デフォルトカラー（自動推奨用）
export const SITUATION_DEFAULT_COLOR: Record<Situation, ColorTemplate> = {
  city: 'dark',
  coast: 'open',
  travel: 'open',
  night: 'dark',
  speed: 'dark',
  possession: 'warm',
}
