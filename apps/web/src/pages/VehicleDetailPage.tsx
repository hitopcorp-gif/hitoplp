import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Vehicle, GeneratedContent } from '@/types'
import { Button } from '@/components/ui/button'
import { LpPreview } from '@/components/LpPreview'
import { generateContent } from '@/lib/ai'
import {
  ChevronLeft, Eye, Globe, RotateCcw, BadgeCheck, Edit, Sparkles
} from 'lucide-react'

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'preview' | 'edit' | 'sns'>('preview')
  const [publishing, setPublishing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [editedContent, setEditedContent] = useState<GeneratedContent | null>(null)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'vehicles', id)).then((snap) => {
      if (snap.exists()) {
        const v = { id: snap.id, ...snap.data() } as Vehicle
        setVehicle(v)
        if (v.generatedContent) setEditedContent(v.generatedContent)
      }
      setLoading(false)
    })
  }, [id])

  async function handlePublish() {
    if (!id || !vehicle) return
    setPublishing(true)
    await updateDoc(doc(db, 'vehicles', id), {
      status: vehicle.status === 'published' ? 'draft' : 'published',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setVehicle((prev) => prev ? { ...prev, status: prev.status === 'published' ? 'draft' : 'published' } : prev)
    setPublishing(false)
  }

  async function handleMarkSold() {
    if (!id) return
    await updateDoc(doc(db, 'vehicles', id), {
      status: 'sold',
      soldAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setVehicle((prev) => prev ? { ...prev, status: 'sold' } : prev)
  }

  async function handleRegenerate() {
    if (!vehicle) return
    setRegenerating(true)
    try {
      const content = await generateContent({
        basicInfo: vehicle.basicInfo,
        situation: vehicle.situation,
        colorTemplate: vehicle.colorTemplate,
      })
      await updateDoc(doc(db, 'vehicles', id!), {
        generatedContent: content,
        updatedAt: serverTimestamp(),
      })
      setEditedContent(content)
      setVehicle((prev) => prev ? { ...prev, generatedContent: content } : prev)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSaveEdit() {
    if (!id || !editedContent) return
    await updateDoc(doc(db, 'vehicles', id), {
      generatedContent: editedContent,
      updatedAt: serverTimestamp(),
    })
    setVehicle((prev) => prev ? { ...prev, generatedContent: editedContent } : prev)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <p className="text-white/30 text-sm">読み込み中...</p>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <p className="text-white/30 text-sm">車両が見つかりません</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5 flex items-center gap-4 sticky top-0 bg-dark-bg/80 backdrop-blur-md z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="border-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs tracking-[0.25em] text-white/40 uppercase truncate">
            {vehicle.status === 'published' ? '公開中' : vehicle.status === 'sold' ? 'SOLD' : '下書き'}
          </p>
          <h1 className="font-cormorant text-xl font-light text-white truncate">{vehicle.basicInfo.name}</h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {vehicle.status !== 'sold' && (
            <>
              <Button variant="ghost" size="sm" onClick={handleMarkSold} className="text-white/40 hover:text-white border-white/20">
                <BadgeCheck className="w-4 h-4" />
                SOLD
              </Button>
              <Button
                variant={vehicle.status === 'published' ? 'secondary' : 'default'}
                size="sm"
                onClick={handlePublish}
                disabled={publishing || !vehicle.generatedContent}
              >
                <Globe className="w-4 h-4" />
                {vehicle.status === 'published' ? '非公開にする' : '公開する'}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/10 px-8 flex gap-8">
        {[
          { key: 'preview', label: 'プレビュー', icon: Eye },
          { key: 'edit', label: '編集', icon: Edit },
          { key: 'sns', label: 'SNS素材', icon: Sparkles },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-2 py-4 text-sm border-b-2 transition-all -mb-px ${
              tab === key
                ? 'border-brand-gold text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <main className="px-8 py-8">
        {tab === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">LPプレビュー</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="border-white/20 text-white/60 hover:text-white"
              >
                <RotateCcw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? '再生成中...' : '全体再生成'}
              </Button>
            </div>
            {vehicle.generatedContent ? (
              <LpPreview vehicle={vehicle} content={editedContent ?? vehicle.generatedContent} />
            ) : (
              <div className="border border-white/10 p-16 text-center">
                <p className="text-white/30 text-sm mb-6">コンテンツがまだ生成されていません</p>
                <Button onClick={handleRegenerate} disabled={regenerating}>
                  <Sparkles className="w-4 h-4" />
                  LP を生成する
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === 'edit' && editedContent && (
          <EditTab
            content={editedContent}
            onChange={setEditedContent}
            onSave={handleSaveEdit}
          />
        )}

        {tab === 'sns' && vehicle.generatedContent && (
          <SnsTab vehicle={vehicle} content={vehicle.generatedContent} />
        )}
      </main>
    </div>
  )
}

function EditTab({
  content,
  onChange,
  onSave,
}: {
  content: GeneratedContent
  onChange: (c: GeneratedContent) => void
  onSave: () => void
}) {
  return (
    <div className="max-w-2xl space-y-8">
      <EditField
        label="サブタイトル"
        value={content.subtitle}
        onChange={(v) => onChange({ ...content, subtitle: v })}
      />
      <EditField
        label="英語コピー"
        value={content.englishCopy}
        onChange={(v) => onChange({ ...content, englishCopy: v })}
      />
      <EditField
        label="プルクォート 1"
        value={content.pullQuote1}
        onChange={(v) => onChange({ ...content, pullQuote1: v })}
      />
      {content.pullQuote2 !== undefined && (
        <EditField
          label="プルクォート 2"
          value={content.pullQuote2 ?? ''}
          onChange={(v) => onChange({ ...content, pullQuote2: v })}
        />
      )}
      <EditTextarea
        label="セクション 1 ストーリー"
        value={content.section1.story}
        onChange={(v) => onChange({ ...content, section1: { ...content.section1, story: v } })}
      />
      <EditTextarea
        label="セクション 2 ストーリー"
        value={content.section2.story}
        onChange={(v) => onChange({ ...content, section2: { ...content.section2, story: v } })}
      />
      <Button onClick={onSave} className="w-full">変更を保存</Button>
    </div>
  )
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs tracking-widest text-white/40 uppercase">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-white/20 bg-transparent py-2 text-sm text-white focus:border-brand-gold focus:outline-none"
      />
    </div>
  )
}

function EditTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs tracking-widest text-white/40 uppercase">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full border border-white/20 bg-transparent p-3 text-sm text-white focus:border-brand-gold focus:outline-none resize-none"
      />
    </div>
  )
}

function SnsTab({ content }: { vehicle: Vehicle; content: GeneratedContent }) {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="border border-white/10 p-6 space-y-3">
        <p className="text-xs tracking-widest text-white/40 uppercase">Instagram キャプション</p>
        <pre className="text-sm text-white/80 whitespace-pre-wrap font-noto-sans leading-relaxed">
          {content.igCaption}
        </pre>
        <p className="text-sm text-brand-gold/70">{content.igHashtags}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigator.clipboard.writeText(`${content.igCaption}\n\n${content.igHashtags}`)}
          className="border-white/20 text-white/40"
        >
          コピー
        </Button>
      </div>

      <div className="border border-white/10 p-6 space-y-3">
        <p className="text-xs tracking-widest text-white/40 uppercase">Twitter / X</p>
        <p className="text-sm text-white/80 leading-relaxed">{content.tweetText}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigator.clipboard.writeText(content.tweetText)}
          className="border-white/20 text-white/40"
        >
          コピー
        </Button>
      </div>
    </div>
  )
}
