import { DATASUS_COLUMN_ROLES } from '@/shared/data-input/useDatasusWizard';
import type { DatasusSource } from '@/shared/data-input/types';

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-data)',
  lineHeight: 'var(--text-data--line-height)',
} as const;

export interface DatasusMappingTableProps {
  source: DatasusSource;
  onRoleChange: (columnIndex: number, role: string) => void;
}

export function DatasusMappingTable({ source, onRoleChange }: DatasusMappingTableProps) {
  const parsed = source.parsed?.ok ? source.parsed : null;
  if (!parsed || !source.mapping) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" style={monoStyle}>
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-bold">Coluna</th>
            <th className="px-3 py-2 font-bold">Amostra</th>
            <th className="px-3 py-2 font-bold">Papel</th>
          </tr>
        </thead>
        <tbody>
          {parsed.columnProfiles.map((profile) => {
            const mapped =
              source.mapping!.columns.find((column) => column.index === profile.index) ?? {
                index: profile.index,
                header: profile.header,
                role: profile.suggestedRole,
                variableType: profile.suggestedType,
              };
            const sample = profile.sampleValues.length ? profile.sampleValues.join(' | ') : 'Sem amostra';

            return (
              <tr key={profile.index} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">
                  <strong>{profile.header}</strong>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{sample}</td>
                <td className="px-3 py-2">
                  <label className="sr-only" htmlFor={`role-${source.id}-${profile.index}`}>
                    Papel da coluna {profile.header}
                  </label>
                  <select
                    id={`role-${source.id}-${profile.index}`}
                    aria-label={`Papel da coluna ${profile.header}`}
                    value={mapped.role}
                    onChange={(event) => onRoleChange(profile.index, event.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1"
                  >
                    {DATASUS_COLUMN_ROLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
