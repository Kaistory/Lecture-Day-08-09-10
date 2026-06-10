# Docker — Setup & Run (Day 10 BE + FE)

Chạy cả Backend Orchestrator (FastAPI) và Dashboard (React) bằng một lệnh.

## Yêu cầu
- Docker Desktop (đã bật Docker Compose v2).

## Chạy

```bash
# từ thư mục day10/
docker compose up --build
```

| Service | URL | Ghi chú |
|---------|-----|---------|
| BE Swagger | http://localhost:8000/docs | API + JSON mẫu |
| BE Health | http://localhost:8000/health | |
| FE Dashboard | http://localhost:3000 | giao diện chính |

Dừng: `Ctrl+C` rồi `docker compose down` (thêm `-v` để xoá cả volume cache model + index).

## Lần đầu chạy

1. Mở FE http://localhost:3000 → **Pipeline Runner** → **Run Pipeline**
   (hoặc `POST http://localhost:8000/api/v1/pipeline/run`).
2. Lần embed đầu tiên, BE tải model `paraphrase-multilingual-MiniLM-L12-v2` (~470MB) →
   cache trong volume `hf-cache`, các lần sau nhanh.
3. Sau khi pipeline chạy xong → collection `day10_kb` sẵn sàng cho Eval/Grading/Observability.

## Kiến trúc container

```
day10/
├── docker-compose.yml      # 2 service: be (8000), fe (3000)
├── BE/Dockerfile           # python:3.12-slim, copy lab/ + BE/, chạy uvicorn
├── FE/Dockerfile           # node build → nginx serve (SPA)
└── .dockerignore           # loại .venv/.env/chroma_db/artifacts/node_modules
```

- **BE** copy cả `lab/` (module pipeline) và `BE/` (app FastAPI) vào `/app`; `config.py` tự trỏ
  `LAB_DIR=/app/lab`. Index + artifact ghi ra `/app/lab/chroma_db` và `/app/lab/artifacts`
  (mount volume → bền vững, chia sẻ với host).
- **FE** build tĩnh, nginx phục vụ; `VITE_API_BASE_URL=http://localhost:8000` được bake lúc build.
  Trình duyệt trên host gọi BE qua cổng publish 8000 (BE đã bật CORS `*`).

## Tuỳ chỉnh

- Đổi SLA / model / collection: sửa block `environment` của service `be` trong `docker-compose.yml`.
- Đổi URL BE cho FE (vd deploy domain khác): sửa `args.VITE_API_BASE_URL` của service `fe` rồi rebuild.
- LLM-judge (`eval_llm_judge.py`) không phải endpoint BE; nếu cần, thêm `OPENAI_API_KEY` vào
  `environment` của `be` và chạy thủ công trong container.

## Lưu ý
- `.env` của lab (chứa OPENAI_API_KEY) **bị loại khỏi image** qua `.dockerignore` — cấu hình runtime
  truyền qua `environment` trong compose, không nướng secret vào image.
- Image BE khá lớn (~vài GB) do torch/sentence-transformers — bình thường với stack AI.
