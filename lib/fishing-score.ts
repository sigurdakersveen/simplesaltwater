export const DEFAULT_WEIGHTS = {
  wind: 0.25,
  time: 0.25,
  cloud: 0.15,
  temp: 0.15,
  tide: 0.20,
}

export function scoreWind(v: number) {
  if (v < 3) return 60
  if (v <= 15) return 100
  if (v <= 25) return 70
  if (v <= 35) return 35
  return 10
}

export function scoreCloud(v: number) {
  if (v < 10) return 60
  if (v <= 40) return 100
  if (v <= 70) return 80
  return 50
}

export function scoreTemp(v: number) {
  if (v < 4) return 30
  if (v < 10) return 60
  if (v <= 24) return 100
  if (v <= 30) return 80
  return 50
}

export function scoreHour(h: number) {
  if (h >= 5 && h <= 8) return 100
  if (h >= 17 && h <= 20) return 95
  if (h >= 9 && h <= 11) return 75
  if (h >= 21 || h <= 4) return 40
  return 55
}

// Simulert tidevann — returnerer høyde 0-100
export function simulateTide(h: number): number {
  return 50 + 50 * Math.sin((h - 3) * Math.PI / 6)
}

// Tidevannsscore for fiske:
// Stigende = best, høyvann = bra, fallende = middels, lavvann = dårlig
export function scoreTide(hour: number): number {
  const current = simulateTide(hour)
  const prev = simulateTide(hour - 0.5)
  const rising = current > prev

  if (rising && current > 70) return 100  // stigende mot høyvann
  if (rising && current > 40) return 85   // stigende fra lavvann
  if (!rising && current > 70) return 70  // rundt høyvann, fallende
  if (current > 80) return 65             // høyvann
  if (!rising && current < 30) return 25  // lavvann
  if (!rising) return 45                  // fallende
  return 60
}

export function calcScore(
  wind: number,
  cloud: number,
  temp: number,
  hour: number,
  tideWeight: number = 0.20
): number {
  // Fordel resterende vekt likt på de andre 4
  const remaining = 1 - tideWeight
  const w = {
    wind: remaining * 0.33,
    time: remaining * 0.33,
    cloud: remaining * 0.20,
    temp: remaining * 0.14,
  }

  return Math.round(
    scoreWind(wind) * w.wind +
    scoreHour(hour) * w.time +
    scoreCloud(cloud) * w.cloud +
    scoreTemp(temp) * w.temp +
    scoreTide(hour) * tideWeight
  )
}

export function getStatus(score: number) {
  if (score >= 75) return { label: 'Gode forhold', color: 'text-green-600' }
  if (score >= 55) return { label: 'OK forhold', color: 'text-blue-600' }
  if (score >= 35) return { label: 'Middels', color: 'text-amber-600' }
  return { label: 'Dårlige forhold', color: 'text-red-600' }
}

export function tideLabel(hour: number): string {
  const current = simulateTide(hour)
  const prev = simulateTide(hour - 0.5)
  const rising = current > prev
  if (current > 80) return 'Høyvann'
  if (current < 20) return 'Lavvann'
  return rising ? 'Stigende' : 'Fallende'
}