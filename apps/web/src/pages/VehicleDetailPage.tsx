import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Vehicle, GeneratedContent } from '@/types'
import { Button } from '@/components/ui/button'
import { LpPreview } from '@/components/LpPreview'
import { generateContent } from '@/lib/ai'
import { generateLpHtml } from '@/lib/lp-generator'
import { generateNarration } from '@/lib/tts'
import { generateVerticalImage, generateReelVideo } from '@/lib/reel'
import { generateFeedImage, generateOgpImage } from '@/lib/sns-image'
import { mergeVideoAudio } from '@/lib/merge-video'
import {
  ChevronLeft, Eye, Globe, RotateCcw, BadgeCheck, Edit, Sparkles, Check, Trash2, ChevronDown, Volume2,
  Video, Image, Copy, Download, Play, RefreshCw, Instagram, Film
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LpIndexEntry {
  slug: string
  name: string
  nameJa: string
  year: number
  price: string
  heroUrl: string
  status?: 'published' | 'sold'
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'preview' | 'edit' | 'audio' | 'sns'>('preview')
  const [publishing, setPublishing] = useState(false)
  const [publishPhase, setPublishPhase] = useState('')
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
    setPublishPhase('保存中...')
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

        // TTS音声生成（並行・失敗しても公開は止めない）
        setPublishPhase('音声生成中...')
        let audioUrl = vehicle.audioUrl ?? ''
        const ttsPromise = content.narrationText
          ? generateNarration(content.narrationText, vehicle.slug)
              .then(url => { audioUrl = url })
              .catch(e => console.error('TTS skipped:', e))
          : Promise.resolve()

        const vehicleWithAudio = { ...vehicle, detailPhotoUrls: detailPhotoUrls ?? vehicle.detailPhotoUrls, audioUrl }

        // TTS完了を待ってからHTML生成（audioUrlをHTMLに埋め込むため）
        await ttsPromise
        vehicleWithAudio.audioUrl = audioUrl

        setPublishPhase('LP生成中...')
        const html = generateLpHtml(vehicleWithAudio, content, false)
        setPublishPhase('アップロード中...')
        const uploadRes = await fetch(`${API_BASE}/api/upload/lp/${vehicle.slug}.html`, {
          method: 'PUT',
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: html,
        })
        if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status}`)

        // audioUrlをFirestoreに保存
        if (audioUrl) {
          await updateDoc(doc(db, 'vehicles', id), { audioUrl })
          setVehicle((prev) => prev ? { ...prev, audioUrl } : prev)
        }

        setPublishPhase('インデックス更新中...')
        await updateLpIndex(API_BASE, vehicle.slug, {
          slug: vehicle.slug,
          name: vehicle.basicInfo.name,
          nameJa: content.nameJa ?? '',
          year: vehicle.basicInfo.year,
          price: vehicle.basicInfo.isAsk ? 'ASK' : vehicle.basicInfo.price,
          heroUrl: vehicle.photos.find(p => p.tag === 'hero')?.url ?? vehicle.photos[0]?.url ?? '',
          status: 'published',
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
      setPublishPhase('')
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
    setPublishing(true)
    setPublishPhase('売約済みに変更中...')
    try {
      await updateDoc(doc(db, 'vehicles', id), {
        status: 'sold',
        soldAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setVehicle((prev) => prev ? { ...prev, status: 'sold' } : prev)

      const API_BASE = import.meta.env.VITE_API_BASE_URL
      const content = editedContent ?? vehicle.generatedContent
      if (content) {
        // Re-generate LP HTML with SOLD status
        setPublishPhase('SOLD LP生成中...')
        const soldVehicle = { ...vehicle, status: 'sold' as const, detailPhotoUrls: detailPhotoUrls ?? vehicle.detailPhotoUrls }
        const html = generateLpHtml(soldVehicle, content, false)
        await fetch(`${API_BASE}/api/upload/lp/${vehicle.slug}.html`, {
          method: 'PUT',
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: html,
        })
      }

      // Update index with sold status
      setPublishPhase('インデックス更新中...')
      const heroUrl = vehicle.photos.find(p => p.tag === 'hero')?.url ?? vehicle.photos[0]?.url ?? ''
      await updateLpIndex(API_BASE, vehicle.slug, {
        slug: vehicle.slug,
        name: vehicle.basicInfo.name,
        nameJa: editedContent?.nameJa ?? vehicle.generatedContent?.nameJa ?? '',
        year: vehicle.basicInfo.year,
        price: vehicle.basicInfo.isAsk ? 'ASK' : vehicle.basicInfo.price,
        heroUrl,
        status: 'sold',
      })
    } catch (e) {
      console.error('Mark sold error:', e)
    } finally {
      setPublishing(false)
      setPublishPhase('')
    }
  }

  async function handleRestoreFromSold() {
    if (!id || !vehicle) return
    await updateDoc(doc(db, 'vehicles', id), {
      status: 'draft',
      updatedAt: serverTimestamp(),
    })
    setVehicle((prev) => prev ? { ...prev, status: 'draft' } : prev)
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
            {vehicle.status === 'published' ? '公開中' : vehicle.status === 'sold' ? '売約済み' : '下書き'}
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
          {vehicle.status === 'sold' ? (
            <Button variant="ghost" size="sm" onClick={handleRestoreFromSold} className="text-white/40 hover:text-white border-white/20">
              <RotateCcw className="w-4 h-4" />
              下書きに戻す
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleMarkSold} className="text-white/40 hover:text-amber-400 border-white/20">
                <BadgeCheck className="w-4 h-4" />
                売約済み
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
          { key: 'audio', label: '音声', icon: Volume2 },
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

        {tab === 'audio' && editedContent && (
          <AudioTab
            vehicleId={id!}
            slug={vehicle.slug}
            content={editedContent}
            audioUrl={vehicle.audioUrl}
            onContentChange={(narrationText) => {
              const updated = { ...editedContent, narrationText }
              setEditedContent(updated)
            }}
            onAudioUrlChange={(url) => setVehicle((prev) => prev ? { ...prev, audioUrl: url } : prev)}
          />
        )}

        {tab === 'sns' && vehicle.generatedContent && (
          <SnsTab vehicle={vehicle} vehicleId={id!} />
        )}
      </main>

      {/* Full-screen processing overlay */}
      <AnimatePresence>
        {(publishing || regenerating) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-dark-bg/90 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-6">
              {/* Animated ring */}
              <div className="relative w-20 h-20">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-brand-gold/20"
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-gold"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute inset-1 rounded-full border border-transparent border-b-brand-gold/40"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  {publishing ? (
                    <Globe className="w-6 h-6 text-brand-gold" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-brand-gold" />
                  )}
                </div>
              </div>

              {/* Phase text */}
              <div className="text-center space-y-2">
                <motion.p
                  className="text-sm text-white font-light"
                  key={publishing ? publishPhase : 'regen'}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {publishing ? (publishPhase || '処理中...') : 'AIコンテンツ生成中...'}
                </motion.p>
                <p className="text-xs text-white/30">しばらくお待ちください</p>
              </div>

              {/* Pulsing dots */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand-gold/60"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AccordionSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-white/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="text-xs tracking-widest text-white/50 uppercase">{title}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 space-y-5">{children}</div>}
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
  const allUrls = photos.map((p) => p.url)
  const slots: [string, string, string, string] = detailPhotoUrls ?? ['', '', '', '']

  return (
    <div className="max-w-2xl space-y-4">
      {/* Hero section */}
      <AccordionSection title="ヒーロー / メインコピー" defaultOpen>
        <EditField
          label="車名（日本語）"
          value={content.nameJa ?? ''}
          onChange={(v) => onChange({ ...content, nameJa: v })}
        />
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
        <EditField
          label="プルクォート 2"
          value={content.pullQuote2 ?? ''}
          onChange={(v) => onChange({ ...content, pullQuote2: v })}
        />
      </AccordionSection>

      {/* Section 1 */}
      <AccordionSection title="セクション 1">
        <EditField
          label="タイトル"
          value={content.section1.title}
          onChange={(v) => onChange({ ...content, section1: { ...content.section1, title: v } })}
        />
        <EditField
          label="サブタイトル"
          value={content.section1.subtitle}
          onChange={(v) => onChange({ ...content, section1: { ...content.section1, subtitle: v } })}
        />
        <EditTextarea
          label="ストーリー"
          value={content.section1.story}
          onChange={(v) => onChange({ ...content, section1: { ...content.section1, story: v } })}
        />
      </AccordionSection>

      {/* Section 2 */}
      <AccordionSection title="セクション 2">
        <EditField
          label="タイトル"
          value={content.section2.title}
          onChange={(v) => onChange({ ...content, section2: { ...content.section2, title: v } })}
        />
        <EditField
          label="サブタイトル"
          value={content.section2.subtitle}
          onChange={(v) => onChange({ ...content, section2: { ...content.section2, subtitle: v } })}
        />
        <EditTextarea
          label="ストーリー"
          value={content.section2.story}
          onChange={(v) => onChange({ ...content, section2: { ...content.section2, story: v } })}
        />
      </AccordionSection>

      {/* Section 3 / Details */}
      <AccordionSection title="セクション 3 / ディテール">
        <EditField
          label="タイトル"
          value={content.section3.title}
          onChange={(v) => onChange({ ...content, section3: { ...content.section3, title: v } })}
        />
        <EditField
          label="サブタイトル"
          value={content.section3.subtitle}
          onChange={(v) => onChange({ ...content, section3: { ...content.section3, subtitle: v } })}
        />
        <div className="grid grid-cols-2 gap-4 pt-2">
          {(content.section3?.details ?? []).slice(0, 4).map((detail, i) => (
            <div key={i} className="space-y-2 border border-white/5 p-3">
              <EditField
                label={`ディテール ${i + 1} キャプション`}
                value={detail.caption}
                onChange={(v) => {
                  const details = [...(content.section3.details ?? [])]
                  details[i] = { ...details[i], caption: v }
                  onChange({ ...content, section3: { ...content.section3, details } })
                }}
              />
              <EditTextarea
                label="説明"
                value={detail.description}
                onChange={(v) => {
                  const details = [...(content.section3.details ?? [])]
                  details[i] = { ...details[i], description: v }
                  onChange({ ...content, section3: { ...content.section3, details } })
                }}
                rows={3}
              />
              {/* Photo picker */}
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
                    className={`relative w-12 h-12 overflow-hidden border-2 transition-all ${
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
      </AccordionSection>

      {/* SEO */}
      <AccordionSection title="SEO">
        <EditField
          label="メタディスクリプション"
          value={content.seo?.metaDescription ?? ''}
          onChange={(v) => onChange({ ...content, seo: { ...content.seo!, metaDescription: v, keywords: content.seo?.keywords ?? '', ogDescription: content.seo?.ogDescription ?? '' } })}
        />
        <EditField
          label="キーワード"
          value={content.seo?.keywords ?? ''}
          onChange={(v) => onChange({ ...content, seo: { ...content.seo!, metaDescription: content.seo?.metaDescription ?? '', keywords: v, ogDescription: content.seo?.ogDescription ?? '' } })}
        />
        <EditField
          label="OG ディスクリプション"
          value={content.seo?.ogDescription ?? ''}
          onChange={(v) => onChange({ ...content, seo: { ...content.seo!, metaDescription: content.seo?.metaDescription ?? '', keywords: content.seo?.keywords ?? '', ogDescription: v } })}
        />
      </AccordionSection>

      {/* Narration text (read-only preview, full edit in Audio tab) */}
      <AccordionSection title="ナレーションテキスト">
        <EditTextarea
          label="ナレーション原稿（音声タブで詳細編集・再生成）"
          value={content.narrationText ?? ''}
          onChange={(v) => onChange({ ...content, narrationText: v })}
          rows={8}
        />
      </AccordionSection>

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

function EditTextarea({ label, value, onChange, rows = 6 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
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

function AudioTab({
  vehicleId,
  slug,
  content,
  audioUrl,
  onContentChange,
  onAudioUrlChange,
}: {
  vehicleId: string
  slug: string
  content: GeneratedContent
  audioUrl?: string
  onContentChange: (narrationText: string) => void
  onAudioUrlChange: (url: string) => void
}) {
  const [localText, setLocalText] = useState(content.narrationText ?? '')
  const [savingText, setSavingText] = useState(false)
  const [savedText, setSavedText] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [regenOk, setRegenOk] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Sync if content changes externally
  useEffect(() => {
    setLocalText(content.narrationText ?? '')
  }, [content.narrationText])

  async function handleSaveText() {
    setSavingText(true)
    setSavedText(false)
    try {
      await updateDoc(doc(db, 'vehicles', vehicleId), {
        'generatedContent.narrationText': localText,
        updatedAt: serverTimestamp(),
      })
      onContentChange(localText)
      setSavedText(true)
      setTimeout(() => setSavedText(false), 2500)
    } finally {
      setSavingText(false)
    }
  }

  async function handleRegenerateAudio() {
    if (!localText.trim()) return
    setRegenerating(true)
    setRegenError('')
    setRegenOk(false)
    try {
      // Save text first
      await updateDoc(doc(db, 'vehicles', vehicleId), {
        'generatedContent.narrationText': localText,
        updatedAt: serverTimestamp(),
      })
      onContentChange(localText)

      // Generate audio (overwrites same R2 key)
      const url = await generateNarration(localText, slug)
      if (!url) throw new Error('音声生成に失敗しました')

      await updateDoc(doc(db, 'vehicles', vehicleId), { audioUrl: url })
      onAudioUrlChange(url)
      setRegenOk(true)
      setTimeout(() => setRegenOk(false), 3000)

      // Force reload audio element
      if (audioRef.current) {
        audioRef.current.load()
      }
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : '音声生成に失敗しました')
    } finally {
      setRegenerating(false)
    }
  }

  const textChanged = localText !== (content.narrationText ?? '')

  return (
    <div className="max-w-2xl space-y-8">
      {/* Current audio player */}
      <div className="border border-white/10 p-6 space-y-4">
        <p className="text-xs tracking-widest text-white/40 uppercase flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5" />
          現在の音声
        </p>
        {audioUrl ? (
          <audio ref={audioRef} controls className="w-full" key={audioUrl}>
            <source src={`${audioUrl}?t=${Date.now()}`} type="audio/mpeg" />
          </audio>
        ) : (
          <p className="text-sm text-white/30">音声がまだ生成されていません。下のテキストを確認して「音声を再生成」してください。</p>
        )}
      </div>

      {/* Narration text editor */}
      <div className="border border-white/10 p-6 space-y-4">
        <p className="text-xs tracking-widest text-white/40 uppercase">ナレーション原稿</p>
        <p className="text-xs text-white/30">
          ElevenLabs音声タグ対応（[calm], [whispers], [pause 1.5s] など）。編集後「テキスト保存」でFirestoreに保存。「音声を再生成」でTTS再実行。
        </p>
        <textarea
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          rows={14}
          className="w-full border border-white/20 bg-transparent p-4 text-sm text-white/80 leading-relaxed focus:border-brand-gold focus:outline-none resize-none font-mono"
          placeholder="ナレーションテキストがありません..."
        />

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveText}
            disabled={savingText || !textChanged}
            className="border-white/20 text-white/60 hover:text-white"
          >
            {savingText ? '保存中...' : savedText ? '✓ 保存済み' : 'テキスト保存'}
          </Button>
          <Button
            size="sm"
            onClick={handleRegenerateAudio}
            disabled={regenerating || !localText.trim()}
          >
            <Volume2 className={`w-4 h-4 ${regenerating ? 'animate-pulse' : ''}`} />
            {regenerating ? '生成中...' : '音声を再生成'}
          </Button>
        </div>

        {/* Audio generation progress */}
        <AnimatePresence>
          {regenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border border-brand-gold/20 bg-brand-gold/5 p-5 flex items-center gap-4">
                <div className="relative w-10 h-10 shrink-0">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-gold"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-brand-gold" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-white/70">ElevenLabsで音声を生成しています...</p>
                  <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-brand-gold/60"
                      initial={{ width: '5%' }}
                      animate={{ width: ['5%', '60%', '80%', '90%'] }}
                      transition={{ duration: 25, times: [0, 0.3, 0.7, 1], ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {regenError && (
          <p className="text-xs text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">{regenError}</p>
        )}
        <AnimatePresence>
          {regenOk && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-brand-gold border border-brand-gold/30 bg-brand-gold/5 px-3 py-2"
            >
              音声を再生成しました。公開中のLPは自動的に更新されます。
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-white/20 leading-relaxed">
        ※ 音声ファイルはスラッグ（{slug}）に紐づいています。再生成するとR2上の同じファイルが上書きされるため、公開中のLPも自動で最新の音声に切り替わります。LPの再公開は不要です。
      </p>
    </div>
  )
}

function SnsTab({ vehicle, vehicleId }: { vehicle: Vehicle; vehicleId: string }) {
  const content = vehicle.generatedContent!
  const [reelPhase, setReelPhase] = useState('')
  const [reelError, setReelError] = useState('')
  const [generatingReel, setGeneratingReel] = useState(false)
  const [generatingFeed, setGeneratingFeed] = useState(false)
  const [generatingOgp, setGeneratingOgp] = useState(false)

  // Editable fields (init from vehicle, fallback to generatedContent)
  const [caption, setCaption] = useState(vehicle.caption ?? content.igCaption ?? '')
  const [hashtags, setHashtags] = useState(vehicle.hashtags ?? content.igHashtags ?? '')
  const [reelNarrationText, setReelNarrationText] = useState(vehicle.reelNarration ?? content.reelNarration ?? '')
  const [generatingReelAudio, setGeneratingReelAudio] = useState(false)
  const [reelAudioError, setReelAudioError] = useState('')

  // Local state for URLs (mirrors vehicle)
  const [verticalImageUrl, setVerticalImageUrl] = useState(vehicle.verticalImageUrl ?? '')
  const [reelVideoUrl, setReelVideoUrl] = useState(vehicle.reelVideoUrl ?? '')
  const [reelAudioUrl, setReelAudioUrl] = useState(vehicle.reelAudioUrl ?? '')
  const [feedImageUrl, setFeedImageUrl] = useState(vehicle.feedImageUrl ?? '')
  const [ogpImageUrl, setOgpImageUrl] = useState(vehicle.ogpImageUrl ?? '')

  const [copied, setCopied] = useState('')
  const [savedCaption, setSavedCaption] = useState(false)
  const [mergingVideo, setMergingVideo] = useState(false)
  const [mergePhase, setMergePhase] = useState('')
  const [mergeError, setMergeError] = useState('')

  const heroUrl = vehicle.photos.find(p => p.tag === 'hero')?.url ?? vehicle.photos[0]?.url ?? ''
  const isPublished = vehicle.status === 'published' || vehicle.status === 'sold'
  const reelAudioRef = useRef<HTMLAudioElement>(null)

  async function handleGenerateReel() {
    if (!heroUrl) return
    setGeneratingReel(true)
    setReelError('')
    try {
      // Step 1: 縦長画像生成
      setReelPhase('縦長画像を生成中...')
      let vUrl = verticalImageUrl
      if (!vUrl) {
        vUrl = await generateVerticalImage(heroUrl, vehicle.slug, setReelPhase)
        setVerticalImageUrl(vUrl)
        await updateDoc(doc(db, 'vehicles', vehicleId), { verticalImageUrl: vUrl })
      }

      // Step 2: リール動画生成
      setReelPhase('リール動画を生成中（5〜10分）...')
      const videoUrl = await generateReelVideo(vUrl, vehicle.slug, setReelPhase)
      setReelVideoUrl(videoUrl)
      await updateDoc(doc(db, 'vehicles', vehicleId), { reelVideoUrl: videoUrl })
      setReelPhase('')
    } catch (e) {
      console.error('Reel generation error:', e)
      setReelError(e instanceof Error ? e.message : 'リール動画の生成に失敗しました')
      setReelPhase('')
    } finally {
      setGeneratingReel(false)
    }
  }

  async function handleRegenerateReel() {
    // Clear vertical image to force re-generation
    setVerticalImageUrl('')
    await updateDoc(doc(db, 'vehicles', vehicleId), { verticalImageUrl: '', reelVideoUrl: '' })
    setReelVideoUrl('')
    handleGenerateReel()
  }

  async function handleGenerateReelAudio() {
    if (!reelNarrationText.trim()) return
    setGeneratingReelAudio(true)
    setReelAudioError('')
    try {
      // Save text first
      await updateDoc(doc(db, 'vehicles', vehicleId), {
        reelNarration: reelNarrationText,
        updatedAt: serverTimestamp(),
      })
      // Generate audio (slug-reel to not collide with LP audio)
      const url = await generateNarration(reelNarrationText, `${vehicle.slug}-reel`)
      if (!url) throw new Error('音声生成に失敗しました')
      setReelAudioUrl(url)
      await updateDoc(doc(db, 'vehicles', vehicleId), { reelAudioUrl: url })
      if (reelAudioRef.current) reelAudioRef.current.load()
    } catch (e) {
      setReelAudioError(e instanceof Error ? e.message : '音声生成に失敗しました')
    } finally {
      setGeneratingReelAudio(false)
    }
  }

  async function handleGenerateFeed() {
    if (!heroUrl) return
    setGeneratingFeed(true)
    try {
      const url = await generateFeedImage(heroUrl, vehicle.slug)
      setFeedImageUrl(url)
      await updateDoc(doc(db, 'vehicles', vehicleId), { feedImageUrl: url })
    } catch (e) {
      console.error('Feed image error:', e)
    } finally {
      setGeneratingFeed(false)
    }
  }

  async function handleGenerateOgp() {
    if (!heroUrl) return
    setGeneratingOgp(true)
    try {
      const url = await generateOgpImage(heroUrl, vehicle.slug, vehicle.basicInfo.name)
      setOgpImageUrl(url)
      await updateDoc(doc(db, 'vehicles', vehicleId), { ogpImageUrl: url })
    } catch (e) {
      console.error('OGP image error:', e)
    } finally {
      setGeneratingOgp(false)
    }
  }

  async function handleSaveCaption() {
    await updateDoc(doc(db, 'vehicles', vehicleId), {
      caption,
      hashtags,
      updatedAt: serverTimestamp(),
    })
    setSavedCaption(true)
    setTimeout(() => setSavedCaption(false), 2500)
  }

  async function handleMergeDownload() {
    if (!reelVideoUrl || !reelAudioUrl) return
    setMergingVideo(true)
    setMergeError('')
    try {
      const blob = await mergeVideoAudio(reelVideoUrl, reelAudioUrl, setMergePhase)

      // モバイル: Web Share API で写真アプリに保存
      if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        const file = new File([blob], `${vehicle.slug}-reel-final.mp4`, { type: 'video/mp4' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] })
          setMergingVideo(false)
          return
        }
      }

      // デスクトップ: ダウンロード
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${vehicle.slug}-reel-final.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      console.error('Merge error:', e)
      setMergeError(e instanceof Error ? e.message : '結合に失敗しました')
    } finally {
      setMergingVideo(false)
      setMergePhase('')
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  async function downloadUrl(url: string, filename: string) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()

      // モバイル: Web Share API で写真アプリに保存可能
      if (navigator.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        const ext = filename.split('.').pop()?.toLowerCase()
        const mimeMap: Record<string, string> = { mp4: 'video/mp4', mp3: 'audio/mpeg', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
        const mime = mimeMap[ext ?? ''] ?? blob.type
        const file = new File([blob], filename, { type: mime })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] })
          return
        }
      }

      // デスクトップ: ダウンロードフォルダに保存
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank')
    }
  }

  if (!isPublished) {
    return (
      <div className="max-w-2xl">
        <div className="border border-white/10 p-12 text-center space-y-4">
          <Instagram className="w-8 h-8 text-white/20 mx-auto" />
          <p className="text-sm text-white/40">LPを公開するとSNS素材が利用可能になります</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-cormorant text-2xl font-light text-white mb-1">SNS素材</h2>
        <p className="text-xs text-white/30">各素材は独立して生成・再生成できます</p>
      </div>

      {/* ── リール動画 ── */}
      <div className="border border-white/10">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Video className="w-4 h-4 text-brand-gold/60" />
          <span className="text-xs tracking-widest text-white/50 uppercase">リール動画</span>
        </div>
        <div className="p-5 space-y-4">
          {reelVideoUrl ? (
            <>
              <video
                src={`${reelVideoUrl}?t=${Date.now()}`}
                controls
                className="w-full max-w-xs mx-auto aspect-[9/16] bg-black object-contain"
              />
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" size="sm" onClick={() => downloadUrl(reelVideoUrl, `${vehicle.slug}-reel.mp4`)} className="border-white/20 text-white/50">
                  <Download className="w-3.5 h-3.5" /> ダウンロード
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRegenerateReel} disabled={generatingReel} className="border-white/20 text-white/50">
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingReel ? 'animate-spin' : ''}`} /> 再生成
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              {generatingReel ? (
                <div className="space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <motion.div className="absolute inset-0 rounded-full border-2 border-brand-gold/20" />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-gold"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-5 h-5 text-brand-gold" />
                    </div>
                  </div>
                  <motion.p
                    className="text-sm text-white/60"
                    key={reelPhase}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {reelPhase || '生成中...'}
                  </motion.p>
                  <p className="text-xs text-white/25">動画生成には5〜10分かかります</p>
                </div>
              ) : (
                <>
                  <Video className="w-8 h-8 text-white/15 mx-auto" />
                  <p className="text-xs text-white/30">ヒーロー写真から9:16リール動画を生成します</p>
                  <Button size="sm" onClick={handleGenerateReel} disabled={!heroUrl}>
                    <Play className="w-3.5 h-3.5" /> 動画を生成
                  </Button>
                </>
              )}
            </div>
          )}
          {reelError && <p className="text-xs text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">{reelError}</p>}
        </div>
      </div>

      {/* ── 結合済みリール動画 ── */}
      {reelVideoUrl && reelAudioUrl && (
        <div className="border border-brand-gold/20 bg-brand-gold/5">
          <div className="px-5 py-4 border-b border-brand-gold/10 flex items-center gap-2">
            <Film className="w-4 h-4 text-brand-gold/60" />
            <span className="text-xs tracking-widest text-white/50 uppercase">結合済みリール（動画+音声）</span>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-white/40">動画とナレーションを1つのファイルに結合してダウンロード。そのままInstagramに投稿できます。</p>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleMergeDownload} disabled={mergingVideo}>
                {mergingVideo ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> {mergePhase || '結合中...'}</>
                ) : (
                  <><Download className="w-3.5 h-3.5" /> 結合してダウンロード</>
                )}
              </Button>
            </div>
            {mergeError && <p className="text-xs text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">{mergeError}</p>}
          </div>
        </div>
      )}

      {/* ── リールナレーション ── */}
      <div className="border border-white/10">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-brand-gold/60" />
          <span className="text-xs tracking-widest text-white/50 uppercase">リールナレーション</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-white/30">テキストを編集してから「音声を生成」してください。Instagramでリール動画に重ねて使います。</p>
          <textarea
            value={reelNarrationText}
            onChange={(e) => setReelNarrationText(e.target.value)}
            rows={4}
            className="w-full border border-white/20 bg-transparent p-3 text-sm text-white/80 leading-relaxed focus:border-brand-gold focus:outline-none resize-none font-mono"
            placeholder="リールナレーションテキスト..."
          />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleGenerateReelAudio} disabled={generatingReelAudio || !reelNarrationText.trim()}>
              <Volume2 className={`w-3.5 h-3.5 ${generatingReelAudio ? 'animate-pulse' : ''}`} />
              {generatingReelAudio ? '生成中...' : '音声を生成'}
            </Button>
          </div>

          {/* Reel audio generation progress */}
          <AnimatePresence>
            {generatingReelAudio && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-brand-gold/20 bg-brand-gold/5 p-4 flex items-center gap-4">
                  <motion.div
                    className="w-8 h-8 rounded-full border-2 border-transparent border-t-brand-gold shrink-0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <p className="text-sm text-white/60">ElevenLabsで音声を生成しています...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {reelAudioUrl && (
            <div className="space-y-3 pt-2">
              <audio ref={reelAudioRef} controls className="w-full" key={reelAudioUrl}>
                <source src={`${reelAudioUrl}?t=${Date.now()}`} type="audio/mpeg" />
              </audio>
              <Button variant="ghost" size="sm" onClick={() => downloadUrl(reelAudioUrl, `${vehicle.slug}-reel-narration.mp3`)} className="border-white/20 text-white/50">
                <Download className="w-3.5 h-3.5" /> ダウンロード
              </Button>
            </div>
          )}
          {reelAudioError && <p className="text-xs text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">{reelAudioError}</p>}
        </div>
      </div>

      {/* ── フィード画像 ── */}
      <div className="border border-white/10">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Image className="w-4 h-4 text-brand-gold/60" />
          <span className="text-xs tracking-widest text-white/50 uppercase">フィード画像（1080x1080）</span>
        </div>
        <div className="p-5 space-y-4">
          {feedImageUrl ? (
            <>
              <img src={`${feedImageUrl}?t=${Date.now()}`} alt="Feed" className="w-full max-w-xs mx-auto aspect-square object-cover" />
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" size="sm" onClick={() => downloadUrl(feedImageUrl, `${vehicle.slug}-feed.jpg`)} className="border-white/20 text-white/50">
                  <Download className="w-3.5 h-3.5" /> ダウンロード
                </Button>
                <Button variant="ghost" size="sm" onClick={handleGenerateFeed} disabled={generatingFeed} className="border-white/20 text-white/50">
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingFeed ? 'animate-spin' : ''}`} /> 再生成
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <Button size="sm" onClick={handleGenerateFeed} disabled={generatingFeed || !heroUrl}>
                {generatingFeed ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 生成中...</>
                ) : (
                  <><Image className="w-3.5 h-3.5" /> フィード画像を生成</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── OGP画像 ── */}
      <div className="border border-white/10">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Globe className="w-4 h-4 text-brand-gold/60" />
          <span className="text-xs tracking-widest text-white/50 uppercase">OGP画像（1200x630）</span>
        </div>
        <div className="p-5 space-y-4">
          {ogpImageUrl ? (
            <>
              <img src={`${ogpImageUrl}?t=${Date.now()}`} alt="OGP" className="w-full aspect-[1200/630] object-cover" />
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" size="sm" onClick={() => downloadUrl(ogpImageUrl, `${vehicle.slug}-ogp.jpg`)} className="border-white/20 text-white/50">
                  <Download className="w-3.5 h-3.5" /> ダウンロード
                </Button>
                <Button variant="ghost" size="sm" onClick={handleGenerateOgp} disabled={generatingOgp} className="border-white/20 text-white/50">
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingOgp ? 'animate-spin' : ''}`} /> 再生成
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <Button size="sm" onClick={handleGenerateOgp} disabled={generatingOgp || !heroUrl}>
                {generatingOgp ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 生成中...</>
                ) : (
                  <><Globe className="w-3.5 h-3.5" /> OGP画像を生成</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── キャプション + ハッシュタグ ── */}
      <div className="border border-white/10">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Instagram className="w-4 h-4 text-brand-gold/60" />
          <span className="text-xs tracking-widest text-white/50 uppercase">キャプション + ハッシュタグ</span>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            className="w-full border border-white/20 bg-transparent p-3 text-sm text-white/80 leading-relaxed focus:border-brand-gold focus:outline-none resize-none"
            placeholder="キャプション..."
          />
          <textarea
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            rows={2}
            className="w-full border border-white/20 bg-transparent p-3 text-sm text-brand-gold/70 focus:border-brand-gold focus:outline-none resize-none"
            placeholder="#HiTopCorp #車名..."
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={handleSaveCaption} className="border-white/20 text-white/50">
              {savedCaption ? <><Check className="w-3.5 h-3.5" /> 保存済み</> : '保存'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyText(`${caption}\n\n${hashtags}`, 'caption')}
              className="border-white/20 text-white/50"
            >
              <Copy className="w-3.5 h-3.5" /> {copied === 'caption' ? 'コピー済み' : 'コピー'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 投稿手順 ── */}
      <div className="border border-brand-gold/10 bg-brand-gold/3 p-5 space-y-3">
        <p className="text-xs tracking-widest text-brand-gold/50 uppercase">投稿手順</p>
        <ol className="space-y-1.5 text-xs text-white/40 leading-relaxed list-decimal list-inside">
          <li>リール動画をダウンロード</li>
          <li>Instagramでリール投稿</li>
          <li>リールナレーション音声を動画に重ねる</li>
          <li>キャプションを貼り付け</li>
          <li>同じ動画をストーリーズにも投稿</li>
          <li>ストーリーズにリンクスタンプでLP URLを貼る</li>
        </ol>
        {vehicle.status === 'published' && (
          <p className="text-xs text-brand-gold/40 pt-2 border-t border-brand-gold/10">
            LP URL: hitoplp-api.hitopcorp.workers.dev/{vehicle.slug}
          </p>
        )}
      </div>
    </div>
  )
}
