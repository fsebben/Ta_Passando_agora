import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { NOT_FOUND_ERROR, getMovieDetails, imageUrl } from '../api/tmdb'
import ErrorMessage from '../components/ErrorMessage'
import Loading from '../components/Loading'
import { formatRating, formatRuntime, formatYear } from '../utils/format'

function MovieDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [movie, setMovie] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Ids do TMDB são sempre números; outro valor nem chega a ser buscado
    if (!/^\d+$/.test(id)) {
      setError(NOT_FOUND_ERROR)
      setStatus('error')
      return
    }

    let ignore = false
    setStatus('loading')

    getMovieDetails(id)
      .then((data) => {
        if (ignore) return
        setMovie(data)
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
  }, [id, retryCount])

  function handleBack() {
    // "default" = esta foi a primeira página aberta (ex.: link colado), então não há para onde voltar
    if (location.key === 'default') navigate('/')
    else navigate(-1)
  }

  const backButton = (
    <button type="button" className="back-button" onClick={handleBack}>
      ← Voltar
    </button>
  )

  if (status === 'loading') {
    return (
      <main className="details">
        {backButton}
        <Loading />
      </main>
    )
  }

  if (status === 'error') {
    const notFound = error === NOT_FOUND_ERROR
    return (
      <main className="details">
        {backButton}
        <ErrorMessage message={error} onRetry={notFound ? undefined : () => setRetryCount((n) => n + 1)} />
        {notFound && <Link to="/">Ir para a tela inicial</Link>}
      </main>
    )
  }

  return (
    <main className="details">
      {backButton}
      <div className="details__content">
        <img
          className="details__poster"
          src={imageUrl(movie.posterPath, 'w500') ?? '/no-poster.svg'}
          alt={movie.title}
        />
        <div className="details__info">
          <h1>{movie.title}</h1>
          <p className="details__meta">
            {formatYear(movie.releaseDate) && <span>{formatYear(movie.releaseDate)}</span>}
            {formatRuntime(movie.runtime) && <span>{formatRuntime(movie.runtime)}</span>}
            <span>{formatRating(movie.voteAverage, movie.voteCount)}</span>
          </p>
          {movie.genres.length > 0 && <p className="details__genres">{movie.genres.join(', ')}</p>}
          <p className="details__overview">{movie.overview || 'Sinopse não disponível'}</p>

          <section aria-labelledby="onde-assistir" className="where-to-watch">
            <h2 id="onde-assistir">Onde assistir</h2>
            {movie.streamingProviders.length > 0 ? (
              <ul>
                {movie.streamingProviders.map((provider) => (
                  <li key={provider.id}>
                    <img src={imageUrl(provider.logoPath, 'w92')} alt="" />
                    <span>{provider.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Não disponível em streaming por assinatura no Brasil</p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

export default MovieDetailsPage
