export const WEIGHTS = { wind: 0.30, time: 0.30, cloud: 0.20, temp: 0.20 }

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

export function calcScore(wind: number, cloud: number, temp: number, hour: number) {
  return Math.round(
    scoreWind(wind) * WEIGHTS.wind +
    scoreHour(hour) * WEIGHTS.time +
    scoreCloud(cloud) * WEIGHTS.cloud +
    scoreTemp(temp) * WEIGHTS.temp
  )
}

export function getStatus(score: number) {
  if (score >= 75) return { label: 'Gode forhold', color: 'text-green-600' }
  if (score >= 55) return { label: 'OK forhold', color: 'text-blue-600' }
  if (score >= 35) return { label: 'Middels', color: 'text-amber-600' }
  return { label: 'Dårlige forhold', color: 'text-red-600' }
}

export function simulateTide(h: number) {
  return 50 + 50 * Math.sin((h - 3) * Math.PI / 6)
}
