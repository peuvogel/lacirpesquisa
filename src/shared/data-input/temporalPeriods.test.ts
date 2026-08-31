import { describe, expect, it } from 'vitest';
import { detectTemporalColumn } from './temporalPeriods';

const semesters = [
  '2021.1', '2021.2', '2022.1', '2022.2',
  '2023.1', '2023.2', '2024.1', '2024.2',
  '2025.1', '2025.2', '2026.1', '2026.2',
];

describe('detectTemporalColumn', () => {
  it('detects decimal-looking semester labels across year rollover', () => {
    const result = detectTemporalColumn(semesters, 'Semestre');

    expect(result.status).toBe('resolved');
    expect(result.frequency).toBe('semiannual');
    expect(result.effectBasis).toBe('annualized');
    expect(result.values.map((item) => item?.periodIndex)).toEqual(
      Array.from({ length: 12 }, (_, index) => 4042 + index),
    );
    expect(result.values[1]?.coordinate).toBe(2021.5);
    expect(result.values[2]?.coordinate).toBe(2022);
    expect(result.issues).toEqual([]);
  });

  it('keeps a lone generic decimal series ambiguous', () => {
    const result = detectTemporalColumn(['2021.1', '2022.1'], 'Tempo');

    expect(result.status).toBe('ambiguous');
    expect(result.issues[0]?.code).toBe('ambiguous_frequency');
  });

  it.each([
    [['2022', '2023'], 'Ano', 'annual'],
    [['2024-S1', '2024-S2'], 'Semestre', 'semiannual'],
    [['T1 2024', '2024-T2'], 'Trimestre', 'quarterly'],
    [['2024-01', '02/2024'], 'Mês', 'monthly'],
    [['2024-01-01', '02/01/2024'], 'Data', 'daily'],
  ] as const)('recognizes %j as %s', (tokens, header, frequency) => {
    const result = detectTemporalColumn(tokens, header);

    expect(result.status).toBe('resolved');
    expect(result.frequency).toBe(frequency);
  });

  it('reports an exact missing semester', () => {
    const result = detectTemporalColumn(['2023.1', '2024.1', '2024.2'], 'Semestre');

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'missing_period',
      message: expect.stringContaining('2023.2'),
    }));
  });

  it('reports duplicate rows and mixed frequencies', () => {
    expect(detectTemporalColumn(['2024-S1', '2024-S1'], 'Semestre').issues[0])
      .toMatchObject({ code: 'duplicate_period', rowNumbers: [1, 2] });
    expect(detectTemporalColumn(['2024-S1', '2024-Q2'], 'Período').issues)
      .toContainEqual(expect.objectContaining({ code: 'mixed_frequency' }));
  });

  it('uses original order only after an explicit order override', () => {
    const result = detectTemporalColumn(['onda B', 'onda A'], 'Onda', 'order');

    expect(result.values.map((item) => item?.coordinate)).toEqual([0, 1]);
    expect(result.values.map((item) => item?.label)).toEqual(['onda B', 'onda A']);
    expect(result.effectBasis).toBe('observed-interval');
  });

  it('recognizes consecutive month-end dates as monthly cadence', () => {
    const result = detectTemporalColumn(
      ['2024-01-31', '2024-02-29', '2024-03-31'],
      'Data',
    );

    expect(result.frequency).toBe('monthly');
    expect(result.issues).toEqual([]);
  });
});
