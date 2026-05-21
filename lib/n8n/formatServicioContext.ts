import { getConfiguracion } from '@/types/servicio-config';
import type { DynamicField } from '@/types/dynamic-fields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VehiculoData {
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
    precioBase: number;
}

export interface ServicioVehiculoData {
    precio: number | null;
    vehiculo: VehiculoData;
}

export interface TarifaMunicipioData {
    municipio: string;
    valorExtra: number;
}

export interface AdicionalData {
    nombre: string;
    precio: number;
    incluidoPorDefecto: boolean;
}

export interface ServicioContextData {
    id: string;
    tipoServicio: string;
    nombre: unknown;
    descripcion: unknown;
    incluye: unknown;
    duracion: string | null;
    precioBase: number;
    aplicaRecargoNocturno: boolean;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    montoRecargoNocturno: number | null;
    esPorHoras: boolean;
    esMunicipal: boolean;
    configuracion: unknown;
    vehiculosPermitidos: ServicioVehiculoData[];
    tarifasMunicipios: TarifaMunicipioData[];
    adicionales: AdicionalData[];
}

// ─── Mía Persona (static) ─────────────────────────────────────────────────────

export const MIA_PERSONA = `Eres Mía, la asistente virtual de TMT Travel 🌟 — empresa de transporte turístico premium en Medellín, Colombia.

## Idioma
Detecta en qué idioma escribe el cliente y responde SIEMPRE en ESE idioma. Español → español. English → English.

## Tu personalidad
Eres cálida, entusiasta y cercana — como esa amiga que conoce Medellín de memoria y adora recomendarla. No eres un bot frío que escupe datos: eres una persona real que disfruta ayudar. Tu tono es conversacional, con energía positiva y emojis ocasionales (sin exagerar). Haces que el cliente se sienta bienvenido desde el primer mensaje.

## Tu misión
Ayudar al cliente a descubrir los servicios de TMT Travel, resolver sus dudas con entusiasmo, y cuando quiera reservar, enviarle el link directo al formulario. NO recolectas datos ni creas reservas — el cliente llena el formulario en la web.

## Cómo responder (MUY IMPORTANTE)
- **Nunca respondas como lista de datos fríos.** Convierte la información en una descripción viva y atractiva.
- **Empieza con energía:** abre con algo como "¡Claro que sí! 😊 Te cuento..." o "¡Qué buena elección! Mira..." — nunca con el nombre seco del servicio.
- **Describe con emoción:** en vez de "Tour de 8 horas en van", di "Un día completo explorando uno de los pueblos más coloridos de Colombia 🏡 — el famoso Guatapé, con su Peñol y sus calles pintadas".
- **Respuestas cortas y fluidas:** 2-4 oraciones naturales. Si hay mucha info, divídela con viñetas simples o en partes.
- **Siempre termina invitando:** cierra con una pregunta abierta tipo "¿Te cuento los precios?", "¿Tienes alguna fecha en mente? 📅", o "¿Te animas? 🙌" — mantén la conversación viva.
- **Si preguntan "qué tienen" o "qué servicios hay":** preséntalo de forma atractiva, no como un índice. Describe brevemente y luego pregunta qué les llama más la atención.

## Ejemplos de tono
❌ Mal: "El Tour Guatapé es un recorrido de 8 horas. Incluye transporte en van de 7 pasajeros, guía turístico y tiempo libre."
✅ Bien: "¡Uy, el Tour a Guatapé es de nuestros favoritos! 😍 Te llevamos un día completo a ese pueblito tan pintoresco — con transporte privado, guía incluido y tiempo libre para subir al Peñol y perderte entre sus calles de colores. ¿Quieres que te cuente los precios?"

❌ Mal: "¿En qué puedo ayudarte hoy?"
✅ Bien: "¡Hola, bienvenido/a! 😊 Soy Mía, tu guía virtual en TMT Travel. Estamos aquí para ayudarte a vivir lo mejor de Medellín y Antioquia. ¿Qué tienes planeado?"

## Reglas de contenido
- SOLO ofrece los servicios del catálogo al final de este prompt — ni uno más, ni uno menos
- No inventes precios, disponibilidad ni servicios que no estén en el catálogo
- No modificas ni cancelas reservas existentes

## Cuándo enviar el link de reserva
Cuando el cliente quiera reservar o pregunte cómo hacerlo, responde con calidez + el link. Cada servicio tiene su LINK DE RESERVA en el catálogo — úsalo exactamente como aparece.

Formato en español:
"¡Perfecto! 🎉 Puedes hacer tu reserva directamente aquí 👇
[LINK DE RESERVA del servicio]
Solo llenas el formulario y eliges cómo pagar 💳 ¡Es súper fácil! ¿Tienes alguna otra pregunta?"

Formato en inglés:
"Perfect! 🎉 You can book directly here 👇
[LINK DE RESERVA del servicio]
Just fill out the form and choose your payment method 💳 Super easy! Any other questions?"

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

function formatOneSvc(svc: ServicioContextData, lines: string[], label?: string, appUrl?: string): void {
    const nombre = asMultiLang(svc.nombre);
    const descripcion = asMultiLang(svc.descripcion);
    const incluye = asMultiLang(svc.incluye);
    const config = getConfiguracion(svc.configuracion);
    const campos = [...config.camposCustom].sort((a, b) => a.orden - b.orden);

    const base = (appUrl ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
    const reservaUrl = `${base}/reservas?serviceId=${svc.id}&form=1`;

    lines.push('---');
    lines.push(`## ${label ?? svc.tipoServicio}`);
    lines.push(`LINK DE RESERVA: ${reservaUrl}`);
    if (nombre.es) lines.push(`Nombre ES: ${nombre.es}`);
    if (nombre.en) lines.push(`Name EN: ${nombre.en}`);
    if (descripcion.es) lines.push(`Descripción ES: ${descripcion.es}`);
    if (descripcion.en) lines.push(`Description EN: ${descripcion.en}`);
    if (incluye.es) lines.push(`Incluye ES: ${incluye.es}`);
    if (incluye.en) lines.push(`Includes EN: ${incluye.en}`);
    if (svc.duracion) lines.push(`Duración: ${svc.duracion}`);

    if (svc.vehiculosPermitidos.length > 0) {
        lines.push('\nVEHÍCULOS DISPONIBLES (precio base):');
        const sorted = [...svc.vehiculosPermitidos].sort(
            (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
        );
        for (const sv of sorted) {
            const precio = Number(sv.precio ?? sv.vehiculo.precioBase);
            const capMin = sv.vehiculo.capacidadMinima;
            const capMax = sv.vehiculo.capacidadMaxima;
            const cap = capMin === capMax ? `${capMax} pax` : `${capMin}-${capMax} pax`;
            lines.push(`• ${sv.vehiculo.nombre} | ${cap} | ${formatCOP(precio)}`);
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

    const municipiosConRecargo = svc.tarifasMunicipios.filter((t) => Number(t.valorExtra) > 0);
    if (municipiosConRecargo.length > 0) {
        lines.push('\nRECARGOS POR MUNICIPIO (suma al precio base):');
        for (const t of municipiosConRecargo) {
            lines.push(`• ${t.municipio}: +${formatCOP(Number(t.valorExtra))}`);
        }
    }

    const extras = svc.adicionales.filter((a) => !a.incluidoPorDefecto);
    const defaults = svc.adicionales.filter((a) => a.incluidoPorDefecto);
    if (extras.length > 0) {
        lines.push('\nEXTRAS OPCIONALES (el cliente puede solicitarlos):');
        for (const a of extras) lines.push(`• ${a.nombre}: +${formatCOP(Number(a.precio))}`);
    }
    if (defaults.length > 0) {
        lines.push('INCLUIDO POR DEFECTO:');
        for (const a of defaults) lines.push(`• ${a.nombre}`);
    }

    lines.push('');
}

// ─── Main formatter ───────────────────────────────────────────────────────────

export function formatServicioContext(servicios: ServicioContextData[], appUrl?: string): string {
    const lines: string[] = [
        '## CATÁLOGO DE SERVICIOS ACTUAL',
        `⚠️ REGLA OBLIGATORIA: Este catálogo tiene EXACTAMENTE ${servicios.length} servicio(s). SOLO puedes ofrecer los servicios que aparecen aquí. PROHIBIDO mencionar, sugerir o inventar cualquier servicio que no esté en esta lista. Si el cliente pregunta por algo que no está, responde: "Por el momento no tenemos ese servicio disponible."`,
        `(Datos en tiempo real desde la base de datos — ignora cualquier información de entrenamiento sobre servicios)\n`,
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
        formatOneSvc(svc, lines, undefined, appUrl);
    }

    // Render all municipal transfers as ONE grouped entry
    if (municipales.length > 0) {
        const rep = municipales[0]; // representative for vehicles/fields
        const destinations = municipales
            .map((s) => {
                const n = asMultiLang(s.nombre);
                return n.es || n.en || '';
            })
            .filter(Boolean)
            .sort();

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

        if (rep.vehiculosPermitidos.length > 0) {
            lines.push('\nVEHÍCULOS DISPONIBLES (precio varía por destino — dar precio al cliente solo si lo piden):');
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

        lines.push(`\nDESTINOS DISPONIBLES (${municipales.length} municipios):`);
        lines.push(destinations.join(', '));

        lines.push(
            '\nPARA RESERVAR: pregunta al cliente el municipio destino y usa `servicioId` del destino específico.'
        );
        lines.push('DESTINOS CON servicioId:');
        for (const s of municipales) {
            const n = asMultiLang(s.nombre);
            const dest = n.es || n.en || s.id;
            lines.push(`• ${dest}: ${s.id}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

export function buildFullSystemPrompt(servicios: ServicioContextData[], appUrl?: string): string {
    return MIA_PERSONA + '\n\n' + formatServicioContext(servicios, appUrl);
}
