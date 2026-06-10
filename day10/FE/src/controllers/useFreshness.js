// CONTROLLER — Observability: freshness + đọc quarantine CSV để hiển thị lý do loại.
import { useCallback, useState } from 'react'
import { MonitoringModel, ArtifactsModel } from '../models/api.js'

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return { headers: [], rows: [] }
  const split = (l) => l.split(',')
  const headers = split(lines[0])
  const rows = lines.slice(1).map((l) => {
    const cells = split(l)
    const o = {}
    headers.forEach((h, i) => (o[h] = cells[i] ?? ''))
    return o
  })
  return { headers, rows }
}

export function useFreshness() {
  const [data, setData] = useState(null)
  const [quarantine, setQuarantine] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async (runId = null) => {
    setLoading(true)
    setError(null)
    try {
      const fresh = await MonitoringModel.freshness(runId)
      setData(fresh)
      // suy ra tên quarantine từ run_id (cùng convention với manifest)
      if (fresh?.run_id) {
        try {
          const csv = await ArtifactsModel.fetchJson('quarantine', `quarantine_${fresh.run_id}.csv`)
          setQuarantine(parseCsv(typeof csv === 'string' ? csv : ''))
        } catch {
          setQuarantine(null)
        }
      }
      return fresh
    } catch (e) {
      setError(e.message)
      setData(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, quarantine, loading, error, load }
}
