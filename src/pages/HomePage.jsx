import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProviders, getStreamingMovies } from '../api/tmdb'
import ErrorMessage from '../components/ErrorMessage'
import Loading from '../components/Loading'
import MovieGrid from '../components/MovieGrid'
import ProviderFilter from '../components/ProviderFilter'
import { mergeMovies, parseProviderIds } from '../utils/movies'

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Texto da URL (ex.: "8,119"); usado como dependência dos efeitos por ser comparável
  const filterKey = searchParams.get('streaming') ?? ''
  const selected = parseProviderIds(filterKey)

  const [providers, setProviders] = useState([])
  const [movies, setMovies] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')

  // Guarda o filtro atual para descartar respostas do "Carregar mais" de um filtro antigo
  const currentFilter = useRef(filterKey)

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

    getStreamingMovies({ providers: parseProviderIds(filterKey), page: 1 })
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
  }, [filterKey, retryCount])

  function handleFilterChange(ids) {
    setSearchParams(ids.length > 0 ? { streaming: ids.join(',') } : {})
  }

  async function handleLoadMore() {
    const filterAtRequest = filterKey
    setLoadingMore(true)
    setLoadMoreError('')
    try {
      const data = await getStreamingMovies({ providers: selected, page: page + 1 })
      if (currentFilter.current !== filterAtRequest) return
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

  return (
    <main className="home">
      {/* Com filtro ativo, mostra pelo menos o "Limpar", mesmo se os logos não carregaram */}
      {(providers.length > 0 || selected.length > 0) && (
        <ProviderFilter providers={providers} selected={selected} onChange={handleFilterChange} />
      )}

      {status === 'loading' && <Loading />}

      {status === 'error' && (
        <ErrorMessage message={error} onRetry={() => setRetryCount((n) => n + 1)} />
      )}

      {status === 'success' && movies.length === 0 && (
        <p className="empty">Nenhum filme encontrado para esses serviços</p>
      )}

      {status === 'success' && movies.length > 0 && (
        <>
          <MovieGrid movies={movies} />
          <div className="load-more">
            {loadMoreError && <ErrorMessage message={loadMoreError} />}
            {loadingMore ? (
              <Loading />
            ) : (
              page < totalPages && (
                <button type="button" onClick={handleLoadMore}>
                  Carregar mais
                </button>
              )
            )}
          </div>
        </>
      )}
    </main>
  )
}

export default HomePage
