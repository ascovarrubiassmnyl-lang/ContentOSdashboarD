'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CheckCircle2, Gauge, Plug } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Spinner, Tabs } from '@/components/ui';
import {
  FollowersChart,
  FormatBar,
  ReactionsDonut,
} from '@/components/control/charts';
import {
  FunnelCard,
  Heatmap,
  KpiCard,
  OperationCard,
  PostsPreview,
  ReelRetentionList,
  RetentionCard,
  StoriesCard,
  TopPosts,
} from '@/components/control/widgets';
import { ConnectionResponse, MetricsResponse, Period } from '@/types';
import { relativeTime } from '@/lib/utils';

async function fetchMetrics(period: Period): Promise<MetricsResponse> {
  const res = await fetch(`/api/metrics?period=${period}`);
  if (!res.ok) throw new Error('Error cargando métricas');
  return res.json();
}

async function fetchAccount(): Promise<ConnectionResponse> {
  const res = await fetch('/api/connection');
  if (!res.ok) throw new Error('Error cargando cuenta');
  return res.json();
}

// El nombre de la cuenta sale del registro, no de un valor fijo. Si el nombre
// visible ya es el propio usuario, no se repite el @usuario al lado.
function displayName(conn?: ConnectionResponse): { title: string; handle: string | null } {
  const label = conn?.workspace?.label ?? '';
  const username = conn?.workspace?.username ?? conn?.account?.username ?? '';
  if (!label && !username) return { title: 'Sin cuenta', handle: null };
  if (!username) return { title: label, handle: null };
  if (label.replace(/^@/, '') === username) return { title: `@${username}`, handle: null };
  return { title: label, handle: `@${username}` };
}

export default function ControlPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const { data, isLoading } = useQuery({
    queryKey: ['metrics', period],
    queryFn: () => fetchMetrics(period),
  });
  const { data: conn } = useQuery({ queryKey: ['connection'], queryFn: fetchAccount });
  const name = displayName(conn);

  return (
    <div>
      {/* ── Header de perfil ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-pink to-orange flex items-center justify-center text-xl font-extrabold text-white shadow-glow">
            {name.title.replace(/^@/, '').charAt(0).toUpperCase() || '·'}
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">
              {name.title}{' '}
              {name.handle && (
                <span className="text-muted font-semibold text-base">{name.handle}</span>
              )}
            </h1>
            <p className="text-xs text-muted">
              {conn?.account
                ? `Última actualización ${relativeTime(conn.account.last_sync_at)} · próxima sync mañana 7:00 a.m.`
                : conn
                  ? 'Sin datos sincronizados todavía'
                  : 'Cargando estado de conexión…'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/calendario">
            <Button>
              <CalendarDays size={14} className="inline mr-1.5 -mt-0.5" />
              Agendar pieza
            </Button>
          </Link>
          <Link href="/calendario">
            <Button variant="secondary">Ver calendario</Button>
          </Link>
          <Link href="/conexion">
            <Button variant="secondary">
              <Plug size={14} className="inline mr-1.5 -mt-0.5" />
              Conexión Instagram
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Aviso cuando la cuenta activa no tiene datos ── */}
      {conn && !conn.hasData && (
        <div className="card border-orange/40 bg-orange/5 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange">
              {conn.workspace.label} todavía no tiene métricas
            </p>
            <p className="text-xs text-muted mt-0.5">
              {conn.syncError ??
                'Su primera sincronización aún no ha entrado. Ve a Conexión IG y pulsa "Sincronizar ahora".'}
            </p>
            <Link href="/conexion">
              <Button variant="secondary" className="!py-1.5 !text-xs mt-3">
                Ir a Conexión IG
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Mini-cards operativas ──
          "Quality gate" y "Bloqueos creativos" medían los guiones del
          generador; sin esa sección se quedarían clavadas en cero, así que
          se sustituyen por lo que sí tiene origen real: el calendario. */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <Card className="col-span-12 md:col-span-6 !p-4 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Gauge size={17} />
          </span>
          <div>
            <p className="text-lg font-extrabold leading-none">
              {data?.operation.active ?? '—'} piezas
            </p>
            <p className="text-[11px] text-muted">Activas en el calendario</p>
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 !p-4 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl bg-positive/10 text-positive flex items-center justify-center">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <p className="text-lg font-extrabold leading-none">
              {data?.operation.ready ?? '—'} piezas
            </p>
            <p className="text-[11px] text-muted">Listas para salir</p>
          </div>
        </Card>
      </div>

      {/* ── Selector de periodo ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-lg">Control de métricas</h2>
        <Tabs
          tabs={[
            { value: 'today', label: 'Hoy' },
            { value: '7d', label: '7 días' },
            { value: '30d', label: '30 días' },
          ]}
          active={period}
          onChange={(v) => setPeriod(v as Period)}
        />
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-32 gap-3 text-muted">
          <Spinner /> Cargando métricas…
        </div>
      ) : (
        <>
          {/* ── Grid de 12 KPIs ── */}
          <div className="grid grid-cols-12 gap-4 mb-6">
            {data.kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </div>

          {/* ── Widgets ── */}
          <div className="grid grid-cols-12 gap-4">
            <FollowersChart data={data.followersSeries} />
            <ReactionsDonut data={data.reactions} er={data.engagementRate} />
            <FormatBar data={data.reachByFormat} />
            <TopPosts posts={data.topPosts} />
            <RetentionCard
              buckets={data.retentionBuckets}
              watchDistribution={data.watchDistribution}
              avgWatchTime={data.avgWatchTime}
            />
            <ReelRetentionList reels={data.reelRetention} />
            {/* Historias: solo si la fuente las entrega */}
            {data.stories.length > 0 && <StoriesCard stories={data.stories} />}
            <FunnelCard funnel={data.funnel} />
            <Heatmap data={data.heatmap} />
            <PostsPreview posts={data.recentPosts} />
            <OperationCard op={data.operation} />
          </div>
        </>
      )}
    </div>
  );
}
