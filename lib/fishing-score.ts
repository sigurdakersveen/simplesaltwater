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
  const morning = Math.exp(-0.5 * Math.pow((h - 6) / 1.5, 2))
  const evening = Math.exp(-0.5 * Math.pow((h - 19) / 1.5, 2))
  return 25 + Math.round(Math.max(morning, evening) * 75)
}

export function simulateTide(h: number): number {
  return 50 + 50 * Math.sin((h - 3) * Math.PI / 6)
}

export function scoreTide(hour: number): number {
  const current = simulateTide(hour)
  const prev = simulateTide(hour - 0.5)
  const next = simulateTide(hour + 0.5)
  const rising = current > prev
  const speed = Math.abs(current - prev) * 2 // endringshastighet

  // Beste: raskt stigende tidevann mot høyvann
  // Verste: rundt lavvann
  if (rising && current > 60) return Math.round(75 + speed * 5)
  if (rising && current > 30) return Math.round(65 + speed * 4)
  if (!rising && current > 75) return 65   // rett etter høyvann
  if (!rising && current > 50) return 50
  if (current < 20) return 20              // lavvann
  if (!rising && current < 35) return 30
  return 45
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
  if (trend !== null && trend < -2) return 95
  if (trend !== null && trend < -0.5) return 85
  if (trend !== null && trend > 2) return 30
  if (hPa > 1020) return 45
  if (hPa >= 1005) return 75
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

// Strøm: moderat strøm er bra for fiske, for sterk er dårlig
export function scoreCurrent(speed: number | null): number {
  if (speed === null) return 70
  if (speed < 0.1) return 55   // stille — lite næring i bevegelse
  if (speed <= 0.5) return 100 // moderat — ideelt
  if (speed <= 1.0) return 80  // litt sterk men OK
  if (speed <= 1.5) return 50  // sterk
  return 20                    // veldig sterk — vanskelig å fiske
}

export function currentLabel(speed: number | null): string {
  if (speed === null) return 'Ukjent'
  if (speed < 0.1) return 'Stille'
  if (speed <= 0.5) return 'Moderat'
  if (speed <= 1.0) return 'Sterk'
  if (speed <= 1.5) return 'Svært sterk'
  return 'Ekstrem'
}

// Sikt: estimert fra nedbør, bølgehøyde og årstid
export function estimateVisibility(
  precipitation: number | null,
  waveHeight: number | null,
  month: number
): number {
  let score = 100

  // Nedbør reduserer sikt
  if (precipitation !== null) {
    if (precipitation > 10) score -= 40
    else if (precipitation > 3) score -= 25
    else if (precipitation > 0) score -= 10
  }

  // Høye bølger virvler opp partikler
  if (waveHeight !== null) {
    if (waveHeight > 2) score -= 30
    else if (waveHeight > 1) score -= 15
    else if (waveHeight > 0.5) score -= 5
  }

  // Algesesong (sommer = dårligere sikt i norske farvann)
  if (month >= 5 && month <= 8) score -= 10

  return Math.max(0, Math.min(100, score))
}

export function visibilityLabel(score: number): string {
  if (score >= 85) return 'Utmerket'
  if (score >= 65) return 'God'
  if (score >= 45) return 'Moderat'
  if (score >= 25) return 'Dårlig'
  return 'Svært dårlig'
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
  tideWeight: number = 0.15,
  waveHeight: number | null = null,
  pressure: number | null = null,
  pressureTrend: number | null = null,
  seaTemp: number | null = null,
  precipitation: number | null = null,
  moonScore: number = 70,
  currentSpeed: number | null = null,
  visibilityScore: number = 80
): number {
  // Tidspunkt: myk gaussisk kurve — topper ved 06 og 19
  const morning = Math.exp(-0.5 * Math.pow((hour - 6) / 1.5, 2))
  const evening = Math.exp(-0.5 * Math.pow((hour - 19) / 1.5, 2))
  const timeScore = 25 + Math.round(Math.max(morning, evening) * 75)

  // Tidevann: gradert etter hastighet og fase
  const tCurr = simulateTide(hour)
  const tPrev = simulateTide(hour - 0.5)
  const rising = tCurr > tPrev
  const speed = Math.abs(tCurr - tPrev) * 2
  let tideScore: number
  if (rising && tCurr > 60) tideScore = Math.min(100, Math.round(70 + speed * 6))
  else if (rising && tCurr > 30) tideScore = Math.round(55 + speed * 5)
  else if (!rising && tCurr > 75) tideScore = 55
  else if (!rising && tCurr > 50) tideScore = 42
  else if (tCurr < 20) tideScore = 15
  else tideScore = 28

  // Basis additivt snitt av alle faktorer
  const remaining = 1 - tideWeight
  const base =
    scoreWind(wind)                         * remaining * 0.22 +
    timeScore                               * remaining * 0.22 +
    scoreCloud(cloud)                       * remaining * 0.10 +
    scoreTemp(temp)                         * remaining * 0.08 +
    scorePressure(pressure, pressureTrend)  * remaining * 0.12 +
    moonScore                               * remaining * 0.06 +
    scoreSeaTemp(seaTemp)                   * remaining * 0.08 +
    scorePrecipitation(precipitation)       * remaining * 0.06 +
    scoreWave(waveHeight)                   * remaining * 0.04 +
    scoreCurrent(currentSpeed)              * remaining * 0.06 +
    visibilityScore                         * remaining * 0.06 +
    tideScore                               * tideWeight

  // MULTIPLIKATIVE STRAFFAKTORER — disse trekker ned drastisk
  // Sterk vind er dealbreaker
  const windPenalty = wind > 35 ? 0.45 : wind > 25 ? 0.72 : 1.0
  // Kraftig nedbør er dealbreaker
  const rainPenalty = (precipitation ?? 0) > 10 ? 0.50 : (precipitation ?? 0) > 4 ? 0.78 : 1.0
  // Farlige bølger er dealbreaker
  const wavePenalty = (waveHeight ?? 0) > 2.5 ? 0.40 : (waveHeight ?? 0) > 1.5 ? 0.70 : 1.0
  // Midt på natten
  const nightPenalty = (hour >= 23 || hour <= 3) ? 0.65 : 1.0

  const final = base * windPenalty * rainPenalty * wavePenalty * nightPenalty

  return Math.round(Math.min(99, Math.max(5, final)))
}

export function getStatus(score: number) {
  if (score >= 75) return { label: 'Gode forhold', color: 'text-green-600' }
  if (score >= 55) return { label: 'OK forhold', color: 'text-blue-600' }
  if (score >= 35) return { label: 'Middels', color: 'text-amber-600' }
  return { label: 'Dårlige forhold', color: 'text-red-600' }
}
