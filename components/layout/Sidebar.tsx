'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  Film,
  Home,
  Lightbulb,
  Plug,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AccountSwitcher from './AccountSwitcher';
import UserMenu from './UserMenu';
import type { SessionUser } from '@/lib/auth';

const clientViews: { href: string | null; label: string; icon: typeof Home }[] = [
  { href: '/resumen', label: 'Resumen', icon: Home },
  { href: '/control', label: 'Control', icon: BarChart3 },
  { href: '/videos', label: 'Videos', icon: Film },
  { href: '/agente', label: 'Agente OS', icon: Sparkles },
];

const adminViews: { href: string | null; label: string; icon: typeof Home }[] = [
  { href: '/ideas', label: 'Banco de ideas', icon: Lightbulb },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/conexion', label: 'Integraciones', icon: Plug },
];

function NavGroup({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: typeof clientViews;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-7">
      <p className="accent-label px-3 mb-2">{title}</p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          if (!item.href) {
            return (
              <span
                key={item.label}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-muted/40 cursor-not-allowed select-none"
                title="Disponible en v1.1"
              >
                <Icon size={17} />
                {item.label}
                <span className="ml-auto text-[9px] uppercase tracking-wider bg-line/60 px-1.5 py-0.5 rounded">
                  v1.1
                </span>
              </span>
            );
          }
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-primary/15 text-white border border-primary/30'
                  : 'text-muted hover:text-white hover:bg-line/40'
              )}
            >
              <Icon size={17} className={active ? 'text-primary' : undefined} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function Sidebar({
  open = false,
  onClose,
  user,
}: {
  open?: boolean;
  onClose?: () => void;
  user?: SessionUser | null;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-dvh md:h-screen w-60 border-r border-line bg-[#0C0C15] flex flex-col z-50',
        // Móvil: drawer deslizante · Desktop: siempre visible
        'transition-transform duration-200 md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="px-5 pt-6 pb-4 flex items-start justify-between">
        <div>
          <p className="text-lg font-extrabold tracking-tight">
            Content <span className="text-primary">OS</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">Command Center</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden h-8 w-8 rounded-lg border border-line flex items-center justify-center text-muted"
          aria-label="Cerrar menú"
        >
          <X size={15} />
        </button>
      </div>
      <AccountSwitcher onNavigate={onClose} />
      <div className="flex-1 overflow-y-auto px-3">
        <NavGroup
          title="Vistas para el cliente"
          items={clientViews}
          pathname={pathname}
          onNavigate={onClose}
        />
        <NavGroup
          title="Administración"
          items={adminViews}
          pathname={pathname}
          onNavigate={onClose}
        />
      </div>
      <div className="px-5 py-4 border-t border-line">
        {user && <UserMenu user={user} />}
        <p className="text-[11px] text-muted">
          v1.0 · <span className="text-positive">●</span>{' '}
          {user && user.id !== 'local-dev' ? 'Producción' : 'Modo demo'}
        </p>
      </div>
    </aside>
  );
}
