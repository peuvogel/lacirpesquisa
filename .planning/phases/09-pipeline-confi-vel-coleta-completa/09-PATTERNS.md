# Phase 9: Pipeline confiável + coleta completa - Mapa de Padrões

**Mapeado:** 2026-08-04
**Arquivos analisados:** 24 (novos + modificados + deletados)
**Analogs encontrados:** 19 exatos/role-match · 5 "disciplina transferida" (Node → Python, sem analog de linguagem)

**Nota de leitura:** esta fase é majoritariamente Python novo (`pipeline/sih/`, gerido por `uv`) sem
analog de mesma linguagem no repositório rastreado — os scrapers em `trabalhos datasus/scripts/`
estão sendo aposentados, não servem como "padrão do projeto" a seguir, só como referência pontual
de parser (D-18). Para os arquivos Python a maior parte das entradas abaixo nomeia **qual disciplina
Node precisa atravessar a fronteira de linguagem**, não um trecho de código Python a copiar.

## File Classification

| Novo/Modificado | Papel | Fluxo de dado | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `pipeline/sih/src/sih_pipeline/enumerate.py` | service (Python) | batch/transform | `scripts/catalog/paths.mjs` (disciplina de guarda) + Pattern 1 do RESEARCH | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/download.py` | service (Python) | batch/file-I/O | Pattern 2 do RESEARCH (código real do `pysus`) | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/ledger.py` | model/store (Python) | CRUD local (JSON/SQLite) | `scripts/catalog/paths.mjs` (guarda de caminho) + D-12 do CONTEXT | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/matcher.py` | service (Python) | transform | `.planning/notes/2026-08-04-pysus-microdado-spike.md` §4 (já implementado, portar) | exato (mesma lógica, fonte já Python) |
| `pipeline/sih/src/sih_pipeline/corrections.py` | model/store (Python, leitura) | transform | `scripts/catalog/extra-diseases.json` / `exclusions.json` (forma "dado com motivo escrito") | role-match (JSON→Python reader) |
| `pipeline/sih/src/sih_pipeline/aggregate.py` | service (Python) | batch/transform | Pattern 3 do RESEARCH (pyarrow, cast explícito) | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/population.py` | service (Python) | batch/file-I/O | Pattern 5 do RESEARCH (`POPSVS` via `Directory` direto) | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/reconcile.py` | service (Python) | transform/pub-sub (compara) | `scripts/catalog/validate.mjs` (disciplina fail-closed A-E) | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/oracle_scrape.py` | service (Python) | request-response | `trabalhos datasus/scripts/coleta_sih_multi_disease.py::post_tabnet/parse_prn_table` | exato (porta direta, D-18) |
| `pipeline/sih/src/sih_pipeline/upload.py` | service (Python) | CRUD/batch (COPY+swap) | `scripts/catalog/uploadSihToSupabase.mjs` (disciplina de upsert em lote + tombstone guard) + Pattern 4 do RESEARCH | disciplina transferida |
| `pipeline/sih/src/sih_pipeline/partitions.py` | service (Python) | file-I/O/transform | `src/features/catalog/loadCatalog.ts` (padrão consumidor — formato espelhado) | disciplina transferida (produtor do que loadCatalog-style consome) |
| `pipeline/sih/tests/test_reconcile_gate.py` | test (Python/pytest) | request-response (fixture) | `src/features/catalog/renameMigration.test.ts` (disciplina "gerado, nunca escrito à mão" + gate) | role-match |
| `pipeline/sih/tests/fixtures/oracle_ac_2019.json` | config/fixture | batch | `scripts/catalog/extra-diseases.json` (forma "segunda fonte", motivo escrito) | role-match |
| `scripts/catalog/generateSihStorageManifest.mjs` (ou equivalente Node de leitura pós-upload) | utility (Node) | CRUD (lê Postgres, regenera 10 packs) | `scripts/catalog/generateDiseaseSeeds.mjs` (build lendo Postgres via PostgREST) | role-match |
| `src/features/catalog/loadMunicipioPartition.ts` (novo, D-20/D-21) | hook/utility (Node/TS) | file-I/O + fetch | `src/features/catalog/loadCatalog.ts` (fetch same-origin + cache em memória) | exato |
| `supabase/migrations/<ts>_sih_local_dimension.sql` | migration | DDL/CRUD | `supabase/migrations/20260804020000_rename_disease_ids.sql` (gerado por script) | exato (mesmo gerador, dado novo) |
| `supabase/migrations/<ts>_sih_collection_status.sql` | migration | DDL | idem | exato |
| `supabase/migrations/<ts>_sih_population.sql` | migration | DDL | idem | exato |
| `scripts/catalog/generateSihMigration.mjs` (ou nome equivalente, D-05/D-13/D-24) | utility (Node, gerador de SQL) | transform | `scripts/catalog/generateRenameMigration.mjs` | exato |
| `src/features/catalog/sihMigration.test.ts` (ou nome equivalente) | test (Node/vitest) | request-response | `src/features/catalog/renameMigration.test.ts` | exato |
| `supabase/verify/sih-local-swap-contagens.sql` (D-16 atomic swap proof) | verify script | CRUD (RAISE EXCEPTION) | `supabase/verify/contagens.sql` | exato |
| `scripts/catalog/cid-corrections.json` (D-05, camada de correção) | config/fixture | batch | `scripts/catalog/extra-diseases.json` + `exclusions.json` (fusão das duas formas) | exato |
| `package.json` (scripts) | config | — | seção `scripts` atual (`pretest`, `test:run`, `gate`) | exato (arquivo modificado, não novo) |
| `.github/workflows/ci.yml` | config | — | arquivo atual (setup-node pinado por SHA) | exato (arquivo modificado, não novo) |
| `docs/SUPABASE-CATALOG.md` | docs/config | — | arquivo atual (schema real capturado ao vivo) | exato (arquivo modificado, não novo) |

**Arquivos a DELETAR (D-18/D-19)** — sem analog a buscar, listados em "No Analog Found" com o
blast radius de referências encontradas.

---

## Pattern Assignments

### `pipeline/sih/src/sih_pipeline/enumerate.py` (service, batch/transform)

**Analog de disciplina:** `scripts/catalog/paths.mjs` (guarda de caminho — ASVS V12) + Pattern 1 do 09-RESEARCH.md (código Python já verificado ao vivo contra o FTP real).

**O que atravessa a fronteira Node→Python:** o princípio de `corpusPath()` — nunca resolver um
caminho de escrita a partir de entrada não confiável, sempre validar contra um allowlist antes de
tocar disco:

```javascript
// scripts/catalog/paths.mjs:29-53 — o guard a reproduzir em Python (V12)
export function corpusPath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error('corpusPath: relativePath required');
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`corpusPath: absolute paths rejected: ${relativePath}`);
  }
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized.includes('..')) {
    throw new Error(`corpusPath: path traversal rejected: ${relativePath}`);
  }
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + path.sep),
  );
  if (!allowed) {
    throw new Error(`corpusPath: path outside allowlist ...: ${relativePath}`);
  }
  ...
}
```
Em `pipeline/sih/`, o equivalente é uma função `cache_path()`/`ledger_path()` que só resolve dentro
de um diretório de cache configurado (variável de ambiente, nunca hardcoded para fora da pasta do
usuário — CONTEXT §"Localização do parquet bruto... fora do controle de versão").

**Núcleo do padrão (fail-closed antes de baixar, SC-1):** código já verificado ao vivo, copiar
literalmente a lógica de comparação de conjuntos (RESEARCH Pattern 1, linhas 273-305):
```python
expected = {
    f"RD{uf}{year % 100:02d}{month:02d}"
    for uf in UFS for year in YEARS for month in range(1, 13)
}
actual_files = s.get_files("RD", uf=UFS, year=list(YEARS))
actual = {f.name for f in actual_files}
missing = expected - actual
if missing:
    raise SystemExit(f"FALHA: {len(missing)} arquivo(s) SIH-RD ausentes no FTP: {sorted(missing)[:10]}...")
```
**Disciplina "dado com motivo escrito" não se aplica aqui** — é o único arquivo desta lista que é
puro cálculo determinístico, sem allowlist de exceção.

---

### `pipeline/sih/src/sih_pipeline/download.py` (service, batch/file-I/O)

**Analog de disciplina:** `scripts/catalog/uploadSihToSupabase.mjs` linhas 71-120 (loop por item,
nunca em lote silencioso) + RESEARCH Pattern 2/Pitfall 9 (comportamento real do `pysus`).

**Núcleo do padrão (isolamento de falha por arquivo, PIPE-06):**
```python
# RESEARCH Pattern 2, linhas 314-325 — reproduzir literalmente
for file in files_to_download:
    try:
        data = file.download(local_dir=str(cache_dir))
        row_count = count_parquet_rows(data.path)
        ledger.mark_collected(file.name, row_count=row_count, sha256=hash_dbc_bytes)
    except Exception as exc:
        ledger.mark_failed(file.name, reason=str(exc))
        continue
```
A analogia Node é `uploadSihToSupabase.mjs`'s `dirs.forEach`/`for (const diseaseId of dirs)` — cada
iteração roda de forma independente e o script já grava progresso por unidade; a diferença é que o
Node aqui não tinha `try/catch` por item (upload é idempotente por natureza do upsert), enquanto o
pipeline Python **precisa** desse `try/except` explícito porque é isso que entrega PIPE-06.

**Erro a NÃO copiar do Node:** `uploadSihToSupabase.mjs` não escreve um "ledger" por item — grava só
um log de console (`console.log(...)`). O ledger de arquivo (Camada 1, D-12) é responsabilidade nova
de `ledger.py`, não do Node.

---

### `pipeline/sih/src/sih_pipeline/ledger.py` (model/store, CRUD local)

**Analog de disciplina:** nenhum arquivo Node do repositório mantém um "ledger" JSON local com esta
forma exata — a peça mais próxima é a combinação de `scripts/catalog/paths.mjs` (guarda de
caminho, para nunca escrever fora do diretório de cache) com o schema já travado no CONTEXT D-12/D-13:

- Camada 1 (local, ao lado do parquet): chave `RD{UF}{AA}{MM}`, status
  `baixado`/`falhou`/`nunca-tentado`, hash, contagem de registros.
- Camada 2 (`sih_collection_status`, Supabase): chave `(agravo, medida, grão, local, ano)`.

**Núcleo do padrão a reproduzir (D-14, zero verdadeiro vs. ausente):** o ledger é a única função que
interpreta ausência de linha — nenhuma métrica carrega coluna de status. Isso espelha a decisão já
tomada na Fase 8 sobre não materializar zeros (`metricless-diseases.json` — ver abaixo, mesma forma
de "registro explícito da exceção, nunca heurística embutida no código consumidor").

---

### `pipeline/sih/src/sih_pipeline/matcher.py` (service, transform)

**Analog:** `.planning/notes/2026-08-04-pysus-microdado-spike.md` §4 — já implementado e testado no
spike. **Portar, não reinventar** (mesma linguagem, sem risco de tradução Node→Python).

**Núcleo do padrão** (RESEARCH, `## Code Examples`, já reproduzido):
```python
def match_category(diag_princ: str, cid_map: dict[str, str]) -> str | None:
    """diag_princ: DIAG_PRINC bruto (3 ou 4 caracteres, sem ponto)."""
    diag4 = diag_princ
    diag3 = diag_princ[:3]
    for code, value in cid_map.items():
        for token in value.split(","):
            token = token.strip()
            if "-" in token:
                start, end = [t.strip() for t in token.split("-")]
            else:
                start = end = token
            if "." in start:
                diag4_dotted = f"{diag3}.{diag_princ[3]}" if len(diag_princ) == 4 else None
                if diag4_dotted and start <= diag4_dotted <= end:
                    return code
            else:
                if start <= diag3 <= end:
                    return code
    return None
```
**Fonte de entrada:** `scripts/catalog/lista-morb-cid.json` (CONTEXT D-05 — "não editar", segue sendo
o que a fonte oficial diz). `matcher.py` lê este arquivo **e** `corrections.py` (camada de correção),
nunca funde os dois em código (é exatamente a forma do `KNOWN_BY_CODE` que a Fase 8 rejeitou).

---

### `pipeline/sih/src/sih_pipeline/corrections.py` (leitura, transform)

**Analog exato de forma:** `scripts/catalog/extra-diseases.json` + `scripts/catalog/exclusions.json`
+ `scripts/catalog/metricless-diseases.json` — a família "dado com motivo escrito, nunca allowlist
silenciosa" (Fase 8 D-14, citada em D-05 do 09-CONTEXT como o precedente a imitar).

**Forma a copiar** (`extra-diseases.json`, arquivo inteiro, 10 linhas):
```json
[
  {
    "id": "amputacao_mmii",
    "label": "Amputação / desarticulação de membros inferiores",
    "filterKind": "procedimento",
    "tabnetCode": "3331",
    "def": "sih/cnv/qibr.def",
    "reason": "Procedimento SIH (sih/cnv/qibr.def), fora da Lista Morb CID-10 (sih/cnv/nibr.def) — não tem entrada no select SLista_Morb__CID-10 do snapshot, por isso é legitimamente uma segunda fonte de entrada e não slugify(label) === id por acaso. Allowlist justificada do invariante A (D-10)."
  }
]
```
**A entrada nova (`scripts/catalog/cid-corrections.json`, D-05) precisa da mesma forma**, com os
campos que o CONTEXT já especifica: `código, faixa antiga, faixa nova, razão escrita, par de
reconciliação que a motivou`. Ex. de shape esperado (a preencher pelo checkpoint D-07):
```json
[
  {
    "tabnetCode": "75",
    "oldRange": "B92",
    "newRange": "B92-B92.9",
    "reason": "colide com o código 76 (mesma faixa exata B92) — achado estrutural do 09-RESEARCH §Code Examples",
    "reconciliationPair": "AC/2019, tabnetCode 75 vs 76"
  }
]
```
`corrections.py` (Python) lê este JSON exatamente como `paths.mjs`/`validate.mjs` leem
`extra-diseases.json`/`exclusions.json` — `json.load()` direto, sem transformação de schema.

---

### `pipeline/sih/src/sih_pipeline/aggregate.py` (service, batch/transform)

**Analog de disciplina:** RESEARCH Pattern 3 (pyarrow, cast explícito) — não há analog Node porque
não existe agregação em lote sobre parquet no repositório atual.

**Núcleo do padrão (cast explícito obrigatório, Pitfall 1/2):**
```python
NEEDED_COLUMNS = ["DIAG_PRINC", "MUNIC_MOV", "MUNIC_RES", "MORTE", "VAL_TOT", "DIAS_PERM"]
dataset = ds.dataset(str(parquet_dir), format="parquet")
table = dataset.to_table(columns=NEEDED_COLUMNS)
val_tot = pc.cast(pc.utf8_trim_whitespace(table["VAL_TOT"]), "float64")
dias_perm = pc.cast(pc.utf8_trim_whitespace(table["DIAS_PERM"]), "int64")
morte = table["MORTE"]  # já vem Int64 (0/1)
```
**Nunca** usar `ParquetSet.to_dataframe()`/`parse_dftypes()` — verificado que é enviesado para o
SINAN (Pitfall 2, HIGH confidence, leitura de código-fonte).

**`taxa_mortalidade` (discrição do CONTEXT):** derivar de `MORTE` na agregação, gravar na coluna que
já existe no schema (`sih_metric_uf.taxa_mortalidade`, ver `docs/SUPABASE-CATALOG.md` linha 51) — não
computar na leitura.

---

### `pipeline/sih/src/sih_pipeline/population.py` (service, batch/file-I/O)

**Analog:** RESEARCH Pattern 5 — não usar a classe de conveniência `IBGEDATASUS`, acessar `POPSVS`
via `Directory` direto (Pitfall 3/4/5, HIGH confidence).
```python
from pysus.ftp import Directory
popsvs_dir = Directory("/dissemin/publicos/IBGE/POPSVS")
files = {f.name: f for f in popsvs_dir.content}  # POPSBR00 .. POPSBR25
for year in range(2013, 2026):
    f = files[f"POPSBR{year % 100:02d}"]
    data = f.download(local_dir=str(cache_dir))
```
**Normalização de `SEXO` obrigatória** (Pitfall 7): SIH usa `{1,3}`, POPSVS usa `{1,2}` — canonizar
para `'M'`/`'F'` num único lugar documentado, nunca fazer join direto por valor bruto.

---

### `pipeline/sih/src/sih_pipeline/reconcile.py` + `pipeline/sih/tests/test_reconcile_gate.py` (test/service)

**Analog de disciplina (fail-closed encadeado):** `scripts/catalog/validate.mjs` linhas 627-688 —
acumula todos os erros de todos os invariantes antes de decidir, nunca para no primeiro erro, e sai
com código não-zero:
```javascript
// scripts/catalog/validate.mjs:637-641
function foldInvariant(result, label, errors) {
  if (errors.length === 0) return;
  result.errors.push(...errors.map((msg) => `${label}: ${msg}`));
  result.ok = false;
}
```
```javascript
// scripts/catalog/validate.mjs:669-679 — saída fail-closed
if (!result.ok) {
  console.error('catalog:validate FAILED — fail-closed (D-05/D-06)');
  for (const err of preview) console.error(`  - ${err}`);
  process.exit(1);
}
```
O gate de reconciliação (D-06) precisa da mesma forma: comparar amostra agregada contra
`tests/fixtures/oracle_ac_2019.json`, exato **ou** com razão escrita (D-02) — nunca banda de
tolerância — e sair não-zero se algo divergir sem razão registrada.

**Analog de forma de teste (regeneração byte-a-byte, "gerado nunca escrito à mão"):**
`src/features/catalog/renameMigration.test.ts` linhas 53-57:
```typescript
describe('rename migration generation (D-01, D-03, D-04, D-05, D-25 — TAX-03, TAX-04)', () => {
  it('regenera o up em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderUpMigration(data)).toBe(committedText(UP_PATH));
  });
```
`test_reconcile_gate.py` não regenera SQL, mas o princípio de "comparar saída determinística contra
fixture congelada, byte-a-byte ou campo-a-campo" é o mesmo — a fixture `oracle_ac_2019.json` faz o
papel de `UP_PATH`.

**Ponte Node→Python (a entrada no `gate`):** `package.json` atual encadeia assim (ver seção
"Shared Patterns" abaixo) — o novo passo `uv run pytest` entra no mesmo lugar que `catalog:validate`
ocupa hoje.

---

### `pipeline/sih/src/sih_pipeline/oracle_scrape.py` (service, request-response)

**Analog exato:** `trabalhos datasus/scripts/coleta_sih_multi_disease.py` linhas 65-83 — **portar
diretamente**, é a instrução explícita do D-18 e do RESEARCH (`## Don't Hand-Roll`, linha 407: "Já
provados contra a resposta real do TabNet; D-18 pede uma ferramenta mínima, não uma reescrita").

```python
# trabalhos datasus/scripts/coleta_sih_multi_disease.py:65-83
REQUEST_DELAY_SEC = 1.5

def post_tabnet(url: str, data: list[tuple[str, str]], timeout: int = 180) -> str:
    if REQUEST_DELAY_SEC > 0:
        time.sleep(REQUEST_DELAY_SEC)
    body = urllib.parse.urlencode(data, doseq=True, encoding="latin-1").encode("latin-1")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("latin-1", errors="replace")


def parse_prn_table(text: str) -> list[list[str]]:
    match = re.search(r"<PRE>(.*?)</PRE>", text, re.S | re.I)
    if not match:
        raise RuntimeError("Resposta do TabNet sem bloco PRE.")
    raw = html.unescape(match.group(1)).strip()
    return list(csv.reader(StringIO(raw), delimiter=";"))
```
**O que NÃO portar** (D-18 explícito — "sem upload, sem cache, sem `--skip-done`, sem segredo"): o
resto do arquivo de 548 linhas — `disease_done()` (cache de retomada), `cleanup_raw()`,
`scrape_one()`'s orquestração de disease×measure em lote, e qualquer coisa relacionada a
`OUT_ROOT`/CSV de saída em massa. `oracle_scrape.py` é uma ferramenta pontual (N valores, não 331
agravos × 4 medidas).

**Throttling a manter:** `REQUEST_DELAY_SEC = 1.5` — RESEARCH Security Domain menciona
"throttling gentil já herdado do scraper aposentado" como mitigação de DoS contra o próprio TabNet.

---

### `pipeline/sih/src/sih_pipeline/upload.py` (service, CRUD/batch)

**Analog de disciplina (tombstone guard antes de qualquer escrita):**
`scripts/catalog/uploadSihToSupabase.mjs` linhas 39-44:
```javascript
/** Refuse to upsert any row whose disease_id is a tombstone (D-06). */
function assertNoTombstoneRows(rows, contexto) {
  for (const row of rows) {
    assertNotTombstone(row.disease_id, contexto);
  }
}
```
O uploader Node fazia isso porque o CR-04 do `08-REVIEW.md` documentou o defeito de não ter essa
guarda — **este uploader está sendo deletado exatamente porque falhava nisso** (D-19). `upload.py`
precisa da mesma verificação antes do `COPY`, contra a taxonomia canônica atual (`sih_disease` via
`corrections.py`/`matcher.py`), nunca contra um id que a fase aposentou.

**Núcleo do padrão de conexão (Session Pooler, D-17):** RESEARCH Pattern 4, código real:
```python
import psycopg
conn = psycopg.connect(os.environ["SIH_PIPELINE_DB_URL"])  # Session Pooler, não Direct, não Transaction
with conn.cursor() as cur:
    with cur.copy("COPY sih_metric_uf_staging (...) FROM STDIN") as copy:
        for row in aggregated_rows:
            copy.write_row(row)
    cur.execute("BEGIN; ... swap staging <-> live ...; COMMIT;")
```
**PIPE-04 (cache só some após contagem confirmada):** só liberar exclusão do cache bruto depois de
reler a contagem via PostgREST e conferir — mesmo princípio de "produção só confirma depois de
verificação" que `supabase/verify/contagens.sql` aplica pós-migração (ver seção Shared Patterns).

---

### `pipeline/sih/src/sih_pipeline/partitions.py` (service, file-I/O/transform)

**Analog do lado consumidor (a forma que o produtor precisa espelhar):**
`src/features/catalog/loadCatalog.ts` linhas 24-56 — fetch same-origin + cache em memória:
```typescript
// src/features/catalog/loadCatalog.ts:24-36 — o guard de origem que o produtor deve honrar
async function fetchCatalogJson<T>(path: string): Promise<T> {
  if (!path.startsWith(`${CATALOG_BASE}/`)) {
    throw new Error(`Catálogo offline: caminho inválido (${path}).`);
  }
  if (FORBIDDEN_HOST.test(path)) {
    throw new Error('Catálogo offline: não é permitido carregar de DATASUS/IBGE.');
  }
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao carregar catálogo (${path}): ${res.status}`);
  return (await res.json()) as T;
}
```
`partitions.py` produz `{uf}.json.gz` que um novo `src/features/catalog/loadMunicipioPartition.ts`
consumirá com a mesma disciplina (`fetch` same-origin, cache em memória, path guard) — **nunca**
inventar um caminho de rede novo. Ver Pitfall 11: **não** depender de `Content-Encoding: gzip` do
servidor (issue aberta no `supabase-js`); subir o `.json.gz` como blob opaco e descomprimir no
cliente com `DecompressionStream('gzip')`:
```typescript
// RESEARCH ## Code Examples — usar no mesmo padrão fetch same-origin + cache em memória
async function fetchGzippedPartition(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.body) throw new Error(`sem corpo de resposta: ${url}`);
  const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(decompressed).text();
  return JSON.parse(text);
}
```

---

### `scripts/catalog/generateSihMigration.mjs` (novo, D-05/D-13/D-24 — dimensão `local`, `sih_collection_status`, tabelas de população)

**Analog exato:** `scripts/catalog/generateRenameMigration.mjs` — mesmo padrão de ponta a ponta:
gera `up`/`down`/`verify` a partir de dado versionado, timestamp constante (não `Date.now()`), zero
SQL escrito à mão.

**Imports/estrutura** (linhas 18-27):
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';

const RENAME_MAP_PATH = path.join(ROOT, 'scripts/catalog/rename-map.json');
const METRICLESS_PATH = path.join(ROOT, 'scripts/catalog/metricless-diseases.json');

/** Constant, not `Date.now()` — regenerating must reproduce this filename exactly. */
export const MIGRATION_TIMESTAMP = '20260804020000';
```
**Padrão de escape SQL a reusar literalmente** (linhas 48-50 — RESEARCH Security Domain também cita
isto para o raspador de oráculo, se algum valor raspado virar SQL gerado):
```javascript
function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
```
**Padrão de prova de integridade pós-migração** (dentro do próprio `up`/`down`, `RAISE EXCEPTION`
em vez de assumir sucesso — linhas 154-229, ver excerto reduzido):
```javascript
return `-- Prova de integridade (D-04) — aborta a transacao inteira (RAISE EXCEPTION) se
-- qualquer checagem falhar. Comparacao com IS DISTINCT FROM, nao "=", para que NULL
-- conte como NULL e nao passe batido.
do $$
declare
  v_bad_uf text;
  ...
begin
  ...
  if v_disease_antes is distinct from v_disease_antes then
    raise exception 'D-04: ...', v_disease_antes, v_disease_depois;
  end if;
  ...
end $$;`;
```
Para D-16 (substituição atômica total, nunca convivência TabNet/microdado), o gerador precisa de um
bloco de integridade equivalente que prove: (1) a tabela antiga foi totalmente substituída dentro da
mesma transação do swap staging→live, (2) nenhuma linha "órfã" de proveniência antiga sobrevive, (3)
contagens finais batem com o que a corrida de coleta produziu — mesmo padrão de `IS DISTINCT FROM`
sobre snapshots `create temporary table ... on commit drop`.

**Zero DDL / sem `ON UPDATE CASCADE` continua valendo** (linhas 10-14 do cabeçalho) — a dimensão
`local` e as novas tabelas são aditivas (RESEARCH `## Environment Availability`: "As novas tabelas...
são aditivas, não tocam sih_metric_uf/sih_metric_muni em ciclos de renomeação"), então o gerador novo
provavelmente **é** DDL (novas colunas/tabelas) — diferente do rename original que era zero-DDL. A
disciplina que atravessa é "gerado, nunca hand-written com teste que impede edição manual", não
literalmente "zero DDL".

---

### `src/features/catalog/sihMigration.test.ts` (novo)

**Analog exato:** `src/features/catalog/renameMigration.test.ts` linhas 53-179 — mesma estrutura:
regenerar em memória, comparar byte-a-byte com o arquivo commitado, checar ausência/presença de
cláusulas semânticas (`ALTER TABLE`, `ON UPDATE CASCADE`, `BEGIN`), checar simetria up/down.
```typescript
// src/features/catalog/renameMigration.test.ts:174-178
it('rollback e verify nunca ficam sob supabase/migrations/ — supabase db push nunca os aplica por engano', () => {
  expect(DOWN_PATH).not.toContain('/supabase/migrations/');
  expect(VERIFY_PATH).not.toContain('/supabase/migrations/');
  expect(UP_PATH).toContain('/supabase/migrations/');
});
```
Este teste específico (rollback/verify fora de `supabase/migrations/`) precisa ser reproduzido
literalmente para as três novas migrações — é o que impede `supabase db push` de aplicar rollback
por engano.

---

### `supabase/verify/sih-local-swap-contagens.sql` (novo, prova do D-16)

**Analog exato:** `supabase/verify/contagens.sql` (42 linhas, arquivo inteiro relevante):
```sql
-- contagens.sql
-- Fase 8 Plan 5 (TAX-03) — gerado por scripts/catalog/generateRenameMigration.mjs a partir
-- de scripts/catalog/rename-map.json + scripts/catalog/metricless-diseases.json.
-- NAO EDITAR A MAO.
--
-- Roda manualmente apos a migracao (ensaio local 08-08, producao 08-10) — fica FORA de
-- supabase/migrations/, entao supabase db push nunca aplica isto.
do $$
declare
  v_disease bigint;
  v_uf bigint;
  v_muni bigint;
begin
  select count(*) into v_disease from sih_disease;
  if v_disease is distinct from 331 then
    raise exception 'contagens: sih_disease tem % linhas, esperado 331', v_disease;
  end if;
  ...
end $$;

-- Agravos sem nenhuma linha em sih_metric_uf que NAO estao registrados como excecao
-- conhecida (metricless-diseases.json) — inspecionar manualmente no ensaio.
select d.id, d.label
from sih_disease d
where d.id not in (select distinct disease_id from sih_metric_uf)
  and d.id not in ('todas_as_outras_causas_externas');
```
A verificação do swap D-16 precisa da mesma forma: contagens absolutas medidas ao vivo (não
adivinhadas), `RAISE EXCEPTION` com `IS DISTINCT FROM`, e uma query de inspeção manual final (aqui:
provavelmente "nenhuma linha de proveniência TabNet sobrevive" em vez de "agravos órfãos"). Fica fora
de `supabase/migrations/` pelo mesmo motivo — nunca aplicado automaticamente por `db push`.

---

## Shared Patterns

### Encadeamento fail-closed em `pretest`/`test:run`/`gate`
**Fonte:** `package.json` linhas 6-14 (arquivo atual, a modificar):
```json
"pretest": "npm run catalog:validate",
"test:run": "npm run catalog:validate && vitest run",
"gate": "npm run test:run && npm run build",
```
**Aplicar a:** o novo passo Python precisa entrar no mesmo lugar que `catalog:validate` ocupa hoje —
proposto no RESEARCH como `pipeline:reconcile-gate` (`uv run pytest tests/test_reconcile_gate.py`
dentro de `pipeline/sih/`), encadeado em `test:run` e portanto em `gate`. Reproduzir literalmente o
padrão `A && B` (fail-closed: se `catalog:validate`/`uv run pytest` sair não-zero, `vitest run` nunca
roda) — nunca `||` nem passos silenciosamente ignoráveis.

### CI com actions pinadas por SHA + `uv` instalado
**Fonte:** `.github/workflows/ci.yml` (arquivo inteiro, 29 linhas):
```yaml
permissions:
  contents: read

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - run: npm run gate
```
**Aplicar a:** inserir um passo `astral-sh/setup-uv` **pinado por SHA de commit** (mesma disciplina
do comentário nas linhas 18-22 — "Actions fixadas por SHA de commit, nao por tag movel") antes de
`npm run gate`, já que `gate` agora invoca `uv run pytest` internamente. `permissions: contents: read`
continua valendo — o pipeline de CI não precisa de escrita.

### Dado com motivo escrito, nunca allowlist silenciosa
**Fonte:** `scripts/catalog/extra-diseases.json`, `scripts/catalog/exclusions.json`,
`scripts/catalog/metricless-diseases.json` (arquivos inteiros, já citados acima).
**Aplicar a:** `scripts/catalog/cid-corrections.json` (D-05) e a fixture do oráculo
`tests/fixtures/oracle_ac_2019.json` (D-04/D-06) — toda exceção ganha uma entrada com razão em texto,
nunca uma regra de precedência embutida em código (a forma exata que produziu a corrupção do
`KNOWN_BY_CODE`, citada no D-05 do CONTEXT como o erro a não repetir).

### Guarda de path / nunca resolver fora do allowlist (ASVS V12)
**Fonte:** `scripts/catalog/paths.mjs` linhas 29-53 (`corpusPath`, já citado acima).
**Aplicar a:** toda escrita de arquivo do pipeline Python — cache de parquet, ledger local, arquivos
temporários de download — precisa de um guard equivalente, resolvendo só dentro de um diretório
configurado (nunca a partir de nome de arquivo vindo do FTP sem validação).

### Fetch same-origin + cache em memória (Fase 5, reusar sem inventar caminho novo)
**Fonte:** `src/features/catalog/loadCatalog.ts` (arquivo inteiro, 70 linhas, já citado acima).
**Aplicar a:** o novo `loadMunicipioPartition.ts` (D-20/D-21) — mesmo `CATALOG_BASE`-style guard,
mesmo cache em memória por processo (`let cache: ... = null`), mesmo padrão de erro explícito em vez
de `undefined` silencioso.

---

## No Analog Found

Arquivos sem correspondência de mesma linguagem no repositório — usar `RESEARCH.md` como referência
primária (código já verificado ao vivo contra o FTP/Postgres real nesta sessão):

| Arquivo | Papel | Fluxo de dado | Motivo |
|---|---|---|---|
| `pipeline/sih/pyproject.toml`, `.python-version`, `uv.lock` | config | — | Primeiro projeto `uv`-gerenciado do repositório; usar `RESEARCH.md ## Standard Stack > Installation` como referência (`uv init --python 3.11`, `uv add "pysus==1.0.1" "psycopg[binary]==3.3.4"`) |
| `pipeline/sih/tests/fixtures/rdac1901_2019.parquet` | fixture binária | batch | Sem analog — gerado por execução real do pipeline contra AC/2019, não escrito à mão |
| `pipeline/sih/README.md` | docs | — | Sem analog direto; CONTEXT exige documentar o pin `pysus==1.0.1` com o porquê ao lado (spike §1-2) para "ninguém atualizar" |

## Arquivos a DELETAR (D-18/D-19) — blast radius medido

| Arquivo | Referenciado em | Ação do planner |
|---|---|---|
| `scripts/catalog/uploadSihToSupabase.mjs` | nenhum script `package.json` o invoca diretamente hoje (uso manual via `node scripts/catalog/uploadSihToSupabase.mjs`), citado em `docs/SUPABASE-CATALOG.md:120` | Deletar arquivo; atualizar `docs/SUPABASE-CATALOG.md` (linha 120, seção de comando de upload) para descrever o novo caminho `upload.py`/D-17 |
| `trabalhos datasus/scripts/coleta_sih_multi_disease.py` | `package.json` script `scrape:sih-multi` (linha: `"scrape:sih-multi": "python3 \"trabalhos datasus/scripts/coleta_sih_multi_disease.py\" --skip-done"`) | Remover a entrada `scrape:sih-multi` do `package.json`; deletar o arquivo (ou mover para pasta histórica se o CONTEXT decidir manter como referência morta — D-19 diz "vira arquivo histórico", então avaliar se fica fora de `scripts/` executável) |
| `trabalhos datasus/scripts/scrape_upload_sih.py` | não referenciado em `package.json` (uso manual); contém `INGEST_SECRET` em texto plano na linha 33 | Deletar; é a origem do segredo que D-17 resolve por remoção |
| `trabalhos datasus/scripts/launch_overnight.py` | `package.json` script `scrape:overnight` (`"scrape:overnight": "python3 \"trabalhos datasus/scripts/launch_overnight.py\""`) | Remover a entrada `scrape:overnight` do `package.json`; deletar o arquivo |
| `trabalhos datasus/outputs/coleta_sih_multi/` (654 CSVs) | `scripts/catalog/paths.mjs` (`ALLOWED_PREFIXES`, `multiPackSource()`), `scripts/catalog/uploadSihToSupabase.mjs` (`OUT` constant) | Vira "arquivo histórico" (D-19) — para de ser entrada de build; `paths.mjs` provavelmente mantém a leitura para os packs de Variáveis até serem regenerados (D-19: "Os 10 packs... são regerados a partir do dado novo quando ele existir") — **o planner deve confirmar em `scripts/catalog/paths.mjs`/consumidores dos 10 packs antes de remover `ALLOWED_PREFIXES`** |

**`docs/SUPABASE-CATALOG.md`** precisa de atualização (não deleção) — CONTEXT §canonical_refs já
avisa: "Precisa ser atualizado por esta fase — a dimensão `local`, o ledger, a mudança do município
para Storage e as tabelas de população mudam o contrato." O arquivo atual (linhas 28-97) é a
referência de schema a estender, não substituir.

---

## Metadata

**Escopo de busca de analog:** `scripts/catalog/`, `src/features/catalog/`, `supabase/{migrations,rollback,verify}/`, `trabalhos datasus/scripts/`, `.github/workflows/`, `package.json`, `docs/SUPABASE-CATALOG.md`
**Arquivos varridos:** ~15 lidos por completo (arquivos pequenos, uma leitura cada) + `validate.mjs`/`coleta_sih_multi_disease.py` lidos por trecho não sobreposto (arquivos grandes)
**Data da extração de padrões:** 2026-08-04
