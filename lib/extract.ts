// Extracción de texto de archivos subidos al Banco de fuentes.
// PDF → pdf-parse · DOCX → mammoth · texto plano → directo ·
// imágenes → visión con Claude si hay API key, si no un marcador.
import mammoth from 'mammoth';
import { askClaudeVision, hasClaudeKey } from './claude';

export interface ExtractResult {
  text: string;
  note?: string; // aviso si la extracción fue parcial o requiere key
}

const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'json', 'rtf', 'html', 'log'];
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function extOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export async function extractText(
  buffer: Buffer,
  filename: string,
  mime: string
): Promise<ExtractResult> {
  const ext = extOf(filename);

  // ── Texto plano ──
  if (TEXT_EXT.includes(ext) || mime.startsWith('text/')) {
    return { text: buffer.toString('utf-8').trim() };
  }

  // ── PDF ──
  if (ext === 'pdf' || mime === 'application/pdf') {
    try {
      // Se importa por la ruta interna para evitar el "modo debug" de pdf-parse
      // que intenta leer un PDF de prueba al cargar el index.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const result = await pdfParse(buffer);
      const text = result.text.trim();
      if (!text) {
        return {
          text: `[PDF sin texto extraíble: ${filename}]`,
          note: 'El PDF parece ser escaneado (solo imágenes). No se pudo extraer texto.',
        };
      }
      return { text };
    } catch (err) {
      return {
        text: `[No se pudo leer el PDF: ${filename}]`,
        note: `Error extrayendo el PDF: ${(err as Error).message}`,
      };
    }
  }

  // ── Word (.docx) ──
  if (
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: value.trim() };
    } catch (err) {
      return {
        text: `[No se pudo leer el documento: ${filename}]`,
        note: `Error extrayendo el .docx: ${(err as Error).message}`,
      };
    }
  }

  // ── Imágenes ──
  if (IMAGE_MIME[ext] || mime.startsWith('image/')) {
    const mediaType = IMAGE_MIME[ext] ?? mime;
    if (hasClaudeKey()) {
      try {
        const description = await askClaudeVision(
          'Eres un asistente que transcribe y describe imágenes para un banco de conocimiento. Extrae TODO el texto visible y describe brevemente el contenido relevante.',
          'Transcribe el texto de esta imagen y describe lo relevante para contexto de creación de contenido:',
          buffer.toString('base64'),
          mediaType
        );
        return { text: description.trim() };
      } catch (err) {
        return {
          text: `[Imagen: ${filename}]`,
          note: `No se pudo analizar la imagen con IA: ${(err as Error).message}`,
        };
      }
    }
    return {
      text: `[Imagen adjunta: ${filename}]`,
      note: 'Para leer el texto/contenido de imágenes con IA, configura ANTHROPIC_API_KEY. Por ahora se guarda la imagen pero no su contenido.',
    };
  }

  // ── Formato no soportado ──
  return {
    text: `[Archivo adjunto: ${filename}]`,
    note: `Tipo de archivo no soportado para extracción de texto (${ext || mime}). Se guarda el archivo pero no su contenido.`,
  };
}
