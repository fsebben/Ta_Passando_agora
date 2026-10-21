import { getMovieDetails, getProviders, getStreamingMovies, imageUrl, searchStreamingMovies } from './tmdb'

const TOKEN_MSG = 'Token do TMDB inválido ou ausente. Configure VITE_TMDB_TOKEN no arquivo .env.'
const NOT_FOUND_MSG = 'Filme não encontrado.'
const GENERIC_MSG = 'Não foi possível carregar os dados. Tente novamente.'

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function calledUrl(fetchMock) {
  return new URL(fetchMock.mock.calls[0][0])
}

beforeEach(() => {
  vi.stubEnv('VITE_TMDB_TOKEN', 'tok')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('getStreamingMovies', () => {
  test('monta a URL de discover com filtros, página e cabeçalho de autenticação', async () => {
    const fetchMock = mockFetch({ page: 2, total_pages: 3, results: [] })

    await getStreamingMovies({ providers: [8, 119], page: 2 })

    const url = calledUrl(fetchMock)
    expect(url.origin + url.pathname).toBe('https://api.themoviedb.org/3/discover/movie')
    expect(url.searchParams.get('watch_region')).toBe('BR')
    expect(url.searchParams.get('language')).toBe('pt-BR')
    expect(url.searchParams.get('with_watch_monetization_types')).toBe('flatrate')
    expect(url.searchParams.get('sort_by')).toBe('popularity.desc')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('with_watch_providers')).toBe('8|119')
    expect(fetchMock.mock.calls[0][0]).toContain('with_watch_providers=8%7C119')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  test('sem provedores omite with_watch_providers', async () => {
    const fetchMock = mockFetch({ page: 1, total_pages: 1, results: [] })

    await getStreamingMovies({ providers: [], page: 1 })

    expect(calledUrl(fetchMock).searchParams.has('with_watch_providers')).toBe(false)
  })

  test('converte a resposta para o formato do app', async () => {
    mockFetch({
      page: 1,
      total_pages: 5,
      results: [
        { id: 1, title: 'X', poster_path: '/p.jpg', release_date: '2024-03-01', vote_average: 7.83, vote_count: 10, extra: 'ignorado' },
      ],
    })

    const result = await getStreamingMovies({ providers: [], page: 1 })

    expect(result).toEqual({
      page: 1,
      totalPages: 5,
      movies: [{ id: 1, title: 'X', posterPath: '/p.jpg', releaseDate: '2024-03-01', voteAverage: 7.83, voteCount: 10 }],
    })
  })
})

describe('getProviders', () => {
  test('ordena por display_priorities.BR (ou display_priority) e limita a 10', async () => {
    const results = Array.from({ length: 12 }, (_, i) => ({
      provider_id: 101 + i,
      provider_name: `P${101 + i}`,
      logo_path: `/l${101 + i}.png`,
      display_priorities: { BR: 12 - i },
      display_priority: 99,
    }))
    // Sem prioridade para o BR: usa display_priority
    delete results[0].display_priorities
    results[0].display_priority = 0
    const fetchMock = mockFetch({ results })

    const providers = await getProviders()

    const url = calledUrl(fetchMock)
    expect(url.pathname).toBe('/3/watch/providers/movie')
    expect(url.searchParams.get('watch_region')).toBe('BR')
    expect(url.searchParams.get('language')).toBe('pt-BR')
    expect(providers).toHaveLength(10)
    expect(providers[0]).toEqual({ id: 101, name: 'P101', logoPath: '/l101.png' })
    expect(providers.map((p) => p.id)).toEqual([101, 112, 111, 110, 109, 108, 107, 106, 105, 104])
  })
})

describe('getMovieDetails', () => {
  const details = {
    id: 550,
    title: 'Clube da Luta',
    poster_path: '/f.jpg',
    release_date: '1999-10-15',
    runtime: 139,
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 8.4,
    vote_count: 30000,
    overview: 'Sinopse',
    'watch/providers': {
      results: {
        BR: { flatrate: [{ provider_id: 337, provider_name: 'Disney Plus', logo_path: '/d.png' }] },
      },
    },
  }

  test('usa append_to_response e extrai os streamings por assinatura do BR', async () => {
    const fetchMock = mockFetch(details)

    const movie = await getMovieDetails(550)

    expect(fetchMock.mock.calls[0][0]).toContain('/movie/550?')
    expect(fetchMock.mock.calls[0][0]).toContain('append_to_response=watch%2Fproviders')
    expect(calledUrl(fetchMock).searchParams.get('language')).toBe('pt-BR')
    expect(movie).toEqual({
      id: 550,
      title: 'Clube da Luta',
      posterPath: '/f.jpg',
      releaseDate: '1999-10-15',
      runtime: 139,
      genres: ['Drama'],
      voteAverage: 8.4,
      voteCount: 30000,
      overview: 'Sinopse',
      streamingProviders: [{ id: 337, name: 'Disney Plus', logoPath: '/d.png' }],
    })
  })

  test('streamingProviders é [] quando não há BR', async () => {
    mockFetch({ ...details, 'watch/providers': { results: { US: { flatrate: [] } } } })
    expect((await getMovieDetails(550)).streamingProviders).toEqual([])
  })

  test('streamingProviders é [] quando o BR não tem flatrate', async () => {
    mockFetch({ ...details, 'watch/providers': { results: { BR: { rent: [] } } } })
    expect((await getMovieDetails(550)).streamingProviders).toEqual([])
  })
})

describe('erros', () => {
  test('HTTP 401 vira a mensagem de token', async () => {
    mockFetch({}, { ok: false, status: 401 })
    await expect(getProviders()).rejects.toThrow(TOKEN_MSG)
  })

  test('HTTP 404 vira "Filme não encontrado."', async () => {
    mockFetch({}, { ok: false, status: 404 })
    await expect(getMovieDetails('abc')).rejects.toThrow(NOT_FOUND_MSG)
  })

  test('HTTP 500 vira a mensagem genérica', async () => {
    mockFetch({}, { ok: false, status: 500 })
    await expect(getProviders()).rejects.toThrow(GENERIC_MSG)
  })

  test('falha de rede vira a mensagem genérica', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getProviders()).rejects.toThrow(GENERIC_MSG)
  })

  test('token vazio lança a mensagem de token sem chamar fetch', async () => {
    vi.stubEnv('VITE_TMDB_TOKEN', '')
    const fetchMock = mockFetch({})
    await expect(getProviders()).rejects.toThrow(TOKEN_MSG)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('imageUrl', () => {
  test('monta a URL da imagem no tamanho pedido', () => {
    expect(imageUrl('/a.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/a.jpg')
  })

  test('retorna null sem caminho', () => {
    expect(imageUrl(null, 'w342')).toBeNull()
  })
})

describe('dados inesperados da API', () => {
  test('totalPages respeita o limite de 500 páginas do TMDB', async () => {
    mockFetch({ page: 1, total_pages: 1200, results: [] })
    expect((await getStreamingMovies({ providers: [], page: 1 })).totalPages).toBe(500)
  })

  test('detalhes sem genres viram lista vazia', async () => {
    mockFetch({ id: 1, title: 'X', vote_average: 5, vote_count: 1, overview: '' })
    expect((await getMovieDetails(1)).genres).toEqual([])
  })

  test('resposta que não é JSON vira a mensagem genérica', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <') } }))
    await expect(getProviders()).rejects.toThrow(GENERIC_MSG)
  })
})

describe('getProviders sem lojas de aluguel e compra', () => {
  test('remove Apple TV Store, Google Play, Amazon Video e Microsoft Store e completa com os próximos', async () => {
    const ids = [2, 8, 3, 119, 10, 350, 68, 337, 167, 47, 531, 1899, 307, 484]
    const results = ids.map((id, i) => ({
      provider_id: id,
      provider_name: `P${id}`,
      logo_path: `/l${id}.png`,
      display_priorities: { BR: i },
    }))
    mockFetch({ results })

    const providers = await getProviders()

    expect(providers.map((p) => p.id)).toEqual([8, 119, 350, 337, 167, 47, 531, 1899, 307, 484])
  })
})

describe('404 fora da página de detalhes', () => {
  test('404 em getProviders vira a mensagem genérica', async () => {
    mockFetch({}, { ok: false, status: 404 })
    await expect(getProviders()).rejects.toThrow(GENERIC_MSG)
  })

  test('404 em getStreamingMovies vira a mensagem genérica', async () => {
    mockFetch({}, { ok: false, status: 404 })
    await expect(getStreamingMovies({ providers: [], page: 1 })).rejects.toThrow(GENERIC_MSG)
  })
})

describe('getStreamingMovies com nota mínima', () => {
  test('minRating 8 envia vote_average.gte=8 e vote_count.gte=200', async () => {
    const fetchMock = mockFetch({ page: 1, total_pages: 1, results: [] })
    await getStreamingMovies({ providers: [], minRating: 8, page: 1 })
    const params = calledUrl(fetchMock).searchParams
    expect(params.get('vote_average.gte')).toBe('8')
    expect(params.get('vote_count.gte')).toBe('200')
  })

  test('minRating 0 não envia vote_average.gte nem vote_count.gte', async () => {
    const fetchMock = mockFetch({ page: 1, total_pages: 1, results: [] })
    await getStreamingMovies({ providers: [], minRating: 0, page: 1 })
    const params = calledUrl(fetchMock).searchParams
    expect(params.has('vote_average.gte')).toBe(false)
    expect(params.has('vote_count.gte')).toBe(false)
  })
})

describe('searchStreamingMovies', () => {
  // Responde conforme a URL: /search/movie devolve a busca; /movie/{id}/watch/providers devolve o BR daquele id
  function mockSearch({ results, page = 1, total_pages = 1, providersById = {}, failId }) {
    const fetchMock = vi.fn(async (url) => {
      const { pathname } = new URL(url)
      if (pathname === '/3/search/movie') {
        return { ok: true, status: 200, json: async () => ({ page, total_pages, results }) }
      }
      const id = Number(pathname.split('/')[3])
      if (id === failId) return { ok: false, status: 500, json: async () => ({}) }
      const br = providersById[id]
      return { ok: true, status: 200, json: async () => ({ id, results: br ? { BR: br } : {} }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function result(id, extra = {}) {
    return { id, title: `F${id}`, poster_path: null, release_date: '2020-01-01', vote_average: 7, vote_count: 1000, ...extra }
  }

  const flat = (...ids) => ({ flatrate: ids.map((id) => ({ provider_id: id, provider_name: `P${id}`, logo_path: '/x.png' })) })

  test('monta a URL de busca', async () => {
    const fetchMock = mockSearch({ results: [] })
    await searchStreamingMovies({ query: 'batman', providers: [], minRating: 0, page: 2 })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/3/search/movie')
    expect(url.searchParams.get('query')).toBe('batman')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('include_adult')).toBe('false')
    expect(url.searchParams.get('language')).toBe('pt-BR')
  })

  test('preserva caracteres especiais e acentos na busca', async () => {
    const fetchMock = mockSearch({ results: [] })
    await searchStreamingMovies({ query: 'Tom & Jerry ção', providers: [], minRating: 0, page: 1 })
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('query')).toBe('Tom & Jerry ção')
  })

  test('mantém só filmes com flatrate no BR, na ordem original', async () => {
    mockSearch({
      results: [result(1), result(2), result(3), result(4)],
      providersById: { 1: flat(8), 2: { rent: [{ provider_id: 2 }] }, 4: flat(119) },
    })
    const { movies } = await searchStreamingMovies({ query: 'x', providers: [], minRating: 0, page: 1 })
    expect(movies.map((m) => m.id)).toEqual([1, 4])
    expect(movies[0]).toEqual({ id: 1, title: 'F1', posterPath: null, releaseDate: '2020-01-01', voteAverage: 7, voteCount: 1000 })
  })

  test('com providers mantém só quem tem um deles em flatrate', async () => {
    mockSearch({ results: [result(1), result(4)], providersById: { 1: flat(8, 337), 4: flat(119) } })
    const { movies } = await searchStreamingMovies({ query: 'x', providers: [8], minRating: 0, page: 1 })
    expect(movies.map((m) => m.id)).toEqual([1])
  })

  test('com minRating 8 descarta nota baixa e poucos votos', async () => {
    mockSearch({
      results: [
        result(5, { vote_average: 8.5, vote_count: 500 }),
        result(6, { vote_average: 7.9, vote_count: 500 }),
        result(7, { vote_average: 9.0, vote_count: 150 }),
      ],
      providersById: { 5: flat(8), 6: flat(8), 7: flat(8) },
    })
    const { movies } = await searchStreamingMovies({ query: 'x', providers: [], minRating: 8, page: 1 })
    expect(movies.map((m) => m.id)).toEqual([5])
  })

  test('com minRating descarta filme sem vote_average ou vote_count', async () => {
    mockSearch({
      results: [result(8, { vote_average: undefined }), result(9, { vote_count: undefined })],
      providersById: { 8: flat(8), 9: flat(8) },
    })
    const { movies } = await searchStreamingMovies({ query: 'x', providers: [], minRating: 6, page: 1 })
    expect(movies).toEqual([])
  })

  test('página sem filmes em streaming devolve lista vazia com mais páginas', async () => {
    mockSearch({ results: [result(1), result(2)], page: 1, total_pages: 3 })
    expect(await searchStreamingMovies({ query: 'x', providers: [], minRating: 0, page: 1 })).toEqual({
      movies: [],
      page: 1,
      totalPages: 3,
    })
  })

  test('falha numa consulta de providers vira a mensagem genérica', async () => {
    mockSearch({ results: [result(1), result(2)], providersById: { 1: flat(8) }, failId: 2 })
    await expect(searchStreamingMovies({ query: 'x', providers: [], minRating: 0, page: 1 })).rejects.toThrow(GENERIC_MSG)
  })

  test('totalPages da busca limitado a 500', async () => {
    mockSearch({ results: [], total_pages: 800 })
    expect((await searchStreamingMovies({ query: 'x', providers: [], minRating: 0, page: 1 })).totalPages).toBe(500)
  })
})
