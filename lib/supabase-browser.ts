// Cliente de Supabase para el navegador — solo se usa para disparar el login
// con Google (`signInWithOAuth`). El resto de la app sigue leyendo/escribiendo
// datos exclusivamente desde el servidor (service role).
import { createBrowserClient } from '@supabase/ssr';

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
