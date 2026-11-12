import QRCode from 'qrcode';
import { avatarSrc, bgColor } from './avatars';
import { FriendSnapshot } from './social/snapshot';
import { stickerSrc } from './stickers';
import { formatCode } from './invite';

const W = 1080;
const H = 1350;
const PLUM = '#2B0F3A';
const CREAM = '#FFF6E5';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fontOf(className: string): string {
  const el = document.createElement('span');
  el.className = className;
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const family = getComputedStyle(el).fontFamily;
  el.remove();
  return family;
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, shadow = 14) {
  ctx.fillStyle = PLUM;
  ctx.beginPath();
  ctx.roundRect(x + shadow, y + shadow, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = PLUM;
  ctx.stroke();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Carte de visite foodie au format story/post (1080×1350), avec QR code d'ajout en ami. */
export async function renderFriendCard(s: FriendSnapshot, link: string, title: string): Promise<Blob> {
  await document.fonts?.ready;
  const display = fontOf('font-display');
  const body = fontOf('font-body') || 'sans-serif';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  try {
    const bg = await loadImage('/bg/doodle-cream.webp');
    const k = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * k) / 2, 0, bg.width * k, bg.height * k);
  } catch {
    /* fond uni */
  }

  panel(ctx, 70, 90, W - 154, H - 190, 56, '#FFFFFF');

  // Avatar
  ctx.fillStyle = bgColor(s.avatar.bg);
  ctx.beginPath();
  ctx.arc(250, 270, 115, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = PLUM;
  ctx.stroke();
  try {
    const av = await loadImage(avatarSrc(s.avatar.id));
    ctx.save();
    ctx.beginPath();
    ctx.arc(250, 270, 111, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(av, 135, 155, 230, 230);
    ctx.restore();
  } catch {
    /* sans mascotte */
  }

  ctx.fillStyle = PLUM;
  ctx.font = `64px ${display}`;
  ctx.fillText(fitText(ctx, s.name, 520), 400, 250);
  ctx.font = `600 34px ${body}`;
  ctx.fillStyle = '#6B5A75';
  ctx.fillText(fitText(ctx, `${title} · niveau ${s.level}`, 520), 400, 305);

  // Archétype
  panel(ctx, 130, 430, W - 274, 170, 36, '#FFD83D', 8);
  try {
    const st = await loadImage(stickerSrc(s.archetypeSticker));
    ctx.drawImage(st, W - 300, 410, 150, 150);
  } catch {
    /* sans sticker */
  }
  ctx.fillStyle = PLUM;
  ctx.font = `700 28px ${body}`;
  ctx.fillText('Mon archétype', 170, 490);
  ctx.font = `54px ${display}`;
  ctx.fillText(fitText(ctx, s.archetype, 600), 170, 560);

  // Stats
  const stats: [string, string][] = [
    [String(s.visits), 'visites'],
    [String(s.streak), 'sem. de série'],
    [String(s.quartiers.length), 'quartiers'],
  ];
  stats.forEach(([v, l], i) => {
    const x = 130 + i * 278;
    panel(ctx, x, 650, 250, 150, 30, CREAM, 6);
    ctx.fillStyle = PLUM;
    ctx.font = `64px ${display}`;
    ctx.fillText(v, x + 28, 735);
    ctx.font = `700 26px ${body}`;
    ctx.fillText(l, x + 28, 775);
  });

  // Top restos
  ctx.font = `700 28px ${body}`;
  ctx.fillStyle = PLUM;
  ctx.fillText('Mes coups de cœur', 130, 870);
  ctx.font = `600 32px ${body}`;
  s.likes.slice(0, 3).forEach(([, name, cuisine], i) => {
    ctx.fillText(fitText(ctx, `${i + 1}. ${name}${cuisine ? ` · ${cuisine}` : ''}`, 520), 130, 925 + i * 50);
  });
  if (s.likes.length === 0) ctx.fillText('À découvrir ensemble !', 130, 925);

  // QR
  const qr = await QRCode.toDataURL(link, { errorCorrectionLevel: 'L', margin: 1, width: 300, color: { dark: PLUM, light: '#FFFFFF' } });
  const qrImg = await loadImage(qr);
  panel(ctx, W - 410, 840, 290, 290, 28, '#FFFFFF', 8);
  ctx.drawImage(qrImg, W - 395, 855, 260, 260);

  ctx.fillStyle = PLUM;
  ctx.font = `46px ${display}`;
  ctx.fillText('Ajoute-moi sur Fooder', 130, 1110);
  ctx.font = `600 28px ${body}`;
  ctx.fillStyle = '#6B5A75';
  ctx.fillText('Scanne le code et compare nos goûts', 130, 1155);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Export impossible'))), 'image/png'));
}

const STORY_H = 1920;

/** Image de story « Rejoins-moi sur Fooder » (1080×1920) avec mon code d'ami et un QR vers le lien d'invitation. */
export async function renderInviteStory(code: string | undefined, link: string): Promise<Blob> {
  await document.fonts?.ready;
  const display = fontOf('font-display');
  const body = fontOf('font-body') || 'sans-serif';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, STORY_H);
  try {
    const bg = await loadImage('/bg/doodle-cream.webp');
    const k = Math.max(W / bg.width, STORY_H / bg.height);
    ctx.drawImage(bg, (W - bg.width * k) / 2, 0, bg.width * k, bg.height * k);
  } catch {
    /* fond uni */
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = PLUM;
  ctx.font = `120px ${display}`;
  ctx.fillText('Fooder', W / 2, 250);

  try {
    const st = await loadImage(stickerSrc('b_heart'));
    ctx.drawImage(st, W / 2 - 150, 300, 300, 300);
  } catch {
    /* sans sticker */
  }

  ctx.font = `88px ${display}`;
  ctx.fillText('Rejoins-moi', W / 2, 720);
  ctx.fillText('sur Fooder', W / 2, 820);
  ctx.font = `600 38px ${body}`;
  ctx.fillStyle = '#6B5A75';
  ctx.fillText('Swipe les restos de Toulouse, compare nos goûts', W / 2, 890);

  const qr = await QRCode.toDataURL(link, { errorCorrectionLevel: 'L', margin: 1, width: 440, color: { dark: PLUM, light: '#FFFFFF' } });
  const qrImg = await loadImage(qr);
  panel(ctx, W / 2 - 245, 960, 490, 490, 40, '#FFFFFF', 12);
  ctx.drawImage(qrImg, W / 2 - 220, 985, 440, 440);

  const pretty = formatCode(code);
  if (pretty) {
    panel(ctx, W / 2 - 330, 1530, 660, 150, 40, '#FFD83D', 10);
    ctx.fillStyle = PLUM;
    ctx.font = `700 30px ${body}`;
    ctx.fillText('Mon code d’ami', W / 2, 1585);
    ctx.font = `64px ${display}`;
    ctx.fillText(pretty, W / 2, 1655);
  }

  ctx.fillStyle = PLUM;
  ctx.font = `700 34px ${body}`;
  ctx.fillText('Scanne le code ou ouvre le lien en story', W / 2, 1800);
  ctx.textAlign = 'start';

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Export impossible'))), 'image/png'));
}
