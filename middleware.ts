// Protección de toda la app con Auth.js (login con Google, abierto a
// cualquier cuenta — el aislamiento de datos por usuario vive en la capa de
// aplicación, ver lib/accounts.ts). Solo se activa cuando el provider de
// Google está configurado; en local/demo la app queda abierta.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// /api/health debe seguir siendo público aunque se active el login: si no,
// el healthcheck del hosting fallaría y el despliegue no arrancaría nunca.
const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api/cron', '/api/health'];

export default auth((req) => {
  // Auth desactivada (desarrollo local / demo)
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    // APIs devuelven 401 en JSON; páginas redirigen al login
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const dest = req.nextUrl.clone();
    dest.pathname = '/login';
    dest.search = '';
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)'],
};
