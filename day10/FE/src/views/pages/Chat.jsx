// VIEW — Chatbot RAG: hỏi đáp + chip nguồn click xem file gốc + So sánh Before/After.
import { useEffect, useRef, useState } from 'react'
import { useChat } from '../../controllers/useChat.js'
import { useFileViewer } from '../../controllers/useFileViewer.js'
import FileViewerModal from '../components/FileViewerModal.jsx'

const SUGGESTIONS = [
  'Khách có bao nhiêu ngày để yêu cầu hoàn tiền?',
  'SLA phản hồi P1 là bao lâu?',
  'VPN cho phép tối đa mấy thiết bị?',
  'Nhân viên dưới 3 năm được bao nhiêu ngày phép?',
  'Ai phê duyệt Level 4 Admin Access?',
]

const MODE_LABEL = {
  llm: 'RAG · LLM', extractive: 'Trích dẫn', extractive_fallback: 'Fallback',
  empty: 'Trống', error: 'Lỗi', info: '',
}

// Trích số + đơn vị từ câu trả lời để highlight trong file gốc.
function keyTerms(answer = '') {
  const m = answer.match(/\d+([.\-–]\d+)?\s*(ngày làm việc|ngày phép năm|ngày|phút|giờ|lần|thiết bị)/gi) || []
  const names = (answer.match(/IT Manager|CISO|Senior Engineer|Line Manager/gi) || [])
  return [...new Set([...m, ...names])].slice(0, 5)
}

function Sources({ sources, answer, onOpen }) {
  if (!sources?.length) return null
  const uniq = []
  const seen = new Set()
  sources.forEach((s) => { if (s.doc_id && !seen.has(s.doc_id)) { seen.add(s.doc_id); uniq.push(s) } })
  return (
    <div className="src-chips">
      {uniq.map((s) => (
        <span className="src-chip click" key={s.doc_id} title={`Bấm để xem file gốc · ${s.preview}`}
          onClick={() => onOpen(s.doc_id, keyTerms(answer))}>
          📄 <b>{s.doc_id}</b>{s.effective_date ? ` · ${s.effective_date}` : ''}
        </span>
      ))}
    </div>
  )
}

function CompareCard({ side, label, color, data }) {
  const stale = data?.data_has_stale || []
  return (
    <div className="panel" style={{ margin: 0, borderLeft: `4px solid ${color}` }}>
      <div className="tag" style={{ marginBottom: 6 }}>{label} · run_id <span className="mono">{data?.run_id}</span></div>
      <div style={{ fontWeight: 600, margin: '6px 0' }}>{data?.answer}</div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        {stale.length > 0
          ? <span className="badge fail">⚠ data còn stale: {stale.join(', ')}</span>
          : <span className="badge ok">🛡 data sạch</span>}
        <span className="tag">quarantine: {data?.quarantine_records}</span>
      </div>
    </div>
  )
}

export default function Chat() {
  const { messages, sending, send, reset, compare, comparing, comparison, compareErr } = useChat()
  const viewer = useFileViewer()
  const [text, setText] = useState('')
  const [showCompare, setShowCompare] = useState(false)
  const [cmpText, setCmpText] = useState(SUGGESTIONS[0])
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, sending])

  const submit = (e) => { e?.preventDefault(); send(text); setText('') }

  return (
    <div>
      <FileViewerModal viewer={viewer} />

      <div className="row between">
        <div>
          <h1 className="page-title">Chatbot · CS + IT Helpdesk</h1>
          <p className="page-sub">RAG trên <span className="mono">day10_kb</span> — trả lời kèm nguồn (bấm chip 📄 để xem file gốc).</p>
        </div>
        <div className="row">
          <button className={`btn ${showCompare ? 'primary' : ''}`} onClick={() => setShowCompare((v) => !v)}>⚖ So sánh Before/After</button>
          <button className="btn ghost" onClick={reset}>↺ Hội thoại mới</button>
        </div>
      </div>

      {showCompare && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="section-title">So sánh cải tiến · inject lỗi → trả lời → rerun sạch → trả lời</div>
          <form className="chat-input" style={{ paddingTop: 0, marginBottom: 10 }}
            onSubmit={(e) => { e.preventDefault(); compare(cmpText) }}>
            <input value={cmpText} onChange={(e) => setCmpText(e.target.value)} placeholder="Câu hỏi để so sánh…" disabled={comparing} />
            <button className="btn primary" type="submit" disabled={comparing || !cmpText.trim()}>
              {comparing ? <><span className="spinner" /> Đang chạy 2 pipeline…</> : '⚖ So sánh'}
            </button>
          </form>
          {compareErr && <div className="err">⚠ {compareErr}</div>}
          {comparing && <p className="muted">Inject corruption → hỏi → rerun idempotent → hỏi. Mất ~15–30s (2 lần embed + 2 LLM)…</p>}
          {comparison && (
            <div className="split">
              <CompareCard label="① BEFORE (inject)" color="var(--fail)" data={comparison.before} />
              <CompareCard label="② AFTER (sạch)" color="var(--ok)" data={comparison.after} />
            </div>
          )}
          {comparison && (
            <p className="muted" style={{ marginTop: 10 }}>
              Khác biệt cốt lõi ở <b>tầng dữ liệu</b>: cleaned trước-fix còn chunk stale ("14 ngày làm việc"),
              sau rerun idempotent thì sạch. <span className="mono">run_id</span> khác nhau ⇒ truy vết được evidence.
            </p>
          )}
        </div>
      )}

      <div className="suggest">
        {SUGGESTIONS.map((s) => <span key={s} className="s" onClick={() => send(s)}>{s}</span>)}
      </div>

      <div className="chat-wrap panel">
        <div className="chat-log" ref={logRef}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="msg user">{m.text}</div>
            ) : (
              <div key={i} className={`msg bot ${m.mode === 'error' ? 'error' : ''}`}>
                {MODE_LABEL[m.mode] && <div className="meta">{MODE_LABEL[m.mode]}{m.model ? ` · ${m.model}` : ''}{m.context_stale?.length ? ` · ⚠ context còn: ${m.context_stale.join(', ')}` : ''}</div>}
                <div>{m.answer}</div>
                <Sources sources={m.sources} answer={m.answer} onOpen={viewer.openDoc} />
              </div>
            ),
          )}
          {sending && <div className="msg bot"><span className="typing"><i /><i /><i /></span></div>}
        </div>

        <form className="chat-input" onSubmit={submit}>
          <input value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Nhập câu hỏi… (vd: chính sách hoàn tiền?)" disabled={sending} />
          <button className="btn primary" type="submit" disabled={sending || !text.trim()}>➤ Gửi</button>
        </form>
      </div>
    </div>
  )
}
