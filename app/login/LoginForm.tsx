'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

// Códigos que devuelve Auth.js en ?error=
const URL_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: 'Ese correo ya entró antes con otro método.',
  AccessDenied: 'Cancelaste el acceso en la pantalla de Google.',
  Configuration: 'El login no está bien configurado en el servidor.',
  CredentialsSignin: 'Correo o contraseña incorrectos.',
};

const MIN_PASSWORD = 8;

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

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-semibold text-muted mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary/60 transition-all"
      />
    </label>
  );
}

export default function LoginForm({
  googleEnabled,
  passwordEnabled,
}: {
  googleEnabled: boolean;
  passwordEnabled: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const urlError = params.get('error');

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    urlError ? (URL_ERRORS[urlError] ?? 'Error de acceso.') : null
  );

  const google = async () => {
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

  const enter = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Correo o contraseña incorrectos.');
        setPending(false);
        return;
      }
      router.push('/resumen');
      router.refresh();
    } catch {
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
      setPending(false);
    }
  };

  const register = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'No se pudo crear la cuenta.');
        setPending(false);
        return;
      }
      // Cuenta creada: entra directo, sin pedir los datos otra vez.
      await enter();
    } catch {
      setError('No se pudo crear la cuenta. Intenta de nuevo.');
      setPending(false);
    }
  };

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= (mode === 'register' ? MIN_PASSWORD : 1) &&
    !pending;

  return (
    <div className="card w-full max-w-md p-8 shadow-glow">
      <p className="text-2xl font-extrabold tracking-tight text-center">
        Content <span className="text-primary">OS</span>
      </p>
      <p className="text-xs text-muted text-center mt-1 mb-7">Command Center</p>

      {passwordEnabled && (
        <>
          <div className="flex gap-1 p-1 rounded-xl bg-bg border border-line mb-5">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                  mode === m ? 'bg-primary/15 text-primary' : 'text-muted hover:text-soft'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <Field
              label="Nombre"
              type="text"
              value={name}
              onChange={setName}
              autoComplete="name"
              placeholder="Cómo te llamamos"
            />
          )}
          <Field
            label="Correo"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="tu@correo.com"
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'register' ? `Mínimo ${MIN_PASSWORD} caracteres` : '••••••••'}
          />

          <button
            onClick={mode === 'login' ? enter : register}
            disabled={!canSubmit}
            className="w-full bg-primary text-white font-bold text-sm rounded-xl px-4 py-3 hover:bg-primary/90 transition-all disabled:opacity-50 mt-1"
          >
            {pending
              ? 'Un momento…'
              : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta y entrar'}
          </button>
        </>
      )}

      {passwordEnabled && googleEnabled && (
        <div className="flex items-center gap-3 my-5">
          <span className="h-px bg-line flex-1" />
          <span className="text-[10px] uppercase tracking-wider text-muted font-bold">o</span>
          <span className="h-px bg-line flex-1" />
        </div>
      )}

      {googleEnabled && (
        <button
          onClick={google}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1F1F1F] font-semibold text-sm rounded-xl px-4 py-3 hover:bg-white/90 transition-all disabled:opacity-60"
        >
          <GoogleIcon />
          {pending ? 'Redirigiendo…' : 'Continuar con Google'}
        </button>
      )}

      {error && (
        <p className="flex items-start gap-2 text-xs text-negative mt-4">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error}
        </p>
      )}
      {notice && <p className="text-xs text-positive mt-4">{notice}</p>}

      <p className="text-[11px] text-muted text-center mt-6 leading-relaxed">
        {mode === 'register'
          ? 'Tu espacio de trabajo es tuyo: nadie más ve las cuentas que conectes.'
          : 'Entrá para abrir tu espacio de trabajo.'}
      </p>
    </div>
  );
}
