// VIEW — thanh SLA: fill theo age/SLA, đổi màu PASS/WARN/FAIL.
const COLOR = { PASS: 'var(--ok)', WARN: 'var(--warn)', FAIL: 'var(--fail)' }

export default function SlaBar({ ageHours = 0, slaHours = 24, status }) {
  const ratio = slaHours > 0 ? ageHours / slaHours : 0
  const pct = Math.max(4, Math.min(100, ratio * 100))
  const st = status || (ratio > 1 ? 'FAIL' : ratio > 0.8 ? 'WARN' : 'PASS')
  return (
    <div>
      <div className="sla"><i style={{ width: `${pct}%`, background: COLOR[st] || 'var(--ok)' }} /></div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
        {ageHours != null ? `${Number(ageHours).toFixed(1)}h` : '—'} / SLA {slaHours}h
      </div>
    </div>
  )
}
