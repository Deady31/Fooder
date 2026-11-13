'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { describeEvent, formatDuration, formatNumber, isUuid } from '../../lib/admin/metrics';
import type { AdminError, RecentUser, TimelineRow, UserPayload } from '../../lib/admin/types';
import { Empty, Skeleton } from './ui';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const shortId = (id: string) => `${id.slice(0, 8)}…`;

const DOT: Record<string, string> = {
  session_start: 'bg-fooder-mint',
  session_end: 'bg-plum/30',
  screen_view: 'bg-fooder-secondary',
  click: 'bg-white',
  swipe_like: 'bg-fooder-red',
  swipe_pass: 'bg-plum/40',
  open_card: 'bg-fooder-orange',
  checkin: 'bg-fooder-primary',
};

interface SessionGroup {
  id: string;
  rows: TimelineRow[];
}

/** Regroupe par session, sessions les plus récentes d'abord, événements dans l'ordre chronologique. */
function groupBySession(rows: TimelineRow[]): SessionGroup[] {
  const map = new Map<string, TimelineRow[]>();
  for (const r of rows) {
    const k = r.session_id ?? '—';
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return Array.from(map.entries()).map(([id, list]) => ({ id, rows: [...list].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
}

function extra(r: TimelineRow, names: Record<string, string>): string {
  const bits: string[] = [];
  if (r.rest_id) bits.push(names[r.rest_id] ?? r.rest_id);
  for (const [k, v] of Object.entries(r.props ?? {})) {
    if (r.name === 'click' && (k === 'label' || k === 'tag')) continue;
    bits.push(`${k}: ${String(v)}`);
  }
  return bits.join(' · ');
}

/** `open` : demande d'ouverture venue de la liste des utilisateurs (nonce = relance même pour le même utilisateur). */
export function UserJourney({ recent, open = null }: { recent: RecentUser[]; open?: { id: string; nonce: number } | null }) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<UserPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (id: string) => {
    const clean = id.trim().toLowerCase();
    setQuery(clean);
    if (!isUuid(clean)) {
      setError('Colle un identifiant utilisateur complet (UUID, ex. 5f0c1f8e-4a2b-…).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/metrics?user=${encodeURIComponent(clean)}`, { cache: 'no-store' });
      const body = (await res.json()) as UserPayload | AdminError;
      if (!res.ok || 'error' in body) {
        setData(null);
        setError('message' in body ? body.message : 'Chargement impossible.');
      } else setData(body);
    } catch {
      setError('Pas de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load(open.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.nonce]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void load(query);
  };

  const sessions = useMemo(() => (data ? groupBySession(data.timeline) : []), [data]);

  return (
    <div className='grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]'>
      <div className='min-w-0'>
        <form onSubmit={submit} className='flex gap-2'>
          <label htmlFor='journey-user' className='sr-only'>
            Identifiant utilisateur
          </label>
          <input
            id='journey-user'
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='user_id (UUID)'
            spellCheck={false}
            className='flex-1 min-w-0 rounded-2xl border-[3px] border-plum bg-cream px-3 py-2 font-mono text-xs outline-none focus:bg-white focus:shadow-hard-violet'
          />
          <button type='submit' aria-label='Afficher le parcours' className='shrink-0 w-11 rounded-2xl border-[3px] border-plum bg-fooder-secondary flex items-center justify-center shadow-[0_3px_0_#2B0F3A] active:translate-y-[3px] active:shadow-none'>
            <Search className='w-4 h-4' strokeWidth={3} />
          </button>
        </form>
        <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-plum/50 mt-4 mb-2'>Derniers actifs</p>
        {recent.length === 0 ? (
          <Empty>Personne pour l’instant.</Empty>
        ) : (
          <ul className='space-y-1.5 max-h-80 overflow-y-auto pr-1'>
            {recent.map(u => (
              <li key={u.user_id}>
                <button
                  type='button'
                  onClick={() => void load(u.user_id)}
                  className={`w-full text-left rounded-2xl border-2 px-3 py-2 transition-colors ${data?.info.user_id === u.user_id ? 'border-plum bg-fooder-secondary' : 'border-plum/20 bg-white hover:border-plum'}`}
                >
                  <span className='flex items-center justify-between gap-2'>
                    <span className='font-mono text-xs font-bold'>{shortId(u.user_id)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-plum ${u.is_anonymous ? 'bg-cream' : 'bg-fooder-mint'}`}>{u.is_anonymous ? 'anonyme' : 'e-mail'}</span>
                  </span>
                  <span className='block text-[11px] font-semibold text-plum/60 mt-0.5'>
                    vu {dateTime(u.last_seen)} · {formatNumber(u.sessions)} sess. · {formatNumber(u.events)} évts
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className='min-w-0'>
        {error && (
          <p role='alert' className='text-sm font-bold text-fooder-red mb-3'>
            {error}
          </p>
        )}
        {loading ? (
          <div className='space-y-2'>
            <Skeleton className='h-20' />
            <Skeleton className='h-48' />
          </div>
        ) : !data ? (
          <Empty>Choisis un utilisateur pour revoir son parcours, écran par écran.</Empty>
        ) : (
          <div>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4'>
              {[
                ['Compte', data.info.exists ? (data.info.is_anonymous ? 'Anonyme' : data.info.has_email ? 'E-mail' : 'Autre') : 'Supprimé'],
                ['Premier passage', dateTime(data.info.first_seen)],
                ['Sessions', formatNumber(data.info.sessions)],
                ['Temps actif', formatDuration(Number(data.info.active_s))],
              ].map(([k, v]) => (
                <div key={k} className='rounded-2xl border-2 border-plum bg-cream px-3 py-2 min-w-0'>
                  <p className='text-[10px] font-bold uppercase tracking-[0.12em] text-plum/55'>{k}</p>
                  <p className='font-bold text-sm truncate'>{v}</p>
                </div>
              ))}
            </div>
            {sessions.length === 0 ? (
              <Empty>Aucun événement enregistré pour cet utilisateur.</Empty>
            ) : (
              <div className='space-y-4 max-h-[560px] overflow-y-auto pr-1'>
                {sessions.map(s => (
                  <section key={s.id} aria-label={`Session du ${dateTime(s.rows[0].created_at)}`}>
                    <h3 className='sticky top-0 z-10 bg-white/95 backdrop-blur text-xs font-bold text-plum/70 py-1 flex justify-between gap-2'>
                      <span>Session du {dateTime(s.rows[0].created_at)}</span>
                      <span className='font-mono text-plum/40 truncate'>{s.id.slice(0, 8)}</span>
                    </h3>
                    <ol className='border-l-[3px] border-plum/15 ml-1.5 mt-1'>
                      {s.rows.map((r, i) => (
                        <li key={`${r.created_at}-${i}`} className='relative pl-4 py-1'>
                          <span className={`absolute -left-[8px] top-2.5 w-3 h-3 rounded-full border-2 border-plum ${DOT[r.name] ?? 'bg-bubblegum'}`} aria-hidden />
                          <div className='flex flex-wrap items-baseline gap-x-2 text-sm'>
                            <time dateTime={r.created_at} className='font-mono text-[11px] text-plum/50 tabular-nums'>
                              {time(r.created_at)}
                            </time>
                            <span className='font-bold'>{describeEvent(r.name, r.props)}</span>
                            {r.screen && <span className='font-mono text-[11px] px-1.5 rounded-md bg-cream border border-plum/20'>{r.screen}</span>}
                          </div>
                          {extra(r, data.restoNames) && <p className='text-xs font-medium text-plum/60 break-words'>{extra(r, data.restoNames)}</p>}
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
