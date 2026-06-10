// VIEW — công tắc cờ (Skip Validate / No Refund Fix).
export default function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="track"><span className="knob" /></span>
      <span>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {hint && <div className="muted" style={{ fontSize: 12 }}>{hint}</div>}
      </span>
    </label>
  )
}
