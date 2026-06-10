// VIEW — Evaluation & Grading (Sprint 3 & 4).
import { useState } from 'react'
import { useEval } from '../../controllers/useEval.js'
import ScoreRing from '../components/ScoreRing.jsx'
import Confetti from '../components/Confetti.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import MetricCard from '../components/MetricCard.jsx'
import Modal from '../components/Modal.jsx'
import CsvTable from '../components/CsvTable.jsx'
import { ArtifactsModel } from '../../models/api.js'

// "/api/v1/artifacts/eval/after_fix_eval.csv" -> { type:'eval', filename:'after_fix_eval.csv' }
function parseReportUrl(url = '') {
  const parts = url.split('/').filter(Boolean)
  return { type: parts[parts.length - 2], filename: parts[parts.length - 1] }
}

function EvalPanel({ title, hint, data, onRun, busy, onView }) {
  const report = data?.report_url ? parseReportUrl(data.report_url) : null
  return (
    <div className="panel">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>{title}</div>
        <button className="btn" onClick={onRun} disabled={busy}>{busy ? <><span className="spinner" /> Đang chạy…</> : '▶ Capture'}</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{hint}</p>
      {data ? (
        <>
          <div className="grid cols-2" style={{ margin: '10px 0' }}>
            <MetricCard label="Passed" value={`${data.passed}/${data.total_questions}`} variant="ok" icon="✓" />
            <MetricCard label="Failed" value={data.failed} variant={data.failed > 0 ? 'fail' : ''} icon="✕"
              sub={data.failed > 0 ? 'cần xem lại' : 'sạch'} />
          </div>
          <div className="kvs">
            <span className="k">avg_contains_expected</span><span className="mono">{data.metrics?.avg_contains_expected ?? '—'}</span>
            <span className="k">avg_hits_forbidden</span><span className="mono" style={{ color: data.metrics?.avg_hits_forbidden > 0 ? 'var(--fail)' : 'var(--ok)' }}>{data.metrics?.avg_hits_forbidden ?? '—'}</span>
          </div>
          {report && (
            <div className="file-item" style={{ marginTop: 12, marginBottom: 0 }}>
              <span className="fi-ico" style={{ cursor: 'pointer' }} title="Xem nội dung" onClick={() => onView(report)}>📊</span>
              <div className="grow" style={{ cursor: 'pointer' }} onClick={() => onView(report)}>
                <div className="mono">{report.filename}</div>
                <div className="muted" style={{ fontSize: 12 }}>file report eval</div>
              </div>
              <button className="btn ghost" onClick={() => onView(report)}>👁 Xem</button>
              <a className="btn" href={ArtifactsModel.url(report.type, report.filename)} download>⬇</a>
            </div>
          )}
        </>
      ) : <p className="muted">Chưa có dữ liệu — bấm Capture.</p>}
    </div>
  )
}

export default function Evaluation() {
  const { before, after, grading, busy, error, runRetrieval, runGrading } = useEval()
  const allPassed = grading?.all_passed
  const [preview, setPreview] = useState(null) // {type, filename, content, loading, error}

  const openReport = async ({ type, filename }) => {
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
      <Confetti fire={!!allPassed} />
      {preview && (
        <Modal title={<span>📊 {preview.filename}</span>} subtitle={`artifacts/${preview.type}/${preview.filename}`}
          onClose={() => setPreview(null)}>
          {preview.loading && <div className="muted">Đang tải nội dung…</div>}
          {preview.error && <div className="err">⚠ {preview.error}</div>}
          {preview.content != null && <CsvTable text={preview.content} />}
        </Modal>
      )}
      <h1 className="page-title">Evaluation & Grading</h1>
      <p className="page-sub">So sánh Before/After (Sprint 3) và chấm 10 câu chính thức (Sprint 4). Bấm file report để xem nội dung.</p>

      {error && <div className="err" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      <div className="split" style={{ marginBottom: 18 }}>
        <EvalPanel title="① Before Fix (inject)" hint="Chạy sau khi inject corruption ở Pipeline Runner."
          data={before} busy={busy === 'before'} onRun={() => runRetrieval('before', 'eval_inject_bad.csv')} onView={openReport} />
        <EvalPanel title="② After Fix" hint="Chạy sau khi pipeline chuẩn (index sạch)."
          data={after} busy={busy === 'after'} onRun={() => runRetrieval('after', 'after_fix_eval.csv')} onView={openReport} />
      </div>

      <div className="panel">
        <div className="row between" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Grading chính thức · 10 câu</div>
          <button className="btn primary" onClick={runGrading} disabled={busy === 'grading'}>
            {busy === 'grading' ? <><span className="spinner" /> Đang chấm…</> : '▶ Run Grading'}
          </button>
        </div>

        {grading?.results?.length > 0 && (
          <div className="row" style={{ gap: 28, alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              <ScoreRing passed={parseInt(grading.total_score) || 0} total={grading.results.length} />
              <div style={{ marginTop: 10 }}><StatusBadge status={allPassed ? 'pass' : 'fail'} text={allPassed ? '🎉 ALL PASSED' : 'CÓ LỖI'} /></div>
            </div>
            <div style={{ flex: 1 }}>
              <table className="tbl">
                <thead><tr><th>Question</th><th>Top-1 doc</th><th>Contains</th><th>Forbidden</th></tr></thead>
                <tbody>
                  {grading.results.map((r) => (
                    <tr key={r.question_id}>
                      <td className="mono">{r.question_id}</td>
                      <td>{r.top1_doc_matches === false ? <span className="badge fail">✖ doc</span> : <span className="tag">match</span>}</td>
                      <td>{r.contains_expected ? <span className="badge ok">✔</span> : <span className="badge fail">✖</span>}</td>
                      <td>{r.hits_forbidden ? <span className="badge fail">⚠ dính</span> : <span className="badge ok">🛡 an toàn</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!grading?.results?.length && <p className="muted">Bấm <b>Run Grading</b> để chấm 10 câu (cần đã chạy pipeline).</p>}
      </div>
    </div>
  )
}
