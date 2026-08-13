'use client';

// Selector de cuenta del menú principal. Cambiar de cuenta escribe una cookie
// en el servidor, así que TODAS las rutas pasan a leer los datos de la cuenta
// nueva; por eso hay que vaciar la caché de React Query al cambiar.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn, relativeTime } from '@/lib/utils';

export interface AccountRow {
  id: string;
  label: string;
  username: string;
  color: string;
  followers: number;
  avatar_url: string | null;
  last_sync_at: string | null;
  legacy: boolean;
  keyState: 'stored' | 'env' | 'none';
  active: boolean;
}

export function initials(label: string): string {
  const clean = label.replace(/^@/, '').trim();
  const parts = clean.split(/[\s_.-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase() || '??';
}

// Evita repetir "@usuario" dos veces cuando el nombre de la cuenta ya es el
// propio usuario: en ese caso el subtítulo aporta otro dato.
export function accountSubtitle(a: {
  label: string;
  username: string;
  followers: number;
  last_sync_at?: string | null;
  keyState?: string;
}): string {
  if (a.keyState === 'none') return 'sin conectar';
  if (!a.username) return 'sin sincronizar';
  if (a.label.replace(/^@/, '') === a.username) {
    if (a.followers > 0) return `${a.followers.toLocaleString('es')} seguidores`;
    return a.last_sync_at ? `sync ${relativeTime(a.last_sync_at)}` : 'sin sincronizar';
  }
  return `@${a.username}`;
}

export function AccountAvatar({
  label,
  color,
  size = 32,
}: {
  label: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="rounded-lg flex items-center justify-center font-extrabold shrink-0"
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        fontSize: size * 0.36,
      }}
    >
      {initials(label)}
    </span>
  );
}

export default function AccountSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ accounts: AccountRow[]; activeId: string }>({
    queryKey: ['accounts'],
    queryFn: async () => (await fetch('/api/accounts')).json(),
  });

  const switchTo = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/accounts/active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo cambiar de cuenta');
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      // Los datos en caché son de la cuenta anterior — fuera todos.
      qc.clear();
      router.refresh();
      onNavigate?.();
    },
  });

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const accounts = data?.accounts ?? [];
  const active = accounts.find((a) => a.active) ?? accounts[0];

  if (isLoading || !active) {
    return (
      <div className="mx-3 mb-5 h-[52px] rounded-xl border border-line bg-bg/40 animate-pulse" />
    );
  }

  return (
    <div className="relative mx-3 mb-5" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all text-left',
          open
            ? 'border-primary/50 bg-primary/10'
            : 'border-line bg-bg/40 hover:border-primary/40'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <AccountAvatar label={active.label} color={active.color} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold truncate">{active.label}</span>
          <span className="block text-[11px] text-muted truncate">
            {accountSubtitle(active)}
          </span>
        </span>
        <ChevronsUpDown size={15} className="text-muted shrink-0" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 card p-1.5 shadow-glow"
          role="listbox"
        >
          <p className="accent-label px-2.5 py-1.5">Cuentas</p>
          {accounts.map((a) => (
            <button
              key={a.id}
              role="option"
              aria-selected={a.active}
              disabled={switchTo.isPending}
              onClick={() => (a.active ? setOpen(false) : switchTo.mutate(a.id))}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all disabled:opacity-50',
                a.active ? 'bg-primary/15' : 'hover:bg-line/50'
              )}
            >
              <AccountAvatar label={a.label} color={a.color} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold truncate">{a.label}</span>
                <span className="block text-[10px] text-muted truncate">
                  {accountSubtitle(a)}
                </span>
              </span>
              {switchTo.isPending && switchTo.variables === a.id ? (
                <RefreshCw size={14} className="text-primary animate-spin shrink-0" />
              ) : a.active ? (
                <Check size={14} className="text-primary shrink-0" />
              ) : null}
            </button>
          ))}

          <div className="h-px bg-line my-1.5" />
          <Link
            href="/conexion"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-muted hover:text-white hover:bg-line/50 transition-all"
          >
            <span className="h-7 w-7 rounded-lg border border-dashed border-line flex items-center justify-center shrink-0">
              <Plus size={14} />
            </span>
            Añadir cuenta
          </Link>
        </div>
      )}

      {switchTo.isError && (
        <p className="text-[11px] text-negative mt-1.5 px-1">
          {(switchTo.error as Error).message}
        </p>
      )}
    </div>
  );
}
