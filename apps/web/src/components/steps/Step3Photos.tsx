import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadVariantsToR2 } from '@/lib/upload'
import { compressForLpVariants } from '@/lib/compress'
import { Button } from '@/components/ui/button'
import type { CarPhoto, PhotoTag, Situation } from '@/types'
import { PHOTO_ADVICE } from '@/types'
import { Upload, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const TAG_LABELS: Record<PhotoTag, string> = {
  hero: 'ヒーロー',
  exterior: 'エクステリア',
  interior: 'インテリア',
  detail: 'ディテール',
}

const TAG_ORDER: PhotoTag[] = ['hero', 'exterior', 'interior', 'detail']

function guessTag(index: number): PhotoTag {
  if (index === 0) return 'hero'
  if (index <= 3) return 'exterior'
  if (index <= 6) return 'interior'
  return 'detail'
}

interface Props {
  situation: Situation
  onNext: (photos: CarPhoto[]) => void
  defaultPhotos?: CarPhoto[]
}

export function Step3Photos({ situation, onNext, defaultPhotos = [] }: Props) {
  const [photos, setPhotos] = useState<CarPhoto[]>(defaultPhotos)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, phase: '' as '' | 'compress' | 'upload' })
  const [uploadError, setUploadError] = useState('')

  const advice = PHOTO_ADVICE[situation]

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (photos.length + acceptedFiles.length > 15) {
      alert('最大15枚までです')
      return
    }
    setUploading(true)
    setUploadError('')
    setUploadProgress({ current: 0, total: acceptedFiles.length, phase: 'compress' })
    const newPhotos: CarPhoto[] = []
    try {
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        const id = `${Date.now()}-${i}`
        const tag = guessTag(photos.length + i)
        // 圧縮フェーズ（多サイズバリアント生成）
        setUploadProgress({ current: i + 1, total: acceptedFiles.length, phase: 'compress' })
        const variants = await compressForLpVariants(file, tag === 'hero' ? 'hero' : 'other')
        // アップロードフェーズ（並列で全 variant を R2 へ）
        setUploadProgress({ current: i + 1, total: acceptedFiles.length, phase: 'upload' })
        const { key, url, urlVariants } = await uploadVariantsToR2(variants)
        newPhotos.push({
          id,
          url,
          storageRef: key,
          tag,
          order: photos.length + i,
          urlVariants,
        })
      }
      setPhotos((prev) => [...prev, ...newPhotos])
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
      setUploadProgress({ current: 0, total: 0, phase: '' })
    }
  }, [photos.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 15,
    disabled: uploading || photos.length >= 15,
  })

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  function updateTag(id: string, tag: PhotoTag) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, tag } : p)))
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-cormorant text-3xl font-light text-white mb-2">写真アップロード</h2>
        <p className="text-sm text-white/40">Step 3 / 4 — 最大15枚、推奨8〜12枚</p>
      </div>

      {/* Photo advice */}
      <div className="border border-brand-gold/20 bg-brand-gold/5 p-6 space-y-3">
        <p className="text-xs tracking-widest text-brand-gold uppercase">
          {advice.title} — おすすめの写真構成
        </p>
        <ul className="space-y-1.5">
          {advice.items.map((item, i) => (
            <li key={i} className="text-sm text-white/70 flex gap-2">
              <span className="text-brand-gold/50 shrink-0">—</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/40 border-t border-white/10 pt-3">
          💡 {advice.tip}
        </p>
      </div>

      {uploadError && (
        <p className="text-sm text-red-400 border border-red-900/40 bg-red-900/10 px-4 py-3">
          {uploadError}
        </p>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed p-12 text-center cursor-pointer transition-all overflow-hidden ${
          isDragActive
            ? 'border-brand-gold bg-brand-gold/5'
            : uploading
            ? 'border-brand-gold/40 cursor-default'
            : photos.length >= 15
            ? 'border-white/10 opacity-40 cursor-not-allowed'
            : 'border-white/20 hover:border-white/40'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            {/* Animated spinner ring */}
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-brand-gold/20"
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-gold"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-mono text-brand-gold">
                  {uploadProgress.current}/{uploadProgress.total}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand-gold"
                initial={{ width: '0%' }}
                animate={{
                  width: `${((uploadProgress.current - (uploadProgress.phase === 'compress' ? 0.5 : 0)) / uploadProgress.total) * 100}%`,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            {/* Status text */}
            <motion.p
              className="text-sm text-white/60"
              key={`${uploadProgress.current}-${uploadProgress.phase}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {uploadProgress.phase === 'compress'
                ? `圧縮中... (${uploadProgress.current}/${uploadProgress.total})`
                : `アップロード中... (${uploadProgress.current}/${uploadProgress.total})`
              }
            </motion.p>
            {/* Pulsing background glow */}
            <motion.div
              className="absolute inset-0 bg-brand-gold/3 pointer-events-none"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        ) : isDragActive ? (
          <>
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Upload className="w-8 h-8 text-brand-gold mx-auto mb-4" />
            </motion.div>
            <p className="text-sm text-brand-gold">ここにドロップ</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-white/30 mx-auto mb-4" />
            <p className="text-sm text-white/60 mb-1">ドラッグ＆ドロップ、またはクリックして選択</p>
            <p className="text-xs text-white/30">JPG / PNG / WebP {photos.length}/15枚（自動圧縮）</p>
          </>
        )}
      </div>

      {/* Photo grid */}
      <AnimatePresence>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group"
              >
                <div className="relative overflow-hidden" style={{ paddingBottom: '75%' }}>
                  <img
                    src={photo.url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-black/60 text-white/60 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {/* Tag selector */}
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

      <Button
        className="w-full"
        disabled={photos.length === 0 || uploading}
        onClick={() => onNext(photos)}
      >
        次へ：LP生成
      </Button>
    </div>
  )
}
