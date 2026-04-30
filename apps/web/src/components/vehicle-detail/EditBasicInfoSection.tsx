import type { CarBasicInfo, Transmission } from '@/types'
import { AccordionSection, EditField, EditTextarea } from './edit-primitives'

/**
 * 編集タブ用：車両基本情報の編集セクション。
 * 公開後でも全フィールド（価格、年式、走行距離、車検、トランスミッション、駆動方式、エンジン、
 * 最高出力、最大トルク、修復歴、カスタム内容、タグライン、車名）を変更可能。
 *
 * `slug`（公開URL）は車両作成時に固定され、ここでは変更しない。
 */
export function EditBasicInfoSection({
  value,
  onChange,
  defaultOpen = false,
}: {
  value: CarBasicInfo
  onChange: (next: CarBasicInfo) => void
  defaultOpen?: boolean
}) {
  const transmissions: Transmission[] = ['AT', 'MT', 'CVT', 'DCT', 'other']

  return (
    <AccordionSection title="基本情報（車両データ）" defaultOpen={defaultOpen}>
      <EditField
        label="車名"
        value={value.name}
        onChange={(v) => onChange({ ...value, name: v })}
        placeholder="Land Rover Defender 110 X-Dynamic HSE"
      />

      <EditField
        label="年式（西暦）"
        type="number"
        value={String(value.year)}
        onChange={(v) => onChange({ ...value, year: Number(v) || value.year })}
        placeholder="2023"
      />

      <EditField
        label="走行距離"
        value={value.mileage}
        onChange={(v) => onChange({ ...value, mileage: v })}
        placeholder="1.2万km"
      />

      {/* 価格 + ASK トグル */}
      <div className="space-y-2">
        <label className="text-xs tracking-widest text-white/40 uppercase">販売価格</label>
        <div className="flex items-end gap-3">
          <input
            type="text"
            value={value.price}
            disabled={value.isAsk}
            onChange={(e) => onChange({ ...value, price: e.target.value })}
            placeholder="¥8,800,000"
            className={`flex-1 border-b border-white/20 bg-transparent py-2 text-sm text-white focus:border-brand-gold focus:outline-none ${
              value.isAsk ? 'opacity-30' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => onChange({ ...value, isAsk: !value.isAsk })}
            className={`shrink-0 text-xs px-3 py-1.5 border transition-all ${
              value.isAsk
                ? 'border-brand-gold text-brand-gold'
                : 'border-white/20 text-white/40 hover:border-white/40'
            }`}
          >
            ASK
          </button>
        </div>
        <p className="text-[10px] text-white/30">ASK にすると LP 上の価格表示が「ASK」になります</p>
      </div>

      <EditField
        label="車検"
        value={value.shaken}
        onChange={(v) => onChange({ ...value, shaken: v })}
        placeholder="2026年9月"
      />

      {/* トランスミッション */}
      <div className="space-y-2">
        <label className="text-xs tracking-widest text-white/40 uppercase">ミッション</label>
        <div className="flex flex-wrap gap-2">
          {transmissions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...value, transmission: t })}
              className={`text-xs px-4 py-2 border transition-all ${
                value.transmission === t
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-white/20 text-white/40 hover:border-white/40'
              }`}
            >
              {t === 'other' ? 'その他' : t}
            </button>
          ))}
        </div>
      </div>

      <EditField
        label="駆動方式"
        value={value.drive}
        onChange={(v) => onChange({ ...value, drive: v })}
        placeholder="AWD（フルタイム4WD）"
      />

      <EditField
        label="エンジン"
        value={value.engine}
        onChange={(v) => onChange({ ...value, engine: v })}
        placeholder="3.0L 直列6気筒 ディーゼルターボ"
      />

      <EditField
        label="最高出力（任意）"
        value={value.maxPower ?? ''}
        onChange={(v) => onChange({ ...value, maxPower: v })}
        placeholder="300ps / 4,000rpm"
      />

      <EditField
        label="最大トルク（任意）"
        value={value.maxTorque ?? ''}
        onChange={(v) => onChange({ ...value, maxTorque: v })}
        placeholder="650Nm / 1,500-2,500rpm"
      />

      {/* 修復歴 */}
      <div className="space-y-2">
        <label className="text-xs tracking-widest text-white/40 uppercase">修復歴</label>
        <div className="flex gap-3">
          {[
            { label: 'なし', val: false },
            { label: 'あり', val: true },
          ].map((opt) => (
            <button
              key={String(opt.val)}
              type="button"
              onClick={() => onChange({ ...value, hasRepairHistory: opt.val })}
              className={`text-xs px-6 py-2 border transition-all ${
                value.hasRepairHistory === opt.val
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-white/20 text-white/40 hover:border-white/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <EditTextarea
        label="HI-TOPカスタム内容"
        value={value.customContent}
        onChange={(v) => onChange({ ...value, customContent: v })}
        rows={4}
      />

      <EditField
        label="一行コピー（任意）"
        value={value.tagline ?? ''}
        onChange={(v) => onChange({ ...value, tagline: v })}
        placeholder="空欄でAIによる自動生成のまま"
      />
    </AccordionSection>
  )
}
