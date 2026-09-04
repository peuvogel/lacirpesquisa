import { useSyncExternalStore } from 'react';

/**
 * O adesivo é revelado quando a seção de resultados entra em cena, mas quem o
 * renderiza é o AppShell — precisa sobreviver à troca de teste e de rota, coisa
 * que a seção de resultados não faz. Uma store de módulo evita ter que passar
 * um provider por toda a árvore só para esse sinal.
 *
 * Estado só de memória: recarregar a aba volta ao ponto de partida.
 */
let revealed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function revealSticker() {
  if (revealed) return;
  revealed = true;
  emit();
}

/** Usado pelos testes para isolar cenários. */
export function resetSticker() {
  if (!revealed) return;
  revealed = false;
  emit();
}

export function useStickerRevealed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => revealed,
    () => false,
  );
}
