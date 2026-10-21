import { useEffect, useState } from 'react'

// A busca só roda ao enviar (Enter ou botão): cada busca faz várias chamadas à API
function SearchBar({ value, onSearch }) {
  const [text, setText] = useState(value)

  // Acompanha a URL quando ela muda por fora (ex.: "Limpar filtros" ou botão voltar)
  useEffect(() => {
    setText(value)
  }, [value])

  function handleSubmit(event) {
    event.preventDefault()
    onSearch(text.trim())
  }

  return (
    <form role="search" className="search-bar" onSubmit={handleSubmit}>
      <input
        type="search"
        aria-label="Buscar filme"
        placeholder="Buscar filme..."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit">Buscar</button>
    </form>
  )
}

export default SearchBar
