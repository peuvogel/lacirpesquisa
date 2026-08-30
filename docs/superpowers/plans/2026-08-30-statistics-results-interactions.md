# Resultados estatísticos mais diretos e interativos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a área Estatística mais direta: cache automático local, barra lateral sticky com scroll interno, resultados e gráficos responsivos a hover/foco, relatório completo copiável e nenhuma pergunta de pesquisa redundante.

**Architecture:** Manter a infraestrutura IndexedDB atual, mas substituir o opt-in por uma máquina de persistência automática invisível e serializada. Extrair duas primitivas pequenas compartilhadas pelos dois painéis de resultados (`ResultMetricCard` e `CopyResultsButton`) e um formatador puro. Aplicar a remoção da pergunta nos dez módulos sem fundir os módulos estatísticos nem alterar seus motores.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest 4, Testing Library, Tailwind CSS 4, Chart.js 4 e IndexedDB.

**Spec:** `docs/superpowers/specs/2026-08-30-statistics-results-interactions-design.md`

## Global Constraints

- Esta revisão fica somente na branch local `codex/results-interactions` e deve ser acessível por `npm run dev`.
- Não fazer push, não abrir pull request e não publicar no GitHub Pages.
- Implementar cada comportamento com um teste vermelho antes da alteração correspondente.
- Preservar dados e mudanças locais que não pertençam a este plano.
- Não copiar linhas da tabela bruta, JSON, imagens ou estado interno no relatório textual.
- Não mudar motores, fórmulas, critérios de validade, gráficos disponíveis ou a correção anterior de Mann–Whitney.
- Toda interação de hover deve ter equivalente por teclado e respeitar `prefers-reduced-motion`.

---

## Task 1: Converter a persistência em cache automático local

**Files:**

- Modify: `src/shared/session/SessionPersistence.test.tsx`
- Modify: `src/shared/session/SessionProvider.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.test.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.tsx`
- Delete: `src/shared/session/SessionPersistenceControl.tsx`

- [ ] **Step 1: Escrever os testes vermelhos do cache automático**

Substituir o caso "opt-in off" e retirar chamadas a `setPersistenceEnabled`. Os testes essenciais devem expressar estes contratos:

```tsx
it('persists a new session automatically after restoration is ready', async () => {
  const storage = createStorage();
  const { result } = renderSession(storage);
  await waitFor(() => expect(result.current.persistenceReady).toBe(true));

  act(() => result.current.setDataset(sampleDataset()));

  await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
  expect((await storage.read())?.dataset?.table?.id).toBe('provider-table');
});

it('restores stable IDs, bindings, and visual preferences without opt-in', async () => {
  const storage = createStorage();
  const first = renderSession(storage);
  await waitFor(() => expect(first.result.current.persistenceReady).toBe(true));
  act(() => {
    first.result.current.setDataset(sampleDataset());
    first.result.current.setVisualPreferences({ 'mann-whitney:rank': { height: 520 } });
  });
  await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));
  first.unmount();

  const restored = renderSession(storage);
  await waitFor(() => expect(restored.result.current.persistenceStatus).toBe('saved'));
  expect(restored.result.current.dataset?.table?.bindings['mann-whitney']).toEqual({
    desfecho: 'provider-table-col-1',
    grupo: 'provider-table-col-2',
  });
  expect(restored.result.current.visualPreferences).toEqual({
    'mann-whitney:rank': { height: 520 },
  });
});
```

Atualizar também os testes existentes de gravação atrasada, quota e restauração inválida. Para snapshot inválido, provar que `clear()` é chamado, a sessão abre vazia e, se essa limpeza funcionar, uma edição posterior volta a ser gravada automaticamente. Para erro genérico de acesso ao IndexedDB, provar que a análise continua em memória com `persistenceStatus === 'error'`. O caso de limpeza deve provar tanto a remoção quanto a reativação automática:

```tsx
it('clears after an in-flight write and automatically persists later edits', async () => {
  const base = createStorage();
  const delayed = deferredWriteStorage(base);
  const { result } = renderSession(delayed.storage);
  await waitFor(() => expect(result.current.persistenceReady).toBe(true));

  act(() => result.current.setDataset(sampleDataset()));
  await waitFor(() => expect(result.current.persistenceStatus).toBe('saving'));
  act(() => result.current.clearSession());
  delayed.releaseWrite();

  await waitFor(() => expect(result.current.dataset).toBeNull());
  await waitFor(async () => expect(await base.read()).toBeNull());

  act(() => result.current.setDataset(sampleDataset()));
  await waitFor(() => expect(result.current.persistenceStatus).toBe('saved'));
  expect((await base.read())?.dataset).not.toBeNull();
});
```

Remover o `describe` da interface `SessionPersistenceControl` e imports de `render`, `screen` e `userEvent` que ficarem sem uso.

Adicionar em `EstatisticaPage.test.tsx` o contrato de que o controle invisível não continua montado:

```tsx
it('does not expose persistence controls in the statistics header', () => {
  renderPage();
  expect(screen.queryByText('Lembrar neste dispositivo')).not.toBeInTheDocument();
  expect(screen.queryByText('Salvo neste dispositivo')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /Persistência da sessão/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste isolado e confirmar a falha esperada**

Run: `npx vitest run src/shared/session/SessionPersistence.test.tsx src/routes/estatistica/EstatisticaPage.test.tsx`

Expected: FAIL porque uma sessão vazia ainda inicia com persistência desligada e a API ainda exige `setPersistenceEnabled`.

- [ ] **Step 3: Implementar a máquina automática no provedor**

Em `SessionState`/`SessionApi`:

- remover `persistenceEnabled` e `setPersistenceEnabled` da API pública;
- manter `persistenceReady`, `persistenceStatus`, `persistenceError` e `hasUnsavedChanges`, pois o guard de saída depende do último;
- manter o valor `'off'` no union apenas se for necessário para compatibilidade interna; o fluxo normal deve terminar em `'saved'`, `'saving'` ou `'error'`.

Substituir `persistenceEnabledRef` por um ref interno que represente disponibilidade de escrita, inicialmente `false` até a leitura terminar:

```tsx
const persistenceWritableRef = useRef(false);
```

Na conclusão bem-sucedida de `read()`:

```tsx
persistenceReadyRef.current = true;
persistenceWritableRef.current = true;
setPersistenceReady(true);

if (!snapshot) {
  lastPersistedDatasetRef.current = dataset;
  lastPersistedPreferencesRef.current = visualPreferences;
  setPersistenceStatus('saved');
  setPersistenceError(null);
  return;
}
```

Se houve mutação antes da restauração, preservar o estado atual e deixar o efeito posterior gravá-lo. Tratar `SessionSnapshotValidationError` separadamente: tentar `clear()`; se a limpeza funcionar, considerar a sessão vazia sincronizada, marcar `persistenceWritableRef.current = true` e permitir gravações futuras. Em falha genérica de leitura ou falha ao descartar o snapshot inválido, marcar `persistenceWritableRef.current = false`, manter a sessão em memória e expor somente o estado interno de erro.

O efeito de gravação deve aguardar restauração e disponibilidade:

```tsx
useEffect(() => {
  if (!persistenceReady || !persistenceWritableRef.current) return;
  if (
    dataset === lastPersistedDatasetRef.current
    && visualPreferences === lastPersistedPreferencesRef.current
  ) return;
  scheduleWrite(dataset, visualPreferences);
}, [dataset, persistenceReady, scheduleWrite, visualPreferences]);
```

Trocar `disablePersistence` por `clearPersistedSession`. Antes de zerar o estado React, invalidar geração e sequência e enfileirar `storage.clear()` depois de qualquer operação pendente. Para impedir que o próprio clear grave um snapshot vazio, criar uma única referência `const emptyVisualPreferences = {}`, atribuí-la tanto a `lastPersistedPreferencesRef.current` quanto a `setVisualPreferencesState(emptyVisualPreferences)`, e marcar `lastPersistedDatasetRef.current = null` junto de `setDatasetState(null)`. Não desligar `persistenceWritableRef`; uma alteração futura precisa voltar a gravar automaticamente.

O cálculo de dados não salvos deve usar status e igualdade por referência, sem flag de opt-in:

```tsx
const hasPersistedCurrentDataset = persistenceStatus === 'saved'
  && dataset === lastPersistedDatasetRef.current
  && visualPreferences === lastPersistedPreferencesRef.current;
```

- [ ] **Step 4: Remover o componente de opt-in sem consumidor**

Excluir `src/shared/session/SessionPersistenceControl.tsx` e remover seu import e sua montagem de `EstatisticaPage.tsx`. Manter por enquanto o link Portal DATASUS para que sua remoção continue sendo um passo vermelho independente na Task 2.

- [ ] **Step 5: Rodar testes e checagem de tipos focados**

Run: `npx vitest run src/shared/session/SessionPersistence.test.tsx src/routes/estatistica/LeaveWarningGuard.test.tsx src/routes/estatistica/EstatisticaPage.test.tsx`

Run: `npm run typecheck`

Expected: PASS; nenhum consumidor de `setPersistenceEnabled` ou `persistenceEnabled` permanece.

- [ ] **Step 6: Commit local**

```bash
git add src/shared/session/SessionProvider.tsx src/shared/session/SessionPersistence.test.tsx src/shared/session/SessionPersistenceControl.tsx src/routes/estatistica/EstatisticaPage.tsx src/routes/estatistica/EstatisticaPage.test.tsx
git commit -m "feat: cache statistics session automatically"
```

---

## Task 2: Simplificar o cabeçalho e fixar a barra lateral

**Files:**

- Modify: `src/routes/estatistica/EstatisticaPage.test.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.tsx`
- Modify: `src/routes/estatistica/Sidebar.test.tsx`
- Modify: `src/routes/estatistica/Sidebar.tsx`
- Delete: `src/routes/estatistica/PortalDatasusLink.tsx`

- [ ] **Step 1: Escrever testes vermelhos do cabeçalho simplificado**

Adicionar em `EstatisticaPage.test.tsx`:

```tsx
it('does not expose the DATASUS shortcut in the statistics header', () => {
  renderPage();

  expect(screen.queryByRole('link', { name: /Portal DATASUS/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Escrever o teste vermelho da geometria sticky**

Adicionar em `Sidebar.test.tsx`:

```tsx
it('stays below the app header while only the test list scrolls', () => {
  renderSidebar();

  const sidebar = screen.getByRole('complementary', { name: 'Testes disponíveis' });
  const list = screen.getByRole('navigation', { name: 'Lista de testes' });
  expect(sidebar).toHaveClass('sticky', 'top-16', 'self-start', 'h-[calc(100dvh-4rem)]');
  expect(sidebar).toHaveClass('overflow-hidden');
  expect(list).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
});
```

- [ ] **Step 3: Rodar os testes focados e confirmar RED**

Run: `npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/routes/estatistica/Sidebar.test.tsx`

Expected: FAIL pela presença do link DATASUS e ausência das classes sticky/altura.

- [ ] **Step 4: Remover controles do cabeçalho e componente DATASUS**

Em `EstatisticaPage.tsx`, apagar os imports e substituir o wrapper do cabeçalho por:

```tsx
<div className="mb-6">
  <h1 className="font-sans text-display font-bold text-text">{pageTitle}</h1>
</div>
```

Excluir `PortalDatasusLink.tsx`. Confirmar que `SessionPersistenceControl.tsx` já foi excluído na Task 1.

- [ ] **Step 5: Aplicar viewport e scroll interno ao Sidebar**

Adicionar ao `<aside>` as classes estruturais:

```tsx
'sticky top-16 h-[calc(100dvh-4rem)] self-start'
```

Manter `overflow-hidden` no `aside`, blocos de topo com `shrink-0` e `overflow-y-auto` apenas no `<nav>`. Não mudar o colapso automático em `max-width: 980px`.

- [ ] **Step 6: Rodar testes e commit local**

Run: `npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/routes/estatistica/Sidebar.test.tsx`

Run: `npm run typecheck`

```bash
git add src/routes/estatistica/EstatisticaPage.tsx src/routes/estatistica/EstatisticaPage.test.tsx src/routes/estatistica/Sidebar.tsx src/routes/estatistica/Sidebar.test.tsx src/routes/estatistica/PortalDatasusLink.tsx
git commit -m "feat: simplify statistics shell and pin test list"
```

---

## Task 3: Criar relatório copiável e cartão compartilhado de métrica

**Files:**

- Create: `src/routes/estatistica/resultReport.ts`
- Create: `src/routes/estatistica/resultReport.test.ts`
- Create: `src/routes/estatistica/ResultMetricCard.tsx`
- Create: `src/routes/estatistica/CopyResultsButton.tsx`
- Modify: `src/routes/estatistica/ResultsPanel.tsx`
- Modify: `src/routes/estatistica/ResultsPanel.test.tsx`
- Modify: `src/shared/charts/ResultsPanelWithCustomizer.tsx`
- Modify: `src/shared/charts/ResultsPanelWithCustomizer.test.tsx`

- [ ] **Step 1: Escrever o teste vermelho do formatador puro**

Criar `resultReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatResultReport } from './resultReport';

describe('formatResultReport', () => {
  it('copies title, metric details and every interpretation paragraph in order', () => {
    const report = formatResultReport(
      't de Student: resultados',
      [
        { label: 'Média de Grupo A', value: '4,90', hint: 'n = 7 · desvio-padrão = 0,22' },
        { label: 'Diferença entre médias', value: '-1,10', hint: 'IC95%: -1,35 a -0,85' },
      ],
      ['Observou-se diferença entre os grupos.', 'O efeito foi muito grande.'],
    );

    expect(report).toBe([
      't de Student: resultados',
      '',
      'Resultados',
      'Média de Grupo A: 4,90',
      'n = 7 · desvio-padrão = 0,22',
      '',
      'Diferença entre médias: -1,10',
      'IC95%: -1,35 a -0,85',
      '',
      'Interpretação',
      'Observou-se diferença entre os grupos.',
      '',
      'O efeito foi muito grande.',
    ].join('\n'));
    expect(report).not.toContain('linha bruta');
  });
});
```

- [ ] **Step 2: Escrever testes vermelhos dos painéis e clipboard**

Em ambos os testes de painel, renderizar ao menos uma métrica e exigir um cartão alcançável:

```tsx
const metricCard = screen.getByRole('article', { name: 'Média de Grupo A' });
expect(metricCard).toHaveAttribute('tabindex', '0');
expect(metricCard).toHaveClass('lacir-result-metric');
```

No `ResultsPanel.test.tsx`, mockar `navigator.clipboard.writeText` e testar:

```tsx
await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));
expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Interpretação'));
expect(writeText).toHaveBeenCalledWith(expect.not.stringContaining('A;4,9'));
expect(screen.getByRole('status')).toHaveTextContent('Copiado');
```

Adicionar um caso em que Clipboard API e fallback falham e verificar `role="alert"` com nova tentativa possível.

- [ ] **Step 3: Rodar testes e confirmar RED**

Run: `npx vitest run src/routes/estatistica/resultReport.test.ts src/routes/estatistica/ResultsPanel.test.tsx src/shared/charts/ResultsPanelWithCustomizer.test.tsx`

Expected: FAIL porque formatador, cartão e botão ainda não existem.

- [ ] **Step 4: Implementar o formatador determinístico e a cópia local**

Definir e exportar `ResultMetric` em `ResultMetricCard.tsx`. Em `ResultsPanel.tsx`, reexportar esse tipo para manter os imports atuais do painel customizável sem criar dependência circular. Em `resultReport.ts`, importar o tipo diretamente de `ResultMetricCard.tsx` e exportar:

```ts
export function formatResultReport(
  title: string,
  metrics: readonly ResultMetric[],
  interpretation: readonly string[],
): string {
  const metricBlocks = metrics.map(({ label, value, hint }) =>
    [`${label}: ${value}`, hint].filter(Boolean).join('\n'),
  );
  return [
    title,
    '',
    'Resultados',
    metricBlocks.join('\n\n'),
    '',
    'Interpretação',
    interpretation.join('\n\n'),
  ].join('\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue into the local textarea fallback.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('clipboard unavailable');
}
```

Se a Clipboard API existir mas rejeitar, tentar o fallback antes de propagar o erro. Sempre remover o `textarea` em `finally`.

- [ ] **Step 5: Implementar as primitivas compartilhadas**

`ResultMetricCard.tsx` deve renderizar:

```tsx
<article
  aria-label={metric.label}
  tabIndex={0}
  className="lacir-result-metric rounded-lg border border-border bg-[var(--color-surface)] px-4 py-3"
>
  <p className="text-sm font-bold text-muted-foreground">{metric.label}</p>
  <p className="mt-1 text-[20px] font-bold leading-tight text-foreground">{metric.value}</p>
  {metric.hint ? <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p> : null}
</article>
```

`CopyResultsButton.tsx` recebe somente `{ title, metrics, interpretation }`, monta o texto no clique, usa `copyTextToClipboard`, mostra `Copiado` por cerca de dois segundos em uma região `role="status"`, limpa o timer no unmount e mostra falha em `role="alert"` sem desabilitar o botão.

- [ ] **Step 6: Integrar nos dois painéis sem duplicar regras**

Nos dois arquivos:

- substituir o JSX duplicado das métricas por `<ResultMetricCard key={metric.label} metric={metric} />`;
- adicionar `<CopyResultsButton title={title} metrics={metrics} interpretation={interpretation} />` no fim da barra de ações;
- preservar o download PNG e `actions` existentes;
- no painel customizável, garantir que o botão venha depois de "Baixar todos" e das ações específicas, sendo visualmente a última ação geral.

- [ ] **Step 7: Rodar testes, typecheck e commit local**

Run: `npx vitest run src/routes/estatistica/resultReport.test.ts src/routes/estatistica/ResultsPanel.test.tsx src/shared/charts/ResultsPanelWithCustomizer.test.tsx`

Run: `npm run typecheck`

```bash
git add src/routes/estatistica/resultReport.ts src/routes/estatistica/resultReport.test.ts src/routes/estatistica/ResultMetricCard.tsx src/routes/estatistica/CopyResultsButton.tsx src/routes/estatistica/ResultsPanel.tsx src/routes/estatistica/ResultsPanel.test.tsx src/shared/charts/ResultsPanelWithCustomizer.tsx src/shared/charts/ResultsPanelWithCustomizer.test.tsx
git commit -m "feat: add interactive and copyable result summaries"
```

---

## Task 4: Adicionar hover/foco seguro a métricas e gráficos

**Files:**

- Modify: `src/app/theme.css`
- Modify: `src/routes/estatistica/ResultsPanel.tsx`
- Modify: `src/routes/estatistica/ResultsPanel.test.tsx`
- Modify: `src/shared/charts/ResultsPanelWithCustomizer.tsx`
- Modify: `src/shared/charts/ResultsPanelWithCustomizer.test.tsx`

- [ ] **Step 1: Escrever testes vermelhos do invólucro visual**

No painel simples, verificar que cada gráfico está dentro de um cartão/foco separado do canvas:

```tsx
const chart = screen.getByRole('img', { name: 'Médias por grupo' });
const chartCard = chart.closest('.lacir-chart-card');
expect(chartCard).toHaveAttribute('tabindex', '0');
expect(chart.closest('.lacir-chart-focus')).not.toBeNull();
```

No painel customizável, acrescentar a mesma asserção ao gráfico principal e confirmar que os botões Editar, Ampliar e Baixar continuam dentro do cartão.

- [ ] **Step 2: Confirmar RED no painel simples**

Run: `npx vitest run src/routes/estatistica/ResultsPanel.test.tsx src/shared/charts/ResultsPanelWithCustomizer.test.tsx`

Expected: FAIL no painel simples porque `lacir-chart-card` está hoje diretamente no `ChartCanvas`, sem `.lacir-chart-focus` intermediário, e no painel customizável porque o cartão ainda não é focável por si só.

- [ ] **Step 3: Separar cartão visual e canvas no painel simples**

Envolver o gráfico principal e os adicionais, sem mudar `onCanvasReady` nem o arquivo exportado:

```tsx
<article
  aria-label={`Gráfico: ${chart.ariaLabel}`}
  tabIndex={0}
  className="lacir-chart-card min-w-0"
>
  <div className="lacir-chart-focus">
    <ChartCanvas
      type={chart.type}
      data={chart.data}
      options={chart.options}
      ariaLabel={chart.ariaLabel}
      onCanvasReady={handleCanvasReady}
    />
  </div>
</article>
```

O painel customizável já usa essa divisão; adicionar as propriedades `tabIndex={0}` e `aria-label={\`Gráfico: ${displayChart.ariaLabel}\`}` ao `article` existente, mantendo seu contrato de classes e `data-chart-id`.

- [ ] **Step 4: Adicionar estados visuais no tema**

Acrescentar regras dentro da camada atual:

```css
.lacir-result-metric {
  transform: translateZ(0);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 180ms ease;
}

.lacir-result-metric:hover,
.lacir-result-metric:focus-visible {
  z-index: 2;
  border-color: color-mix(in srgb, var(--color-accent) 55%, var(--border));
  transform: scale(1.02);
  box-shadow: 0 10px 24px -16px rgba(15, 23, 42, 0.5);
  outline: none;
}

.lacir-chart-card:hover .lacir-chart-focus:not(.lacir-chart-focus--editing),
.lacir-chart-card:focus-within .lacir-chart-focus:not(.lacir-chart-focus--editing) {
  transform: scale(1.018);
  box-shadow: 0 12px 30px -20px rgba(15, 23, 42, 0.55);
}
```

Excluir `.lacir-chart-focus--editing` dos seletores genéricos com `:not(...)`, para que edição continue com sua escala/parallax. Não aplicar largura/altura ou transformação diretamente ao `<canvas>`.

Dentro de `prefers-reduced-motion: reduce`, incluir `.lacir-result-metric` nas transições desativadas e forçar:

```css
.lacir-result-metric:hover,
.lacir-result-metric:focus-visible,
.lacir-chart-card:hover .lacir-chart-focus:not(.lacir-chart-focus--editing),
.lacir-chart-card:focus-within .lacir-chart-focus:not(.lacir-chart-focus--editing) {
  transform: none;
}
```

- [ ] **Step 5: Rodar testes e commit local**

Run: `npx vitest run src/routes/estatistica/ResultsPanel.test.tsx src/shared/charts/ResultsPanelWithCustomizer.test.tsx`

Run: `npm run typecheck`

```bash
git add src/app/theme.css src/routes/estatistica/ResultsPanel.tsx src/routes/estatistica/ResultsPanel.test.tsx src/shared/charts/ResultsPanelWithCustomizer.tsx src/shared/charts/ResultsPanelWithCustomizer.test.tsx
git commit -m "feat: animate metric and chart focus states"
```

---

## Task 5: Remover a pergunta dos testes de comparação e correlação

**Files:**

- Modify: `src/routes/estatistica/EstatisticaPage.test.tsx`
- Modify: `src/features/tests/t-student/TStudentTest.tsx`
- Modify: `src/features/tests/t-student/TStudentConfigPanel.tsx`
- Modify: `src/features/tests/t-student/tStudentConfig.ts`
- Modify: `src/features/tests/t-student/tStudentInterpretation.ts`
- Modify: `src/features/tests/t-student/tStudentInterpretation.test.ts`
- Modify: `src/features/tests/t-student/TStudentTest.test.tsx`
- Modify: `src/features/tests/anova-tukey/AnovaTukeyTest.tsx`
- Modify: `src/features/tests/anova-tukey/AnovaConfigPanel.tsx`
- Modify: `src/features/tests/anova-tukey/anovaConfig.ts`
- Modify: `src/features/tests/anova-tukey/anovaInterpretation.ts`
- Modify: `src/features/tests/anova-tukey/anovaInterpretation.test.ts`
- Modify: `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx`
- Modify: `src/features/tests/kruskal-dunn/KruskalDunnTest.tsx`
- Modify: `src/features/tests/kruskal-dunn/KruskalConfigPanel.tsx`
- Modify: `src/features/tests/kruskal-dunn/kruskalConfig.ts`
- Modify: `src/features/tests/kruskal-dunn/kruskalInterpretation.ts`
- Modify: `src/features/tests/kruskal-dunn/kruskalInterpretation.test.ts`
- Modify: `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx`
- Modify: `src/features/tests/mann-whitney/MannWhitneyTest.tsx`
- Modify: `src/features/tests/mann-whitney/MannWhitneyConfigPanel.tsx`
- Modify: `src/features/tests/mann-whitney/mannWhitneyConfig.ts`
- Modify: `src/features/tests/mann-whitney/mannWhitneyInterpretation.ts`
- Create: `src/features/tests/mann-whitney/mannWhitneyInterpretation.test.ts`
- Modify: `src/features/tests/correlacao/CorrelacaoTest.tsx`
- Modify: `src/features/tests/correlacao/CorrelacaoConfigPanel.tsx`
- Modify: `src/features/tests/correlacao/correlacaoConfig.ts`
- Modify: `src/features/tests/correlacao/correlacaoInterpretation.ts`
- Modify: `src/features/tests/correlacao/correlacaoInterpretation.test.ts`
- Modify: `src/features/tests/correlacao/CorrelacaoTest.test.tsx`

- [ ] **Step 1: Escrever o teste de interface vermelho para os cinco módulos**

Em `EstatisticaPage.test.tsx`, usar a lista de IDs abaixo, selecionar cada teste e verificar que o campo não existe:

```tsx
it.each([
  ['t-student', /t de Student/i],
  ['anova-tukey', /ANOVA de uma via/i],
  ['kruskal-dunn', /Kruskal-Wallis/i],
  ['mann-whitney', /Mann–Whitney|Mann-Whitney/i],
  ['correlacao', /Correlação/i],
])('does not render a research-question field in %s', async (_id, accessibleName) => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage();
  await user.click(screen.getByRole('button', { name: accessibleName }));
  expect(screen.queryByRole('textbox', { name: 'Pergunta de pesquisa' })).not.toBeInTheDocument();
});
```

O caso `t-student` pode usar a tela inicial sem clicar para evitar ambiguidade com o heading.

- [ ] **Step 2: Tornar vermelhos os testes de interpretação**

Em cada teste unitário de interpretação, chamar o construtor sem pergunta e acrescentar:

```ts
expect(paragraphs.join(' ')).not.toContain('Pergunta analisada:');
```

Criar o teste dedicado ausente para Mann–Whitney com um resultado mínimo válido baseado nos fixtures do motor e a mesma asserção.

- [ ] **Step 3: Rodar os testes focados e confirmar RED**

Run: `npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/t-student/tStudentInterpretation.test.ts src/features/tests/anova-tukey/anovaInterpretation.test.ts src/features/tests/kruskal-dunn/kruskalInterpretation.test.ts src/features/tests/mann-whitney/mannWhitneyInterpretation.test.ts src/features/tests/correlacao/correlacaoInterpretation.test.ts`

Expected: FAIL porque os campos e o primeiro parágrafo ainda existem.

- [ ] **Step 4: Remover o fio `researchQuestion` de cada módulo**

Para cada um dos cinco diretórios:

1. remover `useState` da pergunta, seu setter e import de `MAX_RESEARCH_QUESTION_LENGTH` no componente `*Test.tsx`;
2. remover o argumento passado ao construtor de interpretação e a dependência do `useMemo`;
3. remover props `researchQuestion`/`onResearchQuestionChange`, import e JSX de `ResearchQuestionField` no `*ConfigPanel.tsx`;
4. remover `MAX_RESEARCH_QUESTION_LENGTH` e `defaultQuestion` do config apenas quando `rg` confirmar que ficaram sem consumidor;
5. remover o parâmetro de pergunta, variável `trimmedQuestion`/default e o parágrafo `Pergunta analisada` do construtor de interpretação.

Para t de Student, preservar a distinção pareado/independente na conclusão; remover apenas o `defaultQuestion` local. Para correlação, aplicar a remoção aos dois ramos (dados insuficientes e resultado válido). Para Mann–Whitney, não alterar validação de exatamente dois grupos independentes.

- [ ] **Step 5: Atualizar testes de integração que usavam a frase como seletor**

Em `TStudentTest.test.tsx`, `AnovaTukeyTest.test.tsx`, `KruskalDunnTest.test.tsx` e `CorrelacaoTest.test.tsx`, trocar regex que incluem `Pergunta analisada` por conclusões reais já exibidas e acrescentar:

```tsx
expect(screen.queryByText(/Pergunta analisada:/i)).not.toBeInTheDocument();
```

- [ ] **Step 6: Rodar conjunto focado, typecheck e commit local**

Run: `npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/t-student src/features/tests/anova-tukey src/features/tests/kruskal-dunn src/features/tests/mann-whitney src/features/tests/correlacao`

Run: `npm run typecheck`

```bash
git add src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/t-student src/features/tests/anova-tukey src/features/tests/kruskal-dunn src/features/tests/mann-whitney src/features/tests/correlacao
git commit -m "refactor: remove research question from comparison tests"
```

---

## Task 6: Remover a pergunta dos testes temporais, categóricos e de regressão

**Files:**

- Modify: `src/routes/estatistica/EstatisticaPage.test.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenConfigPanel.tsx`
- Modify: `src/features/tests/prais-winsten/praisConfig.ts`
- Modify: `src/features/tests/prais-winsten/praisInterpretation.ts`
- Modify: `src/features/tests/prais-winsten/praisInterpretation.test.ts`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoTest.tsx`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoConfigPanel.tsx`
- Modify: `src/features/tests/qui-quadrado/quiQuadradoConfig.ts`
- Modify: `src/features/tests/qui-quadrado/quiQuadradoInterpretation.ts`
- Modify: `src/features/tests/qui-quadrado/quiQuadradoInterpretation.test.ts`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx`
- Modify: `src/features/tests/poisson/PoissonTest.tsx`
- Modify: `src/features/tests/poisson/PoissonConfigPanel.tsx`
- Modify: `src/features/tests/poisson/poissonConfig.ts`
- Modify: `src/features/tests/poisson/poissonInterpretation.ts`
- Modify: `src/features/tests/poisson/poissonInterpretation.test.ts`
- Modify: `src/features/tests/poisson/PoissonTest.test.tsx`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaTest.tsx`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaConfigPanel.tsx`
- Modify: `src/features/tests/binomial-negativa/binomialNegativaConfig.ts`
- Modify: `src/features/tests/binomial-negativa/binomialNegativaInterpretation.ts`
- Modify: `src/features/tests/binomial-negativa/binomialNegativaInterpretation.test.ts`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx`
- Modify: `src/features/tests/logistica/LogisticaTest.tsx`
- Modify: `src/features/tests/logistica/LogisticaConfigPanel.tsx`
- Modify: `src/features/tests/logistica/logisticaConfig.ts`
- Modify: `src/features/tests/logistica/logisticaInterpretation.ts`
- Modify: `src/features/tests/logistica/logisticaInterpretation.test.ts`
- Delete: `src/features/tests/shared/ResearchQuestionField.tsx`

- [ ] **Step 1: Estender os testes vermelhos aos cinco módulos restantes**

Adicionar ao `it.each` da Task 5:

```tsx
['prais-winsten', /Prais–Winsten|Prais-Winsten/i],
['qui-quadrado', /Qui-quadrado/i],
['poisson', /Regressão de Poisson/i],
['binomial-negativa', /Regressão Binomial Negativa/i],
['logistica', /Regressão Logística/i],
```

Atualizar os cinco testes unitários de interpretação para exigir ausência de `Pergunta analisada:`.

- [ ] **Step 2: Rodar testes e confirmar RED**

Run: `npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/prais-winsten/praisInterpretation.test.ts src/features/tests/qui-quadrado/quiQuadradoInterpretation.test.ts src/features/tests/poisson/poissonInterpretation.test.ts src/features/tests/binomial-negativa/binomialNegativaInterpretation.test.ts src/features/tests/logistica/logisticaInterpretation.test.ts`

Expected: FAIL pelos campos e parágrafos ainda presentes.

- [ ] **Step 3: Remover o fio da pergunta nos cinco módulos**

Aplicar os mesmos cinco passos mecânicos da Task 5. Cuidados específicos:

- Prais–Winsten: remover `researchQuestion` e `DEFAULT_CONTEXT` apenas do texto; preservar a descrição temporal baseada em indicador, período, APC e tendência.
- Qui-quadrado: preservar rótulos das variáveis e interpretação da associação.
- Poisson, binomial negativa e logística: preservar mensagens sobre associação, estimativas, intervalos, dispersão/eventos raros e alertas de adequação.
- Excluir `ResearchQuestionField.tsx` somente depois que o `rg` final confirmar zero imports.

- [ ] **Step 4: Atualizar seletores de integração**

Em `QuiQuadradoTest.test.tsx`, `PoissonTest.test.tsx` e `BinomialNegativaTest.test.tsx`, remover `Pergunta analisada` das regex usadas para encontrar prosa e testar explicitamente sua ausência. Fazer a mesma alteração em qualquer teste de Prais–Winsten ou logística encontrado pelo `rg`.

- [ ] **Step 5: Executar auditoria textual do contrato removido**

Run:

```bash
rg -n "Pergunta de pesquisa|Pergunta analisada|ResearchQuestionField|researchQuestion|MAX_RESEARCH_QUESTION_LENGTH" src --glob '!**/*.test.*'
```

Expected: exit 1 / nenhum resultado. O termo `defaultQuestion` pode permanecer apenas se tiver função fora do campo removido; validar cada ocorrência restante com `rg -n "defaultQuestion" src/features/tests`.

- [ ] **Step 6: Rodar conjunto focado, typecheck e commit local**

Run: `npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/prais-winsten src/features/tests/qui-quadrado src/features/tests/poisson src/features/tests/binomial-negativa src/features/tests/logistica`

Run: `npm run typecheck`

```bash
git add src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/prais-winsten src/features/tests/qui-quadrado src/features/tests/poisson src/features/tests/binomial-negativa src/features/tests/logistica src/features/tests/shared/ResearchQuestionField.tsx
git commit -m "refactor: remove research question from remaining tests"
```

---

## Task 7: Verificar regressões e fazer QA local no navegador

**Files:**

- Modify only if a failing verification reveals an in-scope defect.

- [ ] **Step 1: Fazer varreduras estáticas de escopo**

Run:

```bash
rg -n "Portal DATASUS|Lembrar neste dispositivo|Salvo neste dispositivo|Pergunta de pesquisa|Pergunta analisada|ResearchQuestionField|setPersistenceEnabled|persistenceEnabled" src --glob '!**/*.test.*'
```

Expected: nenhum resultado.

Run: `git status --short --branch`

Expected: branch `codex/results-interactions`, sem mudanças inesperadas.

- [ ] **Step 2: Rodar a bateria direcionada de regressão**

Run:

```bash
npx vitest run \
  src/shared/session/SessionPersistence.test.tsx \
  src/routes/estatistica/EstatisticaPage.test.tsx \
  src/routes/estatistica/Sidebar.test.tsx \
  src/routes/estatistica/resultReport.test.ts \
  src/routes/estatistica/ResultsPanel.test.tsx \
  src/shared/charts/ResultsPanelWithCustomizer.test.tsx \
  src/features/tests/t-student \
  src/features/tests/anova-tukey \
  src/features/tests/kruskal-dunn \
  src/features/tests/mann-whitney \
  src/features/tests/correlacao \
  src/features/tests/prais-winsten \
  src/features/tests/qui-quadrado \
  src/features/tests/poisson \
  src/features/tests/binomial-negativa \
  src/features/tests/logistica
```

Expected: PASS.

- [ ] **Step 3: Rodar o gate completo**

Run: `npm run gate`

Expected: catálogo, pipeline Python, Vitest, TypeScript e build Vite passam. Aviso de tamanho de bundle já conhecido não é falha.

- [ ] **Step 4: Iniciar ou confirmar o servidor local**

Run: `npm run dev -- --host 127.0.0.1`

Se a porta padrão estiver ocupada pelo servidor desta mesma workspace, usar a URL informada por ele em vez de iniciar uma segunda instância. Não executar script de deploy.

- [ ] **Step 5: Fazer QA visual e funcional em uma aba local separada**

Abrir a URL local, sem substituir a aba ambiente do GitHub Pages, e verificar em 1440×1000 e 390×844:

1. cabeçalho sem Portal DATASUS e sem painel de persistência;
2. barra lateral fica visível durante scroll longo e a lista rola por dentro;
3. todos os dez testes abrem sem campo de pergunta;
4. exemplo de t de Student produz os valores esperados, métricas crescem no hover e recebem foco pelo teclado;
5. gráfico cresce discretamente sem recorte e seus tooltips/Editar/Ampliar/Baixar continuam utilizáveis;
6. `Copiar tudo` produz título, resultados e interpretação, sem a tabela bruta;
7. Mann–Whitney executa com exatamente dois grupos independentes válidos;
8. recarregar a aba restaura automaticamente tabela, bindings e preferências;
9. limpar dados remove a sessão restaurável, e uma alteração posterior volta a ser cacheada;
10. emulação de movimento reduzido elimina escalas animadas.

- [ ] **Step 6: Corrigir somente defeitos encontrados e repetir os testes afetados**

Para cada falha, adicionar/reter um teste de regressão, aplicar a menor correção e repetir o comando focado antes do gate final.

- [ ] **Step 7: Fazer a verificação final e registrar estado local**

Run: `npm run gate`

Run: `git status --short --branch`

Run: `git log --oneline -8`

Expected: gate verde; branch local `codex/results-interactions`; nenhum push, PR ou deploy. Se os ajustes de QA criarem mudanças, fazer um último commit local:

Depois de conferir `git status --short`, adicionar individualmente somente os arquivos realmente corrigidos e executar `git commit -m "fix: polish local statistics interactions"`.

Entregar ao usuário a URL local de `npm run dev`, resumo dos comportamentos validados e confirmação explícita de que o GitHub Pages não foi alterado.
