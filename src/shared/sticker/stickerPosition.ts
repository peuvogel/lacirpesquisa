export interface StickerPosition {
  x: number;
  y: number;
}

const STORAGE_PREFIX = 'lacir:sticker:';

/**
 * Quanto do adesivo tem de continuar alcançável ao restaurar a posição numa
 * janela menor que a da sessão anterior.
 */
const VISIBLE_MARGIN_PX = 120;

/** Cada adesivo tem a sua chave: o de Mapas não herda a posição do de Variáveis. */
export function stickerStorageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

function getStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    // Nem todo ambiente entrega um Storage de verdade: navegação privada e
    // políticas de terceiros lançam no acesso, e há runtimes que expõem um
    // objeto vazio no lugar. Sem os métodos, não há o que guardar.
    if (typeof storage?.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function clampToViewport({ x, y }: StickerPosition): StickerPosition {
  const width = typeof window === 'undefined' ? 0 : window.innerWidth;
  const height = typeof window === 'undefined' ? 0 : window.innerHeight;
  // x/y são deslocamentos a partir do ponto de repouso, não coordenadas
  // absolutas — o limite existe só para uma janela menor não devolver o
  // adesivo para fora da tela.
  const maxX = Math.max(0, width - VISIBLE_MARGIN_PX);
  const maxY = Math.max(0, height - VISIBLE_MARGIN_PX);
  return {
    x: Math.min(Math.max(x, -maxX), maxX),
    y: Math.min(Math.max(y, -maxY), maxY),
  };
}

/**
 * Lê a posição salva de um adesivo. Só coordenadas vão para o `localStorage` —
 * nenhum dado de pesquisa, que continua no IndexedDB da sessão.
 */
export function readStickerPosition(id: string): StickerPosition | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(stickerStorageKey(id));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const { x, y } = parsed as { x?: unknown; y?: unknown };
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return clampToViewport({ x, y });
  } catch {
    // JSON corrompido ou leitura bloqueada: começa do ponto de repouso.
    return null;
  }
}

export function writeStickerPosition(id: string, position: StickerPosition): void {
  const storage = getStorage();
  if (!storage) return;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;

  try {
    storage.setItem(
      stickerStorageKey(id),
      JSON.stringify({ x: position.x, y: position.y }),
    );
  } catch {
    // Cota estourada ou storage bloqueado: a posição é enfeite, não vale quebrar.
  }
}

/**
 * Quais adesivos já fizeram a entrada nesta sessão. Trocar de aba remonta a
 * página, e sem esta memória o adesivo cairia do alto de novo a cada visita —
 * ele já está colado, só muda de tela. Estado só de memória: recarregar a aba
 * dá direito a uma nova entrada. A posição, essa, vem do armazenamento.
 */
const entered = new Set<string>();

export function hasStickerEntered(id: string): boolean {
  return entered.has(id);
}

export function markStickerEntered(id: string): void {
  entered.add(id);
}

/** Usado pelos testes para isolar cenários. */
export function resetStickerEntrances(): void {
  entered.clear();
}
