# Worklog — Lab Day 10 (Data Pipeline & Observability)

> Nhật ký công việc. Cập nhật theo tiến độ sprint.

---

## 2026-06-10 — Setup & Phân tích ban đầu (Sprint 1)

### 1. Setup môi trường ✅
- Python 3.14.0 trên Windows (PowerShell).
- Tạo venv: `python -m venv lab\.venv`.
- Cài deps: `lab\.venv\Scripts\python.exe -m pip install -r lab\requirements.txt`
  - Gói nặng: torch 2.12 (123 MB), scipy, onnxruntime, chromadb, sentence-transformers.
- Tạo `.env` từ `.env.example` (giữ cấu hình mặc định: `CHROMA_COLLECTION=day10_kb`,
  `EMBEDDING_MODEL=all-MiniLM-L6-v2`, `FRESHNESS_SLA_HOURS=24`).
- Kích hoạt venv: `cd lab; .venv\Scripts\Activate.ps1`
  (nếu bị chặn: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`).

### 2. Chạy pipeline lần đầu — HALT (đúng đề bài) ✅
Lệnh: `python etl_pipeline.py run` → **exit code 2 (PIPELINE_HALT)**.

```
run_id=2026-06-10T06-01Z
raw_records=247  cleaned_records=40  quarantine_records=207
E1 min_one_row .................. OK
E2 no_empty_doc_id .............. OK
E3 refund_no_stale_14d_window ... OK
E4 chunk_min_length_8 ........... OK (warn)
E5 effective_date_iso ........... OK
E6 hr_leave_no_stale_10d_annual . FAIL (halt) :: violations=2   <-- nguyên nhân HALT
```

### 3. Phân tích raw data ✅
`data/raw/policy_export_dirty.csv` = 247 dòng. Phân bố doc_id:
- Hợp lệ (grading cần): policy_refund_v4 (33), sla_p1_2026 (31), it_helpdesk_faq (26),
  hr_leave_policy (40), **access_control_sop (8)**.
- Noise/legacy (không grading nào cần → để quarantine): legacy_catalog_xyz_zzz (31),
  data_privacy_guideline (29), security_policy (18), invalid_doc_* (~35).

### 4. Hai lỗ hổng đã xác định 🐞 (ĐÃ SỬA ở Sprint 1)

**Lỗ hổng 1 — thiếu nguồn `access_control_sop`:**
- `transform/cleaning_rules.py:17-24` — `ALLOWED_DOC_IDS` chỉ có 4 doc_id, thiếu
  `access_control_sop` → 8 dòng bị quarantine reason `unknown_doc_id`.
- Hậu quả: câu **gq_d10_10** (Level 4 Admin → IT Manager/CISO) không thể pass.
- Cách sửa: thêm `"access_control_sop"` vào `ALLOWED_DOC_IDS` (+ đồng bộ
  `contracts/data_contract.yaml`).

**Lỗ hổng 2 — HALT do HR stale "10 ngày phép năm":**
- 26/40 dòng hr_leave_policy chứa marker bản cũ "10 ngày phép năm" (HR 2025).
- Rule hiện tại (`cleaning_rules.py:104`) chỉ quarantine khi `effective_date < 2026-01-01`,
  nhưng 9 dòng stale bị gán nhầm ngày 2026 → lọt lưới. Sau dedup còn 2 chunk unique →
  E6 báo `violations=2` → HALT.
- Câu **gq_d10_09** cần "12 ngày", `must_not_contain` "10 ngày phép năm".
- Cách sửa: thêm content-based rule quarantine hr_leave_policy chứa "10 ngày phép năm"
  **bất kể ngày** (đặt sau khối check ngày HR, ~dòng 112).

---

---

## 2026-06-10 — Sprint 1 hoàn thành ✅

**Đã sửa (file thay đổi):**
- `transform/cleaning_rules.py`:
  - Thêm `access_control_sop` vào `ALLOWED_DOC_IDS` (lỗ hổng 1).
  - Thêm rule content-based quarantine hr_leave_policy chứa "10 ngày phép năm"
    (reason `stale_hr_annual_leave_marker`) bất kể ngày (lỗ hổng 2).
- `contracts/data_contract.yaml`: đồng bộ allowlist + canonical_sources (access_control_sop),
  thêm quality_rule `no_stale_hr_annual_leave`.
- `docs/data_contract.md`: điền source map (5 nguồn + failure mode + metric), schema, quy tắc
  quarantine/drop, phiên bản canonical.

**Kết quả `etl_pipeline.py run` (run_id=2026-06-10T06-11Z):**
- `raw_records=247  cleaned_records=44  quarantine_records=203` → **PIPELINE_OK, exit 0**.
- Cả 6 expectation pass (E6 `hr_leave_no_stale_10d_annual` violations=0).
- Cleaned doc_id: policy_refund_v4=14, it_helpdesk_faq=10, sla_p1_2026=7, hr_leave_policy=7,
  access_control_sop=6. Stale HR còn sót = 0. Embedded 44 chunks → collection day10_kb.
- Lưu ý: freshness báo WARN `no_timestamp_in_manifest` → để xử lý ở Sprint 4 (monitoring).

**DoD Sprint 1:** ✅ log có raw/cleaned/quarantine/run_id; ✅ hiểu & giải quyết HALT;
✅ source map trong data_contract.md.

---

---

## 2026-06-10 — Phase 2 (Sprint 2) hoàn thành ✅

**5 rule cleaning mới (vượt yêu cầu ≥3), file `transform/cleaning_rules.py`:**
1. `stale_hr_annual_leave_marker` — quarantine HR "10 ngày phép năm" bất kể ngày *(Phase 1)*.
2. Routing doc_id ngoài allowlist → tách `malformed_doc_id` (invalid_doc_*/legacy_*) vs
   `unregistered_source` (nguồn chưa đăng ký) — observability/alert đúng owner.
3. `low_quality_noise_chunk` — quarantine chunk prefix "Nội dung không rõ ràng" / "!!!".
4. `low_quality_corrupt_chunk` — quarantine lặp từ/cụm ("làm việc làm việc") + meta-leak
   ("effective_date không đồng nhất", "Nội dung có thể bị" truncation).
5. Chuẩn hoá `exported_at` slash→ISO (+ quarantine `invalid_exported_at_format`).

**2 expectation mới (file `quality/expectations.py`):**
- E7 `all_required_sources_present` (halt) — đủ 5 nguồn hợp lệ trong cleaned.
- E8 `exported_at_iso` (warn) — exported_at đã ISO (freshness parse được).

**Metric impact (đo thực tế):**
| Thay đổi | Trước | Sau |
|----------|-------|-----|
| cleaned_records | 40 (baseline halt) | 32 |
| quarantine reasons | `unknown_doc_id`=109 | `malformed_doc_id`=62 + `unregistered_source`=47 |
| noise/corrupt chunks trong index | 8 noise + ~4 corrupt | 0 |
| exported_at dạng slash trong cleaned | 16 | 0 |
| Expectations | 6 (1 FAIL→halt) | 8 (tất cả pass) |
| Grading 10 câu | (baseline halt) | **10/10 pass** |

**Embedder upgrade (Embed Owner):** đổi `.env` EMBEDDING_MODEL
`all-MiniLM-L6-v2` → `paraphrase-multilingual-MiniLM-L12-v2`. Lý do: model cũ (chủ yếu EN)
xếp chunk escalation "10 phút" (gq_d10_06) ở rank #8 → rớt top-5. Data đã đúng & sạch; model
đa ngôn ngữ đưa chunk lên top-5 → gq_d10_06 pass. Xoá `chroma_db` re-embed sạch (384-dim, cùng chiều).

**Kết quả:** `etl_pipeline.py run` exit 0, 8/8 expectation pass, grading **10/10**.

**Lưu ý freshness:** sau khi exported_at được chuẩn hoá ISO, freshness_check chuyển từ
WARN (`no_timestamp_in_manifest` — lỗi parse) sang FAIL (`freshness_sla_exceeded`) vì dữ liệu
mẫu cũ ~60 ngày so với SLA 24h. Đây là phát hiện đúng (cơ chế hoạt động). Xử lý/giải thích ở Phase 4.

---

## TODO — còn lại

### Sprint 2 — DONE ✅
- [x] 5 rule mới + 2 expectation mới (metric_impact đo được).
- [x] `etl_pipeline.py run` exit 0, grading 10/10.
- [ ] Ghi bảng *metric_impact* vào `reports/group_report.md` *(làm ở Phase 5)*.

---

## 2026-06-10 — Phase 3 (Sprint 3) hoàn thành ✅

**Chuỗi inject before/after:**
1. eval index tốt → `artifacts/eval/eval_after_fix.csv` (**21/21 ok**).
2. inject: `run --run-id inject-bad --no-refund-fix --skip-validate` → E3 refund FAIL(violations=1),
   skip-validate vẫn embed chunk stale "14 ngày".
3. eval index xấu → `artifacts/eval/eval_inject_bad.csv` (**20/21** — `q_refund_window` regress).
4. khôi phục: `run --run-id sprint2-clean` → refund violations=0, exit 0.

**Bằng chứng regress (`q_refund_window`):** hits_forbidden lật `no → yes` (top-k lẫn chunk "14 ngày");
top1 vẫn policy_refund_v4 → minh hoạ "câu trả lời nhìn đúng nhưng context còn stale".

**Phát hiện 2 tầng:** (1) expectation refund FAIL ở validate; (2) eval hits_forbidden ở retrieval.

**Deliverable:** 2 file eval + `docs/quality_report_template.md` đã điền đầy đủ (số liệu, before/after,
freshness, kịch bản inject, hạn chế).

### Sprint 3 — DONE ✅

---

## 2026-06-10 — Phase 4 (Sprint 4) hoàn thành ✅

- Chạy `etl_pipeline.py freshness --manifest manifest_sprint2-clean.json` → **FAIL** exit 1
  (`age_hours≈1446`, ~60 ngày vs SLA 24h) — phát hiện đúng, đã giải thích trong runbook.
- Điền `docs/pipeline_architecture.md`: sơ đồ Mermaid (raw→clean→validate→embed→serve + quarantine/manifest/freshness),
  ranh giới owner, idempotency (upsert chunk_id + prune), liên hệ Day 09, rủi ro.
- Điền `docs/runbook.md`: incident refund/HR stale (symptom→detection→diagnosis→mitigation→prevention)
  + bảng giải thích freshness PASS/WARN/FAIL.
- `docs/data_contract.md` đã xong ở Phase 1; `docs/quality_report_template.md` xong ở Phase 3.
- Grading cuối: **10/10**.

### Sprint 4 — DONE ✅

---

## 2026-06-10 — Phase 5 (Hoàn thiện deliverables) ✅

- `contracts/data_contract.yaml`: điền `owner_team`, `alert_channel` (#incident-p1).
- `reports/group_report.md`: điền 6 mục + **bảng metric_impact 8 dòng** (số liệu thật, chứng cứ artifact).
  Giữ trống danh tính nhóm (tên/email) để nhóm tự điền.
- `reports/individual/cleaning_quality_owner.md`: báo cáo cá nhân mẫu (vai Cleaning/Quality Owner) với
  run_id + dòng eval thật — mỗi thành viên copy & sửa cho phần mình.
- `instructor_quick_check.py`: 10/10 GRADE_CHECK OK + manifest OK.
- **Verify cuối (một lệnh `python etl_pipeline.py run`):** exit 0, 8/8 expectation pass, freshness FAIL
  (đúng SLA), grading **10/10**.

### Sprint 5 / Deliverables — DONE ✅

---

## 🏁 Tổng kết toàn lab

| Phase (Sprint) | Trạng thái | Kết quả chính |
|----------------|-----------|----------------|
| 1 — Phân tích & Ingest | ✅ | Phát hiện + sửa 2 lỗ hổng (allowlist access_control, HR stale marker) |
| 2 — Clean + validate + embed | ✅ | 5 rule mới + 2 expectation mới, exit 0, grading 10/10, đổi embedder multilingual |
| 3 — Inject corruption | ✅ | before/after eval (21/21 vs 20/21), q_refund_window regress, quality report |
| 4 — Monitoring + docs | ✅ | freshness PASS/WARN/FAIL, pipeline_architecture + runbook + data_contract |
| 5 — Deliverables | ✅ | group_report + metric_impact, individual mẫu, contract owner/SLA, instructor check |

**Số liệu cuối:** raw=247 · cleaned=32 · quarantine=215 · 8/8 expectation pass · grading **10/10** · freshness FAIL (đúng, data cũ 60 ngày).

**Còn cần nhóm tự làm:** điền tên/email thành viên trong group_report; mỗi người viết individual report của mình.

### Sprint 3 — Inject corruption & before/after
- [ ] `python etl_pipeline.py run --run-id inject-bad --no-refund-fix --skip-validate`
- [ ] Lưu 2 file eval so sánh (before/after) + quality report.

### Sprint 4 — Monitoring + docs
- [ ] Freshness check, runbook, 3 docs.
- [ ] `python grading_run.py` lần cuối → 10 câu pass.
- [ ] group_report.md + individual reports.

### Lệnh kiểm tra (sau khi sửa)
```powershell
.venv\Scripts\python.exe etl_pipeline.py run                               # phải exit 0
.venv\Scripts\python.exe eval_retrieval.py --out artifacts/eval/eval_after_fix.csv
.venv\Scripts\python.exe grading_run.py --out artifacts/eval/grading_run.jsonl
```
Mục tiêu: 10 câu `gq_d10_01..10` đều `contains_expected=true`, `hits_forbidden=false`.
