"""Camada 1 do ledger (D-12) — JSON local, ao lado do parquet, nunca no Supabase.

Entrega retomada idempotente (PIPE-03) e a prova por arquivo — status, `row_count`, `sha256` —
que PIPE-05 exige. Nunca depende de rede para saber o que já foi baixado: uma corrida de dias
sem supervisão sobrevive a um `kill` porque toda escrita passa por `.tmp` + `os.replace`
atômico (mesmo diretório, mesmo filesystem).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from sih_pipeline.paths import ledger_path

STATUS_BAIXADO = "baixado"
STATUS_FALHOU = "falhou"
STATUS_NUNCA_TENTADO = "nunca_tentado"

_SCHEMA_VERSION = 1


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class FileLedger:
    """Ledger de arquivo — mapa `nome -> entrada` persistido em `ledger_path()`."""

    def __init__(self, arquivos: dict[str, dict[str, Any]] | None = None) -> None:
        self._arquivos: dict[str, dict[str, Any]] = arquivos if arquivos is not None else {}

    @classmethod
    def load(cls) -> "FileLedger":
        """Carrega o ledger de `ledger_path()`; devolve um ledger vazio se o arquivo não existir."""
        path = ledger_path()
        if not path.exists():
            return cls()

        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)

        return cls(arquivos=data.get("arquivos", {}))

    def save(self) -> None:
        """Escreve o ledger em `ledger_path()` — grava em `.tmp` e faz `os.replace` atômico.

        Um `kill` no meio desta escrita nunca deixa o ledger truncado: ou o `.tmp` fica pela
        metade e o arquivo real (`files.json`) continua com o conteúdo anterior íntegro, ou o
        `.tmp` termina de ser escrito e o `os.replace` troca os dois num passo só.
        """
        path = ledger_path()
        payload = {"schema_version": _SCHEMA_VERSION, "arquivos": self._arquivos}

        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with tmp_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2, sort_keys=True)

        os.replace(tmp_path, path)

    def status(self, name: str) -> str:
        """Status de `name` — `STATUS_NUNCA_TENTADO` para chave ausente."""
        entry = self._arquivos.get(name)
        if entry is None:
            return STATUS_NUNCA_TENTADO
        return entry["status"]

    def entry(self, name: str) -> dict[str, Any]:
        """Entrada bruta de `name` (cópia) — levanta `KeyError` se a chave não existir."""
        return dict(self._arquivos[name])

    def mark_collected(
        self, name: str, *, row_count: int, sha256: str, parquet_dir: str
    ) -> None:
        """Marca `name` como `baixado`, com a prova (contagem + hash) que PIPE-05 exige.

        Promove uma entrada `falhou` para `baixado` e remove o campo `reason` — uma
        reexecução bem-sucedida apaga o rastro de uma falha transitória anterior.
        """
        self._arquivos[name] = {
            "status": STATUS_BAIXADO,
            "row_count": row_count,
            "sha256": sha256,
            "parquet_dir": parquet_dir,
            "updated_at": _now_iso(),
        }

    def mark_failed(self, name: str, *, reason: str) -> None:
        """Marca `name` como `falhou`, com o motivo.

        PIPE-03: uma reexecução que reencontre um erro transitório num arquivo já `baixado`
        NUNCA pode marcá-lo `falhou` — senão a retomada seguinte rebaixaria e re-baixaria
        conteúdo já íntegro. Este `if` é a regra de não-rebaixamento.
        """
        if self._arquivos.get(name, {}).get("status") == STATUS_BAIXADO:
            return

        self._arquivos[name] = {
            "status": STATUS_FALHOU,
            "reason": reason,
            "updated_at": _now_iso(),
        }

    def reset_missing(self, name: str, *, reason: str) -> None:
        """Reseta `name` para fora de `baixado` MESMO que a entrada atual esteja `baixado` --
        único caminho do `FileLedger` que ignora de propósito a disciplina de não-rebaixamento
        de `mark_failed` (PIPE-03).

        Existe para um único chamador: a self-cura de `collect.py` (09-04-AUTOCURA-LEDGER),
        quando o chamador já CONFIRMOU contra o disco real que o parquet de `name` não existe
        mais -- não é uma falha espúria de rerun (que `mark_failed` corretamente recusa
        rebaixar), é uma divergência ledger/disco provada. Sem isto, um arquivo `baixado` cujo
        parquet sumiu (reciclagem interrompida no meio, delação externa, etc.) fica preso para
        sempre: nunca re-baixa (`pending()` só devolve o que não é `baixado`) e nunca agrega
        (o parquet não existe). Reaproveita `STATUS_FALHOU` como status final -- semanticamente
        a verificação falhou -- para que `pending()` o devolva sem precisar de um status novo.
        """
        self._arquivos[name] = {
            "status": STATUS_FALHOU,
            "reason": reason,
            "updated_at": _now_iso(),
        }

    def pending(self, expected: set[str] | frozenset[str]) -> list[str]:
        """Nomes de `expected` cujo status não é `baixado`, em ordem determinística (sorted).

        Não contém duplicata mesmo depois de múltiplos `mark_failed` na mesma chave — o ledger
        é um mapa por chave, não um log de eventos.
        """
        return sorted(name for name in expected if self.status(name) != STATUS_BAIXADO)

    def summary(self) -> dict[str, int]:
        """`{"baixado": n, "falhou": n, "nunca_tentado": n, "total_registros": n}`.

        `nunca_tentado` conta só o que está registrado como tal no ledger — arquivos nunca
        tocados (fora do mapa) não entram nesta contagem; quem sabe o total esperado é
        `enumerate.expected_file_names()`, não o ledger.
        """
        counts = {STATUS_BAIXADO: 0, STATUS_FALHOU: 0, STATUS_NUNCA_TENTADO: 0}
        total_registros = 0
        for entry in self._arquivos.values():
            status = entry["status"]
            counts[status] = counts.get(status, 0) + 1
            if status == STATUS_BAIXADO:
                total_registros += entry.get("row_count", 0)

        return {
            "baixado": counts[STATUS_BAIXADO],
            "falhou": counts[STATUS_FALHOU],
            "nunca_tentado": counts[STATUS_NUNCA_TENTADO],
            "total_registros": total_registros,
        }
