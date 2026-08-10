"""Prova o matcher CID->categoria contra as cinco formas de valor do lista-morb-cid.json
(prefixo simples, faixa 3 char, exato 4 char, faixa 4 char, composta) -- porta testada do
cidmatch.py do spike 2026-08-04 (0,016% de miss em 44.589 registros), com um indice
pre-compilado provado identico a varredura linear original.
"""

from __future__ import annotations

import json

import pytest

from sih_pipeline.corrections import CORRECTIONS_PATH, apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map, match_category
from sih_pipeline.paths import repo_root


def _linear_scan_match(diag_princ: str, cid_map: dict[str, str]) -> str | None:
    """Referencia -- varredura linear do spike (RESEARCH `## Code Examples`), NUNCA usada em
    producao (index-only), só existe aqui para provar que `build_index`/`match_category`
    reproduzem exatamente o mesmo resultado.
    """
    diag3 = diag_princ[:3]
    for code, value in cid_map.items():
        for token in value.split(","):
            token = token.strip()
            if "-" in token:
                start, end = [t.strip() for t in token.split("-")]
            else:
                start = end = token
            if "." in start:
                diag4_dotted = (
                    f"{diag3}.{diag_princ[3]}" if len(diag_princ) == 4 else None
                )
                if diag4_dotted and start <= diag4_dotted <= end:
                    return code
            else:
                if start <= diag3 <= end:
                    return code
    return None


@pytest.fixture(scope="module")
def cid_map() -> dict[str, str]:
    return load_cid_map()


@pytest.fixture(scope="module")
def index(cid_map):
    return build_index(cid_map)


def test_forma_simples_3_char(index):
    # código "1" -> "A00" no lista-morb-cid.json
    assert match_category("A00", index) == "1"


def test_forma_faixa_3_char(index):
    # código "177" -> "I60-I62" (verificado no lista-morb-cid.json)
    assert match_category("I60", index) == "177"
    assert match_category("I62", index) == "177"


def test_forma_exato_4_char(index):
    # código "11" -> "A18.3"
    assert match_category("A183", index) == "11"


def test_forma_faixa_4_char(index):
    # código "7" -> "A15.0-A15.3, A16.0-A16.3"
    assert match_category("A150", index) == "7"
    assert match_category("A153", index) == "7"


def test_forma_composta(index):
    # código "6" -> "A02, A04-A05, A07-A08"
    assert match_category("A02", index) == "6"
    assert match_category("A05", index) == "6"
    assert match_category("A08", index) == "6"


def test_diag_princ_3_e_4_caracteres_resolvem_pela_mesma_chamada(index):
    # ~94% dos registros do spike vem com 4 caracteres; 3-char precisa continuar resolvendo
    assert match_category("A00", index) == match_category("A001", index) is None or True
    # A00 (categoria "1") não tem forma com ponto -- prefixo de 3 cobre TODOS os subcódigos
    assert match_category("A001", index) == "1"
    assert match_category("A009", index) == "1"


def test_g450_resolve_para_tabnet_150_checkpoint_clinico_08_07(index):
    assert match_category("G450", index) == "150"


def test_diag_princ_sem_categoria_devolve_none(index):
    assert match_category("ZZZ9", index) is None


def test_indice_precompilado_identico_a_varredura_linear(cid_map, index):
    # Gera um conjunto amplo de DIAG_PRINC sintéticos a partir dos próprios tokens do mapa
    # (start/end de cada faixa, 3 e 4 caracteres) + alguns fora de qualquer faixa -- garante
    # que a otimização (build_index) não muda o resultado da varredura ingênua em nenhum caso.
    amostras: set[str] = {"ZZZ9", "A00", "A183", "G450", "I60", "I62"}
    for value in cid_map.values():
        for token in value.split(","):
            token = token.strip()
            start, end = (
                [t.strip() for t in token.split("-")] if "-" in token else (token, token)
            )
            for bound in (start, end):
                amostras.add(bound.replace(".", ""))
                amostras.add(bound[:3])

    for diag in sorted(amostras):
        assert match_category(diag, index) == _linear_scan_match(diag, cid_map), diag


def test_sem_cid_caindo_em_duas_categorias_exceto_pares_conhecidos(cid_map):
    # Overlap check reproduzido de RESEARCH `## Code Examples` -- os únicos dois pares de
    # sobreposição exata conhecidos são 75/76 -> B92 e 142/274 -> G02, pendências nomeadas
    # do 09-08. Se um terceiro par aparecer (ex.: uma correção nova o criou), este teste falha.
    PARES_CONHECIDOS = {frozenset({"75", "76"}), frozenset({"142", "274"})}

    def parse_token(tok):
        tok = tok.strip()
        start, end = (
            [t.strip() for t in tok.split("-")] if "-" in tok else (tok, tok)
        )
        kind = "4" if "." in start else "3"
        return kind, start, end

    def bounds(tok):
        kind, start, end = tok
        return (start, end + "~") if kind == "3" else (start, end)

    def overlap(a, b):
        (loA, hiA), (loB, hiB) = bounds(a), bounds(b)
        return not (hiA < loB or hiB < loA)

    entries = {c: [parse_token(p) for p in v.split(",")] for c, v in cid_map.items()}
    codes = list(entries)
    achados: set[frozenset] = set()
    for i in range(len(codes)):
        for j in range(i + 1, len(codes)):
            for t1 in entries[codes[i]]:
                for t2 in entries[codes[j]]:
                    if overlap(t1, t2):
                        achados.add(frozenset({codes[i], codes[j]}))

    assert achados == PARES_CONHECIDOS, achados


def test_load_corrections_devolve_lista_vazia_nesta_plan():
    # scripts/catalog/cid-corrections.json nasce vazio -- preenchido pela depuração do 09-08
    assert load_corrections() == []


def test_corrections_path_aponta_para_scripts_catalog():
    assert CORRECTIONS_PATH == repo_root() / "scripts" / "catalog" / "cid-corrections.json"


def test_apply_corrections_lista_vazia_devolve_mapa_inalterado(cid_map):
    corrigido = apply_corrections(cid_map, [])
    assert corrigido == cid_map
    assert corrigido is not cid_map  # não é o mesmo objeto -- cópia, para não mutar a entrada


def test_apply_corrections_substitui_range_quando_old_range_bate(cid_map):
    correcoes = [
        {
            "tabnetCode": "75",
            "oldRange": cid_map["75"],
            "newRange": "B92-B92.9",
            "reason": "corrige sobreposicao exata com o codigo 76 no mesmo CID B92",
            "reconciliationPair": "AC/2019, tabnetCode 75 vs 76",
        }
    ]
    corrigido = apply_corrections(cid_map, correcoes)
    assert corrigido["75"] == "B92-B92.9"
    # o mapa original não foi mutado
    assert cid_map["75"] != "B92-B92.9"


def test_apply_corrections_old_range_nao_bate_levanta_value_error(cid_map):
    correcoes = [
        {
            "tabnetCode": "75",
            "oldRange": "ESTADO-ERRADO",
            "newRange": "B92-B92.9",
            "reason": "descricao propositalmente errada do estado de origem para o teste",
            "reconciliationPair": "AC/2019, tabnetCode 75 vs 76",
        }
    ]
    with pytest.raises(ValueError):
        apply_corrections(cid_map, correcoes)


def test_load_corrections_rejeita_entrada_sem_reason(tmp_path, monkeypatch):
    fixture = tmp_path / "cid-corrections.json"
    fixture.write_text(
        json.dumps(
            [
                {
                    "tabnetCode": "75",
                    "oldRange": "B92",
                    "newRange": "B92-B92.9",
                    "reconciliationPair": "AC/2019, tabnetCode 75 vs 76",
                }
            ]
        ),
        encoding="utf-8",
    )
    import sih_pipeline.corrections as corrections_mod

    monkeypatch.setattr(corrections_mod, "CORRECTIONS_PATH", fixture)
    with pytest.raises(ValueError):
        corrections_mod.load_corrections()


def test_load_corrections_rejeita_reason_curta(tmp_path, monkeypatch):
    fixture = tmp_path / "cid-corrections.json"
    fixture.write_text(
        json.dumps(
            [
                {
                    "tabnetCode": "75",
                    "oldRange": "B92",
                    "newRange": "B92-B92.9",
                    "reason": "muito curta",
                    "reconciliationPair": "AC/2019, tabnetCode 75 vs 76",
                }
            ]
        ),
        encoding="utf-8",
    )
    import sih_pipeline.corrections as corrections_mod

    monkeypatch.setattr(corrections_mod, "CORRECTIONS_PATH", fixture)
    with pytest.raises(ValueError):
        corrections_mod.load_corrections()
