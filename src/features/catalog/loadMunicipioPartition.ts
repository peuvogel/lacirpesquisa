/**
 * D-20/D-21: grão município servido do Supabase Storage particionado por UF, nunca do Postgres
 * -- `sih_metric_muni` (319 MB, TabNet legado) não cabe no banco gratuito em cobertura completa
 * (09-CONTEXT.md "Restrição dura"). Mesmo padrão de `loadCatalog.ts` (Fase 5): guarda de origem
 * validada ANTES do `fetch`, cache em memória por processo, erro explícito em vez de
 * `undefined`/`[]` silencioso.
 *
 * Diferença de `loadCatalog.ts`: a base não é same-origin (`/data/catalog`), é o prefixo único do
 * bucket público `sih-municipio` no Supabase Storage, e a descompressão é responsabilidade
 * explícita do cliente (`DecompressionStream` nativo) -- o `supabase-js` não suporta o cabeçalho
 * de compressão do servidor no `upload()` hoje (RESEARCH Pitfall 11, issue
 * supabase/supabase-js#1883 aberta). `partitions.py` (Task 1, 09-09) sobe o `.json.gz` como blob
 * opaco por essa mesma razão -- produtor e consumidor espelham a mesma decisão.
 *
 * O cache guarda a PROMESSA, não o valor: dois drills simultâneos na mesma UF compartilham um
 * único `fetch` em vez de disparar dois (T-09-35 -- 30 alunos numa aula não devem multiplicar
 * requisições para a mesma UF).
 */

export interface MunicipioPartition {
  schema: number;
  uf: string;
  colunas: string[];
  dados: unknown[][];
  derivedAt: string;
  cidMapVersion: string;
}

const FORBIDDEN_HOST =
  /(?:^|\/\/)(?:tabnet\.datasus\.gov\.br|sidra\.ibge\.gov\.br|servicodados\.ibge\.gov\.br)/i;

/** Sigla de UF: exatamente 2 letras maiúsculas -- fecha por construção qualquer tentativa de
 * traversal (`../`) ou host embutido via o parâmetro `uf` (ASVS V13, T-09-34). */
const UF_SIGLA = /^[A-Z]{2}$/;

function partitionBase(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Partição de município offline: VITE_SUPABASE_URL não configurada.');
  }
  return `${supabaseUrl}/storage/v1/object/public/sih-municipio/`;
}

const cache = new Map<string, Promise<MunicipioPartition>>();

/** Limpa o cache em memória -- usado só por teste. */
export function clearPartitionCache(): void {
  cache.clear();
}

async function fetchPartition(uf: string, url: string): Promise<MunicipioPartition> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Falha ao carregar partição de município ${uf} (${url}): ${response.status}`,
    );
  }
  if (!response.body) {
    throw new Error(`Partição de município ${uf} sem corpo de resposta (${url}).`);
  }
  const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(decompressed).text();
  return JSON.parse(text) as MunicipioPartition;
}

/**
 * Baixa e descomprime a partição colunar de `uf` (mesmo formato de `partitions.py`, Task 1),
 * com cache em memória por processo indexado pela sigla.
 *
 * A guarda de origem roda inteiramente ANTES de qualquer `fetch`: sigla fora do formato
 * `[A-Z]{2}`, base sem `VITE_SUPABASE_URL` configurada, ou URL apontando para host de
 * DATASUS/IBGE (mesmo que o prefixo do bucket "casasse", caso a própria env esteja
 * mal-configurada) -- qualquer um dos três lança antes de tocar a rede.
 *
 * `async` deliberado (não só "retorna Promise"): garante que um `throw` síncrono da guarda vire
 * rejeição de promessa, nunca uma exceção síncrona escapando de uma função que o chamador trata
 * como `Promise<T>` -- consistência de contrato para quem chama `.catch()`/`await`.
 */
export async function loadMunicipioPartition(uf: string): Promise<MunicipioPartition> {
  if (!UF_SIGLA.test(uf)) {
    throw new Error(`Partição de município: sigla de UF inválida (${uf}).`);
  }

  const cached = cache.get(uf);
  if (cached) return cached;

  const base = partitionBase();
  const url = `${base}${uf}.json.gz`;

  if (!url.startsWith(base)) {
    throw new Error(`Partição de município offline: caminho inválido (${url}).`);
  }
  if (FORBIDDEN_HOST.test(url)) {
    throw new Error('Partição de município offline: não é permitido carregar de DATASUS/IBGE.');
  }

  const promise = fetchPartition(uf, url).catch((error: unknown) => {
    // Uma falha (rede, 404, host mal-configurado) não deve envenenar o cache para tentativas
    // futuras -- a promessa rejeitada é removida, a próxima chamada tenta de novo.
    cache.delete(uf);
    throw error;
  });
  cache.set(uf, promise);
  return promise;
}
