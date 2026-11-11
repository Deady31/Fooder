import { cpSync, mkdirSync } from 'node:fs';

const src = 'node_modules/maplibre-gl/dist';
const dst = 'public/maplibre';
mkdirSync(dst, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  cpSync(`${src}/${f}`, `${dst}/${f}`);
}
