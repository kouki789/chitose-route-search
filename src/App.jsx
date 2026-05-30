import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Headers from './components/Headers/header'
import Donation from './pages/donation/donation'
import './App.css'

export function App() {
  return (
    <>
      <BrowserRouter>
        <Headers />
        <Routes>
          <Route path="/donation" element={<Donation />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
