import { describe, expect, it } from 'vitest';
import { inertCandidates } from '../lib/inert';

const el = (tagName: string) => ({ tagName });

describe('inertCandidates', () => {
  const own = el('DIV');
  const app = el('DIV');
  const script = el('SCRIPT');
  const style = el('STYLE');

  it('rend inertes tous les autres enfants de <body>', () => {
    expect(inertCandidates([app, script, own, style], own)).toEqual([app]);
  });

  it('épargne les balises non interactives (outils de dev, styles, scripts)', () => {
    expect(inertCandidates([script, style, el('link'), el('TEMPLATE'), el('noscript')], own)).toEqual([]);
  });

  it('sans portail connu, tout devient inerte', () => {
    expect(inertCandidates([app, script], null)).toEqual([app]);
  });
});
