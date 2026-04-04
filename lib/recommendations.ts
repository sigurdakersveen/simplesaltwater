import { scoreTide, tideLabel, simulateTide } from './fishing-score'

type RecommendationInput = {
  scores: number[]
  nowH: number
  wind: number
  waveHeight: number | null
  pressureTrend: number | null
  precipitation: number | null
  currentSpeed: number | null
  fishType: FishType
  mode: AppMode
}

export type FishType = 'general' | 'torsk' | 'sjooret' | 'makrell'
export type AppMode = 'fiske' | 'dykking'

export type Recommendation = {
  action: string
  reason: string
  urgency: 'now' | 'soon' | 'wait' | 'danger'
  hoursUntilBest: number | null
}

export function getRecommendation(input: RecommendationInput): Recommendation {
  const { scores, nowH, wind, waveHeight, pressureTrend, precipitation, currentSpeed, fishType, mode } = input

  const currentScore = scores[nowH] ?? 50

  // Diving mode
  if (mode === 'dykking') {
    const wave = waveHeight ?? 0
    const current = currentSpeed ?? 0
    if (wave > 2 || current > 1.2) return { action: 'Ikke dykk i dag', reason: 'For hoye bolger eller sterk strom', urgency: 'danger', hoursUntilBest: null }
    if (wave > 1 || current > 0.7) return { action: 'Moderate forhold for dykking', reason: 'Bolger og strom er akseptable men krevende', urgency: 'soon', hoursUntilBest: null }
    return { action: 'Gode dykkforhold', reason: 'Rolig hav og moderat strom', urgency: 'now', hoursUntilBest: null }
  }

  // Danger conditions
  if ((waveHeight ?? 0) > 2) return { action: 'Bli pa land i dag', reason: 'Boelgehøyde over 2m er farlig for smaabaat', urgency: 'danger', hoursUntilBest: null }
  if (wind > 35) return { action: 'Ikke dra ut', reason: 'For sterk vind — over 35 km/t', urgency: 'danger', hoursUntilBest: null }

  // Find next best window (score >= 65) in next 12 hours
  let nextBestH: number | null = null
  for (let dh = 1; dh <= 12; dh++) {
    const h = (nowH + dh) % 24
    if ((scores[h] ?? 0) >= 65) { nextBestH = h; break }
  }
  const hoursUntilBest = nextBestH !== null ? ((nextBestH - nowH + 24) % 24) : null

  // Fish-type specific overrides
  const fishReasons: Record<FishType, string> = {
    general: '',
    torsk: 'Torsk er aktiv ved stigende tidevann og kjolig vann',
    sjooret: 'Sjooret foretrekker morgen og kveld naer land',
    makrell: 'Makrell jakter naer overflaten i lyst vaer',
  }

  // Build reason from 2-3 factors
  const reasons: string[] = []
  if (pressureTrend !== null && pressureTrend < -1.5) reasons.push('fallende lufttrykk oker aktiviteten')
  if (pressureTrend !== null && pressureTrend > 2) reasons.push('stigende lufttrykk demper matingen')
  if (wind <= 15 && wind >= 3) reasons.push('gunstig vind')
  if (wind > 25) reasons.push('sterk vind reduserer sikt')
  if ((waveHeight ?? 0) < 0.5) reasons.push('rolig hav')
  if ((waveHeight ?? 0) > 1.2) reasons.push('moderate bolger')
  const tide = tideLabel(nowH)
  if (tide === 'Stigende') reasons.push('stigende tidevann')
  if (tide === 'Høyvann') reasons.push('høyvann — bra for fiske')
  if ((precipitation ?? 0) > 3) reasons.push('kraftig nedbor reduserer sikt')
  if (fishReasons[fishType]) reasons.push(fishReasons[fishType])
  const reasonText = reasons.slice(0, 3).join(', ')

  // Now — good
  if (currentScore >= 70) {
    return {
      action: 'Fisk na — gode forhold',
      reason: reasonText || 'Forholdene er gode akkurat na',
      urgency: 'now',
      hoursUntilBest: 0,
    }
  }

  // Soon — improving
  if (hoursUntilBest !== null && hoursUntilBest <= 3) {
    return {
      action: `Fisk om ${hoursUntilBest}t — forholdene forbedres`,
      reason: reasonText || 'Bedre forhold er pa vei',
      urgency: 'soon',
      hoursUntilBest,
    }
  }

  // Current is ok
  if (currentScore >= 55) {
    return {
      action: 'OK forhold — verdt et forsok',
      reason: reasonText || 'Middels gode forhold',
      urgency: 'soon',
      hoursUntilBest: 0,
    }
  }

  // Wait
  if (hoursUntilBest !== null) {
    return {
      action: `Vent ${hoursUntilBest}t — forholdene blir bedre`,
      reason: reasonText || 'Forholdene forbedres senere i dag',
      urgency: 'wait',
      hoursUntilBest,
    }
  }

  return {
    action: 'Dårlige forhold i dag',
    reason: reasonText || 'Forholdene er ikke gunstige',
    urgency: 'wait',
    hoursUntilBest: null,
  }
}

export function getTideStatus(nowH: number): { label: string; nextEvent: string; nextEventH: number; isGood: boolean } {
  const current = simulateTide(nowH)
  const prev = simulateTide(nowH - 0.5)
  const rising = current > prev

  // Find next high or low
  let nextHighH = nowH
  let nextLowH = nowH
  for (let dh = 1; dh <= 12; dh++) {
    const h = (nowH + dh) % 24
    const v = simulateTide(h)
    const vPrev = simulateTide(h - 0.5)
    if (v < vPrev && simulateTide(h + 0.5) >= v) { // local max
      if (nextHighH === nowH) nextHighH = h
    }
    if (v > vPrev && simulateTide(h + 0.5) <= v) { // local min
      if (nextLowH === nowH) nextLowH = h
    }
  }

  const hoursToHigh = ((nextHighH - nowH + 24) % 24) || 6
  const hoursToLow = ((nextLowH - nowH + 24) % 24) || 6

  if (rising) {
    return {
      label: 'Stigende tidevann',
      nextEvent: `Hoyvann om ca. ${hoursToHigh}t`,
      nextEventH: nextHighH,
      isGood: true,
    }
  } else {
    return {
      label: 'Fallende tidevann',
      nextEvent: `Lavvann om ca. ${hoursToLow}t`,
      nextEventH: nextLowH,
      isGood: false,
    }
  }
}

export function getFishTypeModifier(fishType: FishType, baseScore: number, nowH: number, seaTemp: number | null): number {
  let mod = 0
  const temp = seaTemp ?? 12
  const tide = tideLabel(nowH)
  const rising = tide === 'Stigende'

  if (fishType === 'torsk') {
    if (temp < 12) mod += 8
    if (rising) mod += 6
    if (nowH >= 5 && nowH <= 9) mod += 5
  } else if (fishType === 'sjooret') {
    if (nowH >= 4 && nowH <= 8) mod += 10
    if (nowH >= 18 && nowH <= 22) mod += 8
    if (temp >= 8 && temp <= 16) mod += 5
  } else if (fishType === 'makrell') {
    if (nowH >= 8 && nowH <= 18) mod += 8
    if (temp >= 14) mod += 6
    if (!rising) mod -= 3
  }

  return Math.min(99, Math.max(5, baseScore + mod))
}

export function getDivingScore(waveHeight: number | null, currentSpeed: number | null, visibilityScore: number): { score: number; label: string; color: string } {
  const wave = waveHeight ?? 0
  const current = currentSpeed ?? 0

  const waveScore = wave < 0.3 ? 100 : wave < 0.8 ? 85 : wave < 1.5 ? 55 : wave < 2.5 ? 25 : 5
  const currentScore = current < 0.2 ? 100 : current < 0.5 ? 80 : current < 1.0 ? 50 : current < 1.5 ? 20 : 5
  const score = Math.round(waveScore * 0.4 + currentScore * 0.35 + visibilityScore * 0.25)

  if (score >= 70) return { score, label: 'Gode dykkforhold', color: 'text-green-600' }
  if (score >= 45) return { score, label: 'Moderate dykkforhold', color: 'text-amber-600' }
  return { score, label: 'Dårlige dykkforhold', color: 'text-red-600' }
}

// Seeded pseudo-random — same lat/lon always gives same hotspots
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export type Hotspot = { lat: number; lon: number; label: string; type: string }

// Shorter offsets — stay closer to clicked point which is already in water
export function generateHotspots(lat: number, lon: number, score: number): Hotspot[] {
  const seed = Math.round(lat * 1000) * 1000 + Math.round(lon * 1000)
  const spots = [
    { dlat:  0.008, dlon: -0.012, label: 'Grunne — torsk', type: 'cod' },
    { dlat: -0.010, dlon:  0.014, label: 'Stromkant', type: 'current' },
    { dlat:  0.014, dlon:  0.006, label: 'Dyprenne', type: 'depth' },
    { dlat: -0.006, dlon: -0.016, label: 'Makrell/sjooret', type: 'shore' },
    { dlat:  0.012, dlon: -0.005, label: 'Godt fiskested', type: 'point' },
  ]
  return spots.map((s, i) => ({
    lat: lat + s.dlat + (seededRandom(seed + i * 7) - 0.5) * 0.004,
    lon: lon + s.dlon + (seededRandom(seed + i * 13) - 0.5) * 0.004,
    label: s.label,
    type: s.type,
  }))
}

// Robust sea check — uses Nominatim class/type fields
async function isAtSea(lat: number, lon: number): Promise<boolean> {
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon + '&format=json&zoom=12',
      { headers: { 'Accept-Language': 'nb' } }
    )
    const data = await res.json()

    // Nominatim returns error object when point is at sea
    if (data.error) return true

    const cls = data.class ?? ''
    const type = data.type ?? ''

    // Explicit water/sea types
    if (cls === 'natural' && (type === 'water' || type === 'sea' || type === 'bay' || type === 'strait')) return true
    if (cls === 'waterway') return true

    // Land indicators
    const addr = data.address ?? {}
    const hasLand = addr.road || addr.residential || addr.suburb ||
      addr.city || addr.town || addr.village || addr.hamlet ||
      addr.building || addr.house_number || addr.retail || addr.industrial

    if (hasLand) return false

    // No land address — likely sea
    return true
  } catch {
    return true // keep on network error
  }
}

export async function filterSeaHotspots(spots: Hotspot[]): Promise<Hotspot[]> {
  // Check in parallel with small delay to avoid rate limiting
  const results: (Hotspot | null)[] = []
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]
    if (i > 0) await new Promise(r => setTimeout(r, 120))
    const sea = await isAtSea(spot.lat, spot.lon)
    results.push(sea ? spot : null)
  }
  return results.filter((s): s is Hotspot => s !== null)
}
