/**
 * Quem já viu o texto se formar nesta sessão.
 *
 * Latch próprio, e não o do adesivo (`hasStickerEntered`): o adesivo marca a
 * entrada na montagem da página, então compartilhar a chave engoliria a
 * animação do texto antes de ela acontecer. Em memória de propósito —
 * recarregar a página é uma visita nova.
 */
const entered = new Set<string>();

export function hasParticleTextEntered(id: string): boolean {
  return entered.has(id);
}

export function markParticleTextEntered(id: string): void {
  entered.add(id);
}

/** Usado pelos testes para isolar cenários. */
export function resetParticleTextEntrances(): void {
  entered.clear();
}
