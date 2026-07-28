#!/usr/bin/env python3
"""
Parameterized SIH UF×ano scrape for multiple diseases × measures.

Measures: Internações, Óbitos, Valor_total (custo), Dias_permanência.
Diseases: scripts/catalog/diseases.json (lista_morb or procedimento).

Usage (from repo root):
  python3 "trabalhos datasus/scripts/coleta_sih_multi_disease.py"
  python3 "trabalhos datasus/scripts/coleta_sih_multi_disease.py" --disease varizes_mmii --measure Internações
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from io import StringIO
from pathlib import Path

# Gentle defaults — overridden by CLI. Avoids hammering TabNet / saturating the machine.
REQUEST_DELAY_SEC = 1.5
DISEASE_PAUSE_SEC = 2.0

SCRIPT_DIR = Path(__file__).resolve().parent
CORPUS_DIR = SCRIPT_DIR.parent
REPO_ROOT = CORPUS_DIR.parent
DISEASES_PATH = REPO_ROOT / "scripts" / "catalog" / "diseases.json"
OUT_ROOT = CORPUS_DIR / "outputs" / "coleta_sih_multi"

YEARS = list(range(2013, 2026))

UF_CODE_TO_SIGLA = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
    "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
    "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}
UF_CODE_TO_NAME = {
    "11": "Rondônia", "12": "Acre", "13": "Amazonas", "14": "Roraima", "15": "Pará",
    "16": "Amapá", "17": "Tocantins", "21": "Maranhão", "22": "Piauí", "23": "Ceará",
    "24": "Rio Grande do Norte", "25": "Paraíba", "26": "Pernambuco", "27": "Alagoas",
    "28": "Sergipe", "29": "Bahia", "31": "Minas Gerais", "32": "Espírito Santo",
    "33": "Rio de Janeiro", "35": "São Paulo", "41": "Paraná", "42": "Santa Catarina",
    "43": "Rio Grande do Sul", "50": "Mato Grosso do Sul", "51": "Mato Grosso",
    "52": "Goiás", "53": "Distrito Federal",
}

MEASURES = ["Internações", "Óbitos", "Valor_total", "Dias_permanência"]
MEASURE_COL = {
    "Internações": "internacoes",
    "Óbitos": "obitos",
    "Valor_total": "valor_total",
    "Dias_permanência": "dias_permanencia",
}


def post_tabnet(url: str, data: list[tuple[str, str]], timeout: int = 180) -> str:
    if REQUEST_DELAY_SEC > 0:
        time.sleep(REQUEST_DELAY_SEC)
    body = urllib.parse.urlencode(data, doseq=True, encoding="latin-1").encode("latin-1")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("latin-1", errors="replace")


def parse_prn_table(text: str) -> list[list[str]]:
    match = re.search(r"<PRE>(.*?)</PRE>", text, re.S | re.I)
    if not match:
        raise RuntimeError("Resposta do TabNet sem bloco PRE.")
    raw = html.unescape(match.group(1)).strip()
    return list(csv.reader(StringIO(raw), delimiter=";"))


def parse_number(value):
    if value is None:
        return None
    value = str(value).strip().replace("\xa0", "")
    if value in {"", "-", "...", ".."}:
        return None
    value = value.replace("%", "")
    if "," in value:
        value = value.replace(".", "").replace(",", ".")
    try:
        number = float(value)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


def parse_municipio_label(label: str) -> tuple[str | None, str | None, str | None]:
    """Return (uf_codigo, municipio_codigo6, municipio_nome) from TabNet Linha=Município."""
    label = html.unescape(label).strip().strip('"')
    code_match = re.search(r"\b(\d{6})\b", label)
    if not code_match:
        suffix_match = re.search(r"-\s*([A-Z]{2})$", label)
        if suffix_match:
            sigla = suffix_match.group(1)
            for code, s in UF_CODE_TO_SIGLA.items():
                if s == sigla:
                    return code, None, label
        return None, None, None
    muni6 = code_match.group(1)
    uf_code = muni6[:2]
    nome = label
    # Common patterns: "290010 Abaíra" or "Abaíra - BA"
    nome = re.sub(r"^\d{6}\s*", "", nome).strip()
    nome = re.sub(r"\s*-\s*[A-Z]{2}$", "", nome).strip() or label
    return uf_code, muni6, nome


def municipio_to_uf(label: str):
    uf_code, _, _ = parse_municipio_label(label)
    return uf_code


def municipal_long(rows: list[list[str]], value_name: str) -> list[dict]:
    """Keep município×ano grain (6-digit TabNet code) for map drill-down sync."""
    header = rows[0]
    out: list[dict] = []
    for row in rows[1:]:
        if not row or row[0].strip().lower() == "total":
            continue
        uf_code, muni6, nome = parse_municipio_label(row[0])
        if not uf_code or not muni6:
            continue
        for col, cell in zip(header[1:], row[1:]):
            if col == "Total":
                continue
            year_match = re.search(r"(20\d{2})", col)
            if not year_match:
                continue
            year = int(year_match.group(1))
            if year not in YEARS:
                continue
            value = parse_number(cell)
            if value is None:
                continue
            out.append(
                {
                    "municipio_codigo": muni6,
                    "municipio_nome": nome,
                    "uf_codigo": uf_code,
                    "uf": UF_CODE_TO_SIGLA.get(uf_code),
                    "uf_nome": UF_CODE_TO_NAME.get(uf_code),
                    "ano": year,
                    value_name: int(value) if float(value).is_integer() else value,
                }
            )
    return out


def aggregate_municipal(rows: list[list[str]], value_name: str):
    aggregated: dict[tuple[str, int], float] = defaultdict(float)
    for row in municipal_long(rows, value_name):
        aggregated[(row["uf_codigo"], row["ano"])] += float(row[value_name] or 0)
    out = []
    for (uf_code, year), value in sorted(aggregated.items(), key=lambda i: (i[0][1], i[0][0])):
        out.append(
            {
                "uf_codigo": uf_code,
                "uf": UF_CODE_TO_SIGLA.get(uf_code),
                "uf_nome": UF_CODE_TO_NAME.get(uf_code),
                "ano": year,
                value_name: int(value) if float(value).is_integer() else value,
            }
        )
    return out


def arquivo_prefix(def_path: str) -> str:
    # nibr.def → nibrYYMM.dbf ; qibr.def → qibrYYMM.dbf
    if "qibr" in def_path:
        return "qibr"
    return "nibr"


def table_to_long_uf(rows: list[list[str]], value_name: str) -> list[dict]:
    """Parse UF×ano PRN table (qibr Linha=UF pattern)."""
    header = rows[0]
    out = []
    for row in rows[1:]:
        if not row or row[0].strip().lower() == "total":
            continue
        label = html.unescape(row[0]).strip()
        match = re.match(r"^(\d{2})\s+(.+)$", label)
        if not match:
            continue
        uf_code, uf_name = match.groups()
        for col, cell in zip(header[1:], row[1:]):
            if col == "Total":
                continue
            year_match = re.search(r"(20\d{2})", col)
            if not year_match:
                continue
            year = int(year_match.group(1))
            if year not in YEARS:
                continue
            out.append(
                {
                    "uf_codigo": uf_code,
                    "uf": UF_CODE_TO_SIGLA.get(uf_code),
                    "uf_nome": uf_name,
                    "ano": year,
                    value_name: parse_number(cell),
                }
            )
    return out


def fetch_metric(disease: dict, measure: str) -> tuple[list[dict], list[dict]]:
    """TabNet pull — returns (uf_rows, muni_rows). muni empty for procedimento/qibr."""
    def_path = disease["def"]
    url = f"http://tabnet.datasus.gov.br/cgi/tabcgi.exe?{def_path}"
    col_key = MEASURE_COL[measure]
    prefix = arquivo_prefix(def_path)
    out_dir = OUT_ROOT / disease["id"] / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"  fetch {disease['id']} × {measure} …", flush=True)

    # Procedimento (qibr): Linha=UF only (no municipal grain in this filter).
    if disease["filterKind"] == "procedimento":
        raw_path = out_dir / f"raw_{col_key}_uf.html"
        if raw_path.exists():
            text = raw_path.read_text(encoding="latin-1")
        else:
            files = [f"{prefix}{year % 100:02d}{month:02d}.dbf" for year in YEARS for month in range(1, 13)]
            data: list[tuple[str, str]] = [
                ("Linha", "UF"),
                ("Coluna", "Ano_atendimento"),
                ("Incremento", measure),
                *[("Arquivos", f) for f in files],
                ("SProcedimento", disease["tabnetCode"]),
                ("formato", "prn"),
                ("mostre", "Mostra"),
            ]
            text = post_tabnet(url, data, timeout=240)
            raw_path.write_text(text, encoding="latin-1")
        return table_to_long_uf(parse_prn_table(text), col_key), []

    # Prefer bulk (one request / all years). Reuse per-year caches when already complete.
    bulk_raw = out_dir / f"raw_{col_key}_muni_all.html"
    year_paths = [out_dir / f"raw_{col_key}_{year}.html" for year in YEARS]
    muni_rows: list[dict] = []

    def load_year_by_year() -> list[dict]:
        rows_acc: list[dict] = []
        for year, year_raw in zip(YEARS, year_paths):
            if year_raw.exists():
                text = year_raw.read_text(encoding="latin-1")
            else:
                files = [f"{prefix}{year % 100:02d}{month:02d}.dbf" for month in range(1, 13)]
                data = [
                    ("Linha", "Município"),
                    ("Coluna", "Ano_atendimento"),
                    ("Incremento", measure),
                    *[("Arquivos", f) for f in files],
                    ("SLista_Morb__CID-10", disease["tabnetCode"]),
                    ("formato", "prn"),
                    ("mostre", "Mostra"),
                ]
                text = post_tabnet(url, data, timeout=180)
                year_raw.write_text(text, encoding="latin-1")
            rows_acc.extend(
                [r for r in municipal_long(parse_prn_table(text), col_key) if r["ano"] == year]
            )
        return rows_acc

    # Prefer year caches (resume-friendly). Bulk only when starting from scratch —
    # TabNet bulk all-years often hangs / OOMs the client.
    if any(p.exists() for p in year_paths) or bulk_raw.exists() is False:
        if all(p.exists() for p in year_paths):
            print(f"  reuse year cache {disease['id']} × {measure}", flush=True)
        else:
            print(f"  year-by-year {disease['id']} × {measure}", flush=True)
        muni_rows = load_year_by_year()
    else:
        try:
            text = bulk_raw.read_text(encoding="latin-1")
            muni_rows = municipal_long(parse_prn_table(text), col_key)
        except Exception as bulk_exc:  # noqa: BLE001
            print(f"  bulk read failed ({bulk_exc}); year-by-year", flush=True)
            muni_rows = load_year_by_year()

    uf_combined: dict[tuple[str, int], float] = defaultdict(float)
    for row in muni_rows:
        uf_combined[(row["uf_codigo"], row["ano"])] += float(row[col_key] or 0)

    uf_out = []
    for (uf_code, year), value in sorted(uf_combined.items(), key=lambda i: (i[0][1], i[0][0])):
        uf_out.append(
            {
                "uf_codigo": uf_code,
                "uf": UF_CODE_TO_SIGLA.get(uf_code),
                "uf_nome": UF_CODE_TO_NAME.get(uf_code),
                "ano": year,
                col_key: int(value) if float(value).is_integer() else value,
            }
        )
    return uf_out, muni_rows


def merge_rows(series: list[list[dict]], key_fields: tuple[str, ...]) -> list[dict]:
    by_key: dict[tuple, dict] = {}
    for table in series:
        for row in table:
            key = tuple(row[f] for f in key_fields)
            if key not in by_key:
                by_key[key] = {f: row[f] for f in key_fields if f in row}
                # copy identity fields
                for f in ("municipio_codigo", "municipio_nome", "uf_codigo", "uf", "uf_nome", "ano"):
                    if f in row and f not in by_key[key]:
                        by_key[key][f] = row[f]
            for k, v in row.items():
                if k not in {
                    "municipio_codigo",
                    "municipio_nome",
                    "uf_codigo",
                    "uf",
                    "uf_nome",
                    "ano",
                }:
                    by_key[key][k] = v
    return [by_key[k] for k in sorted(by_key.keys())]


def write_csv(path: Path, rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    # Union of keys — some UF×ano rows may miss a measure when TabNet returns empty.
    preferred = [
        "municipio_codigo",
        "municipio_nome",
        "uf_codigo",
        "uf",
        "uf_nome",
        "ano",
        "internacoes",
        "obitos",
        "valor_total",
        "dias_permanencia",
        "taxa_mortalidade",
    ]
    seen = set()
    keys: list[str] = []
    for key in preferred:
        if any(key in row for row in rows):
            keys.append(key)
            seen.add(key)
    for row in rows:
        for key in row:
            if key not in seen:
                keys.append(key)
                seen.add(key)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def disease_done(disease: dict) -> bool:
    disease_id = disease["id"]
    out_dir = OUT_ROOT / disease_id
    uf_csv = out_dir / f"base_{disease_id}_uf_2013_2025.csv"
    muni_csv = out_dir / f"base_{disease_id}_muni_2013_2025.csv"
    meta = out_dir / "metadata.json"
    if not uf_csv.exists() or not meta.exists() or not muni_csv.exists():
        return False
    try:
        info = json.loads(meta.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    if info.get("errors"):
        return False
    if int(info.get("rows") or 0) <= 0:
        return False
    # lista_morb must keep município grain for map drill-down
    if disease.get("filterKind") == "lista_morb" and int(info.get("muni_rows") or 0) <= 0:
        return False
    return True


def add_taxa(rows: list[dict]) -> None:
    for row in rows:
        intern = row.get("internacoes")
        obitos = row.get("obitos")
        if intern and intern > 0 and obitos is not None:
            row["taxa_mortalidade"] = round(100.0 * float(obitos) / float(intern), 4)
        else:
            row["taxa_mortalidade"] = None


def cleanup_raw(disease_id: str) -> None:
    """Drop cached TabNet HTML after a successful scrape to keep disk light."""
    raw = OUT_ROOT / disease_id / "raw"
    if raw.exists():
        shutil.rmtree(raw, ignore_errors=True)
        print(f"  cleaned raw/{disease_id}", flush=True)


def scrape_one(disease: dict, measures: list[str], *, cleanup: bool = True) -> dict:
    uf_series: list[list[dict]] = []
    muni_series: list[list[dict]] = []
    errors: list[str] = []
    for measure in measures:
        try:
            uf_rows, muni_rows = fetch_metric(disease, measure)
            uf_series.append(uf_rows)
            if muni_rows:
                muni_series.append(muni_rows)
        except Exception as exc:  # noqa: BLE001 — collect per-measure failures
            errors.append(f"{measure}: {exc}")
            print(f"  FAIL {disease['id']} {measure}: {exc}", flush=True)

    uf_rows = merge_rows(uf_series, ("uf_codigo", "ano"))
    add_taxa(uf_rows)
    muni_rows = merge_rows(muni_series, ("municipio_codigo", "ano")) if muni_series else []
    add_taxa(muni_rows)

    out_dir = OUT_ROOT / disease["id"]
    csv_path = out_dir / f"base_{disease['id']}_uf_2013_2025.csv"
    muni_path = out_dir / f"base_{disease['id']}_muni_2013_2025.csv"
    write_csv(csv_path, uf_rows)
    write_csv(muni_path, muni_rows)
    meta = {
        "disease": disease,
        "measures": measures,
        "rows": len(uf_rows),
        "muni_rows": len(muni_rows),
        "errors": errors,
        "csv": str(csv_path.relative_to(CORPUS_DIR)),
        "muni_csv": str(muni_path.relative_to(CORPUS_DIR)),
        "grains": ["uf_ano", "municipio_ano"] if muni_rows else ["uf_ano"],
    }
    (out_dir / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"OK {disease['id']}: {len(uf_rows)} UF rows · {len(muni_rows)} muni rows → {csv_path}",
        flush=True,
    )
    if cleanup and not errors and len(uf_rows) > 0:
        cleanup_raw(disease["id"])
    return meta


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--disease", action="append", help="Disease id (repeatable)")
    parser.add_argument("--measure", action="append", help="TabNet Incremento name")
    parser.add_argument(
        "--years",
        type=str,
        default=None,
        help="Comma-separated years (default: 2013-2025)",
    )
    parser.add_argument(
        "--skip-done",
        action="store_true",
        help="Skip diseases that already have a non-empty UF CSV + metadata",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Process at most N remaining diseases (0 = all)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.5,
        help="Seconds to sleep before each TabNet HTTP request (default 1.5)",
    )
    parser.add_argument(
        "--pause-disease",
        type=float,
        default=2.0,
        help="Seconds to pause between diseases (default 2.0)",
    )
    parser.add_argument(
        "--keep-raw",
        action="store_true",
        help="Keep raw TabNet HTML caches (default: delete after successful scrape)",
    )
    args = parser.parse_args()

    global YEARS, REQUEST_DELAY_SEC, DISEASE_PAUSE_SEC
    REQUEST_DELAY_SEC = max(0.0, float(args.delay))
    DISEASE_PAUSE_SEC = max(0.0, float(args.pause_disease))
    if args.years:
        YEARS = [int(y.strip()) for y in args.years.split(",") if y.strip()]

    diseases = json.loads(DISEASES_PATH.read_text(encoding="utf-8"))
    if args.disease:
        diseases = [d for d in diseases if d["id"] in set(args.disease)]
    if args.skip_done:
        before = len(diseases)
        diseases = [d for d in diseases if not disease_done(d)]
        print(f"skip-done: {before - len(diseases)} already complete, {len(diseases)} remaining", flush=True)
    if args.limit and args.limit > 0:
        diseases = diseases[: args.limit]
    measures = args.measure or MEASURES

    print(
        f"gentle scrape: delay={REQUEST_DELAY_SEC}s/req pause={DISEASE_PAUSE_SEC}s/disease "
        f"measures={measures} n={len(diseases)}",
        flush=True,
    )

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    summary = []
    if (OUT_ROOT / "summary.json").exists():
        try:
            summary = json.loads((OUT_ROOT / "summary.json").read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            summary = []
    by_id = {m.get("disease", {}).get("id"): i for i, m in enumerate(summary) if m.get("disease")}

    for i, disease in enumerate(diseases):
        meta = scrape_one(disease, measures, cleanup=not args.keep_raw)
        idx = by_id.get(disease["id"])
        if idx is None:
            by_id[disease["id"]] = len(summary)
            summary.append(meta)
        else:
            summary[idx] = meta
        (OUT_ROOT / "summary.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        if i + 1 < len(diseases) and DISEASE_PAUSE_SEC > 0:
            time.sleep(DISEASE_PAUSE_SEC)

    print(f"DONE — {len(diseases)} disease(s) this run", flush=True)


if __name__ == "__main__":
    main()
