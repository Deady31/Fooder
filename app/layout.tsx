import type { Metadata, Viewport } from 'next';
import { Bagel_Fat_One, DM_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/Providers';

const display = Bagel_Fat_One({ subsets: ['latin'], weight: '400', variable: '--font-display' });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://fooder-tawny.vercel.app'),
  title: 'Fooder - Swipe your Food',
  description: 'Trouvez votre prochain restaurant en swipant',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Fooder - Swipe your Food',
    description: 'Swipe les restos de Toulouse, trouve où manger en quelques secondes et compare tes goûts avec tes amis.',
    siteName: 'Fooder',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Fooder : swipe les restos de Toulouse' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
    title: 'Fooder - Swipe your Food',
    description: 'Swipe les restos de Toulouse, trouve où manger en quelques secondes et compare tes goûts avec tes amis.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fooder',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFF6E5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='fr' className={`${display.variable} ${body.variable}`}>
      <body className='font-body'>
        <div className='h-[100dvh] overflow-hidden bg-cream text-plum selection:bg-fooder-primary selection:text-white'>
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
