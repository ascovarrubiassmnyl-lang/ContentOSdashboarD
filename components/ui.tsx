'use client';

// Primitivas del sistema de diseño — card, badge, botón, modal, inputs.
// Equivalentes ligeros de shadcn/ui con el look del Content OS.
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn, fmtDelta } from '@/lib/utils';

export function Card({
  children,
  className,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={cn('card p-5', glow && 'card-glow', className)}>{children}</div>
  );
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null)
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-line text-muted">
        —
      </span>
    );
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        'text-[11px] font-bold px-2 py-0.5 rounded-full',
        positive ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative'
      )}
    >
      {fmtDelta(delta)}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary:
      'bg-primary text-white hover:bg-primary/85 shadow-[0_4px_20px_rgba(124,124,245,0.35)]',
    secondary: 'bg-card border border-line text-soft hover:border-primary/50 hover:text-white',
    ghost: 'text-muted hover:text-white hover:bg-line/50',
    danger: 'bg-negative/15 text-negative hover:bg-negative/25 border border-negative/30',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        styles[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'card w-full max-h-[85vh] overflow-y-auto p-6 shadow-glow',
          wide ? 'max-w-3xl' : 'max-w-lg'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block mb-4">
      <span className="section-label block mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50"
      />
    </label>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block mb-4">
      <span className="section-label block mb-1.5">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder:text-muted/50 resize-y"
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block mb-4">
      <span className="section-label block mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-line rounded-xl px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
  size = 'md',
}: {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex flex-wrap max-w-full bg-bg border border-line rounded-xl p-1 gap-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-lg font-semibold transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
            active === t.value
              ? 'bg-primary text-white'
              : 'text-muted hover:text-white'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-primary/60 mb-4">{icon}</div>
      <p className="font-bold text-soft mb-1">{title}</p>
      {subtitle && <p className="text-sm text-muted mb-5 max-w-sm">{subtitle}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  );
}
