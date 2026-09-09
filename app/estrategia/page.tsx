'use client';

// Pantalla Estrategia — las franjas de publicación que el agente usa como
// criterio para colocar piezas en el calendario.

import { Compass } from 'lucide-react';
import StrategyForm from '@/components/estrategia/StrategyForm';

export default function EstrategiaPage() {
  return (
    <div>
      <div className="mb-6">
        <p className="accent-label mb-1">Criterio del agente</p>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Compass size={20} className="text-primary" />
          Estrategia
        </h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Los días y horas habituales en que publicas. Es un dato declarado: el agente lo usa
          como criterio para planificar, pero nunca como prueba de que algo funcione — eso lo
          miden tus métricas reales.
        </p>
      </div>

      <div className="max-w-2xl">
        <StrategyForm />
      </div>
    </div>
  );
}
