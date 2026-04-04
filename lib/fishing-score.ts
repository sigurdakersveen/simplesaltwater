// ─── Grunnleggende scorefunksjoner ───────────────────────────────────────────

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

export function scoreCurrent(speed: number | null): number {
  if (speed == null) return 65
  if (speed < 0.1) return 45
  if (speed <= 0.4) return 100
  if (speed <= 0.8) return 75
  if (speed <= 1.2) return 45
  return 20
}

export function scoreWave(height: number | null): number {
  if (height == null) return 70
  if (height < 0.3) return 100
  if (height <= 0.8) return 90
  if (height <= 1.5) return 65
  if (height <= 2.5) return 30
  return 10
}

export function scoreSeaTemp(temp: number | null): number {
  if (temp == null) return 65
  if (temp < 2) return 25
  if (temp < 6) return 55
  if (temp <= 14) return 100
  if (temp <= 18) return 85
  if (temp <= 22) return 70
  return 50
}

export function scorePressure(pressureOrTrend: number | null, trend?: number | null): number {
  // Supports both scorePressure(trend) and scorePressure(pressure, trend)
  const t = trend !== undefined ? trend : pressureOrTrend
  if (t == null) return 60
  if (t < -3) return 90
  if (t < -1) return 80
  if (t >= -1 && t <= 1) return 65
  if (t < 3) return 50
  return 35
}

// ─── Utvidet calcScore med marine data ───────────────────────────────────────

export function calcScore(
  wind: number,
  cloud: number,
  temp: number,
  hour: number,
  tideScore?: number,
  waveHeight?: number | null,
  pressure?: number | null,
  pressureTrend?: number | null,
  seaTemp?: number | null,
  precipitation?: number | null,
  moonScore?: number,
  currentSpeed?: number | null,
  visibilityScore?: number
): number {
  let score = Math.round(
    scoreWind(wind) * 0.25 +
    scoreHour(hour) * 0.25 +
    scoreCloud(cloud) * 0.15 +
    scoreTemp(temp) * 0.15
  )

  if (waveHeight != null) {
    if (waveHeight < 0.3) score = Math.round(score * 1.05)
    else if (waveHeight > 1.5) score = Math.round(score * Math.max(0.40, 1 - (waveHeight - 1.5) * 0.2))
    else if (waveHeight > 0.8) score = Math.round(score * 0.85)
  }

  if (pressureTrend != null) {
    if (pressureTrend < -2) score = Math.round(score * 1.08)
    else if (pressureTrend > 3) score = Math.round(score * 0.90)
  }

  if (precipitation != null) {
    if (precipitation > 5) score = Math.round(score * 0.65)
    else if (precipitation > 2) score = Math.round(score * 0.82)
  }

  if (wind > 30) score = Math.round(score * 0.55)
  else if (wind > 20) score = Math.round(score * 0.80)

  if (hour >= 23 || hour <= 3) score = Math.round(score * 0.70)

  return Math.min(99, Math.max(5, score))
}

export function getStatus(score: number) {
  if (score >= 75) return { label: 'Gode forhold', color: 'text-green-600' }
  if (score >= 55) return { label: 'OK forhold', color: 'text-blue-600' }
  if (score >= 35) return { label: 'Middels', color: 'text-amber-600' }
  return { label: 'Dårlige forhold', color: 'text-red-600' }
}

// ─── Tidevann ─────────────────────────────────────────────────────────────────

export function simulateTide(h: number) {
  return 50 + 50 * Math.sin((h - 3) * Math.PI / 6)
}

export function scoreTide(h: number) {
  const val = simulateTide(h)
  const prev = simulateTide(h - 0.5)
  const rising = val > prev
  if (rising && val > 80) return 95
  if (rising && val > 50) return 80
  if (!rising && val > 80) return 65
  if (!rising && val < 20) return 30
  return 50
}

export function tideLabel(h: number) {
  const val = simulateTide(h)
  const prev = simulateTide(h - 0.5)
  const rising = val > prev
  if (val > 85) return 'Høyvann'
  if (val < 15) return 'Lavvann'
  return rising ? 'Stigende' : 'Fallende'
}

// ─── Månefase ─────────────────────────────────────────────────────────────────

export function moonPhase(date: Date): { name: string; emoji: string; score: number } {
  const known = new Date('2000-01-06T18:14:00Z')
  const cycleMs = 29.53058867 * 24 * 3600 * 1000
  const phase = ((date.getTime() - known.getTime()) % cycleMs + cycleMs) % cycleMs / cycleMs

  if (phase < 0.03 || phase > 0.97) return { name: 'Nymåne', emoji: '🌑', score: 90 }
  if (phase < 0.22) return { name: 'Voksende måne', emoji: '🌒', score: 75 }
  if (phase < 0.28) return { name: 'Halvmåne', emoji: '🌓', score: 65 }
  if (phase < 0.47) return { name: 'Voksende gibbous', emoji: '🌔', score: 70 }
  if (phase < 0.53) return { name: 'Fullmåne', emoji: '🌕', score: 85 }
  if (phase < 0.72) return { name: 'Minkende gibbous', emoji: '🌖', score: 70 }
  if (phase < 0.78) return { name: 'Halvmåne', emoji: '🌗', score: 65 }
  return { name: 'Minkende måne', emoji: '🌘', score: 75 }
}

// ─── Hjelpe-funksjoner ────────────────────────────────────────────────────────

export function estimateVisibility(
  precipitation: number | null,
  waveHeight: number | null,
  month: number
): number {
  let score = 85
  if ((precipitation ?? 0) > 5) score -= 30
  else if ((precipitation ?? 0) > 2) score -= 15
  if ((waveHeight ?? 0) > 2) score -= 20
  else if ((waveHeight ?? 0) > 1) score -= 10
  if (month >= 4 && month <= 6) score -= 5
  return Math.min(100, Math.max(10, score))
}

export function currentLabel(speed: number | null): string {
  if (speed == null) return ''
  if (speed < 0.1) return 'Stille'
  if (speed < 0.3) return 'Svak strøm'
  if (speed < 0.6) return 'Moderat strøm'
  if (speed < 1.0) return 'Sterk strøm'
  return 'Meget sterk strøm'
}

export function pressureLabel(trend: number | null): string {
  if (trend == null) return ''
  if (trend < -2) return 'Fallende ↓'
  if (trend > 2) return 'Stigende ↑'
  return 'Stabilt'
}

export function windDirectionLabel(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

export function formatSunTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export function visibilityLabel(score: number): string {
  if (score >= 80) return 'God'
  if (score >= 60) return 'Moderat'
  if (score >= 40) return 'Dårlig'
  return 'Meget dårlig'
}

export function scorePrecipitation(mm: number | null): number {
  if (mm == null) return 80
  if (mm === 0) return 100
  if (mm < 1) return 90
  if (mm < 3) return 70
  if (mm < 6) return 45
  return 20
}
