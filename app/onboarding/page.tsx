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
import { AGE_OPTIONS, DIET_OPTIONS, GENDER_OPTIONS } from '../../components/onboarding/options';
import { buildProfile, completeOnboarding, hasCompletedOnboarding, resetOnboardingForReplay } from '../../lib/profile';
import { EMPTY_ANSWERS, ONBOARDING_STEPS, OnboardingAnswers, clearDraft, readDraft, writeDraft } from '../../lib/onboardingDraft';
import { rememberRef, wantsReplay, withoutReplayParam } from '../../lib/refParam';

const STEPS = ONBOARDING_STEPS;
const PROGRESS_TOTAL = STEPS.length - 1;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function Onboarding() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<OnboardingAnswers>(EMPTY_ANSWERS);

  useEffect(() => {
    const search = window.location.search;
    rememberRef(search);
    if (wantsReplay(search)) {
      // Rejouer pour le test : on repart de l'accueil et on retire le paramètre pour éviter une boucle.
      resetOnboardingForReplay();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${withoutReplayParam(search)}${window.location.hash}`);
    } else if (hasCompletedOnboarding()) {
      router.replace('/swipe');
      return;
    } else {
      const saved = readDraft();
      if (saved) {
        // Un pseudo invalide ne permet pas d'aller plus loin que l'écran du pseudo.
        const pseudoOk = buildProfile({ pseudo: saved.answers.pseudo }) !== null;
        const idx = STEPS.indexOf(saved.step);
        setDraft(saved.answers);
        setStepIdx(pseudoOk ? idx : Math.min(idx, STEPS.indexOf('pseudo')));
      }
    }
    setChecked(true);
  }, [router]);

  // Brouillon : réponses et étape courante gardées à chaque changement (effacé à la fin).
  useEffect(() => {
    if (!checked) return;
    const step = STEPS[stepIdx];
    if (step === 'welcome' && draft === EMPTY_ANSWERS) return;
    writeDraft(step, draft);
  }, [checked, stepIdx, draft]);

  const patch = (changes: Partial<OnboardingAnswers>) => setDraft(d => ({ ...d, ...changes }));

  const next = () => {
    setDir(1);
    setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  };
  const prev = () => {
    setDir(-1);
    setStepIdx(i => Math.max(i - 1, 0));
  };

  const profile = useMemo(() => buildProfile({ ...draft }), [draft]);

  const finish = (withEmail: boolean) => {
    const final = buildProfile({ ...draft, contactEmail: withEmail ? draft.contactEmail : '' });
    if (!final) {
      setDir(-1);
      setStepIdx(STEPS.indexOf('pseudo'));
      return;
    }
    completeOnboarding(final);
    clearDraft();
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

            {step === 'diet' && (
              <MultiStep kicker='Côté assiette' title={<>Un régime<br />particulier ?</>}
                subtitle='On trie pour toi : plus de mauvaise surprise.' sticker='salad'
                options={DIET_OPTIONS} values={draft.diets} onChange={diets => patch({ diets })}
                onNext={next} columns={2} noneLabel='Aucun, je mange de tout' emptyCta='Continuer' />
            )}

            {step === 'help' && <HelpStep onNext={next} />}

            {step === 'final' && profile && (
              <FinalStep profile={profile} email={draft.contactEmail}
                onEmailChange={contactEmail => patch({ contactEmail })}
                onGo={() => finish(true)} onSkip={() => finish(false)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
