'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  calcScore, scoreWind, scoreCloud, scoreTemp, scoreHour,
  getStatus, simulateTide, scoreTide, tideLabel, moonPhase,
  estimateVisibility, scoreCurrent, currentLabel,
  pressureLabel, windDirectionLabel, formatSunTime, visibilityLabel
} from '@/lib/fishing-score'
import { fetchMarineData } from '@/lib/marine'
import LocationSearch from './LocationSearch'
import FavoritesList from './FavoritesList'
import FishingLogForm from './FishingLogForm'
import FavoritesComparison from './FavoritesComparison'

type Location = { lat: number; lon: number; name: string }
type HourlyData = {
  wind_speed_10m: number[]
  cloud_cover: number[]
  temperature_2m: number[]
  winddirection_10m: number[]
  surface_pressure: number[]
  precipitation: number[]
}
type PointData = {
  location: Location
  score: number
  status: { label: string; color: string }
  wind: number
  waveHeight: number | null
  seaTemp: number | null
  currentSpeed: number | null
  currentDirection: number | null
  pressure: number | null
  pressureTrend: number | null
  precipitation: number | null
  windDirection: number | null
  sunrise: string | null
  sunset: string | null
  visibilityScore: number
  hourly: HourlyData | null
}

const SHELLFISH_STATIONS = [
  { name: 'Kvitsøy', lat: 59.07, lon: 5.41 },
  { name: 'Talgje', lat: 59.12, lon: 5.71 },
  { name: 'Espevær', lat: 59.59, lon: 5.15 },
  { name: 'Ryvarden', lat: 59.91, lon: 5.23 },
  { name: 'Fjon', lat: 61.42, lon: 5.04 },
  { name: 'Måløy', lat: 61.94, lon: 5.11 },
  { name: 'Ona', lat: 62.86, lon: 6.54 },
  { name: 'Flatanger', lat: 64.49, lon: 10.83 },
  { name: 'Namsos', lat: 64.46, lon: 11.49 },
  { name: 'Bodø', lat: 67.28, lon: 14.37 },
  { name: 'Tromsø', lat: 69.65, lon: 18.96 },
  { name: 'Oslofjorden', lat: 59.44, lon: 10.53 },
]

function nearestShellfish(lat: number, lon: number) {
  let best = SHELLFISH_STATIONS[0]
  let bestDist = Infinity
  for (const s of SHELLFISH_STATIONS) {
    const d = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lon - lon, 2))
    if (d < bestDist) { bestDist = d; best = s }
  }
  return { station: best, distKm: Math.round(bestDist * 111) }
}

function isShellSeason() {
  const m = new Date().getMonth() + 1
  return m >= 3 && m <= 10
}

function fmt(h: number) {
  return `${h.toString().padStart(2, '0')}:00`
}

function dayLabel(offset: number) {
  if (offset === 0) return 'I dag'
  if (offset === 1) return 'I morgen'
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('nb-NO', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
}

export default function MainApp({ user, initialFavorites }: {
  user: any
  initialFavorites: any[]
}) {
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [favorites, setFavorites] = useState(initialFavorites)
  const [selected, setSelected] = useState<PointData | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [tideWeight, setTideWeight] = useState(0.15)
  const [activeDay, setActiveDay] = useState(0)
  const [activeTab, setActiveTab] = useState<'fiske' | 'tidevann' | 'skjell'>('fiske')
  const supabase = createClient()
  const router = useRouter()

  async function fetchPoint(lat: number, lng: number, name?: string) {
    setMapLoading(true)
    setSelected(null)
    setShowLog(false)
    setActiveTab('fiske')
    setActiveDay(0)
    try {
      const [weatherRes, marineResult] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,cloud_cover,temperature_2m,winddirection_10m,surface_pressure,precipitation&daily=sunrise,sunset&forecast_days=3&wind_speed_unit=kmh&timezone=auto`),
        fetchMarineData(lat, lng)
      ])
      const weather = await weatherRes.json()
      const h = new Date().getHours()
      const month = new Date().getMonth() + 1
      const pressNow = weather.hourly?.surface_pressure?.[h] ?? null
      const pressAgo = weather.hourly?.surface_pressure?.[Math.max(0, h - 3)] ?? null
      const pressureTrend = pressNow !== null && pressAgo !== null ? pressNow - pressAgo : null
      const precip = weather.hourly?.precipitation?.[h] ?? null
      const windDir = weather.hourly?.winddirection_10m?.[h] ?? null
      const vis = estimateVisibility(precip, marineResult.waveHeight, month)
      const moon = moonPhase(new Date())
      const score = calcScore(
        weather.hourly?.wind_speed_10m?.[h] ?? 10,
        weather.hourly?.cloud_cover?.[h] ?? 50,
        weather.hourly?.temperature_2m?.[h] ?? 12,
        h, tideWeight, marineResult.waveHeight,
        pressNow, pressureTrend, marineResult.seaTemp,
        precip, moon.score, marineResult.currentSpeed, vis
      )
      let locName = name ?? `${lat.toFixed(2)}N ${lng.toFixed(2)}O`
      if (!name) {
        try {
          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'nb' } })
          const gd = await geo.json()
          locName = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || locName
        } catch { }
      }
      setSelected({
        location: { lat, lon: lng, name: locName },
        score, status: getStatus(score),
        wind: Math.round(weather.hourly?.wind_speed_10m?.[h] ?? 10),
        waveHeight: marineResult.waveHeight,
        seaTemp: marineResult.seaTemp,
        currentSpeed: marineResult.currentSpeed,
        currentDirection: marineResult.currentDirection,
        pressure: pressNow, pressureTrend, precipitation: precip,
        windDirection: windDir,
        sunrise: weather.daily?.sunrise?.[0] ?? null,
        sunset: weather.daily?.sunset?.[0] ?? null,
        visibilityScore: vis, hourly: weather.hourly,
      })
    } catch { }
    setMapLoading(false)
  }

  useEffect(() => {
    if (mapRef.current) return
    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })
      const map = L.map('main-map', { center: [65, 14], zoom: 5 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18,
      }).addTo(map)

      for (const s of SHELLFISH_STATIONS) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)" title="${s.name}"></div>`,
          iconSize: [10, 10], iconAnchor: [5, 5],
        })
        L.marker([s.lat, s.lon], { icon }).addTo(map)
          .bindTooltip(`Skjellmålested: ${s.name}`)
      }

      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.marker([lat, lng]).addTo(map)
        await fetchPoint(lat, lng)
      })

      mapRef.current = map
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  async function flyToLocation(loc: Location) {
    if (!mapRef.current) return
    mapRef.current.setView([loc.lat, loc.lon], 10, { animate: true })
    const L = await import('leaflet')
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.marker([loc.lat, loc.lon]).addTo(mapRef.current)
    await fetchPoint(loc.lat, loc.lon, loc.name)
  }

  async function handleAddFavorite() {
    if (!user || !selected) return router.push('/auth')
    const already = favorites.find((f: any) => f.name === selected.location.name)
    if (already) { setSaveMsg('Allerede lagret'); setTimeout(() => setSaveMsg(''), 2000); return }
    const { data, error } = await supabase
      .from('favorite_locations')
      .insert({ user_id: user.id, name: selected.location.name, lat: selected.location.lat, lon: selected.location.lon })
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

  function getDayScores(dayOffset: number) {
    if (!selected?.hourly) return { avg: null, best: [], scores: [] }
    const start = dayOffset * 24
    const moon = moonPhase(new Date())
    const scores = Array.from({ length: 24 }, (_, h) => {
      const i = start + h
      return calcScore(
        selected.hourly!.wind_speed_10m[i] ?? 10,
        selected.hourly!.cloud_cover[i] ?? 50,
        selected.hourly!.temperature_2m[i] ?? 12,
        h, tideWeight, selected.waveHeight,
        selected.hourly!.surface_pressure[i] ?? null,
        selected.pressureTrend, selected.seaTemp,
        selected.hourly!.precipitation[i] ?? null,
        moon.score, selected.currentSpeed, selected.visibilityScore
      )
    })
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / 24)
    const best = scores
      .map((s, h) => ({ h, s }))
      .filter(x => x.h >= 4 && x.h <= 22 && x.s >= 65)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
    return { avg, best, scores }
  }

  const nowH = new Date().getHours()
  const moon = moonPhase(new Date())
  const shellfish = selected ? nearestShellfish(selected.location.lat, selected.location.lon) : null
  const { avg: dayAvg, best: bestTimes, scores: hourlyScores } = getDayScores(activeDay)

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-20">
        <span className="font-medium text-gray-900 text-sm">🎣 SimpleSaltwater</span>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>
          <span className="hidden sm:block">Skjellmålested</span>
        </div>
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

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        {user && favorites.length > 0 && (
          <div className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-3 space-y-3 hidden lg:block">
            <FavoritesComparison favorites={favorites} onSelect={flyToLocation} />
            <FavoritesList favorites={favorites} onSelect={flyToLocation} onRemove={handleRemoveFavorite} />
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
          <div id="main-map" style={{ width: '100%', height: '100%' }} />

          <div className="absolute top-3 left-3 right-3 z-10 max-w-sm">
            <LocationSearch onSelect={flyToLocation} />
          </div>

          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-10">
              <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200">Henter data...</div>
            </div>
          )}

          {!selected && !mapLoading && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-400 shadow-sm z-10 whitespace-nowrap">
              Klikk i kartet for fiskeforhold
            </div>
          )}
        </div>

        {/* Right info panel */}
        {selected && (
          <div className="w-72 shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">

            {/* Panel header med lukkeknapp */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 shrink-0">
              <p className="text-xs text-gray-500 truncate flex-1 mr-2">{selected.location.name}</p>
              <button
                onClick={() => setSelected(null)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 text-lg leading-none"
              >
                x
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1">

              {/* Score + dagvelger */}
              <div className="text-center">
                <div className="text-5xl font-medium text-gray-900">{dayAvg ?? selected.score}</div>
                <div className={`text-sm font-medium mt-1 ${selected.status.color}`}>{selected.status.label}</div>
                <div className="text-xs text-gray-400 mt-1">{moon.emoji} {moon.name}</div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map(i => {
                  const { avg: s } = getDayScores(i)
                  const st = s !== null ? getStatus(s) : null
                  return (
                    <button key={i} onClick={() => setActiveDay(i)}
                      className={`rounded-lg p-2 text-left border transition-all ${activeDay === i ? 'border-gray-800' : 'border-gray-200 hover:border-gray-400'}`}>
                      <div className="text-xs text-gray-400">{dayLabel(i)}</div>
                      <div className="text-lg font-medium text-gray-900">{s ?? '—'}</div>
                      {st && <div className={`text-xs ${st.color}`}>{st.label}</div>}
                    </button>
                  )
                })}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {(['fiske', 'tidevann', 'skjell'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-xs font-medium capitalize border-b-2 transition-all ${activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>
                    {tab === 'fiske' ? 'Fiske' : tab === 'tidevann' ? 'Tidevann' : 'Skjell'}
                  </button>
                ))}
              </div>

              {/* TAB: Fiske */}
              {activeTab === 'fiske' && (
                <div className="space-y-3">

                  {/* Beste tider */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Beste fisketider</p>
                    {bestTimes.length > 0 ? (
                      <div className="space-y-1.5">
                        {bestTimes.map((t, i) => (
                          <div key={t.h} className={`flex items-center justify-between rounded-lg px-3 py-2 ${i === 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
                            <div>
                              <span className={`text-sm font-medium ${i === 0 ? 'text-green-700' : 'text-gray-700'}`}>{fmt(t.h)}</span>
                              {i === 0 && <span className="ml-2 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Best</span>}
                            </div>
                            <span className={`text-sm font-medium ${i === 0 ? 'text-green-700' : 'text-gray-500'}`}>{t.s}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Ingen gode vinduer i dag</p>
                    )}
                  </div>

                  {/* Soloppgang/ned */}
                  {(selected.sunrise || selected.sunset) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-orange-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-400">Soloppgang</p>
                        <p className="text-sm font-medium text-orange-700">{selected.sunrise ? formatSunTime(selected.sunrise) : '—'}</p>
                        <p className="text-xs text-orange-500">Morgenbit</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-400">Solnedgang</p>
                        <p className="text-sm font-medium text-amber-700">{selected.sunset ? formatSunTime(selected.sunset) : '—'}</p>
                        <p className="text-xs text-amber-500">Kveldsbit</p>
                      </div>
                    </div>
                  )}

                  {/* Nøkkeldata */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Vind', value: `${selected.wind} km/t`, sub: selected.windDirection !== null ? windDirectionLabel(selected.windDirection) : '' },
                      { label: 'Bølger', value: selected.waveHeight !== null ? `${selected.waveHeight.toFixed(1)} m` : '—', sub: selected.waveHeight !== null ? (selected.waveHeight < 0.5 ? 'Rolig' : selected.waveHeight < 1.5 ? 'Moderat' : 'Røff') : '' },
                      { label: 'Vanntemp', value: selected.seaTemp !== null ? `${selected.seaTemp.toFixed(1)}°C` : '—', sub: '' },
                      { label: 'Strøm', value: selected.currentSpeed !== null ? `${selected.currentSpeed.toFixed(2)} m/s` : '—', sub: currentLabel(selected.currentSpeed) },
                      { label: 'Lufttrykk', value: selected.pressure !== null ? `${Math.round(selected.pressure)} hPa` : '—', sub: pressureLabel(selected.pressureTrend) },
                      { label: 'Sikt', value: visibilityLabel(selected.visibilityScore), sub: 'Estimert' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
                        {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Tidevannsvekt */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-400">Tidevannsvekt i score</span>
                      <span className="text-xs font-medium text-gray-600">{Math.round(tideWeight * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={40} step={5}
                      value={Math.round(tideWeight * 100)}
                      onChange={e => setTideWeight(Number(e.target.value) / 100)}
                      className="w-full accent-blue-500" />
                    <div className="flex justify-between text-xs text-gray-300 mt-1">
                      <span>Ingen</span><span>Svært viktig</span>
                    </div>
                  </div>

                  {/* Advarsler */}
                  {selected.waveHeight !== null && selected.waveHeight > 1.5 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                      <p className="text-xs text-red-600 font-medium">Bølgehøyde over 1.5m — vurder om det er trygt</p>
                    </div>
                  )}
                  {selected.pressureTrend !== null && selected.pressureTrend < -2 && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs text-green-700 font-medium">Lufttrykket faller — fisken biter trolig godt</p>
                    </div>
                  )}

                  {/* Lagre + logg */}
                  {user ? (
                    <div className="space-y-2">
                      <button onClick={handleAddFavorite} className="w-full py-2 border border-blue-200 text-blue-600 rounded-xl text-sm hover:bg-blue-50">
                        {saveMsg || '★ Lagre sted'}
                      </button>
                      {!showLog ? (
                        <button onClick={() => setShowLog(true)} className="w-full py-2 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">
                          + Logg fiskeøkt
                        </button>
                      ) : (
                        <FishingLogForm user={user} location={selected.location} currentScore={selected.score} onClose={() => setShowLog(false)} />
                      )}
                    </div>
                  ) : (
                    <button onClick={() => router.push('/auth')} className="w-full py-2 border border-gray-200 text-gray-400 rounded-xl text-sm hover:bg-gray-50">
                      Logg inn for å lagre steder
                    </button>
                  )}
                </div>
              )}

              {/* TAB: Tidevann */}
              {activeTab === 'tidevann' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tidevann i dag</p>
                    <div className="text-center bg-blue-50 rounded-xl p-3 mb-3">
                      <p className="text-xs text-gray-400 mb-1">Nå ({fmt(nowH)})</p>
                      <p className="text-2xl font-medium text-blue-700">{tideLabel(nowH)}</p>
                      <p className="text-xs text-blue-500 mt-1">Score: {scoreTide(nowH)}/100</p>
                    </div>

                    {/* Tidegraf */}
                    <div className="flex items-end gap-px h-16 mb-1">
                      {Array.from({ length: 24 }, (_, h) => {
                        const height = Math.max(4, Math.round(simulateTide(h) * 0.58))
                        const tScore = scoreTide(h)
                        const isNow = Math.abs(h - nowH) <= 0
                        const color = isNow ? '#2563eb' : tScore >= 80 ? '#16a34a' : tScore >= 60 ? '#2563eb' : tScore >= 40 ? '#d97706' : '#e5e7eb'
                        return (
                          <div key={h} className="flex-1 rounded-t transition-all" style={{ height: `${height}px`, background: color }} title={`${fmt(h)}: ${tideLabel(h)}`} />
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-300">
                      <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block"></span>Bra</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block"></span>OK</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block"></span>Middels</span>
                    </div>
                  </div>

                  {/* Beste tider for tidevann */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Beste tidepunkter (tidevann)</p>
                    <div className="space-y-1">
                      {Array.from({ length: 24 }, (_, h) => ({ h, score: scoreTide(h) }))
                        .filter(x => x.h >= 4 && x.score >= 80)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 4)
                        .map((t, i) => (
                          <div key={t.h} className={`flex justify-between items-center rounded-lg px-3 py-2 ${i === 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
                            <span className={`text-sm font-medium ${i === 0 ? 'text-green-700' : 'text-gray-700'}`}>{fmt(t.h)} — {tideLabel(t.h)}</span>
                            <span className={`text-sm ${i === 0 ? 'text-green-600' : 'text-gray-400'}`}>{t.score}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Om tidevann og fiske</p>
                    <p className="text-xs text-blue-600">Stigende tidevann mot høyvann er generelt best for saltvannsfiske — fisken er mer aktiv og beveger seg innover. Unngå lavvann der det er mulig.</p>
                  </div>

                  <p className="text-xs text-gray-300 text-center">Simulert sinemodell — ikke nøyaktig for alle lokasjoner</p>
                </div>
              )}

              {/* TAB: Skjell */}
              {activeTab === 'skjell' && shellfish && (
                <div className="space-y-3">
                  <div className={`rounded-xl p-4 border ${isShellSeason() ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      {isShellSeason() ? 'Skjellsesong aktiv' : 'Utenfor skjellsesong'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Mattilsynet overvaker skjell fra mars til oktober og publiserer varsel hver fredag.
                      {!isShellSeason() && ' Varselet er for oeyeblikket ikke aktivt.'}
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Naermeste malested</p>
                    <p className="text-base font-medium text-gray-900">{shellfish.station.name}</p>
                    <p className="text-xs text-gray-400 mb-3">Ca. {shellfish.distKm} km fra valgt punkt</p>
                    {shellfish.distKm > 100 && (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">
                        Malestedet er langt unna. Skjellgifter kan variere lokalt — vaer ekstra forsiktig.
                      </p>
                    )}
                    
                      href="https://www.mattilsynet.no/mat-og-drikke/forbrukere/blaskjellvarsel"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-2 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800"
                    >
                      Se varsel pa Mattilsynet.no
                    </a>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hva du bor vite</p>
                    {[
                      { icon: '🔴', text: 'Gronn = trygt, gult = varer pa lager, rodt = ikke spis' },
                      { icon: '📅', text: 'Varselet oppdateres hver fredag innen kl. 15' },
                      { icon: '📍', text: 'Gifter kan variere langs kysten — sjekk naermeste malested' },
                      { icon: '⚠️', text: 'Skjell som selges i butikk er alltid kontrollert' },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-2 bg-gray-50 rounded-lg p-2.5">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <p className="text-xs text-gray-600">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
