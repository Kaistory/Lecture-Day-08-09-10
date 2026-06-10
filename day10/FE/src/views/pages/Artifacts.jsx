// VIEW — Artifacts file explorer: preview nội dung trong modal + tải về.
import { useEffect, useState } from 'react'
import { useArtifacts } from '../../controllers/useArtifacts.js'
import { ArtifactsModel, API_BASE } from '../../models/api.js'
import Modal from '../components/Modal.jsx'

const ICON = { logs: '📄', manifests: '🧾', quarantine: '🚧', cleaned: '✨', eval: '📊' }
const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const fmtTime = (s) => { try { return new Date(s * 1000).toLocaleString('vi-VN') } catch { return '' } }

export default function Artifacts() {
  const { tree, loading, error, load, urlOf } = useArtifacts()
  const [active, setActive] = useState('eval')
  const [preview, setPreview] = useState(null) // {type, filename, content, loading, error}
  useEffect(() => { load() }, [load])

  const types = tree ? Object.keys(tree) : []
  const files = tree?.[active] || []

  const openPreview = async (type, filename) => {
    setPreview({ type, filename, loading: true })
    try {
      const content = await ArtifactsModel.fetchText(type, filename)
      setPreview({ type, filename, content })
    } catch (e) {
      setPreview({ type, filename, error: e.message })
    }
  }

  return (
    <div>
      {preview && (
        <Modal title={<span>{ICON[preview.type] || '📄'} {preview.filename}</span>}
          subtitle={`artifacts/${preview.type}/${preview.filename}`} onClose={() => setPreview(null)}
          actions={<a className="btn ghost" href={urlOf(preview.type, preview.filename)} download>⬇ Tải</a>}>
          {preview.loading && <div className="muted">Đang tải nội dung…</div>}
          {preview.error && <div className="err">⚠ {preview.error}</div>}
          {preview.content != null && <div className="filecontent">{preview.content}</div>}
        </Modal>
      )}

      <div className="row between">
        <div>
          <h1 className="page-title">Artifacts</h1>
          <p className="page-sub">Bấm 📄 để xem nội dung, hoặc tải file bằng chứng — lấy từ <span className="mono">{API_BASE}</span>.</p>
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
        {loading && !tree && (
          <div className="grid" style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 56 }} />)}
          </div>
        )}
        {tree && files.length === 0 && <p className="muted">Thư mục <b>{active}</b> trống. Chạy pipeline/eval để sinh artifact.</p>}
        {files.map((f) => (
          <div className="file-item" key={f.filename}>
            <span className="fi-ico" style={{ cursor: 'pointer' }} title="Xem nội dung"
              onClick={() => openPreview(active, f.filename)}>{ICON[active] || '📄'}</span>
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => openPreview(active, f.filename)}>
              <div className="mono">{f.filename}</div>
              <div className="muted" style={{ fontSize: 12 }}>{fmtSize(f.size)}{f.modified ? ` · ${fmtTime(f.modified)}` : ''}</div>
            </div>
            <button className="btn ghost" onClick={() => openPreview(active, f.filename)}>👁 Xem</button>
            <a className="btn primary" href={urlOf(active, f.filename)} download>⬇ Tải</a>
          </div>
        ))}
      </div>
    </div>
  )
}
