import { Link } from 'react-router-dom'
import { imageUrl } from '../api/tmdb'
import { formatRating, formatYear } from '../utils/format'

function MovieCard({ movie }) {
  return (
    <Link to={`/filme/${movie.id}`} className="movie-card">
      <img
        src={imageUrl(movie.posterPath, 'w342') ?? '/no-poster.svg'}
        alt={movie.title}
        loading="lazy"
      />
      <h3>{movie.title}</h3>
      <p className="movie-card__meta">
        <span>{formatYear(movie.releaseDate)}</span>
        <span>{formatRating(movie.voteAverage, movie.voteCount)}</span>
      </p>
    </Link>
  )
}

export default MovieCard
