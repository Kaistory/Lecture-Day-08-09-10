"""
Eval Service — retrieval eval (test_questions.json) + grading (grading_questions.json).

Logic giữ y hệt eval_retrieval.py / grading_run.py nhưng trả JSON có cấu trúc và ghi artifact.
Collection Chroma được cache để tránh nạp lại embedding model mỗi request.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app import config  # noqa: F401 — side effect import order

import etl_pipeline as lab_etl

# Cache 3 tầng: client + embedding model (NẶNG, giữ qua reset) tách khỏi collection handle (rẻ).
_CLIENT = None
_EMB = None
_COLLECTION = None


class CollectionUnavailable(Exception):
    pass


def _ensure_client():
    """Khởi tạo (1 lần) Chroma client + embedding model — phần nặng, không reload khi reset cache."""
    global _CLIENT, _EMB
    if _CLIENT is None or _EMB is None:
        try:
            import chromadb
            from chromadb.utils import embedding_functions
        except ImportError as e:  # pragma: no cover
            raise CollectionUnavailable(f"Thiếu chromadb/sentence-transformers: {e}")
        _CLIENT = chromadb.PersistentClient(path=config.CHROMA_DB_PATH)
        _EMB = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=config.EMBEDDING_MODEL)
    return _CLIENT, _EMB


def _get_collection():
    global _COLLECTION
    if _COLLECTION is not None:
        return _COLLECTION
    client, emb = _ensure_client()
    try:
        _COLLECTION = client.get_collection(name=config.CHROMA_COLLECTION, embedding_function=emb)
    except Exception as e:
        raise CollectionUnavailable(
            f"Chưa có collection '{config.CHROMA_COLLECTION}'. Hãy chạy POST /api/v1/pipeline/run trước. ({e})"
        )
    return _COLLECTION


def reset_collection_cache() -> None:
    """Chỉ bỏ collection handle (đọc lại index mới sau re-embed). GIỮ client + model đã nạp."""
    global _COLLECTION
    _COLLECTION = None


def _eval_one(col, q: Dict[str, Any], top_k: int) -> Dict[str, Any]:
    res = col.query(query_texts=[q["question"]], n_results=top_k)
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    top_doc = (metas[0] or {}).get("doc_id", "") if metas else ""
    blob = " ".join(docs).lower()
    must_any = [x.lower() for x in q.get("must_contain_any", [])]
    forbidden = [x.lower() for x in q.get("must_not_contain", [])]
    ok_any = any(m in blob for m in must_any) if must_any else True
    bad_forb = any(m in blob for m in forbidden) if forbidden else False
    want_top1 = (q.get("expect_top1_doc_id") or "").strip()
    top1_ok: Optional[bool] = (top_doc == want_top1) if want_top1 else None
    preview = (docs[0] or "")[:180].replace("\n", " ") if docs else ""
    return {
        "top1_doc_id": top_doc,
        "top1_preview": preview,
        "contains_expected": ok_any,
        "hits_forbidden": bad_forb,
        "top1_doc_matches": top1_ok,
    }


def run_retrieval(top_k: int = 3, output_filename: str = "after_fix_eval.csv") -> Dict[str, Any]:
    col = _get_collection()
    questions = json.loads(config.TEST_QUESTIONS.read_text(encoding="utf-8"))

    out_path = lab_etl.ART / "eval" / Path(output_filename).name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["question_id", "question", "top1_doc_id", "top1_preview",
                  "contains_expected", "hits_forbidden", "top1_doc_expected", "top_k_used"]

    passed = cont = forb = 0
    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for q in questions:
            e = _eval_one(col, q, top_k)
            cont += int(e["contains_expected"])
            forb += int(e["hits_forbidden"])
            passed += int(e["contains_expected"] and not e["hits_forbidden"])
            w.writerow({
                "question_id": q.get("id", ""),
                "question": q["question"],
                "top1_doc_id": e["top1_doc_id"],
                "top1_preview": e["top1_preview"],
                "contains_expected": "yes" if e["contains_expected"] else "no",
                "hits_forbidden": "yes" if e["hits_forbidden"] else "no",
                "top1_doc_expected": "" if e["top1_doc_matches"] is None else ("yes" if e["top1_doc_matches"] else "no"),
                "top_k_used": top_k,
            })

    n = len(questions)
    return {
        "eval_id": f"eval_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}",
        "total_questions": n,
        "passed": passed,
        "failed": n - passed,
        "metrics": {
            "avg_contains_expected": round(cont / n, 3) if n else 0.0,
            "avg_hits_forbidden": round(forb / n, 3) if n else 0.0,
        },
        "report_url": f"/api/v1/artifacts/eval/{out_path.name}",
    }


def run_grading(top_k: int = 5, output_filename: str = "grading_run.jsonl") -> Dict[str, Any]:
    col = _get_collection()
    qs = json.loads(config.GRADING_QUESTIONS.read_text(encoding="utf-8"))

    out_path = lab_etl.ART / "eval" / Path(output_filename).name
    out_path.parent.mkdir(parents=True, exist_ok=True)

    results: List[Dict[str, Any]] = []
    passed = 0
    with out_path.open("w", encoding="utf-8") as f:
        for q in qs:
            e = _eval_one(col, q, top_k)
            ok = e["contains_expected"] and not e["hits_forbidden"] and (e["top1_doc_matches"] in (True, None))
            passed += int(ok)
            rec = {
                "id": q.get("id"),
                "question": q["question"],
                "top1_doc_id": e["top1_doc_id"],
                "contains_expected": e["contains_expected"],
                "hits_forbidden": e["hits_forbidden"],
                "top1_doc_matches": e["top1_doc_matches"],
                "top_k_used": top_k,
                "grading_criteria": q.get("grading_criteria", []),
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            results.append({
                "question_id": q.get("id"),
                "contains_expected": e["contains_expected"],
                "hits_forbidden": e["hits_forbidden"],
                "top1_doc_matches": e["top1_doc_matches"],
            })

    return {
        "grading_run_id": f"grad_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}",
        "total_score": f"{passed}/{len(qs)}",
        "all_passed": passed == len(qs),
        "results": results,
        "artifact_url": f"/api/v1/artifacts/eval/{out_path.name}",
    }
