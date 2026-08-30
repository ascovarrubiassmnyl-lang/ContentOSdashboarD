'use client';

import React from 'react';
import Link from 'next/link';
import {
  Download,
  Monitor,
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  Zap,
  ArrowLeft,
  Share,
  Plus,
  Chrome,
} from 'lucide-react';

export default function DescargarPage() {
  const handleInstall = () => {
    // Disparar el evento de instalación si está disponible
    const evt = (window as unknown as { _pwaInstallPrompt?: { prompt: () => void } })
      ._pwaInstallPrompt;
    if (evt) {
      evt.prompt();
    } else {
      // Scroll a la sección de instrucciones
      document.getElementById('instrucciones')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-[#e8e8f2]">
      {/* ── HEADER SIMPLE ── */}
      <header className="fixed top-0 w-full z-50 border-b border-line/60 bg-bg/80 backdrop-blur-md">
        <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft size={16} className="text-muted group-hover:text-white transition-colors" />
            <span className="text-lg font-extrabold tracking-tight">
              Content <span className="text-primary">OS</span>
            </span>
          </Link>
          <Link
            href="/login?mode=register"
            className="text-xs font-semibold text-muted hover:text-white transition-colors"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className="pt-32 md:pt-40 pb-16 px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-card/60 backdrop-blur-sm mb-6 landing-fade-in">
          <Download size={12} className="text-primary" />
          <span className="text-[11px] font-bold tracking-wide text-muted">
            Disponible para todas las plataformas
          </span>
        </div>

        <h1
          className="text-3xl md:text-5xl lg:text-6xl font-extrabold max-w-3xl mx-auto leading-[1.1] mb-5 tracking-[-0.03em] landing-fade-in-delay-1"
          style={{
            background: 'linear-gradient(to bottom, #ffffff, #ffffff 60%, rgba(255,255,255,0.45))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Instala ContentOS en tu dispositivo
        </h1>

        <p className="text-sm md:text-base text-muted max-w-xl mx-auto mb-10 leading-relaxed landing-fade-in-delay-2">
          Accede a tu dashboard de Instagram directamente desde tu escritorio o
          pantalla de inicio, con carga instantánea y soporte offline.
        </p>

        <button
          onClick={handleInstall}
          className="bg-primary text-white font-bold text-sm rounded-xl px-8 py-4 hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_24px_rgba(124,124,245,0.4)] inline-flex items-center gap-2 group landing-fade-in-delay-3"
        >
          <Download size={16} />
          Instalar ContentOS
        </button>
      </section>

      {/* ── DISPOSITIVOS ── */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <DeviceCard
            icon={<Monitor size={22} />}
            title="Escritorio"
            desc="Windows, Mac y Linux. Se instala desde Chrome o Edge como una app nativa independiente."
          />
          <DeviceCard
            icon={<Smartphone size={22} />}
            title="Móvil"
            desc="iOS y Android. Agrega ContentOS a tu pantalla de inicio para acceso directo sin App Store."
          />
          <DeviceCard
            icon={<Tablet size={22} />}
            title="Tablet"
            desc="iPad y tablets Android. Interfaz adaptable que aprovecha el espacio adicional de pantalla."
          />
        </div>
      </section>

      {/* ── BENEFICIOS ── */}
      <section className="py-16 px-6 max-w-5xl mx-auto border-t border-line">
        <p className="accent-label text-center mb-3">¿Por qué instalarla?</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center mb-10 tracking-tight">
          Ventajas de la app instalada
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <BenefitCard
            icon={<Zap size={16} />}
            title="Carga instantánea"
            desc="Los recursos se precachean para abrir en milisegundos."
          />
          <BenefitCard
            icon={<WifiOff size={16} />}
            title="Funciona offline"
            desc="Consulta tus datos más recientes incluso sin conexión a internet."
          />
          <BenefitCard
            icon={<Wifi size={16} />}
            title="Actualización automática"
            desc="Se actualiza en segundo plano cada vez que hay una nueva versión."
          />
          <BenefitCard
            icon={<Download size={16} />}
            title="Sin tienda de apps"
            desc="No necesitas App Store ni Google Play. Se instala directamente desde el navegador."
          />
        </div>
      </section>

      {/* ── INSTRUCCIONES ── */}
      <section id="instrucciones" className="py-16 px-6 max-w-5xl mx-auto border-t border-line scroll-mt-20">
        <p className="accent-label text-center mb-3">Guía paso a paso</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center mb-12 tracking-tight">
          Cómo instalar ContentOS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Chrome / Edge */}
          <div className="bg-card border border-line rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Chrome size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Chrome / Edge (Escritorio)</p>
                <p className="text-[10px] text-muted">Windows · Mac · Linux</p>
              </div>
            </div>
            <ol className="space-y-3 text-xs text-soft">
              <li className="flex gap-2.5">
                <StepBadge n={1} />
                <span>
                  Abre <strong className="text-white">contentos.app</strong> en tu
                  navegador Chrome o Edge.
                </span>
              </li>
              <li className="flex gap-2.5">
                <StepBadge n={2} />
                <span>
                  Haz clic en el icono de <strong className="text-white">instalar</strong> en
                  la barra de direcciones (o usa el botón de esta página).
                </span>
              </li>
              <li className="flex gap-2.5">
                <StepBadge n={3} />
                <span>
                  Confirma la instalación. ContentOS aparecerá como una{' '}
                  <strong className="text-white">app independiente</strong> en tu escritorio.
                </span>
              </li>
            </ol>
          </div>

          {/* iOS Safari */}
          <div className="bg-card border border-line rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-pink/10 border border-pink/20 flex items-center justify-center text-pink">
                <Smartphone size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Safari (iPhone / iPad)</p>
                <p className="text-[10px] text-muted">iOS · iPadOS</p>
              </div>
            </div>
            <ol className="space-y-3 text-xs text-soft">
              <li className="flex gap-2.5">
                <StepBadge n={1} />
                <span>
                  Abre <strong className="text-white">contentos.app</strong> en Safari.
                </span>
              </li>
              <li className="flex gap-2.5">
                <StepBadge n={2} />
                <span className="flex items-center gap-1 flex-wrap">
                  Pulsa el botón <Share size={12} className="text-primary inline" />{' '}
                  <strong className="text-white">Compartir</strong> en la barra inferior.
                </span>
              </li>
              <li className="flex gap-2.5">
                <StepBadge n={3} />
                <span className="flex items-center gap-1 flex-wrap">
                  Selecciona <Plus size={12} className="text-primary inline" />{' '}
                  <strong className="text-white">«Añadir a la pantalla de inicio»</strong>.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-16 px-6 max-w-5xl mx-auto border-t border-line text-center">
        <h2 className="text-xl md:text-2xl font-extrabold text-white mb-3 tracking-tight">
          ¿Aún no tienes cuenta?
        </h2>
        <p className="text-xs text-muted mb-6">
          Regístrate gratis y luego instala ContentOS en tu dispositivo favorito.
        </p>
        <Link
          href="/login?mode=register"
          className="bg-gradient-to-b from-white via-white/95 to-white/60 text-black font-bold text-sm rounded-xl px-7 py-3.5 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] inline-flex items-center gap-2"
        >
          Crear mi cuenta gratis
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-line/60 bg-bg py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight">
              Content <span className="text-primary">OS</span>
            </span>
            <span className="text-[10px] text-muted font-medium border-l border-line pl-2.5">
              Command Center
            </span>
          </div>
          <p className="text-[11px] text-muted">
            © {new Date().getFullYear()} ContentOS · Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function DeviceCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-card border border-line rounded-2xl p-6 hover:border-primary/40 hover:shadow-glow transition-all duration-300 group text-center">
      <div className="h-12 w-12 mx-auto rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
      <p className="text-[11px] text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl border border-line/50 bg-card/40">
      <span className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
        {icon}
      </span>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-[10px] text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="h-5 w-5 shrink-0 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
      {n}
    </span>
  );
}
