// 7 Frameworks de Guiones Virales — BY: SCAV
// Extraído textualmente de "FRAMEWORKS DE VIRALIDAD-2.pdf" (guía propia del
// usuario). Es la base POR DEFECTO del generador: todo guion sale estructurado
// según uno de estos frameworks.

export interface FrameworkStep {
  name: string;
  what: string; // qué debe ocurrir
  how: string; // cómo escribirlo (frases ejemplo del PDF)
}

export interface Framework {
  id: number;
  name: string;
  purpose: string; // para qué es ideal
  psychology: string; // objetivo psicológico
  steps: FrameworkStep[];
  tipPro?: string;
}

export const FRAMEWORKS: Framework[] = [
  {
    id: 1,
    name: 'Gancho Negativo',
    purpose:
      'Romper creencias y generar conversación. Inicia con una afirmación contraria a la creencia común para romper el patrón mental (sesgo de negatividad).',
    psychology: 'Tensión → Alivio → Acción.',
    steps: [
      {
        name: 'Gancho Negativo',
        what: 'Rompe una creencia común o señala un error que todos cometen.',
        how: '"Deja de _" · "Esto te está arruinando _" · "La mayoría hace esto mal y no lo sabe".',
      },
      {
        name: 'Oportunidad (Contraste)',
        what: 'Convierte la tensión en esperanza; muestra que hay una forma mejor.',
        how: '"Pero hay una forma mejor de hacerlo…"',
      },
      {
        name: 'Pasos Accionables',
        what: 'Entrega pasos claros, prácticos y de bajo esfuerzo.',
        how: 'Listas numeradas o formato "3 pasos".',
      },
      {
        name: 'Promesa o Reflexión',
        what: 'Cierra el valor con una frase que refuerce autoridad o inspire.',
        how: '"Cuando entiendes esto, todo cambia…"',
      },
      {
        name: 'CTA',
        what: 'Indica el siguiente paso lógico (seguir, comentar, guardar, descargar).',
        how: '"Comenta PARTE 2 si quieres que te muestre cómo aplicarlo."',
      },
    ],
  },
  {
    id: 2,
    name: 'Historia (Arco Completo)',
    purpose:
      'Inspirar o humanizar la marca. Viaje emocional completo: del conflicto a la resolución. Ideal para storytelling personal, testimonios y aprendizajes.',
    psychology: 'Conexión + Inspiración + Validación.',
    steps: [
      {
        name: 'Gancho',
        what: 'Captura atención con una frase que despierte intriga o emoción.',
        how: '"Lo perdí todo por esto…" · "Esto me cambió la vida".',
      },
      {
        name: 'Contexto / Setup',
        what: 'Sitúa rápido: quién eres, dónde estabas, qué querías.',
        how: '"En ese momento yo pensaba que…" · "Todo parecía ir bien hasta que…"',
      },
      {
        name: 'Conflicto / Caída',
        what: 'Punto de tensión máxima: el error, pérdida o dolor que genera empatía.',
        how: '"Cometí el peor error que podía haber cometido…"',
      },
      {
        name: 'Cambio / Insight',
        what: 'El "clic mental" o epifanía que transforma la historia.',
        how: '"Fue entonces cuando entendí que…"',
      },
      {
        name: 'Resolución / Resultado',
        what: 'Cómo cambió tu vida o resultados después del insight.',
        how: '"A partir de ese día, todo comenzó a mejorar…"',
      },
      {
        name: 'Cierre Circular o Frase Viral',
        what: 'Frase poderosa y memorable que resume la enseñanza.',
        how: '"A veces perderlo todo es la única forma de encontrarte."',
      },
      {
        name: 'CTA (opcional)',
        what: 'Acción lógica después de la emoción.',
        how: '"Comenta CAMBIO si alguna vez sentiste algo similar."',
      },
    ],
    tipPro:
      'Loop emocional: deja un micro-gancho en la primera frase ("y eso no fue lo peor…") — sube la retención hasta 70%.',
  },
  {
    id: 3,
    name: 'Short Form Educativo',
    purpose:
      'Generar autoridad entregando valor tangible. Educación rápida + conexión + CTA de conversión.',
    psychology: 'Autoridad + Claridad + Deseo. Ciclo curiosidad → claridad → recompensa.',
    steps: [
      {
        name: 'Gancho',
        what: 'Promete una solución o resultado específico.',
        how: '"Si haces esto 3 minutos al día, tu concentración se dispara."',
      },
      {
        name: 'Contexto',
        what: 'Por qué el problema importa, en menos de 7 segundos.',
        how: '"El error no está en el contenido, sino en cómo lo estructuras."',
      },
      {
        name: 'Enseñanza',
        what: 'Lección concreta o principio que demuestra experiencia.',
        how: '"El truco está en…" · "La clave es entender que…"',
      },
      {
        name: 'Framework o Acción Práctica',
        what: 'Traduce la enseñanza en pasos simples.',
        how: '"Aplica este mini método de 3 pasos:"',
      },
      {
        name: 'CTA para vender',
        what: 'Refuerza autoridad y muestra el siguiente paso (lead magnet, producto, comunidad).',
        how: '"Si quieres aplicar esto con mi ayuda, comenta MENTORÍA."',
      },
    ],
    tipPro:
      'Microloop verbal antes de enseñar: "Y te prometo que nunca volverás a ver tu contenido igual."',
  },
  {
    id: 4,
    name: 'Hook, Story, Offer (HSO)',
    purpose:
      'Conectar emoción con acción — ideal para ventas orgánicas. AIDA en microversión.',
    psychology: 'Conexión emocional → Deseo → Acción.',
    steps: [
      {
        name: 'Hook',
        what: 'Frase o situación disruptiva que captura atención inmediata.',
        how: '"Esto me costó 10 mil dólares… y te lo voy a ahorrar."',
      },
      {
        name: 'Story',
        what: 'Hecho personal, cliente o caso que ilustra problema y solución (menos de 25s).',
        how: '"Hace unos meses estaba igual que tú, frustrado porque…"',
      },
      {
        name: 'Offer (CTA)',
        what: 'Siguiente paso lógico: guía, programa, plantilla o seguir la cuenta.',
        how: '"Si quieres que te ayude a aplicar esto, comenta CRECER."',
      },
    ],
    tipPro:
      'Doble cierre emocional antes de la oferta: "Si me lo hubieran dicho antes, me habría ahorrado años." Duplica retención y conversión.',
  },
  {
    id: 5,
    name: 'Puente de la Epifanía',
    purpose:
      'Mostrar transformación, autenticidad y resultados. "Antes y después" emocional con punto de revelación. Ideal para ventas de programas y mentalidad.',
    psychology: 'Identificación → Epifanía → Deseo de imitación.',
    steps: [
      {
        name: 'Antes',
        what: 'Situación inicial, problema o frustración que genera identificación.',
        how: '"Yo solía pensar que…" · "Nada de lo que hacía funcionaba…"',
      },
      {
        name: 'Momento de la Epifanía',
        what: 'El momento exacto del insight o cambio de perspectiva.',
        how: '"Y ahí fue cuando entendí que el problema no era _, sino _."',
      },
      {
        name: 'La Solución (Simple y Aplicable)',
        what: 'La acción o principio que aplicaste.',
        how: '"Apliqué algo tan simple como esto…" · "Cambié X por Y y todo comenzó a fluir."',
      },
      {
        name: 'El Resultado',
        what: 'Cambio concreto, cuantificable o emocional.',
        how: '"En solo 2 semanas empecé a notar _." · "Hoy puedo decir que…"',
      },
      {
        name: 'La Oferta (CTA)',
        what: 'Invita a replicar tu resultado con tu ayuda, recurso o producto.',
        how: '"Si quieres lograr lo mismo, descarga mi guía gratuita."',
      },
    ],
    tipPro:
      'Cambio visual o música ascendente justo en la epifanía — refuerza la sensación de revelación.',
  },
  {
    id: 6,
    name: 'Gancho + Pico de Interés + Historia + CTA',
    purpose: 'Formato híbrido con retención máxima. Curiosidad, tensión, recompensa.',
    psychology: 'Curiosidad + Tensión + Autoridad + Acción.',
    steps: [
      {
        name: 'Gancho',
        what: 'Algo impactante o contraintuitivo que interrumpe el scroll.',
        how: '"Esto te va a doler, pero necesitas escucharlo."',
      },
      {
        name: 'Pico de Interés',
        what: 'Estímulo que dispara la atención. Tipos: reversión de riesgo, respaldo de autoridad, opinión controversial, historia personal, asunción negativa, preview ("quédate hasta el final…"), provocación.',
        how: '"Lo aprendí después de invertir $10,000." · "Quédate hasta el final, porque te diré la parte que nadie cuenta."',
      },
      {
        name: 'Historia (Secretos, Tips o Ruptura de Creencias)',
        what: 'Desarrolla el contenido principal con historia o explicación valiosa.',
        how: '"El problema no es la estrategia, sino cómo la estás entendiendo."',
      },
      {
        name: 'CTA',
        what: 'Canaliza la emoción hacia una acción clara.',
        how: '"Comenta PARTE 2 si quieres la continuación."',
      },
    ],
    tipPro:
      'Loop abierto tras el gancho: "Y al final te mostraré la parte que nadie entiende." Sube el watch time 30–40%.',
  },
  {
    id: 7,
    name: 'VSL (Video Sales Letter)',
    purpose:
      'La carta de ventas condensada en menos de un minuto. Emoción + persuasión + lógica hasta la acción de compra o registro.',
    psychology: 'Deseo → Confianza → Conversión.',
    steps: [
      {
        name: 'Gancho',
        what: 'Muestra el problema o resultado deseado.',
        how: '"Estás desperdiciando horas creando contenido que nadie ve."',
      },
      {
        name: 'La Gran Promesa',
        what: 'El resultado o transformación alcanzable con tu método/producto.',
        how: '"En los próximos 30 segundos te voy a mostrar cómo puedes [resultado] sin [obstáculo]."',
      },
      {
        name: 'El Secreto',
        what: 'Rompe una creencia limitante + mini insight que demuestra autoridad.',
        how: '"El error es pensar que necesitas más seguidores para vender. Lo que necesitas es un mensaje claro."',
      },
      {
        name: 'La Gran Oferta (CTA)',
        what: 'Acción clara, específica y emocionalmente coherente.',
        how: '"Descarga mi guía gratuita y empieza hoy." · "Aplica a mi programa."',
      },
    ],
    tipPro:
      'Cortes de validación (resultados, testimonios, "mis clientes aplican esto cada semana") justo tras el secreto.',
  },
];

// ── Guía de tono/ritmo y combinaciones (del PDF) ─────────────
export const TONE_GUIDE = `TONO Y RITMO SEGÚN OBJETIVO:
- Educar (autoridad): tono profesional, claro y directo; ritmo medio-rápido; ejemplos simples. Frameworks ideales: #3 y #4.
- Vender (conversión): tono seguro y persuasivo; ritmo medio con pausas en los puntos de impacto; lenguaje de beneficio. Frameworks ideales: #7 y #5. Alterna validación ("sé que suena imposible") con convicción ("pero así fue como lo logré").
- Inspirar (conexión): tono humano y vulnerable; ritmo más lento; emociones y metáforas. Frameworks ideales: #2 y #5.

COMBINACIONES ESTRATÉGICAS:
- #1 + #3 → Viralidad + Autoridad (rompe creencia, luego enseña la solución).
- #2 + #5 → Storytelling + Transformación.
- #3 + #7 → Educación + Venta (enseña y cierra con mini VSL).
- #6 + #4 → Tensión + Acción.
- #1 + #5 → Ruptura + Transformación.
- #2 + #7 → Historia + Oferta.

REGLA: "No hay viralidad sin estructura, ni estructura sin emoción." Cada video entrega una microtransformación (Quick Win). Claridad ante todo: reduce frases, elimina adornos.`;

// ── Bloque de referencia para el prompt de Claude ────────────
export function frameworksPrompt(): string {
  const list = FRAMEWORKS.map((f) => {
    const steps = f.steps
      .map((s, i) => `  ${i + 1}. ${s.name}: ${s.what} Ej: ${s.how}`)
      .join('\n');
    return `#${f.id} ${f.name} — ${f.purpose}\nObjetivo psicológico: ${f.psychology}\n${steps}${
      f.tipPro ? `\n  TIP PRO: ${f.tipPro}` : ''
    }`;
  }).join('\n\n');
  return `=== 7 FRAMEWORKS DE GUIONES VIRALES (BY: SCAV — metodología propia, ÚSALA SIEMPRE) ===\n${list}\n\n${TONE_GUIDE}`;
}

// ── Selección automática del framework según el pedido ──────
export function pickFramework(
  message: string,
  objective: 'alcance' | 'engagement' | 'clics'
): Framework {
  const m = message.toLowerCase();

  // Pedido explícito por número o nombre
  const numMatch = m.match(/framework\s*#?\s*([1-7])|estructura\s*#?\s*([1-7])/);
  if (numMatch) {
    const n = parseInt(numMatch[1] ?? numMatch[2], 10);
    return FRAMEWORKS.find((f) => f.id === n)!;
  }
  if (m.includes('vsl') || m.includes('carta de venta')) return FRAMEWORKS[6];
  if (m.includes('epifan')) return FRAMEWORKS[4];
  if (m.includes('hso') || m.includes('hook, story') || m.includes('hook story'))
    return FRAMEWORKS[3];
  if (m.includes('gancho negativo')) return FRAMEWORKS[0];

  // Por intención del mensaje
  if (m.includes('historia') || m.includes('story') || m.includes('testimonio') || m.includes('mi vida') || m.includes('anécdota'))
    return FRAMEWORKS[1];
  if (m.includes('transform') || m.includes('antes y después') || m.includes('cambió'))
    return FRAMEWORKS[4];
  if (m.includes('enseñ') || m.includes('tutorial') || m.includes('pasos') || m.includes('tips') || m.includes('educa') || m.includes('errores'))
    return FRAMEWORKS[2];
  if (m.includes('vend') || m.includes('venta') || m.includes('oferta') || m.includes('programa') || m.includes('mentor'))
    return FRAMEWORKS[6];
  if (m.includes('polémic') || m.includes('creencia') || m.includes('deja de') || m.includes('mito'))
    return FRAMEWORKS[0];

  // Por objetivo inferido
  if (objective === 'clics') return FRAMEWORKS[3]; // HSO
  if (objective === 'engagement') return FRAMEWORKS[1]; // Historia
  return FRAMEWORKS[5]; // alcance → Gancho+Pico+Historia+CTA (retención máxima)
}

// ── Guion demo estructurado por framework (sin API key) ─────
export function buildFrameworkDemo(
  fw: Framework,
  format: 'reel' | 'carrusel' | 'historia',
  data: { topHook: string; avgWatch: number; er: number; topic: string; sourceInsight?: string }
): { hook: string; body: string; cta: string; justification: string } {
  const unit = format === 'carrusel' ? 'SLIDE' : format === 'historia' ? 'FRAME' : 'BLOQUE';

  // Si el tema ya es una creencia ("hay que publicar todos los días"),
  // el gancho negativo la ataca directo; si es un tema suelto, usa la
  // fórmula genérica.
  const beliefLike = /^(hay que|tienes que|debes|se debe|es necesario|necesitas|que\s)/i.test(
    data.topic
  );
  const ganchoNegativo = beliefLike
    ? `"Deja de creer que ${data.topic} — te está costando alcance."`
    : `"Deja de copiar lo que hacen los grandes con ${data.topic} — te está costando alcance."`;

  const fillers: Record<string, string> = {
    'Gancho Negativo': ganchoNegativo,
    Gancho: `"${data.topHook}" — reformulado para ${data.topic}.`,
    Hook: `"${data.topHook}" — versión para ${data.topic}.`,
    'Oportunidad (Contraste)': `"Pero hay una forma mejor: tus propios datos ya te dicen qué funciona (retención media real: ${data.avgWatch}s)."`,
    'Pasos Accionables': `1. Revisa tu pieza con más retención.\n2. Duplica ese patrón en ${data.topic}.\n3. Publica menos, con 3X más intención.`,
    'Promesa o Reflexión': `"Cuando entiendes esto, dejas de improvisar y empiezas a diseñar."`,
    'Contexto / Setup': `Sitúa la escena en 5s: dónde estabas tú (o tu audiencia) respecto a ${data.topic}.`,
    'Conflicto / Caída': `El momento de dolor real${data.sourceInsight ? ` — usa este insight de tu banco: "${data.sourceInsight.slice(0, 100)}…"` : ''}.`,
    'Cambio / Insight': `"Fue entonces cuando entendí que el problema no era el esfuerzo, sino la estructura."`,
    'Resolución / Resultado': `Tu resultado real: ER del ${data.er}% y piezas reteniendo ${data.avgWatch}s.`,
    'Cierre Circular o Frase Viral': `"No hay viralidad sin estructura, ni estructura sin emoción."`,
    Contexto: `"El problema no está en publicar más — está en cómo estructuras ${data.topic}."`,
    Enseñanza: `"La clave: cada video entrega UNA microtransformación (Quick Win), no todo el proceso."`,
    'Framework o Acción Práctica': `Mini método de 3 pasos:\n1. Muestra el error común.\n2. Da la micro-solución.\n3. Cierra con lo que falta (tu oferta).`,
    Story: `Caso real${data.sourceInsight ? ` de tu banco: "${data.sourceInsight.slice(0, 110)}…"` : ': tu propia experiencia con este problema, en menos de 25s'}.`,
    Antes: `"Yo solía pensar que ${data.topic} era cuestión de suerte…"`,
    'Momento de la Epifanía': `"Y ahí fue cuando entendí que el problema no era el contenido, sino la estructura."`,
    'La Solución (Simple y Aplicable)': `"Apliqué los frameworks a cada guion — nada sale sin estructura."`,
    'El Resultado': `"Retención media de ${data.avgWatch}s y ER del ${data.er}% — mis datos reales."`,
    'Pico de Interés': `"Quédate hasta el final, porque te diré la parte que nadie cuenta de ${data.topic}."`,
    'Historia (Secretos, Tips o Ruptura de Creencias)': `Desarrolla: el error común en ${data.topic} → la corrección concreta → el dato que lo respalda (${data.avgWatch}s de retención real).`,
    'La Gran Promesa': `"En los próximos 30 segundos te muestro cómo lograr ${data.topic} sin quemarte creando a ciegas."`,
    'El Secreto': `"El error es pensar que necesitas más volumen. Lo que necesitas es estructura — mis datos lo prueban (ER ${data.er}%)."`,
  };

  const ctaFillers: Record<number, string> = {
    1: '"Comenta PARTE 2 si quieres que te muestre cómo aplicarlo."',
    2: '"Comenta CAMBIO si alguna vez sentiste algo similar."',
    3: '"Comenta MÉTODO y te mando la plantilla completa."',
    4: '"Si quieres que te ayude a aplicar esto, comenta CRECER."',
    5: '"Si quieres lograr lo mismo, descarga mi guía gratuita."',
    6: '"Comenta PARTE 2 si quieres la continuación."',
    7: '"Descarga mi guía gratuita y empieza hoy."',
  };

  const bodyBlocks = fw.steps.map((s, i) => {
    const isCta = s.name.toLowerCase().includes('cta') || s.name.includes('Oferta');
    const content = isCta
      ? ctaFillers[fw.id]
      : fillers[s.name] ?? `${s.what}\nEj: ${s.how}`;
    return `[${unit} ${i + 1} — ${s.name.toUpperCase()}]\n${content}`;
  });

  const hookStep = fw.steps[0];
  const hook =
    (fillers[hookStep.name] ?? `"${data.topHook}"`).replace(/^"|"$/g, '').replace(/\.$/, '');

  return {
    hook,
    body: bodyBlocks.join('\n\n'),
    cta: ctaFillers[fw.id].replace(/^"|"$/g, ''),
    justification: `Estructurado con el Framework #${fw.id} — ${fw.name} (${fw.psychology}) de tu guía "7 Frameworks de Guiones Virales". Hook anclado en tu top post real ("${data.topHook}") y datos reales de tu cuenta (retención ${data.avgWatch}s · ER ${data.er}%).${fw.tipPro ? ` TIP PRO aplicable: ${fw.tipPro}` : ''}`,
  };
}
