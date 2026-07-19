'use client';

// Shell responsive: en desktop la sidebar es fija; en móvil se convierte en
// un drawer que se abre con el botón hamburguesa de la barra superior.
import { ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Barra superior (solo móvil) ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[#0C0C15]/95 backdrop-blur border-b border-line flex items-center justify-between px-4">
        <p className="font-extrabold tracking-tight">
          Content <span className="text-primary">OS</span>
        </p>
        <button
          onClick={() => setOpen(true)}
          className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-soft active:bg-line/50"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* ── Fondo oscuro al abrir el drawer (solo móvil) ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <main className="md:ml-60 min-h-screen px-4 md:px-8 pt-[4.75rem] md:pt-7 pb-7 max-w-[1600px]">
        {children}
      </main>
    </>
  );
}
