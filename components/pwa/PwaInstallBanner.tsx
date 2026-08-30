'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'contentos_pwa_install_dismissed';

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Si ya está instalada o en modo standalone, no mostrar nada
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Si el usuario descartó recientemente, no insistir
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 1000 * 60 * 60 * 24 * 7) {
      // Descartado por 7 días
      return;
    }

    // 3. Detectar iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIosDevice && isSafari) {
      setIsIos(true);
      // Mostrar con un breve retardo para no interferir con la carga inicial
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // 4. Capturar el evento estándar de instalación (Chrome/Edge/Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(!showIosGuide);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!visible) return null;

  return (
    <aside 
      aria-label="Instalación de la aplicación"
      className="fixed bottom-5 right-5 left-5 md:left-auto md:w-96 z-[70] bg-[#12121C]/95 backdrop-blur-md border border-[#1E1E2E] rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-fade-in"
    >
      <div className="flex items-start gap-3">
        {/* Icono PWA */}
        <div className="h-10 w-10 rounded-xl bg-[#7C7CF5]/10 border border-[#7C7CF5]/20 flex items-center justify-center text-[#7C7CF5] shrink-0">
          <Download size={20} />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-white">Instalar ContentOS</p>
            <button
              onClick={handleDismiss}
              className="text-[#8B8B9E] hover:text-white transition-colors p-1"
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-[11px] text-[#8B8B9E] mt-0.5 leading-snug">
            Accede más rápido desde tu pantalla de inicio con soporte offline.
          </p>

          {/* Guía para iOS */}
          {showIosGuide && (
            <div className="mt-3 p-2.5 rounded-lg bg-[#0A0A12] border border-[#1E1E2E] text-[11px] text-[#C7C7D6] space-y-1">
              <p className="flex items-center gap-1.5 font-semibold text-white">
                <Share size={12} className="text-[#7C7CF5]" /> En Safari:
              </p>
              <p>1. Pulsa el botón de <strong>Compartir</strong> en la barra inferior.</p>
              <p>2. Selecciona <strong>«Añadir a la pantalla de inicio»</strong>.</p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-[#7C7CF5] text-white font-semibold text-xs py-2 px-3 rounded-lg hover:bg-[#7C7CF5]/90 transition-all shadow-[0_2px_10px_rgba(124,124,245,0.3)]"
            >
              {isIos ? (showIosGuide ? 'Entendido' : 'Cómo instalar') : 'Instalar App'}
            </button>
            <button
              onClick={handleDismiss}
              className="text-[11px] text-[#8B8B9E] hover:text-white px-2 py-1.5 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
