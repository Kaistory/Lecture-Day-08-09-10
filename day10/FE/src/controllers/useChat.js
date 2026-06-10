// CONTROLLER — chatbot RAG: gửi câu hỏi, giữ lịch sử hội thoại.
import { useCallback, useState } from 'react'
import { ChatModel } from '../models/api.js'

const WELCOME = {
  role: 'bot',
  answer: 'Xin chào! Mình là trợ lý CS + IT Helpdesk, trả lời dựa trên knowledge base đã publish (day10_kb). Hỏi mình về hoàn tiền, SLA, VPN, phép năm, access control…',
  sources: [],
  mode: 'info',
}

export function useChat() {
  const [messages, setMessages] = useState([WELCOME])
  const [sending, setSending] = useState(false)

  const send = useCallback(async (text) => {
    const q = text.trim()
    if (!q || sending) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setSending(true)
    try {
      const res = await ChatModel.send({ message: q, top_k: 4 })
      setMessages((m) => [...m, { role: 'bot', answer: res.answer, sources: res.sources || [], mode: res.mode, model: res.model, context_stale: res.context_stale || [] }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', answer: `⚠ ${e.message}`, sources: [], mode: 'error' }])
    } finally {
      setSending(false)
    }
  }, [sending])

  const reset = useCallback(() => setMessages([WELCOME]), [])

  // So sánh Before/After: inject → hỏi → rerun sạch → hỏi (BE orchestrate).
  const [comparing, setComparing] = useState(false)
  const [comparison, setComparison] = useState(null)
  const [compareErr, setCompareErr] = useState(null)

  const compare = useCallback(async (text) => {
    const q = text.trim()
    if (!q || comparing) return
    setComparing(true)
    setCompareErr(null)
    setComparison(null)
    try {
      setComparison(await ChatModel.compare({ message: q, top_k: 4 }))
    } catch (e) {
      setCompareErr(e.message)
    } finally {
      setComparing(false)
    }
  }, [comparing])

  return { messages, sending, send, reset, compare, comparing, comparison, compareErr }
}
