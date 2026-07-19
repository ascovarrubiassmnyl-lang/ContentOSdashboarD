'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as fmt,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Select, Tabs, Textarea } from '@/components/ui';
import { CalendarFormat, CalendarItem, CalendarStatus, FunnelLevel } from '@/types';
import { cn } from '@/lib/utils';

const FORMAT_COLOR: Record<CalendarFormat, string> = {
  reel: 'bg-primary/20 text-primary border-primary/40',
  carrusel: 'bg-pink/20 text-pink border-pink/40',
  historia: 'bg-positive/20 text-positive border-positive/40',
  ad: 'bg-orange/20 text-orange border-orange/40',
};

// Nivel del funnel — manda sobre el color del formato en el calendario.
const NIVEL_META: Record<
  FunnelLevel,
  { label: string; desc: string; chip: string; dot: string }
> = {
  tofu: {
    label: 'TOFU',
    desc: 'Alcance · audiencia fría',
    chip: 'bg-primary/20 text-primary border-primary/40',
    dot: 'bg-primary',
  },
  mofu: {
    label: 'MOFU',
    desc: 'Consideración · ya te conocen',
    chip: 'bg-orange/20 text-orange border-orange/40',
    dot: 'bg-orange',
  },
  bofu: {
    label: 'BOFU',
    desc: 'Conversión · listos para comprar',
    chip: 'bg-pink/20 text-pink border-pink/40',
    dot: 'bg-pink',
  },
};

const NIVELES: FunnelLevel[] = ['tofu', 'mofu', 'bofu'];

const STATUS_LABEL: Record<CalendarStatus, string> = {
  idea: '💡 Idea',
  en_produccion: '🎬 En producción',
  listo: '✅ Listo',
  publicado: '🚀 Publicado',
};

interface FormState {
  id: string | null;
  title: string;
  format: CalendarFormat;
  nivel: FunnelLevel | null;
  date: string;
  time: string;
  status: CalendarStatus;
  notes: string;
}

const emptyForm = (date?: Date): FormState => ({
  id: null,
  title: '',
  format: 'reel',
  nivel: 'tofu',
  date: fmt(date ?? new Date(), 'yyyy-MM-dd'),
  time: '10:00',
  status: 'idea',
  notes: '',
});

export default function CalendarioPage() {
  const qc = useQueryClient();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [formatFilter, setFormatFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const { data } = useQuery<{ items: CalendarItem[] }>({
    queryKey: ['calendar'],
    queryFn: async () => (await fetch('/api/calendar')).json(),
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
      const payload = {
        title: form.title,
        format: form.format,
        nivel: form.nivel,
        scheduled_at,
        status: form.status,
        notes: form.notes,
        script_id: null,
      };
      const res = form.id
        ? await fetch(`/api/calendar/${form.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/calendar', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error('Error guardando la pieza');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setModalOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fetch(`/api/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setModalOpen(false);
    },
  });

  // ── Copiar / pegar piezas ──────────────────────────────────
  // clipboard guarda la pieza copiada; con ella activa, cada clic en un
  // día pega una copia completa (mismo horario, formato, nivel, notas).
  const [clipboard, setClipboard] = useState<CalendarItem | null>(null);
  const [pasteCount, setPasteCount] = useState(0);

  useEffect(() => {
    if (!clipboard) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setClipboard(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clipboard]);

  const copyItem = (item: CalendarItem) => {
    setClipboard(item);
    setPasteCount(0);
    setModalOpen(false);
  };

  const paste = useMutation({
    mutationFn: async (day: Date) => {
      const src = clipboard!;
      const t = parseISO(src.scheduled_at);
      const scheduled = new Date(day);
      scheduled.setHours(t.getHours(), t.getMinutes(), 0, 0);
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: src.title,
          format: src.format,
          nivel: src.nivel ?? null,
          scheduled_at: scheduled.toISOString(),
          status: src.status,
          notes: src.notes,
          script_id: src.script_id ?? null,
        }),
      });
      if (!res.ok) throw new Error('Error pegando la pieza');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] });
      setPasteCount((c) => c + 1);
    },
  });

  const items = useMemo(() => {
    let rows = data?.items ?? [];
    if (formatFilter !== 'all') rows = rows.filter((i) => i.format === formatFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (i) => i.title.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, formatFilter, search]);

  const days = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [cursor, view]);

  const itemsForDay = (day: Date) =>
    items.filter((i) => isSameDay(parseISO(i.scheduled_at), day));

  const navigate = (dir: 1 | -1) =>
    setCursor(view === 'month' ? addMonths(cursor, dir) : addWeeks(cursor, dir));

  const openNew = (day?: Date) => {
    setForm(emptyForm(day));
    setModalOpen(true);
  };

  const openEdit = (item: CalendarItem) => {
    const d = parseISO(item.scheduled_at);
    setForm({
      id: item.id,
      title: item.title,
      format: item.format,
      nivel: item.nivel ?? null,
      date: fmt(d, 'yyyy-MM-dd'),
      time: fmt(d, 'HH:mm'),
      status: item.status,
      notes: item.notes,
    });
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="accent-label mb-1">Editorial</p>
          <h1 className="text-xl font-extrabold">Calendario</h1>
        </div>
        <Button onClick={() => openNew()}>
          <Plus size={14} className="inline mr-1.5 -mt-0.5" />
          Crear pieza
        </Button>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-white hover:border-primary/50"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="h-8 px-3 rounded-lg border border-line text-xs font-semibold text-muted hover:text-white hover:border-primary/50"
          >
            Hoy
          </button>
          <button
            onClick={() => navigate(1)}
            className="h-8 w-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-white hover:border-primary/50"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <h2 className="font-extrabold capitalize">
          {fmt(cursor, view === 'month' ? 'MMMM yyyy' : "'Semana del' d 'de' MMMM", {
            locale: es,
          })}
        </h2>
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <Tabs
            size="sm"
            tabs={[
              { value: 'all', label: 'Todo' },
              { value: 'reel', label: 'Reel' },
              { value: 'carrusel', label: 'Carrusel' },
              { value: 'historia', label: 'Historias' },
              { value: 'ad', label: 'Ad' },
            ]}
            active={formatFilter}
            onChange={setFormatFilter}
          />
          <Tabs
            size="sm"
            tabs={[
              { value: 'month', label: 'Mes' },
              { value: 'week', label: 'Semana' },
            ]}
            active={view}
            onChange={setView}
          />
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pieza…"
              className="w-44 bg-card border border-line rounded-xl pl-8 pr-3 py-1.5 text-xs focus:border-primary focus:outline-none placeholder:text-muted/50"
            />
          </div>
        </div>
      </div>

      {/* Grid — en móvil se desplaza horizontalmente para no comprimir los días */}
      <div className="card overflow-hidden !p-0">
        <div className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-line">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <p
              key={d}
              className="text-center text-[11px] font-bold uppercase tracking-wider text-muted py-2.5"
            >
              {d}
            </p>
          ))}
        </div>
        <div className={cn('grid grid-cols-7', view === 'week' && 'min-h-[420px]')}>
          {days.map((day) => {
            const dayItems = itemsForDay(day);
            const outside = view === 'month' && !isSameMonth(day, cursor);
            return (
              <div
                key={day.toISOString()}
                onClick={() => (clipboard ? paste.mutate(day) : openNew(day))}
                className={cn(
                  'border-b border-r border-line/60 p-1.5 transition-colors',
                  clipboard
                    ? 'cursor-copy hover:bg-positive/10'
                    : 'cursor-pointer hover:bg-primary/5',
                  view === 'month' ? 'min-h-[96px]' : 'min-h-[420px]',
                  outside && 'opacity-35'
                )}
              >
                <p
                  className={cn(
                    'text-[11px] font-bold mb-1 h-5 w-5 flex items-center justify-center rounded-full',
                    isToday(day) ? 'bg-primary text-white' : 'text-muted'
                  )}
                >
                  {fmt(day, 'd')}
                </p>
                <div className="space-y-1">
                  {dayItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                      }}
                      className={cn(
                        'w-full text-left text-[10px] font-semibold px-1.5 py-1 rounded-md border truncate transition-transform hover:scale-[1.02]',
                        item.nivel ? NIVEL_META[item.nivel].chip : FORMAT_COLOR[item.format]
                      )}
                      title={`${item.title} · ${STATUS_LABEL[item.status]}${
                        item.nivel ? ` · ${NIVEL_META[item.nivel].label}` : ''
                      } · ${item.format}`}
                    >
                      {item.nivel && (
                        <span className="mr-1 text-[8px] font-extrabold tracking-wider opacity-80">
                          {NIVEL_META[item.nivel].label}
                        </span>
                      )}
                      {fmt(parseISO(item.scheduled_at), 'HH:mm')} · {item.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
        <span className="section-label">Nivel:</span>
        {NIVELES.map((n) => (
          <span key={n} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('h-2.5 w-2.5 rounded-full', NIVEL_META[n].dot)} />
            <strong className="text-soft">{NIVEL_META[n].label}</strong>
            <span className="hidden md:inline">· {NIVEL_META[n].desc}</span>
          </span>
        ))}
        <span className="text-[11px] text-muted/60 ml-auto">
          Piezas sin nivel usan el color de su formato
        </span>
      </div>
      <p className="text-[11px] text-muted/60 mt-2 flex items-center gap-1.5">
        <Trash2 size={11} />
        Las piezas se eliminan solas 24 h después de su fecha programada.
      </p>

      {/* Modal crear/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Editar pieza' : 'Crear pieza'}
      >
        <Input
          label="Título"
          value={form.title}
          onChange={(v) => setForm({ ...form, title: v })}
          placeholder="Ej: Reel — la métrica que miras mal"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Formato"
            value={form.format}
            onChange={(v) => setForm({ ...form, format: v as CalendarFormat })}
            options={[
              { value: 'reel', label: 'Reel' },
              { value: 'carrusel', label: 'Carrusel' },
              { value: 'historia', label: 'Historia' },
              { value: 'ad', label: 'Ad' },
            ]}
          />
          <Select
            label="Estado"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v as CalendarStatus })}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </div>

        {/* Nivel del funnel */}
        <div className="mb-4">
          <span className="section-label block mb-1.5">Nivel</span>
          <div className="grid grid-cols-3 gap-2">
            {NIVELES.map((n) => {
              const meta = NIVEL_META[n];
              const active = form.nivel === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, nivel: active ? null : n })}
                  className={cn(
                    'border rounded-xl px-2 py-2.5 text-center transition-all',
                    active
                      ? cn(meta.chip, 'shadow-glow')
                      : 'border-line bg-bg text-muted hover:border-primary/30'
                  )}
                >
                  <span className="flex items-center justify-center gap-1.5 text-xs font-extrabold">
                    <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                  <span className="block text-[10px] mt-0.5 opacity-80 leading-tight">
                    {meta.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha"
            type="date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
          />
          <Input
            label="Hora"
            type="time"
            value={form.time}
            onChange={(v) => setForm({ ...form, time: v })}
          />
        </div>
        <Textarea
          label="Notas"
          value={form.notes}
          onChange={(v) => setForm({ ...form, notes: v })}
          rows={3}
          placeholder="Guion vinculado, referencias, pendientes…"
        />
        <div className="flex justify-between gap-2">
          {form.id ? (
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => remove.mutate(form.id!)}>
                <Trash2 size={14} className="inline mr-1.5 -mt-0.5" />
                Eliminar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const item = (data?.items ?? []).find((i) => i.id === form.id);
                  if (item) copyItem(item);
                }}
              >
                <Copy size={14} className="inline mr-1.5 -mt-0.5" />
                Duplicar
              </Button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => upsert.mutate()}
              disabled={upsert.isPending || form.title.length < 2}
            >
              {upsert.isPending ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear pieza'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Aviso flotante: modo pegar activo */}
      {clipboard && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 card !py-2.5 !px-4 flex items-center gap-3 shadow-glow border-positive/40 w-[calc(100vw-2rem)] max-w-lg md:w-auto">
          <Copy size={15} className="text-positive shrink-0" />
          <div className="text-xs min-w-0 flex-1">
            <p className="font-bold truncate">
              Copiada: <span className="text-positive">{clipboard.title}</span>
              {pasteCount > 0 && (
                <span className="ml-2 text-[10px] font-extrabold bg-positive/15 text-positive px-1.5 py-0.5 rounded-full">
                  ×{pasteCount} pegada{pasteCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <p className="text-muted">
              Haz clic en los días donde quieras pegarla · Esc para terminar
            </p>
          </div>
          <button
            onClick={() => setClipboard(null)}
            className="h-7 w-7 rounded-lg border border-line flex items-center justify-center text-muted hover:text-white hover:border-primary/50 shrink-0"
            title="Terminar (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
