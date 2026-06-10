// CONTROLLER — Evaluation: retrieval (before/after) + grading 10 câu.
import { useCallback, useState } from 'react'
import { EvalModel } from '../models/api.js'

export function useEval() {
  const [before, setBefore] = useState(null) // retrieval khi inject (xấu)
  const [after, setAfter] = useState(null) // retrieval sau fix (tốt)
  const [grading, setGrading] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)

  const runRetrieval = useCallback(async (slot, filename) => {
    setBusy(slot)
    setError(null)
    try {
      const r = await EvalModel.retrieval({ top_k: 3, output_filename: filename })
      if (slot === 'before') setBefore(r)
      else setAfter(r)
      return r
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setBusy('')
    }
  }, [])

  const runGrading = useCallback(async () => {
    setBusy('grading')
    setError(null)
    try {
      const r = await EvalModel.grading({ top_k: 5 })
      setGrading(r)
      return r
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setBusy('')
    }
  }, [])

  return { before, after, grading, busy, error, runRetrieval, runGrading }
}
