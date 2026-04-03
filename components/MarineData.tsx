import {
  scoreWave, windDirectionLabel, formatSunTime, scoreSeaTemp,
  scorePressure, pressureLabel, moonPhase, scorePrecipitation,
  scoreCurrent, currentLabel, visibilityLabel
} from '@/lib/fishing-score'

type Props = {
  waveHeight: number | null
  seaTemp: number | null
  windDirection: number | null
  sunrise: string | null
  sunset: string | null
  waveNote: string | null
  pressure: number | null
  pressureTrend: number | null
  precipitation: number | null
  currentSpeed: number | null
  currentDirection: number | null
  visibilityScore: number
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export default function MarineData({
  waveHeight, seaTemp, windDirection, sunrise, sunset,
  waveNote, pressure, pressureTrend, precipitation,
  currentSpeed, currentDirection, visibilityScore
}: Props) {
  const waveScore = scoreWave(waveHeight)
  const waveLabel =
    waveHeight === null ? '—' :
    waveHeight < 0.3 ? 'Blikk stille' :
    waveHeight <= 0.8 ? 'Rolig' :
    waveHeight <= 1.5 ? 'Moderat' :
    waveHeight <= 2.5 ? 'Røff sjø' : 'Farlig høy'

  const seaTempScore = scoreSeaTemp(seaTemp)
  const seaTempLabel =
    seaTemp === null ? '—' :
    seaTemp < 4 ? 'Svært kaldt' :
    seaTemp < 8 ? 'Kaldt' :
    seaTemp <= 16 ? 'Bra' :
    seaTemp <= 20 ? 'Varmt' : 'Svært varmt'

  const pressScore = scorePressure(pressure, pressureTrend)
  const currentScore = scoreCurrent(currentSpeed)
  const moon = moonPhase(new Date())

  const cells = [
    {
      label: 'Bølgehøyde',
      value: waveHeight !== null ? `${waveHeight.toFixed(1)} m` : '—',
      sub: waveLabel,
      score: waveScore,
    },
    {
      label: 'Vanntemperatur',
      value: seaTemp !== null ? `${seaTemp.toFixed(1)}°C` : '—',
      sub: seaTempLabel,
      score: seaTempScore,
    },
    {
      label: 'Lufttrykk',
      value: pressure !== null ? `${Math.round(pressure)} hPa` : '—',
      sub: pressureLabel(pressureTrend),
      score: pressScore,
    },
    {
      label: 'Nedbør',
      value: precipitation !== null ? `${precipitation.toFixed(1)} mm` : '—',
      sub: precipitation === 0 ? 'Ingen' : precipitation !== null && precipitation < 1 ? 'Lett' : precipitation !== null && precipitation < 5 ? 'Moderat' : precipitation !== null ? 'Kraftig' : '—',
      score: scorePrecipitation(precipitation),
    },
    {
      label: 'Strøm',
      value: currentSpeed !== null ? `${currentSpeed.toFixed(2)} m/s` : '—',
      sub: currentLabel(currentSpeed) + (currentDirection !== null ? ` · ${windDirectionLabel(currentDirection)}` : ''),
      score: currentScore,
    },
    {
      label: 'Sikt i vannet',
      value: visibilityLabel(visibilityScore),
      sub: 'Estimert',
      score: visibilityScore,
    },
    {
      label: 'Vindretning',
      value: windDirection !== null ? windDirectionLabel(windDirection) : '—',
      sub: windDirection !== null ? `${Math.round(windDirection)}°` : '',
      score: 70,
    },
    {
      label: 'Månefase',
      value: moon.emoji,
      sub: moon.name,
      score: moon.score,
    },
    {
      label: 'Soloppgang',
      value: sunrise ? formatSunTime(sunrise) : '—',
      sub: 'Beste morgenbit',
      score: 80,
    },
    {
      label: 'Solnedgang',
      value: sunset ? formatSunTime(sunset) : '—',
      sub: 'Beste kveldsbit',
      score: 80,
    },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Marin oversikt</p>
      <div className="grid grid-cols-2 gap-3">
        {cells.map(c => (
          <div key={c.label} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-lg font-medium text-gray-900">{c.value}</p>
            <p className={`text-xs mt-0.5 ${scoreColor(c.score)}`}>{c.sub}</p>
          </div>
        ))}
      </div>

      {waveNote && (
        <p className="text-xs text-gray-400 mt-3 italic">{waveNote}</p>
      )}
      {waveHeight !== null && waveHeight > 1.5 && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <p className="text-xs text-red-600 font-medium">
            Bølgehøyde over 1.5m — vurder om det er trygt å dra ut med småbåt
          </p>
        </div>
      )}
      {pressureTrend !== null && pressureTrend < -2 && (
        <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          <p className="text-xs text-green-700 font-medium">
            Lufttrykket faller raskt — fisken er trolig aktiv og biter godt nå
          </p>
        </div>
      )}
      {currentSpeed !== null && currentSpeed > 1.5 && (
        <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-700 font-medium">
            Sterk strøm — vanskelig å holde agnet på riktig dybde
          </p>
        </div>
      )}
    </div>
  )
}
