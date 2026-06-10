// VIEW — Artifacts file explorer (tải log/quarantine/manifest/eval).
import { useEffect, useState } from 'react'
import { useArtifacts } from '../../controllers/useArtifacts.js'
import { API_BASE } from '../../models/api.js'

const ICON = { logs: '📄', manifests: '🧾', quarantine: '🚧', cleaned: '✨', eval: '📊' }
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

export default function Artifacts() {
  const { tree, loading, error, load, urlOf } = useArtifacts()
  const [active, setActive] = useState('eval')
  useEffect(() => { load() }, [load])

  const types = tree ? Object.keys(tree) : []
  const files = tree?.[active] || []

  return (
    <div>
      <div className="row between">
        <div>
          <h1 className="page-title">Artifacts</h1>
          <p className="page-sub">Tải file bằng chứng để nộp bài — lấy trực tiếp từ <span className="mono">{API_BASE}</span>.</p>
        </div>
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Đang tải…' : '↻ Refresh'}</button>
      </div>

      {error && <div className="err">⚠ {error}</div>}

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {types.map((t) => (
          <button key={t} className={`btn ${active === t ? 'primary' : 'ghost'}`} onClick={() => setActive(t)}>
            {ICON[t] || '📁'} {t} <span className="tag">{tree[t].length}</span>
          </button>
        ))}
      </div>

      <div className="panel">
        {files.length === 0 && <p className="muted">Thư mục <b>{active}</b> trống. Chạy pipeline/eval để sinh artifact.</p>}
        {files.map((f) => (
          <div className="file-item" key={f.filename}>
            <span className="fi-ico">{ICON[active] || '📄'}</span>
            <div className="grow">
              <div className="mono">{f.filename}</div>
              <div className="muted" style={{ fontSize: 12 }}>{fmtSize(f.size)}</div>
            </div>
            <a className="btn" href={urlOf(active, f.filename)} target="_blank" rel="noreferrer">↗ Mở</a>
            <a className="btn primary" href={urlOf(active, f.filename)} download>⬇ Tải</a>
          </div>
        ))}
      </div>
    </div>
  )
}
