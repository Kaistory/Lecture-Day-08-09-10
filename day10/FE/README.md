# FE Dashboard — Lab Day 10 (React, MVC)

Giao diện Dashboard Dark-mode cho hệ thống Data Pipeline & Observability, gọi BE Orchestrator (FastAPI).

## Kiến trúc MVC

```
FE/src/
├── models/          # MODEL — giao tiếp BE
│   ├── apiClient.js   # fetch wrapper + ApiError (giữ payload 422)
│   └── api.js         # 5 API → hàm domain (Pipeline/Monitoring/Eval/Artifacts/Health)
├── controllers/     # CONTROLLER — hooks điều phối state + business logic
│   ├── AppContext.jsx     # state toàn cục: health, currentRunId
│   ├── usePipeline.js     # chạy pipeline + animation stepper, bắt halt 422
│   ├── useFreshness.js    # freshness + parse quarantine CSV
│   ├── useEval.js         # retrieval before/after + grading
│   └── useArtifacts.js    # file explorer
└── views/           # VIEW — UI thuần
    ├── layout/      # Sidebar, TopBar, Layout (3 vùng)
    ├── components/  # Stepper, MetricCard, Terminal, SlaBar, ScoreRing, Confetti, Toggle, StatusBadge
    └── pages/       # Dashboard, PipelineRunner, Observability, Evaluation, Artifacts
```

**Luồng:** View gọi Controller (hook) → Controller gọi Model (api) → BE. View không gọi thẳng `fetch`.

## Màn hình (theo UX spec)

| Trang | Tính năng |
|-------|-----------|
| Dashboard | trạng thái BE/ChromaDB, freshness mới nhất, điều hướng nhanh |
| Pipeline Runner | toggle `Skip Validate`/`No Refund Fix`, **Visual Stepper 4 node**, metrics cards, terminal log khi Halt (đỏ + rung) |
| Observability | bảng Data Contract + **SLA bars** (xanh/vàng/đỏ), quarantine theo lý do |
| Evaluation | **A/B split** before/after, bảng grading 10 câu (tick/khiên), **vòng điểm + confetti** khi 10/10 |
| **Chatbot** | RAG chatbot dùng thực trên `day10_kb` — hỏi đáp + **chip nguồn trích dẫn** (gọi `POST /api/v1/chat`) |
| Artifacts | file explorer theo loại, tải `.csv/.json/.jsonl` 1 click |
| `scenario.html` | trang tĩnh (public/) — use case + nguồn, inject, idempotent, before/after khớp run_id |

## Chạy (dev)

```powershell
cd day10/FE
npm install
copy .env.example .env   # chỉnh VITE_API_BASE_URL nếu cần
npm run dev              # http://127.0.0.1:5173
```

> Cần BE chạy trước (mặc định `http://127.0.0.1:8000`). Xem `../BE/README.md`.
> BE đã bật CORS `*` nên FE gọi cross-origin được.

## Build production

```powershell
npm run build     # -> dist/
npm run preview   # xem thử bản build
```

## Cấu hình

- `VITE_API_BASE_URL` (file `.env`) — URL BE. Mặc định `http://127.0.0.1:8000`.
