// Definir o cambiar la contraseña, ya con sesión abierta.
//
// Es la vía por la que quien entró con Google se pone una contraseña sin perder
// su cuenta ni sus datos: el usuario es el mismo, solo gana una segunda puerta.
// Por eso el registro público rechaza los correos que ya entran con Google —
// completar esa cuenta desde fuera sería secuestrarla.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, isPasswordEnabled } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { RegistrationError, findUserById, setPassword } from '@/lib/users';

const schema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

// Estado: ¿esta cuenta ya tiene contraseña, o solo entra con Google?
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const row = await findUserById(user.id);
  return NextResponse.json({
    email: user.email,
    name: user.name,
    hasPassword: Boolean(row?.password_hash),
    hasGoogle: Boolean(row?.google_sub),
    enabled: isPasswordEnabled(),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (!isPasswordEnabled()) {
    return NextResponse.json(
      { error: 'Este servidor no tiene el login por contraseña activado (falta AUTH_SECRET).' },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  try {
    await setPassword(user.id, parsed.data.newPassword, parsed.data.currentPassword);
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
