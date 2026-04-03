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

export function scoreSeaTemp(t: number | null): number {
  if (t === null) return 70
  if (t < 4) return 20
  if (t < 8) return 50
  if (t <= 16) return 100
  if (t <= 20) return 85
  if (t <= 24) return 65
  return 40
}

export function scorePressure(hPa: number | null, trend: number | null): number {
  if (hPa === null) return 70
  if (trend !== null && trend < -2) return 95  // fallende raskt — fisken biter
  if (trend !== null && trend < -0.5) return 85 // fallende sakte
  if (trend !== null && trend > 2) return 30    // stigende raskt — fisken trekker seg
  if (hPa > 1020) return 45                     // høyt stabilt
  if (hPa >= 1005) return 75                    // normalt
  return 60
}

export function scorePrecipitation(mm: number | null): number {
  if (mm === null) return 80
  if (mm === 0) return 90
  if (mm < 1) return 80
  if (mm < 5) return 60
  if (mm < 15) return 35
  return 15
}

export function pressureLabel(trend: number | null): string {
  if (trend === null) return 'Ukjent'
  if (trend < -2) return 'Faller raskt'
  if (trend < -0.5) return 'Faller'
  if (trend > 2) return 'Stiger raskt'
  if (trend > 0.5) return 'Stiger'
  return 'Stabilt'
}

export function moonPhase(date: Date): { name: string; score: number; emoji: string } {
  const known = new Date('2000-01-06')
  const diff = (date.getTime() - known.getTime()) / (1000 * 60 * 60 * 24)
  const cycle = 29.53058867
  const phase = ((diff % cycle) + cycle) % cycle
  if (phase < 1.85 || phase >= 27.68) return { name: 'Nymåne', score: 100, emoji: '🌑' }
  if (phase < 7.38) return { name: 'Voksende halvmåne', score: 75, emoji: '🌒' }
  if (phase < 9.22) return { name: 'Første kvartal', score: 85, emoji: '🌓' }
  if (phase < 14.77) return { name: 'Voksende måne', score: 70, emoji: '🌔' }
  if (phase < 16.61) return { name: 'Fullmåne', score: 100, emoji: '🌕' }
  if (phase < 22.15) return { name: 'Minkende måne', score: 70, emoji: '🌖' }
  if (phase < 23.99) return { name: 'Siste kvartal', score: 80, emoji: '🌗' }
  return { name: 'Minkende halvmåne', score: 65, emoji: '🌘' }
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
  waveHeight: number | null = null,
  pressure: number | null = null,
  pressureTrend: number | null = null,
  seaTemp: number | null = null,
  precipitation: number | null = null,
  moonScore: number = 70
): number {
  const base =
    scoreWind(wind) * 0.20 +
    scoreHour(hour) * 0.20 +
    scoreCloud(cloud) * 0.10 +
    scoreTemp(temp) * 0.10 +
    scoreTide(hour) * tideWeight +
    scorePressure(pressure, pressureTrend) * 0.10 +
    moonScore * 0.05 +
    scoreSeaTemp(seaTemp) * 0.10 +
    scorePrecipitation(precipitation) * 0.10 +
    scoreWave(waveHeight) * 0.05

  return Math.round(Math.min(100, Math.max(0, base)))
}

export function getStatus(score: number) {
  if (score >= 75) return { label: 'Gode forhold', color: 'text-green-600' }
  if (score >= 55) return { label: 'OK forhold', color: 'text-blue-600' }
  if (score >= 35) return { label: 'Middels', color: 'text-amber-600' }
  return { label: 'Dårlige forhold', color: 'text-red-600' }
}
