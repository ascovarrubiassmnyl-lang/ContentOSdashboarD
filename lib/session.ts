// Atajo compartido por las rutas de API que operan sobre "la cuenta activa
// del usuario logueado" — evita repetir 17 veces el mismo bloque de
// autenticación + resolución de workspace.
import { NextResponse } from 'next/server';
import { getSessionUser, SessionUser } from './auth';
import { activeWorkspace, Workspace } from './accounts';

type Ok = { user: SessionUser; ws: Workspace };
type Fail = { error: NextResponse };

export async function requireWorkspace(): Promise<Ok | Fail> {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }
  try {
    const ws = await activeWorkspace(user.id);
    return { user, ws };
  } catch (err) {
    if ((err as Error).message === 'SIN_WORKSPACE') {
      return {
        error: NextResponse.json(
          { error: 'Todavía no conectaste ninguna cuenta.' },
          { status: 409 }
        ),
      };
    }
    throw err;
  }
}
