# BE Orchestrator — Lab Day 10 (FastAPI)

Backend đóng vai **Orchestrator**: quản lý ETL pipeline Day 10 và giao tiếp ChromaDB, expose 5 REST API
ánh xạ 4 Sprint của Lab. **Tái sử dụng trực tiếp** `transform/`, `quality/`, `monitoring/`,
`etl_pipeline.py` của lab → hành vi khớp 100% với CLI, dùng **chung** collection `day10_kb`.

## Kiến trúc

```
BE/app/
├── config.py        # cầu nối sys.path tới lab + nạp lab/.env + chuẩn hoá CHROMA_DB_PATH tuyệt đối
├── schemas.py       # Pydantic request/response + ví dụ JSON cho Swagger
├── services/
│   ├── pipeline_service.py    # ingest→clean→validate→embed→freshness (Ingestion/Cleaning/Validation/Embedding)
│   ├── freshness_service.py   # Observability: freshness overall + theo từng nguồn
│   └── eval_service.py        # retrieval eval (21) + grading (10), cache collection
├── routers/         # pipeline / monitoring / eval / artifacts
└── main.py          # FastAPI app + Swagger
```

| Service core (đề bài) | Hiện thực |
|---|---|
| Ingestion | `load_raw_csv` + sinh `run_id` (pipeline_service) |
| Cleaning | `transform/cleaning_rules.clean_rows` |
| Validation | `quality/expectations.run_expectations` (Data Contract) |
| Embedding | `etl_pipeline.cmd_embed_internal` (chunk + upsert/prune Chroma) |
| Observability | `monitoring/freshness_check` + metrics raw/clean/quarantine |

## Cài đặt (dùng chung venv của lab)

```powershell
# từ thư mục day10/BE
..\lab\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Chạy server

```powershell
# từ thư mục day10/BE
..\lab\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

- **Swagger UI:** http://127.0.0.1:8000/docs  (có sẵn JSON mẫu cho từng API — bấm *Try it out*)
- **OpenAPI JSON:** http://127.0.0.1:8000/openapi.json
- **Health:** http://127.0.0.1:8000/health

## 5 API

| # | Method | Endpoint | Thay cho |
|---|--------|----------|----------|
| 1 | POST | `/api/v1/pipeline/run` | `python etl_pipeline.py run` (+flags Sprint 3) |
| 2 | GET  | `/api/v1/monitoring/freshness` | `python etl_pipeline.py freshness` |
| 3 | POST | `/api/v1/eval/retrieval` | `python eval_retrieval.py` |
| 4 | POST | `/api/v1/eval/grading` | `python grading_run.py` |
| 5 | GET  | `/api/v1/artifacts/{type}/{file}` | tải log/quarantine/manifest/eval |

### Ví dụ nhanh (curl)

```bash
# 1) Chạy pipeline (sạch)
curl -X POST http://127.0.0.1:8000/api/v1/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"flags":{"skip_validate":false,"no_refund_fix":false}}'

# 1b) Inject corruption (Sprint 3) → embed dữ liệu xấu
curl -X POST http://127.0.0.1:8000/api/v1/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"run_id":"inject-bad","flags":{"skip_validate":true,"no_refund_fix":true}}'

# 2) Freshness (manifest mới nhất)
curl http://127.0.0.1:8000/api/v1/monitoring/freshness

# 3) Retrieval eval
curl -X POST http://127.0.0.1:8000/api/v1/eval/retrieval \
  -H "Content-Type: application/json" -d '{"top_k":3,"output_filename":"after_fix_eval.csv"}'

# 4) Grading
curl -X POST http://127.0.0.1:8000/api/v1/eval/grading \
  -H "Content-Type: application/json" -d '{"top_k":5,"output_filename":"grading_run.jsonl"}'

# 5) Tải manifest (trả JSON)
curl http://127.0.0.1:8000/api/v1/artifacts/manifests/manifest_inject-bad.json
```

## Lưu ý

- BE **không** tạo index riêng — đọc/ghi cùng `lab/chroma_db` và `lab/artifacts`. Chạy pipeline lần đầu
  để có collection trước khi gọi eval/grading.
- Embedding model lấy từ `lab/.env` (`EMBEDDING_MODEL`). Endpoint pipeline/eval là **sync** (FastAPI chạy
  trong threadpool) vì nạp model + query là tác vụ nặng/blocking.
- `lab/.env`, `lab/chroma_db`, `lab/artifacts/*` đang bị gitignore (theo lab).
