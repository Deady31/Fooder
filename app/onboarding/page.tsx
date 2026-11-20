'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { m, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { StepProgress } from '../../components/onboarding/StepProgress';
import { WelcomeStep } from '../../components/onboarding/WelcomeStep';
import { PseudoStep } from '../../components/onboarding/PseudoStep';
import { FinalStep } from '../../components/onboarding/FinalStep';
import { MultiStep } from '../../components/onboarding/ChoiceSteps';
import { DIET_OPTIONS } from '../../components/onboarding/options';
import { endDemo } from '../../lib/demo';
import { buildProfile, completeOnboarding, hasCompletedOnboarding, resetOnboardingForReplay, signupEmailProblem } from '../../lib/profile';
import { EMPTY_ANSWERS, OnboardingAnswers, StepId, clearDraft, readDraft, stepAfter, stepBefore, visibleSteps, writeDraft } from '../../lib/onboardingDraft';
import { createAcceptance, canFinishOnboarding } from '../../lib/legal';
import { startTour } from '../../lib/tour';
import { rememberRef, wantsReplay, withoutReplayParam } from '../../lib/refParam';

const STEPS = visibleSteps();

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function Onboarding() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<StepId>('welcome');
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const search = window.location.search;
    rememberRef(search);
    endDemo(); // un visiteur en démo qui vient s'inscrire repart d'un profil vide
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
        setDraft(saved.answers);
        setStep(pseudoOk ? saved.step : 'pseudo');
      }
    }
    setChecked(true);
  }, [router]);

  // Brouillon : réponses et étape courante gardées à chaque changement (effacé à la fin).
  useEffect(() => {
    if (!checked) return;
    if (step === 'welcome' && draft === EMPTY_ANSWERS) return;
    writeDraft(step, draft);
  }, [checked, step, draft]);

  const patch = (changes: Partial<OnboardingAnswers>) => setDraft(d => ({ ...d, ...changes }));

  const steps = STEPS;
  const next = () => {
    setDir(1);
    setStep(s => stepAfter(s, steps));
  };
  const prev = () => {
    setDir(-1);
    setStep(s => stepBefore(s, steps));
  };

  const profile = useMemo(() => buildProfile({ ...draft }), [draft]);

  const finish = () => {
    if (!canFinishOnboarding(termsAccepted)) return;
    // Béta : l'e-mail est obligatoire (format vérifié, aucune confirmation envoyée).
    if (signupEmailProblem(draft.contactEmail) !== null) return;
    const now = Date.now();
    const final = buildProfile({ ...draft, ...createAcceptance(now) }, now);
    if (!final) {
      setDir(-1);
      setStep('pseudo');
      return;
    }
    completeOnboarding(final);
    clearDraft();
    startTour();
    router.push('/swipe');
  };

  const stepIdx = Math.max(0, steps.indexOf(step));

  if (!checked) return <div className='h-[100dvh] bg-cream' />;

  return (
    <div className='flex flex-col h-[100dvh] overflow-hidden bg-cream max-w-md mx-auto relative border-x-[3px] border-plum'>
      <AnimatePresence>
        {step !== 'welcome' && (
          <m.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className='flex items-center gap-3 px-5 pt-10 pb-3 z-10 flex-shrink-0'>
            <button type='button' onClick={prev} aria-label='Retour'
              className='p-2 rounded-full hover:bg-white transition-colors flex-shrink-0'>
              <ArrowLeft className='w-5 h-5 text-slate-500' />
            </button>
            <StepProgress index={stepIdx - 1} total={steps.length - 1} />
          </m.div>
        )}
      </AnimatePresence>

      <div className='flex-1 overflow-hidden relative min-h-0'>
        <AnimatePresence mode='wait' custom={dir}>
          <m.div key={step} custom={dir} variants={slideVariants}
            initial='enter' animate='center' exit='exit'
            transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
            className='absolute inset-0 flex flex-col'>
            {step === 'welcome' && <WelcomeStep onNext={next} />}

            {step === 'pseudo' && (
              <PseudoStep value={draft.pseudo} onChange={pseudo => patch({ pseudo })}
                onNext={pseudo => { patch({ pseudo }); next(); }} />
            )}

            {step === 'diet' && (
              <MultiStep kicker='Côté assiette' title={<>Un régime<br />particulier ?</>}
                subtitle='On trie pour toi : plus de mauvaise surprise.' sticker='salad'
                options={DIET_OPTIONS} values={draft.diets} onChange={diets => patch({ diets })}
                onNext={next} columns={2} noneLabel='Aucun, je mange de tout' emptyCta='Continuer' />
            )}

            {step === 'final' && profile && (
              <FinalStep profile={profile} email={draft.contactEmail}
                onEmailChange={contactEmail => patch({ contactEmail })}
                termsAccepted={termsAccepted} onTermsChange={setTermsAccepted}
                onGo={finish} />
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
