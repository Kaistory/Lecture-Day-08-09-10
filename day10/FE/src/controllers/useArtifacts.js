// CONTROLLER — Artifacts file explorer.
import { useCallback, useState } from 'react'
import { ArtifactsModel } from '../models/api.js'

export function useArtifacts() {
  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTree(await ArtifactsModel.list())
    } catch (e) {
      setError(e.message)
      setTree(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { tree, loading, error, load, urlOf: ArtifactsModel.url }
}
