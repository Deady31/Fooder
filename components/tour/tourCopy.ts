import type { TourState, TourStepId } from '../../lib/tour';

export interface TourStepView {
  /** Sélecteurs CSS des éléments à éclairer (leur réunion forme la zone lumineuse). */
  targets: string[];
  title: string;
  text: string;
  /** Bouton principal de la bulle (absent : l'utilisateur agit sur la zone éclairée). */
  action?: string;
}

/** Textes et cibles de chaque étape. L'étape « favoris » a deux temps : l'onglet, puis le resto rangé. */
export function tourStepView(step: TourStepId, state: TourState): TourStepView {
  switch (step) {
    case 'mood':
      return {
        targets: ['[data-tour="mood"]'],
        title: 'Ton envie du moment',
        text: 'Touche cette pastille et choisis ce que tu as envie de manger.',
      };
    case 'swipe':
      return {
        targets: ['[data-tour="deck"]', '[data-tour="actions"]'],
        title: 'Glisse !',
        text: 'Pas envie ? Glisse à gauche. Envie ? Glisse à droite. Essaie les deux.',
      };
    case 'favoris':
      return state.favoritesOpened
        ? {
            targets: ['[data-tour="fav-first"]'],
            title: 'Le voilà !',
            text: 'Ton coup de cœur est rangé ici. Tu le retrouves quand tu veux, aussi sur la carte.',
            action: 'Suivant',
          }
        : {
            targets: ['[data-tab="/wishlist"]'],
            title: 'Tes coups de cœur',
            text: 'Les restos que tu aimes se rangent dans Favoris. Touche l’onglet.',
          };
    case 'fil':
      return {
        targets: ['[data-tab="/feed"]'],
        title: 'Le Fil',
        text: 'Après un resto, poste ta photo : tu remplis Fooder avec les autres. Touche Fil.',
      };
  }
}
