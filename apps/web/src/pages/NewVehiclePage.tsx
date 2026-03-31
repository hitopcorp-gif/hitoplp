import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { slugify } from '@/lib/utils'
import { Step1BasicInfo } from '@/components/steps/Step1BasicInfo'
import { Step2Situation } from '@/components/steps/Step2Situation'
import { Step3Photos } from '@/components/steps/Step3Photos'
import { Step4Generate } from '@/components/steps/Step4Generate'
import type { CarBasicInfo, CarPhoto, Situation, ColorTemplate } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NewVehiclePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [basicInfo, setBasicInfo] = useState<CarBasicInfo | null>(null)
  const [situation, setSituation] = useState<Situation | null>(null)
  const [colorTemplate, setColorTemplate] = useState<ColorTemplate>('dark')
  const [photos, setPhotos] = useState<CarPhoto[]>([])
  const [vehicleId, setVehicleId] = useState<string | null>(null)

  function handleStep1(data: CarBasicInfo) {
    setBasicInfo(data)
    setStep(2)
  }

  function handleStep2(s: Situation, c: ColorTemplate) {
    setSituation(s)
    setColorTemplate(c)
    setStep(3)
  }

  function handleStep3(p: CarPhoto[]) {
    setPhotos(p)
    setStep(4)
  }

  async function handleGenerate() {
    if (!basicInfo || !situation) return
    const slug = slugify(basicInfo.name)
    const docRef = await addDoc(collection(db, 'vehicles'), {
      slug,
      basicInfo,
      situation,
      colorTemplate,
      photos: photos.map((p) => ({ url: p.url, tag: p.tag, order: p.order, storageRef: p.storageRef ?? '' })),
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setVehicleId(docRef.id)
    return docRef.id
  }

  const stepLabels = ['基本情報', 'シチュエーション', '写真', '生成']

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5 flex items-center gap-6 sticky top-0 bg-dark-bg/80 backdrop-blur-md z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
          className="border-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <p className="text-xs tracking-[0.25em] text-white/40 uppercase">新規登録</p>
          <h1 className="font-cormorant text-xl font-light text-white">
            {basicInfo?.name || '車両情報入力'}
          </h1>
        </div>

        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all ${
                i + 1 === step
                  ? 'bg-brand-gold text-black'
                  : i + 1 < step
                  ? 'bg-white/20 text-white'
                  : 'border border-white/20 text-white/30'
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs hidden md:block ${i + 1 === step ? 'text-white' : 'text-white/30'}`}>
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div className={`w-8 h-px ${i + 1 < step ? 'bg-brand-gold/50' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Step1BasicInfo onNext={handleStep1} defaultValues={basicInfo ?? undefined} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Step2Situation
                onNext={handleStep2}
                defaultSituation={situation ?? undefined}
                defaultColor={colorTemplate}
              />
            </motion.div>
          )}
          {step === 3 && situation && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Step3Photos
                situation={situation}
                onNext={handleStep3}
                defaultPhotos={photos}
              />
            </motion.div>
          )}
          {step === 4 && basicInfo && situation && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Step4Generate
                basicInfo={basicInfo}
                situation={situation}
                colorTemplate={colorTemplate}
                photos={photos}
                onSave={handleGenerate}
                vehicleId={vehicleId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
