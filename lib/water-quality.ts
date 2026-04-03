/**
 * Vannkvalitetsestimering for SimpleSaltwater
 *
 * Kilder og vitenskapelig grunnlag:
 * - Løst oksygen (DO): Beregnet fra havtemperatur og saltholdighet via Garcia & Gordon (1992)
 *   forenklet modell. Norsk kystvann: optimal DO for marin fisk er 7–10 mg/L.
 *   Kilde: Havforskningsinstituttet, NorESM-modellen, EPA DO factsheet
 * - Klorofyll-a estimat: Basert på sesong og temperatur. Norsk kyst har
 *   våroppblomstring april–juni og høstoppblomstring august–september.
 *   Kilde: Havforskningsinstituttet kystovervåking, NIVA kystovervåkningsprogram
 * - Saltholdighet: Norsk ytre kyst ~32–35 ppt, fjorder ~25–32 ppt.
 *   Høy nedbør og elveavrenning reduserer saltholdighet.
 *   Kilde: NorKyst800 modell (HI/ROMS), Albretsen et al. 2011
 * - Turbiditet: Estimert fra nedbør, vind og bølger.
 *   Kilde: NIVA kystovervåkningsprogram
 * - pH: Norsk åpent hav ~8.1–8.2, synker noe kyst/fjord.
 *   Kilde: Havforskningsinstituttet forsuringsovervåking
 */

export type WaterQuality = {
  dissolvedOxygen: number        // mg/L estimert
  oxygenSaturation: number       // % metning
  chlorophyll: 'lav' | 'moderat' | 'hoy' | 'oppblomstring'
  salinity: number               // ppt estimert
  turbidity: 'klar' | 'moderat' | 'uklar'
  pH: number                     // estimert
  score: number                  // 0–100 for fiske
  label: string
  color: string
  factors: { icon: string; text: string; good: boolean }[]
  sources: string[]
}

/**
 * Beregn estimert løst oksygen (mg/L) fra temperatur og saltholdighet
 * Forenklet versjon av Garcia & Gordon (1992) Benson-Krause tabell
 */
function estimateDO(tempC: number, salinityPpt: number): number {
  // Oksygenmetning i ferskvann ved gitt temperatur (mg/L ved 100% metning)
  const doFresh =
    14.62 - 0.3898 * tempC + 0.006969 * tempC * tempC - 0.00005596 * tempC * tempC * tempC

  // Saltholdighetskorrigering: ~2% reduksjon per 5 ppt saltholdighet
  const salinityFactor = 1 - (salinityPpt / 1000) * 0.9
  return Math.round((doFresh * salinityFactor) * 10) / 10
}

/**
 * Estimer saltholdighet basert på posisjon og nedbør
 * Norsk ytre kyst: 32–35 ppt
 * Nedbør og elveavrenning trekker ned
 */
function estimateSalinity(lat: number, lon: number, precipMm: number | null): number {
  // Basesaltholdighet: ytre kyst høyere enn indre farvann
  // Grovt: jo lenger ut, jo høyere. Bruker lon som proxy for eksponerthet
  const baseSalinity = lon < 8 ? 33.5 : lon < 15 ? 33.0 : 32.5

  // Nedbørsreduksjon
  const precipEffect = precipMm ? Math.min(2.5, precipMm * 0.3) : 0

  // Sesongvariasjon: snøsmelting mars–mai trekker ned
  const month = new Date().getMonth() + 1
  const meltEffect = (month >= 3 && month <= 5) ? 0.8 : 0

  return Math.round((baseSalinity - precipEffect - meltEffect) * 10) / 10
}

/**
 * Estimer klorofyll-a nivå basert på årstid og havtemp
 * Norsk kyst våroppblomstring: april–juni
 * Høstoppblomstring: august–september
 * Kilde: HI Kystovervåkningsprogram, NIVA
 */
function estimateChlorophyll(seaTemp: number | null, month: number): WaterQuality['chlorophyll'] {
  const temp = seaTemp ?? 10

  // Våroppblomstring: april–juni, best ved 8–14°C
  if (month >= 4 && month <= 6 && temp >= 6 && temp <= 15) return 'oppblomstring'

  // Høstoppblomstring: august–september
  if (month >= 8 && month <= 9 && temp >= 10 && temp <= 18) return 'hoy'

  // Vinter/tidlig vår: lite lys, lite klorofyll
  if (month <= 3 || month === 12) return 'lav'

  // Sommer: moderat, varmt vann hemmer litt
  if (month >= 6 && month <= 8 && temp > 16) return 'moderat'

  return 'moderat'
}

/**
 * Turbiditet basert på vind, bølger og nedbør
 */
function estimateTurbidity(
  wind: number,
  waveHeight: number | null,
  precipMm: number | null
): WaterQuality['turbidity'] {
  const wave = waveHeight ?? 0
  const precip = precipMm ?? 0

  if (precip > 5 || wind > 30 || wave > 2.5) return 'uklar'
  if (precip > 2 || wind > 15 || wave > 1.2) return 'moderat'
  return 'klar'
}

/**
 * Beregn vannkvalitetsscore (0–100) for fiske
 * Basert på HI og NIVA sine normer for norsk kystvann
 */
export function calcWaterQuality(
  seaTemp: number | null,
  precipMm: number | null,
  wind: number,
  waveHeight: number | null,
  lat: number,
  lon: number
): WaterQuality {
  const month = new Date().getMonth() + 1
  const temp = seaTemp ?? 10

  const salinity = estimateSalinity(lat, lon, precipMm)
  const do_mgL = estimateDO(temp, salinity)
  const doSaturation = Math.min(120, Math.round((do_mgL / 14.62) * 100))
  const chlorophyll = estimateChlorophyll(seaTemp, month)
  const turbidity = estimateTurbidity(wind, waveHeight, precipMm)
  const pH = 8.15 - (precipMm ?? 0) * 0.01 - (salinity < 30 ? 0.05 : 0)

  const factors: { icon: string; text: string; good: boolean }[] = []

  // --- Løst oksygen ---
  // Optimal for norsk kystfisk: 7–10 mg/L (HI)
  let doScore = 100
  if (do_mgL >= 8) {
    doScore = 100
    factors.push({ icon: '🫧', text: `Oksygen: ${do_mgL} mg/L — utmerket for fisk`, good: true })
  } else if (do_mgL >= 6.5) {
    doScore = 75
    factors.push({ icon: '🫧', text: `Oksygen: ${do_mgL} mg/L — akseptabelt`, good: true })
  } else {
    doScore = 35
    factors.push({ icon: '🫧', text: `Oksygen: ${do_mgL} mg/L — lavt, fisken stresses`, good: false })
  }

  // --- Klorofyll / næring ---
  let chlScore = 70
  switch (chlorophyll) {
    case 'oppblomstring':
      chlScore = 100
      factors.push({ icon: '🌿', text: 'Våroppblomstring — mye næring, aktiv nærings-kjede', good: true })
      break
    case 'hoy':
      chlScore = 90
      factors.push({ icon: '🌿', text: 'Hoy klorofyll — god næringstilgang for fisk', good: true })
      break
    case 'moderat':
      chlScore = 70
      factors.push({ icon: '🌿', text: 'Moderat klorofyll — normalt for årstiden', good: true })
      break
    case 'lav':
      chlScore = 40
      factors.push({ icon: '🌿', text: 'Lav klorofyll — lite næring i vannet', good: false })
      break
  }

  // --- Turbiditet ---
  let turbScore = 100
  switch (turbidity) {
    case 'klar':
      turbScore = 100
      factors.push({ icon: '💧', text: 'Klart vann — bra sikt for rovfisk', good: true })
      break
    case 'moderat':
      turbScore = 70
      factors.push({ icon: '💧', text: 'Moderat uklart vann — OK for de fleste arter', good: true })
      break
    case 'uklar':
      turbScore = 35
      factors.push({ icon: '💧', text: 'Uklart vann — nedbør eller bolger rorer opp', good: false })
      break
  }

  // --- Saltholdighet ---
  let salScore = 100
  if (salinity >= 30) {
    factors.push({ icon: '🧂', text: `Saltholdighet ~${salinity} ppt — normalt norsk kystvann`, good: true })
    salScore = 100
  } else if (salinity >= 25) {
    factors.push({ icon: '🧂', text: `Saltholdighet ~${salinity} ppt — noe fortynnet`, good: true })
    salScore = 75
  } else {
    factors.push({ icon: '🧂', text: `Saltholdighet ~${salinity} ppt — lavt, kan pavirke saltvannsarter`, good: false })
    salScore = 40
  }

  // --- pH ---
  const roundedPH = Math.round(pH * 100) / 100
  if (pH >= 8.0) {
    factors.push({ icon: '⚗️', text: `pH ~${roundedPH} — normalt for norsk kystvann`, good: true })
  } else {
    factors.push({ icon: '⚗️', text: `pH ~${roundedPH} — noe sur, kan pavirke skjell`, good: false })
  }

  // Samlet score — vektet
  const score = Math.round(
    doScore * 0.35 +
    chlScore * 0.25 +
    turbScore * 0.20 +
    salScore * 0.15 +
    (pH >= 8.0 ? 100 : 60) * 0.05
  )

  let label = ''
  let color = ''
  if (score >= 80) { label = 'Svært god vannkvalitet'; color = 'text-green-600' }
  else if (score >= 65) { label = 'God vannkvalitet'; color = 'text-blue-600' }
  else if (score >= 45) { label = 'Middels vannkvalitet'; color = 'text-amber-600' }
  else { label = 'Dårlig vannkvalitet'; color = 'text-red-600' }

  return {
    dissolvedOxygen: do_mgL,
    oxygenSaturation: doSaturation,
    chlorophyll,
    salinity,
    turbidity,
    pH: roundedPH,
    score,
    label,
    color,
    factors,
    sources: [
      'Løst oksygen: Garcia & Gordon (1992), Havforskningsinstituttet',
      'Klorofyll-sesong: HI Kystovervåkningsprogram, NIVA',
      'Saltholdighet: NorKyst800 (HI/ROMS), Albretsen et al. 2011',
      'pH normer: HI forsuringsovervåking',
    ],
  }
}
