import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Plus, LogOut, ExternalLink, BadgeCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Vehicle } from '@/types'
import { motion } from 'framer-motion'

export function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehicle)))
    })
    return unsub
  }, [])

  const published = vehicles.filter((v) => v.status === 'published')
  const sold = vehicles.filter((v) => v.status === 'sold')
  const drafts = vehicles.filter((v) => v.status === 'draft')

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between sticky top-0 bg-dark-bg/80 backdrop-blur-md z-10">
        <div>
          <p className="text-xs tracking-[0.25em] text-white/40 uppercase">Hi-Top Corporation</p>
          <h1 className="font-cormorant text-2xl font-light text-white">LP Studio</h1>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://hitoplp-api.hitopcorp.workers.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/40 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            LP一覧を開く
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut(auth)}
            className="text-white/40 hover:text-white border-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="px-8 py-10 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: '公開中', value: published.length },
            { label: '下書き', value: drafts.length },
            { label: '売約済み', value: sold.length },
          ].map((stat) => (
            <div key={stat.label} className="border border-white/10 p-6">
              <p className="text-xs tracking-widest text-white/40 uppercase mb-2">{stat.label}</p>
              <p className="font-cormorant text-5xl font-light text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xs tracking-widest text-white/40 uppercase">車両一覧</h2>
          <Button onClick={() => navigate('/new')} size="sm">
            <Plus className="w-4 h-4" />
            新規登録
          </Button>
        </div>

        {/* Vehicle Grid */}
        {vehicles.length === 0 ? (
          <div className="border border-white/10 p-16 text-center">
            <p className="text-white/30 text-sm mb-6">まだ車両が登録されていません</p>
            <Button onClick={() => navigate('/new')}>最初の1台を登録する</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {vehicles.map((vehicle, i) => (
              <motion.div
                key={vehicle.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <VehicleCard vehicle={vehicle} />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const heroPhoto = vehicle.photos?.find((p) => p.tag === 'hero') ?? vehicle.photos?.[0]

  return (
    <div
      className="group border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
      onClick={() => navigate(`/vehicle/${vehicle.id}`)}
    >
      <div className="relative overflow-hidden" style={{ height: 200 }}>
        {heroPhoto ? (
          <img
            src={heroPhoto.url}
            alt={vehicle.basicInfo.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <p className="text-white/20 text-xs">No photo</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          {vehicle.status === 'published' && (
            <span className="bg-brand-gold text-black text-[10px] tracking-wider uppercase px-2 py-1">
              公開中
            </span>
          )}
          {vehicle.status === 'sold' && (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] tracking-wider px-2 py-1 flex items-center gap-1">
              <BadgeCheck className="w-3 h-3" /> 売約済み
            </span>
          )}
          {vehicle.status === 'draft' && (
            <span className="border border-white/20 text-white/40 text-[10px] tracking-wider uppercase px-2 py-1">
              下書き
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <p className="font-cormorant text-xl font-light text-white mb-1">{vehicle.basicInfo.name}</p>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span>{vehicle.basicInfo.year}年</span>
          <span>{vehicle.basicInfo.mileage}</span>
          <span className="ml-auto">
            {vehicle.basicInfo.isAsk ? 'ASK' : vehicle.basicInfo.price}
          </span>
        </div>
      </div>
    </div>
  )
}
