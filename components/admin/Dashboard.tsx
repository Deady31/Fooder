'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';
import { DEFAULT_FUNNEL, PERIODS, Period, buildFunnel, buildRetention, formatDuration, formatNumber, formatPct, rate } from '../../lib/admin/metrics';
import type { AdminError, MetricsPayload } from '../../lib/admin/types';
import { DailyChart } from './DailyChart';
import { FunnelView } from './FunnelView';
import { RetentionTable } from './RetentionTable';
import { TopRestos, TopScreens } from './TopLists';
import { UserJourney } from './UserJourney';
import { ChipButton, Empty, Kpi, Panel, Skeleton } from './ui';

type LoadState = { kind: 'loading' } | { kind: 'error'; error: AdminError } | { kind: 'ready'; data: MetricsPayload };

export function Dashboard() {
  const router = useRouter();
  const [days, setDays] = useState<Period>(30);
  const [steps, setSteps] = useState<string[]>(DEFAULT_FUNNEL);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/metrics?days=${days}&steps=${encodeURIComponent(steps.join(','))}`, { cache: 'no-store' });
      const body = (await res.json()) as MetricsPayload | AdminError;
      if (res.status === 401) {
        router.refresh();
        return;
      }
      setState(!res.ok || 'error' in body ? { kind: 'error', error: 'error' in body ? body : { error: 'upstream', message: 'Réponse inattendue.' } } : { kind: 'ready', data: body });
    } catch {
      setState({ kind: 'error', error: { error: 'upstream', message: 'Pas de connexion au serveur.' } });
    } finally {
      setRefreshing(false);
    }
  }, [days, steps, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    router.refresh();
  };

  const data = state.kind === 'ready' ? state.data : null;

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6 pb-16'>
      <header className='flex flex-wrap items-center justify-between gap-3 pt-6 pb-5'>
        <div>
          <p className='inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-plum/60'>
            <span className='w-2.5 h-2.5 rounded-full bg-fooder-mint border-2 border-plum' aria-hidden />
            Fooder · QG
          </p>
          <h1 className='font-display text-4xl sm:text-5xl leading-none mt-1'>
            Backoffice<span className='text-fooder-primary'>.</span>
          </h1>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex gap-1.5' role='group' aria-label='Période'>
            {PERIODS.map(p => (
              <ChipButton key={p} active={p === days} onClick={() => setDays(p)} label={`${p} derniers jours`}>
                {p} j
              </ChipButton>
            ))}
          </div>
          <button type='button' onClick={() => void load()} aria-label='Actualiser' className='w-10 h-10 rounded-full border-[3px] border-plum bg-white flex items-center justify-center shadow-[0_3px_0_#2B0F3A] active:translate-y-[3px] active:shadow-none'>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={3} />
          </button>
          <button type='button' onClick={() => void logout()} aria-label='Se déconnecter' className='w-10 h-10 rounded-full border-[3px] border-plum bg-plum text-cream flex items-center justify-center shadow-[0_3px_0_#6C2BFF] active:translate-y-[3px] active:shadow-none'>
            <LogOut className='w-4 h-4' strokeWidth={3} />
          </button>
        </div>
      </header>

      {state.kind === 'loading' && <LoadingView />}
      {state.kind === 'error' && <ErrorView error={state.error} onRetry={() => void load()} />}
      {data && <ReadyView data={data} steps={steps} onSteps={setSteps} />}
    </div>
  );
}

function LoadingView() {
  return (
    <div className='space-y-4' aria-busy='true' aria-label='Chargement des métriques'>
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className='h-24' />
        ))}
      </div>
      <Skeleton className='h-72' />
      <div className='grid lg:grid-cols-2 gap-4'>
        <Skeleton className='h-80' />
        <Skeleton className='h-80' />
      </div>
    </div>
  );
}

function ErrorView({ error, onRetry }: { error: AdminError; onRetry: () => void }) {
  const migration = error.error === 'missing_migration';
  return (
    <div className={`border-[3px] border-plum rounded-3xl shadow-hard-lg p-6 sm:p-8 ${migration ? 'bg-fooder-secondary' : 'bg-bubblegum'}`}>
      <p className='text-[11px] font-bold uppercase tracking-[0.14em]'>{migration ? 'Base pas encore prête' : 'Erreur'}</p>
      <h2 className='font-display text-3xl mt-1 leading-tight'>{migration ? 'Pas encore de données : joue la migration.' : 'Les chiffres n’ont pas pu être chargés.'}</h2>
      <p className='mt-2 font-semibold'>{error.message}</p>
      {migration && (
        <ol className='mt-4 list-decimal pl-5 text-sm font-semibold space-y-1'>
          <li>Supabase → SQL Editor.</li>
          <li>
            Exécute dans l’ordre <code className='font-mono'>20261112000000_anonymous.sql</code>, <code className='font-mono'>20261112000100_events.sql</code>, puis <code className='font-mono'>20261113000000_tracking.sql</code>.
          </li>
          <li>Reviens ici et actualise.</li>
        </ol>
      )}
      <button type='button' onClick={onRetry} className='mt-5 rounded-full border-[3px] border-plum bg-white font-bold px-5 py-2 shadow-[0_4px_0_#2B0F3A] active:translate-y-[4px] active:shadow-none'>
        Réessayer
      </button>
    </div>
  );
}

function ReadyView({ data, steps, onSteps }: { data: MetricsPayload; steps: string[]; onSteps: (s: string[]) => void }) {
  const o = data.overview;
  const funnel = useMemo(() => buildFunnel(data.funnel), [data.funnel]);
  const retention = useMemo(() => buildRetention(data.retention), [data.retention]);
  const totals = useMemo(() => buildRetention.totals(retention), [retention]);
  const n = (v: unknown) => formatNumber(v);
  const noEvents = Number(o.events) === 0;
  const stickiness = rate(Number(o.dau), Number(o.mau));

  return (
    <div className='space-y-5'>
      {noEvents && (
        <div className='border-[3px] border-plum rounded-3xl bg-fooder-secondary shadow-hard p-4 font-semibold text-sm'>
          Aucun événement sur les {data.days} derniers jours. Ouvre l’appli (cloud configuré, réglage « Aider à améliorer Fooder » actif) : les premières mesures arrivent en quelques secondes.
        </div>
      )}

      <section aria-label='Indicateurs clés' className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div className='col-span-2 md:row-span-2'>
          <div className='h-full border-[3px] border-plum rounded-3xl shadow-hard-lg bg-fooder-primary text-white p-5 flex flex-col justify-between min-h-[180px] relative overflow-hidden'>
            <span className='absolute -right-6 -top-6 w-28 h-28 rounded-full bg-bubblegum border-[3px] border-plum' aria-hidden />
            <span className='absolute right-10 top-12 w-10 h-10 rounded-full bg-fooder-secondary border-[3px] border-plum' aria-hidden />
            <p className='text-[11px] font-bold uppercase tracking-[0.14em] opacity-80 relative'>Utilisateurs</p>
            <div className='relative'>
              <p className='font-display text-6xl sm:text-7xl leading-none tabular-nums'>{n(o.users_total)}</p>
              <p className='mt-2 text-sm font-bold'>
                <span className='bg-white text-plum rounded-full px-2 py-0.5 border-2 border-plum'>{n(o.users_email)} e-mail</span>{' '}
                <span className='bg-cream text-plum rounded-full px-2 py-0.5 border-2 border-plum'>{n(o.users_anonymous)} anonymes</span>
              </p>
            </div>
          </div>
        </div>
        <Kpi label='Nouveaux · 7 j' value={n(o.new_7d)} hint={`${n(o.new_period)} sur ${data.days} j`} tone='mint' />
        <Kpi label='Actifs · 24 h' value={n(o.dau)} hint={`DAU/MAU ${formatPct(stickiness)}`} tone='lemon' />
        <Kpi label='Actifs · 7 j' value={n(o.wau)} hint='WAU' />
        <Kpi label='Actifs · 30 j' value={n(o.mau)} hint='MAU' />
        <Kpi label='Sessions' value={n(o.sessions)} hint={`sur ${data.days} j`} tone='orange' />
        <Kpi label='Durée moy.' value={formatDuration(Number(o.avg_session_s))} hint={`médiane ${formatDuration(Number(o.median_session_s))}`} />
        <Kpi label='Temps actif moy.' value={formatDuration(Number(o.avg_active_s))} hint='par session' tone='bubblegum' />
        <Kpi label='Événements' value={n(o.events)} hint={`${n(o.active_period)} pers. actives`} tone='cream' />
      </section>

      <Panel id='daily' kicker={`${data.days} derniers jours`} title='Évolution quotidienne'>
        <DailyChart rows={data.daily} />
      </Panel>

      <div className='grid lg:grid-cols-2 gap-5'>
        <Panel id='funnel' kicker='Utilisateurs distincts, étapes dans l’ordre' title='Funnel'>
          <FunnelView steps={funnel} current={steps} events={data.events} onChange={onSteps} />
        </Panel>
        <Panel id='retention' kicker={data.days > 30 ? 'Cohortes par semaine' : 'Cohortes par jour'} title='Rétention'>
          <RetentionTable rows={retention} totals={totals} weekly={data.days > 30} />
        </Panel>
      </div>

      <Panel id='business' kicker={`${data.days} derniers jours`} title='Activité produit'>
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5'>
          <Kpi label='Likes' value={n(o.likes)} hint={`taux ${formatPct(rate(Number(o.likes), Number(o.likes) + Number(o.passes)))}`} tone='bubblegum' />
          <Kpi label='Passes' value={n(o.passes)} />
          <Kpi label='Fiches ouvertes' value={n(o.opens)} />
          <Kpi label='Check-ins' value={n(o.checkins)} tone='mint' />
          <Kpi label='Posts' value={n(o.posts)} hint={`${n(o.photos)} avec photo`} />
          <Kpi label='Invitations' value={n(o.invitations)} hint='partages, liens, défis' tone='lemon' />
          <Kpi label='Groupes créés' value={n(o.groups_created)} hint={`${n(o.groups_joined)} rejoints`} />
          <Kpi label='Amitiés' value={n(o.friendships)} hint={`${n(o.friends_added)} ajouts`} />
          <Kpi label='Comptes sauvegardés' value={n(o.signups)} tone='violet' />
        </div>
      </Panel>

      <div className='grid lg:grid-cols-2 gap-5'>
        <Panel id='screens' kicker='Vues, personnes, temps actif' title='Top écrans'>
          <TopScreens rows={data.screens} />
        </Panel>
        <Panel id='restos' kicker='Likes, passes, ouvertures' title='Top restos'>
          <TopRestos rows={data.restos} />
        </Panel>
      </div>

      <Panel id='journey' kicker='Timeline chronologique' title='Parcours d’un utilisateur'>
        <UserJourney recent={data.recentUsers} />
      </Panel>

      {data.events.length > 0 && (
        <Panel id='events' kicker='Pour composer un funnel' title='Événements reçus'>
          <ul className='flex flex-wrap gap-1.5'>
            {data.events.map(e => (
              <li key={e.name} className='font-mono text-xs border-2 border-plum rounded-full px-2.5 py-1 bg-cream'>
                {e.name} <span className='font-bold text-fooder-primary'>{n(e.events)}</span>
                <span className='text-plum/50'> · {n(e.users)} pers.</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {data.events.length === 0 && !noEvents && <Empty>Aucun événement.</Empty>}

      <p className='text-center text-[11px] font-semibold text-plum/45'>Mis à jour {new Date(data.generatedAt).toLocaleString('fr-FR')} · heure de Paris pour les découpages par jour</p>
    </div>
  );
}
