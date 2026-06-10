// VIEW — Data Observability (Sprint 4): freshness SLA bars + quarantine report.
import { useEffect } from 'react'
import { useFreshness } from '../../controllers/useFreshness.js'
import SlaBar from '../components/SlaBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import MetricCard from '../components/MetricCard.jsx'

const REASON_VI = {
  unknown_doc_id: 'Doc ID lạ', malformed_doc_id: 'Doc ID export hỏng', unregistered_source: 'Nguồn chưa đăng ký',
  missing_effective_date: 'Thiếu ngày hiệu lực', invalid_effective_date_format: 'Ngày không chuẩn ISO',
  stale_hr_policy_effective_date: 'HR cũ theo ngày', stale_hr_annual_leave_marker: 'HR cũ "10 ngày phép"',
  missing_chunk_text: 'Thiếu nội dung', duplicate_chunk_text: 'Trùng nội dung',
  low_quality_noise_chunk: 'Chunk nhiễu', low_quality_corrupt_chunk: 'Chunk hỏng (lặp/meta)',
  invalid_exported_at_format: 'exported_at sai định dạng',
}

export default function Observability() {
  const { data, quarantine, loading, error, load } = useFreshness()
  useEffect(() => { load() }, [load])

  const reasonCounts = {}
  quarantine?.rows?.forEach((r) => { reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1 })

  const tally = { PASS: 0, WARN: 0, FAIL: 0 }
  data?.details?.forEach((d) => { tally[d.status] = (tally[d.status] || 0) + 1 })

  return (
    <div>
      <div className="row between">
        <div>
          <h1 className="page-title">Data Observability</h1>
          <p className="page-sub">Sức khỏe dữ liệu theo SLA + báo cáo quarantine (manifest mới nhất).</p>
        </div>
        <button className="btn" onClick={() => load()} disabled={loading}>{loading ? 'Đang tải…' : '↻ Refresh'}</button>
      </div>

      {error && <div className="err">⚠ {error}</div>}

      {data && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <MetricCard label="Tổng nguồn" value={data.details?.length || 0} icon="🗄" />
            <MetricCard label="Đạt SLA" value={tally.PASS} variant="ok" icon="✓" />
            <MetricCard label="Cảnh báo" value={tally.WARN} variant="warn" icon="▲" sub="Gần hết SLA" />
            <MetricCard label="Quá hạn" value={tally.FAIL} variant={tally.FAIL ? 'fail' : ''} icon="■" sub="Vượt SLA" />
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>Data Contract · Freshness</div>
              <div className="row">
                <span className="muted mono">{data.run_id}</span>
                <StatusBadge status={data.overall_status} />
              </div>
            </div>
            <table className="tbl">
              <thead><tr><th>Nguồn</th><th>Last updated</th><th style={{ width: 220 }}>SLA</th><th>Status</th></tr></thead>
              <tbody>
                {data.details?.map((d) => (
                  <tr key={d.source}>
                    <td className="mono">{d.source}</td>
                    <td className="muted">{d.last_updated}</td>
                    <td><SlaBar ageHours={d.age_hours} slaHours={d.sla_hours} status={d.status} /></td>
                    <td><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid cols-2">
            <div className="panel">
              <div className="section-title">Quarantine theo lý do</div>
              {Object.keys(reasonCounts).length === 0 && <p className="muted">Chưa có dữ liệu quarantine (chạy pipeline trước).</p>}
              <table className="tbl">
                <tbody>
                  {Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
                    <tr key={reason}>
                      <td><span className="badge warn">{n}</span></td>
                      <td className="mono">{reason}</td>
                      <td className="muted">{REASON_VI[reason] || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="section-title">Mẫu dòng bị loại</div>
              <div className="terminal" style={{ maxHeight: 300 }}>
                {quarantine?.rows?.slice(0, 12).map((r, i) => (
                  <div key={i} className="t-dim">
                    <span className="t-warn">{r.reason}</span> · {r.doc_id} · {(r.chunk_text || '').slice(0, 60)}
                  </div>
                ))}
                {!quarantine?.rows?.length && <div className="t-dim">— trống —</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
