import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readStickerPosition,
  stickerStorageKey,
  writeStickerPosition,
} from './stickerPosition';

const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

/**
 * O runtime dos testes expõe um `localStorage` sem métodos, então cada cenário
 * instala o seu — inclusive o caso em que o armazenamento lança.
 */
function installStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
    ...overrides,
  } as Storage;

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  return storage;
}

describe('stickerPosition', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installStorage();
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'localStorage', originalDescriptor);
    }
    vi.restoreAllMocks();
  });

  it('reads back what was written', () => {
    writeStickerPosition('mapas', { x: 120, y: -40 });
    expect(readStickerPosition('mapas')).toEqual({ x: 120, y: -40 });
  });

  it('keeps one position per module', () => {
    writeStickerPosition('mapas', { x: 120, y: -40 });
    writeStickerPosition('variaveis', { x: -30, y: 90 });

    expect(readStickerPosition('mapas')).toEqual({ x: 120, y: -40 });
    expect(readStickerPosition('variaveis')).toEqual({ x: -30, y: 90 });
    expect(readStickerPosition('meta-analise')).toBeNull();
    expect(storage.getItem(stickerStorageKey('mapas'))).toBe('{"x":120,"y":-40}');
  });

  it('ignores corrupt or half-written entries instead of throwing', () => {
    for (const raw of ['não é json', '{"x":10}', '{"x":"10","y":"20"}', '{"x":null,"y":null}']) {
      storage.setItem(stickerStorageKey('mapas'), raw);
      expect(readStickerPosition('mapas')).toBeNull();
    }
  });

  it('never restores the sticker outside a smaller window', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    storage.setItem(stickerStorageKey('mapas'), '{"x":4000,"y":-4000}');

    // 500 - 120 e 400 - 120: sobra sempre uma faixa alcançável.
    expect(readStickerPosition('mapas')).toEqual({ x: 380, y: -280 });
  });

  it('degrades quietly when the storage itself throws', () => {
    installStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });

    expect(() => writeStickerPosition('mapas', { x: 1, y: 2 })).not.toThrow();
    expect(readStickerPosition('mapas')).toBeNull();
  });

  it('degrades quietly when the runtime has no usable storage', () => {
    Object.defineProperty(window, 'localStorage', { value: {}, configurable: true });

    expect(() => writeStickerPosition('mapas', { x: 1, y: 2 })).not.toThrow();
    expect(readStickerPosition('mapas')).toBeNull();
  });

  it('refuses to store values that would come back broken', () => {
    writeStickerPosition('mapas', { x: Number.NaN, y: 10 });
    expect(storage.getItem(stickerStorageKey('mapas'))).toBeNull();
  });
});
