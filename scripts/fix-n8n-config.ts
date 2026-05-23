/**
 * Aplica configuración de credenciales y URLs al workflow n8n.
 * Ejecutar: N8N_API_KEY_PROD=<jwt> npx tsx scripts/fix-n8n-config.ts
 * Dry run:  N8N_API_KEY_PROD=<jwt> DRY_RUN=true npx tsx scripts/fix-n8n-config.ts
 *
 * Cambios aplicados:
 * 1. Fetch Context → URL correcta + x-api-key header
 * 2. Tool crear_reserva → URL correcta + x-api-key + customerPhone
 * 3. Elimina nodos huérfanos: ¿Tiene link? y Separar link
 */

const N8N_URL = 'https://n8n-production-9d890.up.railway.app';
const WORKFLOW_ID = 'lOXWAYlE0iDbBxcE';
const N8N_API_KEY = process.env.N8N_API_KEY_PROD;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!N8N_API_KEY) {
    console.error('❌ N8N_API_KEY_PROD env var required. Get it from n8n Settings → API → API Keys.');
    process.exit(1);
}

// x-api-key que n8n envía al CRM — mismo valor que N8N_API_KEY en Vercel/.env.local
const CRM_API_KEY = process.env.CRM_API_KEY || process.env.N8N_API_KEY || '';
if (!CRM_API_KEY) {
    console.error('❌ CRM_API_KEY (o N8N_API_KEY) env var required. Es el valor de N8N_API_KEY en Vercel.');
    process.exit(1);
}

// URLs de la aplicación
const APP_URL = 'https://www.medellintransportes.com';
const CONTEXTO_URL = `${APP_URL}/api/n8n/contexto-servicios`;
const CREAR_RESERVA_URL = `${APP_URL}/api/n8n/reservas/crear`;

async function fetchN8n(path: string, options: RequestInit = {}) {
    const res = await fetch(`${N8N_URL}/api/v1${path}`, {
        ...options,
        headers: {
            'X-N8N-API-KEY': N8N_API_KEY!,
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

    function findNode(predicate: (n: any) => boolean) {
        return nodes.find(predicate);
    }

    function removeNode(predicate: (n: any) => boolean): string | null {
        const idx = nodes.findIndex(predicate);
        if (idx === -1) return null;
        const name = nodes[idx].name;
        nodes.splice(idx, 1);
        delete connections[name];
        return name;
    }

    // ── 1. Fix Fetch Context ───────────────────────────────────────────────────
    const fetchContextNode = findNode((n) => n.name === 'Fetch Context');
    if (fetchContextNode) {
        fetchContextNode.parameters.url = CONTEXTO_URL;
        fetchContextNode.parameters.method = 'GET';
        fetchContextNode.parameters.sendHeaders = true;

        // Asegurar que existe headerParameters
        if (!fetchContextNode.parameters.headerParameters) {
            fetchContextNode.parameters.headerParameters = { parameters: [] };
        }
        const headers: any[] = fetchContextNode.parameters.headerParameters.parameters ?? [];

        // Agregar o actualizar x-api-key
        const apiKeyIdx = headers.findIndex((h: any) => h.name === 'x-api-key');
        if (apiKeyIdx !== -1) {
            headers[apiKeyIdx].value = CRM_API_KEY;
        } else {
            headers.push({ name: 'x-api-key', value: CRM_API_KEY });
        }

        console.log(`✅ Fetch Context → URL: ${CONTEXTO_URL}`);
        console.log(`✅ Fetch Context → x-api-key: ${CRM_API_KEY.slice(0, 8)}...`);
    } else {
        console.warn('⚠️  Fetch Context node not found');
    }

    // ── 2. Fix Tool crear_reserva ──────────────────────────────────────────────
    // La tool del AI Agent puede aparecer como nodo independiente en el array nodes
    // y también puede estar conectada via ai_tool connection type.
    // Buscamos por nombre y también por conexión ai_tool hacia el AI Agent.

    const agentNode = findNode((n: any) => n.type === '@n8n/n8n-nodes-langchain.agent');
    const agentName = agentNode?.name ?? 'AI Agent';

    // Encontrar todos los nodos conectados al AI Agent via ai_tool
    const toolNodeNames: string[] = [];
    for (const [nodeName, conn] of Object.entries(connections)) {
        const c = conn as any;
        if (c.ai_tool) {
            const targets = (c.ai_tool as any[][]).flat();
            if (targets.some((t: any) => t.node === agentName)) {
                toolNodeNames.push(nodeName);
            }
        }
    }
    console.log(`ℹ️  Tool nodes connected to AI Agent: [${toolNodeNames.join(', ') || 'none found'}]`);

    // También buscar por nombre común
    const toolNamesToSearch = ['Crear Reserva CRM', 'crear_reserva', 'Crear Reserva', 'HTTP Request Tool'];
    const toolNode =
        findNode((n) => toolNodeNames.includes(n.name)) ??
        findNode((n) => toolNamesToSearch.includes(n.name)) ??
        findNode((n) => n.type === 'n8n-nodes-base.httpRequest' && toolNodeNames.includes(n.name));

    if (toolNode) {
        toolNode.parameters.url = CREAR_RESERVA_URL;
        toolNode.parameters.method = 'POST';
        toolNode.parameters.sendHeaders = true;

        if (!toolNode.parameters.headerParameters) {
            toolNode.parameters.headerParameters = { parameters: [] };
        }
        const toolHeaders: any[] = toolNode.parameters.headerParameters.parameters ?? [];
        const toolApiKeyIdx = toolHeaders.findIndex((h: any) => h.name === 'x-api-key');
        if (toolApiKeyIdx !== -1) {
            toolHeaders[toolApiKeyIdx].value = CRM_API_KEY;
        } else {
            toolHeaders.push({ name: 'x-api-key', value: CRM_API_KEY });
        }

        // Actualizar whatsappCliente para que use Set datos mensaje
        const bodyParams = toolNode.parameters.bodyParameters?.parameters ?? [];
        const waIdx = bodyParams.findIndex((p: any) => p.name === 'whatsappCliente');
        if (waIdx !== -1) {
            bodyParams[waIdx].value = "={{ $('Set datos mensaje').item.json.customerPhone }}";
            console.log(`✅ Tool "${toolNode.name}" → whatsappCliente updated`);
        }

        console.log(`✅ Tool "${toolNode.name}" → URL: ${CREAR_RESERVA_URL}`);
        console.log(`✅ Tool "${toolNode.name}" → x-api-key: ${CRM_API_KEY.slice(0, 8)}...`);
    } else {
        console.warn('⚠️  Tool node (crear_reserva) not found in nodes array');
        console.warn('   It may only exist as a sub-node credential in AI Agent config.');
        console.warn('   Check AI Agent → Tool sub-node manually in n8n UI.');
    }

    // ── 3. Eliminar nodos huérfanos ────────────────────────────────────────────
    const orphans = ['¿Tiene link?', 'Separar link'];
    for (const name of orphans) {
        const removed = removeNode((n) => n.name === name);
        if (removed) console.log(`✅ Removed orphan node: ${removed}`);
        else console.warn(`⚠️  Orphan "${name}" not found (already removed?)`);
    }

    // ── 4. Limpiar conexiones que apuntan a nodos eliminados ──────────────────
    const nodeNames = new Set(nodes.map((n: any) => n.name));
    let staleCleaned = 0;
    for (const [, conn] of Object.entries(connections)) {
        for (const connType of ['main', 'ai_tool', 'ai_memory', 'ai_languageModel']) {
            if ((conn as any)[connType]) {
                const before = JSON.stringify((conn as any)[connType]);
                (conn as any)[connType] = ((conn as any)[connType] as any[][]).map((outputs: any[]) =>
                    outputs.filter((c: any) => !c.node || nodeNames.has(c.node))
                );
                if (JSON.stringify((conn as any)[connType]) !== before) staleCleaned++;
            }
        }
    }
    if (staleCleaned > 0) console.log(`✅ Cleaned ${staleCleaned} stale connection(s)`);

    // ── 5. Dry run summary ─────────────────────────────────────────────────────
    if (DRY_RUN) {
        console.log('\n📋 DRY RUN — Nodes after changes:');
        nodes.forEach((n: any) => console.log(`  ${n.name} (${n.type})`));
        return;
    }

    // ── 6. Push to n8n ─────────────────────────────────────────────────────────
    console.log('\n📤 Pushing updated workflow...');
    const updated = await fetchN8n(`/workflows/${WORKFLOW_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: workflow.name,
            nodes,
            connections,
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

    console.log(`\n🎉 Done! Nodes: ${updated.nodes?.length}`);
    console.log('\n📋 Pendiente (manual en n8n UI):');
    console.log('  1. Node "Variables globales": YCLOUD_API_KEY → tu API key de YCloud');
    console.log('  2. Node "Variables globales": NUMERO_EMPRESA → +57XXXXXXXXXX (tu número)');
    console.log('  3. AI Agent → Simple Memory → Session ID: verificar que usa customerPhone');
    console.log(`     Expresión: {{ $('Set datos mensaje').item.json.customerPhone }}`);
    if (!toolNode) {
        console.log('  4. Tool crear_reserva: configurar manualmente en AI Agent → Tool sub-node');
        console.log(`     URL: ${CREAR_RESERVA_URL}`);
        console.log(`     Header: x-api-key: ${CRM_API_KEY}`);
    }
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
