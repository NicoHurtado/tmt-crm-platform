/**
 * Crea el workflow completo de WhatsApp Bot con YCloud en n8n desde cero.
 * Ejecutar: npx tsx scripts/create-ycloud-workflow.ts
 * Dry run:  DRY_RUN=true npx tsx scripts/create-ycloud-workflow.ts
 *
 * Al terminar:
 * 1. Abrir el workflow en n8n UI
 * 2. En "Variables globales": poner YCLOUD_API_KEY y NUMERO_EMPRESA
 * 3. Activar el workflow
 * 4. Registrar el webhook en YCloud
 */

const N8N_URL = 'https://n8n-production-9d890.up.railway.app';
const OLD_WORKFLOW_ID = 'lOXWAYlE0iDbBxcE'; // para extraer la credential del modelo
const API_KEY = process.env.N8N_API_KEY_PROD ?? '';
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!API_KEY && !DRY_RUN) {
    // Allow dry run without key since it only fetches the old workflow for model info
    console.error('❌ N8N_API_KEY_PROD env var required.');
    console.error('   Get it from n8n Settings → API → API Keys.');
    process.exit(1);
}

const YCLOUD_API_URL = 'https://api.ycloud.com/v2/whatsapp/messages';
const CONTEXTO_URL = 'https://www.medellintransportes.com/api/public/servicios?formato=contexto';

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
        throw new Error(`N8n ${res.status}: ${body}`);
    }
    return res.json();
}

async function main() {
    // ── Extraer credential del modelo del workflow existente ──────────────────
    console.log('📥 Fetching existing workflow to extract model credential...');
    const oldWf = await fetchN8n(`/workflows/${OLD_WORKFLOW_ID}`);
    const modelNode = oldWf.nodes.find(
        (n: any) =>
            n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi' ||
            n.type === '@n8n/n8n-nodes-langchain.lmChatAnthropic'
    );
    const modelCredentials = modelNode?.credentials ?? {};
    const modelType = modelNode?.type ?? '@n8n/n8n-nodes-langchain.lmChatOpenAi';
    const modelParams = modelNode?.parameters ?? {};
    console.log(`✅ Model found: ${modelNode?.name ?? 'not found'} (${modelType})`);
    if (!modelNode) console.warn('⚠️  No model node found — you will need to add it manually in n8n UI');

    // ── Posiciones base ────────────────────────────────────────────────────────
    const S = 240; // step horizontal
    const Y = 300; // base Y

    // ── Definición de nodos ───────────────────────────────────────────────────

    // 1. Webhook
    const webhookNode = {
        id: 'n-webhook',
        name: 'YCloud Webhook',
        type: 'n8n-nodes-base.webhook',
        position: [80, Y],
        parameters: {
            httpMethod: 'POST',
            path: 'ycloud-whatsapp',
            responseMode: 'responseNode',
            options: {},
        },
        typeVersion: 2,
    };

    // 2. Respond to Webhook (inmediato — evita reintentos de YCloud)
    const respondNode = {
        id: 'n-respond',
        name: 'Responder 200 OK',
        type: 'n8n-nodes-base.respondToWebhook',
        position: [80 + S, Y],
        parameters: {
            respondWith: 'text',
            responseBody: 'OK',
            options: { responseCode: 200 },
        },
        typeVersion: 1,
    };

    // 3. Variables globales — placeholders que el operador reemplaza en la UI
    const globalVarsNode = {
        id: 'n-globals',
        name: 'Variables globales',
        type: 'n8n-nodes-base.set',
        position: [80 + S * 2, Y],
        parameters: {
            mode: 'manual',
            assignments: {
                assignments: [
                    { id: 'g1', name: 'YCLOUD_API_KEY', value: 'PEGAR_API_KEY_DE_YCLOUD', type: 'string' },
                    { id: 'g2', name: 'NUMERO_EMPRESA', value: '+57XXXXXXXXXX', type: 'string' },
                ],
            },
            options: {},
        },
        typeVersion: 3.4,
    };

    // 4. Anti-bucle — ignora mensajes que el propio bot envía al canal
    const antiLoopNode = {
        id: 'n-antiloop',
        name: 'Filtro anti-bucle',
        type: 'n8n-nodes-base.if',
        position: [80 + S * 3, Y],
        parameters: {
            conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [
                    {
                        id: 'c1',
                        leftValue: "={{ $json.whatsappInboundMessage.from }}",
                        rightValue: "={{ $('Variables globales').item.json.NUMERO_EMPRESA }}",
                        operator: { type: 'string', operation: 'notEquals' },
                    },
                ],
                combinator: 'and',
            },
        },
        typeVersion: 2,
    };

    // 5. Filtro tipo texto — solo procesa mensajes de texto, deriva media a aviso
    const textFilterNode = {
        id: 'n-textfilter',
        name: 'Filtro tipo texto',
        type: 'n8n-nodes-base.if',
        position: [80 + S * 4, Y],
        parameters: {
            conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [
                    {
                        id: 'c2',
                        leftValue: "={{ $json.whatsappInboundMessage.type }}",
                        rightValue: 'text',
                        operator: { type: 'string', operation: 'equals' },
                    },
                ],
                combinator: 'and',
            },
        },
        typeVersion: 2,
    };

    // 6. Set datos mensaje — normaliza el payload de YCloud
    const setDatosNode = {
        id: 'n-setdatos',
        name: 'Set datos mensaje',
        type: 'n8n-nodes-base.set',
        position: [80 + S * 5, Y],
        parameters: {
            mode: 'manual',
            assignments: {
                assignments: [
                    { id: 'd1', name: 'customerPhone', value: "={{ $json.whatsappInboundMessage.from }}", type: 'string' },
                    { id: 'd2', name: 'customerName', value: "={{ $json.whatsappInboundMessage.customerProfile?.name ?? '' }}", type: 'string' },
                    { id: 'd3', name: 'messageText', value: "={{ $json.whatsappInboundMessage.text.body }}", type: 'string' },
                    { id: 'd4', name: 'messageId', value: "={{ $json.whatsappInboundMessage.id }}", type: 'string' },
                    { id: 'd5', name: 'toPhone', value: "={{ $json.whatsappInboundMessage.to }}", type: 'string' },
                ],
            },
            options: {},
        },
        typeVersion: 3.4,
    };

    // 7. Fetch Contexto — GET público, sin auth, 5-min cache en la app
    // Devuelve: { systemPrompt, contenido, totalServicios, actualizadoEn }
    const fetchContextoNode = {
        id: 'n-fetchctx',
        name: 'Fetch Contexto',
        type: 'n8n-nodes-base.httpRequest',
        position: [80 + S * 6, Y],
        parameters: {
            method: 'GET',
            url: CONTEXTO_URL,
            options: {},
        },
        typeVersion: 4.2,
    };

    // 8. AI Agent (Mía) — system message y input vienen de nodos anteriores
    const agentNode = {
        id: 'n-agent',
        name: 'Mía AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        position: [80 + S * 7, Y],
        parameters: {
            promptType: 'define',
            text: "={{ $('Set datos mensaje').item.json.messageText }}",
            options: {
                systemMessage: "={{ $('Fetch Contexto').item.json.systemPrompt }}",
            },
        },
        typeVersion: 1.7,
    };

    // 8a. Modelo de lenguaje — reutiliza credenciales del workflow existente
    const modelNodeNew = {
        id: 'n-model',
        name: modelNode?.name ?? 'Modelo LLM',
        type: modelType,
        position: [80 + S * 7, Y + 200],
        parameters: modelParams,
        credentials: modelCredentials,
        typeVersion: modelNode?.typeVersion ?? 1,
    };

    // 8b. Memoria por cliente — session key = número de teléfono
    const memoryNode = {
        id: 'n-memory',
        name: 'Simple Memory',
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        position: [80 + S * 7 + 140, Y + 200],
        parameters: {
            sessionIdType: 'customKey',
            sessionKey: "={{ $('Set datos mensaje').item.json.customerPhone }}",
            contextWindowLength: 20,
        },
        typeVersion: 1.3,
    };

    // 9. Detección de escalación — el agente incluye ESCALACION_REQUERIDA en su output
    const escIfNode = {
        id: 'n-escif',
        name: '¿Es escalación?',
        type: 'n8n-nodes-base.if',
        position: [80 + S * 8, Y],
        parameters: {
            conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [
                    {
                        id: 'c3',
                        leftValue: "={{ $json.output }}",
                        rightValue: 'ESCALACION_REQUERIDA',
                        operator: { type: 'string', operation: 'contains' },
                    },
                ],
                combinator: 'and',
            },
        },
        typeVersion: 2,
    };

    // 10. Extrae mensaje para cliente (quita línea ESCALACION_REQUERIDA:...)
    const extractEscNode = {
        id: 'n-extract',
        name: 'Extraer mensaje escalación',
        type: 'n8n-nodes-base.code',
        position: [80 + S * 9, Y - 120],
        parameters: {
            jsCode: `const output = $input.first().json.output || '';
const lines = output.split('\\n');
const mensaje = lines.slice(1).join('\\n').trim() ||
  'Voy a conectarte con un asesor de TMT Travel que podrá ayudarte mejor. Te contactarán muy pronto 👤';
return [{ json: { mensaje } }];`,
        },
        typeVersion: 2,
    };

    // 11. Envía mensaje de escalación al cliente via YCloud
    const sendEscNode = {
        id: 'n-sendesc',
        name: 'Enviar escalación',
        type: 'n8n-nodes-base.httpRequest',
        position: [80 + S * 10, Y - 120],
        parameters: {
            method: 'POST',
            url: YCLOUD_API_URL,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    { name: 'X-API-Key', value: "={{ $('Variables globales').item.json.YCLOUD_API_KEY }}" },
                ],
            },
            sendBody: true,
            specifyBody: 'json',
            jsonBody: JSON.stringify({
                from: "={{ $('Variables globales').item.json.NUMERO_EMPRESA }}",
                to: "={{ $('Set datos mensaje').item.json.customerPhone }}",
                type: 'text',
                text: { body: "={{ $json.mensaje }}" },
            }),
        },
        typeVersion: 4.2,
    };

    // 12. Envía respuesta normal del bot al cliente via YCloud
    const sendMsgNode = {
        id: 'n-sendmsg',
        name: 'Enviar respuesta',
        type: 'n8n-nodes-base.httpRequest',
        position: [80 + S * 9, Y + 80],
        parameters: {
            method: 'POST',
            url: YCLOUD_API_URL,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    { name: 'X-API-Key', value: "={{ $('Variables globales').item.json.YCLOUD_API_KEY }}" },
                ],
            },
            sendBody: true,
            specifyBody: 'json',
            jsonBody: JSON.stringify({
                from: "={{ $('Variables globales').item.json.NUMERO_EMPRESA }}",
                to: "={{ $('Set datos mensaje').item.json.customerPhone }}",
                type: 'text',
                text: { body: "={{ $json.output }}" },
            }),
        },
        typeVersion: 4.2,
    };

    // 13. Aviso al cliente cuando manda audio/imagen (no soportado)
    const noMediaNode = {
        id: 'n-nomedia',
        name: 'Avisar no media',
        type: 'n8n-nodes-base.httpRequest',
        position: [80 + S * 5, Y + 200],
        parameters: {
            method: 'POST',
            url: YCLOUD_API_URL,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    { name: 'X-API-Key', value: "={{ $('Variables globales').item.json.YCLOUD_API_KEY }}" },
                ],
            },
            sendBody: true,
            specifyBody: 'json',
            jsonBody: JSON.stringify({
                from: "={{ $('Variables globales').item.json.NUMERO_EMPRESA }}",
                to: "={{ $json.whatsappInboundMessage.from }}",
                type: 'text',
                text: {
                    body: "={{ $json.whatsappInboundMessage.type === 'audio' ? '¡Hola! 👋 No puedo escuchar audios por este canal. Por favor escríbeme tu mensaje y con gusto te ayudo 😊' : '¡Hola! 👋 Por este canal solo puedo recibir mensajes de texto. Cuéntame en qué te puedo ayudar 😊' }}",
                },
            }),
        },
        typeVersion: 4.2,
    };

    // ── Lista de nodos ─────────────────────────────────────────────────────────
    const nodes = [
        webhookNode, respondNode, globalVarsNode, antiLoopNode, textFilterNode,
        setDatosNode, fetchContextoNode, agentNode, modelNodeNew, memoryNode,
        escIfNode, extractEscNode, sendEscNode, sendMsgNode, noMediaNode,
    ];

    // ── Conexiones ─────────────────────────────────────────────────────────────
    const connections: Record<string, any> = {
        'YCloud Webhook': { main: [[{ node: 'Responder 200 OK', type: 'main', index: 0 }]] },
        'Responder 200 OK': { main: [[{ node: 'Variables globales', type: 'main', index: 0 }]] },
        'Variables globales': { main: [[{ node: 'Filtro anti-bucle', type: 'main', index: 0 }]] },
        'Filtro anti-bucle': {
            main: [
                [{ node: 'Filtro tipo texto', type: 'main', index: 0 }], // TRUE: es cliente externo
                [],                                                       // FALSE: es el bot → ignorar
            ],
        },
        'Filtro tipo texto': {
            main: [
                [{ node: 'Set datos mensaje', type: 'main', index: 0 }], // TRUE: es texto
                [{ node: 'Avisar no media', type: 'main', index: 0 }],  // FALSE: es media
            ],
        },
        'Set datos mensaje': { main: [[{ node: 'Fetch Contexto', type: 'main', index: 0 }]] },
        'Fetch Contexto': { main: [[{ node: 'Mía AI Agent', type: 'main', index: 0 }]] },
        'Mía AI Agent': { main: [[{ node: '¿Es escalación?', type: 'main', index: 0 }]] },
        '¿Es escalación?': {
            main: [
                [{ node: 'Extraer mensaje escalación', type: 'main', index: 0 }], // TRUE
                [{ node: 'Enviar respuesta', type: 'main', index: 0 }],           // FALSE
            ],
        },
        'Extraer mensaje escalación': { main: [[{ node: 'Enviar escalación', type: 'main', index: 0 }]] },
        // Sub-nodos AI Agent
        [modelNodeNew.name]: {
            ai_languageModel: [[{ node: 'Mía AI Agent', type: 'ai_languageModel', index: 0 }]],
        },
        'Simple Memory': {
            ai_memory: [[{ node: 'Mía AI Agent', type: 'ai_memory', index: 0 }]],
        },
    };

    // ── Dry run ────────────────────────────────────────────────────────────────
    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN — workflow will NOT be created\n');
        console.log('📋 Nodes que se crearían:');
        nodes.forEach((n) => console.log(`  ${n.name} (${n.type})`));
        console.log('\n📋 Connections:');
        Object.entries(connections).forEach(([from, conn]) => {
            for (const type of ['main', 'ai_languageModel', 'ai_memory']) {
                const targets = ((conn as any)[type] ?? []).flat().map((c: any) => c.node).filter(Boolean);
                if (targets.length) console.log(`  ${from} --[${type}]--> ${targets.join(', ')}`);
            }
        });
        return;
    }

    // ── Crear workflow ─────────────────────────────────────────────────────────
    console.log('\n📤 Creating new workflow...');
    const created = await fetchN8n('/workflows', {
        method: 'POST',
        body: JSON.stringify({
            name: 'TMT Travel - WhatsApp Bot YCloud',
            nodes,
            connections,
            settings: { executionOrder: 'v1' },
            staticData: null,
        }),
    });

    const newId = created.id;
    console.log(`\n🎉 Workflow created! ID: ${newId}`);
    console.log(`   Open: ${N8N_URL}/workflow/${newId}`);
    console.log('\n📋 PASOS FINALES (manual en n8n UI):');
    console.log('  1. Abrir el workflow en el link de arriba');
    console.log('  2. Nodo "Variables globales":');
    console.log('     - YCLOUD_API_KEY → tu API key de YCloud (Dashboard → Developer → API Keys)');
    console.log('     - NUMERO_EMPRESA → +57XXXXXXXXXX (tu número WhatsApp Business)');
    console.log('  3. Verificar que el modelo LLM tiene sus credenciales configuradas');
    console.log('     (el nodo del modelo debe estar conectado al AI Agent sin error rojo)');
    console.log('  4. Activar el workflow (toggle ON)');
    console.log(`  5. Registrar webhook en YCloud:`);
    console.log(`     URL: ${N8N_URL}/webhook/ycloud-whatsapp`);
    console.log(`     Event: whatsapp.inbound_message.received`);
    console.log('\n  ⚠️  Desactivar el workflow anterior para evitar duplicados:');
    console.log(`     ${N8N_URL}/workflow/${OLD_WORKFLOW_ID}`);
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
