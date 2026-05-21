/**
 * Switches the N8n WhatsApp bot workflow from Claude Haiku to OpenRouter GPT-4o.
 * Creates an OpenAI-compatible credential pointing to OpenRouter, then
 * replaces the lmChatAnthropic node with lmChatOpenAi.
 *
 * Run with:
 * N8N_BASE_URL=https://n8n-production-9d890.up.railway.app \
 * N8N_API_KEY=<n8n_key> \
 * OPENROUTER_API_KEY=<openrouter_key> \
 * npx ts-node --project tsconfig.json scripts/update-n8n-openrouter.ts
 */

const N8N_URL = process.env.N8N_BASE_URL || 'https://n8n-production-9d890.up.railway.app';
const WORKFLOW_ID = 'lOXWAYlE0iDbBxcE';

const N8N_API_KEY = process.env.N8N_API_KEY!;
if (!N8N_API_KEY) {
    console.error('N8N_API_KEY env var is required');
    process.exit(1);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY env var is required');
    process.exit(1);
}

const OPENROUTER_MODEL = 'openai/gpt-oss-120b:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const CREDENTIAL_NAME = 'OpenRouter GPT';

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

async function getOrCreateCredential(): Promise<{ id: string; name: string }> {
    // Check if credential already exists
    const list = await fetchN8n('/credentials?limit=100');
    const existing = (list.data ?? []).find((c: any) => c.name === CREDENTIAL_NAME);
    if (existing) {
        console.log(`✅ Credential "${CREDENTIAL_NAME}" already exists (id: ${existing.id})`);
        return { id: existing.id, name: existing.name };
    }

    // Create new credential
    const created = await fetchN8n('/credentials', {
        method: 'POST',
        body: JSON.stringify({
            name: CREDENTIAL_NAME,
            type: 'openAiApi',
            data: {
                apiKey: OPENROUTER_API_KEY,
                url: OPENROUTER_BASE_URL,
                headerName: '',
                headerValue: '',
            },
        }),
    });
    console.log(`✅ Created credential "${CREDENTIAL_NAME}" (id: ${created.id})`);
    return { id: created.id, name: created.name };
}

async function main() {
    console.log('🔑 Setting up OpenRouter credential in N8n...');
    const credential = await getOrCreateCredential();

    console.log('\n📥 Fetching current workflow...');
    const workflow = await fetchN8n(`/workflows/${WORKFLOW_ID}`);
    console.log(`✅ Got workflow: "${workflow.name}" (${workflow.nodes.length} nodes)`);

    const nodes: any[] = workflow.nodes;
    const connections: Record<string, any> = workflow.connections;

    // Find existing Anthropic LLM node (any variant)
    const anthropicNode = nodes.find(
        (n: any) =>
            n.type === '@n8n/n8n-nodes-langchain.lmChatAnthropic' ||
            n.name === 'Claude Haiku 4.5' ||
            n.name === 'Claude Sonnet 4.6'
    );

    if (!anthropicNode) {
        // Check if OpenRouter node already configured
        const openRouterNode = nodes.find((n: any) =>
            n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi' &&
            n.name === CREDENTIAL_NAME
        );
        if (openRouterNode) {
            console.log('✅ Already using OpenRouter node. Nothing to do.');
            process.exit(0);
        }
        console.error('❌ Could not find Anthropic LLM node. Check workflow in N8n UI.');
        process.exit(1);
    }

    const oldName = anthropicNode.name;
    console.log(`✅ Found LLM node to replace: "${oldName}"`);

    // Replace with OpenAI-compatible node for OpenRouter
    anthropicNode.type = '@n8n/n8n-nodes-langchain.lmChatOpenAi';
    anthropicNode.typeVersion = 1;
    anthropicNode.name = CREDENTIAL_NAME;
    anthropicNode.parameters = {
        model: OPENROUTER_MODEL,
        options: {},
    };
    anthropicNode.credentials = {
        openAiApi: {
            id: credential.id,
            name: credential.name,
        },
    };
    console.log(`✅ Replaced with lmChatOpenAi → model: ${OPENROUTER_MODEL}`);

    // Rename connection key if node was renamed
    if (oldName !== CREDENTIAL_NAME && connections[oldName]) {
        connections[CREDENTIAL_NAME] = connections[oldName];
        delete connections[oldName];
        console.log(`✅ Updated connection key: "${oldName}" → "${CREDENTIAL_NAME}"`);
    }

    // PUT updated workflow back
    console.log('\n📤 Uploading updated workflow...');
    const allowedSettings: Record<string, any> = {};
    const src = workflow.settings ?? {};
    const allowedKeys = [
        'executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow',
        'timezone', 'saveDataErrorExecution', 'saveDataSuccessExecution',
        'saveExecutionProgress', 'executionTimeout',
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
    console.log(`\n📋 What changed:`);
    console.log(`   • LLM node: ${oldName} → ${CREDENTIAL_NAME}`);
    console.log(`   • Model: ${OPENROUTER_MODEL} via OpenRouter`);
    console.log(`   • Credential: "${CREDENTIAL_NAME}" (id: ${credential.id})`);
    console.log(`\n🔗 Verify in N8n UI: ${N8N_URL}/workflow/${WORKFLOW_ID}`);
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
