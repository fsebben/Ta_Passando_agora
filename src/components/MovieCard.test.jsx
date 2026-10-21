import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MovieCard from './MovieCard'

const movie = { id: 1, title: 'Duna', posterPath: '/d.jpg', releaseDate: '2024-03-01', voteAverage: 7.83, voteCount: 10 }

function renderCard(props) {
  const { container } = render(
    <MemoryRouter>
      <MovieCard movie={{ ...movie, ...props }} />
    </MemoryRouter>,
  )
  return container.querySelector('img')
}

test('mostra título, ano e nota, com link para os detalhes', () => {
  const poster = renderCard()
  expect(screen.getByText('Duna')).toBeInTheDocument()
  expect(screen.getByText('2024')).toBeInTheDocument()
  expect(screen.getByText('⭐ 7.8')).toBeInTheDocument()
  expect(screen.getByRole('link')).toHaveAttribute('href', '/filme/1')
  expect(poster).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w342/d.jpg')
})

test('o pôster é decorativo, para o leitor de tela não repetir o título', () => {
  const poster = renderCard()
  expect(poster).toHaveAttribute('alt', '')
  expect(screen.getByRole('link')).toHaveAccessibleName(/^Duna 2024 ?⭐ 7.8$/)
})

test('sem pôster usa a imagem genérica', () => {
  const poster = renderCard({ posterPath: null })
  expect(poster).toHaveAttribute('src', '/no-poster.svg')
})

test('filme sem votos mostra "Sem nota"', () => {
  renderCard({ voteAverage: 0, voteCount: 0 })
  expect(screen.getByText('Sem nota')).toBeInTheDocument()
})
