#!/usr/bin/env node
'use strict';

// Comprueba que cada ID de WinGet del catálogo (incluidos emuladores y catalog-overrides.json)
// siga existiendo en el repositorio oficial microsoft/winget-pkgs.
// Uso: GITHUB_TOKEN=... node scripts/validate-catalog.js [--limit N]
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const { CATALOG, validateOverrides } = require(path.join(root, 'src/backend/catalog.js'));
const { getEmulatorsCatalog } = require(path.join(root, 'src/backend/emulators.js'));

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const token = process.env.GITHUB_TOKEN || '';

const ids = new Map(); // wingetId -> origen
for (const item of CATALOG) {
  if (item.wingetId && item.wingetSource !== 'msstore') ids.set(item.wingetId, `catálogo: ${item.id}`);
}
for (const emu of getEmulatorsCatalog()) {
  if (emu.wingetId) ids.set(emu.wingetId, `emulador: ${emu.id}`);
}
const overridesFile = path.join(root, 'catalog-overrides.json');
if (fs.existsSync(overridesFile)) {
  const raw = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
  if (raw.format !== 1) {
    console.error('catalog-overrides.json: "format" debe ser 1');
    process.exit(1);
  }
  const clean = validateOverrides(raw);
  const rawAdded = Array.isArray(raw.added) ? raw.added.length : 0;
  if (clean.added.length !== rawAdded) {
    console.error(`catalog-overrides.json: ${rawAdded - clean.added.length} programa(s) en "added" no pasan la validación y la app los ignorará.`);
    process.exitCode = 1;
  }
  for (const [id, o] of Object.entries(clean.items)) if (o.wingetId) ids.set(o.wingetId, `override: ${id}`);
  for (const a of clean.added) ids.set(a.wingetId, `override añadido: ${a.id}`);
}

// manifests/<inicial>/<Editor>/<Paquete>/ — p. ej. Brave.Brave → manifests/b/Brave/Brave
function manifestExists(id) {
  const apiPath = `/repos/microsoft/winget-pkgs/contents/manifests/${id[0].toLowerCase()}/${id.split('.').map(encodeURIComponent).join('/')}`;
  return new Promise((resolve) => {
    const req = https.get(
      { host: 'api.github.com', path: apiPath, headers: { 'User-Agent': 'xhannizer0-catalog-check', Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, timeout: 15000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200 ? 'ok' : res.statusCode === 404 ? 'missing' : `http ${res.statusCode}`);
      }
    );
    req.on('error', () => resolve('error'));
    req.on('timeout', () => req.destroy());
  });
}

(async () => {
  const list = [...ids.entries()].slice(0, limit);
  const missing = [];
  const errors = [];
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const [id, origin] = queue.shift();
        const status = await manifestExists(id);
        if (status === 'missing') missing.push(`${id}  (${origin})`);
        else if (status !== 'ok') errors.push(`${id}: ${status}`);
      }
    })
  );
  console.log(`IDs revisados: ${list.length}`);
  if (errors.length) console.log(`No se pudieron comprobar (${errors.length}):\n  ${errors.join('\n  ')}`);
  if (missing.length) {
    console.error(`IDs de WinGet que ya NO existen (${missing.length}):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
  if (errors.length) process.exit(2);
  console.log('Todos los IDs de WinGet existen.');
})();
