import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';
import Providers from '@/components/providers';
import PwaRegister from '@/components/pwa/PwaRegister';
import PwaInstallBanner from '@/components/pwa/PwaInstallBanner';
import { getSessionUser } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Content OS · Command Center',
  description: 'Dashboard personal de Instagram — métricas, IA y calendario editorial',
  applicationName: 'ContentOS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ContentOS',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

// El usuario logueado se lee por petición: sin esto, si el build corre sin las
// variables de Supabase, Next prerenderaría el layout con el usuario de demo y
// lo serviría igual en producción.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A12',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Se lee acá (server component) y no en el cliente para no disparar una
  // llamada extra solo para saber quién está logueado.
  const user = await getSessionUser();
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <AppShell user={user}>{children}</AppShell>
          <PwaRegister />
          <PwaInstallBanner />
        </Providers>
      </body>
    </html>
  );
}
