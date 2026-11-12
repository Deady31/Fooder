'use client';
import { useMemo, useState } from 'react';
import type { DailyRow } from '../../lib/admin/types';
import { formatNumber } from '../../lib/admin/metrics';
import { ChipButton, Empty } from './ui';

/** Courbes quotidiennes en SVG pur (pas de librairie). Survol / toucher : valeur du jour. */

type SeriesKey = 'active_users' | 'new_users' | 'sessions' | 'likes' | 'active_minutes';

const SERIES: Array<{ key: SeriesKey; label: string; color: string; fill: string }> = [
  { key: 'active_users', label: 'Actifs', color: '#6C2BFF', fill: 'rgba(108,43,255,0.14)' },
  { key: 'new_users', label: 'Nouveaux', color: '#1FA971', fill: 'rgba(61,220,151,0.25)' },
  { key: 'sessions', label: 'Sessions', color: '#FF8A1F', fill: 'rgba(255,138,31,0.18)' },
  { key: 'likes', label: 'Likes', color: '#FF3D8B', fill: 'rgba(255,126,200,0.22)' },
  { key: 'active_minutes', label: 'Minutes actives', color: '#2B0F3A', fill: 'rgba(43,15,58,0.10)' },
];

const W = 600;
const H = 200;
const PAD_TOP = 12;

const dayLabel = (iso: string): string => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find(s => s * pow >= v / 4) ?? 10;
  return Math.ceil(v / (step * pow)) * step * pow;
}

export function DailyChart({ rows }: { rows: DailyRow[] }) {
  const [key, setKey] = useState<SeriesKey>('active_users');
  const [hover, setHover] = useState<number | null>(null);
  const s = SERIES.find(x => x.key === key) ?? SERIES[0];

  const { line, area, max, total } = useMemo(() => {
    const values = rows.map(r => Number(r[key]) || 0);
    const m = niceMax(Math.max(0, ...values));
    const step = rows.length > 1 ? W / (rows.length - 1) : W;
    const pts = values.map((v, i) => [rows.length > 1 ? i * step : W / 2, H - (v / m) * (H - PAD_TOP)] as const);
    const l = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const a = pts.length ? `${l} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z` : '';
    return { line: l, area: a, max: m, total: values.reduce((x, y) => x + y, 0) };
  }, [rows, key]);

  if (!rows.length) return <Empty>Aucune journée à afficher.</Empty>;

  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (rows.length - 1));
    setHover(Math.max(0, Math.min(rows.length - 1, i)));
  };
  const h = hover !== null ? rows[hover] : null;
  const hx = hover !== null && rows.length > 1 ? (hover / (rows.length - 1)) * 100 : 50;
  const hv = h ? Number(h[key]) || 0 : 0;

  return (
    <div>
      <div className='flex flex-wrap gap-2 mb-4' role='group' aria-label='Courbe affichée'>
        {SERIES.map(x => (
          <ChipButton key={x.key} active={x.key === key} onClick={() => setKey(x.key)}>
            {x.label}
          </ChipButton>
        ))}
      </div>
      <p className='text-sm font-semibold text-plum/70 mb-2'>
        Total sur la période : <span className='font-display text-plum text-lg'>{formatNumber(total)}</span>
        {key === 'active_users' ? ' (somme des actifs quotidiens)' : ''}
      </p>
      <div className='flex gap-2'>
        <div className='flex flex-col justify-between text-[10px] font-bold text-plum/50 tabular-nums py-0.5 text-right w-8 shrink-0' aria-hidden>
          <span>{formatNumber(max)}</span>
          <span>{formatNumber(max / 2)}</span>
          <span>0</span>
        </div>
        <div
          className='relative flex-1 min-w-0 h-48 sm:h-56 touch-pan-y'
          onPointerMove={e => pick(e.clientX, e.currentTarget)}
          onPointerDown={e => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio='none' className='absolute inset-0 w-full h-full overflow-visible' role='img' aria-label={`${s.label} par jour`}>
            {[0, 0.5, 1].map(f => (
              <line key={f} x1={0} x2={W} y1={H - f * (H - PAD_TOP)} y2={H - f * (H - PAD_TOP)} stroke='#2B0F3A' strokeOpacity={f === 0 ? 0.6 : 0.12} strokeWidth={f === 0 ? 2 : 1} strokeDasharray={f === 0 ? undefined : '4 4'} vectorEffect='non-scaling-stroke' />
            ))}
            <path d={area} fill={s.fill} />
            <path d={line} fill='none' stroke={s.color} strokeWidth={3} strokeLinejoin='round' strokeLinecap='round' vectorEffect='non-scaling-stroke' />
          </svg>
          {h && (
            <>
              <div className='absolute top-0 bottom-0 w-[2px] bg-plum/40 pointer-events-none' style={{ left: `calc(${hx}% - 1px)` }} />
              <div
                className='absolute w-3.5 h-3.5 rounded-full border-[3px] border-plum pointer-events-none'
                style={{ left: `calc(${hx}% - 7px)`, top: `calc(${(1 - hv / max) * (1 - PAD_TOP / H) * 100 + (PAD_TOP / H) * 100}% - 7px)`, background: s.color }}
              />
              <div
                className='absolute -top-2 pointer-events-none bg-plum text-cream rounded-xl px-2.5 py-1.5 text-xs font-bold whitespace-nowrap shadow-hard-sm'
                style={{ left: `${hx}%`, transform: `translate(${hx > 70 ? '-100%' : hx < 30 ? '0' : '-50%'}, -100%)` }}
              >
                {dayLabel(h.day)} · <span className='text-fooder-secondary'>{formatNumber(hv)}</span> {s.label.toLowerCase()}
              </div>
            </>
          )}
        </div>
      </div>
      <div className='flex justify-between text-[10px] font-bold text-plum/50 mt-1.5 pl-10' aria-hidden>
        <span>{dayLabel(rows[0].day)}</span>
        {rows.length > 2 && <span>{dayLabel(rows[Math.floor(rows.length / 2)].day)}</span>}
        <span>{dayLabel(rows[rows.length - 1].day)}</span>
      </div>
    </div>
  );
}
