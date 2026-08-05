"""Raspador mínimo de reconciliação do oráculo TabNet (D-18).

Porta de `post_tabnet`/`parse_prn_table` de `trabalhos datasus/scripts/coleta_sih_multi_disease.py`
(linhas 65-83) — e só isso. Único trabalho: buscar N valores pontuais (Linha=Município, somados
por UF) para os pares da fixture de reconciliação (D-04/D-06). Sem upload, sem cache, sem
retomada seletiva de itens já concluídos, sem segredo — cada chamada é isolada, sem estado entre
execuções. `REQUEST_DELAY_SEC` herdado literalmente do scraper aposentado (T-09-19).
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from io import StringIO

from sih_pipeline.paths import repo_root

REQUEST_DELAY_SEC = 1.5

TABNET_URL = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sih/cnv/nibr.def"

# sigla -> código IBGE de 2 dígitos: único jeito de casar a UF pedida com o prefixo de
# 6 dígitos do código de município que o TabNet devolve em Linha=Município.
UF_CODE_BY_SIGLA = {
    "RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15", "AP": "16", "TO": "17",
    "MA": "21", "PI": "22", "CE": "23", "RN": "24", "PB": "25", "PE": "26", "AL": "27",
    "SE": "28", "BA": "29", "MG": "31", "ES": "32", "RJ": "33", "SP": "35", "PR": "41",
    "SC": "42", "RS": "43", "MS": "50", "MT": "51", "GO": "52", "DF": "53",
}


def _fetch(request: urllib.request.Request, timeout: int) -> bytes:
    """Abre a conexão de rede — isolado para que os testes substituam sem tocar a rede."""
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def post_tabnet(url: str, data: list[tuple[str, str]], timeout: int = 180) -> str:
    if REQUEST_DELAY_SEC > 0:
        time.sleep(REQUEST_DELAY_SEC)
    body = urllib.parse.urlencode(data, doseq=True, encoding="latin-1").encode("latin-1")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"},
    )
    raw = _fetch(request, timeout)
    return raw.decode("latin-1", errors="replace")


def parse_prn_table(text: str) -> list[list[str]]:
    match = re.search(r"<PRE>(.*?)</PRE>", text, re.S | re.I)
    if not match:
        raise RuntimeError("Resposta do TabNet sem bloco <PRE>.")
    raw = html.unescape(match.group(1)).strip()
    if not raw:
        raise RuntimeError(
            "Resposta do TabNet com bloco <PRE> vazio — tabela vazia é falha, não zero."
        )
    return list(csv.reader(StringIO(raw), delimiter=";"))


def _parse_cell(cell: str) -> int:
    """Converte uma célula PRN em inteiro; '-'/vazio conta como 0 (mesma semântica do TabNet)."""
    value = cell.strip().replace("\xa0", "")
    if value in {"", "-", "...", ".."}:
        return 0
    return int(round(float(value.replace(".", "").replace(",", "."))))


def _sum_uf_ano(rows: list[list[str]], uf_code: str, ano: int) -> int:
    header = rows[0]
    if str(ano) not in header:
        raise RuntimeError(f"coluna do ano {ano} ausente na resposta do TabNet")
    col_idx = header.index(str(ano))
    total = 0
    found = False
    for row in rows[1:]:
        if not row or row[0].strip().lower() == "total":
            continue
        code_match = re.match(r"(\d{6})", row[0].strip())
        if not code_match or code_match.group(1)[:2] != uf_code:
            continue
        found = True
        total += _parse_cell(row[col_idx])
    if not found:
        raise RuntimeError(f"nenhum município da UF {uf_code} na resposta do TabNet")
    return total


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def scrape_pairs(pairs: list[dict]) -> list[dict]:
    """Busca, ao vivo, o valor de internações (Linha=Município, somado por UF) de cada par.

    Cada par precisa de `tabnetCode`, `uf` (sigla, ex. "AC") e `ano`; qualquer campo extra do
    par de entrada (ex. `diseaseId`) é preservado na saída, junto de `valorTabnet`/`raspadoEm`.
    """
    out = []
    for pair in pairs:
        ano = int(pair["ano"])
        uf_code = UF_CODE_BY_SIGLA[pair["uf"]]
        files = [f"nibr{ano % 100:02d}{month:02d}.dbf" for month in range(1, 13)]
        data = [
            ("Linha", "Município"),
            ("Coluna", "Ano_atendimento"),
            ("Incremento", "Internações"),
            *[("Arquivos", f) for f in files],
            ("SLista_Morb__CID-10", pair["tabnetCode"]),
            ("formato", "prn"),
            ("mostre", "Mostra"),
        ]
        text = post_tabnet(TABNET_URL, data)
        rows = parse_prn_table(text)
        valor = _sum_uf_ano(rows, uf_code, ano)
        out.append({**pair, "valorTabnet": valor, "raspadoEm": _now_iso()})
    return out


def main(argv: list[str]) -> int:
    """CLI do subcomando `oracle-scrape` (contrato resolvido pelo `cli.py` do 09-04)."""
    parser = argparse.ArgumentParser(prog="oracle-scrape")
    parser.add_argument("--uf", required=True, help="Sigla da UF (ex. AC)")
    parser.add_argument("--ano", required=True, type=int, help="Ano (ex. 2019)")
    args = parser.parse_args(argv)

    diseases_path = repo_root() / "scripts" / "catalog" / "diseases.json"
    diseases = json.loads(diseases_path.read_text(encoding="utf-8"))
    pairs = [
        {"tabnetCode": d["tabnetCode"], "diseaseId": d["id"], "uf": args.uf, "ano": args.ano}
        for d in diseases
    ]
    results = scrape_pairs(pairs)
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
