'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  calcScore, getStatus, moonPhase, estimateVisibility,
  scoreCurrent, scoreWave, scoreSeaTemp, scorePressure,
  windDirectionLabel, formatSunTime, tideLabel, scoreTide,
  pressureLabel, visibilityLabel, currentLabel
} from '@/lib/fishing-score'
import { fetchMarineData } from '@/lib/marine'

type PointData = {
  lat: number
  lon: number
  name: string
  score: number | null
  status: { label: string; color: string } | null
  wind: number | null
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
  loading: boolean
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

export default function MapView() {
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const [selected, setSelected] = useState<PointData | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (mapRef.current) return
    import('leaflet').then(L => {
      leafletRef.current = L

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map('map', {
        center: [65, 14],
        zoom: 5,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      // Skjellvarsel-stasjoner
      for (const s of SHELLFISH_STATIONS) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        })
        L.marker([s.lat, s.lon], { icon })
          .addTo(map)
          .bindTooltip(`Skjellmålested: ${s.name}`, { permanent: false })
      }

      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng
        setLoading(true)
        setSelected(null)

        try {
          const [weatherRes, marineResult] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,cloud_cover,temperature_2m,wind_direction_10m,surface_pressure,precipitation&daily=sunrise,sunset&forecast_days=1&wind_speed_unit=kmh&timezone=auto`),
            fetchMarineData(lat, lng)
          ])
          const weather = await weatherRes.json()
          const c = weather.current
          const h = new Date().getHours()
          const month = new Date().getMonth() + 1
          const pressNow = c?.surface_pressure ?? null
          const precip = c?.precipitation ?? null
          const windDir = c?.wind_direction_10m ?? null
          const vis = estimateVisibility(precip, marineResult.waveHeight, month)
          const moon = moonPhase(new Date())

          const score = calcScore(
            c?.wind_speed_10m ?? 10,
            c?.cloud_cover ?? 50,
            c?.temperature_2m ?? 12,
            h, 0.15,
            marineResult.waveHeight,
            pressNow, null,
            marineResult.seaTemp,
            precip,
            moon.score,
            marineResult.currentSpeed,
            vis
          )

          // Reverse geocode
          let name = `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°Ø`
          try {
            const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'nb' } })
            const gd = await geo.json()
            name = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || name
          } catch { }

          setSelected({
            lat, lon: lng, name, score,
            status: getStatus(score),
            wind: Math.round(c?.wind_speed_10m ?? 10),
            waveHeight: marineResult.waveHeight,
            seaTemp: marineResult.seaTemp,
            currentSpeed: marineResult.currentSpeed,
            currentDirection: marineResult.currentDirection,
            pressure: pressNow,
            pressureTrend: null,
            precipitation: precip,
            windDirection: windDir,
            sunrise: weather.daily?.sunrise?.[0] ?? null,
            sunset: weather.daily?.sunset?.[0] ?? null,
            visibilityScore: vis,
            loading: false,
          })
        } catch { }
        setLoading(false)
      })

      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const shellfish = selected ? nearestShellfish(selected.lat, selected.lon) : null
  const moon = moonPhase(new Date())

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:text-gray-800">← Tilbake</button>
        <span className="font-medium text-gray-900 text-sm">🗺 Kart</span>
        <span className="text-xs text-gray-400 ml-2">Klikk i havet for fiskeforhold</span>
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-white"></div>
          <span className="text-xs text-gray-400">Skjellmålested</span>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1" style={{ minHeight: 0 }}>

        {/* Kart */}
        <div className="flex-1 relative" style={{ minHeight: '400px' }}>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
          <div id="map" style={{ width: '100%', height: '100%', minHeight: '400px' }} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 z-10">
              <div className="text-sm text-gray-500">Henter data...</div>
            </div>
          )}
          {!selected && !loading && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 shadow-sm z-10">
              Klikk på et sted i havet for å se fiskeforhold
            </div>
          )}
        </div>

        {/* Info-panel */}
        {selected && (
          <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>
            <div className="p-4 space-y-3">

              {/* Score */}
              <div className="text-center py-3 border-b border-gray-100">
                <p className="text-xs text-gray-400 mb-1">{selected.name}</p>
                <div className="text-5xl font-medium text-gray-900">{selected.score}</div>
                <div className={`text-sm font-medium mt-1 ${selected.status?.color}`}>{selected.status?.label}</div>
                <div className="text-xs text-gray-400 mt-1">{moon.emoji} {moon.name}</div>
              </div>

              {/* Nøkkeldata grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Vind', value: selected.wind !== null ? `${selected.wind} km/t` : '—', sub: '' },
                  { label: 'Bølger', value: selected.waveHeight !== null ? `${selected.waveHeight.toFixed(1)} m` : '—', sub: selected.waveHeight !== null ? (selected.waveHeight < 0.5 ? 'Rolig' : selected.waveHeight < 1.5 ? 'Moderat' : 'Røff') : '' },
                  { label: 'Vanntemp', value: selected.seaTemp !== null ? `${selected.seaTemp.toFixed(1)}°C` : '—', sub: '' },
                  { label: 'Strøm', value: selected.currentSpeed !== null ? `${selected.currentSpeed.toFixed(2)} m/s` : '—', sub: currentLabel(selected.currentSpeed) },
                  { label: 'Lufttrykk', value: selected.pressure !== null ? `${Math.round(selected.pressure)} hPa` : '—', sub: pressureLabel(selected.pressureTrend) },
                  { label: 'Nedbør', value: selected.precipitation !== null ? `${selected.precipitation.toFixed(1)} mm` : '—', sub: '' },
                  { label: 'Vindretning', value: selected.windDirection !== null ? windDirectionLabel(selected.windDirection) : '—', sub: '' },
                  { label: 'Sikt', value: visibilityLabel(selected.visibilityScore), sub: 'Estimert' },
                  { label: 'Tidevann', value: tideLabel(new Date().getHours()), sub: `Score: ${scoreTide(new Date().getHours())}` },
                  { label: 'Soloppgang', value: selected.sunrise ? formatSunTime(selected.sunrise) : '—', sub: '' },
                  { label: 'Solnedgang', value: selected.sunset ? formatSunTime(selected.sunset) : '—', sub: '' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</p>
                    {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Skjellvarsel */}
              {shellfish && (
                <div className={`rounded-xl p-3 border ${isShellSeason() ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-xs font-medium text-gray-600 mb-1">Skjellvarsel</p>
                  <p className="text-xs text-gray-500">
                    Nærmeste målested: <span className="font-medium">{shellfish.station.name}</span> (~{shellfish.distKm} km)
                  </p>
                  {isShellSeason() ? (
                    <p className="text-xs text-amber-700 mt-1">Sjekk alltid Mattilsynet før du plukker skjell i sesongen (mars–oktober)</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Utenfor sesong. Varselet er aktivt mars–oktober.</p>
                  )}
                  
                    href={`https://www.mattilsynet.no/mat-og-drikke/forbrukere/blaskjellvarsel`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-blue-600 underline"
                  >
                    Se blåskjellvarsel på Mattilsynet.no &#8594;
                  </a>
                </div>
              )}

              {/* Advarsler */}
              {selected.waveHeight !== null && selected.waveHeight > 1.5 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs text-red-600 font-medium">Bølgehøyde over 1.5m — vurder om det er trygt å dra ut</p>
                </div>
              )}

              {/* Åpne i hovedapp */}
              <button
                onClick={() => {
                  router.push(`/?lat=${selected.lat}&lon=${selected.lon}&name=${encodeURIComponent(selected.name)}`)
                }}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
              >
                Åpne fullt dashboard for dette stedet
              </button>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
