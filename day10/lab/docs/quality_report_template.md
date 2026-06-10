# Quality report — Lab Day 10 (nhóm)

**run_id (clean):** `sprint2-clean`  ·  **run_id (inject):** `inject-bad`
**Ngày:** 2026-06-10
**Embedder:** `paraphrase-multilingual-MiniLM-L12-v2` (đa ngôn ngữ — xem §2)

---

## 1. Tóm tắt số liệu

| Chỉ số | Baseline (chưa fix) | Sau khi fix (clean) | Khi inject corruption |
|--------|----------------------|----------------------|------------------------|
| raw_records | 247 | 247 | 247 |
| cleaned_records | 40 | 32 | 32 |
| quarantine_records | 207 | 215 | 215 |
| Expectation halt? | **CÓ** (E6 hr_stale FAIL) | KHÔNG (8/8 pass) | **CÓ** (E3 refund FAIL, bị `--skip-validate` bỏ qua) |
| Grading 10 câu | (halt, không chạy) | **10/10 pass** | — |

> Quarantine tăng (207→215) sau khi thêm rule vì các chunk noise/corrupt giờ bị bắt đúng
> (8 noise + 4 corrupt) thay vì lọt vào index.

---

## 2. Before / after retrieval (bắt buộc)

Hai file eval (top-k=3, 21 câu golden `data/test_questions.json`):
- **Sau fix (tốt):** `artifacts/eval/eval_after_fix.csv` → **21/21 ok**
- **Khi inject (xấu):** `artifacts/eval/eval_inject_bad.csv` → **20/21 ok**

**Câu then chốt:** refund window (`q_refund_window`) — top1_doc = `policy_refund_v4` cả hai lần.

| | contains_expected | hits_forbidden | Ghi chú |
|---|---|---|---|
| **Sau fix (tốt)** | yes | **no** | cửa sổ "7 ngày" đúng, không lộ "14 ngày" |
| **Khi inject (xấu)** | yes | **yes** | top-k còn chunk stale "14 ngày làm việc" → context sai |

> `hits_forbidden` quét toàn bộ top-k (không chỉ top-1): câu trả lời top-1 nhìn "7 ngày" đúng,
> nhưng context vẫn lẫn chunk "14 ngày" → đây chính là lỗi mà eval phát hiện.

**Merit — versioning HR (`gq_d10_09`, grading set):** sau fix top1=`hr_leave_policy`,
contains "12 ngày" = yes, hits_forbidden ("10 ngày phép năm") = no. Trước fix (baseline) bản HR
2025 "10 ngày" lẫn trong index → câu này sai.

**Lý do đổi embedder:** với `all-MiniLM-L6-v2` (chủ yếu tiếng Anh), chunk escalation "10 phút"
(`gq_d10_06`) rớt xuống rank #8 → ngoài top-5 → grading 9/10. Đổi sang
`paraphrase-multilingual-MiniLM-L12-v2` (đa ngôn ngữ) đưa chunk vào top-5 → **10/10**. Data không đổi.

---

## 3. Freshness & monitor

- SLA chọn: **24 giờ** (`FRESHNESS_SLA_HOURS=24`), đo tại thời điểm `publish` trên `latest_exported_at`.
- Kết quả `freshness_check` trên manifest clean: **FAIL** `freshness_sla_exceeded`
  (`age_hours≈1446`, ~60 ngày — dữ liệu export tháng 4/2026 so với hôm nay 2026-06-10).
- Ý nghĩa: cơ chế **hoạt động đúng** — phát hiện dữ liệu cũ. Trước khi chuẩn hoá `exported_at`
  sang ISO, check này còn không parse được timestamp (WARN `no_timestamp_in_manifest`); sau khi
  thêm rule normalize, nó parse được và báo FAIL đúng bản chất.
- PASS/WARN/FAIL: **PASS** nếu age ≤ SLA · **WARN** nếu thiếu/sai timestamp · **FAIL** nếu quá SLA.
  (Với dữ liệu lab tĩnh, nhóm có thể nới SLA hoặc đo theo run_timestamp — xem runbook.)

---

## 4. Corruption inject (Sprint 3)

- **Lệnh:** `python etl_pipeline.py run --run-id inject-bad --no-refund-fix --skip-validate`
- **Kiểu hỏng:** bỏ rule fix cửa sổ refund → chunk "14 ngày làm việc" (stale) được embed thay vì "7 ngày".
- **Phát hiện 2 tầng:**
  1. Expectation `refund_no_stale_14d_window` **FAIL (halt)** — chặn ở tầng validate (bị `--skip-validate` cố ý bỏ qua để demo).
  2. Eval `q_refund_window` `hits_forbidden` lật từ **no → yes** — phát hiện ở tầng retrieval.
- **Khôi phục:** chạy lại `python etl_pipeline.py run` (chuẩn) → refund violations=0, eval 21/21.

---

## 5. Hạn chế & việc chưa làm

- Eval là keyword-match trên top-k (chưa có LLM-judge); chỉ đo "context có/không chứa", chưa đo chất lượng câu trả lời cuối.
- Freshness dùng SLA tĩnh 24h không hợp với dữ liệu lab cố định → cần phân biệt "tuổi dữ liệu nguồn" vs "tuổi lần publish".
- Rule corruption (lặp từ/meta-leak) dựa trên heuristic; corpus thật cần kiểm thử rộng hơn để tránh false-positive.
