'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, HelpCircle, Monitor, Search, Smartphone, Tablet } from 'lucide-react';
import { formatDuration, formatNumber } from '../../lib/admin/metrics';
import type { AdminError } from '../../lib/admin/types';
import { PAGE_SIZE, UserRow, UsersResponse, deviceLabel, pageCount } from '../../lib/admin/users';
import { DeviceBars } from './DeviceBars';
import { Empty, Panel, Skeleton } from './ui';

type LoadState = { kind: 'loading' } | { kind: 'error'; error: AdminError } | { kind: 'ready'; data: UsersResponse };

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

function DeviceIcon({ form }: { form: string | null }) {
  const cls = 'w-4 h-4 shrink-0';
  if (form === 'mobile') return <Smartphone className={cls} strokeWidth={2.5} aria-label='Mobile' />;
  if (form === 'tablette') return <Tablet className={cls} strokeWidth={2.5} aria-label='Tablette' />;
  if (form === 'ordinateur') return <Monitor className={cls} strokeWidth={2.5} aria-label='Ordinateur' />;
  return <HelpCircle className={`${cls} text-plum/35`} strokeWidth={2.5} aria-label='Appareil inconnu' />;
}

const TH = 'text-left text-[10px] font-bold uppercase tracking-[0.12em] text-plum/50 px-2 py-2 whitespace-nowrap';
const TD = 'px-2 py-2 text-sm tabular-nums whitespace-nowrap';

function accountBadge(u: UserRow): string {
  if (!u.account_exists) return 'supprimé';
  if (u.is_anonymous) return 'anonyme';
  return u.has_email ? 'e-mail' : 'compte';
}

function Row({ u, onOpen }: { u: UserRow; onOpen: (id: string) => void }) {
  return (
    <tr className='border-t-2 border-plum/10 hover:bg-cream/70'>
      <td className='px-2 py-2 min-w-[150px]'>
        <button
          type='button'
          onClick={() => onOpen(u.user_id)}
          className='text-left rounded-lg focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-fooder-primary'
          aria-label={`Voir le parcours de ${u.pseudo ?? u.user_id}`}
        >
          <span className={`block font-bold text-sm ${u.pseudo ? '' : 'italic text-plum/50'}`}>{u.pseudo ?? 'Sans pseudo'}</span>
          <span className='flex items-center gap-1.5 mt-0.5'>
            <span className={`text-[10px] font-bold px-1.5 rounded-full border-2 border-plum ${u.is_anonymous ? 'bg-cream' : 'bg-fooder-mint'}`}>{accountBadge(u)}</span>
            <span className='font-mono text-[10px] text-plum/40'>{u.user_id.slice(0, 8)}</span>
          </span>
        </button>
      </td>
      <td className='px-2 py-2 text-sm font-semibold whitespace-nowrap'>
        <span className='inline-flex items-center gap-1.5'>
          <DeviceIcon form={u.form} />
          <span className={u.platform || u.browser ? '' : 'text-plum/50'}>{deviceLabel(u)}</span>
        </span>
      </td>
      <td className={TD}>{dateTime(u.first_seen)}</td>
      <td className={TD}>{dateTime(u.last_seen)}</td>
      <td className={`${TD} text-right`}>{formatNumber(u.sessions)}</td>
      <td className={`${TD} text-right`}>{formatDuration(u.active_s)}</td>
      <td className={`${TD} text-right`}>{formatNumber(u.likes)}</td>
      <td className={`${TD} text-right`}>{formatNumber(u.photos)}</td>
    </tr>
  );
}

function UsersError({ error, onRetry }: { error: AdminError; onRetry: () => void }) {
  const migration = error.error === 'missing_migration';
  return (
    <div role='alert' className={`border-[3px] border-plum rounded-2xl p-4 ${migration ? 'bg-fooder-secondary' : 'bg-bubblegum'}`}>
      <p className='font-bold text-sm'>{migration ? 'Pas encore de données : joue la migration 20261115000000_admin_users.sql dans Supabase (SQL Editor).' : error.message}</p>
      <button type='button' onClick={onRetry} className='mt-3 rounded-full border-[3px] border-plum bg-white font-bold text-sm px-4 py-1.5 shadow-[0_3px_0_#2B0F3A] active:translate-y-[3px] active:shadow-none'>
        Réessayer
      </button>
    </div>
  );
}

/** Section « Utilisateurs » : qui sont-ils (pseudo, appareil), recherchable et paginée, plus la répartition des appareils. */
export function UsersSection({ days, onOpenUser }: { days: number; onOpenUser: (id: string) => void }) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  // Recherche différée : une seule requête après 300 ms sans frappe
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = input.trim();
      if (next === q) return;
      setQ(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [input, q]);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/admin/users?days=${days}&page=${page}&q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const body = (await res.json()) as UsersResponse | AdminError;
      if (res.status === 401) {
        router.refresh();
        return;
      }
      setState(!res.ok || 'error' in body ? { kind: 'error', error: 'error' in body ? body : { error: 'upstream', message: 'Réponse inattendue.' } } : { kind: 'ready', data: body });
    } catch {
      setState({ kind: 'error', error: { error: 'upstream', message: 'Pas de connexion au serveur.' } });
    }
  }, [days, page, q, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const data = state.kind === 'ready' ? state.data : null;
  const total = data?.users.total ?? 0;
  const pages = pageCount(total);

  return (
    <>
      <Panel id='devices' kicker={`Utilisateurs actifs · ${days} derniers jours`} title='Appareils'>
        {state.kind === 'loading' && <Skeleton className='h-40' />}
        {state.kind === 'error' && <UsersError error={state.error} onRetry={() => void load()} />}
        {data && <DeviceBars devices={data.devices} />}
      </Panel>

      <Panel
        id='users'
        kicker='Qui utilise Fooder'
        title='Utilisateurs'
        aside={
          <form onSubmit={e => e.preventDefault()} role='search'>
            <label htmlFor='users-search' className='sr-only'>
              Rechercher un pseudo ou un identifiant
            </label>
            <div className='relative'>
              <Search className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-plum/50' strokeWidth={3} aria-hidden />
              <input
                id='users-search'
                value={input}
                onChange={e => setInput(e.target.value)}
                maxLength={40}
                placeholder='Pseudo ou identifiant'
                autoComplete='off'
                spellCheck={false}
                className='w-52 rounded-2xl border-[3px] border-plum bg-cream pl-9 pr-3 py-1.5 text-sm font-semibold outline-none focus:bg-white focus:shadow-hard-violet'
              />
            </div>
          </form>
        }
      >
        {state.kind === 'loading' && (
          <div aria-busy='true' aria-label='Chargement des utilisateurs' className='space-y-2'>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className='h-10' />
            ))}
          </div>
        )}
        {state.kind === 'error' && <UsersError error={state.error} onRetry={() => void load()} />}
        {data && data.users.rows.length === 0 && <Empty>{q ? `Aucun utilisateur ne correspond à « ${q} ».` : 'Pas encore de données : aucun utilisateur enregistré pour l’instant.'}</Empty>}
        {data && data.users.rows.length > 0 && (
          <>
            <div className='overflow-x-auto -mx-1'>
              <table className='w-full min-w-[820px]'>
                <thead>
                  <tr>
                    <th className={TH}>Pseudo</th>
                    <th className={TH}>Appareil</th>
                    <th className={TH}>Première visite</th>
                    <th className={TH}>Dernière activité</th>
                    <th className={`${TH} text-right`}>Sessions</th>
                    <th className={`${TH} text-right`}>Temps actif</th>
                    <th className={`${TH} text-right`}>Likes</th>
                    <th className={`${TH} text-right`}>Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.rows.map(u => (
                    <Row key={u.user_id} u={u} onOpen={onOpenUser} />
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label='Pagination des utilisateurs' className='flex items-center justify-between gap-3 mt-4 text-sm font-bold'>
              <span className='text-plum/60 text-xs font-semibold'>
                {formatNumber(total)} utilisateur{total > 1 ? 's' : ''} · {PAGE_SIZE} par page
              </span>
              <span className='flex items-center gap-2'>
                <button type='button' disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label='Page précédente' className='w-9 h-9 rounded-full border-[3px] border-plum bg-white flex items-center justify-center disabled:opacity-30'>
                  <ChevronLeft className='w-4 h-4' strokeWidth={3} />
                </button>
                <span className='tabular-nums'>
                  {page} / {pages}
                </span>
                <button type='button' disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label='Page suivante' className='w-9 h-9 rounded-full border-[3px] border-plum bg-white flex items-center justify-center disabled:opacity-30'>
                  <ChevronRight className='w-4 h-4' strokeWidth={3} />
                </button>
              </span>
            </nav>
          </>
        )}
      </Panel>
    </>
  );
}
