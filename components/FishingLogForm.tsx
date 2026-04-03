'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Location = { lat: number; lon: number; name: string }

export default function FishingLogForm({ user, location, currentScore, onClose }: {
  user: any
  location: Location
  currentScore: number
  onClose: () => void
}) {
  const [notes, setNotes] = useState('')
  const [catchDesc, setCatchDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('fishing_log').insert({
      user_id: user.id,
      location_name: location.name,
      lat: location.lat,
      lon: location.lon,
      date: new Date().toISOString().split('T')[0],
      score: currentScore,
      notes: notes || null,
      catch_description: catchDesc || null,
    })
    if (!error) {
      setSaved(true)
      setTimeout(onClose, 1200)
    }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-700">Logg fiskeøkt</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400 mb-0.5">Sted og poeng</p>
          <p className="text-sm text-gray-700">{location.name} — {currentScore}/100</p>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Hva fanget du?</label>
          <input
            value={catchDesc}
            onChange={e => setCatchDesc(e.target.value)}
            placeholder="f.eks. 2 sei, 1 torsk"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notater</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Vind, tidspunkt, agn, dybde..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 resize-none"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-800"
        >
          {saved ? '✓ Lagret!' : saving ? 'Lagrer...' : 'Lagre økt'}
        </button>
      </div>
    </div>
  )
}
