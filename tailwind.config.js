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
        plum: '#2B0F3A',
        bubblegum: '#FF7EC8',
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
      },
      boxShadow: {
        hard: '4px 4px 0 0 #2B0F3A',
        'hard-lg': '6px 6px 0 0 #2B0F3A',
        'hard-violet': '4px 4px 0 0 #6C2BFF',
      },
    },
  },
  plugins: [],
}
