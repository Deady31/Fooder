import { describe, expect, it } from 'vitest';
import { describeKey } from '../lib/admin/rpc';

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;

describe('describeKey (diagnostic de la clé service, sans fuite)', () => {
  it('reconnaît une clé secrète récente', () => {
    expect(describeKey('sb_secret_abc123')).toContain('secrète');
  });

  it('signale une clé publique collée par erreur', () => {
    expect(describeKey('sb_publishable_abc123')).toContain('PUBLIQUE');
  });

  it('lit le rôle d’une ancienne clé JWT', () => {
    expect(describeKey(jwt('service_role'))).toBe('JWT service_role');
    expect(describeKey(jwt('anon'))).toContain('anon');
  });

  it('détecte espaces, retours à la ligne et guillemets', () => {
    expect(describeKey('sb_secret_abc\n')).toContain('parasite');
    expect(describeKey(' sb_secret_abc')).toContain('parasite');
    expect(describeKey('"sb_secret_abc"')).toContain('guillemets');
  });

  it('gère vide, JWT illisible et format inconnu', () => {
    expect(describeKey('')).toBe('vide');
    expect(describeKey('eyJ.pas-un-jwt')).toBe('JWT illisible');
    expect(describeKey('autre-chose')).toBe('format inconnu');
  });

  it('ne renvoie jamais la valeur de la clé', () => {
    const secret = 'sb_secret_TRES_SECRET_123456';
    expect(describeKey(secret)).not.toContain('TRES_SECRET');
  });
});
