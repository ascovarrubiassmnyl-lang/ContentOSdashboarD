// Protección de toda la app con Supabase Auth. Login con Google, abierto a
// cualquier cuenta (sin allowlist) — el aislamiento de datos por usuario vive
// en la capa de aplicación (ver lib/accounts.ts). Solo se activa cuando las
// variables de Supabase están configuradas — en local/demo la app queda abierta.
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

// /api/health debe seguir siendo público aunque se active el login: si no,
// el healthcheck del hosting fallaría y el despliegue no arrancaría nunca.
const PUBLIC_PREFIXES = ['/login', '/auth', '/api/auth', '/api/cron', '/api/health'];

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Auth desactivada (desarrollo local / demo)
  if (!url || !anon) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookies.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const toLogin = (error?: string) => {
    const dest = req.nextUrl.clone();
    dest.pathname = '/login';
    dest.search = error ? `?error=${error}` : '';
    return NextResponse.redirect(dest);
  };

  if (!user) {
    // APIs devuelven 401 en JSON; páginas redirigen al login
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return toLogin();
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)'],
};
