'use client';

// Shell responsive: en desktop la sidebar es fija; en móvil se convierte en
// un drawer que se abre con el botón hamburguesa de la barra superior.
import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import type { SessionUser } from '@/lib/auth';

export default function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: SessionUser | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/offline' || pathname === '/descargar';

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* ── Barra superior (solo móvil) ── */}
      {/* El botón va a la IZQUIERDA, del mismo lado por el que entra el
          drawer: así el menú se abre desde donde se pulsa. */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[#0C0C15]/95 backdrop-blur border-b border-line flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(true)}
          className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-soft active:bg-line/50 shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
        <p className="font-extrabold tracking-tight">
          Content <span className="text-primary">OS</span>
        </p>
      </header>

      {/* ── Fondo oscuro al abrir el drawer (solo móvil) ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} user={user} />

      <main className="md:ml-60 min-h-screen px-4 md:px-8 pt-[4.75rem] md:pt-7 pb-7 max-w-[1600px]">
        {children}
      </main>
    </>
  );
}
