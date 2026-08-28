'use client';

// Cuenta del usuario: aquí es donde quien entró con Google se pone una
// contraseña. Sin esta pantalla el login por contraseña sería inservible para
// las cuentas que ya existen, porque el registro público rechaza —a propósito—
// los correos que ya entran con Google.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Input, Spinner } from '@/components/ui';

const MIN_PASSWORD = 8;

interface AccountState {
  email: string;
  name: string;
  hasPassword: boolean;
  hasGoogle: boolean;
  enabled: boolean;
}

export default function CuentaPage() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AccountState>({
    queryKey: ['account-security'],
    queryFn: async () => (await fetch('/api/auth/password')).json(),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (next !== repeat) throw new Error('Las dos contraseñas no coinciden.');
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          newPassword: next,
          currentPassword: current || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar.');
    },
    onSuccess: () => {
      setError(null);
      setOk('Contraseña guardada. Ya puedes entrar con tu correo y esta contraseña.');
      setCurrent('');
      setNext('');
      setRepeat('');
      qc.invalidateQueries({ queryKey: ['account-security'] });
    },
    onError: (err) => {
      setOk(null);
      setError((err as Error).message);
    },
  });

  return (
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Tu cuenta</p>
        <h1 className="text-xl font-extrabold">Acceso y contraseña</h1>
        <p className="text-sm text-muted mt-1">
          Cómo entras a ContentOS. Tus cuentas conectadas se gestionan en Conexión.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          <Card className="col-span-12 lg:col-span-5" glow={false}>
            <p className="section-label mb-4">Identidad</p>
            <p className="text-sm font-bold">{data.name}</p>
            <p className="text-xs text-muted mb-5">{data.email}</p>

            <p className="section-label mb-2.5">Métodos de acceso</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-xs bg-bg border border-line rounded-xl px-3.5 py-2.5">
                <ShieldCheck
                  size={14}
                  className={data.hasGoogle ? 'text-positive' : 'text-muted'}
                />
                <span className={data.hasGoogle ? 'text-soft' : 'text-muted'}>
                  Google {data.hasGoogle ? '· activo' : '· no vinculado'}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs bg-bg border border-line rounded-xl px-3.5 py-2.5">
                <KeyRound
                  size={14}
                  className={data.hasPassword ? 'text-positive' : 'text-muted'}
                />
                <span className={data.hasPassword ? 'text-soft' : 'text-muted'}>
                  Contraseña {data.hasPassword ? '· activa' : '· sin definir'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-7" glow={false}>
            <p className="section-label mb-4">
              {data.hasPassword ? 'Cambiar contraseña' : 'Definir una contraseña'}
            </p>

            {!data.enabled ? (
              <p className="text-sm text-muted py-4">
                Este servidor no tiene el login por contraseña activado.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted leading-relaxed mb-5">
                  {data.hasPassword
                    ? 'Necesitas la contraseña actual para cambiarla.'
                    : 'Entraste con Google. Al definir una contraseña podrás entrar de las dos formas — sigue siendo la misma cuenta y los mismos datos.'}
                </p>

                {data.hasPassword && (
                  <Input
                    label="Contraseña actual"
                    type="password"
                    value={current}
                    onChange={setCurrent}
                  />
                )}
                <Input
                  label="Nueva contraseña"
                  type="password"
                  value={next}
                  onChange={setNext}
                  placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                />
                <Input
                  label="Repetir la nueva contraseña"
                  type="password"
                  value={repeat}
                  onChange={setRepeat}
                />

                {error && <p className="text-xs text-negative mb-3">{error}</p>}
                {ok && <p className="text-xs text-positive mb-3">✓ {ok}</p>}

                <Button
                  onClick={() => save.mutate()}
                  disabled={next.length < MIN_PASSWORD || save.isPending}
                >
                  {save.isPending ? 'Guardando…' : 'Guardar contraseña'}
                </Button>

                <p className="text-[11px] text-muted mt-4 leading-relaxed">
                  Todavía no hay recuperación de contraseña por correo. Si la olvidas y
                  tu cuenta tiene Google vinculado, entra con Google y defínela de nuevo
                  aquí.
                </p>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
