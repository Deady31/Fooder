/** Catégorie « Protéine d'abord » : poulet croustillant, rôtisseries, wings, concepts protéinés. Chargée à la demande dans Découvrir. */
export const PROTEIN_LABEL = 'Protéines';
export const PIZZA_LABEL = 'Pizza';

/** Catégories toujours proposées dans les filtres, en tête de liste (leurs restos sont chargés à la demande). */
export const FEATURED_CUISINES: readonly string[] = [PROTEIN_LABEL, PIZZA_LABEL];

/** Ancien libellé enregistré dans le navigateur → libellé actuel (le filtre mémorisé ne doit pas devenir vide). */
const LEGACY_LABELS: Record<string, string> = { Pizzeria: PIZZA_LABEL };
export const currentCuisineLabel = (stored: string): string => LEGACY_LABELS[stored] ?? stored;

const fold = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Mots qu'on tape pour retrouver une catégorie dont le nom est différent. */
const SYNONYMS: Record<string, readonly string[]> = {
  [PROTEIN_LABEL]: ['proteine', 'poulet', 'chicken', 'crousty', 'crousti', 'rotisserie', 'wings', 'tenders', 'muscu', 'fitness'],
  [PIZZA_LABEL]: ['pizza', 'pizzeria', 'pizzas', 'napolitaine'],
  Burger: ['burger', 'hamburger', 'smash'],
  Tacos: ['tacos', 'french tacos'],
  Japonais: ['sushi', 'maki', 'japon'],
  Indien: ['curry', 'naan', 'tandoori'],
  Kebab: ['kebab', 'grec', 'sandwich turc'],
};

/** Vrai si `query` désigne la catégorie `label` (sans accents ni majuscules, par morceau de mot ou synonyme). Requête vide : tout. */
export function matchesCuisineQuery(label: string, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  if (fold(label).includes(q)) return true;
  return (SYNONYMS[label] ?? []).some(w => w.includes(q) || q.includes(w));
}

/** Catégories affichées sans recherche : les mises en avant, puis les plus fréquentes (ordre alphabétique), `max` au plus. */
export function defaultCuisineList(catalog: readonly { label: string; count: number }[], selected: string | null, max = 24): string[] {
  const featured = FEATURED_CUISINES.filter(l => l !== selected);
  const top = [...catalog]
    .filter(c => !FEATURED_CUISINES.includes(c.label) && c.label !== selected)
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, max - featured.length))
    .map(c => c.label)
    .sort((a, b) => a.localeCompare(b, 'fr'));
  return [...(selected ? [selected] : []), ...featured, ...top];
}
