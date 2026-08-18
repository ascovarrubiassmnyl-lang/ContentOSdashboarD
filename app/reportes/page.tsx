'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, Input, Spinner, Tabs } from '@/components/ui';
import { ConnectionResponse, Report } from '@/types';

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Markdown → HTML para el PDF. Igual que MarkdownView pero con estilos de
// impresión (fondo blanco, texto oscuro) en vez de clases de Tailwind.
function mdToPrintHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+)\. (.*)$/gm, '<p class="num"><b>$1.</b><span>$2</span></p>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .split('\n\n')
    .map((block) => {
      const b = block.trim();
      if (!b) return '';
      // Las viñetas sueltas van envueltas en <ul> o el PDF pierde la sangría.
      if (b.startsWith('<li>')) return `<ul>${b}</ul>`;
      return b.startsWith('<') ? b : `<p>${b}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function presetRange(preset: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === 'week') start.setDate(end.getDate() - 6);
  else start.setDate(end.getDate() - 29);
  return { start: iso(start), end: iso(end) };
}

// Render mínimo de Markdown (títulos, negritas, listas) sin dependencias
function MarkdownView({ md }: { md: string }) {
  const html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/^## (.*)$/gm, '<h2 class="text-base font-extrabold mt-5 mb-2 text-primary">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="text-lg font-extrabold mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(
      /^(\d+)\. (.*)$/gm,
      '<p class="ml-2 mb-1 flex gap-2"><span class="text-primary font-bold shrink-0">$1.</span><span>$2</span></p>'
    )
    .replace(/^- (.*)$/gm, '<li class="ml-5 list-disc mb-1">$1</li>')
    .replace(/^---$/gm, '<hr class="border-line my-4"/>')
    .replace(/\*(.+?)\*/g, '<em class="text-muted">$1</em>')
    .split('\n\n')
    .map((block) =>
      block.startsWith('<') ? block : `<p class="mb-3 leading-relaxed">${block}</p>`
    )
    .join('\n');
  return (
    <div
      className="text-sm text-soft [&_li]:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function ReportesPage() {
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
        preset === 'custom'
          ? { start: customStart, end: customEnd }
          : presetRange(preset);
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
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Análisis</p>
        <h1 className="text-xl font-extrabold">Reportes</h1>
        <p className="text-sm text-muted mt-1">
          Reportes ejecutivos del periodo, redactados por IA con tus métricas reales.
        </p>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="section-label mb-2">Periodo</p>
            <Tabs
              tabs={[
                { value: 'week', label: 'Semanal (7d)' },
                { value: 'month', label: 'Mensual (30d)' },
                { value: 'custom', label: 'Rango custom' },
              ]}
              active={preset}
              onChange={setPreset}
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
            disabled={
              generate.isPending || (preset === 'custom' && (!customStart || !customEnd))
            }
          >
            {generate.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner /> Generando…
              </span>
            ) : (
              <>
                <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />
                Generar reporte
              </>
            )}
          </Button>
        </div>
        {generate.isError && (
          <p className="text-xs text-negative mt-3">{(generate.error as Error).message}</p>
        )}
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* Historial */}
        <div className="col-span-12 lg:col-span-4">
          <p className="section-label mb-3">Historial</p>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<FileText size={36} />}
              title="Sin reportes todavía"
              subtitle="Genera tu primer reporte del periodo con el botón de arriba."
            />
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`card w-full text-left p-4 hover:border-primary/50 transition-all ${
                    selected?.id === r.id ? 'border-primary/60 shadow-glow' : ''
                  }`}
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

        {/* Visor */}
        <div className="col-span-12 lg:col-span-8">
          {selected ? (
            <Card glow={false}>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
                <div>
                  <p className="accent-label mb-0.5">Reporte del periodo</p>
                  <h2 className="font-extrabold">
                    {selected.period_start} → {selected.period_end}
                  </h2>
                </div>
                <Button variant="secondary" onClick={() => exportPdf(selected)}>
                  <Download size={14} className="inline mr-1.5 -mt-0.5" />
                  Exportar PDF
                </Button>
              </div>
              <MarkdownView md={selected.summary_md} />
            </Card>
          ) : (
            <EmptyState
              icon={<FileText size={36} />}
              title="Selecciona un reporte"
              subtitle="Elige uno del historial o genera uno nuevo para verlo aquí."
            />
          )}
        </div>
      </div>
    </div>
  );
}
