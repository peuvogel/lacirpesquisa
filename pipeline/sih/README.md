# sih-pipeline

Pipeline Python de coleta confiável do SIH-RD (DataSUS) — ledger por agravo × medida × grão,
retry com backoff, falha ruidosa (nunca `OK · 0 linhas`), retomada idempotente. Ver
`.planning/phases/09-pipeline-confi-vel-coleta-completa/` para o plano completo da fase.

## Por que `pysus==1.0.1` e não a 2.x

O pin é **intencional**, não um esquecimento de atualização — `2.7.0` é a versão `latest` no
PyPI e é **inutilizável** para este pipeline.

`pysus>=2.0` reescreveu o índice de arquivos e introduziu um defeito bloqueante: para cada
combinação (estado, ano, mês), `list_files("SIH", state, year)` devolve **exatamente um
arquivo**, com o grupo escolhido arbitrariamente pela própria biblioteca — a coluna `group`
sempre volta `None`. Pedir `group="RD"` (Reduzida, o grupo que este pipeline precisa) devolve
lista **vazia** em todos os clients testados (`ftp`, `ducklake`, default), e `RDAC1901.parquet`
não é alcançável por caminho nenhum.

O defeito não é cosmético: reproduzido em AC, SP, MG (2019) e RR (2022), o índice devolve
arquivos do grupo `RJ` (AIH **rejeitada**, não internação aprovada) e `SP` (uma linha por
**procedimento**, não por internação) sob os meses onde `RD` deveria estar. Um pipeline que
confiasse nesse índice agregaria AIH rejeitada e procedimentos individuais como se fossem
internações — produzindo um número plausível e **errado**, exatamente o modo de falha que a
Fase 9 existe para matar.

A `1.0.1` (fevereiro/2026, a última release antes da reescrita de maio/2026) lista os 6 grupos
corretamente (`RD`, `RJ`, `ER`, `SP`, `CH`, `CM`) e foi exercitada ao vivo contra o FTP real do
DataSUS nesta fase: `AC/2019` completo devolveu 12 arquivos `RDAC1901..RDAC1912`, decodificados
até parquet (44.589 registros × 113 colunas). Medição e reprodução completas em
`.planning/notes/2026-08-04-pysus-microdado-spike.md` §1 e §2.

Regra explícita: **não atualizar `pysus` sem reproduzir o teste do spike §1** (listar `SIH`
para um par estado/ano conhecido e conferir que `group="RD"` devolve os 12 meses esperados, não
uma lista vazia). Se uma versão futura corrigir o defeito, o pin sobe deliberadamente — nunca
por `>=`/`~=` silencioso.

## Comandos

```bash
uv sync                                    # instala dependências (Python 3.11, ver .python-version)
uv run pytest                              # roda a suíte de testes
uv run python -m sih_pipeline.<módulo>     # roda um módulo do pipeline diretamente
```

Da raiz do repositório, os comandos equivalentes estão em `package.json` sob o prefixo
`pipeline:*` (ex.: `npm run pipeline:test`).

## Variáveis de ambiente

Lidas de `.env.pipeline` na raiz do repositório (fora do git — ver `.gitignore`, D-17),
**nunca** hardcoded e nunca com prefixo `VITE_` (isso vazaria para o bundle do app):

| Variável | Uso |
|---|---|
| `SIH_PIPELINE_CACHE_DIR` | Raiz do cache local de parquet/ledger/relatórios (default `~/.lacir/sih-cache` se ausente) |
| `SIH_PIPELINE_DB_URL` | Conexão Postgres (Session Pooler do Supabase) para o `COPY` + swap transacional (D-17) |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial de escrita para upload de partições no Storage — só no pipeline offline, nunca no app |
| `SUPABASE_URL` | URL do projeto Supabase, para o cliente HTTP de upload de partições |
