import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDivergenciaRazao } from '@/features/catalog/catalogAnalysisData';
import { SihDivergenceNote } from './SihDivergenceNote';

const VARIAVEL = 'sih.embolia_e_trombose_arteriais.internacoes';

describe('SihDivergenceNote', () => {
  it('não renderiza nada quando não há razão — "quando houver", nunca caixa vazia', () => {
    const { container: semRazao } = render(<SihDivergenceNote razao={null} />);
    expect(semRazao).toBeEmptyDOMElement();

    const { container: indefinido } = render(<SihDivergenceNote razao={undefined} />);
    expect(indefinido).toBeEmptyDOMElement();

    const { container: vazio } = render(<SihDivergenceNote razao="" />);
    expect(vazio).toBeEmptyDOMElement();
  });

  it('mostra a razão junto de um rótulo que diz ao aluno do que se trata', () => {
    render(<SihDivergenceNote razao="Contado pela data de internação." />);
    expect(screen.getByText(/Por que difere do TabNet/)).toBeInTheDocument();
    expect(screen.getByText(/Contado pela data de internação\./)).toBeInTheDocument();
  });
});

describe('getDivergenciaRazao', () => {
  it('lê a razão do pack — o texto vem do banco, nunca digitado no front', () => {
    const razao = getDivergenciaRazao(VARIAVEL);
    expect(razao).toBeTruthy();
    // As duas ideias que a frase precisa carregar para o aluno conseguir reproduzir a diferença:
    // qual é a nossa chave de contagem, e o que a consulta padrão do TabNet deixa de fora.
    expect(razao).toMatch(/data de interna/i);
    expect(razao).toMatch(/TabNet/);
  });

  it('devolve null para variável fora do catálogo, em vez de estourar', () => {
    expect(getDivergenciaRazao('nao.existe.nenhuma')).toBeNull();
  });

  it('a razão do pack é exatamente a que o componente renderiza (sem segunda fonte de texto)', () => {
    const razao = getDivergenciaRazao(VARIAVEL);
    render(<SihDivergenceNote razao={razao} />);
    expect(screen.getByText(new RegExp(razao!.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });
});
