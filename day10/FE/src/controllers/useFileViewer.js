// CONTROLLER — quản lý modal xem file nguồn theo doc_id.
import { useCallback, useState } from 'react'
import { DocsModel } from '../models/api.js'

export function useFileViewer() {
  const [open, setOpen] = useState(false)
  const [docId, setDocId] = useState(null)
  const [highlights, setHighlights] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const openDoc = useCallback(async (doc_id, hl = []) => {
    setOpen(true)
    setDocId(doc_id)
    setHighlights(hl.filter(Boolean))
    setData(null)
    setError(null)
    setLoading(true)
    try {
      setData(await DocsModel.get(doc_id))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { open, docId, highlights, data, loading, error, openDoc, close }
}
