// Outils image via ffmpeg/ffprobe (pas de dépendance native). Utilisés par les scripts photos.
import { spawnSync } from 'node:child_process';

export function ffprobeSize(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = (r.stdout ?? '').trim().split(',').map(Number);
  return { width: w || 0, height: h || 0 };
}

/** Empreinte perceptuelle « dHash » 64 bits (16 caractères hexadécimaux) via ffmpeg (9×8 en gris). */
export function dHash(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', 'scale=9:8:flags=area,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  const b = r.stdout;
  if (!b || b.length < 72) return null;
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += b[y * 9 + x] < b[y * 9 + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Convertit en WebP 720 px max, qualité 68, sans métadonnées (mêmes réglages que build-consented-photos.mjs). */
export function toWebp(input, output, size = 720, quality = 68) {
  const vf = `scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=decrease`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-vf', vf, '-map_metadata', '-1', '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', output], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr ?? '').trim() || `ffmpeg ${r.status}`);
}
