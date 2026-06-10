// CONTROLLER — điều phối chạy pipeline + mô phỏng tiến trình stepper (real-time feedback).
import { useCallback, useEffect, useRef, useState } from 'react'
import { PipelineModel } from '../models/api.js'
import { ApiError } from '../models/apiClient.js'
import { useApp } from './AppContext.jsx'

const STEPS = ['ingestion', 'cleaning', 'validation', 'embedding']

// map phases (server) -> trạng thái hiển thị node
function phasesToSteps(phases) {
  return STEPS.map((key) => ({ key, status: phases?.[key] || 'pending' }))
}

export function usePipeline() {
  const { setCurrentRunId, refreshHealth } = useApp()
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState(phasesToSteps(null))
  const [result, setResult] = useState(null) // payload success
  const [halt, setHalt] = useState(null) // payload 422
  const [error, setError] = useState(null)
  const timers = useRef([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Dọn timer khi unmount (tránh setState trên component đã rời trang).
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Hiển thị spinner tuần tự để người dùng thấy hệ thống đang chạy (BE trả 1 lần khi xong).
  const startProgressAnimation = useCallback(() => {
    setSteps(STEPS.map((key, i) => ({ key, status: i === 0 ? 'running' : 'pending' })))
    STEPS.forEach((_, i) => {
      const t = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => {
            if (idx < i) return { ...s, status: s.status === 'running' ? 'passed' : s.status }
            if (idx === i) return { ...s, status: 'running' }
            return s
          }),
        )
      }, i * 650)
      timers.current.push(t)
    })
  }, [])

  const run = useCallback(
    async ({ skip_validate = false, no_refund_fix = false, run_id = null } = {}) => {
      clearTimers()
      setRunning(true)
      setResult(null)
      setHalt(null)
      setError(null)
      startProgressAnimation()
      try {
        const res = await PipelineModel.run({ skip_validate, no_refund_fix, run_id })
        clearTimers()
        setSteps(phasesToSteps(res.phases))
        setResult(res)
        setCurrentRunId(res.run_id)
        refreshHealth()
        return res
      } catch (e) {
        clearTimers()
        if (e instanceof ApiError && e.status === 422 && e.body) {
          setSteps(phasesToSteps(e.body.phases))
          setHalt(e.body)
          if (e.body.run_id) setCurrentRunId(e.body.run_id)
        } else {
          setSteps(phasesToSteps(null))
          setError(e.message)
        }
        return null
      } finally {
        setRunning(false)
      }
    },
    [startProgressAnimation, setCurrentRunId, refreshHealth],
  )

  return { running, steps, result, halt, error, run, STEPS }
}
