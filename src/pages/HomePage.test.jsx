import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { getProviders, getStreamingMovies, searchStreamingMovies } from '../api/tmdb'
import HomePage from './HomePage'

vi.mock('../api/tmdb', async (importOriginal) => ({
  ...(await importOriginal()),
  getProviders: vi.fn(),
  getStreamingMovies: vi.fn(),
  searchStreamingMovies: vi.fn(),
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
  vi.mocked(searchStreamingMovies).mockReset()
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
  expect(getStreamingMovies).toHaveBeenCalledWith({ providers: [8, 119], minRating: 0, page: 1 })
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
  expect(getStreamingMovies).toHaveBeenLastCalledWith({ providers: [8], minRating: 0, page: 1 })
  expect(currentSearch).toBe('?streaming=8')
})

test('"Limpar filtros" remove o parâmetro da URL', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
  renderHome('/?streaming=8')
  await screen.findByText('Filme 1')

  await userEvent.click(await screen.findByRole('button', { name: 'Limpar filtros' }))

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
  expect(getStreamingMovies).toHaveBeenLastCalledWith({ providers: [], minRating: 0, page: 2 })
  expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
})

test('lista vazia mostra a mensagem de nenhum filme', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([]))
  renderHome()
  expect(await screen.findByText('Nenhum filme encontrado com esses filtros')).toBeInTheDocument()
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
  expect(screen.queryByRole('button', { name: 'Netflix' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled()
})

test('página 1 com filme repetido mostra o filme uma vez só', async () => {
  vi.mocked(getStreamingMovies).mockResolvedValue({ movies: [movie(1), movie(1), movie(2)], page: 1, totalPages: 1 })
  renderHome()

  await screen.findByText('Filme 2')
  expect(movieTitles()).toEqual(['Filme 1', 'Filme 2'])
})

test('se os provedores falharem com filtro ativo na URL, "Limpar filtros" continua disponível', async () => {
  vi.mocked(getProviders).mockRejectedValue(new Error('x'))
  vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
  renderHome('/?streaming=8')
  await screen.findByText('Filme 1')

  await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

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

describe('busca e nota mínima', () => {
  test('com ?busca= chama a busca com os três filtros e restaura campo e menu', async () => {
    vi.mocked(searchStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome('/?busca=batman&streaming=8&nota=8')

    await screen.findByText('Filme 1')
    expect(searchStreamingMovies).toHaveBeenCalledWith({ query: 'batman', providers: [8], minRating: 8, page: 1 })
    expect(getStreamingMovies).not.toHaveBeenCalled()
    expect(screen.getByRole('searchbox', { name: 'Buscar filme' })).toHaveValue('batman')
    expect(screen.getByRole('option', { name: '8+' }).selected).toBe(true)
  })

  test('?busca= vazio usa a listagem normal', async () => {
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome('/?busca=%20%20')

    await screen.findByText('Filme 1')
    expect(searchStreamingMovies).not.toHaveBeenCalled()
    expect(screen.queryByText(/Resultados para/)).not.toBeInTheDocument()
  })

  test('sem busca, a nota vai para a listagem', async () => {
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome('/?nota=7')

    await screen.findByText('Filme 1')
    expect(getStreamingMovies).toHaveBeenCalledWith({ providers: [], minRating: 7, page: 1 })
  })

  test('buscar atualiza a URL e reinicia na página 1', async () => {
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
    vi.mocked(searchStreamingMovies).mockResolvedValue(pageOf([9]))
    renderHome('/?streaming=8')
    await screen.findByText('Filme 1')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar filme' }), 'duna')
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('Filme 9')).toBeInTheDocument()
    expect(new URLSearchParams(currentSearch).get('busca')).toBe('duna')
    expect(new URLSearchParams(currentSearch).get('streaming')).toBe('8')
    expect(searchStreamingMovies).toHaveBeenLastCalledWith({ query: 'duna', providers: [8], minRating: 0, page: 1 })
  })

  test('digitar sem enviar não chama a API', async () => {
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome()
    await screen.findByText('Filme 1')
    const calls = vi.mocked(getStreamingMovies).mock.calls.length

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar filme' }), 'batman')

    expect(getStreamingMovies).toHaveBeenCalledTimes(calls)
    expect(searchStreamingMovies).not.toHaveBeenCalled()
  })

  test('escolher 8+ atualiza a URL com nota=8', async () => {
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome()
    await screen.findByText('Filme 1')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Nota mínima' }), '8+')

    expect(new URLSearchParams(currentSearch).get('nota')).toBe('8')
    await waitFor(() => expect(getStreamingMovies).toHaveBeenLastCalledWith({ providers: [], minRating: 8, page: 1 }))
  })

  test('"Limpar filtros" remove busca, streaming e nota', async () => {
    vi.mocked(searchStreamingMovies).mockResolvedValue(pageOf([1]))
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([2]))
    renderHome('/?busca=batman&streaming=8&nota=7')
    await screen.findByText('Filme 1')

    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(currentSearch).toBe('')
    expect(await screen.findByText('Filme 2')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar filme' })).toHaveValue('')
  })

  test('"Limpar filtros" fica desabilitado sem filtros', async () => {
    vi.mocked(getStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome()
    await screen.findByText('Filme 1')
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled()
  })

  test('mostra "Resultados para" só com busca', async () => {
    vi.mocked(searchStreamingMovies).mockResolvedValue(pageOf([1]))
    renderHome('/?busca=batman')
    expect(await screen.findByRole('heading', { name: 'Resultados para "batman"' })).toBeInTheDocument()
  })

  test('página de busca sem filmes em streaming mostra a mensagem e "Carregar mais"', async () => {
    vi.mocked(searchStreamingMovies)
      .mockResolvedValueOnce(pageOf([], 1, 3))
      .mockResolvedValueOnce(pageOf([4], 2, 3))
    renderHome('/?busca=batman')

    expect(await screen.findByText('Nenhum filme em streaming nesta página de resultados.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByText('Filme 4')).toBeInTheDocument()
    expect(searchStreamingMovies).toHaveBeenLastCalledWith({ query: 'batman', providers: [], minRating: 0, page: 2 })
    expect(screen.queryByText('Nenhum filme em streaming nesta página de resultados.')).not.toBeInTheDocument()
  })

  test('resposta antiga de busca não sobrescreve a busca nova', async () => {
    const slow = deferred()
    vi.mocked(searchStreamingMovies)
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(pageOf([2]))
    renderHome('/?busca=batman')

    const input = screen.getByRole('searchbox', { name: 'Buscar filme' })
    await userEvent.clear(input)
    await userEvent.type(input, 'duna{Enter}')
    expect(await screen.findByText('Filme 2')).toBeInTheDocument()

    slow.resolve(pageOf([1]))
    await new Promise((r) => setTimeout(r, 0))

    expect(movieTitles()).toEqual(['Filme 2'])
  })
})
