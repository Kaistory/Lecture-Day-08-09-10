"""
Cấu hình BE + cầu nối tới lab Day 10.

Import module này TRƯỚC khi import bất kỳ module nào của lab (transform/quality/monitoring/etl_pipeline)
vì nó chèn thư mục lab vào sys.path và nạp lab/.env.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent          # day10/BE/app
BE_DIR = APP_DIR.parent                              # day10/BE
DAY10_DIR = BE_DIR.parent                            # day10
LAB_DIR = DAY10_DIR / "lab"                          # day10/lab

# 1) Cho phép import package của lab (transform/, quality/, monitoring/, etl_pipeline.py)
if str(LAB_DIR) not in sys.path:
    sys.path.insert(0, str(LAB_DIR))

# 2) Nạp lab/.env (không ghi đè biến môi trường thật đã set)
load_dotenv(LAB_DIR / ".env", override=False)

# 3) Chuẩn hoá CHROMA_DB_PATH thành tuyệt đối (lab/.env để './chroma_db' tương đối theo cwd của lab).
#    BE chạy từ thư mục khác nên phải trỏ tuyệt đối tới lab/chroma_db để dùng CHUNG index đã build.
_chroma = os.environ.get("CHROMA_DB_PATH", "./chroma_db")
if not os.path.isabs(_chroma):
    _chroma = str((LAB_DIR / _chroma).resolve())
os.environ["CHROMA_DB_PATH"] = _chroma

CHROMA_DB_PATH = _chroma
CHROMA_COLLECTION = os.environ.get("CHROMA_COLLECTION", "day10_kb")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
FRESHNESS_SLA_HOURS = float(os.environ.get("FRESHNESS_SLA_HOURS", "24"))

# Đường dẫn artifact/dữ liệu (tuyệt đối, theo lab)
ARTIFACTS_DIR = LAB_DIR / "artifacts"
DOCS_DIR = LAB_DIR / "data" / "docs"          # tài liệu nguồn canonical (.txt) theo doc_id
RAW_DEFAULT = LAB_DIR / "data" / "raw" / "policy_export_dirty.csv"
TEST_QUESTIONS = LAB_DIR / "data" / "test_questions.json"
GRADING_QUESTIONS = LAB_DIR / "data" / "grading_questions.json"

# artifact_type hợp lệ cho API 5
ARTIFACT_TYPES = {"logs", "manifests", "quarantine", "cleaned", "eval"}
