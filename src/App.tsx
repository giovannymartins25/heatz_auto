import { Routes, Route } from 'react-router-dom'
import { HomeScreen } from '@/screens/HomeScreen'
import { SimulatorScreen } from '@/screens/SimulatorScreen'
import { PwaUpdatePrompt } from '@/components/ui'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'

export function App() {
  const { needRefresh, updateServiceWorker, appVersion, buildId } = usePwaUpdate()

  return (
    <>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/simulator/:vehicleId" element={<SimulatorScreen />} />
      </Routes>
      <PwaUpdatePrompt
        needRefresh={needRefresh}
        onUpdate={updateServiceWorker}
        version={appVersion}
        buildId={buildId}
      />
    </>
  )
}

