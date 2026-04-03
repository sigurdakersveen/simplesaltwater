import { scoreWave, windDirectionLabel, formatSunTime } from '@/lib/fishing-score'

type Props = {
  waveHeight: number | null
  windDirection: number | null
  sunrise: string | null
  sunset: string | null
}

export default function MarineData({ waveHeight, windDirection, sunrise, sunset }: Props) {
  const waveScore = scoreWave(waveHeight)

  const waveColor =
    waveScore >= 80 ? 'text-green-600' :
    waveScore >= 50 ? 'text-amber-600' : 'text-red-600'

  const waveLabel =
    waveHeight === null ? '—' :
    waveHeight < 0.3 ? 'Blikk stille' :
    waveHeight <= 0.8 ? 'Rolig' :
    waveHeight <= 1.5 ? 'Moderat' :
    waveHeight <= 2.5 ? 'Røff sjø' : 'Farlig høy'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Marin oversikt
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Bølgehøyde</p>
          <p className="text-lg font-medium text-gray-900">
            {waveHeight !== null ? `${waveHeight.toFixed(1)} m` : '—'}
          </p>
          <p className={`text-xs mt-0.5 ${waveColor}`}>{waveLabel}</p>
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
          <p className="text-xs text-gray-400 mb-1">Soloppgang</p>
          <p className="text-lg font-medium text-gray-900">
            {sunrise ? formatSunTime(sunrise) : '—'}
          </p>
          <p className="text-xs text-green-600 mt-0.5">Beste morgenbit</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Solnedgang</p>
          <p className="text-lg font-medium text-gray-900">
            {sunset ? formatSunTime(sunset) : '—'}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">Beste kveldsbit</p>
        </div>
      </div>
      {waveHeight !== null && waveHeight > 1.5 && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <p className="text-xs text-red-600 font-medium">
            Bølgehøyde over 1.5m — vurder om det er trygt å dra ut med småbåt
          </p>
        </div>
      )}
    </div>
  )
}
