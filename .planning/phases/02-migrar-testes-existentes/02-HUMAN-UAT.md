---
status: partial
phase: 02-migrar-testes-existentes
source: [02-VERIFICATION.md]
started: 2026-07-25T19:41:56Z
updated: 2026-07-25T19:41:56Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Chart visual parity vs v1.0
expected: Chart type, series, axis labels, and annotation overlays match v1.0 screenshots for t-Student, Correlação scatter, and Prais trend/residual charts (use exemplo data on each migrated test).
result: [pending]

### 2. PNG export after ChartCustomizer changes
expected: Customize chart (type/theme/axis/annotation) → Baixar gráfico (PNG) → downloaded file shows current customization, not pre-change state (all three tests). Note WR-02 debounce window (~150ms).
result: [pending]

### 3. Didactic Configurar UX
expected: Each test's Configurar step reads naturally in PT; Usar exemplo, mode/method cards, α selector, and soft-reset on mode/method change behave as documented.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

[none yet]
