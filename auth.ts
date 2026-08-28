// Auth.js v5 — dos puertas al mismo usuario: Google y usuario/contraseña.
//
// Ambas resuelven contra el registro de lib/users.ts, donde el CORREO es la
// identidad. Sin esa convergencia, entrar por la otra puerta daría un id
// distinto y el usuario vería un panel vacío siendo la misma persona.
//
// La base (sesión, páginas, callbacks apto-Edge) está en auth.config.ts, que
// es lo que consume el middleware.
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { Provider } from 'next-auth/providers';
import { authConfig } from './auth.config';
import { isGoogleEnabled, isPasswordEnabled } from './lib/auth-flags';
import { upsertGoogleUser, verifyCredentials } from './lib/users';

const providers: Provider[] = [];

if (isGoogleEnabled()) {
  providers.push(Google);
}

if (isPasswordEnabled()) {
  providers.push(
    Credentials({
      name: 'Contraseña',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password =
          typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        const user = await verifyCredentials(email, password);
        // `null` = credenciales inválidas. A propósito no se distingue entre
        // "ese correo no existe" y "la contraseña no coincide": decirlo
        // permitiría averiguar qué correos están registrados.
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
        };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, profile }) {
      // Solo en el primer paso del login: después el token ya viene resuelto.
      if (account?.provider === 'google' && profile?.sub && profile.email) {
        // Si esto falla (base caída) el login falla, en vez de asignar un id
        // provisional que podría crear un workspace duplicado bajo otro dueño.
        const appUser = await upsertGoogleUser({
          sub: profile.sub,
          email: profile.email,
          name: profile.name,
          avatarUrl: typeof profile.picture === 'string' ? profile.picture : null,
        });
        token.sub = appUser.id;
        token.name = appUser.name;
        token.email = appUser.email;
        token.picture = appUser.avatar_url;
      } else if (user?.id) {
        // Provider de contraseña: authorize() ya devolvió el usuario de la app.
        token.sub = user.id;
      }
      return token;
    },
  },
});
