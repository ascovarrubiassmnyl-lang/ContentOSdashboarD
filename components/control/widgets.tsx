'use client';

// Widgets del dashboard de control: KPIs, top posts, retención, historias,
// funnel, heatmap, previews y operación de contenido.
import Link from 'next/link';
import { useState } from 'react';
import {
  Bookmark,
  Eye,
  Film,
  Heart,
  Image as ImageIcon,
  Layers,
  Link2,
  MessageCircle,
  MousePointerClick,
  Repeat2,
  Share2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Card, DeltaBadge } from '@/components/ui';
import { KpiValue, MediaPost, MetricsResponse } from '@/types';
import { cn, fmtInt, fmtPct, fmtSeconds } from '@/lib/utils';

const KPI_ICONS: Record<string, typeof Eye> = {
  views: Eye,
  reach: TrendingUp,
  followers: Users,
  er: Zap,
  likes: Heart,
  comments: MessageCircle,
  saves: Bookmark,
  shares: Share2,
  engaged: Users,
  taps: MousePointerClick,
  ctr: Link2,
  freq: Repeat2,
};

export function KpiCard({ kpi }: { kpi: KpiValue }) {
  const Icon = KPI_ICONS[kpi.key] ?? Eye;
  const display =
    kpi.format === 'int'
      ? fmtInt(kpi.value)
      : kpi.format === 'percent'
      ? fmtPct(kpi.value)
      : kpi.value.toFixed(2);
  return (
    <Card className="col-span-6 md:col-span-4 xl:col-span-2 !p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon size={15} />
        </span>
        <DeltaBadge delta={kpi.delta} />
      </div>
      <p className="text-2xl font-extrabold leading-none mb-1">{display}</p>
      <p className="text-xs font-semibold text-soft">{kpi.label}</p>
      <p className="text-[11px] text-muted mt-0.5 leading-tight">{kpi.description}</p>
    </Card>
  );
}

function typeIcon(type: MediaPost['media_type']) {
  return type === 'REEL' ? (
    <Film size={13} />
  ) : type === 'CAROUSEL' ? (
    <Layers size={13} />
  ) : (
    <ImageIcon size={13} />
  );
}

const TYPE_COLOR: Record<string, string> = {
  REEL: 'text-primary bg-primary/10',
  CAROUSEL: 'text-pink bg-pink/10',
  IMAGE: 'text-orange bg-orange/10',
  STORY: 'text-positive bg-positive/10',
};

// ── 🏆 Top publicaciones ─────────────────────────────────────
export function TopPosts({ posts }: { posts: MediaPost[] }) {
  const max = Math.max(
    ...posts.map((p) => p.likes + p.comments + p.saves + p.shares),
    1
  );
  return (
    <Card className="col-span-12 xl:col-span-6">
      <p className="accent-label mb-1">Ranking</p>
      <h3 className="font-extrabold mb-4">🏆 Top publicaciones por interacción</h3>
      <div className="space-y-3">
        {posts.map((p, i) => {
          const eng = p.likes + p.comments + p.saves + p.shares;
          return (
            <div key={p.id} className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-muted w-4">{i + 1}</span>
              <span
                className={cn(
                  'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                  TYPE_COLOR[p.media_type]
                )}
              >
                {typeIcon(p.media_type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{p.hook}</p>
                <div className="h-1.5 bg-line rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-pink"
                    style={{ width: `${(eng / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-bold text-soft shrink-0">{fmtInt(eng)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── ⏱️ Retención de reels ────────────────────────────────────
// Con curva por tramo (fuente demo) muestra la caída %; sin curva
// (Zernio) muestra la distribución REAL de reels por watch time.
export function RetentionCard({
  buckets,
  watchDistribution,
  avgWatchTime,
}: {
  buckets: MetricsResponse['retentionBuckets'];
  watchDistribution: MetricsResponse['watchDistribution'];
  avgWatchTime: number;
}) {
  const hasCurve = buckets.some((b) => b.pct > 0);
  const maxCount = Math.max(...watchDistribution.map((d) => d.count), 1);
  const totalReels = watchDistribution.reduce((a, d) => a + d.count, 0);

  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-3">
      <p className="accent-label mb-1">Reels</p>
      <h3 className="font-extrabold mb-1">
        {hasCurve ? '⏱️ Retención por tramo' : '⏱️ Distribución de retención'}
      </h3>
      <p className="text-[11px] text-muted mb-4">
        Tiempo medio de visualización:{' '}
        <span className="text-soft font-bold">{fmtSeconds(avgWatchTime)}</span>
      </p>
      {hasCurve ? (
        <div className="space-y-2.5">
          {buckets.map((b) => (
            <div key={b.bucket} className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-muted w-12">{b.bucket}</span>
              <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    b.pct > 70 ? 'bg-positive' : b.pct > 40 ? 'bg-orange' : 'bg-negative'
                  )}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
              <span className="text-xs font-bold w-9 text-right">{b.pct}%</span>
            </div>
          ))}
        </div>
      ) : totalReels > 0 ? (
        <div className="space-y-2.5">
          {watchDistribution.map((d) => (
            <div key={d.bucket} className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-muted w-12">{d.bucket}</span>
              <div className="flex-1 h-2 bg-line rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-pink"
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold w-9 text-right">{d.count}</span>
            </div>
          ))}
          <p className="text-[10px] text-muted pt-1">
            Cuántos de tus reels retienen en cada rango de tiempo.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted leading-relaxed py-6 text-center">
          Aún no hay reels con datos de visualización.
        </p>
      )}
    </Card>
  );
}

// ── 🎬 Retención por reel ────────────────────────────────────
export function ReelRetentionList({ reels }: { reels: MediaPost[] }) {
  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-5">
      <p className="accent-label mb-1">Reels</p>
      <h3 className="font-extrabold mb-4">🎬 Retención por reel</h3>
      <div className="space-y-2.5">
        {reels.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Film size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{r.hook}</p>
              <p className="text-[11px] text-muted">{fmtInt(r.views)} vistas</p>
            </div>
            <span
              className={cn(
                'text-xs font-extrabold px-2 py-1 rounded-lg shrink-0',
                (r.avg_watch_time_seconds ?? 0) > 10
                  ? 'bg-positive/15 text-positive'
                  : 'bg-orange/15 text-orange'
              )}
            >
              {fmtSeconds(r.avg_watch_time_seconds ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 📖 Historias ─────────────────────────────────────────────
export function StoriesCard({ stories }: { stories: MetricsResponse['stories'] }) {
  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <p className="accent-label mb-1">Historias</p>
      <h3 className="font-extrabold mb-4">📖 Retención de historias activas</h3>
      {stories.length === 0 && (
        <p className="text-xs text-muted leading-relaxed py-6 text-center">
          No hay historias activas o esta fuente de datos no las entrega.
        </p>
      )}
      <div className="space-y-3">
        {stories.map((s) => (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold truncate pr-2">{s.title}</p>
              <span className="text-xs font-bold text-soft shrink-0">
                {s.completion_rate}%
              </span>
            </div>
            <div className="h-1.5 bg-line rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-positive to-primary"
                style={{ width: `${s.completion_rate}%` }}
              />
            </div>
            <p className="text-[10px] text-muted mt-1">
              {fmtInt(s.views)} vistas · {s.exits} salidas · {s.replies} respuestas
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 🎯 Ruta a la acción (funnel) ─────────────────────────────
export function FunnelCard({ funnel }: { funnel: MetricsResponse['funnel'] }) {
  const max = funnel[0]?.value ?? 1;
  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <p className="accent-label mb-1">Conversión</p>
      <h3 className="font-extrabold mb-4">🎯 Ruta a la acción</h3>
      <div className="space-y-2.5">
        {funnel.map((f, i) => {
          const pct = (f.value / max) * 100;
          const conv = i > 0 ? ((f.value / funnel[i - 1].value) * 100).toFixed(1) : null;
          return (
            <div key={f.stage}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-muted">{f.stage}</span>
                <span className="text-xs font-bold">
                  {fmtInt(f.value)}
                  {conv && <span className="text-muted font-medium ml-1.5">({conv}%)</span>}
                </span>
              </div>
              <div className="h-6 bg-line/50 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg bg-gradient-to-r from-primary via-pink to-orange flex items-center px-2"
                  style={{ width: `${Math.max(pct, 6)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── 🗓️ Mejores horarios (heatmap) ───────────────────────────
export function Heatmap({ data }: { data: MetricsResponse['heatmap'] }) {
  const max = Math.max(...data.flatMap((d) => [d.am, d.pm]), 1);
  const cell = (v: number) => {
    const intensity = v / max;
    return (
      <div
        className="h-9 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all hover:scale-105"
        style={{
          background: `rgba(124,124,245,${0.08 + intensity * 0.75})`,
          color: intensity > 0.5 ? '#fff' : '#8B8B9E',
        }}
      >
        {v > 0 ? fmtInt(v) : '·'}
      </div>
    );
  };
  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <p className="accent-label mb-1">Timing</p>
      <h3 className="font-extrabold mb-4">🗓️ Mejores horarios para publicar</h3>
      <div className="grid grid-cols-8 gap-1.5 text-center">
        <div />
        {data.map((d) => (
          <p key={d.day} className="text-[10px] font-semibold text-muted">
            {d.day}
          </p>
        ))}
        <p className="text-[10px] font-semibold text-muted self-center">AM</p>
        {data.map((d) => (
          <div key={`am-${d.day}`}>{cell(d.am)}</div>
        ))}
        <p className="text-[10px] font-semibold text-muted self-center">PM</p>
        {data.map((d) => (
          <div key={`pm-${d.day}`}>{cell(d.pm)}</div>
        ))}
      </div>
      <p className="text-[10px] text-muted mt-3">
        Interacción acumulada por día y franja horaria de publicación.
      </p>
    </Card>
  );
}

// ── 🖼️ Últimas publicaciones ────────────────────────────────
// Muestra el thumbnail real de Instagram cuando existe; si la URL firmada
// expiró (los CDN de IG caducan), cae al icono del formato sin romperse.
function PostThumb({ post }: { post: MediaPost }) {
  const [failed, setFailed] = useState(false);
  if (!post.thumbnail_url || failed) {
    return (
      <div
        className={cn(
          'h-20 rounded-lg mb-2 flex items-center justify-center',
          TYPE_COLOR[post.media_type]
        )}
      >
        {typeIcon(post.media_type)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={post.thumbnail_url}
      alt={post.hook}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-20 w-full object-cover rounded-lg mb-2 bg-line"
    />
  );
}

export function PostsPreview({ posts }: { posts: MediaPost[] }) {
  return (
    <Card className="col-span-12 xl:col-span-8">
      <p className="accent-label mb-1">Feed</p>
      <h3 className="font-extrabold mb-4">🖼️ Vista previa — últimas publicaciones</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {posts.map((p) => (
          <a
            key={p.id}
            href={p.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-line bg-bg p-3 hover:border-primary/50 transition-all"
          >
            <PostThumb post={p} />
            <p className="text-[11px] font-semibold leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {p.hook}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <Heart size={10} /> {fmtInt(p.likes)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={10} /> {fmtInt(p.comments)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}

// ── 🚦 Operación de contenido ────────────────────────────────
export function OperationCard({ op }: { op: MetricsResponse['operation'] }) {
  // Score medio, Bloqueos y Publicables salían de los guiones del generador.
  // Sin esa sección nunca tendrían un valor real: quedan fuera.
  const items = [
    { label: 'Piezas activas', value: op.active, color: 'text-primary' },
    { label: 'Listas para salir', value: op.ready, color: 'text-positive' },
  ];
  return (
    <Card className="col-span-12 xl:col-span-4">
      <p className="accent-label mb-1">Pipeline</p>
      <h3 className="font-extrabold mb-4">🚦 Operación de contenido</h3>
      <div className="space-y-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center justify-between border-b border-line/60 pb-2.5 last:border-0"
          >
            <span className="text-xs text-muted font-medium">{it.label}</span>
            <span className={cn('text-lg font-extrabold', it.color)}>{it.value}</span>
          </div>
        ))}
      </div>
      <Link
        href="/calendario"
        className="block text-center text-xs font-bold text-primary mt-4 hover:underline"
      >
        Ir al calendario →
      </Link>
    </Card>
  );
}
