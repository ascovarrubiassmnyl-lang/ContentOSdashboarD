// Helper de servidor: "¿quién está pidiendo esto?" — para API routes y server
// components. En modo demo (sin login configurado) devuelve un usuario fijo
// para que la app siga funcionando local sin credenciales.
//
// El contrato de getSessionUser() es el punto de corte del aislamiento
// multiusuario: las 17 rutas que lo usan no saben (ni les importa) qué
// proveedor de auth hay detrás.
import { auth } from '@/auth';

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

export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isAuthEnabled()) return LOCAL_DEV_USER;

  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name || user.email || 'Usuario',
    avatarUrl: user.image ?? null,
  };
}
