import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { claimLegacyWorkspaces, listAccountsForUser } from '@/lib/accounts';

// Destino del login con Google: intercambia el "code" de OAuth por una
// sesión (cookies), reclama los Workspaces legacy si el correo coincide con
// LEGACY_OWNER_EMAIL, y manda al usuario a /resumen (o a /conexion si
// todavía no tiene ninguna cuenta de Instagram conectada).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const origin = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
  }

  const res = NextResponse.redirect(`${origin}/resumen`);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await claimLegacyWorkspaces(user.id, user.email ?? '');
    const mine = await listAccountsForUser(user.id);
    if (mine.length === 0) {
      const dest = NextResponse.redirect(`${origin}/conexion`);
      res.cookies.getAll().forEach((c) => dest.cookies.set(c));
      return dest;
    }
  }

  return res;
}
