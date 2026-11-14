import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIGHTBOX_Z_INDEX } from '../components/ui/lightboxMath';

const read = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('Visionneuse au-dessus des feuilles', () => {
  it('son z-index dépasse celui de Sheet (150 par défaut)', () => {
    const sheetDefault = Number(read('components/ui/Sheet.tsx').match(/zIndex = (\d+)/)?.[1]);
    expect(sheetDefault).toBeGreaterThan(0);
    expect(LIGHTBOX_Z_INDEX).toBeGreaterThan(sheetDefault);
  });
  it('reste sous les toasts (z-160 et plus) pour que les messages restent visibles', () => {
    expect(LIGHTBOX_Z_INDEX).toBeLessThan(180);
  });
  it('Lightbox applique bien cette constante', () => {
    const src = read('components/ui/Lightbox.tsx');
    expect(src).toContain('LIGHTBOX_Z_INDEX');
    expect(src).not.toContain('z-[100]');
  });
  it('Lightbox capte le clavier avant la feuille (phase de capture), sinon Échap fermerait la fiche', () => {
    const src = read('components/ui/Lightbox.tsx');
    expect(src).toMatch(/addEventListener\('keydown', onKey, true\)/);
    expect(src).toContain('stopPropagation');
  });
});
