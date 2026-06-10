"""
Pipeline Orchestrator — ingest → clean → validate → embed → freshness.

Tái sử dụng TRỰC TIẾP các hàm của lab để hành vi khớp 100% với `python etl_pipeline.py run`,
nhưng trả về dữ liệu có cấu trúc (JSON) thay vì in stdout.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app import config  # noqa: F401 — side effect: chèn sys.path + nạp .env TRƯỚC khi import lab

import etl_pipeline as lab_etl
from transform.cleaning_rules import (
    clean_rows,
    load_raw_csv,
    write_cleaned_csv,
    write_quarantine_csv,
)
from quality.expectations import run_expectations
from monitoring.freshness_check import check_manifest_freshness


class PipelineHalt(Exception):
    """Pipeline dừng có kiểm soát (expectation halt hoặc embed lỗi) → HTTP 422/500."""

    def __init__(self, payload: Dict[str, Any], http_status: int = 422):
        super().__init__(payload.get("message", "pipeline halted"))
        self.payload = payload
        self.http_status = http_status


def _new_run_id() -> str:
    return f"run_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}"


def run_pipeline(
    run_id: Optional[str] = None,
    *,
    skip_validate: bool = False,
    no_refund_fix: bool = False,
) -> Dict[str, Any]:
    run_id = run_id or _new_run_id()
    safe = run_id.replace(":", "-")

    for d in (lab_etl.LOG_DIR, lab_etl.MAN_DIR, lab_etl.QUAR_DIR, lab_etl.CLEAN_DIR):
        d.mkdir(parents=True, exist_ok=True)

    # 1) Ingest
    raw_path = config.RAW_DEFAULT
    if not raw_path.is_file():
        raise PipelineHalt(
            {"status": "error", "run_id": run_id, "message": f"raw file not found: {raw_path}"},
            http_status=500,
        )
    rows = load_raw_csv(raw_path)
    raw_count = len(rows)

    # 2) Clean
    cleaned, quarantine = clean_rows(rows, apply_refund_window_fix=not no_refund_fix)
    cleaned_path = lab_etl.CLEAN_DIR / f"cleaned_{safe}.csv"
    quar_path = lab_etl.QUAR_DIR / f"quarantine_{safe}.csv"
    write_cleaned_csv(cleaned_path, cleaned)
    write_quarantine_csv(quar_path, quarantine)

    metrics = {
        "raw_records": raw_count,
        "cleaned_records": len(cleaned),
        "quarantine_records": len(quarantine),
    }
    artifacts = {
        "manifest_url": f"/api/v1/artifacts/manifests/manifest_{safe}.json",
        "quarantine_log": f"/api/v1/artifacts/quarantine/quarantine_{safe}.csv",
        "cleaned_csv": f"/api/v1/artifacts/cleaned/cleaned_{safe}.csv",
    }

    # 3) Validate
    results, halt = run_expectations(cleaned)
    expectations = [
        {"name": r.name, "passed": r.passed, "severity": r.severity, "detail": r.detail}
        for r in results
    ]
    phases = {"ingestion": "passed", "cleaning": "passed", "validation": "passed", "embedding": "pending"}

    if halt and not skip_validate:
        phases["validation"] = "failed"
        phases["embedding"] = "skipped"
        raise PipelineHalt(
            {
                "status": "halted",
                "run_id": run_id,
                "metrics": metrics,
                "phases": phases,
                "expectations": expectations,
                "artifacts": artifacts,
                "message": "Expectation suite failed (halt). Pipeline dừng trước khi embed.",
            },
            http_status=422,
        )
    if halt and skip_validate:
        phases["validation"] = "warned"  # fail nhưng bị skip-validate bỏ qua

    # 4) Embed (Chroma upsert + prune) — tái dùng đúng hàm của lab
    logs: list[str] = []
    embed_ok = lab_etl.cmd_embed_internal(cleaned_path, run_id=run_id, log=logs.append)
    if not embed_ok:
        phases["embedding"] = "failed"
        raise PipelineHalt(
            {
                "status": "error",
                "run_id": run_id,
                "metrics": metrics,
                "phases": phases,
                "expectations": expectations,
                "message": "Embedding thất bại (kiểm tra chromadb/sentence-transformers).",
            },
            http_status=500,
        )
    phases["embedding"] = "passed"

    # 5) Manifest + freshness (giống etl_pipeline.cmd_run)
    latest_exported = max((r.get("exported_at") or "" for r in cleaned), default="") if cleaned else ""
    manifest = {
        "run_id": run_id,
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
        "raw_path": str(raw_path.relative_to(lab_etl.ROOT)),
        "raw_records": raw_count,
        "cleaned_records": len(cleaned),
        "quarantine_records": len(quarantine),
        "latest_exported_at": latest_exported,
        "no_refund_fix": bool(no_refund_fix),
        "skipped_validate": bool(skip_validate and halt),
        "cleaned_csv": str(cleaned_path.relative_to(lab_etl.ROOT)),
        "chroma_path": config.CHROMA_DB_PATH,
        "chroma_collection": config.CHROMA_COLLECTION,
    }
    man_path = lab_etl.MAN_DIR / f"manifest_{safe}.json"
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    status, fdetail = check_manifest_freshness(man_path, sla_hours=config.FRESHNESS_SLA_HOURS)

    return {
        "status": "success",
        "run_id": run_id,
        "metrics": metrics,
        "phases": phases,
        "expectations": expectations,
        "artifacts": artifacts,
        "freshness": {"status": status, "detail": fdetail},
        "embed_logs": logs,
        "message": "Pipeline completed and embedded to Vector DB successfully.",
    }
