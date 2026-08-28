// Protección de toda la app con Auth.js (Google y usuario/contraseña — el
// aislamiento de datos por usuario vive en la capa de aplicación, ver
// lib/accounts.ts). Solo se activa cuando hay algún login configurado; en
// local/demo la app queda abierta.
//
// Importa auth.config.ts y NO auth.ts: este archivo corre en el runtime Edge,
// donde no se puede cargar `pg`. Para decidir si dejar pasar basta con
// decodificar la cookie JWT, que sí es apto para Edge.
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { isAuthEnabled } from './lib/auth-flags';

// /api/health debe seguir siendo público aunque se active el login: si no,
// el healthcheck del hosting fallaría y el despliegue no arrancaría nunca.
const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api/cron', '/api/health'];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Auth desactivada (desarrollo local / demo)
  if (!isAuthEnabled()) {
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
