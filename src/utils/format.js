export function formatYear(releaseDate) {
  return releaseDate ? releaseDate.slice(0, 4) : ''
}

export function formatRating(voteAverage, voteCount) {
  if (!voteCount || voteAverage == null) return 'Sem nota'
  return `⭐ ${voteAverage.toFixed(1)}`
}

export function formatRuntime(minutes) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}min`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}min`
}
