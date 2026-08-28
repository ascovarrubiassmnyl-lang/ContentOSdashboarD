// Alta de usuario con correo y contraseña. Pública (el registro está abierto,
// igual que el login con Google). Solo crea la cuenta: iniciar sesión es un
// paso aparte que hace el propio formulario.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isPasswordEnabled } from '@/lib/auth-flags';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { RegistrationError, registerUser } from '@/lib/users';

const schema = z.object({
  name: z.string().max(80).optional(),
  email: z.string().email().max(160),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export async function POST(req: NextRequest) {
  if (!isPasswordEnabled()) {
    return NextResponse.json(
      { error: 'Este servidor no tiene el login por contraseña activado (falta AUTH_SECRET).' },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Revisa los datos: el correo debe ser válido y la contraseña de al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      },
      { status: 400 }
    );
  }

  try {
    const user = await registerUser({
      email: parsed.data.email,
      name: parsed.data.name ?? '',
      password: parsed.data.password,
    });
    return NextResponse.json({ ok: true, email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
