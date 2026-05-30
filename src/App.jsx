import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Headers from './components/Headers/header'
import Home from './pages/Home/Home'
import Donation from './pages/donation/donation'
import './App.css'

export function App() {
  return (
    <>
      <BrowserRouter>
        <Headers />
        <div className="spacer"></div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/donation" element={<Donation />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
