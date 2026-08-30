'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Menu,
  X,
  Sparkles,
  CalendarDays,
  BarChart3,
  Lightbulb,
  Zap,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   Landing Page — ContentOS
   Estilo: referencia SaaS-template de 21st.dev, adaptada al
   branding de ContentOS (fondo #0A0A12, primary #7C7CF5, etc.).
   Las animaciones viven en globals.css (landing-fade-in, etc.)
   ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-[#e8e8f2] overflow-x-hidden">
      {/* ── HEADER ── */}
      <header className="fixed top-0 w-full z-50 border-b border-line/60 bg-bg/80 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-xl font-extrabold tracking-tight transition-transform group-hover:scale-105">
                Content{' '}
                <span className="text-primary transition-colors group-hover:text-pink">
                  OS
                </span>
              </span>
              <span className="text-[9px] uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                v1.0
              </span>
            </Link>

            {/* Desktop nav links — centrado absoluto */}
            <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <a
                href="#features"
                className="text-sm text-muted hover:text-soft transition-colors font-medium"
              >
                Características
              </a>
              <a
                href="#agente"
                className="text-sm text-muted hover:text-soft transition-colors font-medium flex items-center gap-1"
              >
                <Sparkles size={14} className="text-primary" />
                Agente OS
              </a>
              <a
                href="#demo"
                className="text-sm text-muted hover:text-soft transition-colors font-medium"
              >
                Vista Previa
              </a>
            </div>

            {/* Desktop auth buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-muted hover:text-white transition-colors font-semibold px-4 py-2"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/login?mode=register"
                className="bg-gradient-to-b from-white via-white/95 to-white/60 text-black font-semibold text-sm rounded-xl px-5 py-2.5 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
              >
                Comenzar Gratis
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              type="button"
              className="md:hidden text-soft hover:text-white p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-bg/95 backdrop-blur-lg border-t border-line landing-slide-down">
            <div className="px-6 py-5 flex flex-col gap-4">
              <a
                href="#features"
                className="text-sm text-muted hover:text-white transition-colors py-2 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Características
              </a>
              <a
                href="#agente"
                className="text-sm text-muted hover:text-white transition-colors py-2 font-medium flex items-center gap-1.5"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Sparkles size={14} className="text-primary" />
                Agente OS
              </a>
              <a
                href="#demo"
                className="text-sm text-muted hover:text-white transition-colors py-2 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Vista Previa
              </a>
              <div className="flex flex-col gap-3 pt-4 border-t border-line">
                <Link
                  href="/login"
                  className="text-center text-sm font-semibold text-muted hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/login?mode=register"
                  className="bg-white text-black font-bold text-center text-sm rounded-xl py-3 hover:bg-soft active:scale-95 transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Comenzar Gratis
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-start px-6 pt-32 md:pt-40 pb-20 max-w-7xl mx-auto z-10">
        {/* Badge */}
        <aside className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-line bg-card/60 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 landing-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-pink animate-pulse" />
          <span className="text-[11px] font-bold tracking-wide text-muted">
            Lanzamiento Demo v1.0 disponible
          </span>
          <Link
            href="/login?mode=register"
            className="flex items-center gap-0.5 text-[11px] font-bold text-primary hover:text-pink transition-all ml-1"
          >
            Registrarse
            <ArrowRight size={10} />
          </Link>
        </aside>

        {/* Headline */}
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-center max-w-4xl px-4 leading-[1.1] mb-6 tracking-[-0.04em] landing-fade-in-delay-1"
          style={{
            background:
              'linear-gradient(to bottom, #ffffff, #ffffff 60%, rgba(255,255,255,0.45))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          El centro de mando{' '}
          <br className="hidden sm:inline" />
          inteligente para tu Instagram
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base lg:text-lg text-muted text-center max-w-2xl px-6 mb-10 leading-relaxed landing-fade-in-delay-2">
          Métricas unificadas, calendario de contenidos, banco de ideas de video
          y un copiloto inteligente impulsado por IA para llevar tu estrategia de
          contenidos al siguiente nivel.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 mb-20 landing-fade-in-delay-3">
          <Link
            href="/login?mode=register"
            className="w-full sm:w-auto bg-primary text-white font-bold text-sm rounded-xl px-7 py-3.5 hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_24px_rgba(124,124,245,0.4)] flex items-center justify-center gap-2 group"
          >
            Comenzar gratis ahora
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto text-center border border-line bg-card/40 text-soft hover:text-white hover:bg-line font-semibold text-sm rounded-xl px-7 py-3.5 transition-all"
          >
            Conocer características
          </a>
        </div>

        {/* Dashboard mockup */}
        <div
          id="demo"
          className="w-full max-w-5xl relative landing-fade-in-delay-3 scroll-mt-24"
        >
          {/* Glow radial */}
          <div
            className="absolute left-1/2 top-1/2 w-[110%] aspect-square max-w-[800px] pointer-events-none z-0 opacity-40 mix-blend-screen landing-glow"
            style={{
              background:
                'radial-gradient(circle, rgba(124,124,245,0.2) 0%, rgba(236,91,154,0.08) 50%, transparent 70%)',
            }}
          />

          {/* Glow image overlay — same asset from reference */}
          <div
            className="absolute left-1/2 w-[90%] pointer-events-none z-0"
            style={{ top: '-23%', transform: 'translateX(-50%)' }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.postimg.cc/Ss6yShGy/glows.png"
              alt=""
              className="w-full h-auto opacity-70"
              loading="eager"
            />
          </div>

          {/* Browser-style frame */}
          <div className="relative z-10 border border-line rounded-2xl bg-[#0C0C15] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line bg-bg/40 rounded-t-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-negative" />
              <span className="w-2.5 h-2.5 rounded-full bg-orange" />
              <span className="w-2.5 h-2.5 rounded-full bg-positive" />
              <span className="text-[10px] text-muted ml-4 font-mono select-none">
                contentos.saas / resumen
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://i.postimg.cc/SKcdVTr1/Dashboard2.png"
              alt="Dashboard de ContentOS mostrando métricas de Instagram"
              className="w-full h-auto rounded-b-xl border border-line/40"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        className="relative py-24 bg-card/25 border-y border-line scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="accent-label mb-3">Todo en un solo lugar</p>
            <p className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Construido específicamente para{' '}
              <br className="hidden md:inline" />
              optimizar tu flujo de trabajo
            </p>
            <p className="text-muted text-sm md:text-base mt-4">
              Olvida el desorden de usar múltiples herramientas. Conecta tu
              Instagram y gestiona todo de forma nativa e integrada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<BarChart3 size={18} />}
              color="primary"
              title="Métricas y Resumen"
              desc="Monitorea el crecimiento de seguidores, alcance y engagement de tu cuenta con gráficas intuitivas."
            />
            <FeatureCard
              icon={<CalendarDays size={18} />}
              color="pink"
              title="Calendario Editorial"
              desc="Agenda y visualiza de forma mensual tu grilla de publicaciones, historias y Reels para no perder consistencia."
            />
            <FeatureCard
              icon={<Lightbulb size={18} />}
              color="orange"
              title="Banco de Ideas"
              desc="Captura cualquier destello de inspiración. Organiza, etiqueta y prepara tus guiones de video."
            />
            <FeatureCard
              icon={<Sparkles size={18} />}
              color="primary"
              title="Agente OS (IA)"
              desc="Un asistente inteligente integrado que genera ideas, audita tus posts y te brinda guías personalizadas."
            />
          </div>
        </div>
      </section>

      {/* ── AGENT SPOTLIGHT ── */}
      <section id="agente" className="py-24 max-w-7xl mx-auto px-6 scroll-mt-20">
        <div className="bg-card border border-line rounded-3xl shadow-glow relative overflow-hidden flex flex-col lg:flex-row items-center gap-10 p-8 md:p-12">
          {/* Background blob */}
          <div className="absolute right-0 bottom-0 w-80 h-80 pointer-events-none z-0 rounded-full opacity-10 bg-gradient-to-tr from-primary to-pink blur-3xl" />

          <div className="flex-1 relative z-10">
            <p className="accent-label block mb-3">
              Impulsado por Inteligencia Artificial
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
              Agente OS: Tu asistente de crecimiento personal
            </h2>
            <p className="text-muted text-sm md:text-base leading-relaxed mb-6">
              El Agente OS analiza los resultados de tu cuenta, evalúa el
              rendimiento y te asesora en tiempo real. Puedes pedirle que
              estructure copies persuasivos, analice la competencia o audite
              publicaciones específicas para mejorar el gancho y retención.
            </p>

            <ul className="space-y-3.5 mb-8">
              <AgentBullet>
                <strong>Generador de Guiones:</strong> Convierte tus ideas
                rápidas en borradores estructurados con ganchos, cuerpo y
                llamado a la acción.
              </AgentBullet>
              <AgentBullet>
                <strong>Auditorías instantáneas:</strong> Pregúntale al agente
                sobre tu rendimiento en posts específicos y recibe feedbacks
                concretos.
              </AgentBullet>
              <AgentBullet>
                <strong>Sincronización con Métricas:</strong> El agente consume
                la data real de tus cuentas de Instagram para aconsejarte con
                datos sólidos.
              </AgentBullet>
            </ul>

            <Link
              href="/login?mode=register"
              className="bg-gradient-to-b from-white via-white/95 to-white/60 text-black font-bold text-sm rounded-xl px-6 py-3 hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2"
            >
              Probar Agente OS Gratis
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Chat mockup */}
          <div className="w-full lg:w-96 flex flex-col gap-3 relative z-10 shrink-0 select-none">
            <div className="bg-bg/80 border border-line rounded-2xl p-4 max-w-[85%] self-start flex gap-3">
              <span className="h-7 w-7 rounded-full bg-card border border-line flex items-center justify-center text-muted shrink-0 text-[10px] font-bold">
                TÚ
              </span>
              <p className="text-xs text-soft">
                ¿Cómo puedo mejorar el engagement de mis Reels? Últimamente el
                alcance ha bajado un poco.
              </p>
            </div>

            <div className="bg-card border border-primary/30 rounded-2xl p-4 max-w-[90%] self-end shadow-glow flex gap-3">
              <span className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Sparkles size={13} />
              </span>
              <div>
                <p className="text-[10px] font-bold text-primary mb-1">
                  AGENTE OS
                </p>
                <p className="text-xs text-soft leading-relaxed">
                  Analizando tu perfil, veo que tus Reels de más de 30 seg.
                  retienen un 15 % menos. Te recomiendo estructurar ganchos
                  visuales más dinámicos en los primeros 3 segundos y acortar la
                  duración media a 15-20 segundos. ¡He preparado una plantilla
                  para tu próxima idea!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-24 bg-gradient-to-b from-transparent to-card/30 border-t border-line overflow-hidden">
        <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] pointer-events-none rounded-full bg-primary/10 blur-3xl" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Comienza a optimizar tu Instagram hoy
          </h2>
          <p className="text-muted text-sm md:text-base max-w-xl mx-auto mb-10 leading-relaxed">
            Regístrate de forma totalmente gratuita y accede al entorno demo de
            ContentOS en segundos. No necesitas tarjeta de crédito.
          </p>
          <Link
            href="/login?mode=register"
            className="bg-gradient-to-b from-white via-white/95 to-white/60 text-black font-bold text-base rounded-xl px-8 py-4 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_30px_rgba(255,255,255,0.15)] inline-flex items-center gap-2 group"
          >
            Crear mi cuenta gratis
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-line/60 bg-bg py-8 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight">
              Content <span className="text-primary">OS</span>
            </span>
            <span className="text-[10px] text-muted font-medium border-l border-line pl-2.5">
              Command Center
            </span>
          </div>
          <p className="text-[11px] text-muted">
            © {new Date().getFullYear()} ContentOS · Todos los derechos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

const COLORS: Record<string, { icon: string; border: string; shadow: string }> = {
  primary: {
    icon: 'bg-primary/10 border-primary/20 text-primary',
    border: 'hover:border-primary/40',
    shadow: 'hover:shadow-glow',
  },
  pink: {
    icon: 'bg-pink/10 border-pink/20 text-pink',
    border: 'hover:border-pink/40',
    shadow: 'hover:shadow-glowPink',
  },
  orange: {
    icon: 'bg-orange/10 border-orange/20 text-orange',
    border: 'hover:border-orange/40',
    shadow:
      'hover:shadow-[0_0_0_1px_rgba(245,158,75,0.25),0_8px_32px_rgba(245,158,75,0.12)]',
  },
};

function FeatureCard({
  icon,
  color,
  title,
  desc,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  desc: string;
}) {
  const c = COLORS[color] ?? COLORS.primary;
  return (
    <div
      className={`bg-card border border-line rounded-2xl p-6 ${c.border} ${c.shadow} transition-all duration-300 flex flex-col justify-between group`}
    >
      <div>
        <div
          className={`h-10 w-10 rounded-xl border flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${c.icon}`}
        >
          {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-xs text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function AgentBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="h-5 w-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
        <Zap size={12} />
      </span>
      <span className="text-xs md:text-sm text-soft">{children}</span>
    </li>
  );
}
