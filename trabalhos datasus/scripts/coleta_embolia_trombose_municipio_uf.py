import csv
import html
import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from io import StringIO
from pathlib import Path


# Repo-relative: this file lives in <repo>/trabalhos datasus/scripts/
BASE_DIR = Path(__file__).resolve().parents[1]
OUT_DIR = BASE_DIR / "outputs" / "coleta_embolia_trombose_uf"
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
UF_SIGLA_TO_CODE = {sigla: code for code, sigla in UF_CODE_TO_SIGLA.items()}
UF_CODE_TO_NAME = {
    "11": "Rondônia",
    "12": "Acre",
    "13": "Amazonas",
    "14": "Roraima",
    "15": "Pará",
    "16": "Amapá",
    "17": "Tocantins",
    "21": "Maranhão",
    "22": "Piauí",
    "23": "Ceará",
    "24": "Rio Grande do Norte",
    "25": "Paraíba",
    "26": "Pernambuco",
    "27": "Alagoas",
    "28": "Sergipe",
    "29": "Bahia",
    "31": "Minas Gerais",
    "32": "Espírito Santo",
    "33": "Rio de Janeiro",
    "35": "São Paulo",
    "41": "Paraná",
    "42": "Santa Catarina",
    "43": "Rio Grande do Sul",
    "50": "Mato Grosso do Sul",
    "51": "Mato Grosso",
    "52": "Goiás",
    "53": "Distrito Federal",
}


def post_tabnet(url, data, timeout=180):
    body = urllib.parse.urlencode(data, doseq=True, encoding="latin-1").encode("latin-1")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("latin-1", errors="replace")


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


def municipio_to_uf(label):
    label = html.unescape(label).strip().strip('"')
    code_match = re.search(r"\b(\d{6})\b", label)
    if code_match:
        uf_code = code_match.group(1)[:2]
        return uf_code, UF_CODE_TO_SIGLA.get(uf_code), UF_CODE_TO_NAME.get(uf_code), label
    suffix_match = re.search(r"-\s*([A-Z]{2})$", label)
    if suffix_match:
        uf_sigla = suffix_match.group(1)
        uf_code = UF_SIGLA_TO_CODE.get(uf_sigla)
        return uf_code, uf_sigla, UF_CODE_TO_NAME.get(uf_code), label
    return None, None, None, label


def aggregate_municipal_rows(rows, value_name):
    header = rows[0]
    aggregated = defaultdict(float)
    ignored_rows = []
    for row in rows[1:]:
        if not row or row[0].strip().lower() == "total":
            continue
        uf_code, uf_sigla, uf_name, original_label = municipio_to_uf(row[0])
        if not uf_code:
            ignored_rows.append(original_label)
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
            aggregated[(uf_code, year)] += value

    output = []
    for (uf_code, year), value in sorted(aggregated.items(), key=lambda item: (item[0][1], item[0][0])):
        output.append(
            {
                "uf_codigo": uf_code,
                "uf": UF_CODE_TO_SIGLA.get(uf_code),
                "uf_nome": UF_CODE_TO_NAME.get(uf_code),
                "ano": year,
                value_name: int(value) if float(value).is_integer() else value,
            }
        )
    return output, ignored_rows


def table_to_long_uf(rows, value_name):
    header = rows[0]
    output = []
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
            output.append(
                {
                    "uf_codigo": uf_code,
                    "uf": UF_CODE_TO_SIGLA.get(uf_code),
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
        return table_to_long_uf(parse_prn_table(raw_path.read_text(encoding="latin-1")), "medicos_vasculares_sus")
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
    return table_to_long_uf(parse_prn_table(text), "medicos_vasculares_sus")


def fetch_sih_municipal_metric(metric_label, metric_value):
    raw_path = OUT_DIR / f"raw_sih_municipio_{metric_label}.html"
    ignored_path = OUT_DIR / f"ignored_municipios_{metric_label}.txt"
    if raw_path.exists():
        rows = parse_prn_table(raw_path.read_text(encoding="latin-1"))
        output, ignored_rows = aggregate_municipal_rows(rows, metric_label)
        ignored_path.write_text("\n".join(sorted(set(ignored_rows))), encoding="utf-8")
        return output

    combined = defaultdict(float)
    all_ignored = []
    for year in YEARS:
        year_raw_path = OUT_DIR / f"raw_sih_municipio_{metric_label}_{year}.html"
        if year_raw_path.exists():
            text = year_raw_path.read_text(encoding="latin-1")
        else:
            files = [f"nibr{year % 100:02d}{month:02d}.dbf" for month in range(1, 13)]
            data = [
                ("Linha", "Município"),
                ("Coluna", "Ano_atendimento"),
                ("Incremento", metric_value),
                *[("Arquivos", file) for file in files],
                ("SLista_Morb__CID-10", "183"),
                ("formato", "prn"),
                ("mostre", "Mostra"),
            ]
            text = post_tabnet("http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sih/cnv/nibr.def", data, timeout=120)
            year_raw_path.write_text(text, encoding="latin-1")

        rows = parse_prn_table(text)
        output, ignored_rows = aggregate_municipal_rows(rows, metric_label)
        all_ignored.extend(ignored_rows)
        for row in output:
            if row["ano"] != year:
                continue
            combined[(row["uf_codigo"], row["ano"])] += row[metric_label]

    final = []
    for (uf_code, year), value in sorted(combined.items(), key=lambda item: (item[0][1], item[0][0])):
        final.append(
            {
                "uf_codigo": uf_code,
                "uf": UF_CODE_TO_SIGLA.get(uf_code),
                "uf_nome": UF_CODE_TO_NAME.get(uf_code),
                "ano": year,
                metric_label: int(value) if float(value).is_integer() else value,
            }
        )
    ignored_path.write_text("\n".join(sorted(set(all_ignored))), encoding="utf-8")
    return final


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


def index_rows(rows):
    indexed = {}
    for row in rows:
        indexed.setdefault((row["uf_codigo"], row["ano"]), {}).update(row)
    return indexed


def main():
    cnes = index_rows(fetch_cnes_medicos())
    internacoes = index_rows(fetch_sih_municipal_metric("internacoes_embolia_trombose_arteriais", "Internações"))
    obitos = index_rows(fetch_sih_municipal_metric("obitos_embolia_trombose_arteriais", "Óbitos"))
    dias = index_rows(fetch_sih_municipal_metric("dias_permanencia_embolia_trombose_arteriais", "Dias_permanência"))
    population = fetch_population()

    all_keys = set(cnes) | set(internacoes) | set(obitos) | set(dias)
    final_rows = []
    for uf_code, year in sorted(all_keys, key=lambda item: (item[1], item[0])):
        row = {
            "uf_codigo": uf_code,
            "uf": UF_CODE_TO_SIGLA.get(uf_code),
            "uf_nome": UF_CODE_TO_NAME.get(uf_code),
            "ano": year,
        }
        for source in (cnes, internacoes, obitos, dias):
            row.update(source.get((uf_code, year), {}))
        row.update(population.get((uf_code, year), {"populacao": None, "populacao_fonte": "Sem denominador SIDRA definido"}))

        medicos = row.get("medicos_vasculares_sus")
        pop = row.get("populacao")
        hosp = row.get("internacoes_embolia_trombose_arteriais")
        deaths = row.get("obitos_embolia_trombose_arteriais")
        stay_days = row.get("dias_permanencia_embolia_trombose_arteriais")
        hosp = 0 if hosp is None else hosp
        deaths = 0 if deaths is None else deaths
        stay_days = 0 if stay_days is None else stay_days
        row["internacoes_embolia_trombose_arteriais"] = hosp
        row["obitos_embolia_trombose_arteriais"] = deaths
        row["dias_permanencia_embolia_trombose_arteriais"] = stay_days

        row["medicos_vasculares_por_100k"] = round(medicos / pop * 100000, 6) if medicos is not None and pop else None
        row["taxa_internacao_por_100k"] = round(hosp / pop * 100000, 6) if pop else None
        row["taxa_mortalidade_pct"] = round(deaths / hosp * 100, 6) if hosp else None
        row["media_permanencia_calculada"] = round(stay_days / hosp, 6) if hosp else None
        row["lista_morb_cid10"] = "Embolia e trombose arteriais"
        row["metodo_sih"] = "SIH nibr.def: linha município; agregação para UF pelo código IBGE municipal"
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
        "internacoes_embolia_trombose_arteriais",
        "obitos_embolia_trombose_arteriais",
        "dias_permanencia_embolia_trombose_arteriais",
        "taxa_mortalidade_pct",
        "media_permanencia_calculada",
        "taxa_internacao_por_100k",
        "lista_morb_cid10",
        "metodo_sih",
    ]

    csv_path = OUT_DIR / "base_embolia_trombose_arteriais_uf_2013_2025.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(final_rows)

    metadata = {
        "generated_rows": len(final_rows),
        "years": YEARS,
        "sources": {
            "cnes": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?cnes/cnv/prid02br.def",
            "sih_morbidade_local_internacao": "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def",
            "sidra_6579": "https://sidra.ibge.gov.br/tabela/6579",
            "sidra_9514": "https://sidra.ibge.gov.br/tabela/9514",
        },
        "notes": [
            "CNES: selecionado somente dezembro de cada ano de 2013 a 2025.",
            "SIH nibr.def não oferece UF diretamente em Linha; foi selecionado Linha = Município e depois agregado para UF pelo código IBGE municipal.",
            "SIH: selecionados todos os meses de processamento de 2013 a 2025; colunas de ano de atendimento fora de 2013-2025 foram descartadas.",
            "Lista Morb CID-10: Embolia e trombose arteriais, código interno TabNet 183.",
            "Média permanência calculada como dias permanência / internações após agregação UF-ano.",
            "Taxa mortalidade calculada como óbitos / internações * 100 após agregação UF-ano.",
            "População: 2013-2021 e 2024-2025 pela SIDRA 6579; 2022 pela SIDRA 9514; 2023 sem denominador oficial nesta regra, então taxas/densidades ficam vazias.",
        ],
    }
    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(csv_path)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
