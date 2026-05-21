/**
 * Wires a "Fetch Context" HTTP Request node into the N8n WhatsApp bot workflow.
 * The node calls GET /api/n8n/contexto-servicios and feeds its systemPrompt
 * into the AI Agent's systemMessage parameter.
 *
 * Run with:
 * N8N_BASE_URL=https://n8n-production-9d890.up.railway.app \
 * N8N_API_KEY=<key> \
 * npx ts-node --project tsconfig.json scripts/update-n8n-dynamic-context.ts
 */

const N8N_URL = process.env.N8N_BASE_URL || 'https://n8n-production-9d890.up.railway.app';
const WORKFLOW_ID = 'lOXWAYlE0iDbBxcE';
const API_KEY = process.env.N8N_API_KEY!;
if (!API_KEY) {
    console.error('N8N_API_KEY env var is required');
    process.exit(1);
}

const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';

const FETCH_CONTEXT_NODE_NAME = 'Fetch Context';

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

    // Idempotency guard
    const alreadyExists = nodes.find((n: any) => n.name === FETCH_CONTEXT_NODE_NAME);
    if (alreadyExists) {
        console.log('✅ Already up to date — "Fetch Context" node already exists. Exiting.');
        process.exit(0);
    }

    // Find AI Agent node
    const agentNode = nodes.find(
        (n: any) =>
            n.name === 'AI Agent' ||
            n.type === '@n8n/n8n-nodes-langchain.agent'
    );
    if (!agentNode) {
        throw new Error('AI Agent node not found in workflow. Check node names in N8n.');
    }
    console.log(`✅ Found AI Agent node: "${agentNode.name}" at position [${agentNode.position}]`);

    // Position Fetch Context node 250px to the left of the AI Agent
    const agentPos: [number, number] = agentNode.position ?? [80, 288];
    const fetchContextPos: [number, number] = [agentPos[0] - 250, agentPos[1]];

    // Build the HTTP Request node
    const fetchContextNode: any = {
        id: crypto.randomUUID(),
        name: FETCH_CONTEXT_NODE_NAME,
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: fetchContextPos,
        parameters: {
            method: 'GET',
            url: `${APP_URL}/api/n8n/contexto-servicios`,
            authentication: 'none',
            sendHeaders: true,
            headerParameters: {
                parameters: [
                    {
                        name: 'x-api-key',
                        value: '={{ $env.N8N_API_KEY }}',
                    },
                ],
            },
            options: {},
        },
    };

    nodes.push(fetchContextNode);
    console.log(`✅ Added "${FETCH_CONTEXT_NODE_NAME}" node at position [${fetchContextPos}]`);

    // Update AI Agent systemMessage to use dynamic context
    agentNode.parameters = agentNode.parameters ?? {};
    agentNode.parameters.options = agentNode.parameters.options ?? {};
    agentNode.parameters.options.systemMessage = `={{ $('${FETCH_CONTEXT_NODE_NAME}').item.json.systemPrompt }}`;
    console.log(`✅ Updated AI Agent systemMessage to use dynamic context from "${FETCH_CONTEXT_NODE_NAME}"`);

    // Re-wire connections: find what previously connected to AI Agent, insert Fetch Context between them
    // Find nodes that have a connection pointing to agentNode
    let predecessorName: string | null = null;
    for (const [nodeName, conns] of Object.entries(connections)) {
        const mainConns = (conns as any)?.main ?? [];
        for (const outputPins of mainConns) {
            if (!Array.isArray(outputPins)) continue;
            for (const conn of outputPins) {
                if (conn.node === agentNode.name) {
                    predecessorName = nodeName;
                }
            }
        }
    }

    if (predecessorName) {
        console.log(`✅ Found predecessor of AI Agent: "${predecessorName}"`);
        // Redirect predecessor's connection from agentNode → fetchContextNode
        const predConns = (connections[predecessorName] as any)?.main ?? [];
        for (const outputPins of predConns) {
            if (!Array.isArray(outputPins)) continue;
            for (const conn of outputPins) {
                if (conn.node === agentNode.name) {
                    conn.node = FETCH_CONTEXT_NODE_NAME;
                }
            }
        }
        // Wire fetchContextNode → agentNode
        connections[FETCH_CONTEXT_NODE_NAME] = {
            main: [[{ node: agentNode.name, type: 'main', index: 0 }]],
        };
        console.log(`✅ Wired: "${predecessorName}" → "${FETCH_CONTEXT_NODE_NAME}" → "${agentNode.name}"`);
    } else {
        // No predecessor found — just add connection from Fetch Context to AI Agent
        connections[FETCH_CONTEXT_NODE_NAME] = {
            main: [[{ node: agentNode.name, type: 'main', index: 0 }]],
        };
        console.log(`⚠️  No predecessor found for AI Agent. Added standalone connection: "${FETCH_CONTEXT_NODE_NAME}" → "${agentNode.name}"`);
    }

    // PUT updated workflow back
    console.log('📤 Uploading updated workflow...');

    const allowedSettings: Record<string, any> = {};
    const src = workflow.settings ?? {};
    const allowedKeys = [
        'executionOrder',
        'saveManualExecutions',
        'callerPolicy',
        'errorWorkflow',
        'timezone',
        'saveDataErrorExecution',
        'saveDataSuccessExecution',
        'saveExecutionProgress',
        'executionTimeout',
    ];
    for (const key of allowedKeys) {
        if (key in src) allowedSettings[key] = src[key];
    }

    let updated: any;
    try {
        updated = await fetchN8n(`/workflows/${WORKFLOW_ID}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: workflow.name,
                nodes: workflow.nodes,
                connections: workflow.connections,
                settings: allowedSettings,
                staticData: workflow.staticData ?? null,
            }),
        });
    } catch (err: any) {
        console.error('❌ PUT failed:', err.message);
        process.exit(1);
    }

    console.log(`\n🎉 Workflow updated successfully!`);
    console.log(`   Name:  ${updated.name}`);
    console.log(`   Nodes: ${updated.nodes?.length}`);
    console.log(`\n📋 What was done:`);
    console.log(`   1. Added "Fetch Context" HTTP Request node → GET ${APP_URL}/api/n8n/contexto-servicios`);
    console.log(`   2. AI Agent systemMessage now uses dynamic DB content via $('Fetch Context').item.json.systemPrompt`);
    console.log(`   3. Connection chain updated: predecessor → Fetch Context → AI Agent`);
    console.log(`\n⚠️  VERIFY in N8n UI: ${N8N_URL}/workflow/${WORKFLOW_ID}`);
    console.log(`   - Confirm "Fetch Context" node is visually connected before AI Agent`);
    console.log(`   - Ensure N8N_API_KEY env var is set in N8n (Settings → Variables)`);
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
