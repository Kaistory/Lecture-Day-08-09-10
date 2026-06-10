"""
BE Orchestrator — Lab Day 10 Data Pipeline (FastAPI).

Chạy (từ day10/BE):
  ../lab/.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000

Swagger UI:  http://127.0.0.1:8000/docs
OpenAPI JSON: http://127.0.0.1:8000/openapi.json
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import config
from app.routers import artifacts, chat, docs, eval as eval_router, monitoring, pipeline

DESCRIPTION = """
Orchestrator quản lý ETL pipeline Day 10 và giao tiếp ChromaDB.

**5 API cốt lõi** (ánh xạ 4 Sprint của Lab):
1. `POST /api/v1/pipeline/run` — Ingest → Clean → Validate → Embed (có flags inject lỗi).
2. `GET /api/v1/monitoring/freshness` — kiểm tra SLA freshness từ manifest.
3. `POST /api/v1/eval/retrieval` — 21 câu tự kiểm.
4. `POST /api/v1/eval/grading` — 10 câu grading chính thức.
5. `GET /api/v1/artifacts/{type}/{file}` — tải log/quarantine/manifest/eval.

> Tái dùng trực tiếp `transform/`, `quality/`, `monitoring/`, `etl_pipeline.py` của lab và
> dùng chung collection ChromaDB `%s`.
""" % config.CHROMA_COLLECTION

app = FastAPI(
    title="Day 10 — Data Pipeline Orchestrator API",
    description=DESCRIPTION,
    version="1.0.0",
    contact={"name": "Lab Day 10", "url": "http://127.0.0.1:8000/docs"},
    openapi_tags=[
        {"name": "1 · Pipeline", "description": "Khởi chạy ETL pipeline."},
        {"name": "2 · Monitoring", "description": "Freshness / observability."},
        {"name": "3-4 · Eval", "description": "Retrieval eval + grading."},
        {"name": "6 · Chatbot", "description": "RAG chatbot dùng thực trên day10_kb."},
        {"name": "5 · Artifacts", "description": "Truy xuất file bằng chứng."},
    ],
)

# CORS — cho phép FE (Vite dev :5173, hoặc container) gọi API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lab/dev — production nên giới hạn origin cụ thể
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline.router)
app.include_router(monitoring.router)
app.include_router(eval_router.router)
app.include_router(chat.router)
app.include_router(docs.router)
app.include_router(artifacts.router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["health"], summary="Health check + cấu hình hiện tại")
def health():
    return {
        "status": "ok",
        "lab_dir": str(config.LAB_DIR),
        "chroma_db_path": config.CHROMA_DB_PATH,
        "chroma_collection": config.CHROMA_COLLECTION,
        "embedding_model": config.EMBEDDING_MODEL,
        "freshness_sla_hours": config.FRESHNESS_SLA_HOURS,
    }
