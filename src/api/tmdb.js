// Único módulo do app que conversa com a API do TMDB.
// Páginas e componentes usam só as funções exportadas aqui.

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const REGION = 'BR'
const LANGUAGE = 'pt-BR'
const MAX_PROVIDERS = 10

const TOKEN_ERROR = 'Token do TMDB inválido ou ausente. Configure VITE_TMDB_TOKEN no arquivo .env.'
export const NOT_FOUND_ERROR = 'Filme não encontrado.'
const GENERIC_ERROR = 'Não foi possível carregar os dados. Tente novamente.'

async function request(path, params = {}) {
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
  if (response.status === 404) throw new Error(NOT_FOUND_ERROR)
  if (!response.ok) throw new Error(GENERIC_ERROR)
  return response.json()
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
  return [...data.results]
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, MAX_PROVIDERS)
    .map(toProvider)
}

export async function getStreamingMovies({ providers, page }) {
  const params = {
    watch_region: REGION,
    with_watch_monetization_types: 'flatrate',
    sort_by: 'popularity.desc',
    page: String(page),
  }
  // "|" significa OU: filmes em qualquer um dos serviços escolhidos
  if (providers.length > 0) params.with_watch_providers = providers.join('|')

  const data = await request('/discover/movie', params)
  return { movies: data.results.map(toMovie), page: data.page, totalPages: data.total_pages }
}

export async function getMovieDetails(id) {
  const data = await request(`/movie/${encodeURIComponent(id)}`, {
    append_to_response: 'watch/providers',
  })
  const flatrate = data['watch/providers']?.results?.[REGION]?.flatrate ?? []
  return {
    ...toMovie(data),
    runtime: data.runtime,
    genres: data.genres.map((g) => g.name),
    overview: data.overview,
    streamingProviders: flatrate.map(toProvider),
  }
}

export function imageUrl(path, size) {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}
