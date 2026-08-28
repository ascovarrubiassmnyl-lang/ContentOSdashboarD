'use client';

import { X, Bell, CalendarDays, FileText, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

export default function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Prevent scrolling on body when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Mock data
  const notifications = [
    {
      id: 1,
      type: 'reminder',
      title: 'Faltan 2 horas para publicar el Reel',
      desc: 'El reel "Campaña X" está agendado para hoy a las 18:00.',
      time: 'Hace 5 min',
      icon: CalendarDays,
      iconCls: 'bg-orange/15 text-orange',
    },
    {
      id: 2,
      type: 'report',
      title: 'Reporte semanal generado',
      desc: 'El reporte del 20-27 de agosto ya está disponible.',
      time: 'Hace 2 horas',
      icon: FileText,
      iconCls: 'bg-primary/15 text-primary',
    },
    {
      id: 3,
      type: 'alert',
      title: 'Cuenta de Zernio expirada',
      desc: 'Es necesario reconectar la cuenta para continuar sincronizando.',
      time: 'Ayer',
      icon: Plug,
      iconCls: 'bg-negative/15 text-negative',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Slide-over panel */}
      <div 
        className={cn(
          'fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-card border-l border-line shadow-glow flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-primary" />
            <h2 className="text-base font-extrabold">Notificaciones</h2>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-line/40 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            {notifications.map(n => {
              const Icon = n.icon;
              return (
                <div key={n.id} className="flex gap-4 p-4 rounded-xl border border-line bg-bg">
                  <div className={cn('h-10 w-10 shrink-0 flex items-center justify-center rounded-xl', n.iconCls)}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight mb-1">{n.title}</p>
                    <p className="text-[12px] text-muted leading-relaxed mb-2">{n.desc}</p>
                    <p className="text-[10px] font-semibold text-soft uppercase tracking-wider">{n.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="p-5 border-t border-line bg-bg">
          <Button variant="secondary" className="w-full text-xs" onClick={onClose}>
            Marcar todas como leídas
          </Button>
        </div>
      </div>
    </>
  );
}
