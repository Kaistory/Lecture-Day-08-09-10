"""
Chat Service — RAG chatbot trên collection day10_kb.

Retrieve top-k chunk → trả lời. Có 2 chế độ:
  - "llm": nếu có OPENAI_API_KEY → gọi OpenAI trả lời tự nhiên dựa trên context.
  - "extractive": không có key → trả thẳng chunk liên quan nhất (vẫn dùng được).
"""

from __future__ import annotations

import os
from typing import Any, Dict

from app import config  # noqa: F401 — side effect import order
from app.services.eval_service import _get_collection

SYSTEM_PROMPT = (
    "Bạn là trợ lý hỗ trợ nội bộ (CS + IT Helpdesk). CHỈ trả lời dựa trên CONTEXT được cung cấp. "
    "Nếu context không có thông tin, nói: 'Mình chưa có thông tin này trong tài liệu.' "
    "Trả lời ngắn gọn bằng tiếng Việt, nêu rõ con số/điều kiện nếu có."
)

# Marker dữ liệu cũ/sai version — nếu lọt vào context retrieve nghĩa là tầng dữ liệu chưa sạch.
STALE_MARKERS = ("14 ngày làm việc", "10 ngày phép năm")


def chat(message: str, top_k: int = 4) -> Dict[str, Any]:
    col = _get_collection()
    res = col.query(query_texts=[message], n_results=top_k)
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]

    sources = []
    for d, m in zip(docs, metas):
        m = m or {}
        sources.append({
            "doc_id": m.get("doc_id", ""),
            "effective_date": m.get("effective_date", ""),
            "run_id": m.get("run_id", ""),
            "preview": (d or "")[:200].replace("\n", " "),
        })

    if not docs:
        return {
            "answer": "Mình chưa có dữ liệu trong vector store. Hãy chạy pipeline trước (POST /api/v1/pipeline/run).",
            "sources": [], "mode": "empty", "model": None, "context_stale": [],
        }

    # Cờ data-quality: chunk stale nào lọt vào context (đo before/after rõ rệt ở mức retrieval).
    context_stale = [m for m in STALE_MARKERS if any(m in (d or "") for d in docs)]
    context = "\n".join(f"[{i + 1}] {d}" for i, d in enumerate(docs))
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if api_key:
        try:
            from openai import OpenAI
            model = os.environ.get("LLM_CHAT_MODEL", os.environ.get("LLM_JUDGE_MODEL", "gpt-4o-mini"))
            oai = OpenAI(api_key=api_key)
            resp = oai.chat.completions.create(
                model=model,
                temperature=0,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"CONTEXT:\n{context}\n\nCÂU HỎI: {message}"},
                ],
            )
            answer = (resp.choices[0].message.content or "").strip()
            return {"answer": answer, "sources": sources, "mode": "llm", "model": model, "context_stale": context_stale}
        except Exception as e:  # key sai / hết hạn / lỗi mạng → fallback
            return {
                "answer": f"[LLM lỗi: {e}] Trích đoạn liên quan nhất:\n\n{docs[0]}",
                "sources": sources, "mode": "extractive_fallback", "model": None, "context_stale": context_stale,
            }

    # Không có key → extractive
    return {
        "answer": f"(Chế độ trích dẫn — chưa cấu hình OPENAI_API_KEY)\n\n{docs[0]}",
        "sources": sources, "mode": "extractive", "model": None, "context_stale": context_stale,
    }


def _scan_cleaned_stale(run_id: str) -> list:
    """Quét cleaned CSV của 1 run cho marker stale — tín hiệu data-layer đáng tin cậy (không qua cache vector)."""
    import etl_pipeline as lab_etl
    path = lab_etl.CLEAN_DIR / f"cleaned_{run_id.replace(':', '-')}.csv"
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    return [m for m in STALE_MARKERS if m in text]


def compare(message: str, top_k: int = 4) -> Dict[str, Any]:
    """
    So sánh chatbot TRƯỚC (inject lỗi) vs SAU (pipeline sạch) trên cùng câu hỏi.
    Tự khôi phục index sạch ở bước cuối. So sánh gồm: câu trả lời, run_id, và `data_has_stale`
    (quét cleaned CSV — chứng minh dữ liệu nguồn còn/không còn chunk cũ).
    """
    from app.services import pipeline_service, eval_service

    # 1) BEFORE — inject corruption (bỏ fix refund, bỏ qua validate) rồi hỏi
    bad = pipeline_service.run_pipeline(run_id="chat-before-inject", no_refund_fix=True, skip_validate=True)
    eval_service.reset_collection_cache()
    before = chat(message, top_k)

    # 2) AFTER — chạy lại pipeline chuẩn (idempotent) rồi hỏi
    good = pipeline_service.run_pipeline(no_refund_fix=False, skip_validate=False)
    eval_service.reset_collection_cache()
    after = chat(message, top_k)

    return {
        "message": message,
        "before": {**before, "run_id": bad.get("run_id"),
                   "data_has_stale": _scan_cleaned_stale(bad.get("run_id", "")),
                   "quarantine_records": bad.get("metrics", {}).get("quarantine_records")},
        "after": {**after, "run_id": good.get("run_id"),
                  "data_has_stale": _scan_cleaned_stale(good.get("run_id", "")),
                  "quarantine_records": good.get("metrics", {}).get("quarantine_records")},
    }
