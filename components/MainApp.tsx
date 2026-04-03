'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  calcScore, scoreWind, scoreCloud, scoreTemp, scoreHour,
  getStatus, simulateTide,
} from '@/lib/fishing-score'
import LocationSearch from './LocationSearch'
import ThreeDayForecast from './ThreeDayForecast'
import FavoritesList from './FavoritesList'
import FishingLogForm from './FishingLogForm'

type Location = { lat: number; lon: number; name: string }
type HourlyData = {
  wind_speed_10m: number[]
  cloud_cover: number[]
  temperature_2m: number[]
}

export default function MainApp({ user, initialFavorites }: {
  user: any
  initialFavorites: any[]
}) {
  const [location, setLocation] = useState<Location | null>(null)
  const [hourly, setHourly] = useState<HourlyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeDay, setActiveDay] = useState(0)
  const [favorites, setFavorites] = useState(initialFavorites)
  const [showLog, setShowLog] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true)
    setHourly(null)
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,cloud_cover,temperature_2m&forecast_days=3&wind_speed_unit=kmh&timezone=auto`
      const r = await fetch(url)
      const d = await r.json()
      setHourly(d.hourly)
    } catch { /* show nothing if fetch fails */ }
    setLoading(false)
  }, [])

  function handleLocationSelect(loc: Location) {
    setLocation(loc)
    setActiveDay(0)
    setShowLog(false)
    fetchWeather(loc.lat, loc.lon)
  }

  async function handleAddFavorite() {
    if (!user) return router.push('/auth')
    if (!location) return
    const already = favorites.find(f => f.name === location.name)
    if (already) { setSaveMsg('Allerede lagret'); setTimeout(() => setSaveMsg(''), 2000); return }
    const { data, error } = await supabase
      .from('favorite_locations')
      .insert({ user_id: user.id, name: location.name, lat: location.lat, lon: location.lon })
      .select()
      .single()
    if (!error && data) {
      setFavorites(prev => [data, ...prev])
      setSaveMsg('Lagret!')
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  async function handleRemoveFavorite(id: string) {
    await supabase.from('favorite_locations').delete().eq('id', id)
    setFavorites(prev => prev.filter(f => f.id !== id))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  function getDayData(dayOffset: number) {
    if (!hourly) return null
    const start = dayOffset * 24
    const scores = Array.from({ length: 24 }, (_, h) => {
      const i = start + h
      return calcScore(
        hourly.wind_speed_10m[i] ?? 10,
        hourly.cloud_cover[i] ?? 50,
        hourly.temperature_2m[i] ?? 12,
        h
      )
    })
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / 24)
    const mid = start + 12
    return {
      scores,
      avg,
      wind: Math.round(hourly.wind_speed_10m[mid] ?? 10),
      cloud: Math.round(hourly.cloud_cover[mid] ?? 50),
      temp: Math.round(hourly.temperature_2m[mid] ?? 12),
      best: scores
        .map((s, h) => ({ h, s }))
        .filter(x => x.h >= 5 && x.h <= 22 && x.s >= 68)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3),
    }
  }

  const nowH = new Date().getHours()
  const dayData = hourly ? getDayData(activeDay) : null
  const st = dayData ? getStatus(dayData.avg) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <span className="font-medium text-gray-900 text-sm">🎣 SimpleSaltwater</span>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button
                onClick={() => router.push('/log')}
                className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Fiskelogg
              </button>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-gray-700"
              >
                Logg ut
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/auth')}
              className="text-sm bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800"
            >
              Logg inn
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {/* Search */}
        <LocationSearch onSelect={handleLocationSelect} />

        {/* Favorites */}
        {user && favorites.length > 0 && (
          <FavoritesList
            favorites={favorites}
            onSelect={handleLocationSelect}
            onRemove={handleRemoveFavorite}
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-10 text-gray-400 text-sm">Henter værdata...</div>
        )}

        {/* Main content */}
        {dayData && location && st && (
          <>
            {/* Location bar */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 truncate">{location.name}</p>
              <button
                onClick={handleAddFavorite}
                className="text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 whitespace-nowrap ml-2"
              >
                {saveMsg || '★ Lagre'}
              </button>
            </div>

            {/* 3-day forecast */}
            <ThreeDayForecast
              getDayData={getDayData}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
            />

            {/* Score card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-center mb-5">
                <div className="text-6xl font-medium text-gray-900">{dayData.avg}</div>
                <div className={`text-sm font-medium mt-1 ${st.color}`}>{st.label}</div>
              </div>

              {/* Score breakdown bars */}
              <div className="space-y-2.5">
                {[
                  {
                    label: 'Vind',
                    sub: `${dayData.wind} km/t`,
                    pct: scoreWind(dayData.wind),
                  },
                  {
                    label: 'Tidspunkt',
                    sub: activeDay === 0 ? `${nowH.toString().padStart(2,'0')}:00` : 'Snitt dag',
                    pct: scoreHour(activeDay === 0 ? nowH : 12),
                  },
                  {
                    label: 'Skydekke',
                    sub: `${dayData.cloud}%`,
                    pct: scoreCloud(dayData.cloud),
                  },
                  {
                    label: 'Temperatur',
                    sub: `${dayData.temp}°C`,
                    pct: scoreTemp(dayData.temp),
                  },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <span className="text-xs text-gray-600">{c.label}</span>
                      <span className="block text-xs text-gray-400">{c.sub}</span>
                    </div>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 w-6 text-right">{c.pct}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best times */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Beste tider
              </p>
              <div className="flex gap-2 flex-wrap">
                {dayData.best.length ? (
                  dayData.best.map((t, i) => (
                    <span
                      key={t.h}
                      className={`px-3 py-1 rounded-full text-sm ${
                        i === 0
                          ? 'bg-green-100 text-green-700 font-medium'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.h.toString().padStart(2, '0')}:00 · {t.s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">Ingen gode vinduer i dag</span>
                )}
              </div>
            </div>

            {/* Tide chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Estimert tidevann
              </p>
              <div className="flex items-end gap-0.5 h-10">
                {Array.from({ length: 24 }, (_, h) => {
                  const v = simulateTide(h)
                  const height = Math.max(4, Math.round(v * 0.38))
                  const isNow = activeDay === 0 && Math.abs(h - nowH) <= 1
                  return (
                    <div
                      key={h}
                      className={`flex-1 rounded-t ${isNow ? 'bg-blue-500' : 'bg-blue-100'}`}
                      style={{ height: `${height}px` }}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-300 mt-1">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
              </div>
              <p className="text-xs text-gray-300 mt-2">
                Simulert sinemodell. Fremhevet stolpe = nå.
              </p>
            </div>

            {/* Log button + form */}
            {user && (
              <>
                {!showLog && (
                  <button
                    onClick={() => setShowLog(true)}
                    className="w-full py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-white bg-gray-50"
                  >
                    + Logg fiskeøkt her
                  </button>
                )}
                {showLog && (
                  <FishingLogForm
                    user={user}
                    location={location}
                    currentScore={dayData.avg}
                    onClose={() => setShowLog(false)}
                  />
                )}
              </>
            )}

            {!user && (
              <button
                onClick={() => router.push('/auth')}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-400 hover:bg-white bg-gray-50"
              >
                Logg inn for å lagre steder og fiskeøkter
              </button>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !dayData && (
          <div className="text-center py-16 text-gray-300 text-sm">
            Søk etter et sted for å se fiskeforhold
          </div>
        )}
      </div>
    </div>
  )
}
