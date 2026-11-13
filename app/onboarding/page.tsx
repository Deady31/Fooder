'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { StepProgress } from '../../components/onboarding/StepProgress';
import { WelcomeStep } from '../../components/onboarding/WelcomeStep';
import { PseudoStep } from '../../components/onboarding/PseudoStep';
import { FinalStep } from '../../components/onboarding/FinalStep';
import { HelpStep } from '../../components/onboarding/HelpStep';
import { MultiStep, SingleStep } from '../../components/onboarding/ChoiceSteps';
import {
  AGE_OPTIONS, AVERSION_OPTIONS, BUDGET_OPTIONS, COMPANION_OPTIONS, DIET_OPTIONS,
  FREQUENCY_OPTIONS, GENDER_OPTIONS, Option, VIBE_OPTIONS,
} from '../../components/onboarding/options';
import {
  AgeRange, Aversion, BudgetLevel, CUISINE_OPTIONS, Companion, Diet, Frequency, Gender, MAX_CUISINES,
  Vibe, buildProfile, completeOnboarding, hasCompletedOnboarding,
} from '../../lib/profile';
import { QUARTIERS } from '../../lib/quartiers';
import { rememberRef } from '../../lib/refParam';

type StepId =
  | 'welcome' | 'pseudo' | 'gender' | 'age' | 'cuisines' | 'diet' | 'budget'
  | 'vibes' | 'frequency' | 'aversions' | 'quartier' | 'companions' | 'help' | 'final';

const STEPS: StepId[] = [
  'welcome', 'pseudo', 'gender', 'age', 'cuisines', 'diet', 'budget',
  'vibes', 'frequency', 'aversions', 'quartier', 'companions', 'help', 'final',
];
const PROGRESS_TOTAL = STEPS.length - 1;

interface Draft {
  pseudo: string;
  gender: Gender | null;
  ageRange: AgeRange | null;
  cuisines: string[];
  diets: Diet[];
  budget: BudgetLevel | null;
  vibes: Vibe[];
  frequency: Frequency | null;
  aversions: Aversion[];
  quartier: string | null;
  companions: Companion | null;
}

const EMPTY_DRAFT: Draft = {
  pseudo: '', gender: null, ageRange: null, cuisines: [], diets: [], budget: null, vibes: [],
  frequency: null, aversions: [], quartier: null, companions: null,
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

const CUISINE_CHOICES: Option<string>[] = CUISINE_OPTIONS.map(c => ({ value: c.id, label: c.label, sticker: c.sticker }));
const QUARTIER_CHOICES: Option<string>[] = QUARTIERS.map(q => ({ value: q.name, label: q.name }));

export default function Onboarding() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    rememberRef(window.location.search);
    if (hasCompletedOnboarding()) router.replace('/swipe');
    else setChecked(true);
  }, [router]);

  const patch = (changes: Partial<Draft>) => setDraft(d => ({ ...d, ...changes }));

  const next = () => {
    setDir(1);
    setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  };
  const prev = () => {
    setDir(-1);
    setStepIdx(i => Math.max(i - 1, 0));
  };

  const profile = useMemo(() => buildProfile({ ...draft }), [draft]);

  const finish = () => {
    if (!profile) {
      setDir(-1);
      setStepIdx(STEPS.indexOf('pseudo'));
      return;
    }
    completeOnboarding(profile);
    router.push('/swipe');
  };

  const step = STEPS[stepIdx];

  if (!checked) return <div className='h-[100dvh] bg-cream' />;

  return (
    <div className='flex flex-col h-[100dvh] overflow-hidden bg-cream max-w-md mx-auto relative border-x-[3px] border-plum'>
      <AnimatePresence>
        {step !== 'welcome' && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className='flex items-center gap-3 px-5 pt-10 pb-3 z-10 flex-shrink-0'>
            <button type='button' onClick={prev} aria-label='Retour'
              className='p-2 rounded-full hover:bg-white transition-colors flex-shrink-0'>
              <ArrowLeft className='w-5 h-5 text-slate-500' />
            </button>
            <StepProgress index={stepIdx - 1} total={PROGRESS_TOTAL} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className='flex-1 overflow-hidden relative min-h-0'>
        <AnimatePresence mode='wait' custom={dir}>
          <motion.div key={step} custom={dir} variants={slideVariants}
            initial='enter' animate='center' exit='exit'
            transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
            className='absolute inset-0 flex flex-col'>
            {step === 'welcome' && <WelcomeStep onNext={next} />}

            {step === 'pseudo' && (
              <PseudoStep value={draft.pseudo} onChange={pseudo => patch({ pseudo })}
                onNext={pseudo => { patch({ pseudo }); next(); }} />
            )}

            {step === 'gender' && (
              <SingleStep kicker='On fait connaissance' title={<>Tu es plutôt…</>}
                subtitle='Pour mieux te parler. Aucun jugement sur ta commande de dessert.' sticker='boba'
                options={GENDER_OPTIONS} value={draft.gender} onPick={gender => patch({ gender })} onNext={next} />
            )}

            {step === 'age' && (
              <SingleStep kicker='Question indiscrète' title={<>Tu as quel âge ?</>}
                subtitle='On garde le gâteau pour les bougies.' sticker='cupcake'
                options={AGE_OPTIONS} value={draft.ageRange} onPick={ageRange => patch({ ageRange })} onNext={next} columns={2} />
            )}

            {step === 'cuisines' && (
              <MultiStep kicker='Tes envies' title={<>Tes cuisines<br />préférées</>}
                subtitle={`Jusqu'à ${MAX_CUISINES}, on s'occupe du reste.`} counter
                options={CUISINE_CHOICES} values={draft.cuisines} onChange={cuisines => patch({ cuisines })}
                onNext={next} columns={3} layout='tile' max={MAX_CUISINES} emptyCta='Je suis ouvert à tout' />
            )}

            {step === 'diet' && (
              <MultiStep kicker="Côté assiette" title={<>Un régime<br />particulier ?</>}
                subtitle="On trie pour toi : plus de mauvaise surprise." sticker='salad'
                options={DIET_OPTIONS} values={draft.diets} onChange={diets => patch({ diets })}
                onNext={next} columns={2} noneLabel='Aucun, je mange de tout' emptyCta='Continuer' />
            )}

            {step === 'budget' && (
              <SingleStep kicker='Le nerf de la guerre' title={<>Ton budget<br />habituel ?</>}
                subtitle='Par personne, sans te ruiner ni te priver.' sticker='b_coin'
                options={BUDGET_OPTIONS} value={draft.budget} onPick={budget => patch({ budget })} onNext={next} />
            )}

            {step === 'vibes' && (
              <MultiStep kicker="L'ambiance" title={<>Tu aimes quand<br />c&apos;est…</>}
                subtitle='Plusieurs réponses possibles.' sticker='wine'
                options={VIBE_OPTIONS} values={draft.vibes} onChange={vibes => patch({ vibes })}
                onNext={next} columns={2} emptyCta='Peu importe' />
            )}

            {step === 'frequency' && (
              <SingleStep kicker='Ton rythme' title={<>Tu sors manger<br />souvent ?</>}
                subtitle='Au resto, pas devant le frigo.' sticker='fries'
                options={FREQUENCY_OPTIONS} value={draft.frequency} onPick={frequency => patch({ frequency })} onNext={next} />
            )}

            {step === 'aversions' && (
              <MultiStep kicker='Les lignes rouges' title={<>Ce que tu<br />ne manges pas ?</>}
                subtitle='Coche tout ce qui te fait fuir.' sticker='b_flame'
                options={AVERSION_OPTIONS} values={draft.aversions} onChange={aversions => patch({ aversions })}
                onNext={next} columns={2} emptyCta='Je mange de tout !' />
            )}

            {step === 'quartier' && (
              <MultiStep kicker='Ton QG' title={<>Ton quartier<br />préféré ?</>}
                subtitle='Facultatif : pour te montrer ce qui est près de chez toi.' sticker='b_star'
                options={QUARTIER_CHOICES} values={draft.quartier ? [draft.quartier] : []}
                onChange={v => patch({ quartier: v[0] ?? null })}
                onNext={next} layout='pill' max={1} emptyCta='Passer' />
            )}

            {step === 'companions' && (
              <SingleStep kicker="Qui est à table ?" title={<>Tu manges<br />d&apos;habitude…</>}
                subtitle='Pour te proposer les bonnes adresses.' sticker='pizza'
                options={COMPANION_OPTIONS} value={draft.companions} onPick={companions => patch({ companions })} onNext={next} />
            )}

            {step === 'help' && <HelpStep onNext={next} />}

            {step === 'final' && profile && <FinalStep profile={profile} onGo={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
