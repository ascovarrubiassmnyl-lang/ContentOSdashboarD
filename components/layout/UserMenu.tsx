'use client';

// Identidad del usuario logueado + cerrar sesión. Aparte de Sidebar porque
// necesita ser cliente (onClick) mientras Sidebar sigue leyendo el usuario
// desde el servidor.
import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

export default function UserMenu({ user }: { user: SessionUser }) {
  const [pending, setPending] = useState(false);

  const leave = async () => {
    if (pending) return;
    setPending(true);
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="flex items-center gap-2.5 mb-3">
      {/* El nombre lleva a /cuenta: es donde se define o cambia la contraseña. */}
      <Link
        href="/cuenta"
        title="Tu cuenta y contraseña"
        className="flex items-center gap-2.5 min-w-0 flex-1 rounded-lg -m-1 p-1 hover:bg-line/40 transition-all"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-8 w-8 rounded-lg object-cover shrink-0 border border-line"
          />
        ) : (
          <span className="h-8 w-8 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center justify-center text-xs font-extrabold shrink-0">
            {initials(user.name)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold truncate">{user.name}</span>
          <span className="block text-[11px] text-muted truncate">{user.email}</span>
        </span>
      </Link>
      <button
        onClick={leave}
        disabled={pending}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="h-8 w-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-negative hover:border-negative/40 transition-all disabled:opacity-50 shrink-0"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
