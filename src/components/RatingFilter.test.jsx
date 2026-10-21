import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RatingFilter from './RatingFilter'

function select() {
  return screen.getByRole('combobox', { name: 'Nota mínima' })
}

test('mostra as 5 opções com o valor atual selecionado', () => {
  render(<RatingFilter value={7} onChange={vi.fn()} />)

  const labels = screen.getAllByRole('option').map((o) => o.textContent)
  expect(labels).toEqual(['Qualquer nota', '6+', '7+', '8+', '9+'])
  expect(screen.getByRole('option', { name: '7+' }).selected).toBe(true)
})

test('escolher "8+" chama onChange com o número 8', async () => {
  const onChange = vi.fn()
  render(<RatingFilter value={0} onChange={onChange} />)

  await userEvent.selectOptions(select(), '8+')

  expect(onChange).toHaveBeenCalledWith(8)
})
