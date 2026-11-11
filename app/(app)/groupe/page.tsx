'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/nav/PageHeader';
import { GroupCreate } from '../../../components/group/GroupCreate';
import { GroupPlay } from '../../../components/group/GroupPlay';
import { GroupResults } from '../../../components/group/GroupResults';
import { Sticker } from '../../../components/ui/Sticker';
import { useToast } from '../../../components/ui/Toast';
import { getMe } from '../../../lib/identity';
import { decodePayload, encodePayload, readHashParam } from '../../../lib/social/codec';
import { GroupResto, GroupSession, createGroup, deleteGroup, findGroup, mergeGroups, parseGroup, readGroups, saveGroup, withVote } from '../../../lib/social/group';
import { outcomeLabel, shareLink } from '../../../lib/share';
import { XP, awardXp, unlockAchievement } from '../../../lib/rewards';
import { timeAgo } from '../../../lib/feed';
import { track } from '../../../lib/analytics';
import { useAuth } from '../../../components/auth/AuthProvider';
import { pullGroupVotes, syncGroup, watchGroup } from '../../../lib/cloud/social';

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'play'; id: string } | { kind: 'results'; id: string };

export default function GroupPage() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [myId, setMyId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const toast = useToast();
  const auth = useAuth();

  const reload = () => setGroups(readGroups());

  useEffect(() => {
    const me = getMe();
    setMyId(me.id);
    const ingest = async () => {
      const raw = readHashParam('g');
      if (raw) {
        window.history.replaceState(null, '', '/groupe');
        const incoming = parseGroup(await decodePayload(raw));
        if (!incoming) {
          setNotice('Ce lien de session est illisible. Demande qu’on te le renvoie.');
        } else {
          const local = findGroup(incoming.id);
          const merged = local ? mergeGroups(local, incoming) : incoming;
          saveGroup(merged);
          const voted = merged.votes.some(v => v.voterId === me.id);
          setView(voted ? { kind: 'results', id: merged.id } : { kind: 'play', id: merged.id });
          if (local) toast.show('Votes du groupe mis à jour');
        }
      } else if (new URLSearchParams(window.location.search).get('new')) {
        setView({ kind: 'create' });
      }
      reload();
    };
    ingest();
    // Lien ouvert alors que l'écran est déjà affiché (seul le # change)
    window.addEventListener('hashchange', ingest);
    return () => window.removeEventListener('hashchange', ingest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = view.kind === 'play' || view.kind === 'results' ? groups.find(g => g.id === view.id) : undefined;
  const currentId = current?.id;

  // Connecté : on rejoint la session côté serveur et on suit les votes en direct.
  useEffect(() => {
    if (!auth.uid || !currentId) return;
    const session = findGroup(currentId);
    if (!session) return;
    syncGroup(session, auth.uid).then(reload).catch(() => undefined);
    return watchGroup(currentId, () => {
      const s = findGroup(currentId);
      if (s) pullGroupVotes(s).then(reload).catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.uid, currentId]);

  const create = (title: string, restos: GroupResto[]) => {
    const me = getMe();
    const session = createGroup(title, { id: me.id, name: me.name }, restos);
    awardXp(XP.group);
    track('group_created', { restos: restos.length });
    reload();
    setView({ kind: 'play', id: session.id });
  };

  const vote = (session: GroupSession, likes: string[]) => {
    const me = getMe();
    const first = !session.votes.some(v => v.voterId === me.id);
    const myVote = { voterId: me.id, name: me.name, likes, at: Date.now() };
    const next = withVote(session, myVote);
    saveGroup(next);
    if (auth.uid) syncGroup(next, auth.uid, myVote).then(reload).catch(() => toast.show('Vote enregistré ici, synchro plus tard'));
    if (first) {
      if (session.host.id !== me.id) awardXp(XP.groupVote);
      unlockAchievement('group_1');
    }
    track('group_voted', { likes: likes.length });
    reload();
    setView({ kind: 'results', id: session.id });
  };

  const share = async (session: GroupSession) => {
    const url = `${window.location.origin}/groupe#g=${await encodePayload(session)}`;
    const outcome = await shareLink({
      title: session.title,
      text: `${session.title} · ${session.restos.length} restos à swiper, on garde ceux qu’on aime tous. Ouvre et vote :`,
      url,
    });
    const msg = outcomeLabel(outcome);
    if (msg) toast.show(msg);
  };

  const title = view.kind === 'create' ? 'Nouvelle session' : current ? current.title : 'On mange où ?';

  return (
    <div className='h-full flex flex-col'>
      <PageHeader
        title={view.kind === 'list' ? 'On mange où ?' : title}
        subtitle={view.kind === 'list' ? 'Chacun swipe, l’appli trouve le resto commun' : undefined}
        right={
          view.kind === 'list' ? (
            <Link href='/amis' aria-label='Retour' className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard shrink-0'>
              <ArrowLeft className='w-5 h-5 text-plum' strokeWidth={2.5} />
            </Link>
          ) : (
            <button
              onClick={() => setView({ kind: 'list' })}
              aria-label='Retour aux sessions'
              className='w-11 h-11 bg-white border-[3px] border-plum rounded-full flex items-center justify-center shadow-hard shrink-0'
            >
              <ArrowLeft className='w-5 h-5 text-plum' strokeWidth={2.5} />
            </button>
          )
        }
      />

      {view.kind === 'play' && current ? (
        <div className='flex-1 min-h-0'>
          <GroupPlay session={current} onDone={likes => vote(current, likes)} />
        </div>
      ) : (
        <div className='flex-1 min-h-0 scroll-y px-4 py-4 space-y-4'>
          {notice && <p className='bg-white rounded-2xl border-[3px] border-plum p-3 text-sm font-bold text-plum'>{notice}</p>}

          {view.kind === 'create' && <GroupCreate onCreate={create} onCancel={() => setView({ kind: 'list' })} />}

          {view.kind === 'results' && current && (
            <GroupResults session={current} myId={myId} onShare={() => share(current)} onRevote={() => setView({ kind: 'play', id: current.id })} />
          )}

          {view.kind === 'list' && (
            <>
              <button onClick={() => setView({ kind: 'create' })} className='w-full duo-button bg-bubblegum text-plum py-4 text-lg flex items-center justify-center gap-2'>
                <Plus className='w-5 h-5' strokeWidth={3} /> Nouvelle session
              </button>

              <ol className='bg-white rounded-[28px] panel p-4 space-y-2 text-sm font-bold text-plum'>
                <li>1. Choisis 3 à 12 restos (tes coups de cœur d’abord).</li>
                <li>2. Swipe-les, puis envoie la session dans la conversation du groupe.</li>
                <li>3. Chacun swipe et renvoie son lien : ouvre-les, les votes s’additionnent.</li>
              </ol>

              {groups.length === 0 ? (
                <div className='flex flex-col items-center text-center gap-2 py-6'>
                  <Sticker name='b_dice' size={84} rotate={-8} className='bob' />
                  <p className='text-sm font-bold text-plum/70'>Aucune session pour l’instant.</p>
                </div>
              ) : (
                <ul className='space-y-2'>
                  {groups.map(g => (
                    <li key={g.id} className='flex items-center gap-2 bg-white rounded-2xl border-[3px] border-plum shadow-hard p-3'>
                      <button
                        onClick={() => setView(g.votes.some(v => v.voterId === myId) ? { kind: 'results', id: g.id } : { kind: 'play', id: g.id })}
                        className='flex-1 min-w-0 text-left'
                      >
                        <span className='block font-bold text-plum truncate'>{g.title}</span>
                        <span className='block text-[11px] font-bold text-plum/50'>
                          {g.restos.length} restos · {g.votes.length} vote{g.votes.length > 1 ? 's' : ''} · {timeAgo(g.at)}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          deleteGroup(g.id);
                          reload();
                        }}
                        aria-label={`Supprimer ${g.title}`}
                        className='w-9 h-9 shrink-0 flex items-center justify-center text-plum/40'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}
