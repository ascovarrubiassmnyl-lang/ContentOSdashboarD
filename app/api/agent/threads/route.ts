import { NextRequest, NextResponse } from 'next/server';
import { readFor, writeFor } from '@/lib/accounts';
import { requireWorkspace } from '@/lib/session';
import { AgentMessage, AgentThread } from '@/types';

// Historial de conversaciones del Agente OS.
//
//   GET                     → lista de hilos, más recientes primero
//   GET ?thread_id=…        → los mensajes de ese hilo
//   DELETE ?thread_id=…     → borra el hilo y sus mensajes

export async function GET(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;

  const threadId = req.nextUrl.searchParams.get('thread_id');

  if (threadId) {
    const messages = (await readFor<AgentMessage>(ws, 'agent_messages'))
      .filter((m) => m.thread_id === threadId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json({ messages });
  }

  const threads = await readFor<AgentThread>(ws, 'agent_threads');
  const messages = await readFor<AgentMessage>(ws, 'agent_messages');

  // Un hilo se creó, pero si el agente falló antes de responder no llegó a
  // guardarse ningún mensaje. Mostrarlo en el historial sería ofrecer una
  // conversación vacía, así que se omite.
  const withMessages = threads.filter((t) => messages.some((m) => m.thread_id === t.id));

  return NextResponse.json({
    threads: withMessages
      .map((t) => {
        const last = messages
          .filter((m) => m.thread_id === t.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return { ...t, last_at: last?.created_at ?? t.created_at };
      })
      .sort((a, b) => b.last_at.localeCompare(a.last_at)),
  });
}

export async function DELETE(req: NextRequest) {
  const r = await requireWorkspace();
  if ('error' in r) return r.error;
  const ws = r.ws;

  const threadId = req.nextUrl.searchParams.get('thread_id');
  if (!threadId) {
    return NextResponse.json({ error: 'Falta thread_id' }, { status: 400 });
  }

  const threads = await readFor<AgentThread>(ws, 'agent_threads');
  await writeFor(
    ws,
    'agent_threads',
    threads.filter((t) => t.id !== threadId)
  );

  // Los mensajes se borran también: dejarlos sería guardar conversaciones que
  // el usuario cree eliminadas y que nadie puede ya ver ni auditar.
  const messages = await readFor<AgentMessage>(ws, 'agent_messages');
  await writeFor(
    ws,
    'agent_messages',
    messages.filter((m) => m.thread_id !== threadId)
  );

  return NextResponse.json({ ok: true });
}
