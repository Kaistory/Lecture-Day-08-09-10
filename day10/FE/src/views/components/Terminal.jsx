// VIEW — terminal giả lập hiển thị log expectation (đặc biệt khi Halt).
function classify(line) {
  const l = line.toLowerCase()
  if (l.includes('fail') || l.includes('halt') || l.includes('violation')) return 't-fail'
  if (l.includes('ok') || l.includes('pass')) return 't-ok'
  if (l.includes('warn')) return 't-warn'
  return 't-dim'
}

export default function Terminal({ lines = [], title = 'expectations.py' }) {
  return (
    <div>
      <div className="muted mono" style={{ marginBottom: 6, fontSize: 12 }}>▌ {title}</div>
      <div className="terminal">
        {lines.length === 0 && <div className="t-dim">— no output —</div>}
        {lines.map((ln, i) => (
          <div key={i} className={classify(ln)}>{ln}</div>
        ))}
      </div>
    </div>
  )
}

// Helper: chuyển mảng expectations -> dòng log giống CLI.
export function expectationsToLines(expectations = []) {
  return expectations.map(
    (e) => `expectation[${e.name}] ${e.passed ? 'OK' : 'FAIL'} (${e.severity}) :: ${e.detail}`,
  )
}
