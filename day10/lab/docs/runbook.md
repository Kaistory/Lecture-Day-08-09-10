# Runbook — Lab Day 10 (incident tối giản)

**Incident mẫu:** Agent trả lời sai cửa sổ hoàn tiền ("14 ngày" thay vì 7 ngày).

---

## Symptom

> User/agent trả lời "khách có **14 ngày** để yêu cầu hoàn tiền" — sai chính sách hiện hành (v4 = **7 ngày làm việc**).
> Hoặc agent nói "**10 ngày phép năm**" thay vì 12 ngày (bản HR 2025 cũ).

---

## Detection

| Metric / check | Tín hiệu |
|----------------|----------|
| Expectation `refund_no_stale_14d_window` | FAIL (halt) khi cleaned còn chunk "14 ngày làm việc" |
| Expectation `hr_leave_no_stale_10d_annual` | FAIL (halt) khi còn "10 ngày phép năm" |
| Eval `q_refund_window.hits_forbidden` | lật `no → yes` (top-k lẫn chunk stale) |
| `freshness_check` | WARN/FAIL → dữ liệu cũ hoặc timestamp lỗi |

---

## Diagnosis

| Bước | Việc làm | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Mở `artifacts/manifests/manifest_<run-id>.json` | Xác nhận `run_id`, `cleaned_records`, `latest_exported_at`, `no_refund_fix` |
| 2 | Mở `artifacts/quarantine/quarantine_<run-id>.csv`, lọc `reason` | Thấy stale/noise/corrupt đã bị loại đúng chưa |
| 3 | `python eval_retrieval.py --out artifacts/eval/check.csv` | Xem `hits_forbidden`/`contains_expected` câu nghi vấn |
| 4 | Theo debug order (slide): freshness → volume/errors → schema/contract → lineage(run_id) → model/prompt | Khoanh vùng tầng lỗi |

---

## Mitigation

- **Refund/HR stale**: chạy lại pipeline chuẩn `python etl_pipeline.py run` (rule fix + quarantine + prune
  sẽ thay chunk stale; index = snapshot publish mới). Xác nhận expectation pass + eval `hits_forbidden=no`.
- **Index nhiễm bẩn sau inject**: rerun chuẩn để prune id "14 ngày"; nếu cần sạch tuyệt đối, xoá `chroma_db/` rồi rerun.
- **Tạm thời**: bật banner "data có thể stale" cho tới khi freshness PASS.

---

## Freshness PASS / WARN / FAIL (giải thích SLA)

`python etl_pipeline.py freshness --manifest artifacts/manifests/manifest_<run-id>.json`

| Trạng thái | Điều kiện | Hành động |
|-----------|-----------|-----------|
| **PASS** | `age_hours ≤ SLA` (24h) | OK |
| **WARN** | Manifest thiếu/sai timestamp (`no_timestamp_in_manifest`) | Sửa pipeline để ghi/chuẩn hoá `exported_at` (đã fix bằng rule normalize ISO) |
| **FAIL** | `age_hours > SLA` (`freshness_sla_exceeded`) | Dữ liệu cũ → re-ingest / cảnh báo owner |

> **Trạng thái hiện tại:** FAIL (`age_hours≈1446`, ~60 ngày) vì dữ liệu mẫu export tháng 4/2026 so với
> hôm nay (2026-06-10) vượt SLA 24h. Đây là **phát hiện đúng** của cơ chế. Với dữ liệu lab tĩnh, có thể
> nới `FRESHNESS_SLA_HOURS` hoặc đo theo `run_timestamp` (tuổi lần publish) thay vì tuổi nguồn.

---

## Prevention

- Giữ expectation **halt** cho stale refund/HR + nguồn bắt buộc (`all_required_sources_present`).
- Alert routing theo `reason` quarantine: `malformed_doc_id` → báo hệ nguồn; `unregistered_source` → onboard contract.
- Đăng ký nguồn mới đồng bộ `cleaning_rules.ALLOWED_DOC_IDS` ↔ `contracts/data_contract.yaml`.
- Nối Day 11: thêm guardrail/alert tự động khi freshness FAIL hoặc expectation halt.
