import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * 編集タブ用の共通プリミティブ。
 * VehicleDetailPage.tsx と各 EditXxxSection から共有される。
 */

export function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-white/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="text-xs tracking-widest text-white/50 uppercase">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/30 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && <div className="px-5 pb-5 space-y-5">{children}</div>}
    </div>
  )
}

export function EditField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs tracking-widest text-white/40 uppercase">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-white/20 bg-transparent py-2 text-sm text-white focus:border-brand-gold focus:outline-none"
      />
    </div>
  )
}

export function EditTextarea({
  label,
  value,
  onChange,
  rows = 6,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs tracking-widest text-white/40 uppercase">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-white/20 bg-transparent p-3 text-sm text-white focus:border-brand-gold focus:outline-none resize-none"
      />
    </div>
  )
}
