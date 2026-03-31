import { useEffect, useRef, useState } from 'react'
import type { Vehicle, GeneratedContent } from '@/types'
import { generateLpHtml } from '@/lib/lp-generator'

interface Props {
  vehicle: Vehicle
  content: GeneratedContent
}

type ViewMode = 'desktop' | 'mobile'

export function LpPreview({ vehicle, content }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')

  useEffect(() => {
    const html = generateLpHtml(vehicle, content, false)
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [vehicle, content, viewMode])

  function openInBrowser() {
    const html = generateLpHtml(vehicle, content, false)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <div className="border border-white/10 overflow-hidden" style={{ borderRadius: 2 }}>
      {/* Browser chrome */}
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center gap-3 bg-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <div className="flex-1 bg-white/5 rounded px-3 py-1">
          <span className="text-xs text-white/30">
            cars.hi-top.net/{vehicle.slug}
          </span>
        </div>
        {/* Open in browser */}
        <button
          onClick={openInBrowser}
          title="ブラウザで開く"
          className="p-1.5 rounded text-white/30 hover:text-white/60 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
        {/* View mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('desktop')}
            title="デスクトップ表示"
            className={`p-1.5 rounded transition-colors ${viewMode === 'desktop' ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            title="iPhoneプレビュー"
            className={`p-1.5 rounded transition-colors ${viewMode === 'mobile' ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/60'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="2" width="14" height="20" rx="3"/>
              <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        </div>
      </div>

      {viewMode === 'desktop' ? (
        <iframe
          ref={iframeRef}
          title="LP Preview"
          className="w-full"
          style={{ height: '80vh', border: 'none', background: '#0A0A0A' }}
          sandbox="allow-same-origin allow-scripts"
        />
      ) : (
        <div
          className="flex items-start justify-center bg-[#0A0A0A]"
          style={{ height: '80vh', paddingTop: '32px', paddingBottom: '32px', overflowY: 'auto' }}
        >
          {/* iPhone 14 Pro mockup */}
          <div
            style={{
              position: 'relative',
              width: 276,
              flexShrink: 0,
              background: '#1A1A1A',
              borderRadius: 44,
              boxShadow: '0 0 0 1px #333, 0 0 0 2px #222, 0 24px 80px rgba(0,0,0,0.8), inset 0 0 0 1px #2A2A2A',
              padding: '12px 10px',
            }}
          >
            {/* Side buttons */}
            <div style={{ position: 'absolute', left: -2, top: 88, width: 2, height: 32, background: '#333', borderRadius: '2px 0 0 2px' }} />
            <div style={{ position: 'absolute', left: -2, top: 132, width: 2, height: 56, background: '#333', borderRadius: '2px 0 0 2px' }} />
            <div style={{ position: 'absolute', left: -2, top: 200, width: 2, height: 56, background: '#333', borderRadius: '2px 0 0 2px' }} />
            <div style={{ position: 'absolute', right: -2, top: 144, width: 2, height: 72, background: '#333', borderRadius: '0 2px 2px 0' }} />

            {/* Screen bezel */}
            <div
              style={{
                background: '#0A0A0A',
                borderRadius: 36,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Dynamic island */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 90,
                  height: 26,
                  background: '#000',
                  borderRadius: 13,
                  zIndex: 10,
                }}
              />

              {/* iframe scaled to 390px logical width */}
              <div
                style={{
                  width: 256,
                  height: 554,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <iframe
                  ref={iframeRef}
                  title="LP Preview Mobile"
                  style={{
                    width: 390,
                    height: 844,
                    border: 'none',
                    background: '#0A0A0A',
                    transformOrigin: 'top left',
                    transform: `scale(${256 / 390})`,
                    pointerEvents: 'auto',
                  }}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
