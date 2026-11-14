#!/usr/bin/env node
/**
 * Génère data/apercu-photos.html : planche de contrôle.
 *  1. Photos ÉCARTÉES (avec la raison) : pour vérifier qu'on n'a pas jeté de bons plats (--unblock <id>).
 *  2. Photos GARDÉES (public/restos) : pour repérer à l'oeil les visuels de marque restants (--block <id>).
 * Chaque vignette affiche l'id : node scripts/block-photo.mjs <id> pour écarter, --undo pour rétablir.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async (f, d) => { try { return JSON.parse((await fs.readFile(path.join(ROOT, f), 'utf8')).replace(/^\uFEFF/, '')); } catch { return d; } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const table = await read('data/photos-consented.json', {});
const blocked = (await read('data/photo-blocklist.json', { blocked: {} })).blocked ?? {};
const local = await read('data/photos-local.json', {});
const places = await read('data/toulouse-places.json', []);
const names = new Map(places.map((p) => [p.id, p.n]));

const kept = Object.entries(table).filter(([id]) => !blocked[id]);
const rejected = Object.entries(blocked).filter(([id]) => local[id]);

const fig = (id, src, note) => `<figure><img src="${esc(src)}" loading="lazy" alt=""><figcaption><b>${esc(names.get(id) ?? '')}</b><code>${esc(id)}</code>${note ? `<em>${esc(note)}</em>` : ''}</figcaption></figure>`;

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Fooder — planche de contrôle des photos</title>
<style>
  :root { --plum:#2d1b2e; --green:#58cc02; --red:#d33; --cream:#f5f5f0; }
  * { box-sizing:border-box; }
  body { margin:0; padding:24px; background:var(--cream); color:var(--plum); font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif; }
  h1 { margin:0 0 4px; font-size:26px; } h2 { margin:32px 0 4px; font-size:20px; }
  p { margin:0 0 14px; font-size:13px; opacity:.7; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
  figure { margin:0; background:#fff; border:2px solid var(--plum); border-radius:10px; overflow:hidden; }
  .bad figure { border-color:var(--red); }
  img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; background:#e8e6df; }
  figcaption { padding:5px 7px 7px; display:flex; flex-direction:column; gap:1px; font-size:11px; }
  figcaption b { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  code { font-size:10px; opacity:.55; user-select:all; } em { font-style:normal; color:var(--red); font-weight:600; }
</style></head><body>
<h1>Planche de contrôle des photos</h1>
<p>Écarter une photo : <code>node scripts/block-photo.mjs &lt;id&gt; "raison"</code> · la rétablir : ajouter <code>--undo</code> · restaurant qui retire son accord : <code>--revoke</code>.</p>
<h2>Écartées automatiquement ou à la main (${rejected.length})</h2>
<p>À vérifier : si un vrai plat apparaît ici, le rétablir.</p>
<div class="grid bad">${rejected.map(([id, b]) => fig(id, `../public${local[id].src}`, b.reason)).join('')}</div>
<h2>Gardées (${kept.length})</h2>
<p>Ce qui sera affiché. Les heuristiques ne reconnaissent pas un plat : repérer ici les logos, façades ou bannières restants.</p>
<div class="grid">${kept.map(([id, p]) => fig(id, `../public${p.src}`, '')).join('')}</div>
</body></html>`;

await fs.writeFile(path.join(ROOT, 'data', 'apercu-photos.html'), html);
console.log(`planche : data/apercu-photos.html (${rejected.length} écartées, ${kept.length} gardées)`);
