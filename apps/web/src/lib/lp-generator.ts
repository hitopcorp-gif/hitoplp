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

function splitIntoLines(name: string): string[] {
  const words = name.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (current.length + w.length > 22 && current.length > 0) {
      lines.push(current.trim())
      current = w
    } else {
      current += (current ? ' ' : '') + w
    }
  }
  if (current) lines.push(current.trim())
  return lines
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
  const titleLines = splitIntoLines(basicInfo.name)

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
<title>${basicInfo.name} | HI-TOP</title>
<meta name="description" content="${content.subtitle}">
<meta property="og:title" content="${basicInfo.name} | HI-TOP CORPORATION">
<meta property="og:description" content="${content.subtitle}">
${heroUrl ? `<meta property="og:image" content="${heroUrl}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Serif+JP:wght@200;300;400&family=Noto+Sans+JP:wght@300;400&display=swap" rel="stylesheet">
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
  font-family: 'Noto Serif JP', serif;
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
.nav-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.nav-shield { width: 40px; height: 40px; object-fit: contain; filter: invert(1); opacity: 0.9; }
.nav-text { display: flex; flex-direction: column; gap: 2px; }
.nav-logo { font-family: 'Cormorant Garamond', serif; font-size: 14px; letter-spacing: 0.35em; color: #fff; text-transform: uppercase; line-height: 1; mix-blend-mode: difference; }
.nav-logo-ja { font-family: 'Noto Sans JP', sans-serif; font-size: 7px; letter-spacing: 0.2em; color: rgba(255,255,255,0.35); line-height: 1; mix-blend-mode: difference; }
.nav-tag { font-family: 'Noto Sans JP', sans-serif; font-size: 8px; letter-spacing: 0.45em; color: rgba(255,255,255,0.3); text-transform: uppercase; mix-blend-mode: difference; }

/* ── HERO ── */
.hero { position: relative; height: 100vh; height: 100dvh; min-height: 640px; overflow: hidden; display: flex; align-items: flex-end; }
.hero-bg { position: absolute; inset: 0; will-change: transform; }
.hero-bg img { width: 100%; height: 125%; object-fit: cover; object-position: center 65%; filter: brightness(0.5); }
.hero-grain {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.18;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}
.hero-grad { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.80) 100%); }
.hero-content { position: relative; z-index: 2; width: 100%; padding: clamp(48px, 10vh, 100px) clamp(24px, 5vw, 72px); }
.hero-label {
  font-family: 'Noto Sans JP', sans-serif; font-size: 9px;
  letter-spacing: 0.55em; color: var(--accent); text-transform: uppercase;
  margin-bottom: 28px;
  opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(8px)'};
  transition: opacity 0.7s var(--ease) 0.1s, transform 0.7s var(--ease) 0.1s;
}
.hero-name {
  font-family: 'Cormorant Garamond', serif; font-weight: 300;
  font-size: clamp(38px, 7.5vw, 120px);
  line-height: 0.95; letter-spacing: -0.01em;
  color: #fff; overflow: hidden;
}
.hero-name-line {
  display: block;
  transform: ${preview ? 'none' : 'translateY(105%)'};
  transition: transform 1.0s var(--ease);
}
.hero-name-line:nth-child(2) { transition-delay: 0.08s; padding-left: clamp(24px, 4vw, 80px); }
.hero-name-line:nth-child(3) { transition-delay: 0.16s; }
.hero-name-ja {
  font-family: 'Noto Serif JP', serif; font-weight: 200;
  font-size: clamp(11px, 1.1vw, 14px); color: rgba(245,245,240,0.35);
  letter-spacing: 0.25em; margin-top: 16px;
  opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(10px)'};
  transition: opacity 0.8s var(--ease) 0.4s, transform 0.8s var(--ease) 0.4s;
}
.loaded .hero-name-ja { opacity: 1; transform: none; }
.hero-foot {
  margin-top: 36px; display: flex; align-items: flex-end; justify-content: space-between;
  flex-wrap: wrap; gap: 20px;
}
.hero-sub {
  font-family: 'Noto Serif JP', serif; font-weight: 200;
  font-size: clamp(13px, 1.2vw, 16px); color: rgba(245,245,240,0.55);
  letter-spacing: 0.06em; max-width: 380px;
  opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(16px)'};
  transition: opacity 0.9s var(--ease) 0.5s, transform 0.9s var(--ease) 0.5s;
}
.hero-en {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: clamp(18px, 2.2vw, 28px); color: var(--accent);
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
.s-eyebrow { font-family: 'Noto Sans JP', sans-serif; font-size: 9px; letter-spacing: 0.5em; color: var(--accent); text-transform: uppercase; margin-bottom: 18px; }
.s-title { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(44px, 6vw, 88px); line-height: 0.95; color: var(--text); margin-bottom: 36px; }
.s-ghost { font-family: 'Cormorant Garamond', serif; font-size: clamp(80px, 14vw, 180px); font-weight: 300; color: rgba(255,255,255,0.03); position: absolute; right: clamp(24px, 5vw, 80px); top: clamp(80px, 10vh, 120px); line-height: 1; pointer-events: none; user-select: none; }
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
.pq-mark { font-family: 'Cormorant Garamond', serif; font-size: clamp(100px, 20vw, 240px); line-height: 0.8; color: rgba(255,255,255,0.025); position: absolute; top: 0; left: 50%; transform: translateX(-50%); pointer-events: none; user-select: none; }
.pq p { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 300; font-size: clamp(22px, 3.2vw, 44px); color: var(--text); line-height: 1.55; position: relative; }
.pq-rule { width: 48px; height: 1px; background: var(--accent); margin: 36px auto 0; }

/* ── DETAIL GRID ── */
.dg { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 3vw, 56px); }
.di { }
.di-img { overflow: hidden; position: relative; }
.di-img img { width: 100%; height: clamp(240px, 33vw, 420px); object-fit: cover; transition: transform 0.9s var(--ease); }
.di:hover .di-img img { transform: scale(1.06); }
.di-n { font-family: 'Cormorant Garamond', serif; font-size: 10px; letter-spacing: 0.4em; color: var(--accent); margin: 22px 0 8px; }
.di-cap { font-family: 'Noto Serif JP', serif; font-weight: 400; font-size: 15px; color: var(--text); margin-bottom: 10px; }
.di-desc { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; color: var(--text-dim); line-height: 1.9; }

/* ── SPECS ── */
.sp-sec { padding: clamp(80px, 12vh, 140px) 0; border-top: 1px solid rgba(255,255,255,0.05); }
.sp-hed { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(40px, 5vw, 64px); color: var(--text); margin-bottom: clamp(40px, 6vw, 72px); }
.sp-grid { display: grid; grid-template-columns: 1fr 1fr; }
.sp-row { display: flex; justify-content: space-between; align-items: baseline; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.045); gap: 16px; }
.sp-k { font-family: 'Noto Sans JP', sans-serif; font-size: 11px; letter-spacing: 0.12em; color: var(--text-dim); flex-shrink: 0; }
.sp-v { font-family: 'Noto Serif JP', serif; font-size: 14px; color: var(--text); text-align: right; }
.price-blk { margin-top: 52px; padding-top: 40px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: baseline; gap: 28px; }
.price-lbl { font-family: 'Noto Sans JP', sans-serif; font-size: 10px; letter-spacing: 0.35em; color: var(--text-dim); text-transform: uppercase; }
.price-num { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(40px, 5.5vw, 72px); color: var(--text); line-height: 1; }

/* ── CTA ── */
.cta { padding: clamp(100px, 14vh, 160px) 0; text-align: center; }
.cta-vert { width: 1px; height: 80px; background: linear-gradient(to bottom, transparent, var(--accent)); margin: 0 auto 52px; }
.cta-copy { font-family: 'Noto Serif JP', serif; font-weight: 200; font-size: clamp(20px, 2.5vw, 30px); color: var(--text); letter-spacing: 0.1em; margin-bottom: 52px; }
.cta-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.cta-btn { display: inline-flex; align-items: center; gap: 12px; border: 1px solid rgba(255,255,255,0.12); padding: 16px 44px; font-family: 'Noto Sans JP', sans-serif; font-size: 11px; letter-spacing: 0.18em; color: var(--text); transition: border-color 0.3s, color 0.3s, background 0.3s; cursor: none; }
.cta-btn:hover { border-color: var(--accent); color: var(--accent); }
.cta-btn.pri { background: var(--accent); border-color: var(--accent); color: #000; }
.cta-btn.pri:hover { background: transparent; color: var(--accent); }

/* ── FOOTER ── */
footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 56px 0; }
.ft { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
.ft-logo { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: 18px; letter-spacing: 0.3em; color: var(--text); text-transform: uppercase; }
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
    <div class="nav-text">
      <span class="nav-logo en">HI-TOP</span>
      <span class="nav-logo-ja sans">ハイトップコーポレーション</span>
    </div>
  </a>
  <span class="nav-tag sans">Selection</span>
</nav>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-bg" id="hbg">
    ${heroUrl ? `<img src="${heroUrl}" alt="${basicInfo.name}" loading="eager">` : '<div style="width:100%;height:100%;background:#111;"></div>'}
  </div>
  <div class="hero-grain"></div>
  <div class="hero-grad"></div>
  <div class="hero-content">
    <p class="hero-label sans">HI-TOP Corporation — ${basicInfo.year}</p>
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
        <img src="${LOGO_URL}" style="width:48px;height:48px;object-fit:contain;filter:brightness(0) invert(1);opacity:0.6;" alt="HI-TOP">
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
</body>
</html>`
}
