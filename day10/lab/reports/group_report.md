# Báo Cáo Nhóm — Lab Day 10: Data Pipeline & Data Observability

**Tên nhóm:** ___________
**Thành viên:**
| Tên | Vai trò (Day 10) | Email |
|-----|------------------|-------|
| ___ | Ingestion / Raw Owner | ___ |
| ___ | Cleaning & Quality Owner | ___ |
| ___ | Embed & Idempotency Owner | ___ |
| ___ | Monitoring / Docs Owner | ___ |

**Ngày nộp:** 2026-06-10
**Repo:** ___________
**Độ dài khuyến nghị:** 600–1000 từ

---

> **Nộp tại:** `reports/group_report.md`
> Có **run_id** (`sprint2-clean`, `inject-bad`), **artifact** (`artifacts/…`), và **before/after** (`artifacts/eval/`).

---

## 1. Pipeline tổng quan (150–200 từ)

Nguồn raw là một CSV export bẩn (`data/raw/policy_export_dirty.csv`, 247 record) mô phỏng export từ
5+ hệ thống nguồn (CS refund, SLA, IT FAQ, HR leave, Access Control) lẫn legacy/invalid. Pipeline chạy
**ingest → clean → validate → embed → (freshness)**:

```bash
python etl_pipeline.py run        # ingest→clean→validate→embed, exit 0 khi sạch
```

`run_id` sinh ở `cmd_run` (UTC timestamp hoặc `--run-id`) và xuất hiện trên log, `cleaned_*.csv`,
`quarantine_*.csv`, `manifest_*.json` và metadata mỗi vector → lineage truy vết được. Sau embed, manifest
ghi `latest_exported_at` để `freshness_check` đánh giá SLA. Index Chroma `day10_kb` tách riêng khỏi Day 09.

---

## 2. Cleaning & expectation (150–200 từ)

Baseline có sẵn: allowlist doc_id, chuẩn hoá ngày ISO, lọc HR theo ngày, fix refund 14→7, dedupe.
Nhóm **thêm 5 rule mới** + **2 expectation mới**. Expectation **halt**: `min_one_row`, `no_empty_doc_id`,
`refund_no_stale_14d_window`, `effective_date_iso`, `hr_leave_no_stale_10d_annual`, `all_required_sources_present`.
Expectation **warn**: `chunk_min_length_8`, `exported_at_iso`.

### 2a. Bảng metric_impact (bắt buộc — chống trivial)

| Rule / Expectation mới | Trước | Sau / khi inject | Chứng cứ |
|------------------------|-------|------------------|----------|
| Allowlist `access_control_sop` | gq_d10_10 fail (nguồn bị quarantine `unknown_doc_id`) | 6 chunk vào index, gq_d10_10 pass | `cleaned_sprint2-clean.csv` |
| Rule `stale_hr_annual_leave_marker` | E6 FAIL violations=2 → HALT | E6 pass, 8 chunk "10 ngày" bị quarantine | log run / quarantine.csv |
| Routing `malformed_doc_id` vs `unregistered_source` | `unknown_doc_id`=109 (gộp) | 62 + 47 (tách failure mode) | quarantine reasons |
| Rule `low_quality_noise_chunk` | 8 chunk "Nội dung không rõ ràng/!!!" trong index | 0 (quarantine) | grading gq_d10_06 cải thiện |
| Rule `low_quality_corrupt_chunk` | ~4 chunk lặp từ/meta-leak | 0; cleaned 36→32 | quarantine.csv |
| Rule normalize `exported_at` ISO | 16 dòng slash; freshness WARN (parse lỗi) | 0 slash; freshness parse được (FAIL đúng SLA) | manifest |
| E7 `all_required_sources_present` | thiếu access_control → sẽ FAIL | missing_sources=[] | log expectation |
| E8 `exported_at_iso` (warn) | non_iso=16 | non_iso=0 | log expectation |

**Một lần expectation fail & xử lý:** khi inject `--no-refund-fix`, `refund_no_stale_14d_window` FAIL
(violations=1) — bị `--skip-validate` bỏ qua để demo; khôi phục bằng rerun chuẩn → violations=0.

---

## 3. Before / after ảnh hưởng retrieval (200–250 từ)

**Kịch bản inject (Sprint 3):** `python etl_pipeline.py run --run-id inject-bad --no-refund-fix --skip-validate`
→ chunk stale "14 ngày làm việc" được embed thay vì "7 ngày".

**Kết quả định lượng** (eval top-k=3, 21 câu `data/test_questions.json`):

| File | Tổng | `q_refund_window` hits_forbidden |
|------|------|----------------------------------|
| `eval_after_fix.csv` (tốt) | **21/21 ok** | **no** |
| `eval_inject_bad.csv` (xấu) | **20/21 ok** | **yes** |

Câu `q_refund_window` regress: top1 vẫn `policy_refund_v4` (nhìn "đúng") nhưng `hits_forbidden` lật
`no→yes` vì top-k còn chunk "14 ngày" — minh hoạ "context vẫn stale dù câu trả lời nhìn ổn". Sau khi
rerun pipeline chuẩn (prune id "14 ngày"), eval trở lại 21/21.

**Grading chính thức (10 câu):** **10/10 pass**. Riêng `gq_d10_06` (escalation "10 phút") ban đầu rớt
top-5 do embedder `all-MiniLM-L6-v2` (EN-centric) xếp hạng kém tiếng Việt; đổi sang
`paraphrase-multilingual-MiniLM-L12-v2` đưa chunk vào top-5 — **data không đổi**, chỉ đổi embedder.

---

## 4. Freshness & monitoring (100–150 từ)

SLA chọn **24 giờ**, đo tại `publish` trên `latest_exported_at`. Trạng thái: **PASS** nếu age ≤ SLA;
**WARN** nếu manifest thiếu/sai timestamp; **FAIL** nếu vượt SLA. Trên manifest `sprint2-clean`:
**FAIL** (`freshness_sla_exceeded`, `age_hours≈1446` ~60 ngày) vì dữ liệu mẫu export tháng 4/2026 so với
hôm nay 2026-06-10. Đáng chú ý: trước khi thêm rule chuẩn hoá `exported_at`, check này còn **không parse
được** timestamp (WARN `no_timestamp_in_manifest`) — tức là một lỗi data che lấp tín hiệu freshness thật.
Sau khi normalize ISO, monitoring báo đúng bản chất. Xem chi tiết PASS/WARN/FAIL trong `docs/runbook.md`.

---

## 5. Liên hệ Day 09 (50–100 từ)

Cùng corpus `data/docs/` (CS + IT Helpdesk) như Day 08/09 nhưng xử lý lớp export raw. Tách collection
`day10_kb` để before/after và inject corruption không phá index Day 09. Sau khi publish sạch (exit 0,
grading 10/10), collection này có thể thay nguồn retrieval cho multi-agent Day 09 với dữ liệu đã version-đúng.

---

## 6. Rủi ro còn lại & việc chưa làm

- Freshness SLA tĩnh 24h không hợp dữ liệu lab cố định → cần tách tuổi-nguồn vs tuổi-publish.
- Đã thêm **LLM-judge (Merit)** `eval_llm_judge.py` (gpt-4o-mini, RAG answer + judge) → 10/10 pass,
  score 5/5, faithful=True (`artifacts/eval/llm_judge.jsonl`); keyword-match vẫn giữ làm gate nhanh.
- Rule corruption (lặp từ/meta-leak) là heuristic → cần kiểm thử rộng tránh false-positive.
- Embedder multilingual nặng hơn; cân nhắc cache/model nhỏ hơn nếu cần tốc độ.
