import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Aciona só interações reais de produção: espera o botão real "Analisar
 * dados" aparecer — esperar por ele É a prova de que o dado carregou, porque
 * o botão só existe depois que a seção de configuração monta
 * (ColumnPreviewTable.tsx:218-220) — clica nele, e devolve a região
 * "Resultados" assim que ela monta. `<section aria-label="Resultados">`
 * expõe `role="region"` por ter nome acessível; nenhuma marcação
 * só-para-teste é adicionada, e a asserção quebra se alguém tirar o rótulo
 * da seção.
 *
 * Proibido aqui dentro (idioma de 3 passos, D-07): ler o atributo que o
 * layout antigo (removido) usava para marcar o passo ativo, clicar em qualquer botão
 * de navegação entre etapas, ou usar espera manual de temporizador (relógio
 * falso avançado manualmente ou `Promise` própria) — o atraso do debounce de
 * parse do dado colado é específico do carregamento e permanece no arquivo
 * chamador, antes deste helper.
 *
 * Dois casos estruturais ficam de fora de propósito (documentar para quem
 * for consumir, não implementar aqui):
 *   (a) o "soft reset" que reabre a configuração depois de Resultados — no
 *       layout scroll a seção "Dados e configuração" nunca desmonta, então
 *       o botão de reabrir simplesmente some e o `<select>` já está na
 *       tela;
 *   (b) a asserção de "Resultados ainda travado", que vira
 *       `expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument()`.
 */
export async function runToResultados(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));
  return screen.findByRole('region', { name: 'Resultados' });
}
