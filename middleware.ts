// Protección de toda la app con Supabase Auth + allowlist de un solo
// usuario (OWNER_EMAIL). Solo se activa cuando las variables de Supabase
// están configuradas — en local/demo la app queda abierta.
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/auth', '/api/auth', '/api/cron'];

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const owner = process.env.OWNER_EMAIL;

  // Auth desactivada (desarrollo local / demo)
  if (!url || !anon || !owner) return NextResponse.next();

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

  // Allowlist: solo el dueño puede usar la app
  if (user.email?.toLowerCase() !== owner.toLowerCase()) {
    await supabase.auth.signOut();
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    return toLogin('no_autorizado');
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)'],
};
