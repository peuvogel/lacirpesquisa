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

  it('always emits both section headers and preserves empty interpretation paragraphs', () => {
    const report = formatResultReport(
      'Resumo',
      [],
      ['Primeiro parágrafo.', '', 'Terceiro parágrafo.'],
    );

    expect(report).toBe([
      'Resumo',
      '',
      'Resultados',
      '',
      '',
      'Interpretação',
      'Primeiro parágrafo.',
      '',
      '',
      '',
      'Terceiro parágrafo.',
    ].join('\n'));
  });

  it('keeps the full section structure even when metrics and interpretation are empty', () => {
    const report = formatResultReport('Resumo', [], []);

    expect(report).toBe([
      'Resumo',
      '',
      'Resultados',
      '',
      '',
      'Interpretação',
      '',
    ].join('\n'));
  });
});
