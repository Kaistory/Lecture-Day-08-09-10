// VIEW — thẻ số lớn (raw/cleaned/quarantine...).
export default function MetricCard({ label, value, variant, icon, sub }) {
  return (
    <div className={`metric ${variant || ''}`}>
      <div className="m-top">
        <div className="label">{label}</div>
        {icon && <span className="m-ico">{icon}</span>}
      </div>
      <div className="value">{value ?? '—'}</div>
      {sub && <div className="m-sub">{sub}</div>}
    </div>
  )
}
