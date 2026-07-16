import { Routes, Route } from 'react-router-dom'
import { HomeScreen } from '@/screens/HomeScreen'
import { SimulatorScreen } from '@/screens/SimulatorScreen'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/simulator/:vehicleId" element={<SimulatorScreen />} />
    </Routes>
  )
}
