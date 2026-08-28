// Server component: decide en el servidor qué métodos de login existen para no
// pintar un botón de Google que no está configurado. El formulario en sí es
// cliente (ver LoginForm.tsx).
import { Suspense } from 'react';
import { isGoogleEnabled, isPasswordEnabled } from '@/lib/auth-flags';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-bg flex items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm googleEnabled={isGoogleEnabled()} passwordEnabled={isPasswordEnabled()} />
      </Suspense>
    </div>
  );
}
