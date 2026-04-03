import { scoreWave, windDirectionLabel, formatSunTime, scoreSeaTemp, scorePressure, pressureLabel, moonPhase, scorePrecipitation } from '@/lib/fishing-score'

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
}

export default function MarineData({
  waveHeight, seaTemp, windDirection, sunrise, sunset,
  waveNote, pressure, pressureTrend, precipitation
}: Props) {
  const waveScore = scoreWave(waveHeight)
  const waveColor = waveScore >= 80 ? 'text-green-600' : waveScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const waveLabel =
    waveHeight === null ? '—' :
    waveHeight < 0.3 ? 'Blikk stille' :
    waveHeight <= 0.8 ? 'Rolig' :
    waveHeight <= 1.5 ? 'Moderat' :
    waveHeight <= 2.5 ? 'Røff sjø' : 'Farlig høy'

  const seaTempScore = scoreSeaTemp(seaTemp)
  const seaTempColor = seaTempScore >= 80 ? 'text-green-600' : seaTempScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const seaTempLabel =
    seaTemp === null ? '—' :
    seaTemp < 4 ? 'Svært kaldt' :
    seaTemp < 8 ? 'Kaldt' :
    seaTemp <= 16 ? 'Bra' :
    seaTemp <= 20 ? 'Varmt' : 'Svært varmt'

  const pressScore = scorePressure(pressure, pressureTrend)
  const pressColor = pressScore >= 80 ? 'text-green-600' : pressScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const pLabel = pressureLabel(pressureTrend)

  const precipScore = scorePrecipitation(precipitation)
  const precipColor = precipScore >= 80 ? 'text-green-600' : precipScore >= 50 ? 'text-amber-600' : 'text-red-600'
  const precipLabel =
    precipitation === null ? '—' :
    precipitation === 0 ? 'Ingen' :
    precipitation < 1 ? 'Lett' :
    precipitation < 5 ? 'Moderat' :
    precipitation < 15 ? 'Kraftig' : 'Veldig kraftig'

  const moon = moonPhase(new Date())

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Marin oversikt</p>
      <div className="grid grid-cols-2 gap-3">

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Bølgehøyde</p>
          <p className="text-lg font-medium text-gray-900">
            {waveHeight !== null ? `${waveHeight.toFixed(1)} m` : '—'}
          </p>
          <p className={`text-xs mt-0.5 ${waveColor}`}>{waveLabel}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Vanntemperatur</p>
          <p className="text-lg font-medium text-gray-900">
            {seaTemp !== null ? `${seaTemp.toFixed(1)}°C` : '—'}
          </p>
          <p className={`text-xs mt-0.5 ${seaTempColor}`}>{seaTempLabel}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Lufttrykk</p>
          <p className="text-lg font-medium text-gray-900">
            {pressure !== null ? `${Math.round(pressure)} hPa` : '—'}
          </p>
          <p className={`text-xs mt-0.5 ${pressColor}`}>{pLabel}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Nedbør nå</p>
          <p className="text-lg font-medium text-gray-900">
            {precipitation !== null ? `${precipitation.toFixed(1)} mm` : '—'}
          </p>
          <p className={`text-xs mt-0.5 ${precipColor}`}>{precipLabel}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Vindretning</p>
          <p className="text-lg font-medium text-gray-900">
            {windDirection !== null ? windDirectionLabel(windDirection) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {windDirection !== null ? `${Math.round(windDirection)}°` : ''}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Månefase</p>
          <p className="text-lg font-medium text-gray-900">{moon.emoji}</p>
          <p className="text-xs text-gray-500 mt-0.5">{moon.name}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Soloppgang</p>
          <p className="text-lg font-medium text-gray-900">{sunrise ? formatSunTime(sunrise) : '—'}</p>
          <p className="text-xs text-green-600 mt-0.5">Beste morgenbit</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Solnedgang</p>
          <p className="text-lg font-medium text-gray-900">{sunset ? formatSunTime(sunset) : '—'}</p>
          <p className="text-xs text-amber-600 mt-0.5">Beste kveldsbit</p>
        </div>

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
    </div>
  )
}
