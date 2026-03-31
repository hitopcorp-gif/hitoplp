import type { Vehicle, GeneratedContent, ColorTemplate, CarPhoto } from '@/types'

const COLOR_VARS: Record<ColorTemplate, string> = {
  dark: `--bg: #0A0A0A; --text: #F5F5F0; --text-dim: #8A8A85; --accent: #C4A265;`,
  warm: `--bg: #1A1510; --text: #F5F0E6; --text-dim: #9A9080; --accent: #C4A265;`,
  open: `--bg: #0D1117; --text: #F0F5F5; --text-dim: #8A9599; --accent: #9AAFA6;`,
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
  const detailGrid = [
    detailPhotos[0]?.url ?? interiorPhotos[0]?.url ?? '',
    detailPhotos[1]?.url ?? interiorPhotos[1]?.url ?? '',
    detailPhotos[2]?.url ?? exteriorPhotos[0]?.url ?? '',
    detailPhotos[3]?.url ?? exteriorPhotos[1]?.url ?? '',
  ]

  const priceDisplay = basicInfo.isAsk ? 'ASK' : basicInfo.price

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

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${basicInfo.name} | HI-TOP</title>
<meta name="description" content="${content.subtitle}">
<meta property="og:title" content="${basicInfo.name} | HI-TOP">
<meta property="og:description" content="${content.subtitle}">
${heroUrl ? `<meta property="og:image" content="${heroUrl}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Noto+Serif+JP:wght@200;300;400;500&family=Noto+Sans+JP:wght@300;400&display=swap" rel="stylesheet">
<style>
:root { ${vars} }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { background: var(--bg); color: var(--text); font-family: 'Noto Serif JP', serif; font-weight: 300; line-height: 1.9; overflow-x: hidden; }
img { display: block; width: 100%; height: 100%; object-fit: cover; }
a { color: inherit; text-decoration: none; }

/* Typography */
.en { font-family: 'Cormorant Garamond', serif; }
.sans { font-family: 'Noto Sans JP', sans-serif; }

/* Layout */
.container { max-width: 1400px; margin: 0 auto; padding: 0 clamp(24px, 5vw, 80px); }

/* Animations */
.fade-in { opacity: ${preview ? '1' : '0'}; transform: ${preview ? 'none' : 'translateY(24px)'}; transition: opacity 0.8s ease, transform 0.8s ease; }
.fade-in.visible { opacity: 1; transform: none; }

/* ── HERO ── */
.hero { position: relative; height: 100vh; min-height: 600px; overflow: hidden; }
.hero-bg { position: absolute; inset: 0; }
.hero-bg img { width: 100%; height: 100%; object-fit: cover; object-position: center 65%; filter: brightness(0.65); transition: transform 8s ease; }
.hero:hover .hero-bg img { transform: scale(1.03); }
.hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%); }
.hero-content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: clamp(40px, 8vh, 80px) clamp(24px, 5vw, 80px); }
.hero-label { font-family: 'Noto Sans JP', sans-serif; font-size: 10px; letter-spacing: 0.4em; color: var(--accent); text-transform: uppercase; margin-bottom: 16px; }
.hero-title { font-family: 'Noto Serif JP', serif; font-weight: 200; font-size: clamp(16px, 2vw, 32px); line-height: 1.5; color: var(--text); max-width: 80%; letter-spacing: 0.08em; word-break: keep-all; overflow-wrap: break-word; }
.hero-subtitle { font-family: 'Noto Serif JP', serif; font-weight: 200; font-size: clamp(12px, 1.3vw, 16px); color: var(--text-dim); margin-top: 14px; letter-spacing: 0.1em; }
.hero-copy { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: clamp(16px, 2vw, 24px); color: var(--accent); margin-top: 10px; letter-spacing: 0.05em; }

/* ── SECTIONS ── */
.section { padding: clamp(80px, 10vh, 120px) 0; }
.section-header { margin-bottom: clamp(40px, 5vw, 60px); }
.section-num { font-family: 'Cormorant Garamond', serif; font-size: 13px; letter-spacing: 0.25em; color: var(--accent); text-transform: uppercase; }
.section-title-en { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(36px, 5vw, 56px); color: var(--text); line-height: 1.1; }
.section-title-jp { font-family: 'Noto Serif JP', serif; font-weight: 200; font-size: clamp(13px, 1.4vw, 16px); color: var(--text-dim); margin-top: 8px; letter-spacing: 0.05em; }

/* 2-column layout */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(40px, 5vw, 80px); align-items: center; }
.two-col.reverse { direction: rtl; }
.two-col.reverse > * { direction: ltr; }

.photo-block { overflow: hidden; }
.photo-block img { width: 100%; height: 460px; object-fit: cover; object-position: center 60%; transition: transform 0.7s ease; }
.photo-block:hover img { transform: scale(1.04); }

.text-block { padding: clamp(0px, 2vw, 40px); }
.text-block p { font-size: clamp(14px, 1.1vw, 16px); color: var(--text-dim); line-height: 2; }
.text-block p + p { margin-top: 1.4em; }

/* ── FULL BLEED ── */
.full-bleed { height: 75vh; min-height: 400px; overflow: hidden; position: relative; }
.full-bleed img { width: 100%; height: 100%; object-fit: cover; object-position: center 60%; filter: brightness(0.8); transition: transform 8s ease; }
.full-bleed:hover img { transform: scale(1.02); }

/* ── PULL QUOTE ── */
.pull-quote { padding: clamp(60px, 8vw, 100px) clamp(24px, 12vw, 200px); text-align: center; }
.pull-quote p { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 300; font-size: clamp(22px, 3.5vw, 38px); color: var(--text); line-height: 1.5; }
.pull-quote::after { content: ''; display: block; width: 40px; height: 1px; background: var(--accent); margin: 32px auto 0; }

/* ── DETAIL GRID ── */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(16px, 2vw, 32px); }
.detail-card { }
.detail-card .img-wrap { height: 300px; overflow: hidden; }
.detail-card .img-wrap img { transition: transform 0.7s ease; }
.detail-card:hover .img-wrap img { transform: scale(1.05); }
.detail-card .caption { padding: 20px 0 0; }
.detail-card .caption strong { display: block; font-family: 'Noto Serif JP', serif; font-weight: 500; font-size: 14px; color: var(--text); margin-bottom: 8px; }
.detail-card .caption p { font-family: 'Noto Sans JP', sans-serif; font-size: 12px; color: var(--text-dim); line-height: 1.8; }

/* ── SPECS ── */
.specs { padding: clamp(80px, 10vh, 120px) 0; }
.specs-label { font-family: 'Noto Sans JP', sans-serif; font-size: 11px; letter-spacing: 0.3em; color: var(--accent); text-transform: uppercase; margin-bottom: 40px; }
.specs-table { width: 100%; border-collapse: collapse; }
.specs-table tr { border-bottom: 1px solid rgba(255,255,255,0.06); }
.specs-table td { padding: 14px 0; font-size: 13px; }
.specs-table td:first-child { color: var(--text-dim); font-family: 'Noto Sans JP', sans-serif; font-weight: 300; width: 40%; }
.specs-table td:last-child { color: var(--text); }
.price-block { margin-top: 48px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1); }
.price-label { font-family: 'Noto Sans JP', sans-serif; font-size: 11px; letter-spacing: 0.3em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px; }
.price-value { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: clamp(28px, 4vw, 48px); color: var(--text); }

/* ── CTA ── */
.cta { padding: clamp(80px, 10vh, 120px) 0; text-align: center; }
.cta-line { width: 1px; height: 60px; background: var(--accent); margin: 0 auto 40px; }
.cta-title { font-family: 'Noto Serif JP', serif; font-weight: 200; font-size: clamp(18px, 2.5vw, 26px); color: var(--text); margin-bottom: 40px; letter-spacing: 0.1em; }
.cta-buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.cta-btn { display: inline-flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.2); padding: 14px 36px; font-family: 'Noto Sans JP', sans-serif; font-size: 13px; letter-spacing: 0.1em; color: var(--text); transition: all 0.3s; text-decoration: none; }
.cta-btn:hover { border-color: var(--accent); color: var(--accent); }

/* ── FOOTER ── */
footer { border-top: 1px solid rgba(255,255,255,0.08); padding: 48px 0; }
.footer-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.footer-logo { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: 22px; letter-spacing: 0.2em; color: var(--text); text-transform: uppercase; }
.footer-sub { font-family: 'Noto Sans JP', sans-serif; font-size: 11px; color: var(--text-dim); letter-spacing: 0.15em; }

/* Responsive */
@media (max-width: 768px) {
  .two-col { grid-template-columns: 1fr; }
  .two-col.reverse { direction: ltr; }
  .photo-block img { height: 280px; }
  .detail-grid { grid-template-columns: 1fr; }
  .pull-quote { padding: 60px 24px; }
}
</style>
</head>
<body>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg">${heroUrl ? `<img src="${heroUrl}" alt="${basicInfo.name}" loading="eager">` : '<div style="width:100%;height:100%;background:#111;"></div>'}</div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <p class="hero-label fade-in">HI-TOP Selection</p>
    <h1 class="hero-title en fade-in">${basicInfo.name}</h1>
    <p class="hero-subtitle fade-in">${content.subtitle}</p>
    <p class="hero-copy en fade-in">${content.englishCopy}</p>
  </div>
</section>

<!-- SECTION 1 -->
<section class="section">
  <div class="container">
    <div class="section-header fade-in">
      <p class="section-num sans">01 / ${content.section1.title}</p>
      <h2 class="section-title-en en">${content.section1.title}</h2>
      <p class="section-title-jp">— ${content.section1.subtitle}</p>
    </div>
    <div class="two-col fade-in">
      <div class="photo-block">${sec1Photo ? `<img src="${sec1Photo}" alt="">` : ''}</div>
      <div class="text-block">
        ${content.section1.story.split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('')}
      </div>
    </div>
  </div>
</section>

<!-- FULL BLEED 1 -->
${fullBreed1 ? `<div class="full-bleed fade-in"><img src="${fullBreed1}" alt=""></div>` : ''}

<!-- PULL QUOTE 1 -->
<div class="pull-quote fade-in">
  <p class="en">"${content.pullQuote1}"</p>
</div>

<!-- SECTION 2 -->
<section class="section">
  <div class="container">
    <div class="section-header fade-in">
      <p class="section-num sans">02 / ${content.section2.title}</p>
      <h2 class="section-title-en en">${content.section2.title}</h2>
      <p class="section-title-jp">— ${content.section2.subtitle}</p>
    </div>
    <div class="two-col reverse fade-in">
      <div class="text-block">
        ${content.section2.story.split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('')}
      </div>
      <div class="photo-block">${sec2Photo ? `<img src="${sec2Photo}" alt="">` : ''}</div>
    </div>
  </div>
</section>

<!-- FULL BLEED 2 -->
${fullBreed2 ? `<div class="full-bleed fade-in"><img src="${fullBreed2}" alt=""></div>` : ''}

<!-- SECTION 3: DETAILS -->
<section class="section">
  <div class="container">
    <div class="section-header fade-in">
      <p class="section-num sans">03 / ${content.section3.title}</p>
      <h2 class="section-title-en en">${content.section3.title}</h2>
      <p class="section-title-jp">— ${content.section3.subtitle}</p>
    </div>
    <div class="detail-grid fade-in">
      ${content.section3.details.map((d, i) => {
        const detail = normalizeDetail(d as DetailItem)
        return `
      <div class="detail-card">
        <div class="img-wrap">${detailGrid[i] ? `<img src="${detailGrid[i]}" alt="">` : '<div style="width:100%;height:100%;background:#111;"></div>'}</div>
        <div class="caption">
          <strong>${detail.caption}</strong>
          <p>${detail.description}</p>
        </div>
      </div>`
      }).join('')}
    </div>
  </div>
</section>

${fullBreed3 ? `<div class="full-bleed fade-in"><img src="${fullBreed3}" alt=""></div>` : ''}

${content.pullQuote2 ? `
<div class="pull-quote fade-in">
  <p class="en">"${content.pullQuote2}"</p>
</div>` : ''}

<!-- SPECS -->
<section class="specs">
  <div class="container">
    <p class="specs-label sans fade-in">Specifications</p>
    <table class="specs-table fade-in">
      <tbody>
        ${specs.map(([k, v]) => `<tr><td class="sans">${k}</td><td>${v}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="price-block fade-in">
      <p class="price-label sans">Price</p>
      <p class="price-value en">${priceDisplay}</p>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta">
  <div class="container">
    <div class="cta-line"></div>
    <p class="cta-title">この車の話を、聞いてみる</p>
    <div class="cta-buttons">
      <a href="tel:+81930000000" class="cta-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11a19.79 19.79 0 01-3-8.58A2 2 0 012 2.21h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        営業直通
      </a>
      <a href="https://lin.ee/hi-top" class="cta-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 3.62 2.32 6.77 5.81 8.5L7 22l3.13-1.67c.6.16 1.23.25 1.87.25 5.52 0 10-3.92 10-8.82C22 5.92 17.52 2 12 2z"/></svg>
        LINE で問い合わせ
      </a>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-inner">
      <p class="footer-logo en">HI-TOP</p>
      <p class="footer-sub sans">HI-TOP Corporation</p>
      <p class="footer-sub sans">福岡県北九州市 ｜ hi-top.net</p>
    </div>
  </div>
</footer>

<script>
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
</script>
</body>
</html>`
}
