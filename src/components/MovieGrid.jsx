import MovieCard from './MovieCard'

function MovieGrid({ movies }) {
  return (
    <ul className="movie-grid">
      {movies.map((movie) => (
        <li key={movie.id}>
          <MovieCard movie={movie} />
        </li>
      ))}
    </ul>
  )
}

export default MovieGrid
