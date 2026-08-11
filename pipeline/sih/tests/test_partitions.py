"""Prova a geração das partições JSON colunares por UF (gzip) para o Storage — D-20/D-21.

Roda sobre `tests/fixtures/rdac_2019.parquet` (mesma fixture real de AC/2019 do 09-07/09-08) --
nenhum teste desta suíte toca a rede (`upload_partition`/`_fetch` são isolados e substituídos por
monkeypatch, mesmo padrão de `test_oracle_scrape.py`) nem o cache real (`~/.lacir/sih-cache/`) --
todo teste que exercita `cache_path` redireciona via `SIH_PIPELINE_CACHE_DIR=tmp_path`
(monkeypatch), nunca lê nem escreve o cache que a corrida real de coleta (PID vivo) está usando.

**Suíte "agregados" (adaptação 2026-08-11, 09-09-ADAPTACAO-AGREGADOS):** prova o handoff aberto
pelo 09-04-COLETA-INCREMENTAL -- `linhas_da_uf` precisa produzir a MESMA partição a partir do
agregado persistido (`cache_path("agregados/{uf}.parquet")`) e a partir do parquet bruto isolado
a essa UF, e precisa tratar "UF sem nenhum dos dois" como estado normal, nunca erro.

**Suíte "território" (correção 2026-08-11, 09-09-FIX-RESIDENCIA):** prova a correção do defeito
registrado (mas não corrigido) pela adaptação acima -- `linhas_da_uf` selecionava por qual ARQUIVO
uma linha mora, não por qual TERRITÓRIO ela descreve. Prova as duas direções do defeito
(contaminação: uma UF devolvia território de outras UFs; subcontagem: a residência própria de uma
UF presa no arquivo de outra UF nunca chegava ao resultado), a soma entre fontes na mesma chave, o
custo O(27) (não O(27²)), e que a prova byte-idêntica original continua valendo com correção.
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

import sih_pipeline.partitions as partitions_mod
from sih_pipeline.aggregate import GRAO_MUNICIPIO, GRAO_UF, LOCAL_OCORRENCIA, LOCAL_RESIDENCIA, Row, aggregate_parquet_dir
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map
from sih_pipeline.partitions import (
    BUCKET,
    COLUNAS_METRICA,
    PARTITION_PREFIX,
    _linhas_municipio_por_uf,
    _object_key,
    build_partition,
    cid_map_version,
    construir_indice_territorial,
    linhas_da_uf,
    main,
    upload_partition,
    write_partition,
)
from sih_pipeline.paths import cache_path

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rdac_2019.parquet"


@pytest.fixture(scope="module")
def index():
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    return build_index(cid_map)


@pytest.fixture(scope="module")
def fixture_rows(index) -> list[Row]:
    return aggregate_parquet_dir(FIXTURE_PATH, index)


@pytest.fixture(scope="module")
def grupos_por_uf(fixture_rows) -> dict[str, list[Row]]:
    return _linhas_municipio_por_uf(fixture_rows)


@pytest.fixture(scope="module")
def ac_municipio_rows(grupos_por_uf) -> list[Row]:
    # Agrupado por UF de fato: MUNIC_RES de um paciente internado no AC pode apontar para outra
    # UF (D-09, residência do paciente != local de internação) -- "grão município" sozinho não
    # basta para "só do AC" (achado real desta plan, ver Deviations do SUMMARY).
    linhas = grupos_por_uf["AC"]
    assert linhas, "fixture sem nenhuma linha de grão município do AC -- fixture quebrada"
    return linhas


def test_build_partition_arrays_paralelos_mesmo_comprimento(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    n = len(ac_municipio_rows)
    assert len(payload["dados"]) == len(payload["colunas"])
    for coluna_lista in payload["dados"]:
        assert len(coluna_lista) == n


def test_build_partition_ordem_de_colunas_fixa(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    assert payload["colunas"] == list(COLUNAS_METRICA)
    assert payload["schema"] == 1


def test_build_partition_so_grao_municipio_e_so_a_uf_pedida(ac_municipio_rows):
    # Injeta uma linha de grão UF -- deve ser rejeitada, nunca silenciosamente incluída.
    linha_uf = Row(
        disease_id="x",
        grao="uf",
        local="ocorrencia",
        territorio_codigo="12",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=1.0,
        dias_permanencia=1,
        taxa_mortalidade=None,
    )
    with pytest.raises(ValueError, match="grão"):
        build_partition("AC", [*ac_municipio_rows, linha_uf])

    # Injeta uma linha de outra UF (município de SP, prefixo "35") -- deve ser rejeitada.
    linha_sp = ac_municipio_rows[0]._replace(territorio_codigo="355030")
    with pytest.raises(ValueError, match="UF"):
        build_partition("AC", [*ac_municipio_rows, linha_sp])


def test_build_partition_dois_locais_na_mesma_particao(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    idx_local = payload["colunas"].index("local")
    locais_presentes = set(payload["dados"][idx_local])
    assert locais_presentes == {"ocorrencia", "residencia"}


def test_build_partition_taxa_mortalidade_ausente_e_null_nunca_zero(ac_municipio_rows):
    # Numa linha REAL agregada (Row só existe quando internacoes >= 1), taxa_mortalidade nunca é
    # None -- é sempre um float (ver _taxa_mortalidade em aggregate.py). O contrato de
    # build_partition (nunca coagir ausência para 0) é sobre o valor que Row carrega, não sobre
    # produzir ausência sozinho -- provado com uma Row sintética de internacoes=0/obitos=0.
    linha_sem_internacao = ac_municipio_rows[0]._replace(
        internacoes=0, obitos=0, taxa_mortalidade=None
    )
    payload = build_partition("AC", [linha_sem_internacao])
    idx_taxa = payload["colunas"].index("taxa_mortalidade")
    assert payload["dados"][idx_taxa] == [None]
    assert payload["dados"][idx_taxa] != [0]


def test_build_partition_uf_sem_linha_levanta():
    with pytest.raises(ValueError, match="sem nenhuma linha"):
        build_partition("AC", [])


def test_build_partition_derived_at_e_cid_map_version_presentes(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    assert payload["derivedAt"].endswith("Z")
    assert len(payload["derivedAt"]) == 20  # 2026-08-10T12:00:00Z
    assert payload["cidMapVersion"] == cid_map_version()
    assert len(payload["cidMapVersion"]) == 64  # sha256 hexdigest


def test_build_partition_familia_default_e_metrica(ac_municipio_rows):
    # Provado mesmo quando a decisão do 09-06 é `popsvs-no-banco` -- o parâmetro existe e o
    # default produz exatamente o mesmo resultado de uma chamada sem `familia`.
    com_default = build_partition("AC", ac_municipio_rows)
    explicito = build_partition("AC", ac_municipio_rows, familia="metrica")
    assert com_default["colunas"] == explicito["colunas"] == list(COLUNAS_METRICA)


def test_build_partition_familia_desconhecida_levanta(ac_municipio_rows):
    with pytest.raises(ValueError, match="familia"):
        build_partition("AC", ac_municipio_rows, familia="inexistente")


def test_write_partition_produz_gzip_valido_conteudo_identico_byte_a_byte(
    ac_municipio_rows, tmp_path, monkeypatch
):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    payload = build_partition("AC", ac_municipio_rows)

    destino = write_partition("AC", payload)
    assert destino.exists()
    assert destino.name == "AC.json.gz"

    corpo_descomprimido = gzip.decompress(destino.read_bytes())
    esperado = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    assert corpo_descomprimido == esperado
    assert json.loads(corpo_descomprimido) == payload


def test_upload_partition_faz_put_com_service_role_e_sem_cabecalho_de_compressao(
    ac_municipio_rows, tmp_path, monkeypatch
):
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "chave-service-role-fake")

    payload = build_partition("AC", ac_municipio_rows)
    caminho = tmp_path / "AC.json.gz"
    caminho.write_bytes(gzip.compress(json.dumps(payload).encode("utf-8"), mtime=0))

    chamadas = []

    def fake_fetch(request, timeout):
        chamadas.append(request)
        return b""

    monkeypatch.setattr("sih_pipeline.partitions._fetch", fake_fetch)

    upload_partition(caminho, "AC")

    assert len(chamadas) == 1
    req = chamadas[0]
    assert req.full_url == f"https://exemplo.supabase.co/storage/v1/object/{BUCKET}/{PARTITION_PREFIX}/AC.json.gz"
    assert req.get_header("Authorization") == "Bearer chave-service-role-fake"
    assert req.get_header("Apikey") == "chave-service-role-fake"
    # nunca depende do cabeçalho de compressão do servidor (RESEARCH Pitfall 11)
    assert req.get_header("Content-encoding") is None
    assert req.get_header("Content-type") == "application/octet-stream"


def test_object_key_espelha_bucket_e_prefixo():
    assert BUCKET == "sih-municipio"
    assert PARTITION_PREFIX == "v1"
    assert _object_key("SP") == "v1/SP.json.gz"
    assert _object_key("SP", familia="populacao") == "v1/pop/SP.json.gz"


def test_main_help_sai_zero(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0


def test_main_sem_uf_nem_todas_sai_dois(capsys):
    assert main([]) == 2


# ---------------------------------------------------------------------------
# Suíte "agregados" -- adaptação 2026-08-11 (09-09-ADAPTACAO-AGREGADOS). Prova o handoff aberto
# pelo 09-04-COLETA-INCREMENTAL: `linhas_da_uf` prioriza cache_path("agregados/{uf}.parquet") e
# cai para o parquet bruto -- sempre isolado à UF pedida -- só quando o agregado ainda não
# existe. Todo teste redireciona o cache via SIH_PIPELINE_CACHE_DIR=tmp_path (nunca toca
# ~/.lacir/sih-cache/, que a corrida real de coleta está usando agora).
# ---------------------------------------------------------------------------


def _escrever_parquet_bruto_ac() -> None:
    """Copia a fixture real de AC/2019 para dentro do cache falso (já redirecionado via
    SIH_PIPELINE_CACHE_DIR pelo chamador), com o nome de arquivo bruto real (`RDAC1901.parquet`)
    que `_arquivos_brutos_da_uf` procura via prefixo `RD{uf}`."""
    destino = cache_path("parquet") / "RDAC1901.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(FIXTURE_PATH.read_bytes())


def _persistir_agregado(uf: str, linhas: list[Row]) -> Path:
    """Espelha `collect.py:_persist_rows` (mesmo schema, `Row._fields` na mesma ordem) sem
    importar `collect.py` (módulo vivo, fora do escopo desta adaptação) -- usado só para os
    testes desta suíte montarem um agregado persistido sintético a partir de `Row` já conhecidas."""
    colunas: dict[str, list] = {nome: [] for nome in Row._fields}
    for linha in linhas:
        for nome in Row._fields:
            colunas[nome].append(getattr(linha, nome))
    tabela = pa.table(colunas)
    destino = cache_path(f"agregados/{uf}.parquet")
    pq.write_table(tabela, destino)
    return destino


def _escrever_parquet_bruto_sp_sintetico() -> None:
    """Escreve um parquet BRUTO mínimo, mas GENUÍNO, para SP -- um único registro real (mesmo
    `DIAG_PRINC` que casa de verdade na fixture do AC, T-09-30) com `MUNIC_MOV`/`MUNIC_RES` de SP
    (`355030`, São Paulo capital), nunca uma cópia dos bytes reais do AC sob um nome de arquivo de
    SP: sob a correção 2026-08-11, dono é decidido pelo CONTEÚDO (`MUNIC_MOV`/`MUNIC_RES`), não
    pelo nome do arquivo -- copiar bytes do AC "como se fossem" de SP contaminaria o próprio teste
    (o "SP" resultante seria, na verdade, mais AC, duplicando o AC real por soma de chave)."""
    tabela = pa.table(
        {
            "DIAG_PRINC": ["O808"],
            "MUNIC_MOV": ["355030"],
            "MUNIC_RES": ["355030"],
            "MORTE": ["0"],
            "VAL_TOT": ["        459.40"],
            "DIAS_PERM": ["    2"],
            "ANO_CMPT": ["2019"],
            "IDENT": ["1"],
        }
    )
    destino = cache_path("parquet") / "RDSP1901.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(tabela, destino)


def _persistir_agregado_realista(uf: str, index) -> Path:
    """Persiste o agregado de `uf` exatamente como `collect.py` faz de verdade: a agregação BRUTA
    do arquivo isolado dessa UF, SEM filtrar por dono -- `collect.py` não sabe (nem precisa saber)
    que uma fração dessas linhas descreve território de outra UF (D-09), é papel de `linhas_da_uf`
    filtrar isso NA LEITURA (correção 2026-08-11), não na escrita. Usar o resultado JÁ FILTRADO de
    `linhas_da_uf` aqui simularia um cenário que nunca acontece em produção -- este helper evita
    esse erro nos testes desta suíte."""
    linhas_brutas = partitions_mod._linhas_do_parquet_bruto_isolado(uf, index)
    return _persistir_agregado(uf, linhas_brutas)


def test_linhas_da_uf_sem_agregado_e_sem_bruto_e_estado_normal_nunca_erro(tmp_path, monkeypatch, index):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    linhas, origem = linhas_da_uf("RO", index)

    assert linhas == []
    assert origem == "bruto"


def test_linhas_da_uf_cai_para_parquet_bruto_isolado_quando_agregado_nao_existe(
    tmp_path, monkeypatch, index
):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()

    linhas, origem = linhas_da_uf("AC", index)

    assert origem == "bruto"
    assert linhas
    assert not cache_path("agregados/AC.parquet").exists()


def test_linhas_da_uf_prioriza_agregado_persistido_quando_existe(tmp_path, monkeypatch, index):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()
    linhas_via_bruto, origem_bruto = linhas_da_uf("AC", index)  # já filtrado por dono
    assert origem_bruto == "bruto"

    # collect.py persiste a agregação BRUTA (não filtrada por dono) do arquivo -- ver
    # _persistir_agregado_realista.
    _persistir_agregado_realista("AC", index)

    linhas_agregado, origem = linhas_da_uf("AC", index)

    assert origem == "agregado"
    # mesmo lendo de uma fonte NÃO filtrada, o resultado é idêntico ao lido via bruto isolado --
    # a filtragem por dono acontece na LEITURA (linhas_da_uf), não depende de quem persistiu.
    assert linhas_agregado == linhas_via_bruto


def test_particao_de_agregado_e_de_parquet_bruto_sao_byte_identicas(tmp_path, monkeypatch, index):
    """O teste central desta adaptação: a partição de uma UF construída a partir do agregado
    persistido precisa ser byte-idêntica à mesma partição construída a partir do parquet bruto
    isolado a essa UF -- a única diferença permitida entre as duas chamadas é QUAL arquivo
    alimentou `aggregate_years`, nunca o conteúdo produzido (D-20/D-21: "não mudar o que a
    partição contém")."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(partitions_mod, "_now_iso", lambda: "2026-08-11T00:00:00Z")

    _escrever_parquet_bruto_ac()
    linhas_bruto, origem_bruto = linhas_da_uf("AC", index)
    assert origem_bruto == "bruto"
    assert linhas_bruto

    # collect.py persiste a agregação BRUTA (não filtrada por dono) -- ver
    # _persistir_agregado_realista.
    _persistir_agregado_realista("AC", index)
    linhas_agregado, origem_agregado = linhas_da_uf("AC", index)
    assert origem_agregado == "agregado"

    rows_bruto = _linhas_municipio_por_uf(linhas_bruto)["AC"]
    rows_agregado = _linhas_municipio_por_uf(linhas_agregado)["AC"]
    assert rows_bruto == rows_agregado

    payload_bruto = build_partition("AC", rows_bruto)
    payload_agregado = build_partition("AC", rows_agregado)
    assert payload_bruto == payload_agregado

    corpo_bruto = json.dumps(payload_bruto, ensure_ascii=False).encode("utf-8")
    corpo_agregado = json.dumps(payload_agregado, ensure_ascii=False).encode("utf-8")
    assert corpo_bruto == corpo_agregado

    gz_bruto = gzip.compress(corpo_bruto, compresslevel=9, mtime=0)
    gz_agregado = gzip.compress(corpo_agregado, compresslevel=9, mtime=0)
    assert gz_bruto == gz_agregado


def test_linhas_do_agregado_persistido_schema_divergente_levanta_em_vez_de_coagir(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    caminho = cache_path("agregados/ZZ.parquet")
    pq.write_table(pa.table({"coluna_errada": [1, 2, 3]}), caminho)

    with pytest.raises(ValueError, match="schema"):
        partitions_mod._linhas_do_agregado_persistido("ZZ")


def test_main_uf_nao_coletada_imprime_mensagem_clara_e_nao_quebra(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    resultado = main(["--uf", "RO"])

    assert resultado == 0
    saida = capsys.readouterr().out
    assert "RO" in saida
    assert "pulando" in saida


def test_main_uf_com_so_parquet_bruto_gera_particao_origem_bruto(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()

    resultado = main(["--uf", "AC"])

    assert resultado == 0
    assert cache_path("particoes/AC.json.gz").exists()
    saida = capsys.readouterr().out
    assert "origem=bruto" in saida


def test_main_uf_com_agregado_persistido_gera_particao_origem_agregado(tmp_path, monkeypatch, index, capsys):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()
    _persistir_agregado_realista("AC", index)

    resultado = main(["--uf", "AC"])

    assert resultado == 0
    assert cache_path("particoes/AC.json.gz").exists()
    saida = capsys.readouterr().out
    assert "origem=agregado" in saida


def test_main_todas_mistura_agregado_bruto_e_uf_nao_coletada(tmp_path, monkeypatch, index, capsys):
    """Cenário real da corrida em andamento: algumas UFs já têm agregado persistido (bruto
    reciclado), outras só têm parquet bruto (ainda não processadas por `collect.py`), e a
    maioria não tem nenhum dos dois ainda -- `--todas` precisa lidar com essa mistura sem
    quebrar, gerando partição só para as duas primeiras.

    SP recebe um parquet bruto GENUÍNO (nunca uma cópia dos bytes do AC sob nome de SP -- sob a
    correção 2026-08-11 isso contaminaria o teste, ver `_escrever_parquet_bruto_sp_sintetico`).
    A UF "sem dado nenhum" desta prova é TO (não RO): a fixture real do AC tem residência
    presa apontando para RO (`MUNIC_RES` prefixo `11`), então RO deixou de estar "sem dado"
    depois da correção -- é exatamente o comportamento que a correção existe para produzir, mas
    quebraria esta asserção se TO não tivesse sido escolhido no lugar (TO/PI/AL/SE/ES estão
    totalmente ausentes de `MUNIC_MOV`/`MUNIC_RES` na fixture, medido ao vivo)."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()
    _persistir_agregado_realista("AC", index)

    # SP: parquet bruto ainda presente, sem agregado -- simula UF "em trânsito" (baixada, ainda
    # não agregada/reciclada pela corrida real).
    _escrever_parquet_bruto_sp_sintetico()

    resultado = main(["--todas"])

    assert resultado == 0
    assert cache_path("particoes/AC.json.gz").exists()
    saida = capsys.readouterr().out
    assert "AC -> " in saida
    assert "origem=agregado" in saida
    # TO (e as outras UFs sem nenhum dado neste cache falso, real ou contribuído) ficam com
    # mensagem clara, nunca crash -- prova que a mistura inteira roda até o fim.
    assert "TO" in saida
    assert "pulando" in saida


# ---------------------------------------------------------------------------
# Suíte "território" -- correção 2026-08-11 (09-09-FIX-RESIDENCIA). Prova o defeito real
# registrado (mas não corrigido) pela adaptação acima: `linhas_da_uf` selecionava por qual
# ARQUIVO uma linha mora, nunca por qual TERRITÓRIO ela descreve. Ver "Correção 2026-08-11" na
# docstring do módulo para o raciocínio completo.
# ---------------------------------------------------------------------------


def _row(**overrides) -> Row:
    """`Row` sintética mínima para os testes desta suíte -- os campos default descrevem uma
    internação qualquer; cada teste sobrescreve só o que importa para a prova."""
    base = dict(
        disease_id="teste_sintetico",
        grao=GRAO_MUNICIPIO,
        local=LOCAL_RESIDENCIA,
        territorio_codigo="120040",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=100.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )
    base.update(overrides)
    return Row(**base)


def test_uf_dona_deriva_do_territorio_nunca_do_arquivo():
    """Unidade isolada de `_uf_dona`: grão UF usa o código de 2 dígitos direto, grão município
    usa os 2 primeiros dígitos do código de 6 -- nos dois casos, o resultado só depende do
    território, nunca de qual arquivo a `Row` veio (esta função nem recebe essa informação)."""
    linha_uf = _row(grao=GRAO_UF, territorio_codigo="12", local=LOCAL_OCORRENCIA)
    linha_municipio = _row(grao=GRAO_MUNICIPIO, territorio_codigo="120040", local=LOCAL_RESIDENCIA)

    assert partitions_mod._uf_dona(linha_uf) == "AC"
    assert partitions_mod._uf_dona(linha_municipio) == "AC"


def test_linhas_da_uf_nao_inclui_territorio_de_outra_uf_mesmo_estando_no_proprio_arquivo(
    tmp_path, monkeypatch, index
):
    """CONTAMINAÇÃO corrigida: o arquivo bruto real do AC contém milhares de linhas de residência
    cujo território é de OUTRA UF (`MUNIC_RES` aponta para fora do AC, D-09 -- medido ao vivo:
    2.000/44.589 registros da fixture têm `MUNIC_RES` fora do prefixo `12`). A versão anterior de
    `linhas_da_uf` devolvia TUDO que estava no arquivo do AC, incluindo essas -- agora só as
    linhas cujo território é DO AC entram no resultado."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()

    linhas, _origem = linhas_da_uf("AC", index)

    assert linhas  # sanity: AC tem dado real
    for linha in linhas:
        assert partitions_mod._uf_dona(linha) == "AC", (
            f"linha de território {linha.territorio_codigo!r} (grao={linha.grao!r}) não é "
            "dona do AC -- contaminação por arquivo, não por dono"
        )


def test_linhas_da_uf_recupera_residencia_propria_presa_em_outra_uf_undercount(
    tmp_path, monkeypatch, index
):
    """SUBCONTAGEM corrigida: uma linha de residência do AC (grão município, território do AC)
    presa no agregado de OUTRA UF (SP -- paciente do AC internado em SP) precisa aparecer no
    resultado de `linhas_da_uf("AC", ...)`. A versão anterior só lia o arquivo do AC e nunca via
    essa linha -- e o resultado de SP, simetricamente, NUNCA deve incluí-la (ela não é dona)."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    linha_residencia_ac_presa_em_sp = _row(
        disease_id="teste_undercount",
        grao=GRAO_MUNICIPIO,
        local=LOCAL_RESIDENCIA,
        territorio_codigo="120040",  # Rio Branco, AC
        ano=2019,
        internacoes=3,
        obitos=1,
        valor_total=900.0,
        dias_permanencia=10,
        taxa_mortalidade=1 / 3,
    )
    _persistir_agregado("SP", [linha_residencia_ac_presa_em_sp])

    linhas_ac, _origem_ac = linhas_da_uf("AC", index)
    linhas_sp, _origem_sp = linhas_da_uf("SP", index)

    assert linhas_ac == [linha_residencia_ac_presa_em_sp]
    assert linhas_sp == []


def test_linhas_da_uf_soma_mesma_chave_vinda_de_fontes_diferentes(tmp_path, monkeypatch, index):
    """Duas fontes diferentes (AC e SP) contribuem a MESMA chave
    (disease_id, grao, local, territorio_codigo, ano) para o território do AC -- ex.: um
    residente do AC internado no próprio AC (fonte AC) e outro residente do AC internado em SP
    (fonte SP), mesma categoria, mesmo ano. As duas precisam ser SOMADAS, nunca uma sobrescrevendo
    a outra -- elas descrevem pacientes DIFERENTES que só coincidem em território/categoria/ano;
    perder uma seria pior que somar (nenhuma das duas é "a errada")."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    chave_comum = dict(
        disease_id="teste_soma",
        grao=GRAO_MUNICIPIO,
        local=LOCAL_RESIDENCIA,
        territorio_codigo="120040",
        ano=2020,
    )
    linha_ac = _row(**chave_comum, internacoes=5, obitos=1, valor_total=500.0, dias_permanencia=20, taxa_mortalidade=0.2)
    linha_presa_em_sp = _row(**chave_comum, internacoes=2, obitos=0, valor_total=100.0, dias_permanencia=4, taxa_mortalidade=0.0)

    _persistir_agregado("AC", [linha_ac])
    _persistir_agregado("SP", [linha_presa_em_sp])

    linhas_ac, _origem = linhas_da_uf("AC", index)

    assert len(linhas_ac) == 1
    combinada = linhas_ac[0]
    assert combinada.internacoes == 7
    assert combinada.obitos == 1
    assert combinada.valor_total == 600.0
    assert combinada.dias_permanencia == 24
    # taxa_mortalidade é RECALCULADA sobre os totais somados, nunca somada ela mesma (não é
    # medida aditiva) -- 1 óbito / 7 internações, não 0.2 + 0.0.
    assert combinada.taxa_mortalidade == pytest.approx(1 / 7)


def test_linhas_da_uf_uf_sem_fonte_propria_e_sem_contribuicao_continua_estado_normal(
    tmp_path, monkeypatch, index
):
    """UF sem fonte própria (nem agregado, nem bruto) E sem nenhuma linha de outra UF apontando
    para o seu território continua estado normal -- lista vazia, nunca erro -- mesmo quando
    OUTRAS UFs já têm dado real em cache (cenário real da corrida em andamento). TO (não RO) é a
    UF usada aqui: medido ao vivo que a fixture do AC não toca TO em nenhum grão/local, enquanto
    RO aparece como residência presa (ver suíte acima) -- usar RO aqui provaria o oposto do que
    o teste quer provar."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()

    linhas_to, origem_to = linhas_da_uf("TO", index)

    assert linhas_to == []
    assert origem_to == "bruto"


def test_particao_do_ac_identica_entre_bruto_e_agregado_mesmo_com_outra_uf_contribuindo(
    tmp_path, monkeypatch, index
):
    """A prova byte-idêntica original (suíte "agregados" acima, uma UF só na cache) precisa
    continuar valendo quando OUTRA UF também contribui uma linha para o território do AC -- o
    cenário real que motivou esta correção. A diferença entre ler o AC via agregado persistido ou
    via bruto isolado não pode depender de quantas outras fontes estão presentes."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(partitions_mod, "_now_iso", lambda: "2026-08-11T00:00:00Z")

    linha_extra_de_sp = _row(
        disease_id="teste_contribuicao_externa",
        grao=GRAO_MUNICIPIO,
        local=LOCAL_RESIDENCIA,
        territorio_codigo="120040",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=50.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )
    _persistir_agregado("SP", [linha_extra_de_sp])

    _escrever_parquet_bruto_ac()
    linhas_bruto, origem_bruto = linhas_da_uf("AC", index)
    assert origem_bruto == "bruto"

    _persistir_agregado_realista("AC", index)
    linhas_agregado, origem_agregado = linhas_da_uf("AC", index)
    assert origem_agregado == "agregado"

    rows_bruto = _linhas_municipio_por_uf(linhas_bruto)["AC"]
    rows_agregado = _linhas_municipio_por_uf(linhas_agregado)["AC"]
    assert rows_bruto == rows_agregado

    payload_bruto = build_partition("AC", rows_bruto)
    payload_agregado = build_partition("AC", rows_agregado)
    assert payload_bruto == payload_agregado


def test_construir_indice_territorial_le_cada_fonte_uma_unica_vez(tmp_path, monkeypatch, index):
    """Custo (ver "Correção 2026-08-11" na docstring do módulo): cada fonte (agregado persistido
    OU parquet bruto isolado) é lida EXATAMENTE UMA VEZ para as 27 UFs candidatas, nunca uma vez
    por UF pedida -- O(27), não O(27²). Provado contando chamadas ao leitor de baixo nível."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    _escrever_parquet_bruto_ac()
    _persistir_agregado_realista("AC", index)  # AC tem agregado -- bruto nem é tentado

    chamadas: list[str] = []
    original = partitions_mod._linhas_do_agregado_persistido

    def contador(uf):
        chamadas.append(uf)
        return original(uf)

    monkeypatch.setattr(partitions_mod, "_linhas_do_agregado_persistido", contador)

    indice = construir_indice_territorial(index)

    assert len(chamadas) == len(partitions_mod.UFS)  # uma checagem por UF candidata, nunca mais
    assert len(set(chamadas)) == len(chamadas)  # nenhuma UF lida duas vezes
    assert indice["AC"][0]  # sanity: o índice ainda funciona
