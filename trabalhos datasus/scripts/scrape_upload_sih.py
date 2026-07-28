#!/usr/bin/env python3
"""
Overnight SIH scrape → Supabase Edge Function (sih-ingest).

- Scrapes diseases from diseases.json (skip-done)
- Uploads UF + muni rows immediately (no fat Vite packs)
- Deletes raw TabNet HTML after successful upload to keep disk light
- Resilient: continues on per-disease failure

Usage (repo root):
  PYTHONUNBUFFERED=1 python3 trabalhos\\ datasus/scripts/scrape_upload_sih.py
  PYTHONUNBUFFERED=1 python3 trabalhos\\ datasus/scripts/scrape_upload_sih.py --measure Internações
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import coleta_sih_multi_disease as coleta  # noqa: E402

SUPABASE_URL = "https://hmfbxqemububjyhdckrj.supabase.co"
INGEST_URL = f"{SUPABASE_URL}/functions/v1/sih-ingest"
INGEST_SECRET = "lacir-sih-ingest-2026"
LOG = coleta.OUT_ROOT / "overnight_scrape_upload.log"


def log(msg: str) -> None:
    # stdout is redirected to overnight_scrape_upload.log by the watchdog
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}", flush=True)


def num_or_none(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def uf_payload(disease_id: str, rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        out.append(
            {
                "disease_id": disease_id,
                "uf_codigo": str(r.get("uf_codigo", "")).zfill(2),
                "uf": r.get("uf"),
                "uf_nome": r.get("uf_nome"),
                "ano": int(r["ano"]),
                "internacoes": num_or_none(r.get("internacoes")),
                "obitos": num_or_none(r.get("obitos")),
                "valor_total": num_or_none(r.get("valor_total")),
                "dias_permanencia": num_or_none(r.get("dias_permanencia")),
                "taxa_mortalidade": num_or_none(r.get("taxa_mortalidade")),
            }
        )
    return out


def muni_payload(disease_id: str, rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        out.append(
            {
                "disease_id": disease_id,
                "municipio_codigo": str(r.get("municipio_codigo", "")).zfill(6)[:6],
                "municipio_nome": r.get("municipio_nome"),
                "uf_codigo": str(r.get("uf_codigo", "")).zfill(2),
                "ano": int(r["ano"]),
                "internacoes": num_or_none(r.get("internacoes")),
                "obitos": num_or_none(r.get("obitos")),
                "valor_total": num_or_none(r.get("valor_total")),
                "dias_permanencia": num_or_none(r.get("dias_permanencia")),
                "taxa_mortalidade": num_or_none(r.get("taxa_mortalidade")),
            }
        )
    return out


def post_ingest(table: str, rows: list[dict], *, label: str = "") -> int:
    if not rows:
        return 0
    total = 0
    chunk = 250
    nchunks = (len(rows) + chunk - 1) // chunk
    for i in range(0, len(rows), chunk):
        body = json.dumps({"table": table, "rows": rows[i : i + chunk]}).encode("utf-8")
        req = urllib.request.Request(
            INGEST_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-ingest-secret": INGEST_SECRET,
            },
        )
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                    total += int(payload.get("upserted") or 0)
                    break
            except urllib.error.HTTPError as exc:
                err = exc.read().decode("utf-8", errors="replace")
                if attempt == 3:
                    raise RuntimeError(f"ingest {table} HTTP {exc.code}: {err}") from exc
                time.sleep(2 ** attempt)
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
        idx = i // chunk + 1
        if idx == 1 or idx == nchunks or idx % 10 == 0:
            log(f"  …{label or table} chunk {idx}/{nchunks} upserted={total}")
    return total


def upload_disease(disease_id: str, uf_rows: list[dict], muni_rows: list[dict]) -> None:
    nu = post_ingest("sih_metric_uf", uf_payload(disease_id, uf_rows), label=f"{disease_id}/uf")
    nm = post_ingest(
        "sih_metric_muni",
        muni_payload(disease_id, muni_rows),
        label=f"{disease_id}/muni",
    )
    log(f"UPLOAD {disease_id}: uf={nu} muni={nm}")


def cleanup_raw(disease_id: str) -> None:
    raw = coleta.OUT_ROOT / disease_id / "raw"
    if raw.exists():
        shutil.rmtree(raw, ignore_errors=True)
        log(f"CLEAN raw {disease_id}")


def already_uploaded(disease_id: str) -> bool:
    marker = coleta.OUT_ROOT / disease_id / "uploaded.json"
    return marker.exists()


def mark_uploaded(disease_id: str, meta: dict) -> None:
    marker = coleta.OUT_ROOT / disease_id / "uploaded.json"
    marker.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def load_csv_rows(path: Path) -> list[dict]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    import csv

    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def process_existing_csvs() -> None:
    """Upload any local CSVs not yet marked uploaded (disk → cloud)."""
    log("UPLOAD-EXISTING begin")
    for d in sorted(coleta.OUT_ROOT.iterdir()):
        if not d.is_dir():
            continue
        disease_id = d.name
        if already_uploaded(disease_id):
            continue
        uf_path = d / f"base_{disease_id}_uf_2013_2025.csv"
        muni_path = d / f"base_{disease_id}_muni_2013_2025.csv"
        meta_path = d / "metadata.json"
        if not uf_path.exists() or not meta_path.exists():
            continue
        try:
            log(f"UPLOAD-EXISTING {disease_id}…")
            uf_rows = load_csv_rows(uf_path)
            muni_rows = load_csv_rows(muni_path)
            if not uf_rows:
                log(f"SKIP empty uf {disease_id}")
                continue
            upload_disease(disease_id, uf_rows, muni_rows)
            mark_uploaded(disease_id, {"uf": len(uf_rows), "muni": len(muni_rows)})
            cleanup_raw(disease_id)
        except Exception as exc:  # noqa: BLE001
            log(f"FAIL upload existing {disease_id}: {exc}")
    log("UPLOAD-EXISTING done")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measure", action="append")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--upload-only", action="store_true")
    args = parser.parse_args()

    measures = args.measure or coleta.MEASURES
    log(f"START measures={measures}")

    process_existing_csvs()
    if args.upload_only:
        log("DONE upload-only")
        return

    diseases = json.loads(coleta.DISEASES_PATH.read_text(encoding="utf-8"))
    pending = [d for d in diseases if not coleta.disease_done(d) or not already_uploaded(d["id"])]
    # Prefer not-done scrapes first
    pending.sort(key=lambda d: (coleta.disease_done(d), d["id"]))
    if args.limit:
        pending = pending[: args.limit]

    log(f"pending={len(pending)}")
    for disease in pending:
        did = disease["id"]
        try:
            if not coleta.disease_done(disease):
                log(f"SCRAPE {did}")
                meta = coleta.scrape_one(disease, measures)
            else:
                meta = json.loads((coleta.OUT_ROOT / did / "metadata.json").read_text(encoding="utf-8"))
                log(f"REUSE scrape {did}")

            uf_rows = load_csv_rows(coleta.OUT_ROOT / did / f"base_{did}_uf_2013_2025.csv")
            muni_rows = load_csv_rows(coleta.OUT_ROOT / did / f"base_{did}_muni_2013_2025.csv")
            upload_disease(did, uf_rows, muni_rows)
            mark_uploaded(did, {"uf": len(uf_rows), "muni": len(muni_rows), "meta": meta})
            cleanup_raw(did)
        except Exception as exc:  # noqa: BLE001
            log(f"FAIL {did}: {exc}")
            time.sleep(5)
            continue

    log("ALL DONE")


if __name__ == "__main__":
    main()
