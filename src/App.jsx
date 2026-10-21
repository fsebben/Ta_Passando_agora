import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import MovieDetailsPage from './pages/MovieDetailsPage'

// O roteador (BrowserRouter) fica em main.jsx para que os testes possam usar o MemoryRouter
function App() {
  // Na tela inicial o nome do app é o título grande da página; nas outras, só um link discreto
  const isHome = useLocation().pathname === '/'
  const brand = (
    <Link to="/" className="header__title">
      Tá passando <span>agora</span>
    </Link>
  )

  return (
    <div className="app">
      <header className={isHome ? 'header header--home' : 'header'}>
        {isHome ? <h1>{brand}</h1> : brand}
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
