import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 })
  }

  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 0, 0, 0)

  const pad = (n: number) => n.toString().padStart(2, '0')
  const fmtTime = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`

  const url = `https://vannstand.kartverket.no/tideapi.php?lat=${lat}&lon=${lon}&fromtime=${fmtTime(from)}&totime=${fmtTime(to)}&datatype=tab&refcode=cd&lang=nb&interval=60&dst=1&tzone=1&tide_request=locationdata`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/xml' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error('Kartverket API feilet')

    const xml = await res.text()

    // Parse XML — extract hourly tide values
    const entries: { time: string; value: number }[] = []
    const regex = /<waterlevel time="([^"]+)" value="([^"]+)"/g
    let match
    while ((match = regex.exec(xml)) !== null) {
      const value = parseFloat(match[2])
      if (!isNaN(value)) {
        entries.push({ time: match[1], value })
      }
    }

    // Find highs and lows
    const extremes: { time: string; value: number; type: 'high' | 'low' }[] = []
    for (let i = 1; i < entries.length - 1; i++) {
      const prev = entries[i - 1].value
      const curr = entries[i].value
      const next = entries[i + 1].value
      if (curr > prev && curr > next) extremes.push({ ...entries[i], type: 'high' })
      if (curr < prev && curr < next) extremes.push({ ...entries[i], type: 'low' })
    }

    return NextResponse.json({ entries, extremes })
  } catch (err) {
    return NextResponse.json({ error: 'Kunne ikke hente tidevannsdata', entries: [], extremes: [] }, { status: 500 })
  }
}
