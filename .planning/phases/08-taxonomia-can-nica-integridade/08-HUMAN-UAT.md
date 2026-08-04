---
status: partial
phase: 08-taxonomia-can-nica-integridade
source: [08-VERIFICATION.md, 08-VALIDATION.md, 08-09-PLAN.md]
started: 2026-08-04T15:07:01Z
updated: 2026-08-04T15:07:01Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Busca por apelido clínico no seletor de agravos de Mapas (navegador real)

Único item que a verificação automatizada não pôde fechar. O plano 08-09 (Task 2) adiou
explicitamente o click-through literal para a varredura humana de fim de fase, seguindo o
padrão `human_verify_mode: end-of-phase` do projeto. Um teste-proxy em jsdom
(`MeasureDiseasePicker.test.tsx`) já digita no input real via `userEvent` e passa — o que
falta é a confirmação no navegador de verdade.

Como testar: `npm run dev`, abrir Mapas, e digitar cada termo no seletor de agravos.

expected:
- `AVC` → traz **4 categorias**: 177 Hemorragia intracraniana · 178 Infarto cerebral ·
  179 AVC não espec hemorrág ou isquêm · 180 Outras doenças cerebrovasculares
  (o escopo amplo foi decidido no checkpoint clínico da 08-07)
- `AIT` → traz **150 Acid vascular cerebr isquêm transit e síndr correl** (CID G45).
  Se trouxer 180 em vez de 150, a correção do checkpoint não chegou ao bundle
- `TVP` → traz 185 Flebite tromboflebite embolia e trombose venosa
- `varizes` → traz 186 Veias varicosas das extremidades inferiores
- `aterosclerose` → resolve apesar da grafia oficial ser `arteroesclerose` (prova do D-17)
- A tira explicativa do D-18 aparece quando a busca casa por apelido, explicando ao
  estudante por que aqueles agravos apareceram
- Nenhum apelido vira chave de dado: o que é selecionado são os ids canônicos, não o termo
  digitado

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
