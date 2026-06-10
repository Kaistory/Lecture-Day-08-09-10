"""API 7 — Tài liệu nguồn canonical: xem cụ thể file .txt theo doc_id (khi click chip nguồn)."""

from __future__ import annotations

import re

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import config

router = APIRouter(prefix="/api/v1/docs", tags=["7 · Source Docs"])

_SAFE = re.compile(r"^[A-Za-z0-9._\-]+$")


@router.get("", summary="Liệt kê tài liệu nguồn (.txt)")
def list_docs():
    """Danh sách doc_id ↔ file trong data/docs/."""
    out = []
    if config.DOCS_DIR.is_dir():
        for p in sorted(config.DOCS_DIR.glob("*.txt")):
            out.append({"doc_id": p.stem, "filename": p.name, "size": p.stat().st_size})
    return {"docs": out}


@router.get("/{doc_id}", summary="Xem nội dung cụ thể file nguồn theo doc_id")
def get_doc(doc_id: str):
    """
    Trả về nội dung đầy đủ của `data/docs/{doc_id}.txt` — file gốc đứng sau chunk được retrieve.
    Dùng khi người dùng click vào biểu tượng file ở chip nguồn của chatbot.
    """
    if not _SAFE.match(doc_id):
        return JSONResponse(status_code=400, content={"status": "error", "message": "doc_id không hợp lệ."})
    path = (config.DOCS_DIR / f"{doc_id}.txt").resolve()
    if config.DOCS_DIR.resolve() not in path.parents:
        return JSONResponse(status_code=400, content={"status": "error", "message": "Đường dẫn không hợp lệ."})
    if not path.is_file():
        return JSONResponse(status_code=404, content={
            "status": "error",
            "message": f"Không có file nguồn cho doc_id '{doc_id}' (có thể là nguồn nhiễu/legacy).",
        })
    content = path.read_text(encoding="utf-8")
    return {
        "doc_id": doc_id,
        "filename": path.name,
        "rel_path": f"data/docs/{path.name}",
        "lines": content.count("\n") + 1,
        "size": len(content),
        "content": content,
    }
