---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 01
subsystem: infra
tags: [gitignore, credenciais, supabase, session-pooler, taxonomia, d-23, d-17]

# Dependency graph
requires:
  - phase: 08-taxonomia-can-nica-integridade
    provides: "scripts/catalog/diseases.json — os 331 ids canônicos que a ordem de coleta referencia; e o formato 'dado com motivo escrito' de extra-diseases.json"
provides:
  - ".gitignore cobrindo .env.pipeline e os artefatos locais do pipeline Python, antes de eles existirem"
  - ".env.pipeline na máquina do operador com a credencial Session Pooler do D-17, comprovadamente invisível ao git e ao bundle"
  - "scripts/catalog/collection-order.json — ordem de relevância cirúrgica em 7 níveis com razão escrita por grupo, sem nenhuma exclusão (D-23)"
  - "Critério de fase pronta declarado por escrito: a Fase 9 fecha com a coleta completa carregada e servida, não com o pipeline provado num recorte"
affects: [09-04, 09-09, 09-10, 09-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Credencial ignorada pelo git ANTES de o arquivo existir — a exclusão precede a criação, então nunca há janela em que o segredo é rastreável"
    - "Ordem como dado versionado com razão em texto corrido por grupo, no formato de extra-diseases.json"

key-files:
  created:
    - scripts/catalog/collection-order.json
  modified:
    - .gitignore

key-decisions:
  - "Session Pooler (aws-1-us-west-2.pooler.supabase.com:5432) e não Direct connection — a Direct é IPv6-only no plano gratuito e o Transaction pooler (6543) quebra o protocolo COPY que o 09-10 depende (RESEARCH Pitfall 12)"
  - "pipeline/sih/reports/*.log é ignorado, mas pipeline/sih/reports/ NÃO — os relatórios .md são a razão escrita que o D-02 exige e o registro de descarte do D-04"
  - "D-23 resolvido como 'proposta-do-agente' por delegação explícita do operador, não como julgamento clínico dele — registrado como tal no commit para não ser lido no futuro como decisão clínica validada"
  - "Nível 1 são os sete packs vasculares já servidos hoje, não uma lista clínica abstrata: subi-los primeiro fecha a janela em que o app entrega o corpus TabNet que a própria fase declarou não confiável"

patterns-established:
  - "Pré-requisitos humanos front-loaded: a credencial que só o 09-10 usa é exigida e provada na Onda 1, para o bloqueio não aparecer na Onda 6"
  - "Ordem nunca é corte: toda lista de prioridade termina com uma entrada 'restante do catálogo' de diseaseIds vazio cuja razão afirma explicitamente a não-exclusão"

requirements-completed: [PIPE-04, DATA-01, DATA-02]

# Metrics
duration: ~50min (inclui espera por ação humana e uma interrupção de infraestrutura)
completed: 2026-08-05
---

# Phase 09 Plan 01: Pré-requisitos humanos (D-17 / D-23) Summary

**Credencial Postgres do Session Pooler fora do git e fora do bundle, e ordem de relevância cirúrgica em 7 níveis registrada como dado versionado com razão escrita — sem excluir nenhum dos 331 agravos**

## Performance

- **Duração:** ~50 min de relógio (o trabalho de agente foi bem menor; o resto foi espera por ação humana e uma indisponibilidade da API)
- **Tasks:** 2/2
- **Arquivos modificados:** 2

## Accomplishments

- `.gitignore` ganhou o bloco "Fase 9 — pipeline SIH (D-17/D-12)" **antes** de o arquivo de credencial existir, com comentário dizendo por que cada entrada existe e quais são os três nomes de variável esperados
- `.env.pipeline` criado na máquina do operador com a string do **Session Pooler** (porta 5432), a `service_role` key e a `SUPABASE_URL` — nenhuma com prefixo `VITE_`
- `scripts/catalog/collection-order.json` registra 7 níveis cobrindo 27 agravos explicitamente e 304 no "restante", com razão em texto corrido por grupo
- Critério de fase pronta declarado por escrito no próprio plano, e é a referência para `/gsd:verify-work`

## Task Commits

1. **Task 1: Credencial Postgres do D-17 (Session Pooler) fora do git e fora do bundle** — `1817b1b` (chore)
2. **Task 2: Ordem de relevância cirúrgica para coleta e upload (D-23)** — `6ffc1d7` (feat)

**Metadados de progresso parcial:** `3cb8000` (docs)

## Files Created/Modified

- `.gitignore` — ignora `.env.pipeline`, `pipeline/sih/.venv/`, `pipeline/sih/cache/`, `pipeline/sih/reports/*.log`, `pipeline/sih/.pytest_cache/`, `pipeline/sih/**/__pycache__/`
- `scripts/catalog/collection-order.json` — 7 níveis de ordem de coleta/upload com `nivel`, `label`, `diseaseIds` e `reason`

## Verificação executada

| Asserção | Resultado |
|---|---|
| `git check-ignore -q .env.pipeline` | sai 0 — ignorado |
| `git ls-files .env.pipeline` | vazio — nunca rastreado |
| `.env.pipeline` aparece em `git status --short` | não aparece (prova ao vivo durante o commit da Task 2) |
| `grep -c 'VITE_' .env.pipeline` | 0 — nada vaza para o bundle |
| `SIH_PIPELINE_DB_URL` casa `pooler\.supabase\.com:5432` | sim |
| `grep -rl 'SIH_PIPELINE_DB_URL' src/` | vazio |
| `pipeline/sih/reports/` ignorado por inteiro | não (só os `.log`) — correto |
| Validador `node -e` do `collection-order.json` | `collection-order OK: 7 niveis` |
| Entradas com `diseaseIds` vazio | exatamente 1 (nível 99) |
| `reason` final afirma não-exclusão | sim (`excluído` / `exclusão`) |
| ids duplicados entre níveis | 0 |
| Cobertura | 27 explícitos + 304 no restante = 331 |
| `npm run gate` | verde (774 Vitest + 9 pytest + build) |

## Decisions Made

- **Session Pooler, não Direct.** O operador forneceu a string de conexão **Direct** (`db.hmfbxqemububjyhdckrj.supabase.co:5432`), que o RESEARCH §Pitfall 12 descarta: é IPv6-only no plano gratuito. O host correto do Session Pooler foi lido de `supabase/.temp/pooler-url` (`aws-1-us-west-2.pooler.supabase.com`) e a senha embutida nele. A string Direct teria falhado o critério de aceitação do próprio plano.
- **D-23 por delegação, e rotulado como tal.** O plano é explícito em que relevância cirúrgica é julgamento clínico do usuário e compara aceitar o palpite do agente ao `KNOWN_BY_CODE` que a Fase 8 rejeitou. O operador delegou explicitamente ("faz do jeito que vc achar melhor"). A opção registrada é, portanto, `proposta-do-agente`, e o commit diz isso com todas as letras para que ninguém leia o arquivo no futuro como julgamento clínico validado. Como o D-23 garante não-exclusão, o custo de um nível mal ordenado é atraso de chegada, não perda de dado — e o arquivo é reescrevível até o `09-10` consumi-lo.
- **Nível 1 ancorado em evidência, não em opinião.** Em vez de uma lista clínica abstrata, o nível 1 é exatamente o conjunto dos sete packs vasculares que `public/data/catalog/packs/` já serve. Isso dá ao nível uma razão verificável (fechar a janela de dado não confiável) em vez de uma preferência.
- **Nível 2 existe por causa do D-16, não por relevância.** Os três packs vivos não-vasculares (laringite, otite, olho) sobem logo em seguida porque o D-16 proíbe convivência entre dado TabNet e microdado — sem eles, o app ficaria com 7 agravos em microdado e 3 em TabNet.

## Deviations from Plan

### 1. `.env.pipeline` recebeu 3 variáveis, não 4

- **Encontrado em:** Task 1, ao cruzar com o Task 3 do `09-03`
- **Problema:** O `09-03` Task 3 manda exportar `SUPABASE_ACCESS_TOKEN` "a partir de `.env.pipeline`", mas o `09-01` nunca especificou essa variável — e não havia token em `~/.supabase/access-token` nem no ambiente. Como escrito, o `09-01` não teria destravado o `09-03`.
- **Correção:** Em vez de exigir um Personal Access Token do operador, o `09-03` passou a aplicar a migração via `supabase db push --db-url "$SIH_PIPELINE_DB_URL"`, que alcança o mesmo banco de produção sem sessão de CLI. A quarta variável saiu do caminho crítico.
- **Verificação:** `supabase db push --db-url` aplicou a migração e o verify passou (ver `09-03-SUMMARY.md`).

### 2. Task 1 executada em duas mãos

- **Problema:** A parte automatizada (`.gitignore`) foi executada por agente; a criação do `.env.pipeline` é ação humana por construção; e a validação ao vivo das asserções `git` foi adiada porque a API da Anthropic ficou indisponível no meio (classificador de segurança fora, bloqueando `Bash` e `Agent`).
- **Correção:** As asserções foram executadas assim que a ferramenta voltou, antes de qualquer commit da Task 2. A prova mais forte veio de graça: no `git status --short` que precedeu o commit `6ffc1d7`, o único arquivo listado foi `scripts/catalog/collection-order.json` — `.env.pipeline` já existia no disco e não apareceu.

---

**Total de desvios:** 2 (1 lacuna de encadeamento entre planos, 1 de infraestrutura)
**Impacto no plano:** Nenhum escopo novo. O desvio 1 removeu um pré-requisito humano em vez de acrescentar um.

## Issues Encountered

- **Indisponibilidade da API da Anthropic** (`529 Overloaded`, depois classificador de segurança fora por vários minutos) interrompeu a execução duas vezes e forçou o Task 3 do `09-03` a ser rodado manualmente pelo operador. Nenhum estado foi perdido: a primeira interrupção (limite de uso) não deixou commit nem arquivo, e a árvore ficou limpa nas duas.
- **`psql` ausente na máquina** impediu o verify do `09-03` na primeira tentativa. Resolvido com `brew install libpq`. Vale lembrar que o `psql` será necessário de novo no `09-10` (`sih-swap-contagens.sql`) e no `09-14` (`sih-retire.sql`) — o `export PATH="$(brew --prefix libpq)/bin:$PATH"` precisa estar no `~/.zshrc` ou ser repetido.

## User Setup Required

**Concluído.** O operador criou `.env.pipeline` na raiz do repositório com `SIH_PIPELINE_DB_URL` (Session Pooler), `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL`.

⚠️ **Rotação recomendada:** a senha do banco e a `service_role` key trafegaram por uma transcrição de conversa. A `service_role` ignora RLS por completo. Rotacionar as duas ao fim da Fase 9 é a higiene devida.

## Next Phase Readiness

- **Destravado:** o `09-04` pode iniciar a corrida longa de download (~10 GB, dias), e o `09-03` teve sua Task 3 concluída com a mesma credencial.
- **Consumidores da ordem:** `09-09` (geração de partições) e `09-10` (upload) leem `collection-order.json`. O `09-12` audita a cobertura contra ele.
- **Ponto de atenção:** a decisão D-23 está registrada como proposta do agente. Se o julgamento clínico do operador divergir, o arquivo deve ser corrigido **antes** do `09-10` — depois do upload, mudar a ordem não desfaz o que já subiu.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-05*
