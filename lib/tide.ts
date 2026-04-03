export type TideEntry = { time: string; value: number }
export type TideExtreme = { time: string; value: number; type: 'high' | 'low' }

export type TideData = {
  entries: TideEntry[]
  extremes: TideExtreme[]
  nowValue: number | null
  nowTrend: 'rising' | 'falling' | 'unknown'
  nextExtreme: TideExtreme | null
  hoursToNext: number | null
  label: string
  score: number
}

export async function fetchTideData(lat: number, lon: number): Promise<TideData> {
  const res = await fetch(`/api/tide?lat=${lat}&lon=${lon}`)
  const data = await res.json()

  const entries: TideEntry[] = data.entries ?? []
  const extremes: TideExtreme[] = data.extremes ?? []

  if (!entries.length) return fallback()

  const nowH = new Date().getHours()
  const nowEntry = entries[nowH] ?? entries[entries.length - 1]
  const prevEntry = entries[Math.max(0, nowH - 1)]

  const nowValue = nowEntry?.value ?? null
  const nowTrend = nowEntry && prevEntry
    ? nowEntry.value > prevEntry.value ? 'rising' : 'falling'
    : 'unknown'

  // Next extreme after now
  const nowTime = new Date()
  const nextExtreme = extremes.find(e => new Date(e.time) > nowTime) ?? null
  const hoursToNext = nextExtreme
    ? Math.round((new Date(nextExtreme.time).getTime() - nowTime.getTime()) / 3600000 * 10) / 10
    : null

  // Label
  let label = ''
  if (nowTrend === 'rising') {
    label = nextExtreme?.type === 'high'
      ? `Stigende — hoyvann om ${hoursToNext}t`
      : 'Stigende tidevann'
  } else if (nowTrend === 'falling') {
    label = nextExtreme?.type === 'low'
      ? `Fallende — lavvann om ${hoursToNext}t`
      : 'Fallende tidevann'
  } else {
    label = 'Tidevann ukjent'
  }

  // Score: rising toward high = best
  let score = 50
  if (nowTrend === 'rising') {
    score = hoursToNext !== null && hoursToNext < 2 ? 95 : 80
  } else if (nowTrend === 'falling') {
    if (nextExtreme?.type === 'low' && hoursToNext !== null && hoursToNext < 1) score = 20
    else score = 45
  }

  return { entries, extremes, nowValue, nowTrend, nextExtreme, hoursToNext, label, score }
}

function fallback(): TideData {
  // Sine fallback if API fails
  const nowH = new Date().getHours()
  const val = 50 + 50 * Math.sin((nowH - 3) * Math.PI / 6)
  const prev = 50 + 50 * Math.sin((nowH - 3.5) * Math.PI / 6)
  const rising = val > prev
  return {
    entries: [], extremes: [],
    nowValue: Math.round(val),
    nowTrend: rising ? 'rising' : 'falling',
    nextExtreme: null, hoursToNext: null,
    label: rising ? 'Stigende tidevann (estimert)' : 'Fallende tidevann (estimert)',
    score: rising ? 75 : 45,
  }
}
