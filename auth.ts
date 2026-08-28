// Auth.js v5 — login con Google, abierto a cualquier cuenta.
//
// Sesiones JWT (firmadas en la cookie) a propósito: así el login NO depende
// del Postgres. Si la base se cae, la app falla al leer datos pero nadie
// queda fuera de la sesión, y no hay que mantener tablas de usuarios ni de
// sesiones para algo que Google ya resuelve.
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  // Railway sirve detrás de un proxy: sin esto Auth.js rechaza el host.
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    // El id del usuario es el `sub` de Google: estable de por vida y es lo
    // que se guarda como `owner_user_id` de cada Workspace.
    jwt({ token, profile }) {
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
