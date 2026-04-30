import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, ArrowUp, ArrowDown } from 'lucide-react'
import type { CarPhoto, PhotoTag } from '@/types'
import { compressForLpVariants } from '@/lib/compress'
import { uploadVariantsToR2 } from '@/lib/upload'
import { AccordionSection } from './edit-primitives'

const TAG_LABELS: Record<PhotoTag, string> = {
  hero: 'ヒーロー',
  exterior: 'エクステリア',
  interior: 'インテリア',
  detail: 'ディテール',
}
const TAG_ORDER: PhotoTag[] = ['hero', 'exterior', 'interior', 'detail']

/**
 * 編集タブ用：写真管理セクション。
 * 公開後でも追加・削除・タグ変更・並び替えが可能。
 * 新規アップロードは多サイズバリアント（2560 / 1280 / 640）を自動生成。
 */
export function EditPhotosSection({
  value,
  onChange,
  defaultOpen = false,
}: {
  value: CarPhoto[]
  onChange: (next: CarPhoto[]) => void
  defaultOpen?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' as '' | 'compress' | 'upload' })
  const [error, setError] = useState('')

  const onDrop = useCallback(
    async (files: File[]) => {
      if (value.length + files.length > 15) {
        setError('最大15枚までです')
        return
      }
      setUploading(true)
      setError('')
      setProgress({ current: 0, total: files.length, phase: 'compress' })
      const newPhotos: CarPhoto[] = []
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]
          const id = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
          const tag: PhotoTag = 'detail' // 追加時のデフォルトはディテール（ユーザーが後で変更）
          setProgress({ current: i + 1, total: files.length, phase: 'compress' })
          const variants = await compressForLpVariants(f, 'other')
          setProgress({ current: i + 1, total: files.length, phase: 'upload' })
          const { key, url, urlVariants } = await uploadVariantsToR2(variants)
          newPhotos.push({
            id,
            url,
            storageRef: key,
            tag,
            order: value.length + i,
            urlVariants,
          })
        }
        onChange([...value, ...newPhotos])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
      } finally {
        setUploading(false)
        setProgress({ current: 0, total: 0, phase: '' })
      }
    },
    [value, onChange],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 15,
    disabled: uploading || value.length >= 15,
  })

  function removePhoto(id: string) {
    const next = value.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i }))
    onChange(next)
  }

  function updateTag(id: string, tag: PhotoTag) {
    onChange(value.map((p) => (p.id === id ? { ...p, tag } : p)))
  }

  function move(id: string, direction: -1 | 1) {
    const idx = value.findIndex((p) => p.id === id)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    // order を再計算（配列順と一致させる）
    onChange(next.map((p, i) => ({ ...p, order: i })))
  }

  return (
    <AccordionSection title={`写真管理（${value.length}枚）`} defaultOpen={defaultOpen}>
      {error && (
        <p className="text-sm text-red-400 border border-red-900/40 bg-red-900/10 px-3 py-2">{error}</p>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed p-8 text-center cursor-pointer transition-all overflow-hidden ${
          isDragActive
            ? 'border-brand-gold bg-brand-gold/5'
            : uploading
              ? 'border-brand-gold/40 cursor-default'
              : value.length >= 15
                ? 'border-white/10 opacity-40 cursor-not-allowed'
                : 'border-white/20 hover:border-white/40'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-12 h-12">
              <motion.div className="absolute inset-0 rounded-full border-2 border-brand-gold/20" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-gold"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="text-xs text-white/60">
              {progress.phase === 'compress'
                ? `圧縮中... (${progress.current}/${progress.total})`
                : `アップロード中... (${progress.current}/${progress.total})`}
            </p>
          </div>
        ) : isDragActive ? (
          <>
            <Upload className="w-6 h-6 text-brand-gold mx-auto mb-2" />
            <p className="text-sm text-brand-gold">ここにドロップ</p>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/60">ドラッグ＆ドロップ、またはクリックして追加</p>
            <p className="text-[11px] text-white/30 mt-1">
              JPG / PNG / WebP（{value.length}/15 枚、自動的に多サイズ生成）
            </p>
          </>
        )}
      </div>

      {/* Photo grid */}
      <AnimatePresence>
        {value.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            {value.map((photo, idx) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group"
              >
                <div className="relative overflow-hidden" style={{ paddingBottom: '75%' }}>
                  <img src={photo.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label="削除"
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white/70 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {/* 並び替え（左下） */}
                  <div className="absolute bottom-1.5 left-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => move(photo.id, -1)}
                      disabled={idx === 0}
                      aria-label="前へ"
                      className="bg-black/60 text-white/70 hover:text-white p-1 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(photo.id, 1)}
                      disabled={idx === value.length - 1}
                      aria-label="次へ"
                      className="bg-black/60 text-white/70 hover:text-white p-1 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  {/* 順序表示（右下） */}
                  <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-[10px] text-white/70 px-1.5 py-0.5 font-mono">
                    {idx + 1}
                  </span>
                </div>
                {/* タグセレクタ */}
                <div className="flex mt-1.5 gap-1 flex-wrap">
                  {TAG_ORDER.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => updateTag(photo.id, tag)}
                      className={`text-[10px] px-2 py-0.5 transition-all ${
                        photo.tag === tag
                          ? 'bg-brand-gold text-black'
                          : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {TAG_LABELS[tag]}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-white/30 pt-2 leading-relaxed">
        ※ ヒーロー画像は「hero」タグの最初の写真。並び替えは ↑↓ で操作。
        旧データの写真は単一サイズのまま LP に反映され、再アップロードで多サイズ化されます。
      </p>
    </AccordionSection>
  )
}
