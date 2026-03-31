import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Situation, ColorTemplate } from '@/types'
import { SITUATION_CONFIG } from '@/types'
import { motion } from 'framer-motion'

interface Props {
  onNext: (situation: Situation, colorTemplate: ColorTemplate) => void
  defaultSituation?: Situation
  defaultColor?: ColorTemplate
}

const COLOR_LABELS: Record<ColorTemplate, string> = {
  dark: 'Dark — #0A0A0A',
  warm: 'Warm — #1A1510',
  open: 'Open — #0D1117',
}

export function Step2Situation({ onNext, defaultSituation, defaultColor = 'dark' }: Props) {
  const [selected, setSelected] = useState<Situation | null>(defaultSituation ?? null)
  const [colorTemplate, setColorTemplate] = useState<ColorTemplate>(defaultColor)

  function handleSelect(s: Situation) {
    setSelected(s)
    setColorTemplate(SITUATION_CONFIG[s].colorTemplate)
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-cormorant text-3xl font-light text-white mb-2">シチュエーション</h2>
        <p className="text-sm text-white/40">Step 2 / 4 — この車の世界観を選んでください</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(Object.entries(SITUATION_CONFIG) as [Situation, typeof SITUATION_CONFIG[Situation]][]).map(
          ([key, config], i) => (
            <motion.button
              key={key}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelect(key)}
              className={`text-left p-6 border transition-all duration-300 ${
                selected === key
                  ? 'border-brand-gold bg-brand-gold/5'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <p className="text-2xl mb-3">{config.emoji}</p>
              <p className="font-cormorant text-xl font-light text-white mb-1">{config.label}</p>
              <p className="text-xs text-white/40 mb-2">{config.description}</p>
              <p className="text-[10px] text-white/25 border-t border-white/10 pt-2 mt-2">
                {config.targetCars}
              </p>
            </motion.button>
          )
        )}
      </div>

      {/* Color template override */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <p className="text-xs tracking-widest text-white/40 uppercase">カラーテンプレート</p>
          <div className="flex gap-3">
            {(Object.keys(COLOR_LABELS) as ColorTemplate[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorTemplate(c)}
                className={`text-xs px-4 py-2 border transition-all ${
                  colorTemplate === c
                    ? 'border-brand-gold text-brand-gold'
                    : 'border-white/20 text-white/40 hover:border-white/40'
                }`}
              >
                {COLOR_LABELS[c]}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30">
            自動適用済み。必要に応じて変更してください。
          </p>
        </motion.div>
      )}

      <Button
        className="w-full"
        disabled={!selected}
        onClick={() => selected && onNext(selected, colorTemplate)}
      >
        次へ：写真アップロード
      </Button>
    </div>
  )
}
