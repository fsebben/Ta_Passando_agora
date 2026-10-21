import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from './SearchBar'

function input() {
  return screen.getByRole('searchbox', { name: 'Buscar filme' })
}

test('clicar em "Buscar" envia o texto sem espaços nas pontas', async () => {
  const onSearch = vi.fn()
  render(<SearchBar value="" onSearch={onSearch} />)

  await userEvent.type(input(), '  batman  ')
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

  expect(onSearch).toHaveBeenCalledWith('batman')
})

test('apertar Enter também envia', async () => {
  const onSearch = vi.fn()
  render(<SearchBar value="" onSearch={onSearch} />)

  await userEvent.type(input(), 'duna{Enter}')

  expect(onSearch).toHaveBeenCalledWith('duna')
})

test('enviar só espaços envia texto vazio', async () => {
  const onSearch = vi.fn()
  render(<SearchBar value="" onSearch={onSearch} />)

  await userEvent.type(input(), '   {Enter}')

  expect(onSearch).toHaveBeenCalledWith('')
})

test('digitar sem enviar não chama onSearch', async () => {
  const onSearch = vi.fn()
  render(<SearchBar value="" onSearch={onSearch} />)

  await userEvent.type(input(), 'batman')

  expect(onSearch).not.toHaveBeenCalled()
})

test('o campo acompanha mudanças de value', () => {
  const { rerender } = render(<SearchBar value="batman" onSearch={vi.fn()} />)
  expect(input()).toHaveValue('batman')

  rerender(<SearchBar value="duna" onSearch={vi.fn()} />)
  expect(input()).toHaveValue('duna')
})
