"""API 3 & 4 — Eval Retrieval (21 câu) + Grading (10 câu)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas import GradingRequest, GradingResponse, RetrievalRequest, RetrievalResponse
from app.services import eval_service
from app.services.eval_service import CollectionUnavailable

router = APIRouter(prefix="/api/v1/eval", tags=["3-4 · Eval"])

_RETRIEVAL_EXAMPLE = {
    "eval_id": "eval_20260610_141500",
    "total_questions": 21,
    "passed": 21,
    "failed": 0,
    "metrics": {"avg_contains_expected": 1.0, "avg_hits_forbidden": 0.0},
    "report_url": "/api/v1/artifacts/eval/after_fix_eval.csv",
}

_GRADING_EXAMPLE = {
    "grading_run_id": "grad_20260610_141600",
    "total_score": "10/10",
    "all_passed": True,
    "results": [
        {"question_id": "gq_d10_01", "contains_expected": True, "hits_forbidden": False, "top1_doc_matches": True},
        {"question_id": "gq_d10_02", "contains_expected": True, "hits_forbidden": False, "top1_doc_matches": True},
    ],
    "artifact_url": "/api/v1/artifacts/eval/grading_run.jsonl",
}


@router.post(
    "/retrieval",
    response_model=RetrievalResponse,
    summary="Chạy 21 câu tự kiểm (test_questions.json)",
    responses={200: {"content": {"application/json": {"example": _RETRIEVAL_EXAMPLE}}}},
)
def retrieval(req: RetrievalRequest):
    """Query top-k cho 21 câu golden, đo `contains_expected`/`hits_forbidden`, ghi CSV vào artifacts/eval/."""
    try:
        return eval_service.run_retrieval(top_k=req.top_k, output_filename=req.output_filename)
    except CollectionUnavailable as e:
        return JSONResponse(status_code=409, content={"status": "error", "message": str(e)})


@router.post(
    "/grading",
    response_model=GradingResponse,
    summary="Chạy 10 câu grading chính thức (JSONL)",
    responses={200: {"content": {"application/json": {"example": _GRADING_EXAMPLE}}}},
)
def grading(req: GradingRequest):
    """Bài test 10 câu khắt khe → JSONL chuẩn chấm điểm + `total_score`/`all_passed`."""
    try:
        return eval_service.run_grading(top_k=req.top_k, output_filename=req.output_filename)
    except CollectionUnavailable as e:
        return JSONResponse(status_code=409, content={"status": "error", "message": str(e)})
