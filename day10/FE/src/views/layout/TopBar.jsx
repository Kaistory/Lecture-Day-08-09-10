// VIEW — top bar: run_id hiện tại + trạng thái kết nối ChromaDB + nút trigger nhanh.
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../controllers/AppContext.jsx'

export default function TopBar() {
  const { health, healthError, currentRunId } = useApp()
  const nav = useNavigate()
  const connected = !!health && !healthError

  return (
    <header className="topbar">
      <div className="pill mono keep">
        <span className="muted">Run&nbsp;ID</span>
        <b>{currentRunId || '—'}</b>
      </div>
      <div className="grow" />
      <div className="pill" title={healthError || ''}>
        <span className={`dot ${connected ? 'ok' : 'fail'}`} />
        ChromaDB {connected ? <b>{health.chroma_collection}</b> : <span style={{ color: 'var(--fail)' }}>offline</span>}
      </div>
      <button className="btn primary keep" onClick={() => nav('/pipeline')}>⚡ Trigger Pipeline</button>
    </header>
  )
}
