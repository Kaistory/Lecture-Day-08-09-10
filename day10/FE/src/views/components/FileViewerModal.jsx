// VIEW — modal hiển thị nội dung cụ thể file nguồn (.txt) theo doc_id, có highlight từ khoá.
import Modal from './Modal.jsx'

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Tách content thành đoạn, bọc <mark> quanh các từ khoá highlight.
function renderHighlighted(content, highlights) {
  if (!highlights?.length) return content
  const re = new RegExp(`(${highlights.map(escapeRe).join('|')})`, 'gi')
  const parts = content.split(re)
  return parts.map((p, i) =>
    highlights.some((h) => h.toLowerCase() === p.toLowerCase())
      ? <mark key={i}>{p}</mark>
      : <span key={i}>{p}</span>,
  )
}

export default function FileViewerModal({ viewer }) {
  if (!viewer.open) return null
  const { docId, data, highlights, loading, error, close } = viewer

  return (
    <Modal
      title={<span>📄 {data?.filename || `${docId}.txt`}</span>}
      subtitle={data?.rel_path || `doc_id: ${docId}`}
      onClose={close}
    >
      {loading && <div className="muted">Đang tải nội dung file…</div>}
      {error && <div className="err">⚠ {error}</div>}
      {data && (
        <>
          <div className="file-meta">
            <span>doc_id: <b className="mono">{data.doc_id}</b></span>
            <span>{data.lines} dòng</span>
            <span>{data.size} ký tự</span>
            {highlights?.length > 0 && <span>🔆 highlight: {highlights.join(', ')}</span>}
          </div>
          <div className="filecontent">{renderHighlighted(data.content, highlights)}</div>
        </>
      )}
    </Modal>
  )
}
