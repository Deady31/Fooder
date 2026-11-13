import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/restaurants/[id]/route';
import records from '../data/toulouse-places.json';

const call = (id: string, ip = '10.0.0.1') =>
  GET(new NextRequest(`http://localhost/api/restaurants/${encodeURIComponent(id)}`, { headers: { 'x-forwarded-for': ip } }), {
    params: { id },
  });

describe('GET /api/restaurants/[id]', () => {
  const known = (records as { id: string; n: string }[]).find(r => r.id.startsWith('osm-'))!;

  it('renvoie id, nom et cuisine d’une fiche connue, et rien d’autre', async () => {
    const res = await call(known.id);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Object.keys(json.data).sort()).toEqual(['cuisine', 'id', 'name']);
    expect(json.data.id).toBe(known.id);
    expect(json.data.name).toBe(known.n);
    expect(typeof json.data.cuisine).toBe('string');
  });

  it('404 pour un id bien formé mais inconnu', async () => {
    const res = await call('osm-n0000000000000');
    expect(res.status).toBe(404);
    expect((await res.json()).success).toBe(false);
  });

  it.each(['', 'abc', '../../etc/passwd', 'osm-', 'osm-N1', "osm-n1'; DROP TABLE", `osm-${'a'.repeat(200)}`, 'osm-n1/../x'])(
    '400 pour un id invalide : %s',
    async id => {
      const res = await call(id);
      expect(res.status).toBe(400);
      expect((await res.json()).success).toBe(false);
    }
  );

  it('plafonne le débit par adresse (429 au-delà de 60 requêtes par minute)', async () => {
    let last = 200;
    for (let i = 0; i < 70; i++) last = (await call(known.id, '10.9.9.9')).status;
    expect(last).toBe(429);
    expect((await call(known.id, '10.1.1.1')).status).toBe(200);
  });
});
