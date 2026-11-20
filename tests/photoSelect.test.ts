import { describe, expect, it } from 'vitest';
import {
  checkImageSize, chunk, createHostThrottle, dedupeByHash, hamming, isExcludedImageUrl, parseVisionRows, pickBest, rankCandidates, robotsAllowed, visionVerdict,
} from '../scripts/lib/photoSelect.mjs';

describe('photos : exclusions d’office', () => {
  it('jamais d’image Google, de carte statique ni de réseau social', () => {
    for (const u of [
      'https://lh3.googleusercontent.com/p/abc=w800',
      'https://maps.googleapis.com/maps/api/staticmap?center=43,1',
      'https://maps.gstatic.com/x.jpg',
      'https://www.google.com/maps/vt/pb=!1m',
      'https://scontent.xx.fbcdn.net/v/t1/photo.jpg',
      'https://www.tripadvisor.fr/photo.jpg',
    ]) expect(isExcludedImageUrl(u), u).not.toBeNull();
  });

  it('exclut logos, bannières, façades, svg, gif et protocoles étranges', () => {
    for (const u of ['https://x.fr/img/logo-resto.png', 'https://x.fr/banner-home.jpg', 'https://x.fr/facade.jpg', 'https://x.fr/a.svg', 'https://x.fr/anim.gif', 'ftp://x.fr/plat.jpg', 'pas une url'])
      expect(isExcludedImageUrl(u), u).not.toBeNull();
  });

  it('garde une photo de plat ordinaire d’un site de restaurant', () => {
    expect(isExcludedImageUrl('https://www.chez-eloise.fr/wp-content/uploads/2024/cassoulet.jpg')).toBeNull();
  });

  it('refuse les images trop petites, trop larges, légères ou aplaties', () => {
    expect(checkImageSize({ width: 800, height: 600, bytes: 120_000 })).toBeNull();
    expect(checkImageSize({ width: 500, height: 600, bytes: 120_000 })).toBe('trop-petite');
    expect(checkImageSize({ width: 2400, height: 600, bytes: 300_000 })).toBe('ratio');
    expect(checkImageSize({ width: 800, height: 600, bytes: 10_000 })).toBe('trop-legere');
    expect(checkImageSize({ width: 1600, height: 1200, bytes: 90_000 })).toBe('aplat');
    expect(checkImageSize({ width: 0, height: 0, bytes: 90_000 })).toBe('dimensions-illisibles');
  });
});

describe('photos : doublons par empreinte perceptuelle', () => {
  it('distance de Hamming', () => {
    expect(hamming('ff00', 'ff00')).toBe(0);
    expect(hamming('ff00', 'fe00')).toBe(1);
    expect(hamming('ffff', '0000')).toBe(16);
    expect(hamming('ff', 'ff00')).toBe(Infinity);
  });

  it('garde la première de deux images quasi identiques, pas les différentes', () => {
    const kept = dedupeByHash([
      { key: 'a', hash: 'ffff0000ffff0000' },
      { key: 'b', hash: 'fffe0000ffff0000' }, // 1 bit d'écart : doublon
      { key: 'c', hash: '00ff00ff00ff00ff' },
    ]);
    expect(kept.map(k => k.key)).toEqual(['a', 'c']);
  });
});

describe('photos : tri par vision', () => {
  it('verdict : garder, second avis ou rejeter', () => {
    expect(visionVerdict({ classe: 'plat', confiance: 0.93 })).toBe('keep');
    expect(visionVerdict({ classe: 'plat', confiance: 0.8 })).toBe('keep');
    expect(visionVerdict({ classe: 'plat', confiance: 0.65 })).toBe('review');
    expect(visionVerdict({ classe: 'plat', confiance: 0.3 })).toBe('reject');
    expect(visionVerdict({ classe: 'facade', confiance: 0.95 })).toBe('reject');
    expect(visionVerdict({ classe: 'facade', confiance: 0.6 })).toBe('review');
    expect(visionVerdict(undefined)).toBe('review');
    expect(visionVerdict({ classe: 'inconnu', confiance: 0.9 })).toBe('review');
  });

  it('lit le fichier d’un sous-agent, avec ou sans bloc de code, et ignore les lignes invalides', () => {
    const rows = parseVisionRows('```json\n[{"idx":1,"classe":"plat","confiance":0.9},{"idx":2,"classe":"nimporte","confiance":1},{"idx":"3","classe":"logo","confiance":0.9},{"idx":4,"classe":"menu","confiance":1.7}]\n```');
    expect(rows).toEqual([{ idx: 1, classe: 'plat', confiance: 0.9 }, { idx: 4, classe: 'menu', confiance: 1 }]);
    expect(parseVisionRows('pas du json')).toEqual([]);
    expect(parseVisionRows('{"photos":[{"idx":1,"classe":"plat","confiance":0.8}]}')).toHaveLength(1);
  });
});

describe('photos : choix de la meilleure', () => {
  const c = (key: string, over = {}) => ({ key, confiance: 0.9, width: 1200, bytes: 300_000, height: 800, ...over });

  it('préfère la plus nette et la plus grande, de façon déterministe', () => {
    const best = pickBest([c('a', { width: 700, bytes: 60_000, height: 500 }), c('b'), c('c', { confiance: 0.82 })]);
    expect(best?.key).toBe('b');
    expect(pickBest([c('x'), c('y')])?.key).toBe('x'); // égalité : identifiant le plus petit
    expect(pickBest([])).toBeNull();
  });

  it('classe les candidats : source fiable d’abord, puis largeur', () => {
    const r = rankCandidates([{ url: 'b', rank: 10, width: 900 }, { url: 'a', rank: 100, width: 100 }, { url: 'c', rank: 10, width: 1200 }]);
    expect(r.map(x => x.url)).toEqual(['a', 'c', 'b']);
  });
});

describe('photos : robots.txt', () => {
  const nl = (...l: string[]) => l.join('\n');
  it('une règle à joker ne bloque pas tout le site (cas réel « Disallow: *?lightbox= »)', () => {
    const txt = nl('User-agent: *', 'Allow: /', 'Disallow: *?lightbox=');
    expect(robotsAllowed(txt, '/carte')).toBe(true);
    expect(robotsAllowed(txt, '/galerie?lightbox=3')).toBe(false);
  });
  it('Disallow: / bloque tout ; la règle la plus longue gagne ; les autres robots sont ignorés', () => {
    expect(robotsAllowed(nl('User-agent: *', 'Disallow: /'), '/')).toBe(false);
    expect(robotsAllowed(nl('User-agent: *', 'Disallow: /wp-admin/', 'Allow: /wp-admin/admin-ajax.php'), '/wp-admin/admin-ajax.php')).toBe(true);
    expect(robotsAllowed(nl('User-agent: *', 'Disallow: /wp-admin/'), '/wp-admin/x')).toBe(false);
    expect(robotsAllowed(nl('User-agent: BadBot', 'Disallow: /'), '/menu')).toBe(true);
    expect(robotsAllowed('', '/menu')).toBe(true);
  });
});

describe('photos : politesse envers les sites', () => {
  it('au plus une requête par seconde et par site, sans freiner les autres sites', () => {
    let t = 0;
    const delay = createHostThrottle(1000, () => t);
    expect(delay('a.fr')).toBe(0);
    expect(delay('a.fr')).toBe(1000);
    expect(delay('a.fr')).toBe(2000);
    expect(delay('b.fr')).toBe(0);
    t = 5000;
    expect(delay('a.fr')).toBe(0);
  });

  it('découpe en lots de 36', () => {
    const lots = chunk(Array.from({ length: 80 }, (_, i) => i), 36);
    expect(lots.map(l => l.length)).toEqual([36, 36, 8]);
  });
});
