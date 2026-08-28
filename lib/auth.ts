// Helper de servidor: "¿quién está pidiendo esto?" — para API routes y server
// components. En modo demo (sin Supabase configurado) devuelve un usuario fijo
// para que la app siga funcionando local sin login, tal como antes.
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { isAuthEnabled } from './supabase';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

const LOCAL_DEV_USER: SessionUser = {
  id: 'local-dev',
  email: 'demo@local',
  name: 'Demo',
  avatarUrl: null,
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isAuthEnabled()) return LOCAL_DEV_USER;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Un Server Component / Route Handler en GET no puede escribir
        // cookies nuevas — el middleware ya se encarga de refrescar la
        // sesión en cada petición, así que aquí no hace falta.
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    name: (meta.full_name as string) || (meta.name as string) || user.email || 'Usuario',
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
  };
}
