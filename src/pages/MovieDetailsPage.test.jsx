import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getMovieDetails } from '../api/tmdb'
import MovieDetailsPage from './MovieDetailsPage'

vi.mock('../api/tmdb', async (importOriginal) => ({
  ...(await importOriginal()),
  getMovieDetails: vi.fn(),
}))

const details = {
  id: 1,
  title: 'Duna',
  posterPath: '/d.jpg',
  releaseDate: '2021-10-21',
  runtime: 112,
  genres: ['Ficção científica', 'Aventura'],
  voteAverage: 7.83,
  voteCount: 100,
  overview: 'Paul Atreides viaja para Arrakis.',
  streamingProviders: [{ id: 1899, name: 'Max', logoPath: '/m.png' }],
}

function renderDetails(entry = '/filme/1') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<p>Tela inicial</p>} />
        <Route path="/filme/:id" element={<MovieDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getMovieDetails).mockReset()
})

test('mostra título, ano, duração, gêneros, nota e sinopse', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue(details)
  renderDetails()

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: 'Duna' })).toBeInTheDocument()
  expect(getMovieDetails).toHaveBeenCalledWith('1')
  expect(screen.getByText('2021')).toBeInTheDocument()
  expect(screen.getByText('1h 52min')).toBeInTheDocument()
  expect(screen.getByText('Ficção científica, Aventura')).toBeInTheDocument()
  expect(screen.getByText('⭐ 7.8')).toBeInTheDocument()
  expect(screen.getByText('Paul Atreides viaja para Arrakis.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Duna' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w500/d.jpg')
})

test('sinopse vazia mostra "Sinopse não disponível"', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue({ ...details, overview: '' })
  renderDetails()
  expect(await screen.findByText('Sinopse não disponível')).toBeInTheDocument()
})

test('"Onde assistir" lista os serviços', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue(details)
  renderDetails()

  const section = await screen.findByRole('region', { name: 'Onde assistir' })
  expect(within(section).getByText('Max')).toBeInTheDocument()
  expect(section.querySelector('img')).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w92/m.png')
})

test('sem serviços mostra que não está disponível no Brasil', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue({ ...details, streamingProviders: [] })
  renderDetails()
  expect(await screen.findByText('Não disponível em streaming por assinatura no Brasil')).toBeInTheDocument()
})

test('filme não encontrado mostra link para a tela inicial e não mostra "Tentar de novo"', async () => {
  vi.mocked(getMovieDetails).mockRejectedValue(new Error('Filme não encontrado.'))
  renderDetails('/filme/abc')

  expect(await screen.findByRole('alert')).toHaveTextContent('Filme não encontrado.')
  expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Ir para a tela inicial' }))
  expect(screen.getByText('Tela inicial')).toBeInTheDocument()
})

test('outro erro mostra "Tentar de novo", que refaz a chamada', async () => {
  vi.mocked(getMovieDetails)
    .mockRejectedValueOnce(new Error('Não foi possível carregar os dados. Tente novamente.'))
    .mockResolvedValueOnce(details)
  renderDetails()

  await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Duna' })).toBeInTheDocument()
  expect(getMovieDetails).toHaveBeenCalledTimes(2)
})

test('"← Voltar" sem histórico vai para a tela inicial', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue(details)
  renderDetails()

  await userEvent.click(await screen.findByRole('button', { name: '← Voltar' }))

  expect(screen.getByText('Tela inicial')).toBeInTheDocument()
})

test('"← Voltar" com histórico volta para a página anterior', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue(details)
  render(
    <MemoryRouter initialEntries={['/?streaming=8', '/filme/1']} initialIndex={1}>
      <Routes>
        <Route path="/" element={<p>Tela inicial</p>} />
        <Route path="/filme/:id" element={<MovieDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  )

  await userEvent.click(await screen.findByRole('button', { name: '← Voltar' }))

  expect(screen.getByText('Tela inicial')).toBeInTheDocument()
})

test('id que não é número mostra "Filme não encontrado." sem chamar a API', async () => {
  renderDetails('/filme/abc')

  expect(await screen.findByRole('alert')).toHaveTextContent('Filme não encontrado.')
  expect(getMovieDetails).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Ir para a tela inicial' })).toBeInTheDocument()
})

test('"← Voltar" aparece enquanto carrega', () => {
  vi.mocked(getMovieDetails).mockReturnValue(new Promise(() => {}))
  renderDetails()

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '← Voltar' })).toBeInTheDocument()
})

test('logos de "Onde assistir" são decorativos (o nome já aparece ao lado)', async () => {
  vi.mocked(getMovieDetails).mockResolvedValue(details)
  renderDetails()

  const section = await screen.findByRole('region', { name: 'Onde assistir' })
  expect(within(section).getByText('Max')).toBeInTheDocument()
  expect(within(section).queryByRole('img')).not.toBeInTheDocument()
  expect(section.querySelector('img')).toHaveAttribute('alt', '')
})
