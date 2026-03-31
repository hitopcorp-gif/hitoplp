import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { CarBasicInfo, CarPhoto, ColorTemplate, Situation } from '@/types'
import { SITUATION_CONFIG } from '@/types'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateContent } from '@/lib/ai'
import { Sparkles, CheckCircle, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface Props {
  basicInfo: CarBasicInfo
  situation: Situation
  colorTemplate: ColorTemplate
  photos: CarPhoto[]
  onSave: () => Promise<string | undefined>
  vehicleId: string | null
}

type GenerationStep = {
  label: string
  done: boolean
}

export function Step4Generate({ basicInfo, situation, colorTemplate, photos, onSave, vehicleId }: Props) {
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<GenerationStep[]>([
    { label: '車両情報を整理しています...', done: false },
    { label: '記事を書いています...', done: false },
    { label: 'レイアウトを組んでいます...', done: false },
    { label: 'SNS素材を準備しています...', done: false },
    { label: '完成しています...', done: false },
  ])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(vehicleId)

  const situationConfig = SITUATION_CONFIG[situation]

  async function tick(index: number, prog: number) {
    await new Promise((r) => setTimeout(r, 800))
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, done: true } : s)))
    setProgress(prog)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      await tick(0, 15)
      const content = await generateContent({ basicInfo, situation, colorTemplate })
      await tick(1, 40)

      let id = savedId
      if (!id) {
        id = (await onSave()) ?? null
        setSavedId(id)
      }

      if (!id) throw new Error('保存に失敗しました')

      await tick(2, 65)

      await updateDoc(doc(db, 'vehicles', id), {
        generatedContent: content,
        updatedAt: serverTimestamp(),
      })

      await tick(3, 85)
      await tick(4, 100)

      setDone(true)
      navigate(`/vehicle/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-cormorant text-3xl font-light text-white mb-2">生成</h2>
        <p className="text-sm text-white/40">Step 4 / 4</p>
      </div>

      {/* Summary */}
      <div className="border border-white/10 p-6 space-y-4">
        <p className="text-xs tracking-widest text-white/40 uppercase mb-4">登録内容</p>
        <div className="space-y-3">
          <Row label="車名" value={basicInfo.name} />
          <Row label="年式" value={`${basicInfo.year}年`} />
          <Row label="走行距離" value={basicInfo.mileage} />
          <Row label="価格" value={basicInfo.isAsk ? 'ASK' : basicInfo.price} />
          <Row label="シチュエーション" value={`${situationConfig.emoji} ${situationConfig.label}`} />
          <Row label="写真" value={`${photos.length}枚`} />
          <Row label="カラーテンプレート" value={colorTemplate} />
        </div>
      </div>

      {/* Generation progress */}
      {generating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <Progress value={progress} />
          <div className="space-y-3">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: step.done || i === steps.findIndex((s) => !s.done) ? 1 : 0.3 }}
                className="flex items-center gap-3 text-sm"
              >
                {step.done ? (
                  <CheckCircle className="w-4 h-4 text-brand-gold shrink-0" />
                ) : i === steps.findIndex((s) => !s.done) ? (
                  <div className="w-4 h-4 border border-brand-gold/50 rounded-full shrink-0 animate-pulse" />
                ) : (
                  <div className="w-4 h-4 border border-white/20 rounded-full shrink-0" />
                )}
                <span className={step.done ? 'text-white/60' : i === steps.findIndex((s) => !s.done) ? 'text-white' : 'text-white/20'}>
                  {step.label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {error && (
        <div className="flex items-start gap-3 border border-red-900/50 bg-red-900/10 p-4">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!generating && !done && (
        <Button className="w-full" size="lg" onClick={handleGenerate}>
          <Sparkles className="w-4 h-4" />
          LP を生成する
        </Button>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
      <span className="text-white/40">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}
