// VIEW — Pipeline Runner (Sprint 1 & 2, + flags Sprint 3).
import { useState } from 'react'
import { usePipeline } from '../../controllers/usePipeline.js'
import Stepper from '../components/Stepper.jsx'
import Toggle from '../components/Toggle.jsx'
import MetricCard from '../components/MetricCard.jsx'
import Terminal, { expectationsToLines } from '../components/Terminal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function PipelineRunner() {
  const { running, steps, result, halt, error, run } = usePipeline()
  const [skipValidate, setSkipValidate] = useState(false)
  const [noRefundFix, setNoRefundFix] = useState(false)

  const payload = result || halt
  const metrics = payload?.metrics
  const expectations = (result?.expectations || halt?.expectations) ?? []
  const isHalt = !!halt

  return (
    <div>
      <h1 className="page-title">Pipeline Runner</h1>
      <p className="page-sub">Kích hoạt Ingest → Clean → Validate → Embed. Bật cờ để inject lỗi (Sprint 3).</p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div className="row" style={{ gap: 28 }}>
            <Toggle checked={skipValidate} onChange={setSkipValidate} label="Skip Validate" hint="Vẫn embed dù halt" />
            <Toggle checked={noRefundFix} onChange={setNoRefundFix} label="No Refund Fix" hint="Inject stale 14 ngày" />
          </div>
          <button className="btn primary lg" disabled={running}
            onClick={() => run({ skip_validate: skipValidate, no_refund_fix: noRefundFix })}>
            {running ? <><span className="spinner" /> Running…</> : '▶ Run Pipeline'}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="section-title">Tiến trình</div>
        <Stepper steps={steps} />
        {payload && (
          <div className="row" style={{ marginTop: 14 }}>
            <StatusBadge status={payload.status} />
            <span className="muted mono">run_id: {payload.run_id}</span>
            {result?.freshness && <span className="tag">freshness: {result.freshness.status}</span>}
          </div>
        )}
      </div>

      {error && <div className="err" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      {metrics && (
        <div className="grid cols-3" style={{ marginBottom: 16 }}>
          <MetricCard label="Raw Records" value={metrics.raw_records} icon="📥" sub="Dòng thô đã ingest" />
          <MetricCard label="Cleaned Records" value={metrics.cleaned_records} variant="ok" icon="✨"
            sub={metrics.raw_records ? `${Math.round((metrics.cleaned_records / metrics.raw_records) * 100)}% giữ lại` : 'Đã làm sạch'} />
          <MetricCard label="Quarantine Records" value={metrics.quarantine_records} variant="warn" icon="🚧"
            sub={metrics.raw_records ? `${Math.round((metrics.quarantine_records / metrics.raw_records) * 100)}% bị loại` : 'Dòng bị loại'} />
        </div>
      )}

      {(isHalt || expectations.length > 0) && (
        <div className="panel">
          <div className="section-title" style={{ color: isHalt ? 'var(--fail)' : undefined }}>
            {isHalt ? '⛔ Validation Halted — log expectations' : 'Expectation suite'}
          </div>
          <Terminal lines={expectationsToLines(expectations)} />
          {isHalt && <p className="muted" style={{ marginTop: 10 }}>
            Pipeline dừng trước khi embed. Sửa <span className="mono">cleaning_rules.py</span> hoặc bật <b>Skip Validate</b> để embed demo.
          </p>}
        </div>
      )}
    </div>
  )
}
