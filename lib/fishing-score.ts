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

export function simulateTide(h: number): number {
  return 50 + 50 * Math.sin((h - 3) * Math.PI / 6)
}

export function scoreTide(hour: number): number {
  const current = simulateTide(hour)
  const prev = simulateTide(hour - 0.5)
  const rising = current > prev
  if (rising && current > 70) return 100
  if (rising && current > 40) return 85
  if (!rising && current > 70) return 70
  if (current > 80) return 65
  if (!rising && current < 30) return 25
  if (!rising) return 45
  return 60
}

export function tideLabel(hour: number): string {
  const current = simulateTide(hour)
  const prev = simulateTide(hour - 0.5)
  const rising = current > prev
  if (current > 80) return 'Høyvann'
  if (current < 20) return 'Lavvann'
  return rising ? 'Stigende' : 'Fallende'
}

export function scoreWave(waveHeight: number | null): number {
  if (waveHeight === null) return 70
  if (waveHeight < 0.3) return 100
  if (waveHeight <= 0.8) return 90
  if (waveHeight <= 1.5) return 65
  if (waveHeight <= 2.5) return 30
  return 10
}

export function windDirectionLabel(degrees: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(degrees / 45) % 8]
}

export function formatSunTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

export function calcScore(
  wind: number,
  cloud: number,
  temp: number,
  hour: number,
  tideWeight: number = 0.20,
  waveHeight: number | null = null
): number {
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
