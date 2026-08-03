# Phase 8: Taxonomia canônica + integridade - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** ~30 (modificados) + ~10 (novos)
**Analogs found:** a maioria tem analog forte dentro de `scripts/catalog/` ou `src/features/catalog/`; migração SQL/Supabase e o invariante F (varredura de repo) não têm analog no projeto — ver `## No Analog Found`.

> Esta fase é predominantemente **modificação de pipeline existente**, não greenfield. Onde um arquivo já existe e só muda de conteúdo (ex.: `diseases.json`), o "analog" listado é o próprio gerador que o produz, não outro arquivo.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/catalog/sync-lista-morb.mjs` (reescrito: remove `KNOWN_BY_CODE`, filtro estrito do 330, snapshot em vez de `fetch()` ao vivo, exports puros) | build-time generator script | transform (snapshot → JSON) | `scripts/catalog/build.mjs` (mesmo papel: script `.mjs` que lê fonte e escreve JSON commitado) — mas a **forma CLI+export** a copiar é a de `validate.mjs` | role-match (build.mjs) / estrutural (validate.mjs para o split CLI/export) |
| `scripts/catalog/validate.mjs` (+ 5 novas funções exportadas, invariantes A-E) | validation script (CLI + lib pura) | transform / fail-closed check | **é o próprio arquivo** — `checkEntry`/`checkCatalog` são o molde a repetir | exact (extensão de um arquivo já no padrão certo) |
| `scripts/catalog/lista-morb-cid.json` (re-keyado por `tabnetCode`) | data file (mantido à mão, 2ª fonte) | — | ele mesmo (mudança de shape, não de papel) | exact |
| `scripts/catalog/diseases.json` (regenerado, 331 entradas) | generated data (output do gerador) | transform output | ele mesmo | exact |
| `src/features/catalog/diseases.lista.json` (regenerado, 331 entradas) | generated data (cópia runtime no bundle) | transform output | ele mesmo | exact |
| `scripts/catalog/columnMap.json` (regenerado/podado) | data file (merge incremental hoje) | transform output | ele mesmo (mas ver alerta A4 confirmado abaixo — `syncColumnMap.mjs` nunca remove chave) | exact, com ressalva de comportamento |
| `scripts/catalog/syncColumnMap.mjs` (guarda de `disease.id === 'embolia_trombose'` linha 54 precisa virar id canônico) | build-time generator script | transform (merge incremental) | ele mesmo | exact |
| `scripts/catalog/syncPackImports.mjs` (template hardcoded de `VARIABLE_ID_ALIASES`, linhas 74-79, e `toAlias()`) | build-time generator script (regex sobre arquivo-alvo) | transform (regenera bloco de import) | ele mesmo | exact |
| `scripts/catalog/paths.mjs` (guarda `disease.id === 'embolia_trombose'` linha 88 + `LEGACY_PACKS['sih.embolia_trombose_uf']` linhas 68-72) | config/path-resolver module | — | ele mesmo | exact |
| `scripts/catalog/parseCsv.mjs` (nomes de coluna `internacoes_embolia_trombose_arteriais` etc., linhas 23-25 — **não** tocar, ver Open Question RESEARCH #2) | utility (CSV parser) | transform | ele mesmo — mas é camada diferente do `disease.id`, não renomear sem decisão explícita | n/a (fora do escopo de rename salvo decisão do planner) |
| `src/features/catalog/catalogAnalysisData.ts` (10 imports de pack renomeados, `VARIABLE_ID_ALIASES` linhas 30-35, `getDefaultCatalogVariableId()` linha 103) | service module (facade sobre packs) | CRUD (leitura) | ele mesmo — mas **gerado por** `syncPackImports.mjs` só até certo ponto (ver `2.1` do RESEARCH) | exact, com ressalva de regeneração parcial |
| `src/features/catalog/taxonomy.ts` (literal `'embolia_trombose'` linha 218 em `catalogIdFor`) | service module (taxonomia pura) | transform | ele mesmo | exact |
| `src/routes/mapas/mockAnalysisData.ts` (`MOCK_LABEL_TO_ID` linhas 27-33, `getCatalogTimeSeriesYears('sih.embolia_trombose.internacoes')` linha 22) | deprecated facade (re-export) | — | ele mesmo | exact |
| `public/data/catalog/variables.json` (50 de 71 entradas) | generated data (output de `build.mjs`) | transform output | ele mesmo | exact |
| `public/data/catalog/packs/*.json` (9 de 10 arquivos renomeados + `packId` interno) | generated data (output de `build.mjs`) | transform output | ele mesmo | exact |
| 15 arquivos `*.test.ts`/`*.test.tsx` sob `src/` com `embolia_trombose` literal | test | — | uns aos outros (mesma classe de fixture) | exact |
| `scripts/catalog/sql/0.sql`…`4.sql` (seeds regeneradas + `INSERT` do código 330) | generated data (seed SQL) | batch | eles mesmos | exact |
| `rename-map.json` **(novo)** | data file (mapa old→canonical, D-12) | — | nenhum arquivo equivalente existe; ver `lista-morb-cid.json`/`columnMap.json` para convenção de shape JSON simples chaveado | no analog direto — ver `## Data-file shape conventions` |
| `exclusions.json` **(novo)** | data file (partição, D-14) | — | idem | no analog direto |
| `extra-diseases.json` **(novo)** | data file (2ª fonte, D-14) | — | `lista-morb-cid.json` (já é "2ª fonte" no mesmo sentido do D-11) | role-match |
| `aliases.json` **(novo)** | data file (dicionário curado, D-17/D-20) | — | `CatalogEntry.aliases?: string[]` em `src/features/catalog/types.ts:31` é o precedente de **campo**, não de arquivo — ver seção dedicada | role-match parcial |
| snapshot HTML bruto + extrato (D-13) **(novo)** | data file (evidência arquivada) | — | nenhum precedente no repo (nenhum HTML de terceiro é versionado hoje) | no analog |
| fixture pré-migração `diseases.json` corrompido (D-24/TAX-02) **(novo)** | test fixture | — | `src/test/fixtures/tabnet/*.txt` é o único precedente de "fixture de terceiro versionada sob `src/test/`", mas para outro domínio (paste parsing) | role-match fraco (mesmo diretório, formato diferente) |
| `src/test/noTombstoneLiterals.test.ts` **(novo, invariante F)** | test (guarda estrutural, varre `git ls-files`) | event-driven/batch (scan) | nenhum teste do repo varre o repositório hoje — mais próximo é o padrão de "ausência estrutural" da Fase 7 (`07-05`, prop `layout` removida), que é uma filosofia, não um teste de scan | no analog direto — ver `## No Analog Found` |
| `src/features/catalog/*.test.ts` novo, para invariantes A/D/E contra fixture pré-migração (TAX-02) | test | — | `src/features/catalog/validateCatalogEntry.test.ts` (import relativo de `scripts/catalog/validate.mjs`) | exact |
| `src/features/catalog/diseaseAliases.ts` **(novo — função pura de matching)** | utility (pure function) | transform | `src/features/catalog/filterCatalog.ts` (mesma forma: função pura, AND entre tokens, sem estado) | exact |
| `src/routes/mapas/MeasureDiseasePicker.tsx` (`diseaseMatches`/`normalizeCidQuery` linhas 49-60 + tira explicativa D-18) | component | request-response (busca client-side) | ele mesmo | exact |
| `supabase/config.toml`, `supabase/migrations/<timestamp>_rename_disease_ids.sql` **(novos)** | migration / config | batch (DDL/DML) | nenhum no próprio repo; `/Users/pedroalmeida/Projects/Mneuma/meuma.rascunho/supabase/migrations/20260212000000_rename_leads_to_users.sql` (projeto irmão do mesmo usuário) | role-match (projeto externo) |
| D-04 script de verificação de integridade (SQL, novo) | migration verification script | batch | mecânica já reproduzida em RESEARCH §4.2 (CTEs múltiplas) — não há arquivo `.sql` de verificação existente para copiar | no analog — ver RESEARCH §4.2/§4.5 para o SQL já testado |

---

## Pattern Assignments

### 1. `scripts/catalog/validate.mjs` — molde para os invariantes A-E

**Este é o analog mais importante da fase.** Já é fail-closed, já separa **função pura exportada** de **CLI**, e já é importado por vitest via caminho relativo (`../../../scripts/catalog/validate.mjs`).

**Imports** (linhas 1-9):
```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOG_OUT_DIR } from './paths.mjs';
```

**Assinatura de uma checagem pura existente** (`checkEntry`, linhas 42-112) — recebe dado + contexto, devolve **array de strings** (nunca lança, nunca sai do processo):
```javascript
/**
 * @param {unknown} entry
 * @param {Record<string, { packId?: string, metricKeys?: string[], rows?: unknown[] }>} packsById
 * @returns {string[]}
 */
export function checkEntry(entry, packsById = {}) {
  const errors = [];
  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
    return ['entry: must be a non-null object'];
  }
  const e = /** @type {Record<string, unknown>} */ (entry);
  const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : '(missing id)';

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = e[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${id}: missing or empty required field "${field}"`);
    }
  }
  // ... mais checagens, sempre push em `errors`, nunca throw ...
  return errors;
}
```

**Como as checagens se agregam** (`checkCatalog`, linhas 122-155) — itera, acumula erros de todas as entradas, nunca para no primeiro erro:
```javascript
export function checkCatalog(bundle) {
  const errors = [];
  const warnings = [];
  const variables = Array.isArray(bundle?.variables) ? bundle.variables : null;
  if (!variables) {
    return { ok: false, errors: ['variables: must be an array'], warnings };
  }
  // ...
  for (let i = 0; i < variables.length; i++) {
    const entry = variables[i];
    // ... checagem de duplicata por id ...
    errors.push(...checkEntry(entry, packsById));
  }
  errors.push(...checkSharedMetricsAcrossPacks(packsById, sharedMetricKeys));
  return { ok: errors.length === 0, errors, warnings };
}
```

**Separação CLI vs export puro** (linhas 290-320) — é o padrão exato a repetir para qualquer invariante novo:
```javascript
function main() {
  try {
    const result = validateCatalogDir(CATALOG_OUT_DIR);
    if (!result.ok) {
      const preview = result.errors.slice(0, 25);
      console.error('catalog:validate FAILED — fail-closed (D-05/D-06)');
      for (const err of preview) {
        console.error(`  - ${err}`);
      }
      if (result.errors.length > preview.length) {
        console.error(`  … and ${result.errors.length - preview.length} more`);
      }
      process.exit(1);
    }
    console.log(`catalog:validate OK (${CATALOG_OUT_DIR}) — provenance gate passed`);
    process.exit(0);
  } catch (err) {
    console.error('catalog:validate FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
```
`isDirectRun` é o que permite `node scripts/catalog/validate.mjs` rodar `main()` **e** `import { checkEntry } from '../../../scripts/catalog/validate.mjs'` em vitest não disparar `process.exit()`. As 5 novas funções de invariante (A-E) devem seguir exatamente essa forma: `export function checkX(...) { return errors_array; }`, chamadas dentro de um `main()` novo ou do `main()` existente, nunca lançando/saindo por conta própria.

**Erro conhecido a reproduzir para o invariante A** — a mensagem de erro já segue o formato `"${id}: descrição curta"`; manter esse estilo para os invariantes novos (ex.: `"${id}: slugify(label) !== id (esperado \"${expected}\")"`, `"tabnetCode ${code}: ausente de exclusions.json e de diseases.json — partição incompleta"`).

---

### 2. `scripts/catalog/sync-lista-morb.mjs` — gerador a corrigir

**Achado estrutural importante:** ao contrário de `validate.mjs`, este arquivo **hoje não exporta nada** — é um script de top-level `await` sem função alguma, sem `main()`, sem `isDirectRun`. Para o invariante B (regeneração byte-idêntica) rodar dentro de `validate.mjs`/vitest **sem rede** (D-09), a lógica de geração precisa ser fatorada em função(ões) puras exportadas que recebem o extrato do snapshot como argumento — na mesma mould que `validate.mjs` já usa. Isso é uma refatoração estrutural, não só correção de bug.

**`KNOWN_BY_CODE` a deletar por completo** (linhas 15-37):
```javascript
/** Preserve pack-compatible ids for diseases already scraped. */
const KNOWN_BY_CODE = {
  183: 'embolia_trombose',
  185: 'varizes_mmii',
  179: 'aneurisma_aorta',
  163: 'avc',
  164: 'ait',
  178: 'doencas_arterias',
  190: 'outras_doencas_vasculares',
  182: 'embolia_pulmonar',
  184: 'flebites_tromboflebites',
  175: 'hipertensao',
  176: 'angina_pectoris',
  177: 'infarto_agudo',
  180: 'outras_doencas_arteriais',
  181: 'aterosclerose',
  186: 'hemorroidas',
  187: 'outras_doencas_veias',
  188: 'linfedema',
  189: 'hipotensao',
  172: 'febre_reumatica',
  173: 'doencas_reumaticas_cronicas',
  174: 'outras_doencas_coracao',
};
```

**`slugify()` — o gerador canônico a preservar intacto** (linhas 41-50):
```javascript
function slugify(label, code) {
  const s = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .replace(/_+/g, '_');
  return s || `lista_${code}`;
}
```

**Filtro a corrigir de fraco (regex sobre rótulo) para estrito (código exato)** (linha 80, dentro do loop de opções):
```javascript
// ANTES (bug D-25 — captura o código 330 por acidente):
if (!code || SKIP_CODES.has(code) || /^todas/i.test(label) || code.startsWith('TODAS')) continue;

// A checagem correta é sobre `code`, nunca sobre `label`:
// código real → nunca pula por causa do rótulo começar com "Todas"
// só a pseudo-opção TODAS_AS_CATEGORIAS__ e os SKIP_CODES (331/332/333) saem
```

**Atribuição de id a substituir** (linha 81):
```javascript
// ANTES:
let id = KNOWN_BY_CODE[code] ?? slugify(label, code);
// DEPOIS (D-10/root_cause): sem dicionário, só slugify — allowlist explícita
// e justificada fica em código separado (ex.: `amputacao_mmii`), não aqui.
let id = slugify(label, code);
```

**`amputacao_mmii` — a entrada hardcoded que vira `extra-diseases.json`** (linhas 93-99):
```javascript
out.push({
  id: 'amputacao_mmii',
  label: 'Amputação / desarticulação de membros inferiores',
  filterKind: 'procedimento',
  tabnetCode: '3331',
  def: 'sih/cnv/qibr.def',
});
```

**Escrita dos dois artefatos derivados — formatação a preservar exatamente** (linhas 101-121):
```javascript
const diseasesPath = path.join(ROOT, 'scripts/catalog/diseases.json');
fs.writeFileSync(diseasesPath, `${JSON.stringify(out, null, 2)}\n`);
// ...
fs.writeFileSync(
  path.join(ROOT, 'src/features/catalog/diseases.lista.json'),
  `${JSON.stringify(runtime)}\n`,
);
```
**Confirmado por leitura de bytes nesta sessão:** `diseases.json` é `JSON.stringify(out, null, 2)` (indentado, 2 espaços) **com newline final**; `diseases.lista.json` é `JSON.stringify(runtime)` **sem indentação, uma linha só, com newline final**. Qualquer reimplementação do invariante B precisa comparar string a string contra exatamente esses dois formatos — um `JSON.stringify(x, null, 2)` onde hoje é minificado (ou vice-versa) falha byte a byte mesmo com dado idêntico.

**Leitura do `lista-morb-cid.json` a re-chavear** (linhas 104-114) — hoje é `cidById[d.id]`, chaveado por id (frágil sob rename); D-11 pede re-chavear por `tabnetCode`:
```javascript
const cidMapPath = path.join(ROOT, 'scripts/catalog/lista-morb-cid.json');
const cidById = fs.existsSync(cidMapPath)
  ? JSON.parse(fs.readFileSync(cidMapPath, 'utf8'))
  : {};

const runtime = out.map((d) => ({
  id: d.id,
  label: d.label,
  filterKind: d.filterKind,
  tabnetCode: d.tabnetCode,
  cid: d.filterKind === 'lista_morb' ? (cidById[d.id] ?? null) : null,
  packId: `sih.${d.id}_uf`,
  domain: d.filterKind === 'lista_morb' ? 'sih_lista_morb' : 'vascular',
}));
```

---

### 3. Data-file shape conventions — para `rename-map.json`, `exclusions.json`, `aliases.json`, `extra-diseases.json`

CONTEXT deixa o formato a critério do planner — **não inventar aqui**, só mostrar o que já existe para o planner escolher algo consistente com o house style.

**`scripts/catalog/lista-morb-cid.json`** — objeto plano `{ id: valor }`, sem aninhamento, sem metadado de proveniência dentro do próprio arquivo (a proveniência mora no código que o lê, não no dado):
```json
{
  "colera": "A00",
  "febres_tifoide_e_paratifoide": "A01",
  "shiguelose": "A03",
  "outras_doencas_infecciosas_intestinais": "A02, A04-A05, A07-A08"
}
```
Note o valor podendo ser string simples ou lista de intervalos como string única (`"A02, A04-A05, A07-A08"`) — não é array, é string livre.

**`scripts/catalog/columnMap.json`** — objeto de objetos, chaveado por `packId` no nível 1 e por nome de coluna no nível 2, cada folha é um objeto completo com `id`/`label`/`sourceKey` etc. (mesmo shape de uma entrada de `variables.json`, sem os campos de runtime como `loadable`/`yearsAvailable`):
```json
{
  "internacoes": {
    "id": "sih.avc.internacoes",
    "label": "Internações — AVC / acidente vascular cerebral",
    "variableType": "contagem",
    "domain": "vascular",
    "unit": "n",
    "sourceSystem": "SIH/SUS",
    "sourceName": "Morbidade hospitalar — local de internação",
    "tableOrIndicator": "sih/cnv/nibr.def",
    "sourceKey": "sih_morbidade_local_internacao"
  }
}
```

**`public/data/catalog/variables.json`** — array de objetos "flat" com todo campo de proveniência obrigatório inline (nenhum objeto aninhado, `yearsAvailable` como array de números):
```json
{
  "id": "cnes.medicos_vasculares_sus",
  "label": "Médicos vasculares no SUS (CNES)",
  "variableType": "contagem",
  "domain": "rh_sus",
  "sourceSystem": "CNES",
  "sourceName": "Cadastro Nacional de Estabelecimentos de Saúde — profissionais",
  "tableOrIndicator": "cnes/cnv/prid02br.def",
  "period": "2013–2025",
  "officialUrl": "http://tabnet.datasus.gov.br/...",
  "methodologyNotes": "...",
  "loadable": true,
  "packId": "sih.embolia_trombose_uf",
  "columnKey": "medicos_vasculares_sus",
  "grain": "uf_ano",
  "unit": "n",
  "yearsAvailable": [2013, 2014, "..."]
}
```

**`src/features/catalog/types.ts:31`** — o único precedente de **campo** "apelido de busca" já existente no projeto (não é o mesmo conceito de apelido de doença do TAX-05, mas é a referência de forma mais próxima):
```typescript
export interface CatalogEntry {
  // ...
  aliases?: string[];
  // ...
}
```

**Convenção geral observada em todo o pipeline, a manter nos 4 arquivos novos:**
- Objeto plano ou array plano — nunca mais de 2 níveis de aninhamento.
- Chaves em `snake_case`/`camelCase` conforme o campo (ids de disease em `snake_case`, campos de metadado em `camelCase`).
- Proveniência/motivo, quando existe, é **string livre em português**, não enum (`methodologyNotes` em `variables.json` é o precedente — texto corrido, não código de razão).
- `JSON.stringify(x, null, 2)` + newline final é o padrão em todo arquivo escrito por script (`diseases.json`, `columnMap.json`, `variables.json`, `manifest.json`); só `diseases.lista.json` foge disso (minificado, ver seção 2 acima) porque é peso de bundle, não peso de repo — decisão consciente a preservar, não a copiar para os 4 arquivos novos (que são dados de config/curadoria, não bundle).

---

### 4. Cadeia de regeneração — `build.mjs`, `rebuildAfterScrape.mjs`, `syncPackImports.mjs`, `syncColumnMap.mjs`

**Ordem de execução confirmada** (`rebuildAfterScrape.mjs`, arquivo inteiro, 22 linhas):
```javascript
run('node', ['scripts/catalog/syncColumnMap.mjs']);
run('node', ['scripts/catalog/build.mjs']);
run('node', ['scripts/catalog/syncPackImports.mjs']);
run('node', ['scripts/catalog/validate.mjs']);
console.log('rebuildAfterScrape: OK');
```
Esta é a sequência que qualquer plano de regeneração pós-rename precisa reproduzir (mais o passo de `sync-lista-morb.mjs`/`--refresh` **antes** de tudo isso, que hoje não está no encadeamento porque hoje ele roda fetch ao vivo sob demanda — D-09 muda isso para snapshot).

**Perigo de determinismo confirmado por leitura completa do script — `syncColumnMap.mjs` faz *merge*, nunca remove chave** (linhas 52-68):
```javascript
let added = 0;
for (const disease of diseases) {
  if (disease.id === 'embolia_trombose' || disease.id === 'amputacao_mmii') continue;
  const packId = `sih.${disease.id}_uf`;
  if (!columnMap[packId]) {
    columnMap[packId] = standardColumns(disease.id, disease.label);
    added += 1;
    continue;
  }
  const cols = standardColumns(disease.id, disease.label);
  for (const [key, meta] of Object.entries(cols)) {
    if (!columnMap[packId][key]) {
      columnMap[packId][key] = meta;
      added += 1;
    }
  }
}
```
**Isso resolve a A4 do RESEARCH como "confirmado, não é suposição":** rodar `syncColumnMap.mjs` depois do rename **não apaga** as 21 (ou mais) chaves antigas de `columnMap.json` (ex.: `sih.avc_uf` continuaria existindo ao lado da nova `sih.<canonical>_uf`) — o script só adiciona o que falta. Um passo explícito de poda (script novo ou edição manual documentada) precisa entrar na cadeia, ou o invariante B/F vai ver `columnMap.json` como "byte-diferente do esperado" ou como portador de tombstone residual. `columnMap.json` é **dado**, não código-fonte, então o invariante F (que varre `git ls-files` de código) **não** cobre isso — precisa ser o invariante D ou um invariante novo dedicado, decisão do planner.

**Hardcode que sobrevive à regeneração automática — `syncPackImports.mjs` linhas 73-79** (o próprio script que regenera `catalogAnalysisData.ts` escreve este bloco como string fixa, não derivada de dado algum):
```javascript
const mid = `import type { CatalogEntry, PackFile } from './types';
import variablesJson from '../../../public/data/catalog/variables.json';
${packs.map((id) => `import ${toAlias(id)} from '../../../public/data/catalog/packs/${id}.json';`).join('\n')}

/** Analysis variable shown in Mapas checkboxes / choropleth (catalog or paste overlay). */
export interface CatalogAnalysisVariable {
  id: string;
  label: string;
  provenance: 'catalog' | 'paste';
  unit?: string;
  sourceSystem?: string;
}

/** Stable Phase 4 mock IDs → pack-backed catalog IDs where semantics match (D-18). */
export const VARIABLE_ID_ALIASES: Readonly<Record<string, string>> = {
  'mock.amputacoes': 'sih.amputacao_mmii.internacoes',
  'mock.internacoes': 'sih.embolia_trombose.internacoes',
  'mock.obitos': 'sih.embolia_trombose.obitos',
  // mock.taxa_mortalidade intentionally NOT aliased (infantil ≠ hospital SIH rates)
};

const CATALOG_ENTRIES = variablesJson as CatalogEntry[];
${packsBlock}
`;
```
Rodar `syncPackImports.mjs` depois do rename dos packs atualiza os **imports** (derivados de `readdirSync(PACK_DIR)`, linhas 23-31) mas **não** toca `VARIABLE_ID_ALIASES` — o texto `'sih.embolia_trombose.internacoes'` está fixo dentro do próprio gerador. É preciso editar este template (dentro de `syncPackImports.mjs`) antes de rodar o script, não só rodar o script.

**Segundo hardcode que a regex do script não cobre** — `getDefaultCatalogVariableId()` em `catalogAnalysisData.ts:103`, fora do bloco substituído por `syncPackImports.mjs` (a regex de substituição vai de `import type { CatalogEntry, PackFile }` até o fechamento de `PACKS`, linha 47-49 do script — este método fica depois, nunca é tocado):
```typescript
export function getDefaultCatalogVariableId(): string {
  const preferred = 'sih.embolia_trombose.internacoes';
  if (ENTRIES_BY_ID.has(preferred)) return preferred;
  const firstCount = LOADABLE_ENTRIES.find((e) => e.variableType === 'contagem');
  return firstCount?.id ?? LOADABLE_ENTRIES[0]?.id ?? preferred;
}
```

**Escrita atômica de `build.mjs` (D-05 pattern a preservar, não modificar)** — `atomicWriteCatalog` (linhas 173-195), escreve em dir temp e faz `rename` (com fallback copy+unlink cross-device):
```javascript
async function atomicWriteCatalog(files) {
  const tmpRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'lacir-catalog-'));
  try {
    // ... escreve todos os arquivos no tmpRoot ...
    for (const rel of Object.keys(files)) {
      const from = path.join(tmpRoot, rel);
      const to = path.join(CATALOG_OUT_DIR, rel);
      await fsPromises.rename(from, to).catch(async () => {
        await fsPromises.copyFile(from, to);
        await fsPromises.unlink(from);
      });
    }
  } finally {
    await fsPromises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}
```
Nenhum arquivo dessa fase deveria regredir esse padrão para escrita direta sem atomicidade.

---

### 5. Analog de teste vitest — `validateCatalogEntry.test.ts` e `catalogAnalysisData.test.ts`

**Confirma o mecanismo de import cross-tree que a fase depende** (RESEARCH §Validation Architecture): vitest só enxerga `src/**/*.{test,spec}.{ts,tsx}` (confirmado em `vite.config.ts:17`: `include: ['src/**/*.{test,spec}.{ts,tsx}']`), mas o teste importa direto de `scripts/catalog/` por caminho relativo:

```typescript
// src/features/catalog/validateCatalogEntry.test.ts, linhas 1-5
import { describe, expect, it } from 'vitest';
import {
  checkCatalog,
  checkEntry,
} from '../../../scripts/catalog/validate.mjs';
```
Este é o padrão exato para o(s) teste(s) vitest dos invariantes A-E (rodando contra a fixture pré-migração, D-24/TAX-02): mesmo import relativo de 3 níveis, mesma pasta `src/features/catalog/`.

**Padrão de fixture local com `overrides`** (linhas 8-23, `baseEntry`) — função fábrica que aceita overrides parciais, evita repetição de shape completo em cada `it()`:
```typescript
function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sih.demo.internacoes',
    label: 'Internações demo',
    // ... campos obrigatórios completos ...
    loadable: false,
    ...overrides,
  };
}
```

**Padrão de leitura de arquivo real do repo dentro de um teste** (`catalogAnalysisData.test.ts`, linhas 1-24) — usa `node:fs`/`node:path` direto, sem mock, para comparar contra o dado commitado real:
```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACK_ROOT = resolve(process.cwd(), 'public/data/catalog/packs');

function packSpValue(packId: string, year: number, columnKey: string): number {
  const pack = JSON.parse(readFileSync(resolve(PACK_ROOT, `${packId}.json`), 'utf8')) as {
    rows: Array<Record<string, unknown>>;
  };
  const row = pack.rows.find((r) => r.uf === 'SP' && r.ano === year);
  expect(row).toBeTruthy();
  return row![columnKey] as number;
}
```
Este é o padrão a copiar para qualquer teste que precise ler `diseases.json`/`rename-map.json`/`exclusions.json` reais do repo em vez de mockar — inclusive o teste do invariante B (compara string gerada vs. arquivo commitado).

**Fixture pré-migração (D-24/TAX-02) — nenhum analog direto de "snapshot congelado de estado corrompido" existe no repo.** O mais próximo é `src/test/fixtures/tabnet/*.txt` (fixtures de texto para parsing de paste em outro domínio, formato `.txt` livre, não JSON de catálogo) — só confirma a convenção de diretório (`src/test/fixtures/`), não o formato. O planner decide se a fixture é um array mínimo (21 corrompidos + amostra de controle) ou uma cópia integral congelada do `diseases.json` de hoje, mas o **lugar** (`src/` obrigatório) e a **forma de import** (relativo, ES module) seguem o padrão acima.

---

### 6. `MeasureDiseasePicker.tsx` — ponto de plugue dos apelidos

**Função de busca atual, sem estado, pura sobre `disease` + query** (linhas 49-60):
```typescript
function normalizeCidQuery(q: string): string {
  return q.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
}

function diseaseMatches(disease: DiseaseDef, q: string): boolean {
  const lower = q.toLowerCase();
  if (disease.label.toLowerCase().includes(lower) || disease.id.includes(lower)) return true;
  if (!disease.cid) return false;
  const cidNorm = normalizeCidQuery(disease.cid);
  const qNorm = normalizeCidQuery(q);
  return cidNorm.includes(qNorm) || (qNorm.length >= 2 && cidNorm.startsWith(qNorm));
}
```
**Onde plugar (linha 94, único call site):**
```typescript
const pool = q ? DISEASES.filter((d) => diseaseMatches(d, q)) : DISEASES;
```
A camada de apelido (D-17/D-19) entra como um `OR` adicional dentro de `diseaseMatches` (ou uma função `aliasMatches(disease, q)` chamada antes/depois) — a função já é pura e sem estado, não precisa reescrever o resto do componente. **Atenção:** `disease.id.includes(lower)` na linha 55 é exatamente o motivo do achado do CONTEXT ("avc" bate hoje porque o id **é** `avc`) — depois da migração isso deixa de casar por acidente, então a comparação por `id` continua existindo mas nunca mais vai casar com apelidos.

**`VariableList.tsx` (`src/routes/variaveis/VariableList.tsx`) confirmado como *não* fazendo busca própria** — recebe `entries: CatalogEntry[]` já filtrados por `VariaveisPage.tsx` via `filterCatalog()` (`grep` confirmado: `VariaveisPage.tsx:5` importa `filterCatalog`, `:90` chama `filterCatalog(variables, filters)`). `VariableList.tsx` só agrupa/ordena o que já chegou filtrado — **não** há segundo ponto de busca por apelido de doença a cobrir nesta fase (cobertura em `VariableList.tsx` está no Deferred do CONTEXT). O `filterCatalog.ts` (`src/features/catalog/filterCatalog.ts:12-30`) já usa exatamente o padrão AND-entre-tokens que RESEARCH §6.2 recomenda para o fuzzy novo:
```typescript
function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [entry.label, entry.id, entry.sourceSystem, /* ... */, ...(entry.aliases ?? [])]
    .join(' ')
    .toLowerCase();
  // Support multi-token search (all tokens must match).
  return q.split(/\s+/).every((token) => haystack.includes(token));
}
```
Esta é a implementação de referência mais próxima do algoritmo recomendado (AND entre tokens da query) — mesma forma, aplicar em `diseaseAliases.ts` novo.

---

## Shared Patterns

### Fail-closed CLI + export puro (Fase 5, `validate.mjs`)
**Fonte:** `scripts/catalog/validate.mjs:290-320` (ver excerto completo na seção 1)
**Aplicar a:** todas as 5 novas funções de invariante A-E.
Regra: nunca `process.exit()`/`throw` dentro da função de checagem — sempre devolver array de erro; só o `main()` decide exit code.

### JSON commitado — indentação 2 + newline final (exceto bundle runtime)
**Fonte:** `sync-lista-morb.mjs:102`, `build.mjs:342-343`, `syncColumnMap.mjs:70`
**Aplicar a:** `rename-map.json`, `exclusions.json`, `aliases.json`, `extra-diseases.json` — todos são dado de repo/curadoria (como `columnMap.json`), não bundle, então usam `JSON.stringify(x, null, 2) + '\n'`, nunca minificado.
```javascript
fs.writeFileSync(columnMapPath, `${JSON.stringify(columnMap, null, 2)}\n`);
```

### Escrita atômica para artefatos derivados de `public/data/catalog/`
**Fonte:** `build.mjs:173-195` (`atomicWriteCatalog`, ver seção 4)
**Aplicar a:** qualquer regeneração de `variables.json`/`packs/*.json` — nunca escrever direto no destino final.

### Import cross-tree `src/` ↔ `scripts/catalog/` via caminho relativo
**Fonte:** `src/features/catalog/validateCatalogEntry.test.ts:1-5`
**Aplicar a:** todo teste vitest novo dos invariantes A-F, D-24 fixture — import relativo de 3 níveis (`../../../scripts/catalog/...`) funciona porque ambos são ES modules.

### PT-BR didático, `n/d` para ausente
**Fonte:** herdado de fases anteriores (05/07), confirmado em mensagens de erro (`catalog:validate FAILED — fail-closed (D-05/D-06)`) e em texto de UI (`MeasureDiseasePicker.tsx` — "Buscar por nome ou CID", "Fluxo: lugar → doença → período → variáveis")
**Aplicar a:** mensagens de erro dos invariantes novos, tira explicativa do D-18 ("AVC corresponde a 3 categorias..."), motivos em `exclusions.json`.

### Guarda por ausência estrutural, não por convenção documentada (Fase 7, D-05)
**Fonte:** `.planning/phases/07-baseline-verde/07-CONTEXT.md:47`
**Aplicar a:** filosofia do invariante F (D-23) — mas note que a Fase 7 implementou isso **removendo uma prop/API**, não escrevendo um teste de varredura. O invariante F desta fase é um mecanismo novo (scan de `git ls-files`), sem precedente de implementação no repo — ver `## No Analog Found`.

### `disease.id === 'embolia_trombose'` como guarda literal duplicada
**Fonte:** `scripts/catalog/paths.mjs:88` e `scripts/catalog/syncColumnMap.mjs:54` (idêntico nos dois arquivos)
```javascript
if (disease.id === 'embolia_trombose' || disease.id === 'amputacao_mmii') continue;
```
**Achado não coberto pela tabela do CONTEXT nem citado por nome em RESEARCH §2.1-2.3, confirmado nesta sessão:** este é código de produção (não teste, não dado) que hardcoda o id `embolia_trombose` — um dos 21 corrompidos — como guarda para pular o path de "pack legado com nome de coluna dedicado" (`LEGACY_PACKS['sih.embolia_trombose_uf']`, `paths.mjs:68-72`) e ir para o path genérico multi-disease. Depois do rename, essa guarda precisa apontar para o **novo id canônico** de código 183 nos dois arquivos — se só um for atualizado, o outro fica com um id inexistente na lista (nunca mais bate `===`), silenciosamente tratando `embolia_trombose`-o-novo-nome-de-outra-doença como pack genérico em vez de legado, ou vice-versa. É exatamente o tipo de tombstone "em código, não em dado" que o invariante F (D-23) existe para pegar — mas como é uma comparação de string dentro de um `if`, não um literal isolado óbvio, vale registrar explicitamente para quem for implementar o invariante F confirmar que o regex/scan usado o alcança.

---

## Blast radius — contagens reconfirmadas nesta sessão (vs. CONTEXT vs. RESEARCH)

| Item | CONTEXT dizia | RESEARCH dizia | Reconfirmado agora | Nota |
|---|---|---|---|---|
| Total de arquivos com `embolia_trombose` | não mediu (só citava "8 arquivos de teste" + `taxonomy.ts`) | 32 arquivos | **32 arquivos, 153 ocorrências** (`grep -rn` em `src`, `scripts`, `public`) | confirma RESEARCH |
| Arquivos de teste sob `src/` | "8 arquivos de teste" | 15 arquivos (lista nomeada) | **15 arquivos `.test.ts`/`.test.tsx`** | CONTEXT estava desatualizado; RESEARCH correto |
| Código de produção não-teste em `src/` | `taxonomy.ts:218` (único citado) | + `catalogAnalysisData.ts`, + `mockAnalysisData.ts` (não citado no CONTEXT) | **exatamente 3 arquivos**: `taxonomy.ts`, `catalogAnalysisData.ts`, `mockAnalysisData.ts` | confirma RESEARCH; `mockAnalysisData.ts` tem 5 ocorrências (`MOCK_LABEL_TO_ID` + `getCatalogTimeSeriesYears` arg), não estava na tabela do CONTEXT |
| `scripts/catalog/paths.mjs:88` | não citado | citado como "NÃO citado" no CONTEXT, sinalizado para conferência | **confirmado**: guarda `disease.id === 'embolia_trombose'` na linha 88 + `LEGACY_PACKS` nas linhas 68-72 | ver Shared Patterns acima |
| `scripts/catalog/syncColumnMap.mjs:54` | não citado | citado como "NÃO citado" | **confirmado**: guarda idêntica à de `paths.mjs`, linha 54 | mesma lógica duplicada em 2 arquivos |
| `scripts/catalog/parseCsv.mjs:23-24` | não citado | citado com ressalva "não é tombstone de id, é nome de coluna" | **confirmado**: linhas 23-25 (não 23-24 — são 3 linhas: `internacoes_/obitos_/dias_permanencia_embolia_trombose_arteriais`), nomes de coluna CSV legados, camada distinta de `disease.id` | RESEARCH correto sobre a natureza; contagem de linha ligeiramente imprecisa (23-25, não 23-24) |
| `scripts/catalog/paths.mjs` como um todo | não citado | citado | confirmado presente e lido por completo — módulo de resolução de path com allowlist (`corpusPath`), não gerado, mantido à mão | — |
| `columnMap.json` | não citado | "330 chaves — NÃO citado explicitamente" | **confirmado: exatamente 330 chaves** (`python3 -c "json.load(...)"`), incluindo `sih.avc_uf` (uma das 21 erradas) com 5 sub-chaves de medida completas | confirma RESEARCH; ver Shared Patterns/`syncColumnMap.mjs` para o risco de merge incremental nunca podar |
| `mergeMultiIntoLegacyCsv.mjs` | não citado em nenhum dos dois | não citado na tabela principal (só na nota de rodapé "NÃO citado") | **confirmado**: 3 ocorrências de `embolia_trombose` (linhas 16, 18, 21), mesma natureza de `LEGACY_PACKS` — path/nome de coluna, não `disease.id` isolado | arquivo extra no blast radius, nem CONTEXT nem corpo principal de RESEARCH o listaram nominalmente |
| Packs com nome errado | "9 com nome errado (só `sih.amputacao_mmii_uf.json` correto)" | mesma contagem | **confirmado**: 10 arquivos em `public/data/catalog/packs/`, 9 com id de um dos 21 corrompidos no nome do arquivo | bate exatamente |
| `variables.json` 50/71 afetadas | 50 de 71 | confirmado por contagem programática (RESEARCH §2.4) | **confirmado** — não recontado por completo nesta sessão (arquivo grande, 65KB), mas a distribuição por `packId` já documentada em RESEARCH bate com os 10 packs físicos observados agora | — |

---

## No Analog Found

Arquivos/mecanismos sem precedente real no repo (planner deve se apoiar no RESEARCH — especialmente §4.2, §4.5, §6.2 — em vez de um analog local):

| File/Mecanismo | Role | Data Flow | Motivo |
|---|---|---|---|
| `src/test/noTombstoneLiterals.test.ts` (invariante F) | test (guarda estrutural) | batch scan | Nenhum teste do repo varre `git ls-files`/árvore de arquivos hoje. A "guarda estrutural" da Fase 7 (D-05, `07-CONTEXT.md:47`) foi implementada por **remoção de API**, não por um teste de varredura — não há molde de código para copiar, só a filosofia. |
| `supabase/config.toml` + `supabase/migrations/*.sql` | migration/config scaffold | batch DDL/DML | Diretório `supabase/` não existe neste projeto. Único precedente é o projeto irmão `Mneuma` (`/Users/pedroalmeida/Projects/Mneuma/meuma.rascunho/supabase/migrations/`, 133 arquivos) — útil para convenção de nome/comentário, mas é outro repo, outro schema. A mecânica de rename de duas passadas com CTEs múltiplas **já foi testada e validada** em RESEARCH §4.2 (não é suposição) — copiar o SQL de lá, não inventar de novo. |
| D-04 script de verificação de integridade (soma agregada) | migration verification | batch | Não existe nenhum script de verificação SQL no repo hoje (nem em `scripts/catalog/sql/`, que só tem seeds de `INSERT`). RESEARCH §4.5 já dá a forma do `INSERT` trivial do código 330; a soma agregada por `disease_id` × medida ainda não foi escrita em lugar algum — instanciar do zero seguindo o padrão de CTEs múltiplas de §4.2. |
| Snapshot HTML bruto + extrato (D-13, invariante C) | data (evidência arquivada) | file I/O | Nenhum HTML de terceiro é versionado no repo hoje. `src/test/fixtures/tabnet/*.txt` é fixture de **paste** (texto colado pelo usuário), não HTML de scrape — natureza diferente. Formato de armazenamento (HTML bruto vs. comprimido, extrato como `.json` separado ou embutido) é decisão nova do planner. |
| `aliases.json` (dicionário curado D-17/D-20) como **arquivo** | data | — | O único precedente de "apelido" no projeto é o **campo** `CatalogEntry.aliases?: string[]` (`types.ts:31`), usado para busca de variável individual (`filterCatalog.ts`), não para apelido de **doença inteira** resolvendo para N ids. Formato de arquivo (mapa termo→códigos com rótulo esperado, D-20) não tem precedente — só a convenção geral de JSON plano documentada em `## Data-file shape conventions`. |
| Fixture pré-migração completa (D-24/TAX-02) | test fixture | — | Nenhuma fixture "estado corrompido congelado" existe. Mais próximo por localização é `src/test/fixtures/`, mas todo conteúdo lá é de outro domínio (paste parsing estatístico). |

---

## Metadata

**Analog search scope:** `scripts/catalog/`, `src/features/catalog/`, `src/routes/mapas/`, `src/routes/variaveis/`, `public/data/catalog/`, `src/test/`, `/Users/pedroalmeida/Projects/Mneuma/meuma.rascunho/supabase/migrations/` (projeto irmão, só para convenção de nomenclatura de migration).
**Files scanned (lidos por completo nesta sessão):** `validate.mjs`, `sync-lista-morb.mjs`, `build.mjs`, `rebuildAfterScrape.mjs`, `syncPackImports.mjs`, `syncColumnMap.mjs`, `paths.mjs`, `parseCsv.mjs`, `uploadSihToSupabase.mjs`, `lista-morb-cid.json` (amostra), `diseases.json` (amostra), `diseases.lista.json` (integral via `python3`), `columnMap.json` (amostra + contagem), `variables.json` (amostra), `types.ts`, `taxonomy.ts`, `filterCatalog.ts`, `catalogAnalysisData.ts`, `catalogAnalysisData.test.ts`, `validateCatalogEntry.test.ts`, `MeasureDiseasePicker.tsx`, `VariableList.tsx`, `mockAnalysisData.ts`, `sql/0.sql`, `sql/4.sql`, `20260212000000_rename_leads_to_users.sql` (Mneuma), `package.json` (scripts), `.githooks/pre-push`.
**Pattern extraction date:** 2026-08-03
