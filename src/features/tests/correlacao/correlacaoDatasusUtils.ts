import type { DatasusPublicSource } from '@/shared/data-input/useDatasusWizard';
import type { DatasusSource } from '@/shared/data-input/types';

/** Minimal DatasusSource for derive* helpers when only normalized preview is available. */
export function datasusSourceFromPublic(publicSource: DatasusPublicSource): DatasusSource {
  return {
    id: publicSource.id,
    fileName: publicSource.fileName,
    rawText: '',
    parsed: {
      ok: true,
      fileName: publicSource.fileName,
      rawText: '',
      lines: [],
      delimiter: ';',
      headerCandidates: [],
      headerRowIndex: 0,
      headers: [],
      rowMatrix: [],
      bodyRows: [],
      columnProfiles: [],
      diagnosis: publicSource.diagnosis ?? ({
        delimiter: ';',
        delimiterLabel: 'Ponto e vírgula',
        headerRowIndex: 0,
        metadataLines: [],
        formatType: 'wide',
        primaryCategoryIndex: 0,
        primaryCategoryLabel: 'Categoria',
        timeColumnIndices: [],
        timeLabels: [],
        measureColumnIndices: [],
        measureLabels: [],
        totalColumnIndices: [],
        hasTotalColumn: false,
        totalRowCount: 0,
        summaryText: '',
      } as DatasusSource['parsed'] extends { diagnosis: infer D } ? D : never),
      initialMapping: publicSource.mapping ?? {
        headerRowIndex: 0,
        formatType: 'wide',
        columns: [],
        excludeTotalByDefault: true,
      },
    },
    mapping:
      publicSource.mapping ?? {
        headerRowIndex: 0,
        formatType: 'wide',
        columns: [],
        excludeTotalByDefault: true,
      },
    confirmed: true,
    normalized: publicSource.normalized,
  };
}

export function datasusSourcesFromSession(
  session: { confirmedSources: DatasusPublicSource[] },
): DatasusSource[] {
  return session.confirmedSources.map(datasusSourceFromPublic);
}
