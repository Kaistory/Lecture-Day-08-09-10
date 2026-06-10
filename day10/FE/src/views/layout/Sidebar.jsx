// VIEW — điều hướng trái.
import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', ico: '▦', label: 'Dashboard', end: true },
  { to: '/pipeline', ico: '⚙', label: 'Pipeline Runner' },
  { to: '/observability', ico: '❤', label: 'Observability' },
  { to: '/evaluation', ico: '✓', label: 'Evaluation' },
  { to: '/chat', ico: '💬', label: 'Chatbot' },
  { to: '/artifacts', ico: '🗂', label: 'Artifacts' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Day10 <span>·DataOps</span></div>
      <nav className="nav">
        {ITEMS.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}>
            <span className="ico">{it.ico}</span>
            {it.label}
          </NavLink>
        ))}
        {/* Trang tĩnh (ngoài react-router) — dùng <a> để browser tải trực tiếp */}
        <a href="/scenario.html">
          <span className="ico">📖</span>
          Kịch bản Demo
        </a>
      </nav>
    </aside>
  )
}
