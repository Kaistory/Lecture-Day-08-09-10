# Báo Cáo Cá Nhân — Lab Day 10: Data Pipeline & Observability

**Họ và tên:** Dương Quang Khải
**Vai trò:** Cleaning & Quality Owner
**Ngày nộp:** 2026-06-10
**Độ dài yêu cầu:** 400–650 từ

---

## 1. Tôi phụ trách phần nào? (80–120 từ)

**File / module:** `transform/cleaning_rules.py`, `quality/expectations.py`.

Tôi phân tích raw CSV (247 record), phát hiện pipeline baseline bỏ sót nguồn `access_control_sop`
và để lọt dữ liệu stale/noise. Tôi thêm 5 rule cleaning mới và 2 expectation mới, đảm bảo
`python etl_pipeline.py run` exit 0 với 8/8 expectation pass.

**Kết nối với thành viên khác:** Embed Owner phụ thuộc cleaned CSV của tôi để upsert đúng; Monitoring
Owner dùng `exported_at` ISO (tôi normalize) để freshness parse được.

**Bằng chứng:** commit `transform/cleaning_rules.py` (rule `stale_hr_annual_leave_marker`,
`low_quality_noise_chunk`, `low_quality_corrupt_chunk`, routing doc_id, normalize exported_at).

---

## 2. Một quyết định kỹ thuật (100–150 từ)

Tôi chọn **halt** cho `hr_leave_no_stale_10d_annual` và `all_required_sources_present` (lỗi nội dung
sai version / thiếu nguồn là không chấp nhận được), nhưng để **warn** cho `exported_at_iso` và
`chunk_min_length_8` (vấn đề chất lượng, không nên chặn publish). Với HR stale, tôi nhận ra lọc theo
`effective_date < 2026-01-01` là **chưa đủ**: nhiều chunk bản 2025 ("10 ngày phép năm") bị export gán
nhầm ngày 2026 nên vượt bộ lọc ngày. Tôi bổ sung rule lọc **theo marker nội dung** bất kể ngày — quyết
định này giảm 8 chunk stale và đưa E6 từ FAIL→pass.

---

## 3. Một lỗi hoặc anomaly đã xử lý (100–150 từ)

**Triệu chứng:** grading `gq_d10_06` (escalation P1 "10 phút") fail `contains_expected=false` dù top1
đúng `sla_p1_2026`. **Phát hiện:** tôi query trực tiếp collection và thấy top-5 bị 2 chunk noise
"Nội dung không rõ ràng: !!!Ticket P1…15 phút…" chiếm chỗ, đẩy chunk "10 phút" xuống rank #8. **Fix:**
thêm rule `low_quality_noise_chunk` quarantine chunk prefix "Nội dung không rõ ràng"/"!!!". Sau đó vẫn
còn rank #8 do embedder EN-centric → phối hợp Embed Owner đổi sang model đa ngôn ngữ → `gq_d10_06` pass.

---

## 4. Bằng chứng trước / sau (80–120 từ)

`run_id=sprint2-clean` (tốt) vs `inject-bad` (xấu), từ `artifacts/eval/`:

```
q_refund_window | GOOD eval_after_fix.csv  : contains=yes hits_forbidden=no
q_refund_window | BAD  eval_inject_bad.csv : contains=yes hits_forbidden=yes
```

Khi inject `--no-refund-fix`, chunk stale "14 ngày" lọt index → `hits_forbidden` lật no→yes. Rule fix
refund + prune của pipeline chuẩn khôi phục về `no` (eval 21/21).

---

## 5. Cải tiến tiếp theo (40–80 từ)

Thêm test đơn vị cho từng rule (pytest) với fixture nhỏ, để `_has_repeated_run` không false-positive
trên corpus thật; và tách SLA freshness thành "tuổi nguồn" vs "tuổi publish" để tránh FAIL giả với
dữ liệu lab tĩnh.
