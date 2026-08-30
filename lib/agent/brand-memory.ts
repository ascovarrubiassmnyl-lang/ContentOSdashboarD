// Memoria de marca: cosas estables que el usuario dijo sobre su marca y que
// deben sobrevivir entre conversaciones ("no uso emojis", "mi público son
// fundadores B2B", "nunca hablo de precio en TOFU").
//
// Decisión #6 del plan de Fase 2: el agente solo escribe aquí cuando el
// usuario le dice algo estable, y cada entrada guarda de qué conversación
// salió. Memoria que el agente se escribe solo, infiriendo, es la vía rápida a
// un asistente que "recuerda" cosas que nadie dijo y que el usuario no puede
// rastrear ni corregir.

import { BrandMemoryEntry } from '@/types';
import { Workspace, readFor, writeFor } from '../accounts';
import { uid } from '../db';

// Tope: la memoria entra ENTERA en cada system prompt, así que crecer sin
// límite encarece todos los turnos y acaba diluyendo lo importante.
export const MAX_MEMORY_ENTRIES = 40;

export async function listBrandMemory(ws: Workspace): Promise<BrandMemoryEntry[]> {
  return readFor<BrandMemoryEntry>(ws, 'brand_memory');
}

export async function addBrandMemory(
  ws: Workspace,
  text: string,
  sourceConversationId: string | null
): Promise<BrandMemoryEntry> {
  const clean = text.trim();
  if (!clean) throw new Error('Una entrada de memoria no puede estar vacía.');

  const existing = await listBrandMemory(ws);
  // Sin esto, el agente re-guarda lo mismo cada vez que el usuario lo repite y
  // la memoria se llena de duplicados.
  const duplicate = existing.find((e) => e.text.trim().toLowerCase() === clean.toLowerCase());
  if (duplicate) return duplicate;

  if (existing.length >= MAX_MEMORY_ENTRIES) {
    throw new Error(
      `La memoria de marca está llena (${MAX_MEMORY_ENTRIES} entradas). Borra alguna desde Ajustes del agente antes de añadir otra.`
    );
  }

  const entry: BrandMemoryEntry = {
    id: uid(),
    account_id: ws.id,
    text: clean,
    source_conversation_id: sourceConversationId,
    created_at: new Date().toISOString(),
  };
  await writeFor(ws, 'brand_memory', [...existing, entry]);
  return entry;
}

export async function removeBrandMemory(ws: Workspace, id: string): Promise<void> {
  const remaining = (await listBrandMemory(ws)).filter((e) => e.id !== id);
  await writeFor(ws, 'brand_memory', remaining);
}

// Bloque listo para inyectar en el system prompt. Vacío si no hay memoria, para
// no meter una sección hueca que solo gasta tokens.
export async function brandMemoryPromptBlock(ws: Workspace): Promise<string> {
  const entries = await listBrandMemory(ws);
  if (entries.length === 0) return '';
  const lines = entries.map((e) => `- ${e.text}`).join('\n');
  return `\n\nLo que el usuario te ha dicho sobre su marca (respétalo siempre; si algo aquí contradice lo que vas a escribir, gana esto):\n${lines}`;
}
