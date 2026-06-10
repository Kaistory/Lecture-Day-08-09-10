"""API 2 — Kiểm tra Freshness (Sprint 4)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.schemas import FreshnessResponse
from app.services import freshness_service
from app.services.freshness_service import ManifestNotFound

router = APIRouter(prefix="/api/v1/monitoring", tags=["2 · Monitoring"])

_EXAMPLE = {
    "run_id": "run_20260610_141022",
    "timestamp": "2026-06-10T14:10:22Z",
    "overall_status": "FAIL",
    "sla_hours": 24,
    "details": [
        {"source": "policy_refund_v4", "last_updated": "2026-04-11T00:00:00", "age_hours": 1446.8,
         "sla_hours": 24, "status": "FAIL", "message": "Dữ liệu vượt SLA (stale)."},
        {"source": "hr_leave_policy", "last_updated": "2026-04-10T00:00:00", "age_hours": 1470.8,
         "sla_hours": 24, "status": "FAIL", "message": "Dữ liệu vượt SLA (stale)."},
    ],
}


@router.get(
    "/freshness",
    response_model=FreshnessResponse,
    summary="Đối chiếu SLA freshness từ manifest",
    responses={200: {"content": {"application/json": {"example": _EXAMPLE}}}},
)
def freshness(run_id: Optional[str] = Query(None, description="Bỏ trống = lấy manifest mới nhất.")):
    """Đọc manifest (theo `run_id` hoặc mới nhất) → overall_status + freshness từng nguồn (max exported_at/doc_id)."""
    try:
        return freshness_service.get_freshness(run_id=run_id)
    except ManifestNotFound as e:
        return JSONResponse(status_code=404, content={"status": "error", "message": str(e)})
