import { RATING_OPTIONS } from '../utils/movies'

function RatingFilter({ value, onChange }) {
  return (
    <div className="rating-filter">
      <label htmlFor="rating-filter">Nota mínima</label>
      <select id="rating-filter" value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {RATING_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default RatingFilter
