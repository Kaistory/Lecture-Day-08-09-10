// VIEW — Visual Stepper 4 node: Ingestion → Cleaning → Validation → Embedding.
const ICONS = { ingestion: '⬇', cleaning: '🧹', validation: '✓', embedding: '🧠' }
const LABELS = { ingestion: 'Ingestion', cleaning: 'Cleaning', validation: 'Validation', embedding: 'Embedding' }

function nodeContent(status, key) {
  if (status === 'running') return <span className="spinner" />
  if (status === 'passed') return '✔'
  if (status === 'failed') return '✖'
  if (status === 'skipped') return '–'
  if (status === 'warned') return '▲'
  return ICONS[key] || '•'
}

export default function Stepper({ steps }) {
  return (
    <div className="stepper">
      {steps.map((s) => (
        <div key={s.key} className={`step ${s.status}`}>
          <div className="bar" />
          <div className="node">{nodeContent(s.status, s.key)}</div>
          <div className="name">{LABELS[s.key] || s.key}</div>
        </div>
      ))}
    </div>
  )
}
