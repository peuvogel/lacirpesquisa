# TABNET fixtures

Real-world-shaped messy TABNET/DataSUS paste samples used by the differential
parity suites in `src/shared/data-input/*.test.ts`. The `.txt` files themselves
are kept byte-faithful to what a user would actually paste — no comments are
embedded inside them, hence this sibling README.

No genuine raw TABNET export (with metadata rows, footnotes, and `;`/tab
delimiters) was found under `trabalhos datasus/` — every export there had
already been cleaned by the `coleta_*` scripts (comma-delimited, decimal
points, no metadata rows). These three fixtures were therefore hand-authored
to match real TABNET/DataSUS export conventions (title/período/situação
preamble lines, `;` delimiter, pt-BR thousands-dot + decimal-comma numbers,
a trailing "Total" row, and a "Fonte:" footnote) rather than derived from a
captured file.

- **`tabnet-semicolon-metadata.txt`** — 3 metadata/title lines before the real
  header row, `;` delimiter, pt-BR decimal commas including the
  thousands-vs-decimal ambiguity (`1.234.567,89`), a "Total" row, and a
  "Fonte:" footnote line at the end. Exercises header-row scoring past
  leading metadata and `normalizeNumericSource`'s thousands/decimal
  disambiguation.

- **`tabnet-tab-mojibake.txt`** — tab-delimited, with the four column labels
  stored in mojibake form (UTF-8 bytes misread as Latin-1, e.g. `MunicÃ­pio`
  for "Município"). Exercises `repairMojibake`/`normalizeImportedText` in
  `legacyAdapters.ts`.

- **`tabnet-comma-ambiguous.txt`** — comma-delimited, where the "Taxa por
  100k" column's decimal-comma values (`12,5`, `8,75`, `15,2`) sit directly
  between two column-separating commas. This is exactly the
  `structuralCommaCount` digit-adjacency case: a comma with a digit on both
  sides is treated as part of a number, not a field delimiter.
