import type { Metadata, Viewport } from 'next';
import { Bagel_Fat_One, DM_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/Providers';

const display = Bagel_Fat_One({ subsets: ['latin'], weight: '400', variable: '--font-display' });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Fooder - Swipe your Food',
  description: 'Trouvez votre prochain restaurant en swipant',
  manifest: '/manifest.json',
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
