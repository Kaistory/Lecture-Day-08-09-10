#!/usr/bin/env python3
"""
LLM-judge eval (Merit) — mở rộng eval keyword bằng LLM.

Quy trình mỗi câu:
  1) Retrieve top-k chunk từ Chroma (giống grading_run.py).
  2) ANSWER: LLM trả lời CHỈ dựa trên context retrieve được (đo chất lượng RAG, không chỉ keyword).
  3) JUDGE: một LLM-giám khảo chấm câu trả lời theo grading_criteria + must_not_contain → JSON verdict.

Yêu cầu:
  - Đã chạy `python etl_pipeline.py run` để có collection Chroma.
  - `.env` có OPENAI_API_KEY (xem README — phần Merit).

  python eval_llm_judge.py --out artifacts/eval/llm_judge.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
ROOT = Path(__file__).resolve().parent

ANSWER_SYSTEM = (
    "Bạn là trợ lý hỗ trợ nội bộ. CHỈ trả lời dựa trên CONTEXT được cung cấp. "
    "Nếu context không đủ thông tin, trả lời đúng câu: 'Không đủ thông tin trong tài liệu.' "
    "Trả lời ngắn gọn bằng tiếng Việt, nêu đúng con số/điều kiện nếu có."
)

JUDGE_SYSTEM = (
    "Bạn là giám khảo chấm chất lượng câu trả lời của hệ thống RAG. "
    "Chấm khách quan dựa trên tiêu chí và context. Chỉ xuất JSON hợp lệ, không thêm chữ nào khác."
)


def build_judge_prompt(q, answer, context):
    return (
        f"CÂU HỎI:\n{q['question']}\n\n"
        f"CONTEXT ĐÃ RETRIEVE (top-k):\n{context}\n\n"
        f"CÂU TRẢ LỜI CỦA HỆ THỐNG:\n{answer}\n\n"
        f"TIÊU CHÍ CHẤM (grading_criteria):\n- " + "\n- ".join(q.get("grading_criteria", [])) + "\n\n"
        f"PHẢI chứa ít nhất một trong: {q.get('must_contain_any', [])}\n"
        f"KHÔNG được chứa (stale/sai): {q.get('must_not_contain', [])}\n\n"
        "Xuất JSON đúng schema: "
        '{"verdict": "pass" | "fail", "score": 1-5, "faithful": true|false, "reason": "<ngắn gọn tiếng Việt>"}\n'
        "- verdict=pass nếu câu trả lời đúng tiêu chí VÀ không chứa nội dung cấm.\n"
        "- faithful=false nếu câu trả lời bịa thông tin không có trong context."
    )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--questions", default=str(ROOT / "data" / "grading_questions.json"))
    p.add_argument("--out", default=str(ROOT / "artifacts" / "eval" / "llm_judge.jsonl"))
    p.add_argument("--top-k", type=int, default=5)
    p.add_argument("--model", default=os.environ.get("LLM_JUDGE_MODEL", "gpt-4o-mini"))
    args = p.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("ERROR: OPENAI_API_KEY chưa đặt trong .env (xem README — phần Merit).", file=sys.stderr)
        return 1

    try:
        import chromadb
        from chromadb.utils import embedding_functions
        from openai import OpenAI
    except ImportError as e:
        print(f"Thiếu thư viện: {e}. pip install -r requirements.txt", file=sys.stderr)
        return 1

    qs = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    db_path = os.environ.get("CHROMA_DB_PATH", str(ROOT / "chroma_db"))
    collection_name = os.environ.get("CHROMA_COLLECTION", "day10_kb")
    model_name = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    client_db = chromadb.PersistentClient(path=db_path)
    emb = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=model_name)
    col = client_db.get_collection(name=collection_name, embedding_function=emb)

    oai = OpenAI(api_key=api_key)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    n_pass = 0
    with out.open("w", encoding="utf-8") as f:
        for q in qs:
            res = col.query(query_texts=[q["question"]], n_results=args.top_k)
            docs = (res.get("documents") or [[]])[0]
            metas = (res.get("metadatas") or [[]])[0]
            context = "\n".join(f"[{i+1}] {d}" for i, d in enumerate(docs)) or "(rỗng)"
            top_doc = (metas[0] or {}).get("doc_id", "") if metas else ""

            # 1) ANSWER
            ans_resp = oai.chat.completions.create(
                model=args.model,
                temperature=0,
                messages=[
                    {"role": "system", "content": ANSWER_SYSTEM},
                    {"role": "user", "content": f"CONTEXT:\n{context}\n\nCÂU HỎI: {q['question']}"},
                ],
            )
            answer = (ans_resp.choices[0].message.content or "").strip()

            # 2) JUDGE
            judge_resp = oai.chat.completions.create(
                model=args.model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM},
                    {"role": "user", "content": build_judge_prompt(q, answer, context)},
                ],
            )
            try:
                verdict = json.loads(judge_resp.choices[0].message.content or "{}")
            except json.JSONDecodeError:
                verdict = {"verdict": "fail", "score": 0, "faithful": False, "reason": "judge_json_parse_error"}

            is_pass = verdict.get("verdict") == "pass"
            n_pass += is_pass
            rec = {
                "id": q.get("id"),
                "question": q["question"],
                "top1_doc_id": top_doc,
                "answer": answer,
                "verdict": verdict.get("verdict"),
                "score": verdict.get("score"),
                "faithful": verdict.get("faithful"),
                "reason": verdict.get("reason"),
                "model": args.model,
                "top_k_used": args.top_k,
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            print(f"{q.get('id')}: {verdict.get('verdict')} (score={verdict.get('score')}) — {str(verdict.get('reason'))[:70]}")

    print(f"\nLLM-JUDGE: {n_pass}/{len(qs)} pass · model={args.model} · top_k={args.top_k}")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
