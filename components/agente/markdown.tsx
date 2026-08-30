'use client';

// Render de Markdown sin dependencias, compartido por el chat y el panel de
// reportes. Estaba dentro de app/reportes/page.tsx; se extrae aquí porque
// ahora lo usan dos superficies y duplicarlo garantizaba que se separaran.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Versión con estilos de pantalla (paleta de Content OS).
export function MarkdownView({ md }: { md: string }) {
  const html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/^### (.*)$/gm, '<h3 class="text-sm font-extrabold mt-4 mb-1.5 text-soft">$1</h3>')
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

// Misma conversión, pero para el PDF: fondo blanco y texto oscuro, con las
// clases sustituidas por elementos que el CSS de impresión estiliza.
export function mdToPrintHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
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
