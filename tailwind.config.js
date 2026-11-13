/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FFF6E5',
        // plum: DEFAULT inchange (#2B0F3A, 15,9:1 cream / 17,0:1 blanc). `muted`/`soft`
        // sont des TEXTES secondaires accessibles ; les anciens `plum/40..55` restent
        // valables pour fonds, bordures et decor uniquement.
        plum: {
          DEFAULT: '#2B0F3A',
          muted: '#5E4A66', // texte secondaire : 7,39:1 cream, 7,93:1 blanc
          soft: '#6B5774', // etiquettes inactives (TabBar) : 6,04:1 cream, 6,48:1 blanc
        },
        bubblegum: '#FF7EC8',
        // Fond des toasts et stickers jaunes (meme valeur que fooder-secondary).
        // plum dessus : 12,3:1. Fond uniquement, jamais en texte.
        lemon: '#FFD83D',
        violet: '#6C2BFF', // 5,71:1 cream, 6,13:1 blanc : OK en texte ; blanc dessus 6,1:1
        mint: '#3DDC97', // fond uniquement (plum dessus : 9,6:1)
        // Remplace slate-400 (2,6:1) et slate-500 (4,43:1, sous le seuil sur cream).
        // 5,54:1 cream, 5,95:1 blanc
        'slate-muted': '#55657A',
        // Etats semantiques TEXTE (les teintes vives restent pour fonds/contours).
        // success : remplace #12B76A (2,4:1). 5,03:1 cream, 5,40:1 blanc ; blanc dessus 5,40:1
        success: '#0B7A47',
        // danger : remplace #F04438 / texte rose. 5,46:1 cream, 5,86:1 blanc ; blanc dessus 5,86:1
        danger: '#C4105E',
        // orange en texte (libelle sponsor) : remplace fooder-orange (2,4:1 sur blanc).
        // 5,66:1 cream, 6,07:1 blanc
        'orange-ink': '#A04A00',
        'fooder-beige': '#FFF6E5',
        'fooder-beige': '#FFF6E5',
        'fooder-primary': '#6C2BFF',
        'fooder-secondary': '#FFD83D',
        'fooder-orange': '#FF8A1F',
        'fooder-red': '#FF3D8B',
        'fooder-mint': '#3DDC97',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
        // Rayons semantiques (S3) : cartes/feuilles et panneaux internes.
        card: '28px',
        panel: '22px',
      },
      boxShadow: {
        'hard-sm': '2px 2px 0 0 #2B0F3A',
        hard: '4px 4px 0 0 #2B0F3A',
        'hard-lg': '6px 6px 0 0 #2B0F3A',
        'hard-violet': '4px 4px 0 0 #6C2BFF',
      },
    },
  },
  plugins: [],
}
