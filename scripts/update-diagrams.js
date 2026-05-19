#!/usr/bin/env node
/**
 * update-diagrams.js
 * Reads docs/diagrams/*.mmd → generates mermaid.ai live-edit URLs → updates CLAUDE.md
 *
 * Run:  npm run diagrams
 * Auto: .git/hooks/pre-commit (installed by npm run diagrams:install)
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIAGRAMS_DIR = path.join(ROOT, 'docs', 'diagrams');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const BASE_URL = 'https://mermaid.ai/live/edit?utm_medium=share&utm_source=ai_live_editor#pako:';

function encode(diagramContent) {
    const json = JSON.stringify({ code: diagramContent });
    const compressed = zlib.deflateSync(Buffer.from(json, 'utf8'), { level: 9 });
    // URL-safe base64 (same as pako + btoa used by mermaid.ai)
    return compressed.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateUrl(mmdPath) {
    const content = fs.readFileSync(mmdPath, 'utf8').trim();
    return BASE_URL + encode(content);
}

function updateClaudeMd(name, newUrl) {
    let content = fs.readFileSync(CLAUDE_MD, 'utf8');

    // Match the row in the diagrams table by file name
    const escaped = name.replace('.', '\\.');
    const regex = new RegExp(
        `(\\| [^|]+ \\| \`docs/diagrams/${escaped}\` \\| )https://mermaid\\.ai[^\\s|]*(\\s*\\|)`,
        'g'
    );

    const updated = content.replace(regex, `$1${newUrl}$2`);

    if (updated === content) {
        console.warn(`  ⚠️  No se encontró la fila para ${name} en CLAUDE.md`);
        return;
    }

    fs.writeFileSync(CLAUDE_MD, updated, 'utf8');
}

// --- Main ---
const diagrams = [
    { file: 'base-de-datos.mmd', label: 'Base de datos (ERD)' },
    { file: 'arquitectura.mmd',  label: 'Arquitectura'        },
];

let anyChanged = false;

for (const { file, label } of diagrams) {
    const mmdPath = path.join(DIAGRAMS_DIR, file);

    if (!fs.existsSync(mmdPath)) {
        console.warn(`  ⚠️  No existe: ${mmdPath}`);
        continue;
    }

    const url = generateUrl(mmdPath);
    updateClaudeMd(file, url);
    console.log(`  ✅ ${label}`);
    console.log(`     ${url.substring(0, 80)}...`);
    anyChanged = true;
}

if (anyChanged) {
    console.log('\n✅ CLAUDE.md actualizado con los links más recientes.');
} else {
    console.log('\nNada que actualizar.');
}
