import type { Vehicle, GeneratedContent, ColorTemplate, CarPhoto } from '@/types'

const LOGO_URL = 'https://hitoplp-api.hitopcorp.workers.dev/api/image/assets/logo.png'

const COLOR_VARS: Record<ColorTemplate, string> = {
  dark: `--bg: #0A0A0A; --text: #F5F5F0; --text-dim: #7A7A75; --accent: #C4A265; --accent-rgb: 196,162,101;`,
  warm: `--bg: #111009; --text: #F5F0E6; --text-dim: #8A8070; --accent: #C4A265; --accent-rgb: 196,162,101;`,
  open: `--bg: #0A0F12; --text: #EFF5F5; --text-dim: #7A9099; --accent: #9AAFA6; --accent-rgb: 154,175,166;`,
}

function photosByTag(photos: CarPhoto[], tag: CarPhoto['tag']): CarPhoto[] {
  return photos.filter((p) => p.tag === tag).sort((a, b) => a.order - b.order)
}

type DetailItem = { caption: string; description: string } | string

function normalizeDetail(d: DetailItem): { caption: string; description: string } {
  if (typeof d === 'string') {
    const [caption, ...rest] = d.split('：')
    return { caption: caption ?? d, description: rest.join('：') ?? '' }
  }
  return d
}

function splitIntoLines(name: string, threshold = 25): string[] {
  const words = name.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (current.length + w.length > threshold && current.length > 0) {
      lines.push(current.trim())
      current = w
    } else {
      current += (current ? ' ' : '') + w
    }
  }
  if (current) lines.push(current.trim())
  return lines
}

// Split vehicle name into display lines: brand/model lines (bold) + grade line (thin)
function splitVehicleName(name: string): string[] {
  const words = name.split(' ')
  // Detect grade start: word at index >= 2 that looks like a grade code (e.g. G65, 500h, AMG at end)
  const isGradeWord = (w: string) => /^[A-Z]\d/.test(w) || /^\d/.test(w)
  let gradeIdx = -1
  for (let i = 2; i < words.length; i++) {
    if (isGradeWord(words[i])) { gradeIdx = i; break }
  }
  if (gradeIdx === -1) return splitIntoLines(name)
  const modelPart = words.slice(0, gradeIdx).join(' ')
  const gradePart = words.slice(gradeIdx).join(' ')
  return [...splitIntoLines(modelPart, 14), gradePart]
}

export function generateLpHtml(vehicle: Vehicle, content: GeneratedContent, preview = false): string {
  const { basicInfo, colorTemplate, photos } = vehicle
  const vars = COLOR_VARS[colorTemplate]

  const heroPhotos = photosByTag(photos, 'hero')
  const exteriorPhotos = photosByTag(photos, 'exterior')
  const interiorPhotos = photosByTag(photos, 'interior')
  const detailPhotos = photosByTag(photos, 'detail')

  const heroUrl = heroPhotos[0]?.url ?? exteriorPhotos[0]?.url ?? ''
  const sec1Photo = exteriorPhotos[0]?.url ?? heroPhotos[1]?.url ?? ''
  const fullBreed1 = exteriorPhotos[1]?.url ?? heroPhotos[0]?.url ?? ''
  const sec2Photo = interiorPhotos[0]?.url ?? exteriorPhotos[2]?.url ?? ''
  const fullBreed2 = exteriorPhotos[2]?.url ?? interiorPhotos[1]?.url ?? ''
  const fullBreed3 = interiorPhotos[1]?.url ?? ''

  // Mobile photo strip: all exterior + interior photos (full car, uncropped)
  const mobileStripPhotos = [
    ...heroPhotos.slice(1),
    ...exteriorPhotos,
    ...interiorPhotos,
  ].filter(p => p.url).map(p => p.url)
  const detailGrid: string[] = vehicle.detailPhotoUrls ?? [
    detailPhotos[0]?.url ?? interiorPhotos[0]?.url ?? '',
    detailPhotos[1]?.url ?? interiorPhotos[1]?.url ?? '',
    detailPhotos[2]?.url ?? exteriorPhotos[0]?.url ?? '',
    detailPhotos[3]?.url ?? exteriorPhotos[1]?.url ?? '',
  ]

  const priceDisplay = basicInfo.isAsk ? 'ASK' : basicInfo.price
  const titleLines = splitVehicleName(basicInfo.name)

  const specs = [
    ['年式', `${basicInfo.year}年`],
    ['走行距離', basicInfo.mileage],
    ['ミッション', basicInfo.transmission === 'other' ? 'その他' : basicInfo.transmission],
    ['駆動方式', basicInfo.drive],
    ['エンジン', basicInfo.engine],
    ...(basicInfo.maxPower ? [['最高出力', basicInfo.maxPower]] : []),
    ...(basicInfo.maxTorque ? [['最大トルク', basicInfo.maxTorque]] : []),
    ['車検', basicInfo.shaken],
    ['修復歴', basicInfo.hasRepairHistory ? 'あり' : 'なし'],
  ]

  const R = preview ? 'r-in' : 'r' // In preview, use pre-revealed class

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${basicInfo.name} | HI-TOP JOURNAL</title>
<meta name="description" content="${content.seo?.metaDescription ?? content.subtitle}">
${content.seo?.keywords ? `<meta name="keywords" content="${content.seo.keywords}">` : ''}
<link rel="canonical" href="https://hitoplp-api.hitopcorp.workers.dev/${vehicle.slug}">
<meta property="og:type" content="product">
<meta property="og:title" content="${basicInfo.name} | HI-TOP JOURNAL">
<meta property="og:description" content="${content.seo?.ogDescription ?? content.subtitle}">
<meta property="og:url" content="https://hitoplp-api.hitopcorp.workers.dev/${vehicle.slug}">
<meta property="og:site_name" content="HI-TOP JOURNAL">
<meta property="og:locale" content="ja_JP">
${heroUrl ? `<meta property="og:image" content="${heroUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${basicInfo.name} | HI-TOP JOURNAL">
<meta name="twitter:description" content="${content.seo?.ogDescription ?? content.subtitle}">
${heroUrl ? `<meta name="twitter:image" content="${heroUrl}">` : ''}
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Vehicle",
  "name": basicInfo.name,
  "description": content.seo?.metaDescription ?? content.subtitle,
  "brand": { "@type": "Brand", "name": basicInfo.name.split(' ')[0] },
  "modelDate": String(basicInfo.year),
  "mileageFromOdometer": { "@type": "QuantitativeValue", "value": basicInfo.mileage },
  "vehicleTransmission": basicInfo.transmission,
  "driveWheelConfiguration": basicInfo.drive,
  "vehicleEngine": { "@type": "EngineSpecification", "name": basicInfo.engine },
  ...(heroUrl ? { "image": heroUrl } : {}),
  "offers": {
    "@type": "Offer",
    "priceCurrency": "JPY",
    ...(basicInfo.isAsk ? { "availability": "https://schema.org/InStock" } : { "price": basicInfo.price.replace(/[^0-9]/g, ''), "availability": "https://schema.org/InStock" }),
    "seller": { "@type": "Organization", "name": "HI-TOP CORPORATION", "url": "https://hi-top.net" }
  },
  "url": `https://hitoplp-api.hitopcorp.workers.dev/${vehicle.slug}`
})}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,800,700,400,300&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400&family=Noto+Sans+JP:wght@300;400&display=swap" rel="stylesheet">
<style>
/* ── RESET ── */
:root {
  ${vars}
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Shippori Mincho B1', serif;
  font-weight: 300;
  line-height: 1.9;
  overflow-x: hidden;
  ${preview ? '' : 'cursor: none;'}
}
img { display: block; width: 100%; height: 100%; object-fit: cover; }
a { color: inherit; text-decoration: none; }
.en { font-family: 'Cormorant Garamond', serif; }
.sans { font-family: 'Noto Sans JP', sans-serif; }

/* ── CURSOR ── */
#cur {
  position: fixed; width: 48px; height: 48px;
  border: 1px solid rgba(var(--accent-rgb), 0.6);
  border-radius: 50%;
  pointer-events: none; z-index: 9999;
  transform: translate(-50%, -50%);
  transition: width 0.3s var(--ease), height 0.3s var(--ease), opacity 0.3s, border-color 0.3s;
  will-change: left, top;
}
#cur.big { width: 80px; height: 80px; border-color: rgba(var(--accent-rgb), 0.3); }
#cur-d {
  position: fixed; width: 5px; height: 5px;
  background: var(--accent); border-radius: 50%;
  pointer-events: none; z-index: 9999;
  transform: translate(-50%, -50%);
}

/* ── SCROLL PROGRESS ── */
#sprog {
  position: fixed; top: 0; left: 0; height: 1px;
  background: var(--accent); z-index: 1000; width: 0%;
  transition: width 0.05s linear;
}

/* ── NAV ── */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 18px clamp(24px, 5vw, 72px);
  display: flex; justify-content: space-between; align-items: center;
}
.nav-brand { display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; }
.nav-shield { width: 44px; height: 44px; object-fit: contain; }
.nav-logo { font-family: 'Satoshi', sans-serif; font-weight: 400; font-size: 9px; letter-spacing: 0.28em; color: rgba(255,255,255,0.7); text-transform: uppercase; line-height: 1; mix-blend-mode: difference; }
.nav-tag { font-family: 'Noto Sans JP', sans-serif; font-size: 8px; letter-spacing: 0.45em; color: rgba(255,255,255,0.3); text-transform: uppercase; mix-blend-mode: difference; }

/* ── HERO ── */
.hero { position: relative; height: 100vh; height: 100dvh; min-height: 640px; overflow: hidden; display: flex; align-items: flex-end; }
.hero-bg { position: absolute; inset: 0; will-change: transform; }
.hero-bg img { width: 100%; height: 125%; object-fit: cover; object-position: center 65%; filter: brightness(0.5); }
.hero-grain {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.18;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}
.hero-grad { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 30%, rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.92) 100%); }
.hero-content { position: relative; z-index: 2; width: 100%; padding: clamp(48px, 8vh, 80px) clamp(24px, 5vw, 72px) clamp(80px, 14vh, 148px); }
.hero-label {
  font-family: 'Noto Sans JP', sans-serif; font-size: 8px;
  letter-spacing: 0.8em; color: rgba(255,255,255,0.55); text-transform: uppercase;
  margin-bottom: 52px;
  opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(8px)'};
  transition: opacity 0.7s var(--ease) 0.1s, transform 0.7s var(--ease) 0.1s;
}
.hero-name {
  font-family: 'Satoshi', sans-serif; font-weight: 900;
  font-size: clamp(40px, 8vw, 108px);
  line-height: 0.95; letter-spacing: -0.02em;
  color: #fff; overflow: hidden;
}
.hero-name-line {
  display: block;
  transform: ${preview ? 'none' : 'translateY(105%)'};
  transition: transform 1.0s var(--ease);
}
.hero-name-line:not(:first-child):last-child { font-family: 'Satoshi', sans-serif; font-weight: 300; font-style: normal; font-size: 0.46em; letter-spacing: 0.01em; color: rgba(255,255,255,0.82); }
.hero-name-line:nth-child(2) { transition-delay: 0.1s; }
.hero-name-line:nth-child(3) { transition-delay: 0.2s; }
.hero-name-ja {
  font-family: 'Shippori Mincho B1', serif; font-weight: 200;
  font-size: clamp(10px, 0.9vw, 12px); color: rgba(255,255,255,0.7);
  letter-spacing: 0.3em; margin-top: 26px;
  opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(10px)'};
  transition: opacity 0.8s var(--ease) 0.4s, transform 0.8s var(--ease) 0.4s;
}
.loaded .hero-name-ja { opacity: 1; transform: none; }
.hero-foot {
  margin-top: 52px; display: flex; align-items: flex-end; justify-content: space-between;
  flex-wrap: wrap; gap: 20px;
}
.hero-sub {
  font-family: 'Shippori Mincho B1', serif; font-weight: 200;
  font-size: clamp(11px, 0.9vw, 13px); color: rgba(255,255,255,0.75);
  letter-spacing: 0.08em; max-width: 340px;
  opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(16px)'};
  transition: opacity 0.9s var(--ease) 0.5s, transform 0.9s var(--ease) 0.5s;
}
.hero-en {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: clamp(22px, 2.8vw, 38px); color: var(--accent);
  opacity: ${preview ? '1' : '0'};
  transition: opacity 0.9s var(--ease) 0.7s;
}
.loaded .hero-label, .loaded .hero-sub, .loaded .hero-en { opacity: 1; transform: none; }
.loaded .hero-name-line { transform: none; }

/* scroll hint */
.s-hint {
  position: absolute; bottom: 32px; right: clamp(24px, 5vw, 72px);
  display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 2;
}
.s-hint span { font-family: 'Noto Sans JP', sans-serif; font-size: 8px; letter-spacing: 0.45em; color: rgba(255,255,255,0.25); writing-mode: vertical-rl; }
.s-line { width: 1px; height: 64px; overflow: hidden; background: rgba(255,255,255,0.1); position: relative; }
.s-line::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--accent); animation: sdown 2s ease-in-out infinite; transform-origin: top; }
@keyframes sdown { 0%,100%{transform:scaleY(0) translateY(0)} 50%{transform:scaleY(1) translateY(0)} }

/* ── REVEAL ── */
.r { opacity: 0; transform: translateY(36px); transition: opacity 0.9s var(--ease), transform 0.9s var(--ease); }
.r-in, .r.in { opacity: 1; transform: none; }
.d1 { transition-delay: 0.1s; } .d2 { transition-delay: 0.2s; } .d3 { transition-delay: 0.3s; }

/* ── CONTAINER ── */
.w { max-width: 1440px; margin: 0 auto; padding: 0 clamp(24px, 5vw, 80px); }

/* ── SECTION COMMON ── */
.sec { padding: clamp(100px, 14vh, 160px) 0; position: relative; }
.s-eyebrow { font-family: 'Noto Sans JP', sans-serif; font-size: 8px; letter-spacing: 0.65em; color: var(--accent); text-transform: uppercase; margin-bottom: 22px; }
.s-title { font-family: 'Satoshi', sans-serif; font-weight: 700; font-size: clamp(34px, 4.5vw, 68px); line-height: 1.05; letter-spacing: -0.02em; color: var(--text); margin-bottom: 36px; }
.s-ghost { font-family: 'Satoshi', sans-serif; font-size: clamp(60px, 11vw, 150px); font-weight: 700; letter-spacing: -0.03em; color: transparent; -webkit-text-stroke: 1px rgba(255,255,255,0.07); position: absolute; right: clamp(24px, 5vw, 80px); top: clamp(80px, 10vh, 120px); line-height: 1; pointer-events: none; user-select: none; }
.s-body p { font-size: clamp(14px, 1.1vw, 16px); color: var(--text-dim); line-height: 2.1; }
.s-body p + p { margin-top: 1.1em; }

/* ── TWO COL ── */
.two { display: grid; grid-template-columns: 55fr 45fr; gap: clamp(48px, 7vw, 120px); align-items: center; }
.two.flip { grid-template-columns: 45fr 55fr; }
.ph { overflow: hidden; position: relative; }
.ph img { width: 100%; height: clamp(380px, 60vh, 680px); object-fit: cover; object-position: center 60%; transition: transform 9s ease; }
.ph:hover img { transform: scale(1.05); }
.ph::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(var(--accent-rgb),0.06) 0%, transparent 60%); pointer-events: none; }
.tx { padding: 0 clamp(0px, 2vw, 32px); }

/* ── FULL BLEED ── */
.fb { height: clamp(55vh, 75vh, 88vh); overflow: hidden; position: relative; }
.fb img { width: 100%; height: 130%; object-fit: cover; object-position: center 50%; will-change: transform; }
.fb-over { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.45)); }

/* ── PULL QUOTE ── */
.pq { padding: clamp(80px, 12vw, 140px) clamp(24px, 12vw, 200px); text-align: center; position: relative; overflow: hidden; }
.pq-mark { font-family: 'Cormorant Garamond', serif; font-size: clamp(100px, 20vw, 240px); line-height: 0.8; color: transparent; -webkit-text-stroke: 1px rgba(255,255,255,0.05); position: absolute; top: 0; left: 50%; transform: translateX(-50%); pointer-events: none; user-select: none; }
.pq p { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 300; font-size: clamp(26px, 4vw, 56px); color: var(--text); line-height: 1.5; position: relative; }
.pq-rule { width: 48px; height: 1px; background: var(--accent); margin: 36px auto 0; }

/* ── DETAIL GRID ── */
.dg { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 3vw, 56px); }
.di { }
.di-img { overflow: hidden; position: relative; }
.di-img img { width: 100%; height: clamp(240px, 33vw, 420px); object-fit: cover; transition: transform 0.9s var(--ease); }
.di:hover .di-img img { transform: scale(1.06); }
.di-n { font-family: 'Cormorant Garamond', serif; font-size: 10px; letter-spacing: 0.4em; color: var(--accent); margin: 22px 0 8px; }
.di-cap { font-family: 'Shippori Mincho B1', serif; font-weight: 300; font-size: 15px; color: var(--text); margin-bottom: 10px; }
.di-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; color: var(--text-dim); line-height: 1.9; }

/* ── SPECS ── */
.sp-sec { padding: clamp(80px, 12vh, 140px) 0; border-top: 1px solid rgba(255,255,255,0.05); }
.sp-hed { font-family: 'Satoshi', sans-serif; font-weight: 700; font-size: clamp(34px, 4vw, 52px); letter-spacing: -0.02em; color: var(--text); margin-bottom: clamp(40px, 6vw, 72px); }
.sp-grid { display: grid; grid-template-columns: 1fr 1fr; }
.sp-row { display: flex; justify-content: space-between; align-items: baseline; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.045); gap: 16px; }
.sp-k { font-family: 'Noto Sans JP', sans-serif; font-size: 11px; letter-spacing: 0.12em; color: var(--text-dim); flex-shrink: 0; }
.sp-v { font-family: 'Shippori Mincho B1', serif; font-size: 14px; color: var(--text); text-align: right; }
.price-blk { margin-top: 52px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: baseline; gap: 28px; }
.price-lbl { font-family: 'Noto Sans JP', sans-serif; font-size: 10px; letter-spacing: 0.35em; color: var(--text-dim); text-transform: uppercase; }
.price-num { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(40px, 5.5vw, 72px); color: var(--text); line-height: 1; }

/* ── CTA ── */
.cta { padding: clamp(100px, 14vh, 160px) 0; text-align: center; }
.cta-vert { width: 1px; height: 80px; background: linear-gradient(to bottom, transparent, var(--accent)); margin: 0 auto 52px; }
.cta-copy { font-family: 'Shippori Mincho B1', serif; font-weight: 200; font-size: clamp(20px, 2.5vw, 30px); color: var(--text); letter-spacing: 0.1em; margin-bottom: 52px; }
.cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.cta-btn { display: inline-flex; align-items: center; gap: 12px; border: 1px solid rgba(255,255,255,0.12); padding: 16px 44px; font-family: 'Noto Sans JP', sans-serif; font-size: 11px; letter-spacing: 0.18em; color: var(--text); transition: border-color 0.3s, color 0.3s, background 0.3s; cursor: none; }
.cta-btn:hover { border-color: var(--accent); color: var(--accent); }
.cta-btn.pri { background: var(--accent); border-color: var(--accent); color: #000; }
.cta-btn.pri:hover { background: transparent; color: var(--accent); }

/* ── FOOTER ── */
footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 56px 0; }
.ft { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
.ft-logo { font-family: 'Satoshi', sans-serif; font-weight: 300; font-size: 13px; letter-spacing: 0.25em; color: var(--text); text-transform: uppercase; }
.ft-info p { font-family: 'Noto Sans JP', sans-serif; font-size: 10px; color: var(--text-dim); letter-spacing: 0.12em; line-height: 1.9; text-align: right; }

/* ── MOBILE PHOTO STRIP ── */
.mob-strip { display: none; }
@media (max-width: 900px) {
  .mob-strip {
    display: flex; overflow-x: auto; gap: 8px;
    padding: 0 20px 0; scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .mob-strip::-webkit-scrollbar { display: none; }
  .mob-strip-item {
    flex-shrink: 0; width: 72vw; scroll-snap-align: center;
    aspect-ratio: 3/4; overflow: hidden; position: relative;
  }
  .mob-strip-item img {
    width: 100%; height: 100%;
    object-fit: cover; object-position: center center;
  }
  .mob-strip-count {
    position: absolute; bottom: 10px; right: 12px;
    font-family: 'Noto Sans JP', sans-serif; font-size: 9px;
    letter-spacing: 0.2em; color: rgba(255,255,255,0.4);
  }
}

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
  body { cursor: auto; }
  #cur, #cur-d { display: none; }
  .nav-shield { width: 32px; height: 32px; }
  .nav-logo { font-size: 7px; letter-spacing: 0.22em; }
  .nav-brand { gap: 4px; }
  .two, .two.flip { grid-template-columns: 1fr; }
  .two.flip .ph { order: -1; }
  .ph img { object-position: center center; }
  .dg { grid-template-columns: 1fr; }
  .sp-grid { grid-template-columns: 1fr; }
  .s-ghost { display: none; }
  .pq { padding: 80px 24px; }
  .ft { flex-direction: column; text-align: center; }
  .ft-info p { text-align: center; }
  .cta-btn { cursor: auto; }
  .hero { height: 100svh; min-height: 600px; }
}
</style>
</head>
<body>

<div id="cur"></div>
<div id="cur-d"></div>
<div id="sprog"></div>

<nav class="nav">
  <a href="https://hi-top.net" class="nav-brand">
    <img src="${LOGO_URL}" class="nav-shield" alt="HI-TOP">
    <span class="nav-logo">HI-TOP JOURNAL</span>
  </a>
  <a href="https://hitoplp-api.hitopcorp.workers.dev/" class="nav-tag sans" style="text-decoration:none;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:0.12em;transition:color 0.3s ease;">← Back to List</a>
</nav>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-bg" id="hbg">
    ${heroUrl ? `<img src="${heroUrl}" alt="${basicInfo.name}" loading="eager">` : '<div style="width:100%;height:100%;background:#111;"></div>'}
  </div>
  <div class="hero-grain"></div>
  <div class="hero-grad"></div>
  <div class="hero-content">
    <p class="hero-label sans">HI-TOP Journal — ${basicInfo.year}</p>
    <h1 class="hero-name en">
      ${titleLines.map((line) => `<span class="hero-name-line">${line}</span>`).join('\n      ')}
    </h1>
    ${content.nameJa ? `<p class="hero-name-ja">${content.nameJa}</p>` : ''}
    <div class="hero-foot">
      <p class="hero-sub">${content.subtitle}</p>
      <p class="hero-en en">${content.englishCopy}</p>
    </div>
  </div>
  <div class="s-hint">
    <div class="s-line"></div>
    <span>Scroll</span>
  </div>
${vehicle.audioUrl ? `  <button id="hero-audio-cta" class="hero-audio-cta">
    <span class="eq-bars"><span></span><span></span><span></span><span></span><span></span></span>
    <span class="hero-audio-label sans">Listen to this story</span>
  </button>` : ''}
</section>

${mobileStripPhotos.length > 0 ? `
<!-- MOBILE PHOTO STRIP -->
<div class="mob-strip" style="padding-top:32px;padding-bottom:32px;">
  ${mobileStripPhotos.map((url, i) => `<div class="mob-strip-item">
    <img src="${url}" alt="">
    <span class="mob-strip-count">${i + 1} / ${mobileStripPhotos.length}</span>
  </div>`).join('')}
</div>` : ''}

<!-- SECTION 01 -->
<section class="sec">
  <div class="w">
    <span class="s-ghost en ${R}">01</span>
    <div class="two">
      <div class="ph ${R}">
        ${sec1Photo ? `<img src="${sec1Photo}" alt="">` : ''}
      </div>
      <div class="tx">
        <p class="s-eyebrow sans ${R}">01 / ${content.section1.title}</p>
        <h2 class="s-title en ${R}">${content.section1.title}</h2>
        <div class="s-body ${R} d1">
          ${content.section1.story.split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('')}
        </div>
      </div>
    </div>
  </div>
</section>

${fullBreed1 ? `<div class="fb"><img src="${fullBreed1}" alt="" class="fb-par"><div class="fb-over"></div></div>` : ''}

<div class="pq">
  <span class="pq-mark en">"</span>
  <p class="${R}">${content.pullQuote1}</p>
  <div class="pq-rule ${R} d1"></div>
</div>

<!-- SECTION 02 -->
<section class="sec">
  <div class="w">
    <span class="s-ghost en ${R}">02</span>
    <div class="two flip">
      <div class="tx">
        <p class="s-eyebrow sans ${R}">02 / ${content.section2.title}</p>
        <h2 class="s-title en ${R}">${content.section2.title}</h2>
        <div class="s-body ${R} d1">
          ${content.section2.story.split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('')}
        </div>
      </div>
      <div class="ph ${R}">
        ${sec2Photo ? `<img src="${sec2Photo}" alt="">` : ''}
      </div>
    </div>
  </div>
</section>

${fullBreed2 ? `<div class="fb"><img src="${fullBreed2}" alt="" class="fb-par"><div class="fb-over"></div></div>` : ''}

<!-- SECTION 03 DETAILS -->
<section class="sec">
  <div class="w">
    <span class="s-ghost en ${R}">03</span>
    <p class="s-eyebrow sans ${R}">03 / ${content.section3.title}</p>
    <h2 class="s-title en ${R}">${content.section3.title}</h2>
    <p class="${R} d1" style="font-size:13px;color:var(--text-dim);letter-spacing:0.06em;margin-bottom:clamp(40px,5vw,72px);">${content.section3.subtitle}</p>
    <div class="dg">
      ${(content.section3?.details ?? []).map((d, i) => {
        const det = normalizeDetail(d as DetailItem)
        return `<div class="di ${R} d${(i % 2) + 1}">
          <div class="di-img">${detailGrid[i] ? `<img src="${detailGrid[i]}" alt="">` : '<div style="width:100%;height:300px;background:#111;"></div>'}</div>
          <p class="di-n en">0${i + 1}</p>
          <p class="di-cap">${det.caption}</p>
          <p class="di-desc sans">${det.description}</p>
        </div>`
      }).join('')}
    </div>
  </div>
</section>

${fullBreed3 ? `<div class="fb"><img src="${fullBreed3}" alt="" class="fb-par"><div class="fb-over"></div></div>` : ''}

${content.pullQuote2 ? `<div class="pq">
  <span class="pq-mark en">"</span>
  <p class="${R}">${content.pullQuote2}</p>
  <div class="pq-rule ${R} d1"></div>
</div>` : ''}

<!-- SPECS -->
<section class="sp-sec">
  <div class="w">
    <h2 class="sp-hed en ${R}">Specifications</h2>
    <div class="sp-grid">
      ${specs.map(([k, v]) => `<div class="sp-row ${R}"><span class="sp-k sans">${k}</span><span class="sp-v">${v}</span></div>`).join('')}
    </div>
    <div class="price-blk ${R}">
      <span class="price-lbl sans">Price</span>
      <span class="price-num en">${priceDisplay}</span>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta">
  <div class="w">
    <div class="cta-vert ${R}"></div>
    <p class="cta-copy ${R}">この車の話を、聞いてみる</p>
    <div class="cta-btns">
      <a href="tel:+81930000000" class="cta-btn pri ${R}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11a19.79 19.79 0 01-3-8.58A2 2 0 012 2.21h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        電話で問い合わせ
      </a>
      <a href="https://lin.ee/hi-top" class="cta-btn ${R} d1">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 3.62 2.32 6.77 5.81 8.5L7 22l3.13-1.67c.6.16 1.23.25 1.87.25 5.52 0 10-3.92 10-8.82C22 5.92 17.52 2 12 2z"/></svg>
        LINE で問い合わせ
      </a>
    </div>
  </div>
</section>

<footer>
  <div class="w">
    <div class="ft">
      <a href="https://hi-top.net" style="text-decoration:none;display:flex;align-items:center;gap:14px;">
        <img src="${LOGO_URL}" style="width:48px;height:48px;object-fit:contain;" alt="HI-TOP">
        <div>
          <p class="ft-logo en">HI-TOP</p>
          <p class="sans" style="font-size:9px;color:var(--text-dim);letter-spacing:0.2em;margin-top:4px;">ハイトップコーポレーション</p>
        </div>
      </a>
      <div class="ft-info">
        <p class="sans">HI-TOP Corporation</p>
        <p class="sans">福岡県北九州市 ｜ <a href="https://hi-top.net" style="color:inherit;border-bottom:1px solid rgba(255,255,255,0.15);">hi-top.net</a></p>
      </div>
    </div>
  </div>
</footer>

<script>
(function(){
  /* cursor */
  var cur=document.getElementById('cur'), dot=document.getElementById('cur-d')
  var mx=window.innerWidth/2, my=window.innerHeight/2, cx=mx, cy=my
  document.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px'})
  ;(function loop(){cx+=(mx-cx)*0.1;cy+=(my-cy)*0.1;cur.style.left=cx+'px';cur.style.top=cy+'px';requestAnimationFrame(loop)})()
  document.querySelectorAll('a,button').forEach(function(el){
    el.addEventListener('mouseenter',function(){cur.classList.add('big')})
    el.addEventListener('mouseleave',function(){cur.classList.remove('big')})
  })

  /* scroll progress */
  var prog=document.getElementById('sprog')
  window.addEventListener('scroll',function(){
    prog.style.width=(window.scrollY/(document.body.scrollHeight-window.innerHeight)*100)+'%'
  },{passive:true})

  /* hero parallax */
  var hbg=document.getElementById('hbg')
  window.addEventListener('scroll',function(){
    var y=window.scrollY
    if(y<window.innerHeight*1.5) hbg.style.transform='translateY('+(y*0.3)+'px)'
  },{passive:true})

  /* hero load anim */
  setTimeout(function(){document.getElementById('hero').classList.add('loaded')},80)

  /* fullbleed parallax */
  document.querySelectorAll('.fb-par').forEach(function(img){
    var fb=img.parentElement
    window.addEventListener('scroll',function(){
      var r=fb.getBoundingClientRect()
      if(r.bottom>0&&r.top<window.innerHeight){
        var p=(window.innerHeight-r.top)/(window.innerHeight+r.height)
        img.style.transform='translateY('+(-p*60+10)+'px)'
      }
    },{passive:true})
  })

  /* reveal on scroll */
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target)}
    })
  },{threshold:0.1,rootMargin:'0px 0px -30px 0px'})
  document.querySelectorAll('.r').forEach(function(el){obs.observe(el)})
})()
</script>
${vehicle.audioUrl ? `
<!-- Audio Player Styles -->
<style>
/* ── Equalizer bars animation ── */
@keyframes eq1{0%,100%{height:3px}50%{height:14px}}
@keyframes eq2{0%,100%{height:8px}50%{height:4px}}
@keyframes eq3{0%,100%{height:5px}50%{height:16px}}
@keyframes eq4{0%,100%{height:10px}50%{height:3px}}
@keyframes eq5{0%,100%{height:4px}50%{height:12px}}
@keyframes pulse-ring{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.2);opacity:0}}
@keyframes float-in{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}

.eq-bars{display:flex;align-items:flex-end;gap:2px;height:16px}
.eq-bars span{display:block;width:2.5px;border-radius:1px;background:var(--accent)}
.eq-bars span:nth-child(1){animation:eq1 0.8s ease-in-out infinite}
.eq-bars span:nth-child(2){animation:eq2 0.6s ease-in-out infinite 0.1s}
.eq-bars span:nth-child(3){animation:eq3 0.9s ease-in-out infinite 0.15s}
.eq-bars span:nth-child(4){animation:eq4 0.7s ease-in-out infinite 0.05s}
.eq-bars span:nth-child(5){animation:eq5 0.85s ease-in-out infinite 0.2s}

/* ── Hero CTA ── */
.hero-audio-cta{
  position:absolute;bottom:clamp(80px,12vh,120px);left:clamp(24px,5vw,80px);
  z-index:10;display:flex;align-items:center;gap:12px;
  background:rgba(10,10,10,0.6);backdrop-filter:blur(16px);
  border:1px solid rgba(var(--accent-rgb),0.3);border-radius:40px;
  padding:12px 24px 12px 18px;cursor:pointer;color:#F5F5F0;
  animation:float-in 0.8s ease 1.2s both;transition:all 0.3s ease;
}
.hero-audio-cta:hover{background:rgba(10,10,10,0.8);border-color:rgba(var(--accent-rgb),0.6);transform:scale(1.03)}
.hero-audio-label{font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.7)}

/* ── Floating trigger (appears on scroll) ── */
.audio-float{
  position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);
  z-index:89;display:flex;align-items:center;gap:10px;
  background:rgba(10,10,10,0.9);backdrop-filter:blur(16px);
  border:1px solid rgba(var(--accent-rgb),0.25);border-radius:40px;
  padding:10px 22px 10px 16px;cursor:pointer;color:#F5F5F0;
  opacity:0;pointer-events:none;
  transition:transform 0.5s cubic-bezier(0.16,1,0.3,1),opacity 0.4s ease;
}
.audio-float.visible{transform:translateX(-50%) translateY(0);opacity:1;pointer-events:auto}
.audio-float::before{
  content:'';position:absolute;inset:-3px;border-radius:44px;
  background:radial-gradient(ellipse,rgba(var(--accent-rgb),0.3),transparent 70%);
  animation:pulse-ring 2.5s ease-out infinite;z-index:-1;
}
.audio-float:hover{border-color:rgba(var(--accent-rgb),0.5);background:rgba(10,10,10,0.95)}
.audio-float-label{font-size:10px;letter-spacing:0.15em;color:rgba(255,255,255,0.6);font-family:'Satoshi',sans-serif}

/* ── Bottom bar ── */
.audio-bar{
  position:fixed;bottom:0;left:0;right:0;z-index:90;
  background:rgba(10,10,10,0.95);backdrop-filter:blur(16px);
  border-top:1px solid rgba(255,255,255,0.06);
  padding:14px clamp(24px,5vw,60px);
  display:flex;align-items:center;gap:16px;
  transform:translateY(100%);transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
}
.audio-bar.open{transform:translateY(0)}
.audio-bar .eq-bars span{background:#F5F5F0;opacity:0.5}
.audio-bar.playing .eq-bars span{opacity:1;background:var(--accent)}
</style>

<!-- Floating trigger (scroll) -->
<div id="audio-float" class="audio-float">
  <span class="eq-bars"><span></span><span></span><span></span><span></span><span></span></span>
  <span class="audio-float-label">LISTEN</span>
</div>

<!-- Bottom playback bar -->
<div id="audio-bar" class="audio-bar">
  <button id="audio-toggle" style="background:none;border:1px solid rgba(var(--accent-rgb),0.3);color:#F5F5F0;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s ease;flex-shrink:0;">
    <svg id="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    <svg id="pause-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
  </button>
  <span class="eq-bars" id="bar-eq" style="flex-shrink:0"><span></span><span></span><span></span><span></span><span></span></span>
  <div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-family:'Satoshi',sans-serif;font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:0.15em;text-transform:uppercase">Now Playing</span>
      <span id="audio-time" style="font-family:'Satoshi',sans-serif;font-size:10px;color:rgba(255,255,255,0.25);">0:00 / 0:00</span>
    </div>
    <div id="audio-progress-bar" style="width:100%;height:2px;background:rgba(255,255,255,0.08);border-radius:1px;cursor:pointer;position:relative;">
      <div id="audio-progress" style="height:100%;background:var(--accent);border-radius:1px;width:0%;transition:width 0.1s linear;"></div>
    </div>
  </div>
  <button id="audio-close" style="background:none;border:none;color:rgba(255,255,255,0.25);cursor:pointer;padding:4px;flex-shrink:0;">
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
  </button>
</div>

<script>
(function(){
  var a=new Audio('${vehicle.audioUrl}');
  var bar=document.getElementById('audio-bar'),barEq=document.getElementById('bar-eq');
  var heroCta=document.getElementById('hero-audio-cta'),floatBtn=document.getElementById('audio-float');
  var toggle=document.getElementById('audio-toggle'),playI=document.getElementById('play-icon'),pauseI=document.getElementById('pause-icon');
  var prog=document.getElementById('audio-progress'),progBar=document.getElementById('audio-progress-bar'),timeD=document.getElementById('audio-time');
  var isOpen=false,heroH=document.getElementById('hero').offsetHeight;

  function fmt(s){var m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+(sec<10?'0':'')+sec;}

  function openBar(){isOpen=true;bar.classList.add('open');floatBtn.classList.remove('visible');if(heroCta)heroCta.style.display='none';}
  function closeBar(){isOpen=false;bar.classList.remove('open');bar.classList.remove('playing');a.pause();playI.style.display='block';pauseI.style.display='none';checkFloat();}
  function play(){a.play();playI.style.display='none';pauseI.style.display='block';bar.classList.add('playing');}
  function pause(){a.pause();playI.style.display='block';pauseI.style.display='none';bar.classList.remove('playing');}
  function startPlay(){openBar();play();}

  function checkFloat(){
    if(isOpen)return;
    if(window.scrollY>heroH*0.8){floatBtn.classList.add('visible');if(heroCta)heroCta.style.opacity='0';}
    else{floatBtn.classList.remove('visible');if(heroCta)heroCta.style.opacity='1';}
  }

  window.addEventListener('scroll',checkFloat,{passive:true});

  if(heroCta)heroCta.onclick=startPlay;
  floatBtn.onclick=startPlay;
  toggle.onclick=function(){if(a.paused)play();else pause();};
  document.getElementById('audio-close').onclick=closeBar;
  a.ontimeupdate=function(){var p=(a.currentTime/a.duration)*100;prog.style.width=p+'%';timeD.textContent=fmt(a.currentTime)+' / '+fmt(a.duration);};
  a.onended=function(){pause();prog.style.width='0%';};
  progBar.onclick=function(e){var r=progBar.getBoundingClientRect();a.currentTime=((e.clientX-r.left)/r.width)*a.duration;};
})();
</script>
` : ''}
</body>
</html>`
}
