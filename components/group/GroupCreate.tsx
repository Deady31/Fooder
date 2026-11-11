'use client';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Restaurant } from '../../data/mockRestaurants';
import { Sticker } from '../ui/Sticker';
import { stickerFor } from '../../lib/stickers';
import { readJson } from '../../lib/store';
import { quartierFor } from '../../lib/quartiers';
import { GROUP_LIMITS, GroupResto } from '../../lib/social/group';

interface GroupCreateProps {
  onCreate: (title: string, restos: GroupResto[]) => void;
  onCancel: () => void;
}

const toGroupResto = (r: Restaurant): GroupResto => ({
  id: r.id,
  name: r.name,
  cuisine: r.cuisine,
  quartier: r.lat !== undefined && r.lng !== undefined ? quartierFor(r.lat, r.lng) ?? undefined : undefined,
});

/** Prépare la sélection : tes coups de cœur d'abord, complétés par des restos proches. */
export function GroupCreate({ onCreate, onCancel }: GroupCreateProps) {
  const [title, setTitle] = useState('Ce soir, on mange où ?');
  const [candidates, setCandidates] = useState<GroupResto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const likes = readJson<Restaurant[]>('fooder_likes', []).slice().reverse().map(toGroupResto);
    const init = (list: GroupResto[]) => {
      setCandidates(list);
      setSelected(new Set(list.slice(0, 8).map(r => r.id)));
      setLoading(false);
    };
    if (likes.length >= 8) return init(likes.slice(0, 20));
    fetch('/api/restaurants?limit=20')
      .then(r => r.json())
      .then(json => {
        const have = new Set(likes.map(l => l.id));
        const near = json.success ? (json.data as Restaurant[]).filter(r => !have.has(r.id)).map(toGroupResto) : [];
        init([...likes, ...near].slice(0, 20));
      })
      .catch(() => init(likes));
  }, []);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < GROUP_LIMITS.restos) next.add(id);
      return next;
    });

  const count = selected.size;
  const valid = count >= GROUP_LIMITS.minRestos;

  return (
    <div className='space-y-4'>
      <section className='bg-white rounded-[28px] panel p-4 space-y-2'>
        <label htmlFor='group-title' className='text-[11px] font-black text-plum/60'>Nom de la session</label>
        <input
          id='group-title'
          value={title}
          maxLength={GROUP_LIMITS.title}
          onChange={e => setTitle(e.target.value)}
          className='w-full rounded-xl border-[3px] border-plum px-3 py-2 font-bold text-plum'
        />
      </section>

      <section className='space-y-2'>
        <div className='flex items-end justify-between px-1'>
          <h2 className='text-xl text-plum leading-none'>La sélection</h2>
          <span className='text-xs font-black text-plum/60'>{count}/{GROUP_LIMITS.restos} · min. {GROUP_LIMITS.minRestos}</span>
        </div>
        {loading ? (
          <p className='text-sm font-bold text-plum/60 px-1'>On prépare la sélection…</p>
        ) : candidates.length < GROUP_LIMITS.minRestos ? (
          <p className='text-sm font-bold text-plum/60 px-1'>Pas assez de restos : swipe un peu d’abord.</p>
        ) : (
          <ul className='space-y-2'>
            {candidates.map(r => {
              const on = selected.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    onClick={() => toggle(r.id)}
                    aria-pressed={on}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border-[3px] border-plum text-left transition-all ${on ? 'bg-white shadow-hard' : 'bg-white/50 opacity-70'}`}
                  >
                    <Sticker name={stickerFor(r.cuisine, r.id, r.name)} size={40} />
                    <span className='flex-1 min-w-0'>
                      <span className='block font-bold text-sm text-plum truncate'>{r.name}</span>
                      <span className='block text-[11px] font-bold text-plum/50 truncate'>{[r.cuisine, r.quartier].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`w-7 h-7 shrink-0 rounded-full border-[3px] border-plum flex items-center justify-center ${on ? 'bg-fooder-mint' : 'bg-white'}`}>
                      {on && <Check className='w-4 h-4 text-plum' strokeWidth={3.5} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className='grid grid-cols-[1fr_2fr] gap-2.5 sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-cream/95 backdrop-blur-sm border-t-[3px] border-plum'>
        <button onClick={onCancel} className='duo-button bg-white text-plum py-3.5 text-sm'>Annuler</button>
        <button
          disabled={!valid}
          onClick={() => onCreate(title, candidates.filter(r => selected.has(r.id)))}
          className='duo-button bg-bubblegum text-plum py-3.5 text-base disabled:opacity-50'
        >
          Lancer la session
        </button>
      </div>
    </div>
  );
}
