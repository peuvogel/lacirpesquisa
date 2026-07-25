---
status: testing
phase: 01-redesign-base-react-shell
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md, 01-07-SUMMARY.md, 01-08-SUMMARY.md, 01-09-SUMMARY.md, 01-10-SUMMARY.md, 01-11-SUMMARY.md, 01-12-SUMMARY.md
started: 2026-07-25T18:15:29Z
updated: 2026-07-25T18:20:40Z
---

## Current Test

number: 4
name: Teste Demo End-to-End
expected: |
  Complete Teste demo through Dados → Configurar → Resultados using sample data (or a paste). Chart renders, Portuguese interpretation under "O que isso significa?" reads naturally, and "Baixar gráfico (PNG)" saves a real PNG (not blank/0-byte) with dark background and teal series.
awaiting: user response


## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. From the project root, run `npm run dev` and open the app URL. The Vite React shell boots without errors (no white flash of legacy HTML, no console crash). Landing page loads on Estatística with live UI (header, logo, content) — not a blank page.
result: pass

### 2. Portal Shell & Navigation
expected: App lands on Estatística with dark background (#0a0f0d), teal (#10b981) active nav underline, LACIR logo + wordmark, and header nav Estatística | Meta-análise | Variáveis | Mapas (no version badge). Clicking each nav item renders its own layout with a short route-entry fade and no full page reload. "Portal DATASUS ↗" appears only inside Estatística.
result: pass

### 3. Responsive Sidebar Collapse
expected: On Estatística, resize the browser below ~980px. The test sidebar collapses and re-expands via the toggle without overlapping the main content.
result: pass

### 4. Teste Demo End-to-End
expected: Complete Teste demo through Dados → Configurar → Resultados using sample data (or a paste). Chart renders, Portuguese interpretation under "O que isso significa?" reads naturally, and "Baixar gráfico (PNG)" saves a real PNG (not blank/0-byte) with dark background and teal series.
result: [pending]

### 5. TABNET Paste Auto-Detect
expected: Paste a real TABNET dump from DataSUS into the Dados textarea. Columns auto-detect, preview looks correct, and confirming advances to Configurar. Invalid paste shows a friendly error with expandable "Ver detalhes".
result: [pending]

### 6. Assistente DATASUS Wizard
expected: Open Assistente DATASUS and walk all six steps (Passo n de 6) with a multi-source TABNET export — header correction, role mapping, normalized preview. Wizard behaves like the v1.0 assistant and can hand off into the analysis flow.
result: [pending]

### 7. Mapas Hover, Lock & Keyboard
expected: On /mapas — hover several states (side panel follows), click two states with different variable availability (intersection listed first; "Não existe em …" names the correct states), Tab to a state and press Enter to select. Empty state copy shows when nothing is hovered/selected.
result: [pending]

### 8. Mapas → Estatística Handoff
expected: On /mapas select two states and a variable, click "Iniciar pesquisa", follow a collection link, paste a table into the modal, click "Continuar para Estatística". Land on Estatística with pasted data on the Configurar step (session hydrated from Mapas handoff).
result: [pending]

### 9. Leave Warning & Limpar Dados
expected: With data on Estatística, press Cmd/Ctrl+R — native leave prompt appears; cancel stays. Navigate to Mapas and refresh — no prompt. Return to Estatística with no data and refresh — no prompt. Use "Limpar dados" (confirm "Sim, limpar") — returns to Dados; next refresh has no prompt. No persistent refresh banner anywhere.
result: [pending]

### 10. Qual Teste Usar? Modal
expected: Open "Qual teste usar?" — walk the decision tree, confirm the roadmap lists tests with "Em breve" chips for unavailable ones and only "Teste demo" is navigable ("Disponível"). Closing with Escape/overlay returns focus to the trigger.
result: [pending]

## Summary

total: 10
passed: 3
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
