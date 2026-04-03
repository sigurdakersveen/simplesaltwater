import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: logs } = await supabase
    .from('fishing_log')
    .select('*')
    .order('date', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">← Tilbake</Link>
        <span className="font-medium text-gray-900">Fiskelogg</span>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {!logs?.length && (
          <p className="text-gray-400 text-sm text-center py-12">
            Ingen turer logget ennå. Gå tilbake og logg din første økt!
          </p>
        )}
        {logs?.map(log => (
          <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{log.location_name}</p>
                <p className="text-xs text-gray-400">
                  {new Date(log.date).toLocaleDateString('nb-NO', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                {log.score}/100
              </span>
            </div>
            {log.catch_description && (
              <p className="text-sm text-gray-700 mb-1">🐟 {log.catch_description}</p>
            )}
            {log.notes && (
              <p className="text-sm text-gray-500">{log.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
