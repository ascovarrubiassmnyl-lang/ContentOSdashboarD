import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import { AgentEvent, runAgentTurn } from '@/lib/agent/loop';
import { uid } from '@/lib/db';
import { AgentMessage, AgentThread } from '@/types';

// Endpoint de chat del Agente OS. Dos modos sobre el mismo cuerpo:
//
//   sin `stream`  → JSON de una sola respuesta (el de la Fase 1; sigue siendo
//                   el que se usa por curl para validar el arnés)
//   `stream:true` → SSE con el progreso del turno, que consume la UI.
//
// El SSE transmite QUÉ TOOL está consultando el agente, no tokens de texto:
// la respuesta final vive dentro de submit_insights y el disclaimer de
// confianza lo añade el código al parsearla (ver AgentEvent en lib/agent/loop.ts).

const bodySchema = z.object({
  thread_id: z.string().optional(),
  message: z.string().min(1),
  stream: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Petición inválida', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { thread_id, message, stream } = parsed.data;

  const threads = await readFor<AgentThread>(ws, 'agent_threads');
  let thread = thread_id ? threads.find((t) => t.id === thread_id) : undefined;
  if (!thread) {
    thread = {
      id: uid(),
      account_id: ws.id,
      // El primer mensaje da nombre al hilo: un historial de "Conversación 1,
      // 2, 3" no le sirve a nadie para encontrar nada.
      title: message.slice(0, 60),
      created_at: new Date().toISOString(),
    };
    threads.push(thread);
    await writeFor(ws, 'agent_threads', threads);
  }

  const allMessages = await readFor<AgentMessage>(ws, 'agent_messages');
  const history = allMessages
    .filter((m) => m.thread_id === thread!.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Se persiste el turno completo (pregunta + respuesta) solo cuando el agente
  // cierra bien. Guardar la pregunta antes dejaría hilos con mensajes de
  // usuario sin respuesta cada vez que falle una llamada.
  async function persist(reply: string) {
    const now = new Date().toISOString();
    allMessages.push(
      { id: uid(), thread_id: thread!.id, role: 'user', content: message, created_at: now },
      {
        id: uid(),
        thread_id: thread!.id,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      }
    );
    await writeFor(ws, 'agent_messages', allMessages);
  }

  if (!stream) {
    let result: Awaited<ReturnType<typeof runAgentTurn>>;
    try {
      result = await runAgentTurn({
        ws,
        threadId: thread.id,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        userMessage: message,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Error del agente: ${(err as Error).message}` },
        { status: 500 }
      );
    }
    await persist(result.replyMd);
    return NextResponse.json({
      thread_id: thread.id,
      reply_md: result.replyMd,
      insights: result.insights,
    });
  }

  const encoder = new TextEncoder();
  const threadId = thread.id;
  const priorHistory = history.map((m) => ({ role: m.role, content: m.content }));

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // El cliente cerró la pestaña a mitad del turno. El agente sigue y
          // su respuesta se persiste igual; solo deja de haber a quién avisar.
          closed = true;
        }
      };

      send('thread', { thread_id: threadId });

      try {
        const result = await runAgentTurn({
          ws,
          threadId,
          history: priorHistory,
          userMessage: message,
          onEvent: (e: AgentEvent) => send(e.type, e),
        });
        await persist(result.replyMd);
        send('answer', { reply_md: result.replyMd, insights: result.insights });
      } catch (err) {
        send('error', { message: (err as Error).message });
      } finally {
        if (!closed) controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Sin esto, un proxy con buffering entrega todos los eventos de golpe al
      // final y el streaming no se nota.
      'x-accel-buffering': 'no',
    },
  });
}
