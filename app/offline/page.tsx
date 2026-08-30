'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff, RotateCcw, Home } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg text-[#e8e8f2] flex items-center justify-center p-6 select-none">
      <div className="card w-full max-w-md p-8 bg-card border border-line rounded-3xl shadow-glow text-center flex flex-col items-center">
        {/* Logo */}
        <div className="mb-6">
          <p className="text-xl font-extrabold tracking-tight">
            Content <span className="text-primary">OS</span>
          </p>
          <p className="text-[11px] text-muted">Command Center</p>
        </div>

        {/* Wifi Off Icon */}
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-6 shadow-[0_0_24px_rgba(124,124,245,0.2)]">
          <WifiOff size={28} className="animate-pulse" />
        </div>

        {/* Title and message */}
        <h1 className="text-xl font-bold text-white mb-2">
          Sin conexión a internet
        </h1>
        <p className="text-xs text-muted leading-relaxed mb-8 max-w-xs">
          Parece que has perdido la conexión de red. ContentOS intentará reconectarse
          automáticamente cuando recuperes tu señal.
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-white font-semibold text-sm rounded-xl py-3 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(124,124,245,0.35)]"
          >
            <RotateCcw size={15} />
            Reintentar conexión
          </button>

          <Link
            href="/"
            className="w-full border border-line bg-bg text-soft hover:text-white hover:border-primary/40 font-semibold text-xs rounded-xl py-2.5 transition-all flex items-center justify-center gap-2"
          >
            <Home size={14} />
            Ir al inicio
          </Link>
        </div>

        <p className="text-[10px] text-muted/60 mt-6">
          Modo PWA Offline · ContentOS v1.0
        </p>
      </div>
    </div>
  );
}
