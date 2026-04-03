/**
 * Vannkvalitet for SimpleSaltwater
 *
 * Tilnærming: Dokumenterte soner + sesong + værpåvirkning.
 * Vi estimerer IKKE kjemi vi ikke kan måle. Vi viser kjent tilstand
 * fra offentlige norske kilder, og justerer for årstid og nedbør.
 *
 * Kilder:
 * - Miljødirektoratet: Helhetlig tiltaksplan for Oslofjorden (2021, 2025)
 * - NIVA: Kystovervåkningsprogram, Oslofjord-tilstandsrapporter
 * - Havforskningsinstituttet: Kystovervåking, NorKyst800
 * - Regjeringen.no: Oslofjorden tilstandsvurdering 2025
 */

export type WaterQualityZone = {
  name: string
  baseScore: number       // 0–100, dokumentert grunnivå
  description: string     // Kort faktabasert beskrivelse
  source: string          // Kilde
  issues: string[]        // Kjente problemer
}

export type WaterQuality = {
  zone: WaterQualityZone
  score: number           // Justert for sesong/vær
  label: string
  color: string
  factors: { icon: string; text: string; good: boolean }[]
  isEstimated: boolean    // Om vi bruker sone eller generell estimat
}

/**
 * Kjente problemsoner langs norskekysten med dokumentert tilstand.
 * Grenser er bounding boxes (minLat, maxLat, minLon, maxLon).
 */
const KNOWN_ZONES: Array<WaterQualityZone & {
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
}> = [
  {
    name: 'Indre Oslofjord',
    bounds: { minLat: 59.7, maxLat: 59.95, minLon: 10.4, maxLon: 10.8 },
    baseScore: 28,
    description: 'Svært alvorlig miljøtilstand. Dårlig kjemisk tilstand, oksygensvikt i dypvannet, kollaps av torskebestand og tilbakegang av tareskog og ålegrasenger.',
    source: 'Miljødirektoratet / Regjeringen 2025, NIVA',
    issues: ['Oksygensvikt i bunnvann', 'Overgjødsling fra avløp og landbruk', 'Historisk lavt torskenivå', 'Høyt mikroplastnivå'],
  },
  {
    name: 'Ytre Oslofjord / Drøbak-Færder',
    bounds: { minLat: 59.3, maxLat: 59.7, minLon: 10.3, maxLon: 10.7 },
    baseScore: 48,
    description: 'Moderat økologisk tilstand. Bedre enn indre fjord, men fortsatt påvirket av næringssalter fra landbruk og avløp. Ytre deler mot Færder er best.',
    source: 'SALT kunnskapsstatus Oslofjorden 2019, Miljødirektoratet',
    issues: ['Næringssalttilførsel', 'Redusert bunnfauna i Bunnefjorden', 'Negative trender for dyreplankton'],
  },
  {
    name: 'Skagerrakkysten (Vestfold–Telemark)',
    bounds: { minLat: 59.0, maxLat: 59.3, minLon: 9.8, maxLon: 10.5 },
    baseScore: 60,
    description: 'Moderat til god tilstand langs ytre kyst. Påvirket av tilførsler fra Oslofjorden og lokalt landbruk. Generelt bedre enn selve Oslofjorden.',
    source: 'NIVA kystovervåkningsprogram',
    issues: ['Periodevis algeoppblomstring', 'Tilrenning fra Oslofjorden'],
  },
  {
    name: 'Hvaler / Ytre Hvaler',
    bounds: { minLat: 59.0, maxLat: 59.2, minLon: 10.7, maxLon: 11.1 },
    baseScore: 62,
    description: 'Ytre Hvaler nasjonalpark. Relativt god tilstand i ytre deler. Nasjonalparkstatus gir noe vern, men fortsatt under press fra Glomma-avrenning.',
    source: 'Miljødirektoratet, SALT Oslofjord-rapport 2019',
    issues: ['Glomma-avrenning', 'Partikkelbelasting ved flom'],
  },
  {
    name: 'Grenlandsfjordene',
    bounds: { minLat: 58.9, maxLat: 59.2, minLon: 9.4, maxLon: 9.9 },
    baseScore: 45,
    description: 'Historisk forurenset fra industri (Herøya). Bedret tilstand etter industriopprydding, men bunnsdiment inneholder fortsatt miljøgifter.',
    source: 'Miljødirektoratet, NIVA',
    issues: ['Historisk industriforurensning', 'Miljøgifter i sediment'],
  },
]

function findZone(lat: number, lon: number): WaterQualityZone | null {
  for (const zone of KNOWN_ZONES) {
    const b = zone.bounds
    if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon) {
      return zone
    }
  }
  return null
}

/**
 * Sesong- og værmessige justeringer — gjelder overalt
 */
function getSeasonalAdjustment(month: number, precipMm: number | null, wind: number): number {
  let adj = 0

  // Våroppblomstring langs norskekysten: april–juni
  // Kraftig algeoppblomstring kan redusere oksygen og sikt
  if (month >= 4 && month <= 6) adj -= 5

  // Sommer: høy temperatur = lavere oksygenmetning, mer algevekst
  if (month >= 6 && month <= 8) adj -= 8

  // Høst: bedre omrøring, lavere temp = bedre oksygen
  if (month >= 9 && month <= 11) adj += 5

  // Vinter: god oksygenmetning, lite alger
  if (month <= 3 || month === 12) adj += 8

  // Kraftig nedbør = avrenning og turbiditet
  if ((precipMm ?? 0) > 5) adj -= 10
  else if ((precipMm ?? 0) > 2) adj -= 4

  // Sterk vind = omrøring (positivt for oksygen)
  if (wind > 15 && wind <= 30) adj += 3

  return adj
}

export function calcWaterQuality(
  lat: number,
  lon: number,
  seaTemp: number | null,
  precipMm: number | null,
  wind: number
): WaterQuality {
  const month = new Date().getMonth() + 1
  const zone = findZone(lat, lon)
  const seasonAdj = getSeasonalAdjustment(month, precipMm, wind)

  if (zone) {
    const score = Math.min(100, Math.max(5, zone.baseScore + seasonAdj))
    const factors: { icon: string; text: string; good: boolean }[] = []

    // Known issues
    zone.issues.forEach(issue => {
      factors.push({ icon: '⚠️', text: issue, good: false })
    })

    // Seasonal
    if (month >= 4 && month <= 6) factors.push({ icon: '🌿', text: 'Våroppblomstring kan gi algevekst og redusert oksygen', good: false })
    if (month >= 9 && month <= 11) factors.push({ icon: '💧', text: 'Høst: god omrøring og oksygenmetning', good: true })
    if (month <= 3 || month === 12) factors.push({ icon: '❄️', text: 'Vinter: høy oksygenmetning, lite algevekst', good: true })

    // Rain
    if ((precipMm ?? 0) > 5) factors.push({ icon: '🌧️', text: 'Kraftig nedbør øker avrenning og turbiditet', good: false })

    let label = ''
    let color = ''
    if (score >= 75) { label = 'God vannkvalitet'; color = 'text-green-600' }
    else if (score >= 55) { label = 'Moderat vannkvalitet'; color = 'text-blue-600' }
    else if (score >= 35) { label = 'Dårlig vannkvalitet'; color = 'text-amber-600' }
    else { label = 'Svært dårlig vannkvalitet'; color = 'text-red-600' }

    return { zone, score, label, color, factors, isEstimated: false }

  } else {
    // Utenfor kjente soner — generell norsk ytre kyst
    // Generelt god tilstand, men lite detaljkunnskap
    const baseScore = 72
    const score = Math.min(100, Math.max(20, baseScore + seasonAdj))
    const factors: { icon: string; text: string; good: boolean }[] = []

    if (month >= 4 && month <= 6) factors.push({ icon: '🌿', text: 'Våroppblomstring langs kysten — økt algeaktivitet', good: false })
    if (month >= 9 && month <= 11) factors.push({ icon: '💧', text: 'Høst: god oksygenmetning i norsk kystvann', good: true })
    if ((precipMm ?? 0) > 5) factors.push({ icon: '🌧️', text: 'Nedbør og avrenning reduserer siktdyp', good: false })
    if ((precipMm ?? 0) <= 1) factors.push({ icon: '💧', text: 'Lite nedbør — klart vann', good: true })

    const generalZone: WaterQualityZone = {
      name: 'Norsk ytre kyst',
      baseScore,
      description: 'Ingen spesifikk tilstandsdata for dette området. Norsk ytre kyst er generelt i god stand, men kan variere lokalt. Sjekk Miljødirektoratets Vann-Nett for lokale data.',
      source: 'Generell vurdering — ikke stedsspesifikk',
      issues: [],
    }

    let label = ''
    let color = ''
    if (score >= 75) { label = 'God vannkvalitet (estimert)'; color = 'text-green-600' }
    else if (score >= 55) { label = 'Moderat vannkvalitet (estimert)'; color = 'text-blue-600' }
    else { label = 'Usikker vannkvalitet'; color = 'text-amber-600' }

    return { zone: generalZone, score, label, color, factors, isEstimated: true }
  }
}
