"""API 1 — Khởi chạy ETL Pipeline (Sprint 1 & 2, + flags Sprint 3)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas import PipelineRunRequest, PipelineRunResponse
from app.services import pipeline_service
from app.services.pipeline_service import PipelineHalt

router = APIRouter(prefix="/api/v1/pipeline", tags=["1 · Pipeline"])

_SUCCESS_EXAMPLE = {
    "status": "success",
    "run_id": "run_20260610_141022",
    "metrics": {"raw_records": 247, "cleaned_records": 32, "quarantine_records": 215},
    "phases": {"ingestion": "passed", "cleaning": "passed", "validation": "passed", "embedding": "passed"},
    "artifacts": {
        "manifest_url": "/api/v1/artifacts/manifests/manifest_run_20260610_141022.json",
        "quarantine_log": "/api/v1/artifacts/quarantine/quarantine_run_20260610_141022.csv",
        "cleaned_csv": "/api/v1/artifacts/cleaned/cleaned_run_20260610_141022.csv",
    },
    "freshness": {"status": "FAIL", "detail": {"reason": "freshness_sla_exceeded", "age_hours": 1446.8}},
    "message": "Pipeline completed and embedded to Vector DB successfully.",
}

_HALT_EXAMPLE = {
    "status": "halted",
    "run_id": "run_20260610_141022",
    "metrics": {"raw_records": 247, "cleaned_records": 40, "quarantine_records": 207},
    "phases": {"ingestion": "passed", "cleaning": "passed", "validation": "failed", "embedding": "skipped"},
    "expectations": [
        {"name": "hr_leave_no_stale_10d_annual", "passed": False, "severity": "halt", "detail": "violations=2"}
    ],
    "message": "Expectation suite failed (halt). Pipeline dừng trước khi embed.",
}


@router.post(
    "/run",
    response_model=PipelineRunResponse,
    summary="Chạy Ingest → Clean → Validate → Embed",
    responses={
        200: {"content": {"application/json": {"example": _SUCCESS_EXAMPLE}}},
        422: {"description": "Expectation halt — pipeline dừng",
              "content": {"application/json": {"example": _HALT_EXAMPLE}}},
    },
)
def run_pipeline(req: PipelineRunRequest):
    """
    Kích hoạt toàn bộ luồng ETL. Hỗ trợ cờ test lỗi (Sprint 3):
    - `no_refund_fix`: bỏ rule fix refund 14→7 (inject corruption).
    - `skip_validate`: vẫn embed dù expectation halt.

    Trả **HTTP 422** nếu expectation halt và không bật `skip_validate`.
    """
    try:
        result = pipeline_service.run_pipeline(
            run_id=req.run_id,
            skip_validate=req.flags.skip_validate,
            no_refund_fix=req.flags.no_refund_fix,
        )
        return result
    except PipelineHalt as halt:
        return JSONResponse(status_code=halt.http_status, content=halt.payload)
