import csv
import html
import json
import re
import urllib.parse
import urllib.request
from io import StringIO
from pathlib import Path


# Repo-relative: this file lives in <repo>/trabalhos datasus/scripts/
BASE_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = BASE_DIR / "outputs" / "coleta_vascular_amputacao"
OUT_DIR.mkdir(parents=True, exist_ok=True)

YEARS = list(range(2013, 2026))
UF_CODE_TO_SIGLA = {
    "11": "RO",
    "12": "AC",
    "13": "AM",
    "14": "RR",
    "15": "PA",
    "16": "AP",
    "17": "TO",
    "21": "MA",
    "22": "PI",
    "23": "CE",
    "24": "RN",
    "25": "PB",
    "26": "PE",
    "27": "AL",
    "28": "SE",
    "29": "BA",
    "31": "MG",
    "32": "ES",
    "33": "RJ",
    "35": "SP",
    "41": "PR",
    "42": "SC",
    "43": "RS",
    "50": "MS",
    "51": "MT",
    "52": "GO",
    "53": "DF",
}


def post_tabnet(url, data):
    body = urllib.parse.urlencode(data, doseq=True, encoding="latin-1").encode("latin-1")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=180) as response:
        content = response.read()
    return content.decode("latin-1", errors="replace")


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_prn_table(text):
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


def split_uf(label):
    label = html.unescape(label).strip().strip('"')
    match = re.match(r"^(\d{2})\s+(.+)$", label)
    if not match:
        return None, label, None
    code, name = match.groups()
    return code, name, UF_CODE_TO_SIGLA.get(code)


def table_to_long(rows, value_name, year_from_header=True):
    header = rows[0]
    output = []
    for row in rows[1:]:
        if not row or row[0].strip().lower() == "total":
            continue
        uf_code, uf_name, uf_sigla = split_uf(row[0])
        if not uf_code:
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
            output.append(
                {
                    "uf_codigo": uf_code,
                    "uf": uf_sigla,
                    "uf_nome": uf_name,
                    "ano": year,
                    value_name: parse_number(cell),
                    f"{value_name}_coluna_origem": col,
                }
            )
    return output


def fetch_cnes_medicos():
    raw_path = OUT_DIR / "raw_cnes_medicos.html"
    if raw_path.exists():
        return table_to_long(parse_prn_table(raw_path.read_text(encoding="latin-1")), "medicos_vasculares_sus")
    files = [f"pfbr{year % 100:02d}12.dbf" for year in YEARS]
    data = [
        ("Linha", "Unidade_da_Federação"),
        ("Coluna", "Ano/mês_compet."),
        ("Incremento", "Quantidade"),
        *[("Arquivos", file) for file in files],
        ("SMédicos", "15"),
        ("SMédicos", "29"),
        ("SMédicos", "34"),
        ("SAtende_no_SUS", "1"),
        ("formato", "prn"),
        ("mostre", "Mostra"),
    ]
    text = post_tabnet("http://tabnet.datasus.gov.br/cgi/tabcgi.exe?cnes/cnv/prid02br.def", data)
    raw_path.write_text(text, encoding="latin-1")
    rows = parse_prn_table(text)
    return table_to_long(rows, "medicos_vasculares_sus")


def fetch_sih_metric(metric_label, metric_value):
    raw_path = OUT_DIR / f"raw_sih_{metric_label}.html"
    if raw_path.exists():
        return table_to_long(parse_prn_table(raw_path.read_text(encoding="latin-1")), metric_label)
    files = [f"qibr{year % 100:02d}{month:02d}.dbf" for year in YEARS for month in range(1, 13)]
    data = [
        ("Linha", "UF"),
        ("Coluna", "Ano_atendimento"),
        ("Incremento", metric_value),
        *[("Arquivos", file) for file in files],
        ("SProcedimento", "3331"),
        ("formato", "prn"),
        ("mostre", "Mostra"),
    ]
    text = post_tabnet("http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sih/cnv/qibr.def", data)
    raw_path.write_text(text, encoding="latin-1")
    rows = parse_prn_table(text)
    return table_to_long(rows, metric_label)


def fetch_population():
    population = {}
    url_6579 = (
        "https://apisidra.ibge.gov.br/values/t/6579/n3/all/v/9324/"
        "p/2013,2014,2015,2016,2017,2018,2019,2020,2021,2024,2025?formato=json"
    )
    for row in get_json(url_6579)[1:]:
        uf_code = row["D1C"]
        year = int(row["D3C"])
        population[(uf_code, year)] = {
            "populacao": parse_number(row["V"]),
            "populacao_fonte": "SIDRA 6579 - População residente estimada",
        }

    url_9514 = (
        "https://apisidra.ibge.gov.br/values/t/9514/n3/all/v/93/p/2022/"
        "c2/6794/c287/100362/c286/113635?formato=json"
    )
    for row in get_json(url_9514)[1:]:
        uf_code = row["D1C"]
        population[(uf_code, 2022)] = {
            "populacao": parse_number(row["V"]),
            "populacao_fonte": "SIDRA 9514 - Censo 2022, sexo total, idade total, forma de declaração total",
        }
    return population


def index_rows(rows, value_name):
    indexed = {}
    for row in rows:
        key = (row["uf_codigo"], row["ano"])
        indexed.setdefault(key, {}).update(row)
    return indexed


def main():
    cnes = index_rows(fetch_cnes_medicos(), "medicos_vasculares_sus")
    sih_internacoes = index_rows(fetch_sih_metric("internacoes_amputacao_mmii", "Internações"), "internacoes_amputacao_mmii")
    sih_obitos = index_rows(fetch_sih_metric("obitos_amputacao_mmii", "Óbitos"), "obitos_amputacao_mmii")
    population = fetch_population()

    all_keys = set(cnes) | set(sih_internacoes) | set(sih_obitos)
    final_rows = []
    for key in sorted(all_keys, key=lambda item: (item[1], item[0])):
        row = {}
        for source in (cnes, sih_internacoes, sih_obitos):
            row.update(source.get(key, {}))
        uf_code, year = key
        if not row:
            continue
        if "uf_codigo" not in row:
            row.update({"uf_codigo": uf_code, "ano": year, "uf": UF_CODE_TO_SIGLA.get(uf_code)})
        pop = population.get(key, {"populacao": None, "populacao_fonte": "Sem denominador SIDRA definido"})
        row.update(pop)
        internacoes = row.get("internacoes_amputacao_mmii")
        obitos = row.get("obitos_amputacao_mmii")
        medicos = row.get("medicos_vasculares_sus")
        populacao = row.get("populacao")
        if populacao:
            row["medicos_vasculares_por_100k"] = round(medicos / populacao * 100000, 6) if medicos is not None else None
            row["taxa_internacao_amputacao_mmii_por_100k"] = round(internacoes / populacao * 100000, 6) if internacoes is not None else None
        else:
            row["medicos_vasculares_por_100k"] = None
            row["taxa_internacao_amputacao_mmii_por_100k"] = None
        row["taxa_mortalidade_sih_pct"] = round(obitos / internacoes * 100, 6) if internacoes and obitos is not None else None
        row["letalidade_calculada_pct"] = row["taxa_mortalidade_sih_pct"]
        row["procedimento_sih"] = "0408050012 AMPUTACAO / DESARTICULACAO DE MEMBROS INFERIORES"
        row["cnes_competencia"] = row.get("medicos_vasculares_sus_coluna_origem")
        final_rows.append(row)

    columns = [
        "uf_codigo",
        "uf",
        "uf_nome",
        "ano",
        "cnes_competencia",
        "medicos_vasculares_sus",
        "populacao",
        "populacao_fonte",
        "medicos_vasculares_por_100k",
        "internacoes_amputacao_mmii",
        "obitos_amputacao_mmii",
        "taxa_mortalidade_sih_pct",
        "letalidade_calculada_pct",
        "taxa_internacao_amputacao_mmii_por_100k",
        "procedimento_sih",
    ]

    csv_path = OUT_DIR / "base_analise_vascular_amputacao_2013_2025.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(final_rows)

    meta = {
        "generated_rows": len(final_rows),
        "years": YEARS,
        "sources": {
            "cnes": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/prid02br.def",
            "sih": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/qibr.def",
            "sidra_6579": "https://sidra.ibge.gov.br/tabela/6579",
            "sidra_9514": "https://sidra.ibge.gov.br/tabela/9514",
        },
        "notes": [
            "CNES: selecionado somente dezembro de cada ano de 2013 a 2025.",
            "SIH: selecionados todos os meses de processamento de 2013 a 2025, com coluna Ano atendimento; coluna 2012 descartada.",
            "Taxa de mortalidade hospitalar calculada como óbitos / internações * 100 para evitar timeout do TabNet na consulta direta de Taxa mortalidade.",
            "População: 2013-2021 e 2024-2025 pela SIDRA 6579; 2022 pela SIDRA 9514; 2023 sem denominador oficial nesta regra, então taxas/densidades ficaram vazias.",
        ],
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(csv_path)
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
