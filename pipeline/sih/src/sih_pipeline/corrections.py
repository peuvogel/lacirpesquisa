"""Camada de correção de faixa CID (D-05) — segunda fonte, com motivo escrito por entrada.

`scripts/catalog/lista-morb-cid.json` continua sendo exatamente o que a fonte oficial diz — não
é editado por este módulo nem por nenhum outro da fase (invariante C da Fase 8, sha256 sobre o
HTML bruto). Correções de faixa vivem aqui, na mesma forma "dado com motivo escrito, nunca
allowlist silenciosa" já estabelecida em `scripts/catalog/extra-diseases.json` /
`scripts/catalog/exclusions.json` (Fase 8 D-14).

Schema de cada entrada de `cid-corrections.json`:
    tabnetCode          -- código TabNet (chave de `lista-morb-cid.json`) sendo corrigido
    oldRange             -- faixa CID atual no mapa, EXATAMENTE como está lá — apply_corrections
                            valida isto contra o mapa antes de substituir (uma correção que
                            descreve errado o estado de origem é bug, não correção)
    newRange              -- faixa CID nova, na mesma forma de valor que o mapa usa
    reason                -- motivo escrito, >= 20 caracteres (disciplina D-14 imposta por código)
    reconciliationPair    -- o par de reconciliação (SC-7) que motivou esta correção

O arquivo nasce vazio (`[]`) nesta plan — quem o preenche é a depuração do 09-08, entrada por
entrada, com o par de reconciliação que motivou cada uma.
"""

from __future__ import annotations

import json

from sih_pipeline.paths import repo_root

_REASON_MIN_LEN = 20

CORRECTIONS_PATH = repo_root() / "scripts" / "catalog" / "cid-corrections.json"

_REQUIRED_KEYS = ("tabnetCode", "oldRange", "newRange", "reason", "reconciliationPair")


def load_corrections() -> list[dict]:
    """Lê `CORRECTIONS_PATH` com `json.load` direto, sem transformação de schema — exatamente
    como `validate.mjs` lê `extra-diseases.json`.

    Rejeita (`ValueError`) qualquer entrada sem `reason`, ou com `reason` mais curto que
    `_REASON_MIN_LEN` caracteres — a disciplina "dado com motivo escrito" da Fase 8 D-14 imposta
    por código, não só por convenção documentada.
    """
    with CORRECTIONS_PATH.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)

    for entry in entries:
        faltando = [key for key in _REQUIRED_KEYS if key not in entry]
        if faltando:
            raise ValueError(
                f"cid-corrections.json: entrada sem campo(s) obrigatório(s) {faltando}: {entry!r}"
            )
        reason = entry["reason"]
        if not isinstance(reason, str) or len(reason) < _REASON_MIN_LEN:
            raise ValueError(
                "cid-corrections.json: 'reason' precisa ter pelo menos "
                f"{_REASON_MIN_LEN} caracteres (dado com motivo escrito, D-14): {entry!r}"
            )

    return entries


def apply_corrections(cid_map: dict[str, str], corrections: list[dict]) -> dict[str, str]:
    """Aplica `corrections` sobre uma CÓPIA de `cid_map`, nunca sobre o dicionário original.

    Para cada correção, valida que `oldRange` bate exatamente com o valor atual do mapa para
    aquele `tabnetCode` antes de substituir por `newRange` — uma correção que descreve errado o
    estado de origem é bug, e falhar alto aqui é o que impede a camada de correção de virar uma
    allowlist que ninguém confere. Levanta `ValueError` se não bater.

    Lista vazia devolve o mapa inalterado, byte a byte (uma cópia nova, mas com o mesmo
    conteúdo) — nunca o mesmo objeto de `cid_map`, para que o chamador não corra o risco de
    mutar a entrada por engano.
    """
    resultado = dict(cid_map)

    for correcao in corrections:
        tabnet_code = correcao["tabnetCode"]
        old_range = correcao["oldRange"]
        new_range = correcao["newRange"]

        valor_atual = resultado.get(tabnet_code)
        if valor_atual != old_range:
            raise ValueError(
                f"apply_corrections: oldRange não bate com o mapa atual para "
                f"tabnetCode={tabnet_code!r} (esperado {old_range!r}, mapa tem {valor_atual!r})"
            )

        resultado[tabnet_code] = new_range

    return resultado
