import { DEMO_KEY, isDemo } from './demoFlag';
import { buildProfile, completeOnboarding, hasCompletedOnboarding, resetOnboardingForReplay } from './profile';

/* Mode démo : explorer l'appli sans inscription. Profil invité local, aucun compte, aucun envoi au cloud. */

export const DEMO_PSEUDO = 'invite';

export type DemoStart = 'keep_profile' | 'create_guest' | 'already_demo';

/** Un vrai inscrit garde son profil ; une démo déjà ouverte continue ; sinon on crée l'invité. */
export function decideDemoStart(p: { registered: boolean; demo: boolean }): DemoStart {
  if (p.demo) return 'already_demo';
  return p.registered ? 'keep_profile' : 'create_guest';
}

/** Ouvre la démo. Retourne false si le profil invité n'a pas pu être écrit (stockage indisponible). */
export function startDemo(): boolean {
  if (decideDemoStart({ registered: hasCompletedOnboarding(), demo: isDemo() }) !== 'create_guest') return true;
  const guest = buildProfile({ pseudo: DEMO_PSEUDO });
  if (!guest) return false;
  try {
    localStorage.setItem(DEMO_KEY, '1');
  } catch {
    return false;
  }
  return completeOnboarding(guest);
}

/** Quitte la démo pour une vraie inscription : retire le drapeau et le profil invité. */
export function endDemo(): void {
  if (!isDemo()) return;
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    return;
  }
  resetOnboardingForReplay();
}
