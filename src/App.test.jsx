import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getMovieDetails, getProviders, getStreamingMovies } from './api/tmdb'
import App from './App'

vi.mock('./api/tmdb', async (importOriginal) => ({
  ...(await importOriginal()),
  getProviders: vi.fn(),
  getStreamingMovies: vi.fn(),
  getMovieDetails: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getProviders).mockResolvedValue([])
  vi.mocked(getStreamingMovies).mockResolvedValue({ movies: [], page: 1, totalPages: 1 })
  vi.mocked(getMovieDetails).mockResolvedValue({
    id: 1,
    title: 'Duna',
    posterPath: null,
    releaseDate: '2021-10-21',
    runtime: 155,
    genres: [],
    voteAverage: 7.8,
    voteCount: 10,
    overview: '',
    streamingProviders: [],
  })
})

function renderApp(entry) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>,
  )
}

test('mostra o cabeçalho com link para a tela inicial', async () => {
  renderApp('/')
  expect(screen.getByRole('link', { name: 'Tá passando agora' })).toHaveAttribute('href', '/')
  expect(await screen.findByText('Nenhum filme encontrado para esses serviços')).toBeInTheDocument()
})

test('mostra os créditos do TMDB e do JustWatch no rodapé', () => {
  renderApp('/')
  const footer = screen.getByRole('contentinfo')
  expect(footer).toHaveTextContent('Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB')
  expect(footer).toHaveTextContent('Dados de streaming fornecidos por JustWatch')
})

test('a rota /filme/:id mostra a página de detalhes', async () => {
  renderApp('/filme/1')
  expect(await screen.findByRole('heading', { level: 1, name: 'Duna' })).toBeInTheDocument()
  expect(getMovieDetails).toHaveBeenCalledWith('1')
})
