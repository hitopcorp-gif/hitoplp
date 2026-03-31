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
  file?: File
  url: string
  storageRef?: string
  tag: PhotoTag
  order: number
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
  subtitle: string
  englishCopy: string
  section1: {
    title: string
    subtitle: string
    story: string
  }
  section2: {
    title: string
    subtitle: string
    story: string
  }
  section3: {
    title: string
    subtitle: string
    details: Array<{
      caption: string
      description: string
    }>
  }
  pullQuote1: string
  pullQuote2?: string
  igCaption: string
  igHashtags: string
  tweetText: string
}

export interface Vehicle {
  id: string
  slug: string
  basicInfo: CarBasicInfo
  situation: Situation
  colorTemplate: ColorTemplate
  photos: CarPhoto[]
  generatedContent?: GeneratedContent
  status: 'draft' | 'published' | 'sold'
  publishedAt?: Date
  soldAt?: Date
  createdAt: Date
  updatedAt: Date
}

export const SITUATION_CONFIG: Record<
  Situation,
  {
    label: string
    description: string
    targetCars: string
    colorTemplate: ColorTemplate
    emoji: string
  }
> = {
  city: {
    label: '街を走る',
    description: '都市の風景の中での存在感',
    targetCars: 'AMG、Mシリーズ、現行スポーツ系',
    colorTemplate: 'dark',
    emoji: '🏙️',
  },
  coast: {
    label: '海岸線を流す',
    description: '風、光、水平線',
    targetCars: 'カブリオレ、オープン系',
    colorTemplate: 'open',
    emoji: '🌊',
  },
  travel: {
    label: '旅に出る',
    description: '距離と時間の感覚',
    targetCars: 'レンジローバー、カイエン、GLS',
    colorTemplate: 'open',
    emoji: '🗻',
  },
  night: {
    label: '夜を纏う',
    description: '光と影のコントラスト',
    targetCars: 'Gクラス、エスカレード、ウルス',
    colorTemplate: 'dark',
    emoji: '🌃',
  },
  speed: {
    label: '速さを味わう',
    description: '加速、ブレーキング、コーナリング',
    targetCars: '911、コルベットC8、フェラーリ',
    colorTemplate: 'dark',
    emoji: '⚡',
  },
  possession: {
    label: '所有する歓び',
    description: 'ガレージ、ディテール、歴史',
    targetCars: 'ヴィンテージ、希少車',
    colorTemplate: 'warm',
    emoji: '🏆',
  },
}

export const PHOTO_ADVICE: Record<Situation, { title: string; items: string[]; tip: string }> = {
  city: {
    title: '街を走る',
    items: [
      'ヒーロー：都市背景でのフロント斜め。交差点や高層ビル街',
      'エクステリア：ガラスや建物に反射するボディ',
      'インテリア：ドライバー視点・ステアリング中心',
      'ディテール：エンブレム、ホイール、マフラー等',
    ],
    tip: '夜間の街灯下も◎。周囲の車が写り込まない場所を選ぶとベスト',
  },
  coast: {
    title: '海岸線を流す',
    items: [
      'ヒーロー：海・水平線をバックにした横位置全景',
      'エクステリア：陽光に輝くボディ、オープン状態推奨',
      'インテリア：窓全開、空と海が見えるコックピット',
      'ディテール：ドアミラー、幌の質感、シート素材',
    ],
    tip: '朝か夕方のゴールデンアワーが最良。真昼の日差しは白飛びに注意',
  },
  travel: {
    title: '旅に出る',
    items: [
      'ヒーロー：自然の中に停まってる全景（山、海、高原等）',
      'エクステリア：荷物を積んでるイメージがあるとベスト',
      'インテリア：後席の広さ、ラゲッジスペースが伝わる写真',
      'ディテール：シートの質感、ナビ画面、サンルーフ等',
    ],
    tip: 'ロケーション写真がない場合は「街を走る」がおすすめです',
  },
  night: {
    title: '夜を纏う',
    items: [
      'ヒーロー：夜景バックのフロント斜め。ヘッドライト点灯必須',
      'エクステリア：暗めの環境でボディラインが浮き出る写真',
      'インテリア：アンビエントライト点灯状態のコックピット',
      'ディテール：マフラー、ホイール、エンブレム等の接写',
    ],
    tip: '明るい昼間の写真が多い場合は「街を走る」の方が仕上がりが良くなります',
  },
  speed: {
    title: '速さを味わう',
    items: [
      'ヒーロー：低アングルのフロント斜め、迫力重視',
      'エクステリア：サイドビュー、スポーツラインを強調',
      'インテリア：スポーツシート、パドルシフター、メーター',
      'ディテール：ブレーキキャリパー、エキゾースト、エアロパーツ',
    ],
    tip: '流し撮り（背景ブレ）があれば最高。走行感が一気に増します',
  },
  possession: {
    title: '所有する歓び',
    items: [
      'ヒーロー：ガレージや邸宅前での全景。背景も含めた世界観',
      'エクステリア：塗装・素材の質感が伝わる自然光下の写真',
      'インテリア：素材感、木目、本革の手触りが伝わるカット',
      'ディテール：バッジ、ステアリング、年式を感じるパーツ',
    ],
    tip: '歴史や希少性が伝わる資料写真や書類があれば一緒に撮影を',
  },
}
