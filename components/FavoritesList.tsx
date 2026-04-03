type Favorite = {
  id: string
  name: string
  lat: number
  lon: number
}

export default function FavoritesList({ favorites, onSelect, onRemove }: {
  favorites: Favorite[]
  onSelect: (loc: { lat: number; lon: number; name: string }) => void
  onRemove: (id: string) => void
}) {
  if (!favorites.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Lagrede steder
      </p>
      <div className="flex gap-2 flex-wrap">
        {favorites.map(f => (
          <div
            key={f.id}
            className="flex items-center gap-1 bg-gray-100 rounded-full pl-3 pr-1 py-1"
          >
            <button
              onClick={() => onSelect({ lat: f.lat, lon: f.lon, name: f.name })}
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              {f.name}
            </button>
            <button
              onClick={() => onRemove(f.id)}
              className="text-gray-400 hover:text-red-400 text-xs px-1 leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
