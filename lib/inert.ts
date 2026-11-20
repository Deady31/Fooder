/**
 * Accessibilité des feuilles modales.
 *
 * `aria-modal` + le piège de focus ne suffisent pas : sans `inert`, le deck et la barre
 * d'onglets restent atteignables au doigt, au clavier et pour un lecteur d'écran derrière
 * la fiche. Une feuille ouverte rend donc inerte tout le reste de `<body>`.
 */

/** Balises non interactives : y toucher n'apporte rien (et casserait les outils de dev). */
const NON_INTERACTIVE = ['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE'];

/** Éléments d'une liste `<body>` à rendre inertes : tout sauf le portail de la feuille et les balises non interactives. */
export function inertCandidates<T extends { tagName: string }>(nodes: readonly T[], own: T | null): T[] {
  return nodes.filter(n => n !== own && !NON_INTERACTIVE.includes(n.tagName.toUpperCase()));
}

/**
 * Pose `inert` sur les enfants de `<body>` sauf `own` (le portail de la feuille).
 * Renvoie la restauration : seuls les éléments modifiés ici sont rendus actifs, donc une
 * feuille ouverte par-dessus une autre se referme sans réactiver la page en dessous.
 */
export function inertOutside(own: Element | null, body: ParentNode = document.body): () => void {
  const touched: HTMLElement[] = [];
  for (const el of inertCandidates(Array.from(body.children) as HTMLElement[], own as HTMLElement | null)) {
    if (!el.hasAttribute('inert')) {
      el.setAttribute('inert', '');
      touched.push(el);
    }
  }
  return () => {
    for (const el of touched) el.removeAttribute('inert');
  };
}
