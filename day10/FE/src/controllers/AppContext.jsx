// CONTROLLER — state toàn cục: health (kết nối BE/ChromaDB) + current run_id.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { HealthModel } from '../models/api.js'

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState(null)
  const [currentRunId, setCurrentRunId] = useState(null)

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await HealthModel.get())
      setHealthError(null)
    } catch (e) {
      setHealth(null)
      setHealthError(e.message)
    }
  }, [])

  useEffect(() => {
    refreshHealth()
    const t = setInterval(refreshHealth, 15000)
    return () => clearInterval(t)
  }, [refreshHealth])

  const value = { health, healthError, currentRunId, setCurrentRunId, refreshHealth }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export const useApp = () => useContext(AppCtx)
