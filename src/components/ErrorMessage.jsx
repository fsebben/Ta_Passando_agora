function ErrorMessage({ message, onRetry }) {
  return (
    <div role="alert" className="error-message">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}

export default ErrorMessage
