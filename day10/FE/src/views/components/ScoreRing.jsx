// VIEW — vòng tròn điểm số (vd 10/10).
export default function ScoreRing({ passed = 0, total = 10 }) {
  const pct = total > 0 ? (passed / total) * 100 : 0
  const color = pct === 100 ? 'var(--ok)' : pct >= 60 ? 'var(--warn)' : 'var(--fail)'
  return (
    <div className="ring-wrap">
      <div className="ring" style={{ '--p': pct, background: `conic-gradient(${color} calc(${pct}*1%), var(--bg-3) 0)` }}>
        <div className="inner" style={{ flexDirection: 'column' }}>
          <div className="score" style={{ color }}>{passed}/{total}</div>
          <div className="muted" style={{ fontSize: 12 }}>{Math.round(pct)}%</div>
        </div>
      </div>
    </div>
  )
}
