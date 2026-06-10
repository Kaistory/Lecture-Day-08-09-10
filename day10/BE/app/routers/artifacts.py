"""API 5 — Truy xuất Artifacts (logs / manifests / quarantine / cleaned / eval)."""

from __future__ import annotations

import json
import re

from fastapi import APIRouter, Header
from fastapi.responses import FileResponse, JSONResponse

from app import config

router = APIRouter(prefix="/api/v1/artifacts", tags=["5 · Artifacts"])

# Chỉ cho phép tên file an toàn (chống path traversal: không '/', '\\', '..').
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._\-:]+$")


@router.get("", summary="Liệt kê artifact theo loại (cho File Explorer)")
def list_artifacts():
    """Trả danh sách file mỗi `artifact_type` (logs/manifests/quarantine/cleaned/eval) — mới nhất trước."""
    out = {}
    for atype in sorted(config.ARTIFACT_TYPES):
        d = config.ARTIFACTS_DIR / atype
        files = []
        if d.is_dir():
            for p in sorted(d.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
                if p.is_file():
                    st = p.stat()
                    files.append({
                        "filename": p.name,
                        "size": st.st_size,
                        "modified": st.st_mtime,
                        "url": f"/api/v1/artifacts/{atype}/{p.name}",
                    })
        out[atype] = files
    return out


@router.get(
    "/{artifact_type}/{filename}",
    summary="Tải file artifact (CSV/JSON/log)",
    responses={
        200: {"description": "Trả file (JSON nếu manifest, ngược lại tải xuống)."},
        400: {"description": "artifact_type hoặc filename không hợp lệ."},
        404: {"description": "Không tìm thấy file."},
    },
)
def get_artifact(artifact_type: str, filename: str, accept: str = Header(default="*/*")):
    """
    `artifact_type` ∈ {logs, manifests, quarantine, cleaned, eval}.

    - File `.json` (manifest): trả JSON nội dung (dễ xem trên Swagger).
    - File khác (.csv/.log/.jsonl): trả file tải xuống.
    """
    if artifact_type not in config.ARTIFACT_TYPES:
        return JSONResponse(status_code=400, content={
            "status": "error",
            "message": f"artifact_type không hợp lệ. Cho phép: {sorted(config.ARTIFACT_TYPES)}",
        })
    if not _SAFE_NAME.match(filename):
        return JSONResponse(status_code=400, content={"status": "error", "message": "filename không hợp lệ."})

    base = (config.ARTIFACTS_DIR / artifact_type).resolve()
    target = (base / filename).resolve()
    # Đảm bảo target nằm trong thư mục artifacts/<type> (chống traversal)
    if base not in target.parents and target != base:
        return JSONResponse(status_code=400, content={"status": "error", "message": "Đường dẫn không hợp lệ."})
    if not target.is_file():
        return JSONResponse(status_code=404, content={"status": "error", "message": f"Không tìm thấy: {filename}"})

    if target.suffix == ".json":
        try:
            return JSONResponse(content=json.loads(target.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            pass  # fallback tải file
    media = {
        ".csv": "text/csv",
        ".jsonl": "application/x-ndjson",
        ".log": "text/plain",
        ".json": "application/json",
    }.get(target.suffix, "application/octet-stream")
    return FileResponse(path=str(target), media_type=media, filename=target.name)
