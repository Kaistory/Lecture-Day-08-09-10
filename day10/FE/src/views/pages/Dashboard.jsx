// VIEW — Dashboard tổng quan: màn hình đầu rõ ràng, hướng hành động + KPI sống.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../controllers/AppContext.jsx'
import { useFreshness } from '../../controllers/useFreshness.js'
import StatusBadge from '../components/StatusBadge.jsx'
import MetricCard from '../components/MetricCard.jsx'

export default function Dashboard() {
  const { health, healthError } = useApp()
  const { data, load } = useFreshness()
  const nav = useNavigate()
  useEffect(() => { load() }, [load])

  const online = !!health && !healthError
  const sources = data?.details?.length || 0
  const warnFail = data?.details?.filter((d) => d.status !== 'PASS').length || 0

  return (
    <div>
      {/* Above-the-fold: lợi ích rõ ràng + 1 CTA chính */}
      <section className="hero">
        <div className="eyebrow"><span className={`dot ${online ? 'ok' : 'fail'}`} /> Lab Day 10 · DataOps</div>
        <h1>Theo dõi pipeline dữ liệu từ thô đến sạch — trong một màn hình.</h1>
        <p>Kích hoạt, kiểm thử và chấm điểm RAG pipeline với phản hồi real-time: Ingest → Clean → Validate → Embed, giám sát SLA và bằng chứng để nộp bài.</p>
        <div className="row">
          <button className="btn primary lg" onClick={() => nav('/pipeline')}>▶ Chạy Pipeline</button>
          <button className="btn lg ghost" onClick={() => nav('/observability')}>Xem sức khỏe dữ liệu →</button>
        </div>
      </section>

      {/* KPI sống — chỉ dữ liệu thật từ /health + /monitoring/freshness */}
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <MetricCard label="Backend / Vector DB" value={online ? 'Online' : 'Offline'} variant={online ? 'ok' : 'fail'}
          icon={online ? '🟢' : '🔴'} sub={online ? health.chroma_collection : (healthError || 'Mất kết nối')} />
        <MetricCard label="Freshness" value={data?.overall_status || '—'}
          variant={data?.overall_status === 'PASS' ? 'ok' : data?.overall_status ? 'warn' : ''}
          icon="❤" sub={data?.run_id ? `run ${String(data.run_id).slice(0, 12)}` : 'Chưa có manifest'} />
        <MetricCard label="Nguồn dữ liệu" value={sources || '—'} icon="🗄"
          sub={sources ? `${warnFail} nguồn cần chú ý` : 'Chạy pipeline để có'} />
        <MetricCard label="SLA cửa sổ" value={health ? `${health.freshness_sla_hours}h` : '—'} icon="⏱"
          sub={health?.embedding_model ? String(health.embedding_model).split('/').pop() : 'Ngưỡng làm mới'} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <div className="panel">
          <div className="section-title">Chi tiết kết nối</div>
          {health ? (
            <div className="kvs">
              <span className="k">Status</span><span><StatusBadge status="ok" /></span>
              <span className="k">Collection</span><span className="mono">{health.chroma_collection}</span>
              <span className="k">Embedder</span><span className="mono" style={{ fontSize: 12 }}>{health.embedding_model}</span>
              <span className="k">SLA</span><span className="mono">{health.freshness_sla_hours}h</span>
            </div>
          ) : <div className="err">⚠ BE offline. {healthError}</div>}
        </div>

        <div className="panel">
          <div className="section-title">Bắt đầu nhanh</div>
          <div className="grid" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => nav('/pipeline')}>▶ Chạy Pipeline</button>
            <button className="btn" onClick={() => nav('/evaluation')}>✓ Chấm Grading</button>
            <button className="btn" onClick={() => nav('/artifacts')}>🗂 Xem Artifacts</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">Quy trình 4 Sprint</div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          {[
            ['Sprint 1-2', 'Pipeline Runner', '/pipeline', 'Ingest→Clean→Validate→Embed'],
            ['Sprint 3', 'Evaluation', '/evaluation', 'Inject + before/after'],
            ['Sprint 4', 'Observability', '/observability', 'Freshness + quarantine'],
            ['Nộp bài', 'Artifacts', '/artifacts', 'Tải log/manifest/eval'],
          ].map(([tag, title, to, hint]) => (
            <div key={to} className="panel hoverable" style={{ flex: '1 1 200px', background: 'var(--bg-2)' }} onClick={() => nav(to)}>
              <div className="tag" style={{ marginBottom: 8 }}>{tag}</div>
              <div style={{ fontWeight: 700 }}>{title}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
