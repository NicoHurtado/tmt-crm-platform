/**
 * Migra el workflow n8n de Meta WhatsApp Trigger a YCloud Webhook.
 * Ejecutar: npx tsx scripts/migrate-n8n-ycloud.ts
 * Dry run:  DRY_RUN=true npx tsx scripts/migrate-n8n-ycloud.ts
 *
 * Prerequisito: tener cuenta YCloud creada. Los valores de YCLOUD_API_KEY
 * y NUMERO_EMPRESA son placeholders — se reemplazan en n8n UI después.
 */

const N8N_URL = 'https://n8n-production-9d890.up.railway.app';
const WORKFLOW_ID = 'lOXWAYlE0iDbBxcE';
const N8N_API_KEY = process.env.N8N_API_KEY_PROD;
if (!N8N_API_KEY) {
    console.error('❌ N8N_API_KEY_PROD env var is required. Get it from n8n Settings → API → API Keys.');
    process.exit(1);
}
const DRY_RUN = process.env.DRY_RUN === 'true';
const YCLOUD_API_URL = 'https://api.ycloud.com/v2/whatsapp/messages';

// Placeholders — rellenar en n8n UI después de crear cuenta YCloud
const YCLOUD_API_KEY_PLACEHOLDER = 'YCLOUD_API_KEY_PLACEHOLDER';
const NUMERO_EMPRESA_PLACEHOLDER = '+57XXXXXXXXXX';

async function fetchN8n(path: string, options: RequestInit = {}) {
    const res = await fetch(`${N8N_URL}/api/v1${path}`, {
        ...options,
        headers: {
            'X-N8N-API-KEY': N8N_API_KEY,
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
    console.log(`📥 Fetching workflow ${WORKFLOW_ID}...`);
    const workflow = await fetchN8n(`/workflows/${WORKFLOW_ID}`);
    console.log(`✅ Got: "${workflow.name}" (${workflow.nodes.length} nodes)`);
    if (DRY_RUN) console.log('⚠️  DRY RUN — changes will NOT be pushed\n');

    const nodes: any[] = [...workflow.nodes];
    const connections: Record<string, any> = { ...workflow.connections };

    function removeNode(predicate: (n: any) => boolean): string | null {
        const idx = nodes.findIndex(predicate);
        if (idx === -1) return null;
        const name = nodes[idx].name;
        nodes.splice(idx, 1);
        delete connections[name];
        return name;
    }

    function findNode(predicate: (n: any) => boolean) {
        return nodes.find(predicate);
    }

    // ── 1. Eliminar trigger viejo (WhatsApp Trigger o Chat Trigger) ────────────
    const triggerTypes = [
        'n8n-nodes-base.whatsAppTrigger',
        '@n8n/n8n-nodes-langchain.chatTrigger',
        'n8n-nodes-base.whatsApp',
    ];
    let removedTrigger: string | null = null;
    for (const type of triggerTypes) {
        // Only remove if it's the trigger (not a send node)
        removedTrigger = removeNode(
            (n) => n.type === type && !n.parameters?.operation
        );
        if (removedTrigger) {
            console.log(`✅ Removed old trigger: ${removedTrigger}`);
            break;
        }
    }
    if (!removedTrigger) console.warn('⚠️  No known trigger type found — check manually');

    // ── 2. Eliminar nodos de envío WhatsApp (serán reemplazados por HTTP Request) ─
    const sendNodesToRemove = ['Send message', 'Avisar no media', 'Enviar escalación'];
    for (const name of sendNodesToRemove) {
        const removed = removeNode((n) => n.name === name);
        if (removed) console.log(`✅ Removed WhatsApp send node: ${removed}`);
        else console.warn(`⚠️  Node not found: "${name}" — check n8n UI for correct name`);
    }
    // Por si quedan otros nodos WhatsApp de tipo send
    const extraWaNodes = nodes.filter(
        (n) => n.type === 'n8n-nodes-base.whatsApp' && n.parameters?.operation === 'send'
    );
    for (const n of extraWaNodes) {
        removeNode((node: any) => node.id === n.id);
        console.log(`✅ Removed extra WhatsApp send: ${n.name}`);
    }

    // ── 3. Eliminar IF "¿Es texto?" — capturar su target TRUE antes de borrarlo ─
    // El target TRUE de ¿Es texto? es el primer nodo de la cadena de contexto
    // (Fetch Context o similar). Set datos mensaje debe conectar a ese nodo.
    let firstContextNodeName: string | null = null;
    const textIfConns = connections['¿Es texto?'];
    if (textIfConns?.main?.[0]?.[0]?.node) {
        firstContextNodeName = textIfConns.main[0][0].node;
        console.log(`ℹ️  Old text filter TRUE target captured: "${firstContextNodeName}"`);
    }
    const removedTextIf = removeNode((n) => n.name === '¿Es texto?');
    if (removedTextIf) console.log(`✅ Removed old text IF: ${removedTextIf}`);

    // ── Referencias a nodos existentes que se mantienen ───────────────────────
    const agentNode = findNode((n: any) => n.type === '@n8n/n8n-nodes-langchain.agent');
    const escIfNode = findNode((n: any) => n.name === '¿Es escalación?');
    const extractNode = findNode((n: any) => n.name === 'Extraer mensaje escalación');

    const baseX = 80;
    const baseY = 288;
    const step = 220;

    // ── 4. Crear nodos nuevos ─────────────────────────────────────────────────

    const webhookNode = {
        id: 'ycloud-webhook-001',
        name: 'YCloud WhatsApp Webhook',
        type: 'n8n-nodes-base.webhook',
        position: [baseX, baseY],
        parameters: {
            httpMethod: 'POST',
            path: 'ycloud-whatsapp',
            responseMode: 'responseNode',
            options: {},
        },
        typeVersion: 2,
    };

    const respondNode = {
        id: 'respond-webhook-001',
        name: 'Responder 200 OK',
        type: 'n8n-nodes-base.respondToWebhook',
        position: [baseX + step, baseY],
        parameters: {
            respondWith: 'text',
            responseBody: 'OK',
            options: { responseCode: 200 },
        },
        typeVersion: 1,
    };

    const globalVarsNode = {
        id: 'set-global-vars-001',
        name: 'Variables globales',
        type: 'n8n-nodes-base.set',
        position: [baseX + step * 2, baseY],
        parameters: {
            mode: 'manual',
            assignments: {
                assignments: [
                    {
                        id: 'gv-1',
                        name: 'YCLOUD_API_KEY',
                        value: YCLOUD_API_KEY_PLACEHOLDER,
                        type: 'string',
                    },
                    {
                        id: 'gv-2',
                        name: 'NUMERO_EMPRESA',
                        value: NUMERO_EMPRESA_PLACEHOLDER,
                        type: 'string',
                    },
                ],
            },
            options: {},
        },
        typeVersion: 3.4,
    };

    const antiLoopNode = {
        id: 'if-antiloop-001',
        name: 'Filtro anti-bucle',
        type: 'n8n-nodes-base.if',
        position: [baseX + step * 3, baseY],
        parameters: {
            conditions: {
                options: {
                    caseSensitive: true,
                    leftValue: '',
                    typeValidation: 'strict',
                    version: 2,
                },
                conditions: [
                    {
                        id: 'al-cond-001',
                        leftValue: "={{ $json.body.whatsappInboundMessage.from }}",
                        rightValue: "={{ $('Variables globales').item.json.NUMERO_EMPRESA }}",
                        operator: { type: 'string', operation: 'notEquals' },
                    },
                ],
                combinator: 'and',
            },
        },
        typeVersion: 2,
    };

    const textFilterNode = {
        id: 'if-text-001',
        name: 'Filtro tipo texto',
        type: 'n8n-nodes-base.if',
        position: [baseX + step * 4, baseY],
        parameters: {
            conditions: {
                options: {
                    caseSensitive: true,
                    leftValue: '',
                    typeValidation: 'strict',
                    version: 2,
                },
                conditions: [
                    {
                        id: 'tf-cond-001',
                        leftValue: "={{ $json.body.whatsappInboundMessage.type }}",
                        rightValue: 'text',
                        operator: { type: 'string', operation: 'equals' },
                    },
                ],
                combinator: 'and',
            },
        },
        typeVersion: 2,
    };

    const setDatosMensajeNode = {
        id: 'set-datos-mensaje-001',
        name: 'Set datos mensaje',
        type: 'n8n-nodes-base.set',
        position: [baseX + step * 5, baseY],
        parameters: {
            mode: 'manual',
            assignments: {
                assignments: [
                    {
                        id: 'dm-1',
                        name: 'customerPhone',
                        value: "={{ $json.body.whatsappInboundMessage.from }}",
                        type: 'string',
                    },
                    {
                        id: 'dm-2',
                        name: 'customerName',
                        value: "={{ $json.body.whatsappInboundMessage.customerProfile.name ?? '' }}",
                        type: 'string',
                    },
                    {
                        id: 'dm-3',
                        name: 'messageText',
                        value: "={{ $json.body.whatsappInboundMessage.text.body }}",
                        type: 'string',
                    },
                    {
                        id: 'dm-4',
                        name: 'messageId',
                        value: "={{ $json.body.whatsappInboundMessage.id }}",
                        type: 'string',
                    },
                    {
                        id: 'dm-5',
                        name: 'toPhone',
                        value: "={{ $json.body.whatsappInboundMessage.to }}",
                        type: 'string',
                    },
                ],
            },
            options: {},
        },
        typeVersion: 3.4,
    };

    // HTTP Request: enviar mensaje normal (reemplaza "Send message")
    const agentPos: [number, number] = agentNode?.position ?? [baseX + step * 6, baseY];
    const httpSendMessage = {
        id: 'http-send-message-001',
        name: 'Enviar mensaje',
        type: 'n8n-nodes-base.httpRequest',
        position: [agentPos[0] + step, agentPos[1] + 120],
        parameters: {
            method: 'POST',
            url: YCLOUD_API_URL,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    {
                        name: 'X-API-Key',
                        value: "={{ $('Variables globales').item.json.YCLOUD_API_KEY }}",
                    },
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

    // HTTP Request: avisar que no acepta media (reemplaza "Avisar no media")
    const httpAvisarNoMedia = {
        id: 'http-avisar-no-media-001',
        name: 'Avisar no media',
        type: 'n8n-nodes-base.httpRequest',
        position: [baseX + step * 4, baseY + 220],
        parameters: {
            method: 'POST',
            url: YCLOUD_API_URL,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    {
                        name: 'X-API-Key',
                        value: "={{ $('Variables globales').item.json.YCLOUD_API_KEY }}",
                    },
                ],
            },
            sendBody: true,
            specifyBody: 'json',
            jsonBody: JSON.stringify({
                from: "={{ $('Variables globales').item.json.NUMERO_EMPRESA }}",
                to: "={{ $json.body.whatsappInboundMessage.from }}",
                type: 'text',
                text: {
                    body: "={{ $json.body.whatsappInboundMessage.type === 'audio' ? '¡Hola! 👋 No puedo escuchar audios por este canal. Por favor escríbeme tu mensaje y con gusto te ayudo 😊' : '¡Hola! 👋 Por este canal solo puedo recibir mensajes de texto. Si tienes una imagen o documento, descríbeme lo que necesitas 📝' }}",
                },
            }),
        },
        typeVersion: 4.2,
    };

    // HTTP Request: enviar escalación (reemplaza "Enviar escalación")
    const extractPos: [number, number] = extractNode?.position ?? [agentPos[0] + step * 2, agentPos[1] - 120];
    const httpEnviarEscalacion = {
        id: 'http-enviar-escalacion-001',
        name: 'Enviar escalación',
        type: 'n8n-nodes-base.httpRequest',
        position: [extractPos[0] + step, extractPos[1]],
        parameters: {
            method: 'POST',
            url: YCLOUD_API_URL,
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    {
                        name: 'X-API-Key',
                        value: "={{ $('Variables globales').item.json.YCLOUD_API_KEY }}",
                    },
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

    // Error Trigger: visibilidad de fallos
    const errorTriggerNode = {
        id: 'error-trigger-001',
        name: 'Error Trigger',
        type: 'n8n-nodes-base.errorTrigger',
        position: [baseX, baseY + 450],
        parameters: {},
        typeVersion: 1,
    };

    nodes.push(
        webhookNode,
        respondNode,
        globalVarsNode,
        antiLoopNode,
        textFilterNode,
        setDatosMensajeNode,
        httpSendMessage,
        httpAvisarNoMedia,
        httpEnviarEscalacion,
        errorTriggerNode
    );
    console.log('✅ Added 10 new nodes');

    // ── 5. Actualizar referencias de variables en nodos existentes ─────────────

    // Crear Reserva CRM: whatsappCliente → customerPhone del Set normalizado
    const toolNode = findNode((n: any) => n.name === 'Crear Reserva CRM');
    if (toolNode?.parameters?.bodyParameters?.parameters) {
        const params = toolNode.parameters.bodyParameters.parameters;
        const waIdx = params.findIndex((p: any) => p.name === 'whatsappCliente');
        if (waIdx !== -1) {
            params[waIdx].value = "={{ $('Set datos mensaje').item.json.customerPhone }}";
            console.log('✅ Updated whatsappCliente in Crear Reserva CRM');
        }
    } else if (toolNode) {
        console.warn('⚠️  Crear Reserva CRM found but bodyParameters structure is different — check manually');
    } else {
        console.warn('⚠️  Crear Reserva CRM node not found');
    }

    // AI Agent: si tiene el mensaje hardcodeado como expresión, actualizar
    if (agentNode?.parameters?.promptType === 'define' && agentNode.parameters?.text) {
        agentNode.parameters.text = "={{ $('Set datos mensaje').item.json.messageText }}";
        console.log('✅ Updated AI Agent input expression to use messageText');
    }

    // ── 6. Reconstruir conexiones ──────────────────────────────────────────────

    // Mantener conexiones internas del AI Agent (subgraph: modelo, memoria, tools)
    const newConnections: Record<string, any> = {};
    for (const [name, conn] of Object.entries(connections)) {
        const nodeStillExists = nodes.find((n: any) => n.name === name);
        if (nodeStillExists) newConnections[name] = conn;
    }

    // Webhook → Responder 200 OK
    newConnections['YCloud WhatsApp Webhook'] = {
        main: [[{ node: 'Responder 200 OK', type: 'main', index: 0 }]],
    };

    // Responder 200 OK → Variables globales
    newConnections['Responder 200 OK'] = {
        main: [[{ node: 'Variables globales', type: 'main', index: 0 }]],
    };

    // Variables globales → Filtro anti-bucle
    newConnections['Variables globales'] = {
        main: [[{ node: 'Filtro anti-bucle', type: 'main', index: 0 }]],
    };

    // Filtro anti-bucle: TRUE(0)→ Filtro tipo texto | FALSE(1)→ [nada]
    newConnections['Filtro anti-bucle'] = {
        main: [
            [{ node: 'Filtro tipo texto', type: 'main', index: 0 }],
            [],
        ],
    };

    // Filtro tipo texto: TRUE(0)→ Set datos mensaje | FALSE(1)→ Avisar no media
    newConnections['Filtro tipo texto'] = {
        main: [
            [{ node: 'Set datos mensaje', type: 'main', index: 0 }],
            [{ node: 'Avisar no media', type: 'main', index: 0 }],
        ],
    };

    // Set datos mensaje → primer nodo de la cadena de contexto (o AI Agent si no hay cadena)
    // firstContextNodeName capturado del target TRUE de ¿Es texto? antes de borrarlo
    const setDatosMensajeTarget = firstContextNodeName ?? agentNode?.name ?? 'AI Agent';
    newConnections['Set datos mensaje'] = {
        main: [[{ node: setDatosMensajeTarget, type: 'main', index: 0 }]],
    };
    console.log(`ℹ️  Set datos mensaje → ${setDatosMensajeTarget}`);

    if (agentNode) {

        if (escIfNode) {
            // AI Agent → ¿Es escalación?
            // Preservar conexiones de sub-nodos (modelo, memoria, tools) del AI Agent
            const agentExistingConns = newConnections[agentNode.name] ?? {};
            newConnections[agentNode.name] = {
                ...agentExistingConns,
                main: [[{ node: escIfNode.name, type: 'main', index: 0 }]],
            };

            // ¿Es escalación? TRUE→ Extraer mensaje | FALSE→ Enviar mensaje
            if (extractNode) {
                newConnections[escIfNode.name] = {
                    main: [
                        [{ node: 'Extraer mensaje escalación', type: 'main', index: 0 }],
                        [{ node: 'Enviar mensaje', type: 'main', index: 0 }],
                    ],
                };
                // Extraer mensaje → Enviar escalación
                newConnections['Extraer mensaje escalación'] = {
                    main: [[{ node: 'Enviar escalación', type: 'main', index: 0 }]],
                };
            } else {
                newConnections[escIfNode.name] = {
                    main: [
                        [],
                        [{ node: 'Enviar mensaje', type: 'main', index: 0 }],
                    ],
                };
            }
        } else {
            // Sin nodo de escalación: AI Agent → Enviar mensaje directamente
            const agentExistingConns = newConnections[agentNode.name] ?? {};
            newConnections[agentNode.name] = {
                ...agentExistingConns,
                main: [[{ node: 'Enviar mensaje', type: 'main', index: 0 }]],
            };
        }
    } else {
        console.warn('⚠️  AI Agent node not found — Set datos mensaje has no downstream connection');
    }

    // ── 6b. Limpiar conexiones que apuntan a nodos eliminados ─────────────────
    const nodeNames = new Set(nodes.map((n: any) => n.name));
    let staleCleaned = 0;
    for (const [, conn] of Object.entries(newConnections)) {
        if ((conn as any).main) {
            const before = JSON.stringify((conn as any).main);
            (conn as any).main = ((conn as any).main as any[][]).map((outputs: any[]) =>
                outputs.filter((c: any) => !c.node || nodeNames.has(c.node))
            );
            if (JSON.stringify((conn as any).main) !== before) staleCleaned++;
        }
    }
    if (staleCleaned > 0) console.log(`✅ Cleaned ${staleCleaned} stale connection(s) pointing to deleted nodes`);

    console.log('✅ Rebuilt all connections');

    // ── 7. Push a n8n ──────────────────────────────────────────────────────────
    if (DRY_RUN) {
        console.log('\n📋 DRY RUN — Final node list:');
        nodes.forEach((n: any) => console.log(`  ${n.name} (${n.type})`));
        console.log('\n📋 Connections summary:');
        Object.entries(newConnections).forEach(([from, conn]) => {
            const targets = ((conn as any).main ?? [])
                .flat()
                .map((c: any) => c.node)
                .filter(Boolean)
                .join(', ');
            if (targets) console.log(`  ${from} → ${targets}`);
        });
        return;
    }

    console.log('📤 Pushing updated workflow...');
    const updated = await fetchN8n(`/workflows/${WORKFLOW_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: workflow.name,
            nodes,
            connections: newConnections,
            // Only pass known-valid settings keys — n8n API rejects unknown properties
            settings: {
                ...(workflow.settings?.executionOrder !== undefined && { executionOrder: workflow.settings.executionOrder }),
                ...(workflow.settings?.saveManualExecutions !== undefined && { saveManualExecutions: workflow.settings.saveManualExecutions }),
                ...(workflow.settings?.callerPolicy !== undefined && { callerPolicy: workflow.settings.callerPolicy }),
                ...(workflow.settings?.errorWorkflow !== undefined && { errorWorkflow: workflow.settings.errorWorkflow }),
                ...(workflow.settings?.timezone !== undefined && { timezone: workflow.settings.timezone }),
            },
            staticData: workflow.staticData ?? null,
        }),
    });

    console.log(`\n🎉 Migration complete! Nodes: ${updated.nodes?.length}`);
    console.log('\n📋 NEXT STEPS (manual, after YCloud account):');
    console.log(`  1. Open: ${N8N_URL}/workflow/${WORKFLOW_ID}`);
    console.log('  2. Node "Variables globales": set YCLOUD_API_KEY = tu API key de YCloud');
    console.log('  3. Node "Variables globales": set NUMERO_EMPRESA = +57XXXXXXXXXX');
    console.log('  4. AI Agent → Memory sub-node: verificar que session ID usa customerPhone');
    console.log(`  5. Register webhook in YCloud: ${N8N_URL}/webhook/ycloud-whatsapp`);
    console.log('     Event: whatsapp.inbound_message.received');
    console.log('  6. Activate the workflow (toggle en n8n UI)');
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
