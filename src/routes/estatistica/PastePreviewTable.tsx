import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { COLUMN_ROLE_OPTIONS } from '@/shared/data-input/columnRoles';
import { suggestColumnType } from '@/shared/data-input/tableDocument';

/** Quantas linhas cabem sem a caixa de colar virar uma segunda tabela. */
const DEFAULT_MAX_ROWS = 5;

export interface PastePreviewTableProps {
  headers: string[];
  bodyRows: string[][];
  maxRows?: number;
}

/**
 * Confirmação imediata do que foi colado: as primeiras linhas já como tabela,
 * dentro da própria caixa de dados.
 *
 * Só leitura, de propósito — quem edita, escolhe tipos e apaga linhas é a
 * `ColumnPreviewTable` do passo Configurar. Aqui a pergunta é uma só: "os
 * dados entraram nas colunas certas?".
 */
export function PastePreviewTable({
  headers,
  bodyRows,
  maxRows = DEFAULT_MAX_ROWS,
}: PastePreviewTableProps) {
  // Mesma detecção que alimenta a prévia grande e o tipo inicial do documento:
  // o que se vê aqui é o que o passo seguinte vai encontrar.
  const types = useMemo(
    () => headers.map((_, index) => suggestColumnType(index, bodyRows)),
    [headers, bodyRows],
  );

  if (!headers.length) return null;

  const rows = bodyRows.slice(0, maxRows);

  return (
    <div aria-label="Prévia dos dados colados" role="group" className="px-3 py-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {headers.map((header, index) => {
                const option = COLUMN_ROLE_OPTIONS.find((item) => item.value === types[index]);
                return (
                  <th
                    key={`${header}-${index}`}
                    scope="col"
                    className="border-b border-border px-2 py-1 align-bottom"
                  >
                    <span className="block truncate text-xs font-bold text-foreground">
                      {header || `Coluna ${index + 1}`}
                    </span>
                    <span className={cn('block text-[0.6875rem]', option?.className)}>
                      {option?.label ?? types[index]}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="whitespace-nowrap px-2 py-1 font-mono text-xs text-muted-foreground"
                  >
                    {row[columnIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Mostrando {rows.length} de {bodyRows.length}{' '}
        {bodyRows.length === 1 ? 'linha' : 'linhas'} · {headers.length}{' '}
        {headers.length === 1 ? 'coluna' : 'colunas'}
      </p>
    </div>
  );
}
