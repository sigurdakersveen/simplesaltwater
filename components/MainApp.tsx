'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  calcScore, getStatus, simulateTide, scoreTide, tideLabel, moonPhase,
  estimateVisibility, currentLabel, pressureLabel, windDirectionLabel,
  formatSunTime, visibilityLabel
} from '@/lib/fishing-score'
import { fetchMarineData } from '@/lib/marine'
import { fetchTideData, type TideData } from '@/lib/tide'
import {
  getRecommendation, getFishTypeModifier, getDivingScore,
  generateHotspots, filterSeaHotspots, type FishType, type AppMode, type Hotspot
} from '@/lib/recommendations'
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
  { name: 'Kvitsoy', lat: 59.07, lon: 5.41 },
  { name: 'Talgje', lat: 59.12, lon: 5.71 },
  { name: 'Espevaer', lat: 59.59, lon: 5.15 },
  { name: 'Ryvarden', lat: 59.91, lon: 5.23 },
  { name: 'Fjon', lat: 61.42, lon: 5.04 },
  { name: 'Maloy', lat: 61.94, lon: 5.11 },
  { name: 'Ona', lat: 62.86, lon: 6.54 },
  { name: 'Flatanger', lat: 64.49, lon: 10.83 },
  { name: 'Namsos', lat: 64.46, lon: 11.49 },
  { name: 'Bodo', lat: 67.28, lon: 14.37 },
  { name: 'Tromso', lat: 69.65, lon: 18.96 },
  { name: 'Oslofjorden', lat: 59.44, lon: 10.53 },
]

const MAP_LAYERS = {
  kart: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', maxZoom: 19 },
  flyfoto: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri', maxZoom: 19 },
  sjokart: { url: 'https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png', attribution: '© Kartverket', maxZoom: 18 },
}

type MapType = 'kart' | 'flyfoto' | 'sjokart'

const FISH_TYPES: { value: FishType; label: string }[] = [
  { value: 'general', label: 'Generelt' },
  { value: 'torsk', label: 'Torsk' },
  { value: 'sjooret', label: 'Sjooret' },
  { value: 'makrell', label: 'Makrell' },
]

function nearestShellfish(lat: number, lon: number) {
  let best = SHELLFISH_STATIONS[0]; let bestDist = Infinity
  for (const s of SHELLFISH_STATIONS) {
    const d = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lon - lon, 2))
    if (d < bestDist) { bestDist = d; best = s }
  }
  return { station: best, distKm: Math.round(bestDist * 111) }
}

function isShellSeason() { const m = new Date().getMonth() + 1; return m >= 3 && m <= 10 }
function fmt(h: number) { return h.toString().padStart(2, '0') + ':00' }
function dayLabel(offset: number) {
  if (offset === 0) return 'I dag'; if (offset === 1) return 'I morgen'
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('nb-NO', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
}

export default function MainApp({ user, initialFavorites }: { user: any; initialFavorites: any[] }) {
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const hotspotMarkersRef = useRef<any[]>([])
  const tileLayerRef = useRef<any>(null)
  const [favorites, setFavorites] = useState(initialFavorites)
  const [selected, setSelected] = useState<PointData | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [activeDay, setActiveDay] = useState(0)
  const [activeTab, setActiveTab] = useState<'fiske' | 'tidevann' | 'skjell'>('fiske')
  const [mapType, setMapType] = useState<MapType>('kart')
  const [fishType, setFishType] = useState<FishType>('general')
  const [appMode, setAppMode] = useState<AppMode>('fiske')
  const [tideData, setTideData] = useState<TideData | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function fetchPoint(lat: number, lng: number, name?: string) {
    setMapLoading(true); setSelected(null); setShowLog(false); setActiveTab('fiske'); setActiveDay(0)
    try {
      const [weatherRes, marineResult] = await Promise.all([
        fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&hourly=wind_speed_10m,cloud_cover,temperature_2m,winddirection_10m,surface_pressure,precipitation&daily=sunrise,sunset&forecast_days=3&wind_speed_unit=kmh&timezone=auto'),
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
      const score = calcScore(weather.hourly?.wind_speed_10m?.[h] ?? 10, weather.hourly?.cloud_cover?.[h] ?? 50, weather.hourly?.temperature_2m?.[h] ?? 12, h, 0.15, marineResult.waveHeight, pressNow, pressureTrend, marineResult.seaTemp, precip, moon.score, marineResult.currentSpeed, vis)
      let locName = name ?? (lat.toFixed(2) + 'N ' + lng.toFixed(2) + 'O')
      if (!name) {
        try {
          const geo = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json', { headers: { 'Accept-Language': 'nb' } })
          const gd = await geo.json()
          locName = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || locName
        } catch { }
      }
      setSelected({ location: { lat, lon: lng, name: locName }, score, status: getStatus(score), wind: Math.round(weather.hourly?.wind_speed_10m?.[h] ?? 10), waveHeight: marineResult.waveHeight, seaTemp: marineResult.seaTemp, currentSpeed: marineResult.currentSpeed, currentDirection: marineResult.currentDirection, pressure: pressNow, pressureTrend, precipitation: precip, windDirection: windDir, sunrise: weather.daily?.sunrise?.[0] ?? null, sunset: weather.daily?.sunset?.[0] ?? null, visibilityScore: vis, hourly: weather.hourly })
    } catch { }
    // Fetch real tide data from Kartverket
    try {
      const tide = await fetchTideData(lat, lng)
      setTideData(tide)
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
      const layer = MAP_LAYERS.kart
      tileLayerRef.current = L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: layer.maxZoom }).addTo(map)
      mapRef.current = map
      for (const s of SHELLFISH_STATIONS) {
        const icon = L.divIcon({ className: '', html: '<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>', iconSize: [10, 10], iconAnchor: [5, 5] })
        L.marker([s.lat, s.lon], { icon }).addTo(map).bindTooltip('Skjellmalested: ' + s.name)
      }
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng
        const currentZoom = map.getZoom()
        const targetZoom = currentZoom < 10 ? 11 : currentZoom > 14 ? 13 : currentZoom
        map.setView([lat, lng], targetZoom, { animate: true, duration: 0.5 })
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.marker([lat, lng]).addTo(map)
        await fetchPoint(lat, lng)
      })
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  // Add hotspot markers when selected changes — filtered to sea only
  useEffect(() => {
    if (!mapRef.current || !selected) return
    hotspotMarkersRef.current.forEach(m => m.remove())
    hotspotMarkersRef.current = []
    const rawSpots = generateHotspots(selected.location.lat, selected.location.lon, selected.score)

    // Filter to sea, then add markers
    filterSeaHotspots(rawSpots).then(spots => {
      if (!mapRef.current) return
      import('leaflet').then(L => {
        spots.forEach(spot => {
          const colors: Record<string, string> = { cod: '#1d4ed8', current: '#7c3aed', depth: '#0f766e', shore: '#b45309', point: '#15803d' }
          const color = colors[spot.type] || '#1d4ed8'
          const icon = L.divIcon({
            className: '',
            html: '<div style="background:' + color + ';color:#fff;font-size:10px;padding:2px 6px;border-radius:10px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3);font-weight:500">' + spot.label + '</div>',
            iconAnchor: [0, 10],
          })
          const m = L.marker([spot.lat, spot.lon], { icon }).addTo(mapRef.current)
          hotspotMarkersRef.current.push(m)
        })
      })
    })
  }, [selected?.location.lat, selected?.location.lon])

  function switchMapType(type: MapType) {
    setMapType(type)
    if (!mapRef.current || !tileLayerRef.current) return
    tileLayerRef.current.setUrl(MAP_LAYERS[type].url)
  }

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
    const { data, error } = await supabase.from('favorite_locations').insert({ user_id: user.id, name: selected.location.name, lat: selected.location.lat, lon: selected.location.lon }).select().single()
    if (!error && data) { setFavorites((prev: any[]) => [data, ...prev]); setSaveMsg('Lagret!'); setTimeout(() => setSaveMsg(''), 2000) }
  }

  async function handleRemoveFavorite(id: string) {
    await supabase.from('favorite_locations').delete().eq('id', id)
    setFavorites((prev: any[]) => prev.filter((f: any) => f.id !== id))
  }

  async function handleSignOut() { await supabase.auth.signOut(); router.refresh() }

  function getDayScores(dayOffset: number) {
    if (!selected?.hourly) return { avg: null, best: [], scores: [] }
    const start = dayOffset * 24
    const moon = moonPhase(new Date())
    const scores = Array.from({ length: 24 }, (_, h) => {
      const i = start + h
      const base = calcScore(selected.hourly!.wind_speed_10m[i] ?? 10, selected.hourly!.cloud_cover[i] ?? 50, selected.hourly!.temperature_2m[i] ?? 12, h, 0.15, selected.waveHeight, selected.hourly!.surface_pressure[i] ?? null, selected.pressureTrend, selected.seaTemp, selected.hourly!.precipitation[i] ?? null, moon.score, selected.currentSpeed, selected.visibilityScore)
      return getFishTypeModifier(fishType, base, h, selected.seaTemp)
    })
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / 24)
    const best = scores.map((s, h) => ({ h, s })).filter(x => x.h >= 4 && x.h <= 22 && x.s >= 55).sort((a, b) => b.s - a.s).slice(0, 4)
    return { avg, best, scores }
  }

  const nowH = new Date().getHours()
  const moon = moonPhase(new Date())
  const shellfish = selected ? nearestShellfish(selected.location.lat, selected.location.lon) : null
  const { avg: dayAvg, best: bestTimes, scores: hourlyScores } = getDayScores(activeDay)

  const recommendation = useMemo(() => {
    if (!selected || !hourlyScores.length) return null
    return getRecommendation({ scores: hourlyScores, nowH, wind: selected.wind, waveHeight: selected.waveHeight, pressureTrend: selected.pressureTrend, precipitation: selected.precipitation, currentSpeed: selected.currentSpeed, fishType, mode: appMode })
  }, [selected, hourlyScores, nowH, fishType, appMode])

  const tideStatus = tideData ?? null
  const divingScore = selected ? getDivingScore(selected.waveHeight, selected.currentSpeed, selected.visibilityScore) : null

  const urgencyStyles = { now: 'bg-green-50 border-green-200', soon: 'bg-blue-50 border-blue-200', wait: 'bg-amber-50 border-amber-200', danger: 'bg-red-50 border-red-200' }
  const urgencyTextStyles = { now: 'text-green-800', soon: 'text-blue-800', wait: 'text-amber-800', danger: 'text-red-800' }
  const urgencySubStyles = { now: 'text-green-600', soon: 'text-blue-600', wait: 'text-amber-600', danger: 'text-red-600' }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-20">
        <span className="font-medium text-gray-900 text-sm">SimpleSaltwater</span>
        <div className="flex items-center gap-3 flex-1 mx-4">
          <div className="flex-1 max-w-xs"><LocationSearch onSelect={flyToLocation} /></div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden shrink-0">
            {(['kart', 'flyfoto', 'sjokart'] as MapType[]).map((type, i) => (
              <button key={type} onClick={() => switchMapType(type)} className={'px-3 py-1.5 text-xs font-medium ' + (i > 0 ? 'border-l border-gray-200 ' : '') + (mapType === type ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                {type === 'kart' ? 'Kart' : type === 'flyfoto' ? 'Flyfoto' : 'Sjokart'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <><button onClick={() => router.push('/log')} className="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">Fiskelogg</button><button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-700">Logg ut</button></>
          ) : (
            <button onClick={() => router.push('/auth')} className="text-sm bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800">Logg inn</button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {user && favorites.length > 0 && (
          <div className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-3 space-y-3 hidden lg:block">
            <FavoritesComparison favorites={favorites} onSelect={flyToLocation} />
            <FavoritesList favorites={favorites} onSelect={flyToLocation} onRemove={handleRemoveFavorite} />
          </div>
        )}

        <div className="flex-1 relative min-w-0">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
          <div id="main-map" className="absolute inset-0" />
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-10">
              <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">Henter data...</div>
            </div>
          )}
          {!selected && !mapLoading && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-400 shadow-sm z-10 whitespace-nowrap">
              Klikk i kartet for fiskeforhold
            </div>
          )}
        </div>

        {selected && (
          <div className="w-72 shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 shrink-0">
              <p className="text-xs text-gray-500 truncate flex-1 mr-2">{selected.location.name}</p>
              <button onClick={() => { setSelected(null); setTideData(null); hotspotMarkersRef.current.forEach(m => m.remove()); hotspotMarkersRef.current = [] }} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-base leading-none">x</button>
            </div>

            <div className="p-4 space-y-3 flex-1">

              {/* Mode + Fish type toggles */}
              <div className="flex gap-2">
                <div className="flex border border-gray-200 rounded-lg overflow-hidden flex-1">
                  {(['fiske', 'dykking'] as AppMode[]).map((m, i) => (
                    <button key={m} onClick={() => setAppMode(m)} className={'flex-1 py-1 text-xs font-medium ' + (i > 0 ? 'border-l border-gray-200 ' : '') + (appMode === m ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50')}>
                      {m === 'fiske' ? 'Fiske' : 'Dykking'}
                    </button>
                  ))}
                </div>
                {appMode === 'fiske' && (
                  <select value={fishType} onChange={e => setFishType(e.target.value as FishType)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white">
                    {FISH_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                )}
              </div>

              {/* RECOMMENDATION BOX */}
              {recommendation && (
                <div className={'rounded-xl p-3 border ' + urgencyStyles[recommendation.urgency]}>
                  <p className={'text-sm font-medium ' + urgencyTextStyles[recommendation.urgency]}>{recommendation.action}</p>
                  <p className={'text-xs mt-1 ' + urgencySubStyles[recommendation.urgency]}>{recommendation.reason}</p>
                </div>
              )}

              {/* Diving score */}
              {appMode === 'dykking' && divingScore && (
                <div className="text-center py-2">
                  <div className="text-4xl font-medium text-gray-900">{divingScore.score}</div>
                  <div className={'text-sm font-medium mt-1 ' + divingScore.color}>{divingScore.label}</div>
                </div>
              )}

              {/* Fishing score */}
              {appMode === 'fiske' && (
                <div className="text-center">
                  <div className="text-5xl font-medium text-gray-900">{dayAvg ?? selected.score}</div>
                  <div className={'text-sm font-medium mt-1 ' + selected.status.color}>{selected.status.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{moon.emoji} {moon.name}</div>
                </div>
              )}

              {/* 3-day */}
              {appMode === 'fiske' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map(i => {
                    const { avg: s } = getDayScores(i)
                    const st = s !== null ? getStatus(s) : null
                    return (
                      <button key={i} onClick={() => setActiveDay(i)} className={'rounded-lg p-2 text-left border transition-all ' + (activeDay === i ? 'border-gray-800' : 'border-gray-200 hover:border-gray-400')}>
                        <div className="text-xs text-gray-400">{dayLabel(i)}</div>
                        <div className="text-lg font-medium text-gray-900">{s ?? '—'}</div>
                        {st && <div className={'text-xs ' + st.color}>{st.label}</div>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Tide status bar — real Kartverket data */}
              {tideStatus && (
                <div className={'rounded-xl p-3 border flex items-center justify-between ' + (tideStatus.nowTrend === 'rising' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200')}>
                  <div>
                    <p className={'text-sm font-medium ' + (tideStatus.nowTrend === 'rising' ? 'text-blue-700' : 'text-gray-600')}>{tideStatus.label}</p>
                    {tideStatus.nowValue !== null && (
                      <p className={'text-xs mt-0.5 ' + (tideStatus.nowTrend === 'rising' ? 'text-blue-500' : 'text-gray-400')}>
                        Vannstand: {tideStatus.nowValue > 0 ? '+' : ''}{tideStatus.nowValue} cm
                      </p>
                    )}
                  </div>
                  <div className={'text-2xl ' + (tideStatus.nowTrend === 'rising' ? 'opacity-100' : 'opacity-40')}>
                    {tideStatus.nowTrend === 'rising' ? '↑' : '↓'}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {(['fiske', 'tidevann', 'skjell'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={'flex-1 py-2 text-xs font-medium border-b-2 transition-all ' + (activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400')}>
                    {tab === 'fiske' ? 'Fiske' : tab === 'tidevann' ? 'Tidevann' : 'Skjell'}
                  </button>
                ))}
              </div>

              {/* Tab: Fiske */}
              {activeTab === 'fiske' && (
                <div className="space-y-3">

                  {/* Visual timeline */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">24-timers oversikt</p>
                    <div className="flex items-end gap-px h-10 rounded overflow-hidden">
                      {hourlyScores.slice(0, 24).map((s, h) => {
                        const isNow = h === nowH
                        const bg = isNow ? '#1d4ed8' : s >= 70 ? '#16a34a' : s >= 55 ? '#ca8a04' : '#e5e7eb'
                        const height = Math.max(15, Math.round((s / 100) * 100))
                        return (
                          <div key={h} className="flex-1 rounded-sm" style={{ height: height + '%', background: bg, opacity: isNow ? 1 : 0.85 }} title={fmt(h) + ': ' + s} />
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-300 mt-1">
                      <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600 inline-block"></span>Bra</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-600 inline-block"></span>OK</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-300 inline-block"></span>Dårlig</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-700 inline-block"></span>Na</span>
                    </div>
                  </div>

                  {/* Beste tider */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Beste fisketider</p>
                    {bestTimes.length > 0 ? (
                      <div className="space-y-1.5">
                        {bestTimes.map((t, i) => (
                          <div key={t.h} className={'flex items-center justify-between rounded-lg px-3 py-2 ' + (i === 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50')}>
                            <div>
                              <span className={'text-sm font-medium ' + (i === 0 ? 'text-green-700' : 'text-gray-700')}>{fmt(t.h)}</span>
                              {i === 0 && <span className="ml-2 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Best</span>}
                              {t.h === nowH && <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Na</span>}
                            </div>
                            <span className={'text-sm font-medium ' + (i === 0 ? 'text-green-700' : 'text-gray-500')}>{t.s}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-400">Ingen gode vinduer i dag</p>}
                  </div>

                  {/* Sol */}
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

                  {/* Skjellvarsel inline */}
                  {shellfish && (
                    <div className={'rounded-xl p-3 border ' + (isShellSeason() ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200')}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-700">Skjellvarsel</p>
                        {isShellSeason() && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Sesong aktiv</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-1">Naermeste: <span className="font-medium text-gray-700">{shellfish.station.name}</span> (~{shellfish.distKm} km)</p>
                      {isShellSeason() ? <p className="text-xs text-amber-700 mb-1">Sjekk Mattilsynet for ukens varsel</p> : <p className="text-xs text-gray-400 mb-1">Utenfor sesong (mars–oktober)</p>}
                      <a href="https://www.mattilsynet.no/mat-og-drikke/forbrukere/blaskjellvarsel" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Se varsel pa Mattilsynet.no</a>
                    </div>
                  )}

                  {/* Data grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Vind', value: selected.wind + ' km/t', sub: selected.windDirection !== null ? windDirectionLabel(selected.windDirection) : '' },
                      { label: 'Bolger', value: selected.waveHeight !== null ? selected.waveHeight.toFixed(1) + ' m' : '—', sub: selected.waveHeight !== null ? (selected.waveHeight < 0.5 ? 'Rolig' : selected.waveHeight < 1.5 ? 'Moderat' : 'Roff') : '' },
                      { label: 'Vanntemp', value: selected.seaTemp !== null ? selected.seaTemp.toFixed(1) + 'C' : '—', sub: '' },
                      { label: 'Strom', value: selected.currentSpeed !== null ? selected.currentSpeed.toFixed(2) + ' m/s' : '—', sub: currentLabel(selected.currentSpeed) },
                      { label: 'Lufttrykk', value: selected.pressure !== null ? Math.round(selected.pressure) + ' hPa' : '—', sub: pressureLabel(selected.pressureTrend) },
                      { label: 'Sikt', value: visibilityLabel(selected.visibilityScore), sub: 'Estimert' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
                        {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Alerts */}
                  {selected.waveHeight !== null && selected.waveHeight > 1.5 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                      <p className="text-xs text-red-600 font-medium">Bolgehøyde over 1.5m — vurder om det er trygt</p>
                    </div>
                  )}
                  {selected.pressureTrend !== null && selected.pressureTrend < -2 && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs text-green-700 font-medium">Lufttrykket faller — fisken biter trolig godt</p>
                    </div>
                  )}

                  {/* Lagre / logg */}
                  {user ? (
                    <div className="space-y-2">
                      <button onClick={handleAddFavorite} className="w-full py-2 border border-blue-200 text-blue-600 rounded-xl text-sm hover:bg-blue-50">{saveMsg || 'Lagre sted'}</button>
                      {!showLog ? (
                        <button onClick={() => setShowLog(true)} className="w-full py-2 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Logg fiskeøkt</button>
                      ) : (
                        <FishingLogForm user={user} location={selected.location} currentScore={selected.score} onClose={() => setShowLog(false)} />
                      )}
                    </div>
                  ) : (
                    <button onClick={() => router.push('/auth')} className="w-full py-2 border border-gray-200 text-gray-400 rounded-xl text-sm hover:bg-gray-50">Logg inn for a lagre steder</button>
                  )}
                </div>
              )}

              {/* Tab: Tidevann — ekte Kartverket-data */}
              {activeTab === 'tidevann' && (
                <div className="space-y-3">
                  {/* Now status */}
                  <div className="text-center bg-blue-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Na ({fmt(nowH)})</p>
                    {tideData ? (
                      <>
                        <p className="text-2xl font-medium text-blue-700">
                          {tideData.nowTrend === 'rising' ? 'Stigende' : tideData.nowTrend === 'falling' ? 'Fallende' : 'Ukjent'}
                        </p>
                        {tideData.nowValue !== null && (
                          <p className="text-sm text-blue-600 mt-1">
                            {tideData.nowValue > 0 ? '+' : ''}{tideData.nowValue} cm over sjokart-null
                          </p>
                        )}
                        <p className="text-xs text-blue-400 mt-1">Kilde: Kartverket</p>
                      </>
                    ) : (
                      <p className="text-lg text-blue-500">Henter tidevannsdata...</p>
                    )}
                  </div>

                  {/* Real tide chart if data available */}
                  {tideData && tideData.entries.length > 0 ? (
                    <>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tidevann i dag (cm)</p>
                        <div className="flex items-end gap-px h-16 rounded overflow-hidden">
                          {tideData.entries.map((e, h) => {
                            const allVals = tideData.entries.map(x => x.value)
                            const min = Math.min(...allVals)
                            const max = Math.max(...allVals)
                            const range = max - min || 1
                            const height = Math.max(8, Math.round(((e.value - min) / range) * 100))
                            const isNow = h === nowH
                            const isHigh = tideData.extremes.some(ex => ex.type === 'high' && new Date(ex.time).getHours() === h)
                            const isLow = tideData.extremes.some(ex => ex.type === 'low' && new Date(ex.time).getHours() === h)
                            const color = isNow ? '#1d4ed8' : isHigh ? '#16a34a' : isLow ? '#dc2626' : '#60a5fa'
                            return <div key={h} className="flex-1 rounded-t" style={{ height: height + '%', background: color }} title={fmt(h) + ': ' + e.value + ' cm'} />
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-300 mt-1">
                          <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600 inline-block"></span>Hoyvann</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"></span>Lavvann</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-700 inline-block"></span>Na</span>
                        </div>
                      </div>

                      {/* High/low table */}
                      {tideData.extremes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Hoyvann og lavvann</p>
                          <div className="space-y-1">
                            {tideData.extremes.map((ex, i) => {
                              const d = new Date(ex.time)
                              const hh = d.getHours()
                              const isPast = d < new Date()
                              return (
                                <div key={i} className={'flex justify-between items-center rounded-lg px-3 py-2 ' + (isPast ? 'opacity-40 bg-gray-50' : ex.type === 'high' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100')}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{ex.type === 'high' ? '▲' : '▼'}</span>
                                    <span className={'text-sm font-medium ' + (ex.type === 'high' ? 'text-green-700' : 'text-red-600')}>
                                      {ex.type === 'high' ? 'Hoyvann' : 'Lavvann'} {fmt(hh)}
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-500">{ex.value} cm</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Fallback sine chart */
                    <>
                      <div className="flex items-end gap-px h-16">
                        {Array.from({ length: 24 }, (_, h) => {
                          const height = Math.max(4, Math.round(simulateTide(h) * 0.58))
                          const tScore = scoreTide(h)
                          const isNow = h === nowH
                          const color = isNow ? '#2563eb' : tScore >= 80 ? '#16a34a' : tScore >= 60 ? '#60a5fa' : tScore >= 40 ? '#d97706' : '#e5e7eb'
                          return <div key={h} className="flex-1 rounded-t" style={{ height: height + 'px', background: color }} title={fmt(h)} />
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-gray-300">
                        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                      </div>
                      <p className="text-xs text-gray-300 text-center">Estimert — ingen data for dette omradet</p>
                    </>
                  )}

                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Tidevann og fiske</p>
                    <p className="text-xs text-blue-600">Stigende tidevann mot hoyvann er generelt best. Fisken er mer aktiv og beveger seg innover ved floende sjo.</p>
                  </div>
                </div>
              )}

              {/* Tab: Skjell */}
              {activeTab === 'skjell' && shellfish && (
                <div className="space-y-3">
                  <div className={'rounded-xl p-4 border ' + (isShellSeason() ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200')}>
                    <p className="text-sm font-medium text-gray-800 mb-1">{isShellSeason() ? 'Skjellsesong aktiv' : 'Utenfor skjellsesong'}</p>
                    <p className="text-xs text-gray-500">Mattilsynet overvaker skjell fra mars til oktober og publiserer varsel hver fredag.</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Naermeste malested</p>
                    <p className="text-base font-medium text-gray-900">{shellfish.station.name}</p>
                    <p className="text-xs text-gray-400 mb-3">Ca. {shellfish.distKm} km fra valgt punkt</p>
                    {shellfish.distKm > 100 && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">Malestedet er langt unna — skjellgifter kan variere lokalt.</p>}
                    <a href="https://www.mattilsynet.no/mat-og-drikke/forbrukere/blaskjellvarsel" target="_blank" rel="noopener noreferrer" className="block w-full text-center py-2 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800">Se varsel pa Mattilsynet.no</a>
                  </div>
                  <div className="space-y-2">
                    {[
                      { icon: '🟢', text: 'Gronn = trygt, gult = varer pa lager, rodt = ikke spis' },
                      { icon: '📅', text: 'Varselet oppdateres hver fredag innen kl. 15' },
                      { icon: '📍', text: 'Gifter kan variere langs kysten — sjekk naermeste malested' },
                      { icon: '🛒', text: 'Skjell fra butikk er alltid kontrollert' },
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
