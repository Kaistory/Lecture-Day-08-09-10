// MODEL — HTTP client cấp thấp (fetch wrapper) tới BE Orchestrator.

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://127.0.0.1:8000'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body // payload JSON (vd halt 422 có metrics/phases/expectations)
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new ApiError(`Không kết nối được BE (${API_BASE}). BE đã chạy chưa?`, 0, null)
  }
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = (data && data.message) || `HTTP ${res.status}`
    throw new ApiError(msg, res.status, data)
  }
  return data
}

export const http = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
}
