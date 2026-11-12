import { RetentionCell, RetentionRow, formatNumber, formatPct } from '../../lib/admin/metrics';
import { Empty } from './ui';

/** Tableau de rétention : une ligne par cohorte d'arrivée, cases colorées selon le taux (heatmap violette). */

function cellStyle(c: RetentionCell): { background: string; color: string } {
  if (c.rate === null) return { background: 'transparent', color: 'rgba(43,15,58,0.35)' };
  const a = Math.min(1, 0.08 + c.rate * 1.6);
  return { background: `rgba(108,43,255,${a.toFixed(2)})`, color: a > 0.55 ? '#fff' : '#2B0F3A' };
}

const cohortLabel = (iso: string, weekly: boolean): string => {
  const d = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return weekly ? `sem. du ${d}` : d;
};

function Cell({ c }: { c: RetentionCell }) {
  return (
    <td className='p-1'>
      <div
        className='rounded-xl border-2 border-plum/15 px-2 py-1.5 text-center font-bold tabular-nums text-sm'
        style={cellStyle(c)}
        title={c.rate === null ? 'Pas encore mesurable' : `${c.n} sur ${c.eligible}`}
      >
        {c.rate === null ? '·' : formatPct(c.rate)}
      </div>
    </td>
  );
}

export function RetentionTable({ rows, totals, weekly }: { rows: RetentionRow[]; totals: RetentionRow; weekly: boolean }) {
  if (!rows.length) return <Empty>Pas encore de cohorte : la rétention apparaît dès que des utilisateurs reviennent un autre jour.</Empty>;
  return (
    <div className='overflow-x-auto -mx-1'>
      <table className='w-full min-w-[360px] border-separate border-spacing-0 text-sm'>
        <caption className='sr-only'>Rétention par cohorte d’arrivée</caption>
        <thead>
          <tr className='text-[11px] uppercase tracking-[0.12em] text-plum/60'>
            <th scope='col' className='text-left font-bold p-1'>Cohorte</th>
            <th scope='col' className='text-right font-bold p-1'>Arrivés</th>
            <th scope='col' className='font-bold p-1'>J1</th>
            <th scope='col' className='font-bold p-1'>J7</th>
            <th scope='col' className='font-bold p-1'>J30</th>
          </tr>
        </thead>
        <tbody>
          <tr className='bg-fooder-secondary/40'>
            <th scope='row' className='text-left font-display p-1 pl-2 rounded-l-xl'>Moyenne</th>
            <td className='text-right font-bold tabular-nums p-1'>{formatNumber(totals.size)}</td>
            <Cell c={totals.d1} />
            <Cell c={totals.d7} />
            <Cell c={totals.d30} />
          </tr>
          {rows.map(r => (
            <tr key={r.cohort}>
              <th scope='row' className='text-left font-semibold p-1 pl-2 whitespace-nowrap'>{cohortLabel(r.cohort, weekly)}</th>
              <td className='text-right font-bold tabular-nums p-1'>{formatNumber(r.size)}</td>
              <Cell c={r.d1} />
              <Cell c={r.d7} />
              <Cell c={r.d30} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className='text-[11px] font-semibold text-plum/55 mt-2 px-1'>
        JN = part des arrivés actifs exactement N jours après leur premier jour. « · » = pas encore mesurable (cohorte trop récente).
      </p>
    </div>
  );
}
