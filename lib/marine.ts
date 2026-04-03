const OFFSETS = [
  [0, 0],
  [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
]

export type MarineResult = {
  waveHeight: number | null
  seaTemp: number | null
  usedLat: number
  usedLon: number
}

export async function fetchMarineData(lat: number, lon: number): Promise<MarineResult> {
  for (const [dLat, dLon] of OFFSETS) {
    const tryLat = lat + dLat
    const tryLon = lon + dLon
    try {
      const r = await fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${tryLat}&longitude=${tryLon}&current=wave_height,sea_surface_temperature&timezone=auto`
      )
      const d = await r.json()
      const waveHeight = d.current?.wave_height ?? null
      const seaTemp = d.current?.sea_surface_temperature ?? null
      if (waveHeight !== null || seaTemp !== null) {
        return { waveHeight, seaTemp, usedLat: tryLat, usedLon: tryLon }
      }
    } catch { }
  }
  return { waveHeight: null, seaTemp: null, usedLat: lat, usedLon: lon }
}
