import { getStatus } from '@/lib/fishing-score'

function dayLabel(offset: number) {
  if (offset === 0) return 'I dag'
  if (offset === 1) return 'I morgen'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('nb-NO', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
}

function dateLabel(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

export default function ThreeDayForecast({ getDayData, activeDay, onSelectDay }: {
  getDayData: (i: number) => any
  activeDay: number
  onSelectDay: (i: number) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map(i => {
        const d = getDayData(i)
        if (!d) return null
        const st = getStatus(d.avg)
        return (
          <button
            key={i}
            onClick={() => onSelectDay(i)}
            className={`bg-white border rounded-xl p-3 text-left transition-all ${
              activeDay === i
                ? 'border-gray-800 shadow-sm'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className="text-xs text-gray-400 mb-0.5">{dayLabel(i)}</div>
            <div className="text-xs text-gray-300 mb-2">{dateLabel(i)}</div>
            <div className="text-2xl font-medium text-gray-900">{d.avg}</div>
            <div className={`text-xs mt-0.5 ${st.color}`}>{st.label}</div>
          </button>
        )
      })}
    </div>
  )
}
