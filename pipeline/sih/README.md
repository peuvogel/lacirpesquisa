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

## Operação da corrida completa (D-01)

A coleta é por arquivo (`RD{UF}{AA}{MM}`, 4.212 arquivos, janela 2013-2025, ~10 GB total) —
`enumerate.py` computa a lista esperada e falha ruidosamente se o FTP não tiver algum (SC-1);
`download.py` baixa um arquivo por vez, isola qualquer exceção no próprio arquivo (nunca aborta
o resto da corrida, PIPE-06) e grava prova (hash + contagem de linhas) no ledger local
(`ledger.py`, `<cache_root>/ledger/files.json` — nunca depende de rede para saber o que já
baixou, D-12 Camada 1).

**Iniciar (ou continuar) a corrida**, desanexada do terminal, com log em
`pipeline/sih/reports/download.log`:

```bash
cd pipeline/sih
mkdir -p reports
nohup uv run python -m sih_pipeline.cli download > reports/download.log 2>&1 &
disown
```

(`reports/download.log` é o mesmo caminho que `reports_path("download.log")` resolve — só os
`.log` são ignorados pelo git dentro de `pipeline/sih/reports/`, não o diretório inteiro.)

**Conferir o progresso** (não precisa parar a corrida):

```bash
cd pipeline/sih && uv run python -m sih_pipeline.cli download --status
# ou, equivalente, ler o summary() do ledger diretamente:
uv run python -c "from sih_pipeline.ledger import FileLedger; print(FileLedger.load().summary())"
```

**Retomar depois de uma interrupção** (crash, reboot, `kill`): rodar o mesmo comando de novo.
A retomada é por arquivo inteiro, nunca por byte — `File.download()` não guarda progresso
parcial de um arquivo (RESEARCH Pitfall 8), então o `.dbc` de um arquivo interrompido é
re-baixado do zero, mas nenhum arquivo já `baixado` no ledger é refeito ou duplicado (PIPE-03,
provado por `test_resume_no_duplicate`).

**Estimativa de volume:** ~10 GB, 4.212 arquivos, janela 2013-2025 — ver `du -sh` sobre
`cache_path("parquet")` para o tamanho real acumulado a qualquer momento.

**Pré-requisito de espaço em disco:** confirme espaço livre suficiente (~12-15 GB de folga)
ANTES de iniciar a corrida completa — `download_all()` isola falha por arquivo (PIPE-06), mas
isso cobre erros de rede/parse por arquivo, não o disco do sistema operacional ficando sem
espaço livre. Rodar a corrida completa com pouco espaço livre pode levar o disco a zero e
comprometer o resto do sistema do operador, não só a coleta — verificar com `df -h` antes de
lançar em produção.

**Status em 2026-08-05 (09-04):** a corrida completa NÃO foi iniciada nesta execução — o
disco do operador media ~1,5 GB livres num único volume interno de 228 GB (`df -h /`, sem
volume externo montado), muito abaixo da folga de ~12-15 GB necessária para os ~10 GB da
corrida. Ver `09-04-SUMMARY.md` para a medição completa. O mecanismo foi provado com um
recorte seguro (`download --limit 2`, ~570 KB, dois arquivos do Acre) antes de decidir não
lançar a corrida cheia.

## Variáveis de ambiente

Lidas de `.env.pipeline` na raiz do repositório (fora do git — ver `.gitignore`, D-17),
**nunca** hardcoded e nunca com prefixo `VITE_` (isso vazaria para o bundle do app):

| Variável | Uso |
|---|---|
| `SIH_PIPELINE_CACHE_DIR` | Raiz do cache local de parquet/ledger/relatórios (default `~/.lacir/sih-cache` se ausente) |
| `SIH_PIPELINE_DB_URL` | Conexão Postgres (Session Pooler do Supabase) para o `COPY` + swap transacional (D-17) |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial de escrita para upload de partições no Storage — só no pipeline offline, nunca no app |
| `SUPABASE_URL` | URL do projeto Supabase, para o cliente HTTP de upload de partições |
