'use client';

import { AlertTriangle } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

// Códigos que devuelve Auth.js en ?error=
const URL_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: 'Ese correo ya entró antes con otro método.',
  AccessDenied: 'Cancelaste el acceso en la pantalla de Google.',
  Configuration: 'El login con Google no está bien configurado en el servidor.',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const urlError = params.get('error');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? URL_ERRORS[urlError] ?? 'Error de acceso.' : null
  );

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl: '/resumen' });
      // Si sale bien, el navegador ya va camino a Google.
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <div className="card w-full max-w-md p-8 shadow-glow">
      <p className="text-2xl font-extrabold tracking-tight text-center">
        Content <span className="text-primary">OS</span>
      </p>
      <p className="text-xs text-muted text-center mt-1 mb-8">Command Center</p>

      <button
        onClick={submit}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1F1F1F] font-semibold text-sm rounded-xl px-4 py-3 hover:bg-white/90 transition-all disabled:opacity-60"
      >
        <GoogleIcon />
        {pending ? 'Redirigiendo…' : 'Continuar con Google'}
      </button>

      {error && (
        <p className="flex items-start gap-2 text-xs text-negative mt-4">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <p className="text-[11px] text-muted text-center mt-6">
        Entrá con tu cuenta de Google para crear o abrir tu espacio de trabajo.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-bg flex items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
