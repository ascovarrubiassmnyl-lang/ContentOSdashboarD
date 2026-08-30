'use client';

// Panel lateral de reportes ejecutivos. Es la antigua /reportes movida aquí
// sin cambios funcionales: mismo historial, mismo visor, mismo export a PDF.
//
// Se conserva porque el chat no la sustituye — no exporta PDF ni ofrece un
// histórico navegable por periodo, que es justo para lo que se usa el reporte
// quincenal.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, Input, Spinner, Tabs } from '@/components/ui';
import { ConnectionResponse, Report } from '@/types';
import { MarkdownView, escapeHtml, mdToPrintHtml } from './markdown';

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === 'week') start.setDate(end.getDate() - 6);
  else start.setDate(end.getDate() - 29);
  return { start: iso(start), end: iso(end) };
}

export default function ReportsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [preset, setPreset] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);

  const { data, isLoading } = useQuery<{ reports: Report[] }>({
    queryKey: ['reports'],
    queryFn: async () => (await fetch('/api/reports')).json(),
  });

  // El PDF lleva el nombre de la cuenta: con varias cuentas, un reporte sin
  // identificar no dice de quién son los números.
  const { data: conn } = useQuery<ConnectionResponse>({
    queryKey: ['connection'],
    queryFn: async () => (await fetch('/api/connection')).json(),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const range =
        preset === 'custom' ? { start: customStart, end: customEnd } : presetRange(preset);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ period_start: range.start, period_end: range.end }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      return (await res.json()).report as Report;
    },
    onSuccess: (report) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      setSelected(report);
    },
  });

  // Exporta a PDF con el diálogo de impresión del navegador: sin librerías
  // extra, el texto queda seleccionable y el usuario elige "Guardar como PDF".
  // Se imprime desde un iframe oculto para no perder la página actual ni
  // chocar con el bloqueador de ventanas emergentes.
  const exportPdf = (r: Report) => {
    const cuenta = conn?.workspace?.label ?? '';
    const generado = new Date(r.created_at).toLocaleDateString('es', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Reporte ${r.period_start} a ${r.period_end}${cuenta ? ` — ${cuenta}` : ''}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #16161d; line-height: 1.55; font-size: 11.5pt; margin: 0; }
  header { border-bottom: 2px solid #7C7CF5; padding-bottom: 10px; margin-bottom: 22px; }
  .eyebrow { font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase;
             color: #7C7CF5; font-weight: 700; margin: 0 0 4px; }
  h1 { font-size: 17pt; margin: 0 0 4px; }
  .meta { font-size: 9.5pt; color: #66667a; margin: 0; }
  h2 { font-size: 12.5pt; color: #4a4ae0; margin: 20px 0 8px; page-break-after: avoid; }
  h3 { font-size: 11pt; margin: 14px 0 6px; page-break-after: avoid; }
  p { margin: 0 0 9px; }
  li { margin: 0 0 5px; }
  ul { margin: 0 0 10px; padding-left: 20px; }
  strong { color: #000; }
  em { color: #66667a; font-style: italic; }
  hr { border: 0; border-top: 1px solid #dcdce4; margin: 18px 0; }
  .num { display: flex; gap: 8px; margin: 0 0 6px; }
  .num b { color: #4a4ae0; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #dcdce4;
           font-size: 8.5pt; color: #8a8a9c; }
</style></head><body>
<header>
  <p class="eyebrow">Content OS · Reporte de resultados</p>
  <h1>${r.period_start} → ${r.period_end}</h1>
  <p class="meta">${cuenta ? `${escapeHtml(cuenta)} · ` : ''}Generado el ${generado}</p>
</header>
${mdToPrintHtml(r.summary_md)}
<footer>Content OS · Datos de Instagram vía Zernio</footer>
</body></html>`;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.srcdoc = doc;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      // Se quita cuando el diálogo ya tomó el contenido.
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  };

  const reports = data?.reports ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative h-full w-full max-w-3xl bg-bg border-l border-line flex flex-col shadow-2xl">
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-line shrink-0">
          <div>
            <p className="accent-label mb-1">Análisis</p>
            <h2 className="text-lg font-extrabold">Reportes ejecutivos</h2>
            <p className="text-xs text-muted mt-1">
              Redactados por el agente con tus métricas reales. Exportables a PDF.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-line flex items-center justify-center text-muted hover:text-white shrink-0"
            aria-label="Cerrar reportes"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-6 py-4 border-b border-line shrink-0">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="section-label mb-2">Periodo</p>
              <Tabs
                tabs={[
                  { value: 'week', label: 'Semanal (7d)' },
                  { value: 'month', label: 'Mensual (30d)' },
                  { value: 'custom', label: 'Custom' },
                ]}
                active={preset}
                onChange={setPreset}
                size="sm"
              />
            </div>
            {preset === 'custom' && (
              <div className="flex gap-3 [&>label]:mb-0">
                <Input label="Desde" type="date" value={customStart} onChange={setCustomStart} />
                <Input label="Hasta" type="date" value={customEnd} onChange={setCustomEnd} />
              </div>
            )}
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending || (preset === 'custom' && (!customStart || !customEnd))}
            >
              {generate.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Generando…
                </span>
              ) : (
                <>
                  <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />
                  Generar
                </>
              )}
            </Button>
          </div>
          {generate.isError && (
            <p className="text-xs text-negative mt-3">{(generate.error as Error).message}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {selected ? (
            <div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
                <div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-[11px] text-muted hover:text-white mb-1"
                  >
                    ← Volver al historial
                  </button>
                  <h3 className="font-extrabold">
                    {selected.period_start} → {selected.period_end}
                  </h3>
                </div>
                <Button variant="secondary" onClick={() => exportPdf(selected)}>
                  <Download size={14} className="inline mr-1.5 -mt-0.5" />
                  Exportar PDF
                </Button>
              </div>
              <MarkdownView md={selected.summary_md} />
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<FileText size={36} />}
              title="Sin reportes todavía"
              subtitle="Genera el primero con el botón de arriba, o espera al quincenal automático."
            />
          ) : (
            <div className="space-y-2">
              <p className="section-label mb-3">Historial</p>
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="card w-full text-left p-4 hover:border-primary/50 transition-all"
                >
                  <p className="text-sm font-bold">
                    {r.period_start} → {r.period_end}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Generado {new Date(r.created_at).toLocaleString('es-CO')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
