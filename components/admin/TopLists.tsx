import { formatDuration, formatNumber, formatPct, rate } from '../../lib/admin/metrics';
import type { RestoRow, ScreenRow } from '../../lib/admin/types';
import { Empty } from './ui';

const SCREEN_NAMES: Record<string, string> = {
  '/': 'Accueil',
  '/swipe': 'Swipe',
  '/map': 'Carte',
  '/feed': 'Fil',
  '/wishlist': 'Wishlist',
  '/profile': 'Profil',
  '/compte': 'Compte',
  '/amis': 'Amis',
  '/amis/ajouter': 'Ajouter un ami',
  '/groupe': 'Groupe',
  '/defi': 'Défi',
  '/onboarding': 'Onboarding',
  '/resto/[id]': 'Fiche resto partagée',
};

export function TopScreens({ rows }: { rows: ScreenRow[] }) {
  if (!rows.length) return <Empty>Aucun écran vu sur la période.</Empty>;
  const max = Math.max(1, ...rows.map(r => Number(r.views)));
  return (
    <ul className='space-y-2.5'>
      {rows.map(r => (
        <li key={r.screen}>
          <div className='flex items-baseline justify-between gap-2 text-sm'>
            <span className='font-bold truncate'>
              {SCREEN_NAMES[r.screen] ?? r.screen} <span className='font-mono text-[11px] text-plum/45'>{r.screen}</span>
            </span>
            <span className='shrink-0 text-xs font-bold text-plum/60 tabular-nums'>
              <span className='text-plum'>{formatNumber(r.views)}</span> vues · {formatNumber(r.users)} pers. · {formatDuration(Number(r.active_s))}
            </span>
          </div>
          <div className='mt-1 h-2.5 rounded-full bg-cream border-2 border-plum overflow-hidden'>
            <div className='h-full bg-fooder-orange' style={{ width: `${(Number(r.views) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TopRestos({ rows }: { rows: RestoRow[] }) {
  if (!rows.length) return <Empty>Aucun resto liké, passé ou ouvert sur la période.</Empty>;
  return (
    <div className='overflow-x-auto -mx-1'>
      <table className='w-full min-w-[420px] text-sm'>
        <caption className='sr-only'>Restos les plus actifs</caption>
        <thead>
          <tr className='text-[11px] uppercase tracking-[0.12em] text-plum/60 text-right'>
            <th scope='col' className='text-left font-bold p-1.5'>Resto</th>
            <th scope='col' className='font-bold p-1.5'>Likes</th>
            <th scope='col' className='font-bold p-1.5'>Passes</th>
            <th scope='col' className='font-bold p-1.5'>Ouvert</th>
            <th scope='col' className='font-bold p-1.5'>Taux like</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const likeRate = rate(Number(r.likes), Number(r.likes) + Number(r.passes));
            return (
              <tr key={r.rest_id} className='border-t-2 border-plum/10 text-right tabular-nums'>
                <th scope='row' className='text-left p-1.5 font-semibold max-w-[200px]'>
                  <span className='text-plum/40 font-display mr-1.5'>{i + 1}</span>
                  <span className='truncate inline-block align-bottom max-w-[160px]' title={r.rest_id}>
                    {r.name ?? r.rest_id}
                  </span>
                </th>
                <td className='p-1.5 font-bold text-fooder-red'>{formatNumber(r.likes)}</td>
                <td className='p-1.5 font-bold text-plum/60'>{formatNumber(r.passes)}</td>
                <td className='p-1.5 font-bold'>{formatNumber(Number(r.opens) + Number(r.views))}</td>
                <td className='p-1.5'>
                  <span className={`inline-block px-2 py-0.5 rounded-full border-2 border-plum text-xs font-bold ${likeRate === null ? 'bg-white' : likeRate >= 0.5 ? 'bg-fooder-mint' : 'bg-bubblegum'}`}>{formatPct(likeRate)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
