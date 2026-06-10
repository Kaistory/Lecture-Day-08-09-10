// VIEW — Evaluation & Grading (Sprint 3 & 4).
import { useEval } from '../../controllers/useEval.js'
import ScoreRing from '../components/ScoreRing.jsx'
import Confetti from '../components/Confetti.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

function EvalPanel({ title, hint, data, onRun, busy, variant }) {
  return (
    <div className="panel">
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>{title}</div>
        <button className="btn" onClick={onRun} disabled={busy}>{busy ? 'Đang chạy…' : '▶ Capture'}</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{hint}</p>
      {data ? (
        <>
          <div className="row" style={{ gap: 22, margin: '10px 0' }}>
            <div className="metric ok" style={{ flex: 1 }}>
              <div className="label">Passed</div><div className="value">{data.passed}/{data.total_questions}</div>
            </div>
            <div className={`metric ${data.failed > 0 ? 'warn' : ''}`} style={{ flex: 1 }}>
              <div className="label">Failed</div><div className="value">{data.failed}</div>
            </div>
          </div>
          <div className="kvs">
            <span className="k">avg_contains_expected</span><span className="mono">{data.metrics.avg_contains_expected}</span>
            <span className="k">avg_hits_forbidden</span><span className="mono" style={{ color: data.metrics.avg_hits_forbidden > 0 ? 'var(--fail)' : 'var(--ok)' }}>{data.metrics.avg_hits_forbidden}</span>
          </div>
        </>
      ) : <p className="muted">Chưa có dữ liệu — bấm Capture.</p>}
    </div>
  )
}

export default function Evaluation() {
  const { before, after, grading, busy, error, runRetrieval, runGrading } = useEval()
  const allPassed = grading?.all_passed

  return (
    <div>
      <Confetti fire={!!allPassed} />
      <h1 className="page-title">Evaluation & Grading</h1>
      <p className="page-sub">So sánh Before/After (Sprint 3) và chấm 10 câu chính thức (Sprint 4).</p>

      {error && <div className="err" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      <div className="split" style={{ marginBottom: 18 }}>
        <EvalPanel title="① Before Fix (inject)" hint="Chạy sau khi inject corruption ở Pipeline Runner."
          data={before} busy={busy === 'before'} onRun={() => runRetrieval('before', 'eval_inject_bad.csv')} />
        <EvalPanel title="② After Fix" hint="Chạy sau khi pipeline chuẩn (index sạch)."
          data={after} busy={busy === 'after'} onRun={() => runRetrieval('after', 'after_fix_eval.csv')} />
      </div>

      <div className="panel">
        <div className="row between" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Grading chính thức · 10 câu</div>
          <button className="btn primary" onClick={runGrading} disabled={busy === 'grading'}>
            {busy === 'grading' ? <><span className="spinner" /> Đang chấm…</> : '▶ Run Grading'}
          </button>
        </div>

        {grading && (
          <div className="row" style={{ gap: 28, alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center' }}>
              <ScoreRing passed={parseInt(grading.total_score)} total={grading.results.length} />
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
        {!grading && <p className="muted">Bấm <b>Run Grading</b> để chấm 10 câu (cần đã chạy pipeline).</p>}
      </div>
    </div>
  )
}
