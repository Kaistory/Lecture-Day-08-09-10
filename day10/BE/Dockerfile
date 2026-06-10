# BE Orchestrator — build context = thư mục day10/ (cần cả lab/ và BE/).
#   docker build -f BE/Dockerfile -t day10-be .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 1) Cài deps trước (tận dụng layer cache). lab cần torch/sentence-transformers/chromadb; BE cần fastapi.
COPY lab/requirements.txt /app/lab/requirements.txt
COPY BE/requirements.txt /app/BE/requirements.txt
RUN pip install --upgrade pip \
 && pip install -r /app/lab/requirements.txt -r /app/BE/requirements.txt

# 2) Copy mã nguồn (lab modules + BE app). .dockerignore loại .venv/.env/chroma_db/artifacts.
COPY lab /app/lab
COPY BE /app/BE

WORKDIR /app/BE
EXPOSE 8000

# Mặc định trỏ tới index dùng chung trong volume (compose set thêm CHROMA_DB_PATH tuyệt đối).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
