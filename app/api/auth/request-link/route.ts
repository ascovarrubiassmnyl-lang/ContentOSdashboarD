import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

// Envía el magic link SOLO si el correo es el del dueño (allowlist).
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const owner = process.env.OWNER_EMAIL;
  if (!url || !anon || !owner) {
    return NextResponse.json(
      { error: 'La autenticación no está configurada en este entorno.' },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  }

  if (parsed.data.email.toLowerCase() !== owner.toLowerCase()) {
    // No se revela cuál es el correo permitido.
    return NextResponse.json(
      { error: 'Este correo no está autorizado para acceder.' },
      { status: 403 }
    );
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const origin = req.nextUrl.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    return NextResponse.json(
      { error: `No se pudo enviar el enlace: ${error.message}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
