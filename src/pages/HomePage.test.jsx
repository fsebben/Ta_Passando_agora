import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { getProviders, getStreamingMovies } from '../api/tmdb'
import HomePage from './HomePage'

vi.mock('../api/tmdb', async (importOriginal) => ({
  ...(await importOriginal()),
  getProviders: vi.fn(),
  getStreamingMovies: vi.fn(),
}))

const providers = [
  { id: 8, name: 'Netflix', logoPath: '/n.png' },
  { id: 119, name: 'Prime Video', logoPath: '/p.png' },
]

function movie(id) {
  return { id, title: `Filme ${id}`, posterPath: null, releaseDate: '2024-01-01', voteAverage: 7, voteCount: 5 }
}

function pageOf(ids, page = 1, totalPages = 1) {
  return { movies: ids.map(movie), page, totalPages }
}

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let currentSearch
function LocationSpy() {
  currentSearch = useLocation().search
  return null
}

function renderHome(entry = '/') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <HomePage />
              <LocationSpy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function movieTitles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
}

beforeEach(() => {
  vi.mocked(getProviders).mockReset().mockResolvedValue(providers)
  vi.mocked(getStreamingMovies).mockReset()
})

test('mostra Loading e depois a grade', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1, 2]))
  renderHome()

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(await screen.findByText('Filme 1')).toBeInTheDocument()
  expect(screen.getByText('Filme 2')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('lê o filtro da URL', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
  renderHome('/?streaming=8,119')

  await screen.findByText('Filme 1')
  expect(getStreamingMovies).toHaveBeenCalledWith({ providers: [8, 119], page: 1 })
  expect(await screen.findByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'true')
})

test('trocar o filtro reinicia na página 1, substitui a lista e atualiza a URL', async () => {
  vi.mocked(getStreamingMovies)
    .mockResolvedValueOnce(pageOf([1, 2]))
    .mockResolvedValueOnce(pageOf([3]))
  renderHome()
  await screen.findByText('Filme 1')

  await userEvent.click(await screen.findByRole('button', { name: 'Netflix' }))

  expect(await screen.findByText('Filme 3')).toBeInTheDocument()
  expect(movieTitles()).toEqual(['Filme 3'])
  expect(getStreamingMovies).toHaveBeenLastCalledWith({ providers: [8], page: 1 })
  expect(currentSearch).toBe('?streaming=8')
})

test('"Limpar" remove o parâmetro da URL', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
  renderHome('/?streaming=8')
  await screen.findByText('Filme 1')

  await userEvent.click(await screen.findByRole('button', { name: 'Limpar' }))

  expect(currentSearch).toBe('')
})

test('Carregar mais acrescenta a página 2 sem repetir filmes e some na última página', async () => {
  vi.mocked(getStreamingMovies)
    .mockResolvedValueOnce(pageOf([1, 2], 1, 2))
    .mockResolvedValueOnce(pageOf([2, 3], 2, 2))
  renderHome()
  await screen.findByText('Filme 1')

  await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

  expect(await screen.findByText('Filme 3')).toBeInTheDocument()
  expect(movieTitles()).toEqual(['Filme 1', 'Filme 2', 'Filme 3'])
  expect(getStreamingMovies).toHaveBeenLastCalledWith({ providers: [], page: 2 })
  expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
})

test('lista vazia mostra a mensagem de nenhum filme', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([]))
  renderHome()
  expect(await screen.findByText('Nenhum filme encontrado para esses serviços')).toBeInTheDocument()
})

test('erro na carga inicial mostra o erro e "Tentar de novo" refaz a chamada', async () => {
  vi.mocked(getStreamingMovies)
    .mockRejectedValueOnce(new Error('Não foi possível carregar os dados. Tente novamente.'))
    .mockResolvedValueOnce(pageOf([1]))
  renderHome()

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Não foi possível carregar os dados. Tente novamente.')
  await userEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }))

  expect(await screen.findByText('Filme 1')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('erro no Carregar mais mantém os filmes e mostra o erro', async () => {
  vi.mocked(getStreamingMovies)
    .mockResolvedValueOnce(pageOf([1], 1, 3))
    .mockRejectedValueOnce(new Error('Falhou'))
  renderHome()
  await screen.findByText('Filme 1')

  await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Falhou')
  expect(screen.getByText('Filme 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument()
})

test('resposta antiga não sobrescreve o filtro novo', async () => {
  const slow = deferred()
  vi.mocked(getStreamingMovies)
    .mockReturnValueOnce(slow.promise)
    .mockResolvedValueOnce(pageOf([2]))
  renderHome()

  await userEvent.click(await screen.findByRole('button', { name: 'Netflix' }))
  expect(await screen.findByText('Filme 2')).toBeInTheDocument()

  slow.resolve(pageOf([1]))
  await new Promise((r) => setTimeout(r, 0))

  expect(movieTitles()).toEqual(['Filme 2'])
})

test('se os provedores falharem, a grade continua funcionando', async () => {
  vi.mocked(getProviders).mockRejectedValue(new Error('x'))
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
  renderHome()

  expect(await screen.findByText('Filme 1')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument()
})

test('página 1 com filme repetido mostra o filme uma vez só', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue({ movies: [movie(1), movie(1), movie(2)], page: 1, totalPages: 1 })
  renderHome()

  await screen.findByText('Filme 2')
  expect(movieTitles()).toEqual(['Filme 1', 'Filme 2'])
})

test('se os provedores falharem com filtro ativo na URL, "Limpar" continua disponível', async () => {
  vi.mocked(getProviders).mockRejectedValue(new Error('x'))
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
  renderHome('/?streaming=8')
  await screen.findByText('Filme 1')

  await userEvent.click(screen.getByRole('button', { name: 'Limpar' }))

  expect(currentSearch).toBe('')
})

test('trocar o filtro durante o Carregar mais não deixa o carregamento preso', async () => {
  const slowPage2 = deferred()
  vi.mocked(getStreamingMovies)
    .mockResolvedValueOnce(pageOf([1], 1, 3))
    .mockReturnValueOnce(slowPage2.promise)
    .mockResolvedValueOnce(pageOf([5], 1, 3))
  renderHome()
  await screen.findByText('Filme 1')

  await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
  await userEvent.click(screen.getByRole('button', { name: 'Netflix' }))

  expect(await screen.findByText('Filme 5')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  slowPage2.resolve(pageOf([2], 2, 3))
  await new Promise((r) => setTimeout(r, 0))
  expect(movieTitles()).toEqual(['Filme 5'])
  expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument()
})
