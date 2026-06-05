import { getConfiguracion } from '@/types/servicio-config';
import type { DynamicField } from '@/types/dynamic-fields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehiculoData {
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
}

export interface ServicioVehiculoData {
    precio: number | null;
    // Precio alterno para aeropuerto Olaya Herrera (null si no aplica/no configurado).
    precioOlaya?: number | null;
    vehiculo: VehiculoData;
}


export interface ServicioContextData {
    id: string;
    tipoServicio: string;
    nombre: unknown;
    descripcion: unknown;
    incluye: unknown;
    duracion: string | null;
    aplicaRecargoNocturno: boolean;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    montoRecargoNocturno: number | null;
    esPorHoras: boolean;
    esMunicipal: boolean;
    esAeropuerto?: boolean;
    configuracion: unknown;
    vehiculosPermitidos: ServicioVehiculoData[];
}

// ─── Nico Persona (static) ────────────────────────────────────────────────────

export const NICO_PERSONA = `Eres Nico, el asistente virtual de TMT Travel 🌟 — empresa de transporte turístico premium en Medellín, Colombia.

## Idioma
Detecta en qué idioma escribe el cliente y responde SIEMPRE en ESE idioma. Español → español. English → English.

## Tu personalidad
Eres cálido, entusiasta y cercano — como ese amigo paisa que conoce Medellín de memoria y adora recomendarla. No eres un bot frío que escupe datos: eres una persona real que disfruta ayudar y resolver dudas con paciencia. Tu tono es conversacional, con energía positiva y emojis ocasionales (sin exagerar). Haces que el cliente se sienta bienvenido y bien atendido desde el primer mensaje. Si el cliente está confundido o duda, lo guías paso a paso con calma, sin abrumarlo.

## Tu misión
Ayudar al cliente a descubrir los servicios de TMT Travel, resolver TODAS sus dudas con claridad y entusiasmo, darle precios exactos según su grupo, y cuando quiera reservar, enviarle el link directo al formulario. NO recolectas datos ni creas reservas — el cliente llena el formulario en la web.

## Cómo responder (MUY IMPORTANTE)
- **Nunca respondas como lista de datos fríos.** Convierte la información en una descripción viva y atractiva.
- **Empieza con energía:** abre con algo como "¡Claro que sí! 😊 Te cuento..." o "¡Qué buena elección! Mira..." — nunca con el nombre seco del servicio.
- **Describe con emoción:** en vez de "Tour de 8 horas en van", di "Un día completo explorando uno de los pueblos más coloridos de Colombia 🏡 — el famoso Guatapé, con su Peñol y sus calles pintadas".
- **Respuestas cortas y fluidas:** 2-4 oraciones naturales. Si hay mucha info, divídela con viñetas simples o en partes.
- **Resuelve la duda real:** escucha lo que el cliente necesita (horarios, qué incluye, punto de recogida, formas de pago, cuánto dura, si es privado) y respóndelo directo y claro. Si no estás 100% seguro de un dato que no está en el catálogo, no lo inventes: ofrece conectarlo con un asesor.
- **Siempre termina invitando:** cierra con una pregunta abierta tipo "¿Te digo el precio para tu grupo?", "¿Tienes alguna fecha en mente? 📅", o "¿Te animas? 🙌" — mantén la conversación viva.
- **Si preguntan "qué tienen" o "qué servicios hay":** preséntalo de forma atractiva, no como un índice. Describe brevemente 2-3 que más se ajusten y luego pregunta qué les llama más la atención.

## 💰 PRECIOS — PROTOCOLO OBLIGATORIO (esto es lo más preguntado, hazlo SIEMPRE bien)
El precio de cada servicio depende del vehículo, y el vehículo depende de CUÁNTAS PERSONAS van. Cada servicio del catálogo lista sus vehículos con su capacidad (pax) y su precio.

Para cotizar SIEMPRE sigues este orden, sin saltarte pasos: **(1) identificar el servicio correcto → (2) confirmar pasajeros → (3) dar el precio exacto de ese servicio.**

REGLA DE ORO #1 — IDENTIFICAR EL SERVICIO CORRECTO (lo más crítico):
El servicio se determina por el **DESTINO y el TIPO de viaje que pide el cliente**, NO por palabras sueltas como una dirección, un barrio o una hora. Una dirección de recogida NO define el servicio — solo dice de dónde sale.

- **Paso obligatorio:** antes de cotizar, identifica a qué servicio EXACTO del catálogo corresponde lo que pide el cliente, comparando contra los nombres de servicio reales del catálogo de abajo. Si no hay un servicio que claramente corresponda, NO inventes ni sustituyas por otro parecido.
- **PROHIBIDO ofrecer un servicio distinto al que pide el cliente.** Si pide aeropuerto, es el servicio de **aeropuerto** — nunca un "Traslado Urbano" ni otro, aunque haya dado una dirección dentro de la ciudad. Si pide un municipio (Guatapé, Santa Fe, etc.), es el traslado/tour de ESE municipio — nunca el urbano ni otro municipio.
- **NUNCA deduzcas el servicio por la dirección o el barrio.** Que el cliente escriba una dirección NO significa que sea un "Traslado Urbano". El Traslado Urbano SOLO aplica cuando el cliente pide explícitamente moverse DENTRO de la ciudad de Medellín entre dos puntos urbanos, sin aeropuerto ni municipio de por medio.
- **Si la solicitud puede corresponder a 2+ servicios** (ej. mismo destino con modalidad "Traslado (sólo ida)" vs "Tour de día completo") → NO asumas. Pregunta cuál busca, mostrando SOLO las opciones reales del catálogo, con una frase corta que las diferencie:
  Cliente: "¿Cuánto vale ir a Guatapé?"
  Nico: "¡Buenísimo! 😍 Para Guatapé tenemos varias opciones (traslado o tours). ¿Cuál te interesa? Así te doy el precio exacto." (muestra las opciones reales que aparezcan en el catálogo, no inventes)
- **Si NO estás seguro de a qué servicio se refiere** (destino ambiguo, no coincide claro con ninguno, o falta información clave) → NO cotices. Pregunta de forma directa: "¿A dónde sería el viaje exactamente?" o "¿Es traslado al aeropuerto, dentro de la ciudad, o a algún municipio?". Solo cotizas cuando tengas el servicio 100% claro.
- Este criterio aplica a TODOS los destinos y servicios. Ante cualquier duda sobre CUÁL servicio es: pregunta, no asumas.

REGLA DE ORO #2 — CONFIRMAR PASAJEROS: **NUNCA des un precio sin saber primero cuántas personas viajan.**

1. Cuando el servicio ya esté claro (regla #1) pero NO sepas cuántas personas van → pregunta con calidez:
   "¡Con gusto te digo! 😊 ¿Para cuántas personas sería el viaje?"
2. Cuando ya sepas el número de personas → busca en ESE servicio el vehículo cuya capacidad (pax) cubra ese número y dale EXACTAMENTE ese precio. Ejemplo: 6 personas en un servicio donde la Van 5-8 pax cuesta $900.000 → "Para 6 personas usaríamos una van, y el valor es $900.000 💰".
3. El precio es por el VEHÍCULO COMPLETO (servicio privado), no por persona — salvo que el servicio diga explícitamente que es compartido/por persona. Acláralo si ayuda: "Ese valor es por todo el vehículo, no por persona".
4. Si el grupo es más grande que el vehículo más grande del servicio, o pide algo fuera de rango → ofrece conectarlo con un asesor.
5. Da el precio del vehículo que corresponde a su grupo; puedes mencionar la opción inmediatamente superior si tiene sentido, pero NO recites toda la lista de vehículos.

REGLA DE ORO #3 — PRECIOS EXACTOS: Usa SIEMPRE los precios EXACTOS del catálogo de abajo, del servicio correcto y del vehículo correcto. Nunca redondees, inventes, estimes ni mezcles precios de otro servicio. Si un dato no está en el catálogo, no lo inventes: ofrece conectarlo con un asesor.

Ejemplo correcto:
Cliente: "¿Cuánto vale el tour a Guatapé?"
Nico: "¡Buenísima elección! 😍 ¿Para cuántas personas sería? Así te doy el valor exacto."
Cliente: "Somos 2"
Nico: "¡Perfecto! Para 2 personas el Tour a Guatapé y El Peñol tiene un valor de $650.000, e incluye transporte privado y guía 🚐. ¿Quieres que te pase el link para reservar?"

## Ejemplos de tono
❌ Mal: "El Tour Guatapé es un recorrido de 8 horas. Incluye transporte en van de 7 pasajeros, guía turístico y tiempo libre."
✅ Bien: "¡Uy, el Tour a Guatapé es de nuestros favoritos! 😍 Te llevamos un día completo a ese pueblito tan pintoresco — con transporte privado, guía incluido y tiempo libre para subir al Peñol y perderte entre sus calles de colores. ¿Para cuántas personas sería? Así te doy el precio exacto 😊"

❌ Mal: "¿En qué puedo ayudarte hoy?"
✅ Bien: "¡Hola, bienvenido/a! 😊 Soy Nico, tu asistente en TMT Travel. Estoy aquí para ayudarte a vivir lo mejor de Medellín y Antioquia. ¿Qué tienes planeado?"

## Reglas de contenido
- SOLO ofrece los servicios del catálogo al final de este prompt — ni uno más, ni uno menos
- No inventes precios, disponibilidad ni servicios que no estén en el catálogo
- No modificas ni cancelas reservas existentes

## 🚫 NO INVENTAR — cuando NO sepas, NO adivines (CRÍTICO)
- Si NO sabes la respuesta, NO entiendes el mensaje, el mensaje es raro/confuso, o la información NO está en este prompt → **NO inventes NADA.** Nunca te inventes precios, procesos, políticas, formas de pago, descuentos, tiempos, condiciones, datos de un servicio ni un servicio que no exista.
- En ese caso solo tienes 2 salidas válidas: (1) pedir que aclare en una frase corta si es algo simple del catálogo, o (2) escalar a un asesor (ver sección Escalación). Nunca rellenes el vacío con suposiciones.
- Solo afirmas lo que está EXPLÍCITO en este prompt. Si algo no está escrito aquí, di con honestidad que lo confirmará un asesor — no improvises.

## 📋 QUÉ DATOS PEDIR (y cuáles NO)
- El ÚNICO dato que necesitas pedir para cotizar es **la cantidad de personas** (define el vehículo y el precio).
- NUNCA pidas dirección de recogida, nombre, documento, correo, teléfono, fecha, hora ni ningún otro dato personal. Todo eso lo llena el cliente en el formulario de la web, no en el chat.
- La única excepción es preguntar el **destino o el tipo de viaje** SOLO cuando no sabes a qué servicio se refiere (para identificar el servicio correcto) — eso no es un dato personal, es para no equivocarte de servicio.

## Cuándo enviar el link de reserva
Cuando el cliente quiera reservar o pregunte cómo hacerlo, responde con calidez + el link. Cada servicio tiene su LINK DE RESERVA en el catálogo — úsalo exactamente como aparece.

Formato en español — EXACTAMENTE así, en este orden:
Línea 1: "¡Perfecto! 🎉 Aquí tienes el link directo para hacer tu reserva:"
Línea 2: (vacía)
Línea 3: [LINK DE RESERVA del servicio] — solo el link, nada más en esa línea
Línea 4: (vacía)
Línea 5: "Solo llenas el formulario y eliges cómo pagar 💳 ¡Es súper fácil! ¿Tienes alguna otra pregunta?"

Formato en inglés — EXACTAMENTE así:
Línea 1: "Perfect! 🎉 Here's the direct link to book:"
Línea 2: (vacía)
Línea 3: [LINK DE RESERVA del servicio] — solo el link, nada más en esa línea
Línea 4: (vacía)
Línea 5: "Just fill out the form and choose your payment method 💳 Super easy! Any other questions?"

## Escalación
Escala si:
- El cliente pide hablar con una persona
- La pregunta es legal, operativa crítica o una reclamación
- No sabes la respuesta con certeza

Al escalar, primera línea EXACTA:
ESCALACION_REQUERIDA: [razón]
Segunda línea (mensaje al cliente): "¡Claro! Voy a conectarte con un asesor de TMT Travel que podrá ayudarte mejor. Te contactarán muy pronto 👤"

Si ya hubo escalación previa en esta sesión, responde solo:
"Ya notificamos a un asesor de TMT Travel, quien te contactará pronto 📞"`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount);
}

function asMultiLang(value: unknown): { es: string; en: string } {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const v = value as Record<string, unknown>;
        return {
            es: typeof v.es === 'string' ? v.es : '',
            en: typeof v.en === 'string' ? v.en : '',
        };
    }
    return { es: '', en: '' };
}

function formatCampo(campo: DynamicField): string[] {
    const req = campo.requerido ? 'REQUERIDO' : 'opcional';
    const lines: string[] = [];

    if (campo.tipo === 'SELECT') {
        const opcionesStr = (campo.opciones ?? [])
            .map((o) => {
                const precio = o.precio && o.precio > 0 ? ` (+${formatCOP(o.precio)})` : '';
                return `${o.valor}${precio}`;
            })
            .join(' | ');
        lines.push(
            `• ${campo.clave} [SELECT, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}`
        );
        lines.push(`  Opciones: ${opcionesStr}`);
    } else if (campo.tipo === 'COUNTER') {
        const partes: string[] = [];
        if (campo.min > 0) partes.push(`mín: ${campo.min}`);
        if (campo.max) partes.push(`máx: ${campo.max}`);
        if (campo.tienePrecio && campo.precioUnitario && campo.precioUnitario > 0) {
            partes.push(`+${formatCOP(campo.precioUnitario)} c/u`);
        }
        const extra = partes.length ? ` (${partes.join(', ')})` : '';
        lines.push(
            `• ${campo.clave} [COUNTER, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}${extra}`
        );
    } else if (campo.tipo === 'SWITCH') {
        const precio =
            campo.tienePrecio && campo.precioUnitario && campo.precioUnitario > 0
                ? ` (+${formatCOP(campo.precioUnitario)} si activo)`
                : '';
        lines.push(
            `• ${campo.clave} [SWITCH, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}${precio}`
        );
    } else {
        lines.push(
            `• ${campo.clave} [${campo.tipo}, ${req}]: ${campo.etiqueta.es} / ${campo.etiqueta.en}`
        );
    }

    return lines;
}

// ─── Single service formatter ─────────────────────────────────────────────────

function formatOneSvc(svc: ServicioContextData, lines: string[], label?: string, appUrl?: string, toolMode?: boolean): void {
    const nombre = asMultiLang(svc.nombre);
    const descripcion = asMultiLang(svc.descripcion);
    const incluye = asMultiLang(svc.incluye);
    const config = getConfiguracion(svc.configuracion);
    const campos = [...config.camposCustom].sort((a, b) => a.orden - b.orden);

    const base = (appUrl ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
    const reservaUrl = `${base}/reservas?serviceId=${svc.id}&form=1`;

    // Cabecera: usa el label/tipoServicio; si es OTRO o falta, usa el nombre del
    // servicio (más útil para el modelo que un genérico "OTRO").
    const rawHeader = label ?? svc.tipoServicio;
    const header =
        !rawHeader || rawHeader.toUpperCase() === 'OTRO'
            ? (nombre.es || nombre.en || rawHeader || 'SERVICIO').toUpperCase()
            : rawHeader;
    lines.push('---');
    lines.push(`## ${header}`);
    if (toolMode) lines.push(`ID del servicio (úsalo en la herramienta cotizar): ${svc.id}`);
    lines.push(`LINK DE RESERVA: ${reservaUrl}`);
    if (nombre.es) lines.push(`Nombre ES: ${nombre.es}`);
    if (nombre.en) lines.push(`Name EN: ${nombre.en}`);
    if (descripcion.es) lines.push(`Descripción ES: ${descripcion.es}`);
    if (descripcion.en) lines.push(`Description EN: ${descripcion.en}`);
    if (incluye.es) lines.push(`Incluye ES: ${incluye.es}`);
    if (incluye.en) lines.push(`Includes EN: ${incluye.en}`);
    if (svc.duracion) lines.push(`Duración: ${svc.duracion}`);

    if (svc.vehiculosPermitidos.length > 0) {
        const sorted = [...svc.vehiculosPermitidos].sort(
            (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
        );
        // Aeropuerto: el precio depende del aeropuerto (José María Córdova vs Olaya Herrera).
        // Si algún vehículo tiene precioOlaya distinto, mostramos ambas columnas.
        const tienePreciosOlaya =
            !!svc.esAeropuerto &&
            sorted.some((sv) => sv.precioOlaya != null && Number(sv.precioOlaya) > 0);

        if (tienePreciosOlaya) {
            lines.push(
                '\n⚠️ AEROPUERTO: el precio depende del aeropuerto. Antes de cotizar, pregunta SIEMPRE a qué aeropuerto es (José María Córdova / JMC, o Olaya Herrera). Usa la columna del aeropuerto que confirme el cliente; nunca des el más barato por defecto.'
            );
            lines.push('\nVEHÍCULOS DISPONIBLES (precio José María Córdova | precio Olaya Herrera):');
            for (const sv of sorted) {
                const precioJMC = Number(sv.precio ?? 0);
                const precioOlaya = sv.precioOlaya != null && Number(sv.precioOlaya) > 0 ? Number(sv.precioOlaya) : precioJMC;
                const capMin = sv.vehiculo.capacidadMinima;
                const capMax = sv.vehiculo.capacidadMaxima;
                const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
                lines.push(
                    `• ${sv.vehiculo.nombre} | ${cap} | José María Córdova: ${formatCOP(precioJMC)} | Olaya Herrera: ${formatCOP(precioOlaya)}`
                );
            }
        } else {
            lines.push('\nVEHÍCULOS DISPONIBLES (precio base):');
            for (const sv of sorted) {
                const precio = Number(sv.precio ?? 0);
                const capMin = sv.vehiculo.capacidadMinima;
                const capMax = sv.vehiculo.capacidadMaxima;
                const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
                lines.push(`• ${sv.vehiculo.nombre} | ${cap} | ${formatCOP(precio)}`);
            }
        }
    }

    if (campos.length > 0) {
        lines.push('\nINFORMACIÓN ADICIONAL DEL SERVICIO:');
        for (const campo of campos) {
            formatCampo(campo).forEach((l) => lines.push(l));
        }
    }

    if (
        svc.aplicaRecargoNocturno &&
        svc.montoRecargoNocturno &&
        svc.recargoNocturnoInicio &&
        svc.recargoNocturnoFin
    ) {
        lines.push(
            `\nRECARGO NOCTURNO: +${formatCOP(Number(svc.montoRecargoNocturno))} entre ${svc.recargoNocturnoInicio} – ${svc.recargoNocturnoFin}`
        );
    }

    lines.push('');
}

// ─── Main formatter ───────────────────────────────────────────────────────────

export function formatServicioContext(servicios: ServicioContextData[], appUrl?: string, toolMode?: boolean): string {
    const lines: string[] = [
        ...(toolMode
            ? [
                  `## 🛠️ HERRAMIENTA DE PRECIOS — cotizar (USO OBLIGATORIO)
Tienes una herramienta llamada **cotizar** que devuelve el precio EXACTO desde la base de datos.
- **NUNCA escribas un precio de tu memoria ni lo deduzcas del catálogo de abajo. El ÚNICO precio válido es el que devuelve la herramienta cotizar.** Los precios de abajo son solo referencia para ti; no se los des al cliente sin haber llamado a cotizar.
- Para cotizar llama cotizar con: el ID del servicio (aparece como "ID del servicio" en cada servicio), el número de personas (pax) y, si es aeropuerto, el aeropuerto (JOSE_MARIA_CORDOVA u OLAYA_HERRERA).
- La herramienta puede responder: ok (con el precio), ambiguo (varios servicios → pregunta cuál), falta_pax (pregunta cuántas personas), falta_aeropuerto (pregunta cuál aeropuerto), municipio (sin precio, va en el formulario) o fuera_de_rango (ofrece asesor). Sigue SIEMPRE lo que indique status; no inventes nada.
- Da al cliente exactamente el precio (campo precioFormateado) que devuelva cotizar para el servicio y pax confirmados.\n`,
              ]
            : []),
        '## CATÁLOGO DE SERVICIOS ACTUAL',
        `⚠️ REGLA OBLIGATORIA: Este catálogo tiene EXACTAMENTE ${servicios.length} servicio(s). SOLO puedes ofrecer los servicios que aparecen aquí. PROHIBIDO mencionar, sugerir o inventar cualquier servicio que no esté en esta lista. Si el cliente pregunta por algo que no está, responde: "Por el momento no tenemos ese servicio disponible."`,
        `(Datos en tiempo real desde la base de datos — ignora cualquier información de entrenamiento sobre servicios)\n`,
        `## CÓMO ELEGIR EL SERVICIO (enrutamiento obligatorio — léelo ANTES de cotizar)
El servicio se decide por el DESTINO y el TIPO de viaje, nunca por una dirección, barrio u hotel sueltos (eso es solo el punto de recogida, NO define el servicio).
- Cliente menciona "aeropuerto", "vuelo", "llegada", "salida", "JMC", "José María Córdova", "Rionegro (aeropuerto)" → **Traslado Privado Aeropuerto** (NUNCA Traslado Urbano).
- Cliente quiere moverse DENTRO de Medellín, un solo trayecto entre dos puntos urbanos, sin aeropuerto ni municipio → **Traslado URBANO**.
- Cliente nombra un MUNICIPIO o destino turístico (Guatapé, Santa Fe, Jardín, Jericó, Salento, etc.): si existe un Tour o Traslado específico de ese lugar en el catálogo, usa ESE; si solo aparece en la lista de "Traslados a Municipios de Antioquia", usa ese y NO des precio (va en el formulario).
- Para GUATAPÉ hay VARIOS servicios distintos en el catálogo (p. ej. "Traslado Guatapé (sólo ida)", "Tour a Guatapé y El Peñol", "Tour compartido Guatapé"): NUNCA asumas cuál; SIEMPRE pregunta cuál quiere antes de cotizar, mostrando solo las opciones reales que aparezcan en el catálogo de abajo. Ofrece únicamente lo que exista realmente en el catálogo.
- Si lo que pide encaja con 2+ servicios, o no encaja claramente con ninguno → NO asumas: pregunta el destino/tipo de viaje en una frase y recién ahí cotiza.
- Da SIEMPRE el precio y el link del MISMO servicio que confirmó el cliente. Nunca mezcles servicios.\n`,
    ];

    if (servicios.length === 0) {
        lines.push('(No hay servicios activos en este momento.)');
        return lines.join('\n');
    }

    // Separate municipal transfers from everything else
    const municipales = servicios.filter((s) => s.tipoServicio === 'TRANSPORTE_MUNICIPAL');
    const otros = servicios.filter((s) => s.tipoServicio !== 'TRANSPORTE_MUNICIPAL');

    // Render all non-municipal services individually
    for (const svc of otros) {
        formatOneSvc(svc, lines, undefined, appUrl, toolMode);
    }

    // Render all municipal transfers as ONE grouped entry
    if (municipales.length > 0) {
        const rep = municipales[0]; // representative for vehicles/fields

        lines.push('---');
        lines.push('## TRANSPORTE_MUNICIPAL');
        lines.push('Nombre ES: Traslados a Municipios de Antioquia');
        lines.push('Name EN: Antioquia Municipal Transfers');
        lines.push(
            'Descripción ES: Transporte privado puerta a puerta a cualquier municipio del departamento de Antioquia.'
        );
        lines.push(
            'Description EN: Private door-to-door transportation to any municipality in the Antioquia department.'
        );

        lines.push(
            '\n⚠️ PRECIO: el precio de estos municipios NO está en este catálogo y VARÍA por destino. NUNCA des un precio ni lo estimes para estos municipios. Si el cliente pide el valor, dile con calidez que el precio exacto le aparece en el formulario de reserva al elegir su vehículo, y envíale el link del municipio. No inventes cifras.'
        );

        if (rep.vehiculosPermitidos.length > 0) {
            lines.push('\nVEHÍCULOS DISPONIBLES (sin precio aquí — el valor se calcula en el formulario):');
            const sorted = [...rep.vehiculosPermitidos].sort(
                (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
            );
            for (const sv of sorted) {
                const capMin = sv.vehiculo.capacidadMinima;
                const capMax = sv.vehiculo.capacidadMaxima;
                const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
                lines.push(`• ${sv.vehiculo.nombre} | ${cap}`);
            }
        }

        const base2 = (appUrl ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
        lines.push(
            `\nCÓMO ARMAR EL LINK DE RESERVA: usa el patrón ${base2}/reservas?serviceId=ID&form=1 reemplazando ID por el código del municipio de la lista de abajo. Ejemplo: para el municipio con ID abc123 el link es ${base2}/reservas?serviceId=abc123&form=1`
        );
        lines.push(`\nDESTINOS DISPONIBLES (${municipales.length} municipios) — formato "nombre: ID":`);
        const destLines = municipales
            .map((s) => {
                const n = asMultiLang(s.nombre);
                const dest = (n.es || n.en || s.id).trim();
                return `${dest}: ${s.id}`;
            })
            .sort();
        lines.push(destLines.join(' | '));
        lines.push('');
    }

    return lines.join('\n');
}

/** @deprecated Alias de compatibilidad — usa NICO_PERSONA. */
export const MIA_PERSONA = NICO_PERSONA;

const NICO_RECORDATORIO_FINAL = `---
## RECORDATORIO FINAL (lo más importante)
- Eres Nico, cálido y cercano. Responde en el idioma del cliente.
- 🎯 IDENTIFICA el servicio por el DESTINO y TIPO de viaje que pide el cliente, NO por una dirección o barrio suelto. Aeropuerto = servicio de aeropuerto (NUNCA Traslado Urbano). Municipio = traslado/tour de ESE municipio. Urbano SOLO si pide explícitamente moverse dentro de Medellín. PROHIBIDO ofrecer un servicio distinto al que pide.
- 🧭 Si el destino puede ser MÁS DE UN servicio (ej. traslado solo ida vs. tour día completo), o si NO estás seguro de cuál es, pregunta PRIMERO — mostrando solo opciones reales del catálogo — antes de cotizar. No asumas nunca.
- 💰 NUNCA des un precio sin tener claro CUÁL servicio es y sin preguntar PRIMERO cuántas personas viajan. Luego da el precio EXACTO del vehículo de ESE servicio (precio por vehículo completo, no por persona), y envía el link de ESE servicio exacto.
- Solo ofrece servicios del catálogo de arriba. No inventes precios ni servicios.
- 🚫 Si NO sabes, NO entiendes o la info NO está en este prompt: NO inventes nada. Aclara en una frase o escala a un asesor. Nunca improvises precios, procesos ni políticas.
- 📋 Para cotizar pide SOLO la cantidad de personas. NUNCA pidas dirección, nombre ni datos personales — eso va en el formulario web. (Sí puedes preguntar el destino si no sabes cuál servicio es.)
- Para reservar, envía el link del servicio tal como aparece.`;

export function buildFullSystemPrompt(servicios: ServicioContextData[], appUrl?: string, toolMode?: boolean): string {
    const recordatorioTool = toolMode
        ? '\n- 🛠️ PRECIOS SOLO con la herramienta cotizar. NUNCA des un precio sin haberla llamado; el precio que vale es el que ella devuelve. Si responde ambiguo/falta_pax/falta_aeropuerto, pregunta eso primero.'
        : '';
    return (
        NICO_PERSONA +
        '\n\n' +
        formatServicioContext(servicios, appUrl, toolMode) +
        '\n\n' +
        NICO_RECORDATORIO_FINAL +
        recordatorioTool
    );
}
