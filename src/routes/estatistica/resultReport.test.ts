import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard, formatResultReport } from './resultReport';

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

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('restores focus to the previously active element after a successful fallback copy', async () => {
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    const execCommandSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.appendChild(trigger);
    trigger.focus();

    await copyTextToClipboard('resultado');

    expect(execCommandSpy).toHaveBeenCalledWith('copy');
    expect(document.activeElement).toBe(trigger);
  });

  it('restores focus to the previously active element after a failed fallback copy', async () => {
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    const execCommandSpy = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.appendChild(trigger);
    trigger.focus();

    await expect(copyTextToClipboard('resultado')).rejects.toThrow('clipboard unavailable');

    expect(execCommandSpy).toHaveBeenCalledWith('copy');
    expect(document.activeElement).toBe(trigger);
  });
});
