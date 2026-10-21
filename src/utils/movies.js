// "8,119" -> [8, 119]; valores que não são números são ignorados
export function parseProviderIds(param) {
  if (!param) return []
  return param
    .split(',')
    .filter((value) => /^\d+$/.test(value.trim()))
    .map(Number)
}

// O TMDB pode repetir um filme (entre páginas ou na mesma resposta); mantemos só a primeira ocorrência
export function mergeMovies(current, incoming) {
  const ids = new Set(current.map((movie) => movie.id))
  const added = incoming.filter((movie) => {
    if (ids.has(movie.id)) return false
    ids.add(movie.id)
    return true
  })
  return [...current, ...added]
}

export const RATING_OPTIONS = [
  { value: 0, label: 'Qualquer nota' },
  { value: 6, label: '6+' },
  { value: 7, label: '7+' },
  { value: 8, label: '8+' },
  { value: 9, label: '9+' },
]

// "8" -> 8; qualquer valor que não seja uma das opções do menu vira 0 ("Qualquer nota")
export function parseMinRating(param) {
  const option = RATING_OPTIONS.find((o) => o.value > 0 && String(o.value) === param)
  return option ? option.value : 0
}
