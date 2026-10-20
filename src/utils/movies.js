// "8,119" -> [8, 119]; valores que não são números são ignorados
export function parseProviderIds(param) {
  if (!param) return []
  return param
    .split(',')
    .filter((value) => /^\d+$/.test(value.trim()))
    .map(Number)
}

// O TMDB pode repetir um filme entre páginas; mantemos só a primeira ocorrência
export function mergeMovies(current, incoming) {
  const ids = new Set(current.map((movie) => movie.id))
  return [...current, ...incoming.filter((movie) => !ids.has(movie.id))]
}
