import { barShares } from '../../lib/admin/users';
import type { DeviceDimension, DevicesPayload } from '../../lib/admin/users';
import { formatNumber } from '../../lib/admin/metrics';
import { Empty } from './ui';

const GROUPS: Array<{ dim: DeviceDimension; title: string; pick: (d: DevicesPayload) => DevicesPayload['platforms']; fill: string }> = [
  { dim: 'platform', title: 'Plateforme', pick: d => d.platforms, fill: '#6C2BFF' },
  { dim: 'browser', title: 'Navigateur', pick: d => d.browsers, fill: '#FF8A3D' },
  { dim: 'installed', title: 'Appli installée ?', pick: d => d.installed, fill: '#3DDC97' },
  { dim: 'form', title: 'Type d’appareil', pick: d => d.forms, fill: '#FF7EB6' },
];

function Bars({ dim, title, items, fill }: { dim: DeviceDimension; title: string; items: DevicesPayload['platforms']; fill: string }) {
  const rows = barShares(items, dim);
  return (
    <div className='min-w-0'>
      <h3 className='text-[11px] font-bold uppercase tracking-[0.12em] text-plum/55 mb-2'>{title}</h3>
      {rows.length === 0 ? (
        <p className='text-xs font-semibold text-plum/45'>Pas de données.</p>
      ) : (
        <ul className='space-y-2'>
          {rows.map(r => (
            <li key={r.key}>
              <div className='flex items-baseline justify-between gap-2 text-sm font-bold'>
                <span className={`truncate ${r.key === 'inconnu' ? 'text-plum/50' : ''}`}>{r.label}</span>
                <span className='tabular-nums text-xs text-plum/70 shrink-0'>
                  {formatNumber(r.users)} · {r.pct} %
                </span>
              </div>
              <svg
                viewBox='0 0 100 8'
                preserveAspectRatio='none'
                className='w-full h-2.5 mt-1 rounded-full bg-cream border-2 border-plum overflow-hidden'
                role='img'
                aria-label={`${r.label} : ${r.pct} % des utilisateurs`}
              >
                <rect x='0' y='0' width={r.pct} height='8' fill={r.key === 'inconnu' ? '#2B0F3A33' : fill} />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Répartition des utilisateurs actifs de la période par plateforme, navigateur, appli installée, type d'appareil. */
export function DeviceBars({ devices }: { devices: DevicesPayload }) {
  if (devices.users === 0) return <Empty>Pas encore de données d’appareil : elles arrivent au prochain lancement de l’appli.</Empty>;
  const unknown = devices.platforms.find(p => p.key === 'inconnu')?.users ?? 0;
  return (
    <div>
      <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-5'>
        {GROUPS.map(g => (
          <Bars key={g.dim} dim={g.dim} title={g.title} items={g.pick(devices)} fill={g.fill} />
        ))}
      </div>
      {unknown > 0 && <p className='text-[11px] font-semibold text-plum/50 mt-4'>« Inconnu » : utilisateurs dont l’appli n’a pas encore envoyé l’appareil (version précédente).</p>}
    </div>
  );
}
