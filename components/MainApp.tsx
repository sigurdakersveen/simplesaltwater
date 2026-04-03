'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  calcScore, scoreWind, scoreCloud, scoreTemp, scoreHour,
  getStatus, simulateTide, scoreTide, tideLabel, moonPhase,
} from '@/lib/fishing-score'
import { fetchMarineData } from '@/lib/marine'
import LocationSearch from './LocationSearch'
import ThreeDayForecast from './ThreeDayForecast'
import FavoritesList from './FavoritesList'
import FishingLogForm from './FishingLogForm'
import FavoritesComparison from './FavoritesComparison'
import MarineData from './MarineData'

type Location = { lat: number; lon: number; name: string }
type HourlyData = {
  wind_speed_10m: number[]
  cloud_cover: number[]
  temperature_2m: number[]
  winddirection_10m: number[]
  surface_pressure: number[]
  precipitation: number[]
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
  const [tideWeight, setTideWeight] = useState(0.20)
  const [waveHeight, setWaveHeight] = useState<number | null>(null)
  const [seaTemp, setSeaTemp] = useState<number | null>(null)
  const [waveNote, setWaveNote] = useState<string | null>(null)
  const [windDirection, setWindDirection] = useState<number | null>(null)
  const [sunrise, setSunrise] = useState<string | null>(null)
  const [sunset, setSunset] = useState<string | null>(null)
  const [pressure, setPressure] = useState<number | null>(null)
  const [pressureTrend, setPressureTrend] = useState<number | null>(null)
  const [precipitation, setPrecipitation] = useState<number | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setLoading(true)
    setHourly(null)
    setWaveHeight(null)
    setSeaTemp(null)
    setWaveNote(null)
    setWindDirection(null)
    setSunrise(null)
    setSunset(null)
    setPressure(null)
    setPressureTrend(null)
    setPrecipitation(null)
    try {
      const [weatherRes, marineResult] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,cloud_cover,temperature_2m,winddirection_10m,surface_pressure,precipitation&daily=sunrise,sunset&forecast_days=3&wind_speed_unit=kmh&timezone=auto`),
        fetchMarineData(lat, lon)
      ])
      const weather = await weatherRes.json()
      setHourly(weather.hourly)
      setSunrise(weather.daily?.sunrise?.[0] ?? null)
      setSunset(weather.daily?.sunset?.[0] ?? null)
      const h = new Date().getHours()
      setWindDirection(weather.hourly?.winddirection_10m?.[h] ?? null)
      setPrecipitation(weather.hourly?.precipitation?.[h] ?? null)
      const pressNow = weather.hourly?.surface_pressure?.[h] ?? null
      const pressThreeHoursAgo = weather.hourly?.surface_pressure?.[Math.max(0, h - 3)] ?? null
      setPressure(pressNow)
      if (pressNow !== null && pressThreeHoursAgo !== null) {
        setPressureTrend(pressNow - pressThreeHoursAgo)
      }
      setWaveHeight(marineResult.waveHeight)
      setSeaTemp(marineResult.seaTemp)
      const usedSamePoint = marineResult.usedLat === lat && marineResult.usedLon === lon
      if (!usedSamePoint && (marineResult.waveHeight !== null || marineResult.seaTemp !== null)) {
        const dist = Math.round(Math.sqrt(
          Math.pow((marineResult.usedLat - lat) * 111, 2) +
          Math.pow((marineResult.usedLon - lon) * 111 * Math.cos(lat * Math.PI / 180), 2)
        ))
        setWaveNote(`Marin data fra nærmeste kystpunkt (~${dist} km unna)`)
      }
    } catch { }
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
    const already = favorites.find((f: any) => f.name === location.name)
    if (already) { setSaveMsg('Allerede lagret'); setTimeout(() => setSaveMsg(''), 2000); return }
    const { data, error } = await supabase
      .from('favorite_locations')
      .insert({ user_id: user.id, name: location.name, lat: location.lat, lon: location.lon })
      .select().single()
    if (!error && data) {
      setFavorites((prev: any[]) => [data, ...prev])
      setSaveMsg('Lagret!')
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  async function handleRemoveFavorite(id: string) {
    await supabase.from('favorite_locations').delete().eq('id', id)
    setFavorites((prev: any[]) => prev.filter((f: any) => f.id !== id))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  function getDayData(dayOffset: number) {
    if (!hourly) return null
    const start = dayOffset * 24
    const moon = moonPhase(new Date())
    const scores = Array.from({ length: 24 }, (_, h) => {
      const i = start + h
      return calcScore(
        hourly.wind_speed_10m[i] ?? 10,
        hourly.cloud_cover[i] ?? 50,
        hourly.temperature_2m[i] ?? 12,
        h,
        tideWeight,
        waveHeight,
        hourly.surface_pressure[i] ?? null,
        pressureTrend,
        seaTemp,
        hourly.precipitation[i] ?? null,
        moon.score
      )
    })
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / 24)
    const mid = start + 12
    return {
      scores, avg,
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
  const moon = moonPhase(new Date())

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <span className="font-medium text-gray-900 text-sm">🎣 SimpleSaltwater</span>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button onClick={() => router.push('/log')} className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">Fiskelogg</button>
              <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-700">Logg ut</button>
            </>
          ) : (
            <button onClick={() => router.push('/auth')} className="text-sm bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800">Logg inn</button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {user && favorites.length > 0 && (
            <div className="w-full lg:w-64 shrink-0 lg:sticky lg:top-20">
              <FavoritesComparison favorites={favorites} onSelect={handleLocationSelect} />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-3">
            <LocationSearch onSelect={handleLocationSelect} />

            {user && favorites.length > 0 && (
              <FavoritesList favorites={favorites} onSelect={handleLocationSelect} onRemove={handleRemoveFavorite} />
            )}

            {loading && <div className="text-center py-10 text-gray-400 text-sm">Henter værdata...</div>}

            {dayData && location && st && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 truncate">{location.name}</p>
                  <button onClick={handleAddFavorite} className="text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 whitespace-nowrap ml-2">
                    {saveMsg || '★ Lagre'}
                  </button>
                </div>

                <ThreeDayForecast getDayData={getDayData} activeDay={activeDay} onSelectDay={setActiveDay} />

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="text-center mb-5">
                    <div className="text-6xl font-medium text-gray-900">{dayData.avg}</div>
                    <div className={`text-sm font-medium mt-1 ${st.color}`}>{st.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{moon.emoji} {moon.name}</div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Vind', sub: `${dayData.wind} km/t`, pct: scoreWind(dayData.wind) },
                      { label: 'Tidspunkt', sub: activeDay === 0 ? `${nowH.toString().padStart(2, '0')}:00` : 'Snitt dag', pct: scoreHour(activeDay === 0 ? nowH : 12) },
                      { label: 'Skydekke', sub: `${dayData.cloud}%`, pct: scoreCloud(dayData.cloud) },
                      { label: 'Lufttemp', sub: `${dayData.temp}°C`, pct: scoreTemp(dayData.temp) },
                      { label: 'Tidevann', sub: tideLabel(nowH), pct: scoreTide(nowH) },
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-3">
                        <div className="w-28 shrink-0">
                          <span className="text-xs text-gray-600">{c.label}</span>
                          <span className="block text-xs text-gray-400">{c.sub}</span>
                        </div>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.pct}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 w-6 text-right">{c.pct}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <MarineData
                  waveHeight={waveHeight}
                  seaTemp={seaTemp}
                  windDirection={windDirection}
                  sunrise={sunrise}
                  sunset={sunset}
                  waveNote={waveNote}
                  pressure={pressure}
                  pressureTrend={pressureTrend}
                  precipitation={precipitation}
                />

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tidevannsvekt</p>
                    <span className="text-xs font-medium text-gray-600">{Math.round(tideWeight * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={40} step={5}
                    value={Math.round(tideWeight * 100)}
                    onChange={e => setTideWeight(Number(e.target.value) / 100)}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-300 mt-1">
                    <span>Ingen effekt</span><span>Svært viktig</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Tidevann nå: <span className="font-medium text-gray-600">{tideLabel(nowH)}</span> — score: <span className="font-medium text-gray-600">{scoreTide(nowH)}</span>
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Beste tider</p>
                  <div className="flex gap-2 flex-wrap">
                    {dayData.best.length ? dayData.best.map((t, i) => (
                      <span key={t.h} className={`px-3 py-1 rounded-full text-sm ${i === 0 ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-600'}`}>
                        {t.h.toString().padStart(2, '0')}:00 · {t.s}
                      </span>
                    )) : <span className="text-sm text-gray-400">Ingen gode vinduer i dag</span>}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Estimert tidevann</p>
                  <div className="flex items-end gap-0.5 h-10">
                    {Array.from({ length: 24 }, (_, h) => {
                      const height = Math.max(4, Math.round(simulateTide(h) * 0.38))
                      const isNow = activeDay === 0 && Math.abs(h - nowH) <= 1
                      return <div key={h} className={`flex-1 rounded-t ${isNow ? 'bg-blue-500' : 'bg-blue-100'}`} style={{ height: `${height}px` }} />
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-gray-300 mt-1">
                    <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">Simulert sinemodell. Fremhevet = nå.</p>
                </div>

                {user && (
                  <>
                    {!showLog && (
                      <button onClick={() => setShowLog(true)} className="w-full py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-white bg-gray-50">
                        + Logg fiskeøkt her
                      </button>
                    )}
                    {showLog && <FishingLogForm user={user} location={location} currentScore={dayData.avg} onClose={() => setShowLog(false)} />}
                  </>
                )}

                {!user && (
                  <button onClick={() => router.push('/auth')} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-400 hover:bg-white bg-gray-50">
                    Logg inn for å lagre steder og fiskeøkter
                  </button>
                )}
              </>
            )}

            {!loading && !dayData && (
              <div className="text-center py-16 text-gray-300 text-sm">Søk etter et sted for å se fiskeforhold</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
