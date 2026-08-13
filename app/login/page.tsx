'use client';

import { AlertTriangle, Mail, Send } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Spinner } from '@/components/ui';

const URL_ERRORS: Record<string, string> = {
  no_autorizado: 'Ese correo no está autorizado para acceder a este dashboard.',
  enlace_invalido: 'El enlace expiró o no es válido. Pide uno nuevo.',
};

function LoginForm() {
  const params = useSearchParams();
  const urlError = params.get('error');

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? URL_ERRORS[urlError] ?? 'Error de acceso.' : null
  );

  const submit = async () => {
    if (!email.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="card w-full max-w-md p-8 shadow-glow">
      <p className="text-2xl font-extrabold tracking-tight text-center">
        Content <span className="text-primary">OS</span>
      </p>
      <p className="text-xs text-muted text-center mt-1 mb-8">
        Command Center
      </p>

      {sent ? (
        <div className="text-center py-6">
          <span className="h-12 w-12 rounded-2xl bg-positive/15 text-positive flex items-center justify-center mx-auto mb-4">
            <Mail size={22} />
          </span>
          <p className="font-bold mb-1">Revisa tu correo</p>
          <p className="text-sm text-muted">
            Te enviamos un enlace de acceso a{' '}
            <span className="text-soft font-semibold">{email}</span>. Ábrelo para entrar.
          </p>
        </div>
      ) : (
        <>
          <label className="block mb-4">
            <span className="section-label block mb-1.5">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="tu@correo.com"
              className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
              autoFocus
            />
          </label>
          <Button className="w-full" onClick={submit} disabled={pending || !email.trim()}>
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Enviando…
              </span>
            ) : (
              <>
                <Send size={14} className="inline mr-1.5 -mt-0.5" />
                Enviarme el enlace de acceso
              </>
            )}
          </Button>
          {error && (
            <p className="flex items-start gap-2 text-xs text-negative mt-4">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {error}
            </p>
          )}
          <p className="text-[11px] text-muted text-center mt-6">
            Acceso restringido — solo el correo autorizado puede entrar.
          </p>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-[60] bg-bg flex items-center justify-center px-4">
      <Suspense fallback={<Spinner />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
