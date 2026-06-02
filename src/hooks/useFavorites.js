import { useState } from 'react'

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chitose-favorites') || '[]') }
    catch { return [] }
  })

  const save = (next) => {
    setFavorites(next)
    localStorage.setItem('chitose-favorites', JSON.stringify(next))
  }

  const add = (name) => {
    if (!name.trim() || favorites.includes(name)) return
    save([name, ...favorites].slice(0, 10))
  }

  const remove = (name) => save(favorites.filter(f => f !== name))

  return { favorites, add, remove }
}
