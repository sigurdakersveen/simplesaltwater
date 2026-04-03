'use client'
import { useEffect, useState } from 'react'
import { calcScore, getStatus } from '@/lib/fishing-score'

type Favorite = { id: string; name: string; lat: number; lon: number }
type FavoriteScore = Favorite & { score: number | null; loading: boolean }

async function fetchScore(lat: number, lon: number): Promise<number> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,cloud_cover,temperature_2m&wind_speed_unit=kmh&timezone=auto`
  const r = await fetch(url)
  const d = await r.json()
  const c = d.current
  const hour = new Date().getHours()
  return calcScore(c.wind_speed_10m, c.cloud_cover, c.temperature_2m, hour)
}

export default function FavoritesComparison({ favorites, onSelect }: {
  favorites: Favorite[]
  onSelect: (loc: { lat: number; lon: number; name: string }) => void
}) {
  const [scores, setScores] = useState<FavoriteScore[]>(
    favorites.map(f => ({ ...f, score: null, loading: true }))
  )

  useEffect(() => {
    if (!favorites.length) return
    setScores(favorites.map(f => ({ ...f, score: null, loading: true })))
    favorites.forEach(async (f) => {
      try {
        const score = await fetchScore(f.lat, f.lon)
        setScores(prev => prev.map(s => s.id === f.id ? { ...s, score, loading: false } : s))
      } catch {
        setScores(prev => prev.map(s => s.id === f.id ? { ...s, score: null, loading: false } : s))
      }
    })
  }, [favorites])

  if (!favorites.length) return null

  const sorted = [...scores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const best = sorted[0]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
        Sammenlign favoritter
      </p>
      <div className="space-y-2">
        {sorted.map((f) => {
          const st = f.score !== null ? getStatus(f.score) : null
          const isBest = f.id === best?.id && f.score !== null
          return (
            <button
              key={f.id}
              onClick={() => onSelect({ lat: f.lat, lon: f.lon, name: f.name })}
              className={`w-full text-left rounded-lg p-3 border transition-all hover:border-gray-400 ${
                isBest ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isBest && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">Best</span>
                  )}
                  <span className="text-sm text-gray-700 truncate">{f.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900 ml-2 shrink-0">
                  {f.loading ? '...' : f.score ?? '—'}
                </span>
              </div>
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: f.loading ? '0%' : `${f.score ?? 0}%`,
                    background: f.score !== null
                      ? f.score >= 75 ? '#16a34a'
                        : f.score >= 55 ? '#2563eb'
                        : f.score >= 35 ? '#d97706'
                        : '#dc2626'
                      : '#e5e7eb'
                  }}
                />
              </div>
              {st && <p className={`text-xs mt-1 ${st.color}`}>{st.label}</p>}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-300 mt-3">Klikk for å velge sted</p>
    </div>
  )
}
