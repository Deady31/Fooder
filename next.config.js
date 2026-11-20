/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// Le portfolio de Riyan affiche cette appli dans l'écran d'un téléphone 3D (iframe). On n'autorise QUE ces origines
// (jamais « * ») ; le localhost de dev n'existe qu'en développement.
const embedOrigins = ['https://riyan-besseghir.vercel.app', ...(isDev ? ['http://localhost:5180', 'http://localhost:5173'] : [])];

// CSP : OpenFreeMap (tuiles), Unsplash/Google (photos), PostHog et Vercel (analytics), Supabase (backend).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://va.vercel-scripts.com https://eu-assets.i.posthog.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org https://api-adresse.data.gouv.fr https://*.supabase.co wss://*.supabase.co https://eu.i.posthog.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `frame-ancestors 'self' ${embedOrigins.join(' ')}`,
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // X-Frame-Options retiré : il ne sait pas autoriser une origine précise. frame-ancestors (CSP) le remplace.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
