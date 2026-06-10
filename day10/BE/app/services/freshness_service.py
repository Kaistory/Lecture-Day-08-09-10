"""
Freshness Service — đọc manifest gần nhất (hoặc theo run_id), đối chiếu SLA.

Mở rộng so với lab: ngoài overall_status (dùng monitoring.freshness_check), còn tính freshness
THEO TỪNG NGUỒN (max exported_at mỗi doc_id trong cleaned CSV) để khớp JSON mẫu API 2.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app import config  # noqa: F401 — side effect import order

import etl_pipeline as lab_etl
from monitoring.freshness_check import check_manifest_freshness, parse_iso


class ManifestNotFound(Exception):
    pass


def _find_manifest(run_id: Optional[str]) -> Path:
    man_dir = lab_etl.MAN_DIR
    if run_id:
        p = man_dir / f"manifest_{run_id.replace(':', '-')}.json"
        if not p.is_file():
            raise ManifestNotFound(f"Không tìm thấy manifest cho run_id={run_id}")
        return p
    candidates = sorted(man_dir.glob("manifest_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise ManifestNotFound("Chưa có manifest nào — hãy chạy POST /api/v1/pipeline/run trước.")
    return candidates[0]


def _per_source(cleaned_csv: Path, now: datetime, sla_hours: float) -> List[Dict[str, Any]]:
    if not cleaned_csv.is_file():
        return []
    latest: Dict[str, str] = {}
    with cleaned_csv.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            doc = (r.get("doc_id") or "").strip()
            exp = (r.get("exported_at") or "").strip()
            if doc and exp and exp > latest.get(doc, ""):
                latest[doc] = exp

    out: List[Dict[str, Any]] = []
    for doc in sorted(latest):
        exp = latest[doc]
        dt = parse_iso(exp)
        if dt is None:
            out.append({"source": doc, "last_updated": exp, "sla_hours": sla_hours,
                        "status": "WARN", "message": "Không parse được timestamp."})
            continue
        age = (now - dt).total_seconds() / 3600.0
        if age > sla_hours:
            status, msg = "FAIL", "Dữ liệu vượt SLA (stale)."
        elif age > sla_hours * 0.8:
            status, msg = "WARN", "Dữ liệu sắp chạm ngưỡng SLA."
        else:
            status, msg = "PASS", None
        item = {"source": doc, "last_updated": exp, "age_hours": round(age, 2),
                "sla_hours": sla_hours, "status": status}
        if msg:
            item["message"] = msg
        out.append(item)
    return out


def get_freshness(run_id: Optional[str] = None) -> Dict[str, Any]:
    man_path = _find_manifest(run_id)
    sla = config.FRESHNESS_SLA_HOURS
    overall_status, overall_detail = check_manifest_freshness(man_path, sla_hours=sla)
    data: Dict[str, Any] = json.loads(man_path.read_text(encoding="utf-8"))

    now = datetime.now(timezone.utc)
    details: List[Dict[str, Any]] = []
    cleaned_rel = data.get("cleaned_csv")
    if cleaned_rel:
        details = _per_source(lab_etl.ROOT / cleaned_rel, now, sla)

    return {
        "run_id": data.get("run_id"),
        "timestamp": data.get("run_timestamp"),
        "overall_status": overall_status,
        "overall_detail": overall_detail,
        "sla_hours": sla,
        "details": details,
    }
