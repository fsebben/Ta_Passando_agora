import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProviders, getStreamingMovies, searchStreamingMovies } from '../api/tmdb'
import ErrorMessage from '../components/ErrorMessage'
import Loading from '../components/Loading'
import MovieGrid from '../components/MovieGrid'
import ProviderFilter from '../components/ProviderFilter'
import RatingFilter from '../components/RatingFilter'
import SearchBar from '../components/SearchBar'
import { mergeMovies, parseMinRating, parseProviderIds } from '../utils/movies'

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = (searchParams.get('busca') ?? '').trim()
  const providersKey = searchParams.get('streaming') ?? ''
  const selected = parseProviderIds(providersKey)
  const minRating = parseMinRating(searchParams.get('nota'))
  // Junta os três filtros num texto comparável, usado como dependência dos efeitos
  const filterKey = `${query}|${providersKey}|${minRating}`
  const hasFilters = query !== '' || selected.length > 0 || minRating > 0

  const [providers, setProviders] = useState([])
  const [movies, setMovies] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  // Na busca, "Carregar mais" pode trazer uma página sem nada em streaming; avisamos para não parecer que falhou
  const [emptyPageNotice, setEmptyPageNotice] = useState(false)

  // Guarda o filtro atual para descartar respostas do "Carregar mais" de um filtro antigo
  const currentFilter = useRef(filterKey)

  // Com busca, usa a busca por nome; sem busca, a listagem por popularidade
  function fetchPage(pageNumber) {
    const filters = { providers: selected, minRating, page: pageNumber }
    return query ? searchStreamingMovies({ query, ...filters }) : getStreamingMovies(filters)
  }

  useEffect(() => {
    getProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
  }, [])

  useEffect(() => {
    currentFilter.current = filterKey
    // Se o filtro mudar antes da resposta chegar, a resposta antiga é ignorada
    let ignore = false
    setStatus('loading')
    setMovies([])
    setLoadingMore(false)
    setLoadMoreError('')
    setEmptyPageNotice(false)

    fetchPage(1)
      .then((data) => {
        if (ignore) return
        setMovies(mergeMovies([], data.movies))
        setPage(data.page)
        setTotalPages(data.totalPages)
        setStatus('success')
      })
      .catch((err) => {
        if (ignore) return
        setError(err.message)
        setStatus('error')
      })

    return () => {
      ignore = true
    }
    // fetchPage usa os valores derivados de filterKey, que já está nas dependências
  }, [filterKey, retryCount])

  // Aplica mudanças na URL mantendo os outros filtros; valor vazio remove o parâmetro
  function updateParams(changes) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next)
  }

  async function handleLoadMore() {
    const filterAtRequest = filterKey
    setLoadingMore(true)
    setLoadMoreError('')
    setEmptyPageNotice(false)
    try {
      const data = await fetchPage(page + 1)
      if (currentFilter.current !== filterAtRequest) return
      setEmptyPageNotice(data.movies.length === 0 && data.page < data.totalPages)
      setMovies((current) => mergeMovies(current, data.movies))
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch (err) {
      if (currentFilter.current === filterAtRequest) setLoadMoreError(err.message)
    } finally {
      // Se o filtro mudou, o efeito do filtro novo já cuidou do estado de carregamento
      if (currentFilter.current === filterAtRequest) setLoadingMore(false)
    }
  }

  const hasMorePages = page < totalPages

  return (
    <main className="home">
      <section className="hero">
        <p className="hero__lead">
          Filmes disponíveis hoje nos streamings por assinatura no Brasil. Marque os que você assina.
        </p>
        <SearchBar value={query} onSearch={(text) => updateParams({ busca: text })} />
        {providers.length > 0 && (
          <ProviderFilter
            providers={providers}
            selected={selected}
            onChange={(ids) => updateParams({ streaming: ids.join(',') })}
          />
        )}
        <div className="filters-row">
          <RatingFilter
            value={minRating}
            onChange={(rating) => updateParams({ nota: rating > 0 ? String(rating) : '' })}
          />
          {/* Sempre visível: limpa até um filtro de streaming cujos logos não carregaram */}
          <button
            type="button"
            className="clear-filters"
            disabled={!hasFilters}
            onClick={() => setSearchParams({})}
          >
            Limpar filtros
          </button>
        </div>
      </section>

      {query && <h2 className="results-title">Resultados para "{query}"</h2>}

      {status === 'loading' && <Loading />}

      {status === 'error' && (
        <ErrorMessage message={error} onRetry={() => setRetryCount((n) => n + 1)} />
      )}

      {status === 'success' && (
        <>
          {movies.length > 0 && <MovieGrid movies={movies} />}

          {movies.length === 0 && !hasMorePages && (
            <p className="empty">Nenhum filme encontrado com esses filtros</p>
          )}

          {/* Só na busca: uma página de resultados pode não ter nada em streaming */}
          {movies.length === 0 && hasMorePages && (
            <p className="empty">Nenhum filme em streaming nesta página de resultados.</p>
          )}

          {(movies.length > 0 || hasMorePages) && (
            <div className="load-more">
              {loadMoreError && <ErrorMessage message={loadMoreError} />}
              {emptyPageNotice && (
                <p className="empty">Nenhum filme em streaming nesta página; tente carregar mais.</p>
              )}
              {loadingMore ? (
                <Loading />
              ) : (
                hasMorePages && (
                  <button type="button" onClick={handleLoadMore}>
                    Carregar mais
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}

export default HomePage
