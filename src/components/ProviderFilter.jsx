import { imageUrl } from '../api/tmdb'

// Componente controlado: quem usa guarda a seleção e recebe as mudanças por onChange
function ProviderFilter({ providers, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div className="provider-filter" role="group" aria-label="Serviços de streaming">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          className="provider-filter__item"
          aria-pressed={selected.includes(provider.id)}
          title={provider.name}
          onClick={() => toggle(provider.id)}
        >
          <img src={imageUrl(provider.logoPath, 'w92')} alt={provider.name} />
        </button>
      ))}
    </div>
  )
}

export default ProviderFilter
