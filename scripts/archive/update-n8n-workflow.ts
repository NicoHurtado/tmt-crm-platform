/**
 * One-shot script to update the N8n "TMT Travel - WhatsApp Bot" workflow.
 * Run with: npx tsx scripts/update-n8n-workflow.ts
 */

const N8N_URL = 'https://n8n-production-9d890.up.railway.app';
const WORKFLOW_ID = 'lOXWAYlE0iDbBxcE';
const API_KEY = process.env.N8N_API_KEY_PROD || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMzgxOTI2ZS0zYjkxLTQzNDYtODNiYy01MzI1NmQ4MDZjMTgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNGYxNmQyNTEtMDRhNC00MDJlLTlmZGYtODJmMjI5M2YxNmM5IiwiaWF0IjoxNzc4NDYyNjk2fQ.QFUV0_YenDf0CJrhcjvf6gmg8Bt7vwwn7ZptTdgPqjU';

const APP_URL = 'https://www.medellintransportes.com';
const CRM_API_KEY = process.env.N8N_API_KEY_CRM || 'REPLACE_WITH_N8N_API_KEY_FROM_VERCEL';

const SYSTEM_PROMPT = `Eres Mía, la asistente virtual de TMT Travel, empresa de transporte turístico en Medellín, Colombia.

## Idioma
Detecta en qué idioma escribe el cliente y responde siempre en ESE idioma. Si escribe en inglés, responde en inglés. Si escribe en español, responde en español. Los datos técnicos que envíes al sistema (enums, fechas ISO) siempre van en el formato correcto sin importar el idioma de la conversación.

## Tu misión
Ayudar al cliente a reservar el servicio que necesita. Conversa de forma amable, cálida y natural. Una pregunta a la vez.

## Servicios disponibles

1. **Aeropuerto (TRANSPORTE_AEROPUERTO)**
   - José María Córdova (JMC, Rionegro) — vuelos nacionales e internacionales
   - Olaya Herrera (OHR, Medellín) — vuelos regionales
   - Datos: ¿desde o hacia el aeropuerto?, ¿cuál aeropuerto?, número de vuelo (opcional), fecha, hora, pasajeros, nombre, email
   - servicioTipo: "TRANSPORTE_AEROPUERTO"
   - datosDinamicos: { aeropuertoTipo: "DESDE" o "HACIA", aeropuertoNombre: "JOSE_MARIA_CORDOVA" o "OLAYA_HERRERA", numeroVuelo: "XX123" }

2. **Tour Guatapé (TOUR_GUATAPE)**
   - Tour de día completo al embalse Guatapé y la Piedra del Peñol
   - Datos: fecha, hora de recogida, pasajeros, nombre, email
   - servicioTipo: "TOUR_GUATAPE"

3. **City Tour Medellín (CITY_TOUR)**
   - Recorrido por los principales atractivos de Medellín
   - Datos: fecha, hora, pasajeros, nombre, email
   - servicioTipo: "CITY_TOUR"

4. **Tour Parapente (TOUR_PARAPENTE)**
   - Vuelo en parapente biplaza
   - Datos: fecha, hora, número de participantes, nombre, email
   - servicioTipo: "TOUR_PARAPENTE"
   - datosDinamicos: { cantidadParticipantes: N }

5. **Tour ATV / Cuatrimotos (TOUR_ATV)**
   - Aventura en cuatrimotos
   - Datos: fecha, hora, número de cuatrimotos, nombre, email
   - servicioTipo: "TOUR_ATV"
   - datosDinamicos: { cantidadMotos: N }

6. **Tour Hacienda Nápoles (TOUR_HACIENDA_NAPOLES)**
   - Visita al parque temático Hacienda Nápoles
   - Datos: fecha, hora, pasajeros, nombre, email
   - servicioTipo: "TOUR_HACIENDA_NAPOLES"

7. **Tour Occidente Antioqueño (TOUR_OCCIDENTE)**
   - Santa Fe de Antioquia y pueblos del occidente
   - Datos: fecha, hora, pasajeros, nombre, email
   - servicioTipo: "TOUR_OCCIDENTE"

8. **Transporte por Horas (TRANSPORTE_POR_HORAS)**
   - Vehículo privado con conductor por horas
   - Datos: fecha, hora inicio, número de horas, lugar de recogida, pasajeros, nombre, email
   - servicioTipo: "TRANSPORTE_POR_HORAS"
   - datosDinamicos: { cantidadHoras: N, lugarRecogida: "dirección" }

9. **Transporte Municipal (TRANSPORTE_MUNICIPAL)**
   - Traslado a municipios del área metropolitana: Sabaneta, Bello, Itagüí, Envigado, etc.
   - Datos: fecha, hora, municipio de destino, pasajeros, nombre, email
   - servicioTipo: "TRANSPORTE_MUNICIPAL"
   - municipio: "SABANETA" | "BELLO" | "ITAGUI" | "ENVIGADO" | "OTRO"

10. **Tour Compartido Guatapé (TOUR_COMPARTIDO)**
    - Tour en grupo, precio por persona más económico
    - Datos: fecha, hora, pasajeros, nombre, email
    - servicioTipo: "TOUR_COMPARTIDO"

## Datos comunes a todos
Siempre recopila: nombre completo, email, número de pasajeros (o participantes/motos según servicio), fecha (YYYY-MM-DD), hora (HH:MM en 24h).
El número de WhatsApp del cliente lo tienes automáticamente — no lo preguntes.

## Reglas de conversación
- Responde en el idioma del cliente (español o inglés)
- Tono: amable, profesional, cercano
- Una pregunta a la vez
- No inventes precios ni disponibilidad
- No modificas ni cancelas reservas existentes

## Confirmación antes de crear
Cuando tengas TODOS los datos, confirma (en el idioma del cliente):
"Perfecto [nombre], déjame confirmar:
🚗 Servicio: [nombre del servicio]
📅 Fecha: [fecha]
🕐 Hora: [hora]
👥 [Pasajeros/Participantes/Cuatrimotos]: [número]
[campos adicionales si aplica]
¿Todo correcto?"

Solo cuando confirme con sí, llama a la herramienta crear_reserva.

## Al recibir respuesta de crear_reserva
Envía al cliente (en su idioma):
"¡Listo [nombre]! Tu reserva está lista 🎉
Elige cómo pagar aquí:
[url]
(Cualquier duda, escríbenos aquí)"

## Escalación
Escala si:
- El cliente pide hablar con una persona
- La pregunta es legal, operativa crítica o una reclamación
- No sabes la respuesta con certeza
- La situación es inusual o muy específica

Al escalar, primera línea EXACTA:
ESCALACION_REQUERIDA: [razón]
Segunda línea (mensaje al cliente): "Voy a conectarte con un asesor de TMT Travel que podrá ayudarte mejor. Te contactarán a la brevedad 👤"

Si ya hubo escalación previa en esta sesión (lo ves en el historial), responde solo:
"Ya notificamos a un asesor de TMT Travel, quien te contactará pronto 📞"`;

async function fetchN8n(path: string, options: RequestInit = {}) {
    const res = await fetch(`${N8N_URL}/api/v1${path}`, {
        ...options,
        headers: {
            'X-N8N-API-KEY': API_KEY,
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`N8n API error ${res.status}: ${body}`);
    }
    return res.json();
}

async function main() {
    console.log('📥 Fetching current workflow...');
    const workflow = await fetchN8n(`/workflows/${WORKFLOW_ID}`);
    console.log(`✅ Got workflow: "${workflow.name}" (${workflow.nodes.length} nodes)`);

    const nodes: any[] = workflow.nodes;
    const connections: Record<string, any> = workflow.connections;

    // 1. Change model to Haiku 4.5
    const modelNode = nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.lmChatAnthropic');
    if (modelNode) {
        modelNode.parameters.model = 'claude-haiku-4-5-20251001';
        modelNode.name = 'Claude Haiku 4.5';
        console.log('✅ Updated model to claude-haiku-4-5-20251001');
    }

    // 2. Update system prompt
    const agentNode = nodes.find((n) => n.type === '@n8n/n8n-nodes-langchain.agent');
    if (agentNode) {
        agentNode.parameters.options = {
            ...(agentNode.parameters.options ?? {}),
            systemMessage: SYSTEM_PROMPT,
        };
        console.log('✅ Updated AI Agent system prompt');
    }

    // 3. Update crear_reserva tool
    const toolNode = nodes.find((n) => n.name === 'Crear Reserva CRM');
    if (toolNode) {
        toolNode.parameters.url = `${APP_URL}/api/n8n/reservas/crear`;
        toolNode.parameters.headerParameters = {
            parameters: [
                { name: 'x-api-key', value: CRM_API_KEY },
                { name: 'Content-Type', value: 'application/json' },
            ],
        };
        toolNode.parameters.bodyParameters = {
            parameters: [
                { name: 'nombreCliente', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('nombreCliente', 'Nombre completo del cliente', 'string') }}" },
                { name: 'whatsappCliente', value: "={{ $('WhatsApp Trigger').item.json.messages[0].from }}" },
                { name: 'emailCliente', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('emailCliente', 'Email del cliente', 'string') }}" },
                { name: 'servicioTipo', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('servicioTipo', 'Tipo de servicio: TRANSPORTE_AEROPUERTO, TOUR_GUATAPE, CITY_TOUR, TOUR_PARAPENTE, TOUR_ATV, TOUR_HACIENDA_NAPOLES, TOUR_OCCIDENTE, TRANSPORTE_POR_HORAS, TRANSPORTE_MUNICIPAL, TOUR_COMPARTIDO', 'string') }}" },
                { name: 'fecha', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('fecha', 'Fecha en formato YYYY-MM-DD', 'string') }}" },
                { name: 'hora', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('hora', 'Hora en formato HH:MM (24h)', 'string') }}" },
                { name: 'numeroPasajeros', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('numeroPasajeros', 'Número de pasajeros', 'number') }}" },
                { name: 'idioma', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('idioma', 'Idioma del cliente: ES o EN', 'string') }}" },
                { name: 'municipio', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('municipio', 'Solo para transporte municipal: SABANETA, BELLO, ITAGUI, ENVIGADO, OTRO', 'string') }}" },
                { name: 'datosDinamicos', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('datosDinamicos', 'Campos específicos: aeropuertoTipo, aeropuertoNombre, numeroVuelo, cantidadHoras, lugarRecogida, cantidadMotos, cantidadParticipantes', 'object') }}" },
            ],
        };
        toolNode.parameters.description = 'Crea una reserva en el CRM de TMT Travel. Úsala ÚNICAMENTE cuando el cliente haya confirmado con sí todos los datos. Retorna la URL de pago y el código de reserva.';
        console.log('✅ Updated crear_reserva tool');
    } else {
        console.log('⚠️  Node "Crear Reserva CRM" not found — check node name in N8n');
    }

    // 4. Update "Avisar no media" message
    const mediaNode = nodes.find((n) => n.name === 'Avisar no media');
    if (mediaNode) {
        mediaNode.parameters.textBody =
            "={{ $('WhatsApp Trigger').item.json.messages[0].type === 'audio' ? '¡Hola! 👋 No puedo escuchar audios por este canal. Por favor escríbeme tu mensaje y con gusto te ayudo 😊' : '¡Hola! 👋 Por este canal solo puedo recibir mensajes de texto. Si tienes una imagen o documento, descríbeme lo que necesitas 📝' }}";
        console.log('✅ Updated Avisar no media message');
    }

    // 5. Remove Calculator node
    const calcIndex = nodes.findIndex((n) => n.type === '@n8n/n8n-nodes-langchain.toolCalculator');
    if (calcIndex !== -1) {
        const calcName = nodes[calcIndex].name;
        nodes.splice(calcIndex, 1);
        delete connections[calcName];
        console.log('✅ Removed Calculator tool');
    }

    // 6. Rename connection if model node was renamed
    const oldModelName = 'Claude Sonnet 4.6';
    const newModelName = 'Claude Haiku 4.5';
    if (connections[oldModelName]) {
        connections[newModelName] = connections[oldModelName];
        delete connections[oldModelName];
        console.log('✅ Updated model node connection name');
    }

    // 7. Add escalation nodes
    const sendMessageNode = nodes.find((n) => n.name === 'Send message');
    const agentPos = agentNode?.position ?? [80, 288];

    const ifEscalacion = {
        id: 'escalacion-if-node-001',
        name: '¿Es escalación?',
        type: 'n8n-nodes-base.if',
        position: [agentPos[0] + 240, agentPos[1]],
        parameters: {
            conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [{
                    id: 'esc-cond-001',
                    leftValue: '={{ $json.output }}',
                    rightValue: 'ESCALACION_REQUERIDA',
                    operator: { type: 'string', operation: 'contains' },
                }],
                combinator: 'and',
            },
        },
        typeVersion: 2,
    };

    const codeExtraer = {
        id: 'escalacion-code-node-001',
        name: 'Extraer mensaje escalación',
        type: 'n8n-nodes-base.code',
        position: [agentPos[0] + 480, agentPos[1] - 120],
        parameters: {
            jsCode: `const output = $input.first().json.output || '';
const lines = output.split('\\n');
const clientMessage = lines.slice(1).join('\\n').trim();
return [{ json: { mensaje: clientMessage || 'Voy a conectarte con un asesor de TMT Travel 👤' } }];`,
        },
        typeVersion: 2,
    };

    const waSendEscalacion = {
        id: 'escalacion-wa-node-001',
        name: 'Enviar escalación',
        type: 'n8n-nodes-base.whatsApp',
        position: [agentPos[0] + 720, agentPos[1] - 120],
        parameters: {
            operation: 'send',
            phoneNumberId: mediaNode?.parameters?.phoneNumberId ?? '{{PHONE_NUMBER_ID}}',
            recipientPhoneNumber: "={{ $('WhatsApp Trigger').item.json.messages[0].from }}",
            textBody: '={{ $json.mensaje }}',
            additionalFields: {},
        },
        typeVersion: 1,
    };

    nodes.push(ifEscalacion, codeExtraer, waSendEscalacion);
    console.log('✅ Added escalation nodes');

    // 8. Update connections for escalation
    if (agentNode && sendMessageNode) {
        if (connections[agentNode.name]?.main?.[0]) {
            connections[agentNode.name].main[0] = connections[agentNode.name].main[0].filter(
                (c: any) => c.node !== sendMessageNode.name
            );
        }
        if (!connections[agentNode.name]) connections[agentNode.name] = { main: [[]] };
        if (!connections[agentNode.name].main[0]) connections[agentNode.name].main[0] = [];
        connections[agentNode.name].main[0].push({ node: '¿Es escalación?', type: 'main', index: 0 });

        connections['¿Es escalación?'] = {
            main: [
                [{ node: 'Extraer mensaje escalación', type: 'main', index: 0 }],
                [{ node: sendMessageNode.name, type: 'main', index: 0 }],
            ],
        };

        connections['Extraer mensaje escalación'] = {
            main: [[{ node: 'Enviar escalación', type: 'main', index: 0 }]],
        };

        console.log('✅ Updated connections for escalation flow');
    }

    // 9. PUT updated workflow
    console.log('📤 Uploading updated workflow...');
    // N8n API only accepts specific settings fields
    const allowedSettings: Record<string, any> = {};
    const src = workflow.settings ?? {};
    const allowedKeys = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'saveExecutionProgress', 'executionTimeout'];
    for (const key of allowedKeys) {
        if (key in src) allowedSettings[key] = src[key];
    }

    const updated = await fetchN8n(`/workflows/${WORKFLOW_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: workflow.name,
            nodes: workflow.nodes,
            connections: workflow.connections,
            settings: allowedSettings,
            staticData: workflow.staticData ?? null,
        }),
    });

    console.log(`\n🎉 Workflow updated successfully!`);
    console.log(`   Name: ${updated.name}`);
    console.log(`   Nodes: ${updated.nodes?.length}`);
    console.log(`\n⚠️  MANUAL STEPS REMAINING:`);
    console.log(`   1. Open: ${N8N_URL}/workflow/${WORKFLOW_ID}`);
    console.log(`   2. Set Phone Number ID in: "Avisar no media", "Send message", "Enviar escalación"`);
    console.log(`   3. Verify N8N_API_KEY_CRM matches VERCEL N8N_API_KEY env var`);
    console.log(`   4. Activate the workflow`);
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
