import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import type { CarBasicInfo } from '@/types'
import { useState } from 'react'
import { Link } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, '車名を入力してください'),
  year: z.coerce.number().min(1900).max(2030),
  mileage: z.string().min(1),
  price: z.string(),
  shaken: z.string().min(1),
  transmission: z.enum(['AT', 'MT', 'CVT', 'DCT', 'other']),
  drive: z.string().min(1),
  engine: z.string().min(1),
  maxPower: z.string().optional(),
  maxTorque: z.string().optional(),
  hasRepairHistory: z.boolean(),
  customContent: z.string().min(1),
  tagline: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  onNext: (data: CarBasicInfo) => void
  defaultValues?: CarBasicInfo
}

export function Step1BasicInfo({ onNext, defaultValues }: Props) {
  const [isAsk, setIsAsk] = useState(defaultValues?.isAsk ?? false)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      year: defaultValues?.year ?? new Date().getFullYear(),
      mileage: defaultValues?.mileage ?? '',
      price: defaultValues?.price ?? '',
      shaken: defaultValues?.shaken ?? '',
      transmission: defaultValues?.transmission ?? 'AT',
      drive: defaultValues?.drive ?? '',
      engine: defaultValues?.engine ?? '',
      maxPower: defaultValues?.maxPower ?? '',
      maxTorque: defaultValues?.maxTorque ?? '',
      hasRepairHistory: defaultValues?.hasRepairHistory ?? false,
      customContent: defaultValues?.customContent ?? '',
      tagline: defaultValues?.tagline ?? '',
    },
  })

  async function handleScrape() {
    if (!scrapeUrl.trim()) return
    setScraping(true)
    setScrapeError('')
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error || '取得に失敗しました')
      }
      const data = await res.json() as Partial<CarBasicInfo>
      if (data.name) setValue('name', data.name)
      if (data.year) setValue('year', data.year)
      if (data.mileage) setValue('mileage', data.mileage)
      if (data.price) setValue('price', data.price)
      if (data.isAsk != null) setIsAsk(data.isAsk)
      if (data.shaken) setValue('shaken', data.shaken)
      if (data.transmission) setValue('transmission', data.transmission)
      if (data.drive) setValue('drive', data.drive)
      if (data.engine) setValue('engine', data.engine)
      if (data.maxPower) setValue('maxPower', data.maxPower)
      if (data.maxTorque) setValue('maxTorque', data.maxTorque)
      if (data.hasRepairHistory != null) setValue('hasRepairHistory', data.hasRepairHistory)
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : '取得に失敗しました')
    } finally {
      setScraping(false)
    }
  }

  function onSubmit(data: FormData) {
    onNext({ ...data, isAsk })
  }

  const fields = [
    { label: '車名', name: 'name' as const, placeholder: 'Land Rover Defender 110 X-Dynamic HSE', required: true },
    { label: '年式', name: 'year' as const, placeholder: '2023', type: 'number', required: true },
    { label: '走行距離', name: 'mileage' as const, placeholder: '1.2万km', required: true },
    { label: '車検', name: 'shaken' as const, placeholder: '2026年9月', required: true },
    { label: '駆動方式', name: 'drive' as const, placeholder: 'AWD（フルタイム4WD）', required: true },
    { label: 'エンジン', name: 'engine' as const, placeholder: '3.0L 直列6気筒 ディーゼルターボ', required: true },
    { label: '最高出力', name: 'maxPower' as const, placeholder: '300ps / 4,000rpm' },
    { label: '最大トルク', name: 'maxTorque' as const, placeholder: '650Nm / 1,500-2,500rpm' },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      <div>
        <h2 className="font-cormorant text-3xl font-light text-white mb-2">基本情報</h2>
        <p className="text-sm text-white/40">Step 1 / 4</p>
      </div>

      {/* URL auto-fill */}
      <div className="border border-white/10 bg-white/3 p-5 space-y-3">
        <p className="text-xs tracking-widest text-white/40 uppercase flex items-center gap-2">
          <Link className="w-3 h-3" />
          カーセンサー / Goo-net などのURLから自動入力
        </p>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://www.carsensor.net/usedcar/..."
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={scraping || !scrapeUrl.trim()}
            className="shrink-0 text-xs px-4 py-2 border border-brand-gold/40 text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {scraping ? '取得中...' : '取得'}
          </button>
        </div>
        {scrapeError && (
          <p className="text-xs text-red-400">{scrapeError}</p>
        )}
      </div>

      <div className="space-y-8">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-brand-gold ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type ?? 'text'}
              placeholder={field.placeholder}
              {...register(field.name)}
            />
            {errors[field.name] && (
              <p className="text-xs text-red-400">{errors[field.name]?.message as string}</p>
            )}
          </div>
        ))}

        {/* Price with ASK toggle */}
        <div className="space-y-2">
          <Label>
            価格 <span className="text-brand-gold">*</span>
          </Label>
          <div className="flex items-end gap-4">
            <Input
              placeholder="¥8,800,000"
              {...register('price')}
              disabled={isAsk}
              className={isAsk ? 'opacity-30' : ''}
            />
            <button
              type="button"
              onClick={() => setIsAsk(!isAsk)}
              className={`shrink-0 text-xs px-3 py-1.5 border transition-all ${
                isAsk
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-white/20 text-white/40 hover:border-white/40'
              }`}
            >
              ASK
            </button>
          </div>
        </div>

        {/* Transmission */}
        <div className="space-y-2">
          <Label>ミッション <span className="text-brand-gold">*</span></Label>
          <Select onValueChange={(v) => setValue('transmission', v as 'AT' | 'MT' | 'CVT' | 'DCT' | 'other')} defaultValue={defaultValues?.transmission ?? 'AT'}>
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {['AT', 'MT', 'CVT', 'DCT', 'other'].map((t) => (
                <SelectItem key={t} value={t}>{t === 'other' ? 'その他' : t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Repair history */}
        <div className="space-y-2">
          <Label>修復歴 <span className="text-brand-gold">*</span></Label>
          <div className="flex gap-4 pt-2">
            {[{ label: 'なし', value: false }, { label: 'あり', value: true }].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setValue('hasRepairHistory', opt.value)}
                className={`text-sm px-6 py-2 border transition-all ${
                  watch('hasRepairHistory') === opt.value
                    ? 'border-brand-gold text-brand-gold'
                    : 'border-white/20 text-white/40 hover:border-white/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom content */}
        <div className="space-y-2">
          <Label>HI-TOPカスタム内容 <span className="text-brand-gold">*</span></Label>
          <Textarea
            rows={4}
            placeholder="サテングレーラッピング / Vossen HF-5 22inch / ..."
            {...register('customContent')}
          />
          {errors.customContent && (
            <p className="text-xs text-red-400">{errors.customContent.message}</p>
          )}
        </div>

        {/* Tagline */}
        <div className="space-y-2">
          <Label>一行コピー（任意 / 空欄でAI生成）</Label>
          <Input placeholder="空欄にするとAIが自動生成します" {...register('tagline')} />
        </div>
      </div>

      <Button type="submit" className="w-full">
        次へ：シチュエーション選択
      </Button>
    </form>
  )
}
