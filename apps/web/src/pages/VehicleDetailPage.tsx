import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Vehicle, GeneratedContent } from '@/types'
import { Button } from '@/components/ui/button'
import { LpPreview } from '@/components/LpPreview'
import { generateContent } from '@/lib/ai'
import { generateLpHtml } from '@/lib/lp-generator'
import {
  ChevronLeft, Eye, Globe, RotateCcw, BadgeCheck, Edit, Sparkles, Check, Trash2
} from 'lucide-react'

interface LpIndexEntry {
  slug: string
  name: string
  nameJa: string
  year: number
  price: string
  heroUrl: string
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'preview' | 'edit' | 'sns'>('preview')
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [editedContent, setEditedContent] = useState<GeneratedContent | null>(null)
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<[string, string, string, string] | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'vehicles', id)).then((snap) => {
      if (snap.exists()) {
        const v = { id: snap.id, ...snap.data() } as Vehicle
        setVehicle(v)
        if (v.generatedContent) setEditedContent(v.generatedContent)
        if (v.detailPhotoUrls) setDetailPhotoUrls(v.detailPhotoUrls)
      }
      setLoading(false)
    })
  }, [id])

  async function handlePublish() {
    if (!id || !vehicle) return
    setPublishing(true)
    setPublishError('')
    const nextStatus = vehicle.status === 'published' ? 'draft' : 'published'

    try {
      // 1. Firestoreを先に更新（権威的な状態）
      await updateDoc(doc(db, 'vehicles', id), {
        status: nextStatus,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // 2. UIを即時更新
      setVehicle((prev) => prev ? { ...prev, status: nextStatus } : prev)

      // 3. R2アップロード（ベストエフォート）
      const API_BASE = import.meta.env.VITE_API_BASE_URL
      if (nextStatus === 'published' && vehicle.generatedContent) {
        const content = editedContent ?? vehicle.generatedContent
        const html = generateLpHtml(
          { ...vehicle, detailPhotoUrls: detailPhotoUrls ?? vehicle.detailPhotoUrls },
          content,
          false
        )
        const uploadRes = await fetch(`${API_BASE}/api/upload/lp/${vehicle.slug}.html`, {
          method: 'PUT',
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: html,
        })
        if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status}`)

        await updateLpIndex(API_BASE, vehicle.slug, {
          slug: vehicle.slug,
          name: vehicle.basicInfo.name,
          nameJa: content.nameJa ?? '',
          year: vehicle.basicInfo.year,
          price: vehicle.basicInfo.isAsk ? 'ASK' : vehicle.basicInfo.price,
          heroUrl: vehicle.photos.find(p => p.tag === 'hero')?.url ?? vehicle.photos[0]?.url ?? '',
        })
      } else if (nextStatus === 'draft') {
        const API_BASE2 = import.meta.env.VITE_API_BASE_URL
        await updateLpIndex(API_BASE2, vehicle.slug, null)
      }
    } catch (e) {
      console.error('Publish error:', e)
      setPublishError(e instanceof Error ? e.message : '公開処理中にエラーが発生しました')
    } finally {
      setPublishing(false)
    }
  }

  async function updateLpIndex(apiBase: string, slug: string, entry: LpIndexEntry | null) {
    // 現在のindex取得
    let index: LpIndexEntry[] = []
    try {
      const res = await fetch(`${apiBase}/api/image/lp/index.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) index = await res.json()
    } catch { /* 初回は空 */ }

    if (entry === null) {
      index = index.filter(e => e.slug !== slug)
    } else {
      index = index.filter(e => e.slug !== slug)
      index.unshift(entry) // 新しい順に先頭へ
    }

    await fetch(`${apiBase}/api/upload/lp/index.json`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(index),
    })
  }

  async function handleDelete() {
    if (!id || !vehicle) return
    if (!window.confirm('このLPを削除しますか？この操作は取り消せません。')) return
    // Remove from R2 index + delete HTML
    const API_BASE = import.meta.env.VITE_API_BASE_URL
    try {
      await updateLpIndex(API_BASE, vehicle.slug, null)
      await fetch(`${API_BASE}/api/upload/lp/${vehicle.slug}.html`, {
        method: 'PUT',
        headers: { 'content-type': 'text/html' },
        body: '',
      })
    } catch { /* best effort */ }
    await deleteDoc(doc(db, 'vehicles', id))
    navigate('/')
  }

  async function handleMarkSold() {
    if (!id || !vehicle) return
    await updateDoc(doc(db, 'vehicles', id), {
      status: 'sold',
      soldAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setVehicle((prev) => prev ? { ...prev, status: 'sold' } : prev)
    // Remove from public index
    const API_BASE = import.meta.env.VITE_API_BASE_URL
    try { await updateLpIndex(API_BASE, vehicle.slug, null) } catch { /* best effort */ }
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
    setSaving(true)
    setSaveError('')
    setSaveOk(false)
    try {
      await updateDoc(doc(db, 'vehicles', id), {
        generatedContent: editedContent,
        ...(detailPhotoUrls ? { detailPhotoUrls } : {}),
        updatedAt: serverTimestamp(),
      })
      setVehicle((prev) => prev ? { ...prev, generatedContent: editedContent, detailPhotoUrls } : prev)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
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
          {publishError && (
            <span className="text-xs text-red-400 max-w-xs truncate" title={publishError}>
              ⚠ {publishError}
            </span>
          )}
          {vehicle.status === 'published' && (
            <a
              href={`https://hitoplp-api.hitopcorp.workers.dev/${vehicle.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="本番を開く"
              className="flex items-center justify-center w-8 h-8 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 transition-all"
            >
              <Globe className="w-4 h-4" />
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-white/20 hover:text-red-400 border-white/10">
            <Trash2 className="w-4 h-4" />
          </Button>
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
                {publishing ? '処理中...' : vehicle.status === 'published' ? '非公開にする' : '公開する'}
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
            {vehicle.status === 'published' && (
              <a
                href={`https://hitoplp-api.hitopcorp.workers.dev/${vehicle.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-3 bg-brand-gold/5 border border-brand-gold/30 hover:border-brand-gold transition-all group"
              >
                <div>
                  <p className="text-[10px] tracking-widest text-brand-gold/60 uppercase mb-0.5">公開中 — 本番URL</p>
                  <p className="text-sm text-brand-gold font-light">hitoplp-api.hitopcorp.workers.dev/{vehicle.slug}</p>
                </div>
                <Globe className="w-4 h-4 text-brand-gold/50 group-hover:text-brand-gold transition-colors" />
              </a>
            )}
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
              <LpPreview
                vehicle={{ ...vehicle, detailPhotoUrls: detailPhotoUrls ?? vehicle.detailPhotoUrls }}
                content={editedContent ?? vehicle.generatedContent}
              />
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
            saving={saving}
            saveError={saveError}
            saveOk={saveOk}
            photos={vehicle.photos}
            detailPhotoUrls={detailPhotoUrls}
            onDetailPhotoUrlsChange={setDetailPhotoUrls}
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
  saving,
  saveError,
  saveOk,
  photos,
  detailPhotoUrls,
  onDetailPhotoUrlsChange,
}: {
  content: GeneratedContent
  onChange: (c: GeneratedContent) => void
  onSave: () => void
  saving: boolean
  saveError: string
  saveOk: boolean
  photos: Vehicle['photos']
  detailPhotoUrls: [string, string, string, string] | undefined
  onDetailPhotoUrlsChange: (urls: [string, string, string, string]) => void
}) {
  // Build default slots from photos if not set
  const allUrls = photos.map((p) => p.url)
  const slots: [string, string, string, string] = detailPhotoUrls ?? ['', '', '', '']

  return (
    <div className="max-w-2xl space-y-8">
      {/* Detail photo slots */}
      <div className="space-y-4">
        <p className="text-xs tracking-widest text-white/40 uppercase">ディテール写真の割り当て</p>
        <div className="grid grid-cols-2 gap-4">
          {(content.section3?.details ?? []).slice(0, 4).map((detail, i) => (
            <div key={i} className="space-y-2">
              <p className="text-xs text-brand-gold">{detail.caption}</p>
              <p className="text-xs text-white/30 leading-relaxed">{detail.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      const next: [string, string, string, string] = [...slots] as [string, string, string, string]
                      next[i] = url
                      onDetailPhotoUrlsChange(next)
                    }}
                    className={`relative w-14 h-14 overflow-hidden border-2 transition-all ${
                      slots[i] === url ? 'border-brand-gold' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {slots[i] === url && (
                      <div className="absolute inset-0 bg-brand-gold/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <hr className="border-white/10" />
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
      {saveError && <p className="text-xs text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">{saveError}</p>}
      {saveOk && <p className="text-xs text-brand-gold border border-brand-gold/30 bg-brand-gold/5 px-3 py-2">保存しました</p>}
      <Button onClick={onSave} disabled={saving} className="w-full">
        {saving ? '保存中...' : '変更を保存'}
      </Button>
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
