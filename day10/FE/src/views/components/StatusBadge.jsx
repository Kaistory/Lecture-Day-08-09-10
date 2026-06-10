// VIEW — badge trạng thái theo hệ màu chuẩn.
const MAP = {
  passed: ['ok', '● PASS'], pass: ['ok', '● PASS'], success: ['ok', '● SUCCESS'],
  ok: ['ok', '● OK'], true: ['ok', '✔'],
  failed: ['fail', '✖ FAIL'], fail: ['fail', '✖ FAIL'], halted: ['fail', '■ HALT'], error: ['fail', '✖ ERROR'],
  warn: ['warn', '▲ WARN'], warned: ['warn', '▲ WARN'],
  skipped: ['pending', '— SKIPPED'], pending: ['pending', '… PENDING'],
}

export default function StatusBadge({ status, text }) {
  const key = String(status).toLowerCase()
  const [cls, label] = MAP[key] || ['pending', String(status).toUpperCase()]
  return <span className={`badge ${cls}`}>{text || label}</span>
}
