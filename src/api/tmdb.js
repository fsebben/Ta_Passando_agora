// Único módulo do app que conversa com a API do TMDB.
// Páginas e componentes usam só as funções exportadas aqui.

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const REGION = 'BR'
const LANGUAGE = 'pt-BR'
const MAX_PROVIDERS = 10
const MAX_PAGES = 500
export const MIN_VOTES = 200
// Lojas de aluguel/compra: o TMDB as lista junto com os streamings, mas não são assinatura
// 2 = Apple TV Store, 3 = Google Play Filmes, 10 = Amazon Video, 68 = Microsoft Store
const RENTAL_STORE_IDS = [2, 3, 10, 68]

const TOKEN_ERROR = 'Token do TMDB inválido ou ausente. Configure VITE_TMDB_TOKEN no arquivo .env.'
export const NOT_FOUND_ERROR = 'Filme não encontrado.'
const GENERIC_ERROR = 'Não foi possível carregar os dados. Tente novamente.'

// notFoundMessage: só a busca de um filme específico trata 404 como "Filme não encontrado."
async function request(path, params = {}, notFoundMessage = GENERIC_ERROR) {
  // Lido aqui dentro (e não no topo do arquivo) para que os testes possam trocar o valor
  const token = import.meta.env.VITE_TMDB_TOKEN
  if (!token) throw new Error(TOKEN_ERROR)

  const query = new URLSearchParams({ ...params, language: LANGUAGE })
  let response
  try {
    response = await fetch(`${API_BASE}${path}?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error(GENERIC_ERROR)
  }

  if (response.status === 401) throw new Error(TOKEN_ERROR)
  if (response.status === 404) throw new Error(notFoundMessage)
  if (!response.ok) throw new Error(GENERIC_ERROR)
  try {
    return await response.json()
  } catch {
    throw new Error(GENERIC_ERROR)
  }
}

function toProvider(p) {
  return { id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }
}

function toMovie(m) {
  return {
    id: m.id,
    title: m.title,
    posterPath: m.poster_path,
    releaseDate: m.release_date,
    voteAverage: m.vote_average,
    voteCount: m.vote_count,
  }
}

export async function getProviders() {
  const data = await request('/watch/providers/movie', { watch_region: REGION })
  const priority = (p) => p.display_priorities?.[REGION] ?? p.display_priority
  return data.results
    .filter((p) => !RENTAL_STORE_IDS.includes(p.provider_id))
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, MAX_PROVIDERS)
    .map(toProvider)
}

// O TMDB não aceita page acima de 500, mesmo quando total_pages é maior
function toMoviePage(data, movies) {
  return { movies, page: data.page, totalPages: Math.min(data.total_pages, MAX_PAGES) }
}

export async function getStreamingMovies({ providers, minRating, page }) {
  const params = {
    watch_region: REGION,
    with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc',
    page: String(page),
  }
  // "|" significa OU: filmes em qualquer um dos serviços escolhidos
  if (providers.length > 0) params.with_watch_providers = providers.join('|')
  if (minRating > 0) {
    params['vote_average.gte'] = String(minRating)
    // Sem um mínimo de votos, filmes obscuros com poucas avaliações aparecem com nota alta
    params['vote_count.gte'] = String(MIN_VOTES)
  }

  const data = await request('/discover/movie', params)
  return toMoviePage(data, data.results.map(toMovie))
}

// Mesma regra que o /discover aplica com vote_average.gte e vote_count.gte
function meetsRating(movie, minRating) {
  if (minRating === 0) return true
  return movie.vote_average >= minRating && movie.vote_count >= MIN_VOTES
}

// A busca do TMDB não aceita filtro de streaming, então cada resultado é conferido
export async function searchStreamingMovies({ query, providers, minRating, page }) {
  const data = await request('/search/movie', { query, page: String(page), include_adult: 'false' })
  const availability = await Promise.all(
    data.results.map((m) => request(`/movie/${m.id}/watch/providers`)),
  )

  const movies = data.results.filter((m, i) => {
    const flatrate = availability[i].results?.[REGION]?.flatrate ?? []
    if (flatrate.length === 0) return false
    if (providers.length > 0 && !flatrate.some((p) => providers.includes(p.provider_id))) return false
    return meetsRating(m, minRating)
  })
  return toMoviePage(data, movies.map(toMovie))
}

export async function getMovieDetails(id) {
  const data = await request(
    `/movie/${encodeURIComponent(id)}`,
    { append_to_response: 'watch/providers' },
    NOT_FOUND_ERROR,
  )
  const flatrate = data['watch/providers']?.results?.[REGION]?.flatrate ?? []
  return {
    ...toMovie(data),
    runtime: data.runtime,
    genres: (data.genres ?? []).map((g) => g.name),
    overview: data.overview,
    streamingProviders: flatrate.map(toProvider),
  }
}

export function imageUrl(path, size) {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}
