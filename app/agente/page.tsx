import Chat from '@/components/agente/Chat';

// Agente OS — sustituye a la antigua sección /reportes. Los reportes no se
// pierden: viven en el panel lateral del chat (components/agente/ReportsPanel).
export default function AgentePage() {
  return <Chat />;
}
