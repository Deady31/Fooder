// Charge un module TypeScript du dépôt (ex. lib/osm.ts) depuis un script Node, sans le recopier : on le compile en mémoire avec esbuild
// (déjà installé avec vitest). Ainsi un script utilise exactement les mêmes règles que l'appli (isPresentable, osmToRestaurant…).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @param {string} rel chemin relatif à la racine du dépôt, ex. 'lib/osm.ts' */
export async function loadTs(rel) {
  const out = await build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    loader: { '.json': 'json' },
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
