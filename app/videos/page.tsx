'use client';

// Galería del contenido publicado. El objetivo es ver las métricas de cada
// pieza: la cuadrícula muestra las vistas de un vistazo y, al abrir una,
// aparece el detalle completo con el copy y la fecha.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  ExternalLink,
  Eye,
  Film,
  Heart,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Send,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Card, EmptyState, Modal, Spinner, Tabs } from '@/components/ui';
import { MediaPost, MediaType } from '@/types';
import { cn, fmtInt, fmtPct, fmtSeconds } from '@/lib/utils';

const TYPE_META: Record<string, { label: string; icon: typeof Film }> = {
  REEL: { label: 'Reel', icon: Film },
  CAROUSEL: { label: 'Carrusel', icon: Layers },
  IMAGE: { label: 'Imagen', icon: ImageIcon },
  STORY: { label: 'Historia', icon: Timer },
};

type Orden = 'recientes' | 'vistas' | 'interaccion';

function interacciones(p: MediaPost): number {
  return p.likes + p.comments + p.saves + p.shares;
}

// ER por pieza: interacciones sobre las cuentas que la vieron.
function engagement(p: MediaPost): number {
  return p.reach > 0 ? (interacciones(p) / p.reach) * 100 : 0;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Las miniaturas vienen del CDN de Instagram con firma que caduca; si falla
// la carga se muestra un marcador en vez de un hueco roto.
function Miniatura({ post }: { post: MediaPost }) {
  const [roto, setRoto] = useState(false);
  const Icon = TYPE_META[post.media_type]?.icon ?? Film;

  if (!post.thumbnail_url || roto) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-line/30">
        <Icon size={28} className="text-muted/40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={post.thumbnail_url}
      alt={post.hook}
      loading="lazy"
      onError={() => setRoto(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function Metrica({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-bg border border-line rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-muted mb-1.5">
        <Icon size={13} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-extrabold leading-none">{value}</p>
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

export default function VideosPage() {
  const [tipo, setTipo] = useState<'todos' | MediaType>('todos');
  const [orden, setOrden] = useState<Orden>('recientes');
  const [abierto, setAbierto] = useState<MediaPost | null>(null);

  const { data, isLoading } = useQuery<{ posts: MediaPost[] }>({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await fetch('/api/posts');
      if (!res.ok) throw new Error('No se pudieron cargar los videos');
      return res.json();
    },
  });

  const posts = useMemo(() => data?.posts ?? [], [data]);

  // Solo se ofrecen los filtros de formatos que la cuenta tiene de verdad.
  const tiposDisponibles = useMemo(
    () => Array.from(new Set(posts.map((p) => p.media_type))),
    [posts]
  );

  const visibles = useMemo(() => {
    const filtrados = tipo === 'todos' ? posts : posts.filter((p) => p.media_type === tipo);
    const copia = [...filtrados];
    if (orden === 'vistas') copia.sort((a, b) => b.views - a.views);
    else if (orden === 'interaccion') copia.sort((a, b) => interacciones(b) - interacciones(a));
    else copia.sort((a, b) => b.published_at.localeCompare(a.published_at));
    return copia;
  }, [posts, tipo, orden]);

  const totales = useMemo(
    () => ({
      vistas: visibles.reduce((s, p) => s + p.views, 0),
      alcance: visibles.reduce((s, p) => s + p.reach, 0),
      interacciones: visibles.reduce((s, p) => s + interacciones(p), 0),
    }),
    [visibles]
  );

  return (
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Vista para el cliente</p>
        <h1 className="text-xl font-extrabold">Videos</h1>
        <p className="text-sm text-muted mt-1">
          Todo el contenido publicado con sus métricas. Abre una pieza para ver el detalle.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32 gap-3 text-muted">
          <Spinner /> Cargando videos…
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Film size={34} />}
          title="Todavía no hay contenido sincronizado"
          subtitle="Cuando la cuenta sincronice con Instagram, aquí aparecerán todas sus piezas con métricas."
        />
      ) : (
        <>
          {/* ── Resumen de lo que se está viendo ── */}
          <div className="grid grid-cols-12 gap-4 mb-5">
            <Card className="col-span-12 md:col-span-4 !p-4">
              <p className="text-2xl font-extrabold leading-none">{visibles.length}</p>
              <p className="text-[11px] text-muted mt-1">
                {visibles.length === 1 ? 'pieza' : 'piezas'}
                {tipo !== 'todos' && ` · ${TYPE_META[tipo]?.label ?? tipo}`}
              </p>
            </Card>
            <Card className="col-span-6 md:col-span-4 !p-4">
              <p className="text-2xl font-extrabold leading-none">{fmtInt(totales.vistas)}</p>
              <p className="text-[11px] text-muted mt-1">vistas acumuladas</p>
            </Card>
            <Card className="col-span-6 md:col-span-4 !p-4">
              <p className="text-2xl font-extrabold leading-none">
                {fmtInt(totales.interacciones)}
              </p>
              <p className="text-[11px] text-muted mt-1">interacciones</p>
            </Card>
          </div>

          {/* ── Filtros ── */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            {tiposDisponibles.length > 1 && (
              <Tabs
                size="sm"
                tabs={[
                  { value: 'todos', label: 'Todos' },
                  ...tiposDisponibles.map((t) => ({
                    value: t,
                    label: TYPE_META[t]?.label ?? t,
                  })),
                ]}
                active={tipo}
                onChange={(v) => setTipo(v as 'todos' | MediaType)}
              />
            )}
            <Tabs
              size="sm"
              tabs={[
                { value: 'recientes', label: 'Más recientes' },
                { value: 'vistas', label: 'Más vistas' },
                { value: 'interaccion', label: 'Más interacción' },
              ]}
              active={orden}
              onChange={(v) => setOrden(v as Orden)}
            />
          </div>

          {/* ── Galería ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visibles.map((p) => {
              const Icon = TYPE_META[p.media_type]?.icon ?? Film;
              return (
                <button
                  key={p.id}
                  onClick={() => setAbierto(p)}
                  className="group text-left card overflow-hidden !p-0 hover:border-primary/50 transition-all"
                >
                  <div className="relative aspect-[9/16] overflow-hidden bg-bg">
                    <Miniatura post={p} />
                    {/* Degradado solo en la franja del texto: cubriendo más
                        (o con más opacidad) se come la miniatura entera. */}
                    <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/90 to-transparent" />
                    <span className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur text-[10px] font-bold px-2 py-1 rounded-full">
                      <Icon size={10} />
                      {TYPE_META[p.media_type]?.label ?? p.media_type}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="flex items-center gap-1.5 text-white font-extrabold text-lg leading-none">
                        <Eye size={15} className="opacity-70" />
                        {fmtInt(p.views)}
                      </p>
                      <p className="text-[10px] text-white/60 mt-1">{fecha(p.published_at)}</p>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold line-clamp-2 leading-snug group-hover:text-white">
                      {p.hook}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <Heart size={11} /> {fmtInt(p.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark size={11} /> {fmtInt(p.saves)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap size={11} /> {fmtPct(engagement(p))}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <DetallePost post={abierto} onClose={() => setAbierto(null)} />
    </div>
  );
}

// ── Detalle de una pieza ────────────────────────────────────
function DetallePost({ post, onClose }: { post: MediaPost | null; onClose: () => void }) {
  if (!post) return null;
  const Icon = TYPE_META[post.media_type]?.icon ?? Film;
  const inter = interacciones(post);

  return (
    <Modal open onClose={onClose} title={TYPE_META[post.media_type]?.label ?? 'Pieza'} wide>
      <div className="grid grid-cols-12 gap-5">
        {/* Miniatura + datos de publicación */}
        <div className="col-span-12 sm:col-span-4">
          {/* En móvil se limita el ancho: a tamaño completo la miniatura
              empujaba las métricas fuera de pantalla, y son lo que importa. */}
          <div className="relative aspect-[9/16] max-w-[48%] sm:max-w-none rounded-xl overflow-hidden bg-bg border border-line">
            <Miniatura post={post} />
          </div>
          <p className="text-[11px] text-muted mt-3 flex items-center gap-1.5">
            <Icon size={12} />
            Publicado el {fecha(post.published_at)}
          </p>
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-primary hover:underline mt-2 inline-flex items-center gap-1.5"
            >
              Ver en Instagram <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Métricas — lo importante de esta vista */}
        <div className="col-span-12 sm:col-span-8">
          <p className="section-label mb-3">Métricas de la pieza</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
            <Metrica icon={Eye} label="Vistas" value={fmtInt(post.views)} />
            <Metrica
              icon={Users}
              label="Alcance"
              value={fmtInt(post.reach)}
              hint="cuentas distintas"
            />
            <Metrica
              icon={Zap}
              label="Interacción"
              value={fmtPct(engagement(post))}
              hint={`${fmtInt(inter)} interacciones`}
            />
            <Metrica icon={Heart} label="Me gusta" value={fmtInt(post.likes)} />
            <Metrica icon={MessageCircle} label="Comentarios" value={fmtInt(post.comments)} />
            <Metrica
              icon={Bookmark}
              label="Guardados"
              value={fmtInt(post.saves)}
              hint="señal de valor"
            />
            <Metrica
              icon={Send}
              label="Compartidos"
              value={fmtInt(post.shares)}
              hint="señal de viralidad"
            />
            {post.avg_watch_time_seconds != null && (
              <Metrica
                icon={Timer}
                label="Retención"
                value={fmtSeconds(post.avg_watch_time_seconds)}
                hint="tiempo medio visto"
              />
            )}
            {post.views > 0 && post.reach > 0 && (
              <Metrica
                icon={TrendingUp}
                label="Frecuencia"
                value={(post.views / post.reach).toFixed(2)}
                hint="vistas por cuenta"
              />
            )}
          </div>

          <p className="section-label mb-2">Copy publicado</p>
          <div
            className={cn(
              'bg-bg border border-line rounded-xl px-4 py-3 text-sm text-soft',
              'whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto'
            )}
          >
            {post.caption?.trim() || <span className="text-muted">(sin texto)</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
