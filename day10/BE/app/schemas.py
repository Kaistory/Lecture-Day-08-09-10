"""Pydantic models (request/response) + ví dụ JSON cho Swagger."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------- API 1: pipeline/run ----------
class PipelineFlags(BaseModel):
    skip_validate: bool = Field(False, description="Vẫn embed khi expectation halt (demo Sprint 3).")
    no_refund_fix: bool = Field(False, description="Bỏ rule fix cửa sổ refund 14→7 (inject corruption).")


class PipelineRunRequest(BaseModel):
    run_id: Optional[str] = Field(None, description="run_id tuỳ chọn; bỏ trống = sinh theo UTC timestamp.")
    flags: PipelineFlags = Field(default_factory=PipelineFlags)

    model_config = {
        "json_schema_extra": {
            "example": {
                "run_id": None,
                "flags": {"skip_validate": False, "no_refund_fix": False},
            }
        }
    }


# ---------- API 3: eval/retrieval ----------
class RetrievalRequest(BaseModel):
    top_k: int = Field(3, ge=1, le=20, description="Số chunk lấy mỗi câu.")
    output_filename: str = Field("after_fix_eval.csv", description="Tên file CSV ghi vào artifacts/eval/.")

    model_config = {
        "json_schema_extra": {"example": {"top_k": 3, "output_filename": "after_fix_eval.csv"}}
    }


# ---------- API 4: eval/grading ----------
class GradingRequest(BaseModel):
    top_k: int = Field(5, ge=1, le=20)
    output_filename: str = Field("grading_run.jsonl", description="Tên file JSONL ghi vào artifacts/eval/.")

    model_config = {
        "json_schema_extra": {"example": {"top_k": 5, "output_filename": "grading_run.jsonl"}}
    }


# ---------- Response models (mô tả schema cho Swagger; nội dung linh hoạt) ----------
class ExpectationResultOut(BaseModel):
    name: str
    passed: bool
    severity: str
    detail: str


class PipelineRunResponse(BaseModel):
    status: str
    run_id: str
    metrics: Dict[str, int]
    phases: Dict[str, str]
    expectations: List[ExpectationResultOut]
    artifacts: Dict[str, str]
    freshness: Optional[Dict[str, Any]] = None
    message: str


class FreshnessResponse(BaseModel):
    run_id: str
    timestamp: Optional[str] = None
    overall_status: str
    sla_hours: float
    details: List[Dict[str, Any]]


class RetrievalResponse(BaseModel):
    eval_id: str
    total_questions: int
    passed: int
    failed: int
    metrics: Dict[str, float]
    report_url: str


class GradingResponse(BaseModel):
    grading_run_id: str
    total_score: str
    all_passed: bool
    results: List[Dict[str, Any]]
    artifact_url: str
