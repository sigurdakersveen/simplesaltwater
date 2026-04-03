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
  activeDay: number
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
  const supabase = createClient()
  const router = useRouter()

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
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      for (const s of SHELLFISH_STATIONS) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
          iconSize: [10, 10], iconAnchor: [5, 5],
        })
        L.marker([s.lat, s.lon], { icon }).addTo(map)
          .bindTooltip(`Skjellmålested: ${s.name}`, { permanent: false })
      }

      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng
        setMapLoading(true)
        setSelected(null)
        setShowLog(false)

        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.marker([lat, lng]).addTo(map)

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

          let name = `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°Ø`
          try {
            const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'nb' } })
            const gd = await geo.json()
            name = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || name
          } catch { }

          setSelected({
            location: { lat, lon: lng, name },
            score, status: getStatus(score),
            wind: Math.round(weather.hourly?.wind_speed_10m?.[h] ?? 10),
            waveHeight: marineResult.waveHeight,
            seaTemp: marineResult.seaTemp,
            currentSpeed: marineResult.currentSpeed,
            currentDirection: marineResult.currentDirection,
            pressure: pressNow, pressureTrend,
            precipitation: precip,
            windDirection: windDir,
            sunrise: weather.daily?.sunrise?.[0] ?? null,
            sunset: weather.daily?.sunset?.[0] ?? null,
            visibilityScore: vis,
            hourly: weather.hourly,
            activeDay: 0,
          })
          setActiveDay(0)
        } catch { }
        setMapLoading(false)
      })

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  async function flyToLocation(loc: Location) {
    if (!mapRef.current) return
    mapRef.current.setView([loc.lat, loc.lon], 10, { animate: true })
    const L = await import('leaflet')
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.marker([loc.lat, loc.lon]).addTo(mapRef.current)
    setMapLoading(true)
    setSelected(null)
    try {
      const [weatherRes, marineResult] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wind_speed_10m,cloud_cover,temperature_2m,winddirection_10m,surface_pressure,precipitation&daily=sunrise,sunset&forecast_days=3&wind_speed_unit=kmh&timezone=auto`),
        fetchMarineData(loc.lat, loc.lon)
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
      setSelected({
        location: loc, score, status: getStatus(score),
        wind: Math.round(weather.hourly?.wind_speed_10m?.[h] ?? 10),
        waveHeight: marineResult.waveHeight,
        seaTemp: marineResult.seaTemp,
        currentSpeed: marineResult.currentSpeed,
        currentDirection: marineResult.currentDirection,
        pressure: pressNow, pressureTrend,
        precipitation: precip, windDirection: windDir,
        sunrise: weather.daily?.sunrise?.[0] ?? null,
        sunset: weather.daily?.sunset?.[0] ?? null,
        visibilityScore: vis, hourly: weather.hourly, activeDay: 0,
      })
      setActiveDay(0)
    } catch { }
    setMapLoading(false)
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

  function getDayScore(dayOffset: number) {
    if (!selected?.hourly) return null
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
    return Math.round(scores.reduce((a, b) => a + b, 0) / 24)
  }

  const nowH = new Date().getHours()
  const moon = moonPhase(new Date())
  const shellfish = selected ? nearestShellfish(selected.location.lat, selected.location.lon) : null

  const dayLabels = ['I dag', 'I morgen', (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toLocaleDateString('nb-NO', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase()) })()]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-20">
        <span className="font-medium text-gray-900 text-sm">🎣 SimpleSaltwater</span>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="hidden sm:block">Klikk i kartet for fiskeforhold</span>
          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
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

      {/* Main layout */}
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

          {/* Search overlay */}
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
          <div className="w-72 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4 space-y-3">

              {/* Score */}
              <div className="text-center pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-400 truncate mb-1">{selected.location.name}</p>
                <div className="text-5xl font-medium text-gray-900">{getDayScore(activeDay) ?? selected.score}</div>
                <div className={`text-sm font-medium mt-1 ${selected.status.color}`}>{selected.status.label}</div>
                <div className="text-xs text-gray-400 mt-1">{moon.emoji} {moon.name}</div>
              </div>

              {/* 3-day selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map(i => {
                  const s = getDayScore(i)
                  const st = s !== null ? getStatus(s) : null
                  return (
                    <button key={i} onClick={() => setActiveDay(i)}
                      className={`rounded-lg p-2 text-left border transition-all ${activeDay === i ? 'border-gray-800' : 'border-gray-200 hover:border-gray-400'}`}>
                      <div className="text-xs text-gray-400">{dayLabels[i]}</div>
                      <div className="text-lg font-medium text-gray-900">{s ?? '—'}</div>
                      {st && <div className={`text-xs ${st.color}`}>{st.label}</div>}
                    </button>
                  )
                })}
              </div>

              {/* Data grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Vind', value: `${selected.wind} km/t`, sub: '' },
                  { label: 'Bølger', value: selected.waveHeight !== null ? `${selected.waveHeight.toFixed(1)} m` : '—', sub: selected.waveHeight !== null ? (selected.waveHeight < 0.5 ? 'Rolig' : selected.waveHeight < 1.5 ? 'Moderat' : 'Røff') : '' },
                  { label: 'Vanntemp', value: selected.seaTemp !== null ? `${selected.seaTemp.toFixed(1)}°C` : '—', sub: '' },
                  { label: 'Strøm', value: selected.currentSpeed !== null ? `${selected.currentSpeed.toFixed(2)} m/s` : '—', sub: currentLabel(selected.currentSpeed) },
                  { label: 'Tidevann', value: tideLabel(nowH), sub: `Score: ${scoreTide(nowH)}` },
                  { label: 'Lufttrykk', value: selected.pressure !== null ? `${Math.round(selected.pressure)} hPa` : '—', sub: pressureLabel(selected.pressureTrend) },
                  { label: 'Nedbør', value: selected.precipitation !== null ? `${selected.precipitation.toFixed(1)} mm` : '—', sub: '' },
                  { label: 'Vindretning', value: selected.windDirection !== null ? windDirectionLabel(selected.windDirection) : '—', sub: '' },
                  { label: 'Sikt', value: visibilityLabel(selected.visibilityScore), sub: 'Estimert' },
                  { label: 'Soloppgang', value: selected.sunrise ? formatSunTime(selected.sunrise) : '—', sub: 'Beste morgenbit' },
                  { label: 'Solnedgang', value: selected.sunset ? formatSunTime(selected.sunset) : '—', sub: 'Beste kveldsbit' },
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
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-gray-400">Tidevannsvekt</span>
                  <span className="text-xs font-medium text-gray-600">{Math.round(tideWeight * 100)}%</span>
                </div>
                <input type="range" min={0} max={40} step={5}
                  value={Math.round(tideWeight * 100)}
                  onChange={e => setTideWeight(Number(e.target.value) / 100)}
                  className="w-full accent-blue-500" />
              </div>

              {/* Skjellvarsel */}
              {shellfish && (
                <div className={`rounded-xl p-3 border ${isShellSeason() ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-xs font-medium text-gray-600 mb-1">Skjellvarsel</p>
                  <p className="text-xs text-gray-500">Nærmeste målested: <span className="font-medium">{shellfish.station.name}</span> (~{shellfish.distKm} km)</p>
                  {isShellSeason() && <p className="text-xs text-amber-700 mt-1">Sjekk Mattilsynet før du plukker skjell</p>}
                  <a href="https://www.mattilsynet.no/mat-og-drikke/forbrukere/blaskjellvarsel" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 block">Se blaskjellvarsel pa Mattilsynet.no</a>
                </div>
              )}

              {/* Advarsler */}
              {selected.waveHeight !== null && selected.waveHeight > 1.5 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs text-red-600 font-medium">Bølgehøyde over 1.5m — vurder om det er trygt å dra ut</p>
                </div>
              )}

              {/* Lagre + logg */}
              {user && (
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
              )}

              {!user && (
                <button onClick={() => router.push('/auth')} className="w-full py-2 border border-gray-200 text-gray-400 rounded-xl text-sm hover:bg-gray-50">
                  Logg inn for å lagre steder
                </button>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
