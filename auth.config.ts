// Configuración de Auth.js apta para el runtime Edge.
//
// Existe aparte de auth.ts porque el middleware corre en Edge y auth.ts arrastra
// `pg` (a través del provider de contraseña), que ahí no se puede cargar. Este
// archivo solo contiene lo que hace falta para LEER la cookie de sesión; quién
// puede entrar y cómo se resuelve su identidad vive en auth.ts.
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  // Sesiones JWT firmadas en la cookie: el login no depende de la base de datos
  // para mantenerse abierto, y el middleware puede validarla sin consultarla.
  session: { strategy: 'jwt' },
  // Railway sirve detrás de un proxy: sin esto Auth.js rechaza el host.
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  providers: [], // los añade auth.ts (necesitan Node)
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
