import { Link, Route, Routes } from 'react-router-dom'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import MovieDetailsPage from './pages/MovieDetailsPage'

// O roteador (BrowserRouter) fica em main.jsx para que os testes possam usar o MemoryRouter
function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="header__title">
          Catálogo de Streaming
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/filme/:id" element={<MovieDetailsPage />} />
      </Routes>
      <Footer />
    </div>
  )
}

export default App
