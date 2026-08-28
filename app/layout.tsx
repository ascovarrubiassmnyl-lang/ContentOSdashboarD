import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';
import Providers from '@/components/providers';
import { getSessionUser } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Content OS · Command Center',
  description: 'Dashboard personal de Instagram — métricas, IA y calendario editorial',
};

// El usuario logueado se lee por petición: sin esto, si el build corre sin las
// variables de Supabase, Next prerenderaría el layout con el usuario de demo y
// lo serviría igual en producción.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0A12',
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
        </Providers>
      </body>
    </html>
  );
}
