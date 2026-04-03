'use client'
import { useState, useRef, useEffect } from 'react'

type Result = { lat: string; lon: string; display_name: string }
type Location = { lat: number; lon: number; name: string }

export default function LocationSearch({ onSelect }: {
  onSelect: (loc: Location) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'nb' } }
        )
        const data = await r.json()
        setResults(data)
        setOpen(true)
      } catch { /* ignore */ }
    }, 300)
  }, [query])

  function pick(r: Result) {
    const name = r.display_name.split(',').slice(0, 2).join(', ')
    setQuery(name)
    setOpen(false)
    onSelect({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), name })
  }

  async function useMyLocation() {
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'nb' } }
          )
          const d = await r.json()
          const name = d.address?.city || d.address?.town || d.address?.village || 'Min posisjon'
          setQuery(name)
          onSelect({ lat, lon, name })
        } catch {
          onSelect({ lat, lon, name: `${lat.toFixed(2)}°N` })
        }
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    )
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Søk etter sted (f.eks. Ålesund, Bodø)..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500 bg-white"
          />
          {open && results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg z-10 overflow-hidden shadow-sm">
              {results.map((r, i) => (
                <button
                  key={i}
                  onMouseDown={() => pick(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 border-b border-gray-100 last:border-0"
                >
                  {r.display_name.split(',').slice(0, 3).join(', ')}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={useMyLocation}
          disabled={geoLoading}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white whitespace-nowrap disabled:opacity-50"
        >
          {geoLoading ? '...' : '📍 Min posisjon'}
        </button>
      </div>
    </div>
  )
}
