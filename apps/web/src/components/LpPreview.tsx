import { useEffect, useRef } from 'react'
import type { Vehicle, GeneratedContent } from '@/types'
import { generateLpHtml } from '@/lib/lp-generator'

interface Props {
  vehicle: Vehicle
  content: GeneratedContent
}

export function LpPreview({ vehicle, content }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const html = generateLpHtml(vehicle, content, false)
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [vehicle, content])

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
      </div>
      <iframe
        ref={iframeRef}
        title="LP Preview"
        className="w-full"
        style={{ height: '80vh', border: 'none', background: '#0A0A0A' }}
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  )
}
