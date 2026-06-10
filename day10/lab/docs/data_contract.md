# Data contract — Lab Day 10

> Bắt đầu từ `contracts/data_contract.yaml` — mở rộng và đồng bộ file này.

---

## 1. Nguồn dữ liệu (source map)

| Nguồn | Phương thức ingest | Failure mode chính | Metric / alert |
|-------|-------------------|-------------------|----------------|
| `policy_refund_v4` | CSV export → `policy_export_dirty.csv` | Chunk stale "14 ngày làm việc" (đúng v4 = 7 ngày) | `refund_no_stale_14d_window` violations (halt) |
| `sla_p1_2026` | CSV export | Lẫn giá trị SLA sai version | `quarantine_records` theo doc_id; eval gq_d10_04..06 |
| `it_helpdesk_faq` | CSV export | FAQ trùng lặp nội dung | `duplicate_chunk_text` count |
| `hr_leave_policy` | CSV export | Conflict version: bản 2025 "10 ngày phép năm" gán nhầm ngày 2026 (v2026 = 12 ngày) | `hr_leave_no_stale_10d_annual` violations (halt) |
| `access_control_sop` | CSV export | **Baseline bỏ sót khỏi allowlist** → quarantine nhầm `unknown_doc_id` | `quarantine_records` reason=unknown_doc_id; grading gq_d10_10 |

> Nguồn noise/legacy bị quarantine có chủ đích (không grading nào cần): `legacy_catalog_xyz_zzz`,
> `data_privacy_guideline`, `security_policy`, `invalid_doc_*`.

---

## 2. Schema cleaned

| Cột | Kiểu | Bắt buộc | Ghi chú |
|-----|------|----------|---------|
| chunk_id | string | Có | Hash ổn định = sha256(doc_id\|text\|seq)[:16], dùng để upsert idempotent |
| doc_id | string | Có | Khóa logic tài liệu, phải thuộc `ALLOWED_DOC_IDS` (5 nguồn hợp lệ) |
| chunk_text | string | Có | Đã chuẩn hoá; refund đã fix 14→7 ngày; min_length 8 |
| effective_date | date | Có | Chuẩn hoá về `YYYY-MM-DD` (parse cả `DD/MM/YYYY`) |
| exported_at | datetime | Có | Mốc export nguồn, dùng cho freshness SLA |

---

## 3. Quy tắc quarantine vs drop

- **Quarantine** (giữ lại để audit, không embed): ghi ra `artifacts/quarantine/quarantine_<run-id>.csv`
  kèm cột `reason`. Các reason hiện có: `unknown_doc_id`, `missing_effective_date`,
  `invalid_effective_date_format`, `stale_hr_policy_effective_date`,
  `stale_hr_annual_leave_marker`, `missing_chunk_text`, `duplicate_chunk_text`.
- **Merge lại:** nếu một nguồn quarantine hoá ra hợp lệ (như `access_control_sop`), Cleaning/Quality
  Owner cập nhật `ALLOWED_DOC_IDS` + `contracts/data_contract.yaml` rồi chạy lại pipeline.
- **Drop thật:** không drop âm thầm — mọi record bị loại đều vào quarantine để đếm được.

---

## 4. Phiên bản & canonical

- **Refund:** source of truth = `data/docs/policy_refund_v4.txt` (v4, cửa sổ **7 ngày làm việc**).
  Mọi chunk "14 ngày" là bản cũ → bị fix hoặc quarantine.
- **HR leave:** canonical = bản **2026** (`12 ngày phép năm` cho <3 năm KN). Bản 2025
  ("10 ngày phép năm") bị quarantine bất kể `effective_date`. Cutoff: `hr_leave_min_effective_date: 2026-01-01`.
