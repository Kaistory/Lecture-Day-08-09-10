// MODEL — ánh xạ 5 API của BE thành hàm domain. View/Controller chỉ gọi qua đây.

import { http, API_BASE } from './apiClient.js'

export { API_BASE }

export const PipelineModel = {
  // API 1
  run: ({ run_id = null, skip_validate = false, no_refund_fix = false } = {}) =>
    http.post('/api/v1/pipeline/run', { run_id, flags: { skip_validate, no_refund_fix } }),
}

export const MonitoringModel = {
  // API 2
  freshness: (run_id) =>
    http.get(`/api/v1/monitoring/freshness${run_id ? `?run_id=${encodeURIComponent(run_id)}` : ''}`),
}

export const EvalModel = {
  // API 3
  retrieval: ({ top_k = 3, output_filename = 'after_fix_eval.csv' } = {}) =>
    http.post('/api/v1/eval/retrieval', { top_k, output_filename }),
  // API 4
  grading: ({ top_k = 5, output_filename = 'grading_run.jsonl' } = {}) =>
    http.post('/api/v1/eval/grading', { top_k, output_filename }),
}

export const ArtifactsModel = {
  // API 5 — liệt kê + tải + preview
  list: () => http.get('/api/v1/artifacts'),
  url: (type, filename) => `${API_BASE}/api/v1/artifacts/${type}/${encodeURIComponent(filename)}`,
  fetchJson: (type, filename) => http.get(`/api/v1/artifacts/${type}/${encodeURIComponent(filename)}`),
  // Trả raw text (CSV/JSONL/log) hoặc JSON pretty cho modal preview
  async fetchText(type, filename) {
    const res = await fetch(this.url(type, filename))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return JSON.stringify(await res.json(), null, 2)
    return res.text()
  },
}

export const ChatModel = {
  // API 6 — RAG chatbot
  send: ({ message, top_k = 4 }) => http.post('/api/v1/chat', { message, top_k }),
  compare: ({ message, top_k = 4 }) => http.post('/api/v1/chat/compare', { message, top_k }),
}

export const DocsModel = {
  // API 7 — xem cụ thể file nguồn theo doc_id
  get: (doc_id) => http.get(`/api/v1/docs/${encodeURIComponent(doc_id)}`),
}

export const HealthModel = {
  get: () => http.get('/health'),
}
