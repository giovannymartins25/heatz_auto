import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { HomeScreen } from '@/screens/HomeScreen'
import { SimulatorScreen } from '@/screens/SimulatorScreen'
import { PwaUpdatePrompt } from '@/components/ui'
import { usePwaUpdate } from '@/hooks/usePwaUpdate'
import { initImmersiveFullscreenLifecycle } from '@/utils/fullscreen'

export function App() {
  const { needRefresh, updateServiceWorker, appVersion, buildId } = usePwaUpdate()

  useEffect(() => {
    return initImmersiveFullscreenLifecycle({ attemptOnInit: true })
  }, [])

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

