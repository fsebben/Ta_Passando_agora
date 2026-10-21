import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProviderFilter from './ProviderFilter'

const providers = [
  { id: 8, name: 'Netflix', logoPath: '/n.png' },
  { id: 119, name: 'Prime Video', logoPath: '/p.png' },
]

function renderFilter(selected, onChange = vi.fn()) {
  render(<ProviderFilter providers={providers} selected={selected} onChange={onChange} />)
  return onChange
}

test('renderiza um botão com logo por provedor', () => {
  renderFilter([])
  expect(screen.getByRole('button', { name: 'Netflix' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Netflix' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w92/n.png')
  expect(screen.getByRole('button', { name: 'Prime Video' })).toBeInTheDocument()
})

test('clicar num provedor não selecionado o adiciona', async () => {
  const onChange = renderFilter([8])
  await userEvent.click(screen.getByRole('button', { name: 'Prime Video' }))
  expect(onChange).toHaveBeenCalledWith([8, 119])
})

test('clicar num provedor selecionado o remove', async () => {
  const onChange = renderFilter([8, 119])
  await userEvent.click(screen.getByRole('button', { name: 'Netflix' }))
  expect(onChange).toHaveBeenCalledWith([119])
})

test('marca os selecionados com aria-pressed', () => {
  renderFilter([119])
  expect(screen.getByRole('button', { name: 'Prime Video' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Netflix' })).toHaveAttribute('aria-pressed', 'false')
})

test('não renderiza botão "Limpar"', () => {
  renderFilter([8])
  expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument()
})
