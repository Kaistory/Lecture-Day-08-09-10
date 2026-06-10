"""API 6 — Chatbot RAG trên collection day10_kb (dùng thực)."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services import chat_service
from app.services.eval_service import CollectionUnavailable

router = APIRouter(prefix="/api/v1/chat", tags=["6 · Chatbot"])


class ChatRequest(BaseModel):
    message: str = Field(..., description="Câu hỏi của người dùng.")
    top_k: int = Field(4, ge=1, le=10, description="Số chunk lấy làm context.")

    model_config = {
        "json_schema_extra": {
            "example": {"message": "Khách có bao nhiêu ngày để yêu cầu hoàn tiền?", "top_k": 4}
        }
    }


_EXAMPLE = {
    "answer": "Khách hàng có tối đa 7 ngày làm việc để gửi yêu cầu hoàn tiền sau khi đơn được xác nhận.",
    "sources": [
        {"doc_id": "policy_refund_v4", "effective_date": "2026-02-01", "run_id": "run_20260610_071924",
         "preview": "Yêu cầu được gửi trong vòng 7 ngày làm việc kể từ thời điểm xác nhận đơn hàng."}
    ],
    "mode": "llm",
    "model": "gpt-4o-mini",
}


@router.post(
    "",
    summary="Hỏi chatbot (RAG: retrieve + LLM trả lời)",
    responses={200: {"content": {"application/json": {"example": _EXAMPLE}}}},
)
def chat(req: ChatRequest):
    """Truy vấn `day10_kb`, trả lời dựa trên context. Có `sources` để trích dẫn + đối chiếu `run_id`."""
    try:
        return chat_service.chat(req.message, top_k=req.top_k)
    except CollectionUnavailable as e:
        return JSONResponse(status_code=409, content={"status": "error", "message": str(e)})


_COMPARE_EXAMPLE = {
    "message": "Khách có bao nhiêu ngày để yêu cầu hoàn tiền?",
    "before": {"answer": "Khách có 14 ngày làm việc...", "run_id": "chat-before-inject", "mode": "llm",
               "sources": [{"doc_id": "policy_refund_v4"}]},
    "after": {"answer": "Khách có 7 ngày làm việc...", "run_id": "run_2026...", "mode": "llm",
              "sources": [{"doc_id": "policy_refund_v4"}]},
}


@router.post(
    "/compare",
    summary="So sánh Before (inject lỗi) / After (pipeline sạch)",
    responses={200: {"content": {"application/json": {"example": _COMPARE_EXAMPLE}}}},
)
def compare(req: ChatRequest):
    """
    Chạy 1 lượt: inject corruption → hỏi (Before) → rerun pipeline sạch → hỏi (After).
    Kết thúc index ở trạng thái sạch. **Chậm** (2 lần embed + 2 LLM) — hiển thị spinner ở FE.
    """
    try:
        return chat_service.compare(req.message, top_k=req.top_k)
    except CollectionUnavailable as e:
        return JSONResponse(status_code=409, content={"status": "error", "message": str(e)})
