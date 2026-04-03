import { createClient } from '@/lib/supabase/server'
import MainApp from '@/components/MainApp'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let favorites: any[] = []
  if (user) {
    const { data } = await supabase
      .from('favorite_locations')
      .select('*')
      .order('created_at', { ascending: false })
    favorites = data ?? []
  }

  return <MainApp user={user} initialFavorites={favorites} />
}
