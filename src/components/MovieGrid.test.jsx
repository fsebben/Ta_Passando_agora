import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MovieGrid from './MovieGrid'

test('renderiza um item por filme', () => {
  const movies = [
    { id: 1, title: 'A', posterPath: null, releaseDate: '2020-01-01', voteAverage: 5, voteCount: 1 },
    { id: 2, title: 'B', posterPath: null, releaseDate: '2021-01-01', voteAverage: 6, voteCount: 1 },
  ]
  render(<MemoryRouter><MovieGrid movies={movies} /></MemoryRouter>)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})
