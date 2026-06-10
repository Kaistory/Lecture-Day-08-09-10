"""
Cleaning rules — raw export → cleaned rows + quarantine.

Baseline gồm các failure mode mở rộng (allowlist doc_id, parse ngày, HR stale version).
Sinh viên thêm ≥3 rule mới: mỗi rule phải ghi `metric_impact` (xem README — chống trivial).
"""

from __future__ import annotations

import csv
import hashlib
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Khớp export hợp lệ trong lab (mở rộng khi nhóm thêm doc mới — phải đồng bộ contract).
ALLOWED_DOC_IDS = frozenset(
    {
        "policy_refund_v4",
        "sla_p1_2026",
        "it_helpdesk_faq",
        "hr_leave_policy",
        # Sprint 1: nguồn hợp lệ bị baseline bỏ sót — grading gq_d10_10 cần nó.
        "access_control_sop",
    }
)

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DMY_SLASH = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")
# exported_at dạng "YYYY/MM/DD..." (slash) — phải đổi sang ISO để freshness_check parse được.
_SLASH_DATE_PREFIX = re.compile(r"^(\d{4})/(\d{2})/(\d{2})(.*)$")
# doc_id export hỏng rõ ràng (catalog cũ / id lỗi) — tách khỏi nguồn "chưa đăng ký" để alert đúng owner.
_MALFORMED_DOC_ID = re.compile(r"^(invalid_doc_|legacy_)")


def _norm_text(s: str) -> str:
    return " ".join((s or "").strip().split()).lower()


# Cụm meta-leak rò rỉ từ tầng export (không phải nội dung policy thật).
_META_LEAK = ("effective_date không đồng nhất", "Nội dung có thể bị")


def _has_repeated_run(text: str) -> bool:
    """Phát hiện corruption lặp từ/cụm liền kề (vd '... làm việc làm việc làm việc ...')."""
    w = text.split()
    for i in range(len(w) - 1):
        if w[i] == w[i + 1]:
            return True
    for i in range(len(w) - 3):
        if w[i] == w[i + 2] and w[i + 1] == w[i + 3]:  # cụm 2 từ lặp lại
            return True
    return False


def _normalize_exported_at(raw: str) -> Tuple[str, str]:
    """
    Chuẩn hoá exported_at sang ISO (đổi 'YYYY/MM/DD' → 'YYYY-MM-DD', giữ phần giờ).
    Trả về (iso_value, error_reason). exported_at rỗng được cho qua (không chặn).
    """
    s = (raw or "").strip()
    if not s:
        return "", ""
    m = _SLASH_DATE_PREFIX.match(s)
    if m:
        s = f"{m.group(1)}-{m.group(2)}-{m.group(3)}{m.group(4)}"
    try:
        datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return "", "invalid_exported_at_format"
    return s, ""


def _stable_chunk_id(doc_id: str, chunk_text: str, seq: int) -> str:
    h = hashlib.sha256(f"{doc_id}|{chunk_text}|{seq}".encode("utf-8")).hexdigest()[:16]
    return f"{doc_id}_{seq}_{h}"


def _normalize_effective_date(raw: str) -> Tuple[str, str]:
    """
    Trả về (iso_date, error_reason).
    iso_date rỗng nếu không parse được.
    """
    s = (raw or "").strip()
    if not s:
        return "", "empty_effective_date"
    if _ISO_DATE.match(s):
        return s, ""
    m = _DMY_SLASH.match(s)
    if m:
        dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
        return f"{yyyy}-{mm}-{dd}", ""
    return "", "invalid_effective_date_format"


def load_raw_csv(path: Path) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({k: (v or "").strip() for k, v in r.items()})
    return rows


def clean_rows(
    rows: List[Dict[str, str]],
    *,
    apply_refund_window_fix: bool = True,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Trả về (cleaned, quarantine).

    Baseline + mở rộng (Sprint 1–2). Rule mới đánh dấu [NEW]:
    1) Quarantine doc_id ngoài allowlist — [NEW] tách reason malformed_doc_id vs unregistered_source.
    2) Chuẩn hoá effective_date sang YYYY-MM-DD; quarantine nếu không parse được.
    3) Quarantine chunk hr_leave_policy có effective_date < 2026-01-01 (bản HR cũ / conflict version).
    3b) [NEW] Quarantine chunk hr_leave_policy chứa marker '10 ngày phép năm' bất kể ngày
        (export gán nhầm ngày 2026 cho nội dung HR 2025).
    4) Quarantine chunk_text rỗng hoặc effective_date rỗng sau chuẩn hoá.
    4a) [NEW] Quarantine chunk nhiễu/hỏng (prefix 'Nội dung không rõ ràng' hoặc '!!!') — làm nhiễu top-k.
    4b) [NEW] Chuẩn hoá exported_at sang ISO (YYYY/MM/DD → YYYY-MM-DD); quarantine nếu sai định dạng.
    5) Loại trùng nội dung chunk_text (giữ bản đầu).
    6) Fix stale refund: policy_refund_v4 chứa '14 ngày làm việc' → 7 ngày.
    """
    quarantine: List[Dict[str, Any]] = []
    seen_text: set[str] = set()
    cleaned: List[Dict[str, Any]] = []
    seq = 0

    for raw in rows:
        doc_id = raw.get("doc_id", "")
        text = raw.get("chunk_text", "")
        eff_raw = raw.get("effective_date", "")
        exported_at = raw.get("exported_at", "")

        if doc_id not in ALLOWED_DOC_IDS:
            # Sprint 2 rule mới: tách failure mode để observability/alert định tuyến đúng owner.
            #  - malformed_doc_id: id export hỏng (invalid_doc_* / legacy_*) → bug ở hệ nguồn.
            #  - unregistered_source: nguồn có cấu trúc nhưng chưa đăng ký contract → cần onboard.
            reason = "malformed_doc_id" if _MALFORMED_DOC_ID.match(doc_id) else "unregistered_source"
            quarantine.append({**raw, "reason": reason})
            continue

        eff_norm, eff_err = _normalize_effective_date(eff_raw)
        if eff_err == "empty_effective_date":
            quarantine.append({**raw, "reason": "missing_effective_date"})
            continue
        if eff_err == "invalid_effective_date_format":
            quarantine.append({**raw, "reason": eff_err, "effective_date_raw": eff_raw})
            continue

        if doc_id == "hr_leave_policy" and eff_norm < "2026-01-01":
            quarantine.append(
                {
                    **raw,
                    "reason": "stale_hr_policy_effective_date",
                    "effective_date_normalized": eff_norm,
                }
            )
            continue

        # Sprint 1: lọc theo ngày là CHƯA ĐỦ — nhiều chunk bản HR 2025 ("10 ngày phép năm")
        # bị export gán nhầm effective_date 2026 nên vượt qua bộ lọc ngày ở trên.
        # Quarantine theo marker nội dung, bất kể ngày, để bỏ bản phép năm cũ (conflict version).
        if doc_id == "hr_leave_policy" and "10 ngày phép năm" in text:
            quarantine.append(
                {
                    **raw,
                    "reason": "stale_hr_annual_leave_marker",
                    "effective_date_normalized": eff_norm,
                }
            )
            continue

        if not text:
            quarantine.append({**raw, "reason": "missing_chunk_text"})
            continue

        # Sprint 2 rule mới: quarantine chunk export hỏng/nhiễu — bản sao méo của nội dung thật
        # mang prefix "Nội dung không rõ ràng" hoặc marker "!!!". Chúng lọt dedup (prefix khác)
        # và làm nhiễu top-k: đẩy chunk đúng ra khỏi top-5 (gq_d10_06 escalation "10 phút").
        if "Nội dung không rõ ràng" in text or "!!!" in text:
            quarantine.append({**raw, "reason": "low_quality_noise_chunk"})
            continue

        # Sprint 2 rule mới: quarantine chunk corruption — lặp từ/cụm liền kề (export lỗi)
        # hoặc rò rỉ meta-note/truncation. Đây là bản méo của nội dung thật, làm phình index.
        if _has_repeated_run(text) or any(p in text for p in _META_LEAK):
            quarantine.append({**raw, "reason": "low_quality_corrupt_chunk"})
            continue

        # Sprint 2 rule mới: chuẩn hoá exported_at sang ISO (freshness_check cần parse được).
        exp_norm, exp_err = _normalize_exported_at(exported_at)
        if exp_err == "invalid_exported_at_format":
            quarantine.append({**raw, "reason": exp_err, "exported_at_raw": exported_at})
            continue

        key = _norm_text(text)
        if key in seen_text:
            quarantine.append({**raw, "reason": "duplicate_chunk_text"})
            continue
        seen_text.add(key)

        fixed_text = text
        if apply_refund_window_fix and doc_id == "policy_refund_v4":
            if "14 ngày làm việc" in fixed_text:
                fixed_text = fixed_text.replace(
                    "14 ngày làm việc",
                    "7 ngày làm việc",
                )
                fixed_text += " [cleaned: stale_refund_window]"

        seq += 1
        cleaned.append(
            {
                "chunk_id": _stable_chunk_id(doc_id, fixed_text, seq),
                "doc_id": doc_id,
                "chunk_text": fixed_text,
                "effective_date": eff_norm,
                "exported_at": exp_norm or "",
            }
        )

    return cleaned, quarantine


def write_cleaned_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("chunk_id,doc_id,chunk_text,effective_date,exported_at\n", encoding="utf-8")
        return
    fieldnames = ["chunk_id", "doc_id", "chunk_text", "effective_date", "exported_at"]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def write_quarantine_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("chunk_id,doc_id,chunk_text,effective_date,exported_at,reason\n", encoding="utf-8")
        return
    keys: List[str] = []
    seen_k: set[str] = set()
    for r in rows:
        for k in r.keys():
            if k not in seen_k:
                seen_k.add(k)
                keys.append(k)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore", restval="")
        w.writeheader()
        for r in rows:
            w.writerow(r)
