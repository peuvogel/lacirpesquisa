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


# ---------------------------------------------------------------------------
# Janela de competência — a diferença entre a consulta INGÊNUA e a BEM-FORMADA (09-16).
#
# O TabNet tabula `Coluna=Ano_atendimento`: ele mesmo separa as linhas por ano de internação.
# Mas ele só enxerga o que está nos arquivos de competência SUBMETIDOS. Submeter só as 12
# competências do ano Y — o que este módulo fazia desde o D-18, e o que um aluno faz por padrão
# ao abrir o TabNet — mede "internações de Y **faturadas em Y**", não o ano de atendimento: toda
# internação de dezembro/Y faturada em janeiro/Y+1 fica de fora do próprio oráculo.
#
# `janela=1` acrescenta as 12 competências de Y+1, fechando o ano de atendimento. O 1 não é
# chute: a defasagem `ANO_CMPT - ano(DT_INTER)` foi medida em 35.455.908 AIH `IDENT='1'` reais
# (15 UFs completas, 13 anos + cauda, `collect_state.json` de 2026-08-17) e ficou em ≤ 1 ano em
# 35.455.907 delas — um único registro em RO chegou a 2. Ver o SUMMARY do 09-16 para a medição.
# ---------------------------------------------------------------------------
JANELA_INGENUA = 0
JANELA_BEM_FORMADA = 1


def competence_file_names(
    ano: int, *, janela: int = JANELA_INGENUA, disponiveis: set[str] | None = None
) -> list[str]:
    """Nomes dos arquivos `nibr` a submeter para medir o ano de atendimento `ano`.

    `janela=0` devolve as 12 competências do próprio ano (a consulta ingênua); `janela=n`
    acrescenta as competências dos `n` anos seguintes (a bem-formada é `n=1`).

    Quando `disponiveis` é passado, o resultado é intersectado com ele. Isso não é cosmético: a
    cauda do ano corrente não existe inteira (em 2026-08 o TabNet publica até Jun/2026), e pedir
    um arquivo não publicado faz o TabNet devolver um `<PRE>` vazio, que `parse_prn_table` trata
    como FALHA — corretamente — derrubando a medição inteira por um arquivo que ainda não saiu.
    """
    if janela < 0:
        raise ValueError(f"competence_file_names: janela negativa não faz sentido: {janela!r}")

    nomes = [
        f"nibr{(ano + offset) % 100:02d}{mes:02d}.dbf"
        for offset in range(janela + 1)
        for mes in range(1, 13)
    ]
    if disponiveis is None:
        return nomes
    return [nome for nome in nomes if nome in disponiveis]


def parse_arquivos_disponiveis(html: str) -> set[str]:
    """Extrai do `.def` os `nibr*.dbf` que o TabNet realmente oferece (as OPTIONs de `Arquivos`).

    Fonte da verdade sobre o que dá para pedir — sempre preferível a supor que a série está
    completa até o mês corrente.
    """
    return set(re.findall(r'VALUE="(nibr\d{4}\.dbf)"', html, re.I))


def fetch_arquivos_disponiveis(url: str = TABNET_URL, timeout: int = 180) -> set[str]:
    """Busca ao vivo a lista de competências publicadas. Isolada para os testes não tocarem rede."""
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return parse_arquivos_disponiveis(_fetch(request, timeout).decode("latin-1", errors="replace"))


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


# Quantas vezes uma MESMA requisição é repetida antes de desistir. Medido ao vivo em 2026-08-17:
# o TabNet devolve, de forma intermitente, a própria página do `.def` (44 KB, sem tabela) em vez
# do resultado, e a mesma requisição repetida funciona. Numa corrida de centenas de pares isso é
# certeza estatística de falha; sem retentativa, ~20 min de raspagem morrem por um hiccup.
MAX_TENTATIVAS = 4
BACKOFF_BASE_SEC = 3.0


def _tabela_com_retentativa(data: list[tuple[str, str]], *, disease_id: str) -> list[list[str]]:
    """Faz a requisição e devolve a tabela, repetindo em falha de PARSE (resposta sem tabela).

    Esgotadas as tentativas, a falha SOBE — devolver 0 seria fabricar um dado de oráculo, a
    classe de erro mais cara que existe neste projeto.
    """
    ultima: Exception | None = None
    for tentativa in range(1, MAX_TENTATIVAS + 1):
        try:
            return parse_prn_table(post_tabnet(TABNET_URL, data))
        except RuntimeError as exc:
            ultima = exc
            if tentativa < MAX_TENTATIVAS:
                espera = BACKOFF_BASE_SEC * tentativa
                print(
                    f"oracle-scrape: {disease_id} devolveu resposta sem tabela "
                    f"(tentativa {tentativa}/{MAX_TENTATIVAS}) -- repetindo em {espera:.0f}s",
                    file=sys.stderr,
                )
                time.sleep(espera)
    raise RuntimeError(
        f"oracle-scrape: {disease_id} falhou em {MAX_TENTATIVAS} tentativas: {ultima}"
    )


def scrape_pairs(
    pairs: list[dict],
    *,
    janela: int = JANELA_INGENUA,
    disponiveis: set[str] | None = None,
) -> list[dict]:
    """Busca, ao vivo, o valor de internações (Linha=Município, somado por UF) de cada par.

    Cada par precisa de `tabnetCode`, `uf` (sigla, ex. "AC") e `ano`; qualquer campo extra do
    par de entrada (ex. `diseaseId`) é preservado na saída, junto de `valorTabnet`/`raspadoEm`/
    `janelaCompetencia`.

    **O default é a janela INGÊNUA (0), e mudá-lo seria uma regressão silenciosa**: a fixture
    congelada `oracle_ac_2019.json`, contra a qual o gate SC-7 compara, foi raspada assim. Um
    número de oráculo só significa alguma coisa junto da janela que o produziu — por isso
    `janelaCompetencia` vai na saída de cada par, e não só no nome do arquivo.
    """
    out = []
    for pair in pairs:
        ano = int(pair["ano"])
        uf_code = UF_CODE_BY_SIGLA[pair["uf"]]
        files = competence_file_names(ano, janela=janela, disponiveis=disponiveis)
        data = [
            ("Linha", "Município"),
            ("Coluna", "Ano_atendimento"),
            ("Incremento", "Internações"),
            *[("Arquivos", f) for f in files],
            ("SLista_Morb__CID-10", pair["tabnetCode"]),
            ("formato", "prn"),
            ("mostre", "Mostra"),
        ]
        rows = _tabela_com_retentativa(data, disease_id=pair.get("diseaseId", pair["tabnetCode"]))
        valor = _sum_uf_ano(rows, uf_code, ano)
        out.append(
            {
                **pair,
                "valorTabnet": valor,
                "raspadoEm": _now_iso(),
                "janelaCompetencia": janela,
                "arquivosSubmetidos": len(files),
            }
        )
    return out


def main(argv: list[str]) -> int:
    """CLI do subcomando `oracle-scrape` (contrato resolvido pelo `cli.py` do 09-04)."""
    parser = argparse.ArgumentParser(prog="oracle-scrape")
    parser.add_argument("--uf", required=True, help="Sigla da UF (ex. AC)")
    parser.add_argument("--ano", required=True, type=int, help="Ano (ex. 2019)")
    parser.add_argument(
        "--janela",
        type=int,
        default=JANELA_INGENUA,
        help=(
            "Janela de competência: 0 = consulta INGÊNUA (12 arquivos do ano, o que um aluno faz "
            "por padrão e o que a fixture congelada do gate mede); 1 = BEM-FORMADA (acrescenta as "
            "12 competências do ano seguinte, fechando o ano de atendimento)"
        ),
    )
    args = parser.parse_args(argv)

    diseases_path = repo_root() / "scripts" / "catalog" / "diseases.json"
    diseases = json.loads(diseases_path.read_text(encoding="utf-8"))
    pairs = [
        {"tabnetCode": d["tabnetCode"], "diseaseId": d["id"], "uf": args.uf, "ano": args.ano}
        for d in diseases
    ]
    disponiveis = fetch_arquivos_disponiveis() if args.janela else None
    results = scrape_pairs(pairs, janela=args.janela, disponiveis=disponiveis)
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
