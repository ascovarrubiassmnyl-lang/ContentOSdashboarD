'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Gauge, Plug, Sparkles } from 'lucide-react';
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
import { IgAccount, MetricsResponse, Period } from '@/types';
import { relativeTime } from '@/lib/utils';

async function fetchMetrics(period: Period): Promise<MetricsResponse> {
  const res = await fetch(`/api/metrics?period=${period}`);
  if (!res.ok) throw new Error('Error cargando métricas');
  return res.json();
}

async function fetchAccount(): Promise<{ account: IgAccount; demoMode: boolean }> {
  const res = await fetch('/api/connection');
  if (!res.ok) throw new Error('Error cargando cuenta');
  return res.json();
}

export default function ControlPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const { data, isLoading } = useQuery({
    queryKey: ['metrics', period],
    queryFn: () => fetchMetrics(period),
  });
  const { data: conn } = useQuery({ queryKey: ['connection'], queryFn: fetchAccount });

  return (
    <div>
      {/* ── Header de perfil ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-pink to-orange flex items-center justify-center text-xl font-extrabold text-white shadow-glow">
            S
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">
              Santiago Castro{' '}
              <span className="text-muted font-semibold text-base">
                @{conn?.account?.username ?? 'scav_86'}
              </span>
            </h1>
            <p className="text-xs text-muted">
              {conn?.account
                ? `Última actualización ${relativeTime(conn.account.last_sync_at)} · próxima sync mañana 7:00 a.m.`
                : 'Cargando estado de conexión…'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/generador">
            <Button>
              <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />
              Crear pieza
            </Button>
          </Link>
          <Link href="/calendario">
            <Button variant="secondary">Ver pipeline</Button>
          </Link>
          <Link href="/conexion">
            <Button variant="secondary">
              <Plug size={14} className="inline mr-1.5 -mt-0.5" />
              Conexión Instagram
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Mini-cards operativas ── */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <Card className="col-span-12 md:col-span-4 !p-4 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Gauge size={17} />
          </span>
          <div>
            <p className="text-lg font-extrabold leading-none">
              {data?.operation.avgScore ?? '—'}%
            </p>
            <p className="text-[11px] text-muted">Quality gate promedio</p>
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-4 !p-4 flex items-center gap-3">
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
        <Card className="col-span-12 md:col-span-4 !p-4 flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl bg-negative/10 text-negative flex items-center justify-center">
            <AlertTriangle size={17} />
          </span>
          <div>
            <p className="text-lg font-extrabold leading-none">
              {data?.operation.blocked ?? '—'} rojos
            </p>
            <p className="text-[11px] text-muted">Bloqueos creativos</p>
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
