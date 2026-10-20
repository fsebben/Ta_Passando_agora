import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorMessage from './ErrorMessage'

test('mostra a mensagem e "Tentar de novo" chama onRetry', async () => {
  const onRetry = vi.fn()
  render(<ErrorMessage message="Deu ruim" onRetry={onRetry} />)

  expect(screen.getByRole('alert')).toHaveTextContent('Deu ruim')
  await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('sem onRetry não mostra o botão', () => {
  render(<ErrorMessage message="Deu ruim" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
