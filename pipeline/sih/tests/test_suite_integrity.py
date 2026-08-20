"""Gate de integridade da própria suíte (09-14 Task 3).

Fecha em definitivo duas promessas que a Onda 0 do `09-02` deixou em aberto:

1. **Anti-esqueleto.** O `09-02` criou arquivos de teste vazios com
   `pytest.skip(..., allow_module_level=True)` para reservar o nome do módulo antes de o dono
   existir. Um esqueleto que sobrevive à fase é pior que um teste ausente: ele conta como arquivo
   de teste, aparece verde na suíte e não afirma nada. Os dois casos abaixo pegam as DUAS formas
   de esqueleto -- o que ainda declara o skip, e o que já perdeu o skip mas ficou sem teste
   nenhum dentro.

2. **Contrato da CLI.** Todo script `pipeline:*` do `package.json` que invoca `sih_pipeline.cli`
   precisa nomear um subcomando REGISTRADO, e todo subcomando registrado precisa resolver para um
   `main` chamável. Contrato declarado com implementação ausente é exatamente a forma de defeito
   que este milestone existe para matar -- ela não pode sobreviver no `package.json` do próprio
   pipeline novo.
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

import pytest

from sih_pipeline.cli import SUBCOMANDOS, resolver
from sih_pipeline.paths import repo_root

TESTS_DIR = Path(__file__).resolve().parent
ESTE_ARQUIVO = Path(__file__).resolve().name


def _modulos_de_teste() -> list[Path]:
    """Todo `test_*.py` da pasta, menos este arquivo (que é o gate, não o alvo)."""
    return sorted(p for p in TESTS_DIR.glob("test_*.py") if p.name != ESTE_ARQUIVO)


# ---------------------------------------------------------------------------
# 1. Anti-esqueleto
# ---------------------------------------------------------------------------


def test_nenhum_esqueleto_com_allow_module_level_sobrevive():
    """Nenhum módulo de teste ainda pula a si mesmo no nível do módulo."""
    culpados = [
        p.name for p in _modulos_de_teste() if "allow_module_level" in p.read_text("utf-8")
    ]
    assert not culpados, (
        "esqueleto(s) da Onda 0 sobreviveram à fase com allow_module_level -- todo arquivo "
        f"criado para reservar nome precisa ter dono e conteúdo até o fim: {culpados}"
    )


def test_nenhum_modulo_de_teste_esta_vazio():
    """Um esqueleto que perdeu o skip mas ficou sem teste passa despercebido pelo caso acima.

    Conta funções/classes de teste por AST (não por importação): um módulo sem nenhuma
    `test_*` nem `Test*` não afirma nada e não pode contar como cobertura.
    """
    vazios = []
    for caminho in _modulos_de_teste():
        arvore = ast.parse(caminho.read_text("utf-8"), filename=str(caminho))
        tem_teste = any(
            (isinstance(no, (ast.FunctionDef, ast.AsyncFunctionDef)) and no.name.startswith("test_"))
            or (isinstance(no, ast.ClassDef) and no.name.startswith("Test"))
            for no in ast.walk(arvore)
        )
        if not tem_teste:
            vazios.append(caminho.name)

    assert not vazios, (
        f"módulo(s) de teste sem nenhum teste coletável -- esvaziados, não removidos: {vazios}"
    )


# ---------------------------------------------------------------------------
# 2. Contrato da CLI
# ---------------------------------------------------------------------------


def _scripts_npm_do_pipeline() -> dict[str, str]:
    """`nome do script npm -> subcomando invocado`, só para os que chamam `sih_pipeline.cli`."""
    package_json = json.loads((repo_root() / "package.json").read_text("utf-8"))
    encontrados: dict[str, str] = {}
    for nome, comando in package_json.get("scripts", {}).items():
        achado = re.search(r"sih_pipeline\.cli\s+([\w-]+)", comando)
        if achado:
            encontrados[nome] = achado.group(1)
    return encontrados


def test_package_json_declara_ao_menos_um_script_de_pipeline():
    """Guarda do próprio gate: se a regex parar de casar, os dois casos abaixo passariam vazios."""
    scripts = _scripts_npm_do_pipeline()
    assert scripts, (
        "nenhum script de package.json invoca sih_pipeline.cli -- ou o pipeline sumiu do "
        "package.json, ou o padrão de invocação mudou e este gate ficou cego"
    )


def test_cli_todo_script_npm_aponta_para_subcomando_registrado():
    """Nenhum `pipeline:*` do package.json nomeia subcomando que o `cli.py` não conhece."""
    orfaos = {
        script: sub
        for script, sub in _scripts_npm_do_pipeline().items()
        if sub not in SUBCOMANDOS
    }
    assert not orfaos, (
        "script(s) npm apontando para subcomando ausente de SUBCOMANDOS -- contrato declarado "
        f"sem implementação: {orfaos}"
    )


@pytest.mark.parametrize("nome", sorted(SUBCOMANDOS))
def test_cli_todo_subcomando_registrado_resolve_para_main_chamavel(nome: str):
    """Nenhum subcomando termina a fase ainda saindo com código 2 por falta de `main`."""
    alvo = resolver(nome)
    assert alvo is not None, (
        f"subcomando {nome!r} está em SUBCOMANDOS mas não resolve para um main -- módulo dono "
        f"({SUBCOMANDOS[nome][0]}, plano {SUBCOMANDOS[nome][1]}) ausente ou sem main"
    )
    assert callable(alvo), f"subcomando {nome!r} resolve para algo não chamável: {type(alvo)!r}"
