import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Headers from './components/Headers/header'
import Home from './pages/Home/Home'
import Donation from './pages/donation/donation'
import Terms from './pages/Terms/Terms'
import './App.css'

export function App() {
  return (
    <>
      <BrowserRouter>
        <Headers />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/donation" element={<Donation />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
