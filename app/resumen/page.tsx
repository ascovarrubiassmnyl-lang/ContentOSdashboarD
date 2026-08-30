'use client';

// Resumen — vista ejecutiva para el cliente: la semana de un vistazo.
// Combina métricas 7d, lo más destacado, próximas piezas y último reporte.
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Clock,
  Eye,
  FileText,
  Film,
  Layers,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { Button, Card, DeltaBadge, Spinner } from '@/components/ui';
import NotificationsPanel from '@/components/NotificationsPanel';
import {
  CalendarItem,
  ConnectionResponse,
  MetricsResponse,
  Report,
} from '@/types';
import { cn, fmtInt, fmtPct, fmtSeconds, relativeTime } from '@/lib/utils';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  idea: { label: 'Idea', cls: 'bg-line text-muted' },
  en_produccion: { label: 'En producción', cls: 'bg-orange/15 text-orange' },
  listo: { label: 'Listo', cls: 'bg-positive/15 text-positive' },
  publicado: { label: 'Publicado', cls: 'bg-primary/15 text-primary' },
};

const FORMAT_ICON: Record<string, typeof Film> = {
  reel: Film,
  carrusel: Layers,
  historia: Clock,
  ad: Zap,
};

export default function ResumenPage() {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const {
    data: metrics,
    isError: metricsFailed,
    error: metricsError,
  } = useQuery<MetricsResponse>({
    queryKey: ['metrics', '7d'],
    // Sin este check, un 500 devuelve HTML, `.json()` revienta y la página se
    // queda cargando para siempre sin decir qué pasó. Un 409 (sin ninguna
    // cuenta conectada todavía) sí trae un mensaje claro — se propaga tal
    // cual en vez de taparlo con uno genérico.
    queryFn: async () => {
      const res = await fetch('/api/metrics?period=7d');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'No se pudieron cargar las métricas');
      }
      return res.json();
    },
  });
  const { data: cal } = useQuery<{ items: CalendarItem[] }>({
    queryKey: ['calendar'],
    queryFn: async () => (await fetch('/api/calendar')).json(),
  });
  const { data: rep } = useQuery<{ reports: Report[] }>({
    queryKey: ['reports'],
    queryFn: async () => (await fetch('/api/reports')).json(),
  });
  const { data: conn } = useQuery<ConnectionResponse>({
    queryKey: ['connection'],
    queryFn: async () => (await fetch('/api/connection')).json(),
  });

  if (!metrics) {
    if (metricsFailed) {
      return (
        <div className="card border-negative/40 bg-negative/5 p-6 mt-10 max-w-lg mx-auto text-center">
          <p className="font-bold text-negative mb-1">No se pudieron cargar las métricas</p>
          <p className="text-sm text-muted mb-4">
            {(metricsError as Error)?.message ||
              conn?.syncError ||
              'Revisa el estado de la conexión de esta cuenta y vuelve a sincronizar.'}
          </p>
          <Link href="/conexion">
            <Button variant="secondary">Ir a Conexión IG</Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-40 gap-3 text-muted">
        <Spinner /> Cargando resumen…
      </div>
    );
  }

  const kpi = (key: string) => metrics.kpis.find((k) => k.key === key);
  const followers = kpi('followers');
  const reach = kpi('reach');
  const views = kpi('views');
  const er = kpi('er');

  const topPost = metrics.topPosts[0];
  const topEng = topPost
    ? topPost.likes + topPost.comments + topPost.saves + topPost.shares
    : 0;

  // Mejor franja de publicación a partir del heatmap
  const bestSlot = metrics.heatmap.reduce(
    (best, d) => {
      if (d.am > best.value) best = { label: `${d.day} por la mañana`, value: d.am };
      if (d.pm > best.value) best = { label: `${d.day} por la tarde`, value: d.pm };
      return best;
    },
    { label: '—', value: 0 }
  );

  // Próximas piezas (desde hoy, máx 5)
  const now = Date.now();
  const upcoming = (cal?.items ?? [])
    .filter((i) => new Date(i.scheduled_at).getTime() >= now - 86400_000 && i.status !== 'publicado')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 5);

  const lastReport = rep?.reports?.[0] ?? null;

  const heroCards = [
    { icon: Users, label: 'Seguidores', value: fmtInt(followers?.value ?? 0), delta: followers?.delta ?? null, desc: 'Total actual' },
    { icon: TrendingUp, label: 'Alcance · 7 días', value: fmtInt(reach?.value ?? 0), delta: reach?.delta ?? null, desc: 'Cuentas alcanzadas' },
    { icon: Eye, label: 'Vistas · 7 días', value: fmtInt(views?.value ?? 0), delta: views?.delta ?? null, desc: 'Reproducciones' },
    { icon: Zap, label: 'Interacción', value: fmtPct(er?.value ?? 0), delta: er?.delta ?? null, desc: 'ER del periodo' },
  ];

  return (
    <div>
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="accent-label mb-1">Vista para el cliente</p>
          <h1 className="text-xl font-extrabold">
            Resumen de la semana
          </h1>
          <p className="text-sm text-muted mt-1">
            {conn?.workspace?.label ?? '—'} · datos actualizados{' '}
            {conn?.account ? relativeTime(conn.account.last_sync_at) : 'nunca'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 w-10 p-0 rounded-full flex items-center justify-center text-muted hover:text-foreground" onClick={() => setIsNotifOpen(true)}>
            <Bell size={18} />
          </Button>
        </div>
      </div>

      {/* ── Hero: 4 números de la semana ── */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        {heroCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="col-span-6 xl:col-span-3">
              <div className="flex items-start justify-between mb-3">
                <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon size={17} />
                </span>
                <DeltaBadge delta={c.delta} />
              </div>
              <p className="text-3xl font-extrabold leading-none mb-1">{c.value}</p>
              <p className="text-xs font-semibold text-soft">{c.label}</p>
              <p className="text-[11px] text-muted">{c.desc}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── Lo más destacado ── */}
        <Card className="col-span-12 xl:col-span-7" glow={false}>
          <p className="accent-label mb-1">Highlights</p>
          <h3 className="font-extrabold mb-4">✨ Lo más destacado</h3>
          <div className="space-y-4">
            {topPost && (
              <div className="flex items-start gap-4 bg-bg border border-line rounded-xl p-4">
                <span className="h-10 w-10 rounded-xl bg-orange/15 text-orange flex items-center justify-center shrink-0">
                  <Trophy size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted mb-0.5">
                    Post estrella del periodo
                  </p>
                  <p className="text-sm font-bold truncate">&ldquo;{topPost.hook}&rdquo;</p>
                  <p className="text-xs text-muted mt-1">
                    {topPost.media_type === 'REEL'
                      ? 'Reel'
                      : topPost.media_type === 'CAROUSEL'
                      ? 'Carrusel'
                      : 'Imagen'}{' '}
                    · {fmtInt(topEng)} interacciones · {fmtInt(topPost.reach)} de alcance
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-4 bg-bg border border-line rounded-xl p-4">
                <span className="h-10 w-10 rounded-xl bg-positive/15 text-positive flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted mb-0.5">
                    Mejor momento para publicar
                  </p>
                  <p className="text-sm font-bold">{bestSlot.label}</p>
                  <p className="text-xs text-muted mt-1">
                    {fmtInt(bestSlot.value)} interacciones acumuladas
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 bg-bg border border-line rounded-xl p-4">
                <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Film size={18} />
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-bold text-muted mb-0.5">
                    Retención media de reels
                  </p>
                  <p className="text-sm font-bold">{fmtSeconds(metrics.avgWatchTime)}</p>
                  <p className="text-xs text-muted mt-1">
                    El 70% del scroll se decide antes del segundo 3
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Link
            href="/control"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary mt-4 hover:underline"
          >
            Ver el control completo de métricas <ArrowRight size={13} />
          </Link>
        </Card>

        {/* ── Próximas piezas ── */}
        <Card className="col-span-12 xl:col-span-5" glow={false}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="accent-label mb-1">Editorial</p>
              <h3 className="font-extrabold">📅 Próximas piezas</h3>
            </div>
            <Link
              href="/calendario"
              className="text-xs font-bold text-primary hover:underline"
            >
              Calendario →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays size={28} className="text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-muted">Nada agendado los próximos días.</p>
              <Link href="/calendario">
                <Button variant="secondary" className="mt-3">
                  Agendar una pieza
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((item) => {
                const Icon = FORMAT_ICON[item.format] ?? Film;
                const badge = STATUS_BADGE[item.status];
                const d = new Date(item.scheduled_at);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-bg border border-line rounded-xl px-3.5 py-3"
                  >
                    <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{item.title}</p>
                      <p className="text-[11px] text-muted">
                        {d.toLocaleDateString('es-CO', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        ·{' '}
                        {d.toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                        badge.cls
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Último reporte ── */}
        <Card className="col-span-12 xl:col-span-12" glow={false}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="accent-label mb-1">Análisis</p>
              <h3 className="font-extrabold">📊 Último reporte</h3>
            </div>
            <Link href="/agente" className="text-xs font-bold text-primary hover:underline">
              Todos los reportes →
            </Link>
          </div>
          {lastReport ? (
            <div>
              <p className="text-sm font-bold mb-1">
                {lastReport.period_start} → {lastReport.period_end}
              </p>
              <p className="text-xs text-muted leading-relaxed line-clamp-3">
                {lastReport.summary_md
                  .replace(/[#*_>-]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 280)}
                …
              </p>
              <p className="text-[11px] text-muted mt-2">
                Generado {relativeTime(lastReport.created_at)}
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText size={28} className="text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-muted">Aún no hay reportes generados.</p>
              <Link href="/agente">
                <Button variant="secondary" className="mt-3">
                  Generar el primero
                </Button>
              </Link>
            </div>
          )}
        </Card>

      </div>
      <NotificationsPanel open={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
}
