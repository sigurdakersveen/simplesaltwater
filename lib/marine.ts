const OFFSETS = [
  [0, 0],
  [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
]

export async function fetchWaveHeight(lat: number, lon: number): Promise<{ waveHeight: number | null; usedLat: number; usedLon: number }> {
  for (const [dLat, dLon] of OFFSETS) {
    const tryLat = lat + dLat
    const tryLon = lon + dLon
    try {
      const r = await fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${tryLat}&longitude=${tryLon}&current=wave_height&timezone=auto`
      )
      const d = await r.json()
      const waveHeight = d.current?.wave_height ?? null
      if (waveHeight !== null) {
        return { waveHeight, usedLat: tryLat, usedLon: tryLon }
      }
    } catch { }
  }
  return { waveHeight: null, usedLat: lat, usedLon: lon }
}
