'use strict';

// «Migrar mi PC»: exporta programas (winget), ajustes de Windows y carpetas elegidas a una
// carpeta/USB, y luego los restaura en el PC formateado sin sobrescribir nada.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const MANIFEST_NAME = 'xhannizer0-migracion.json';
const SKIP_FILES = new Set(['desktop.ini', 'thumbs.db']);
const WINGET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9.+_-]{1,120}$/;

function runWinget(args, timeout = 120000) {
  return new Promise((resolve) => {
    execFile('winget.exe', args, { windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      resolve({ ok: !error, stdout: String(stdout || '') });
    });
  });
}

// Recorre una carpeta sin seguir enlaces simbólicos ni uniones
async function walk(dir, onFile) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      await walk(full, onFile);
    } else if (e.isFile() && !SKIP_FILES.has(e.name.toLowerCase())) {
      await onFile(full);
    }
  }
}

async function measureFolder(dir) {
  let files = 0;
  let bytes = 0;
  await walk(dir, async (f) => {
    try {
      bytes += (await fs.promises.stat(f)).size;
      files += 1;
    } catch {
      // Ignorar archivos inaccesibles
    }
  });
  return { files, bytes };
}

// Copia `src` dentro de `dest`. Nunca sobrescribe: si el archivo ya existe, se omite.
async function copyTree(src, dest, onProgress) {
  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  await walk(src, async (file) => {
    const target = path.join(dest, path.relative(src, file));
    try {
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.copyFile(file, target, fs.constants.COPYFILE_EXCL);
      bytes += (await fs.promises.stat(target)).size;
      copied += 1;
    } catch {
      skipped += 1;
    }
    if ((copied + skipped) % 25 === 0) onProgress({ copied, skipped, bytes });
  });
  onProgress({ copied, skipped, bytes });
  return { copied, skipped, bytes };
}

function safeName(name) {
  return String(name || 'Carpeta').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'Carpeta';
}

// ---------- Exportar (PC viejo)
async function exportMigration({ destDir, folders = [], settingIds = [], catalog = [], profile = null, before = null, onProgress = () => {} }) {
  if (!destDir || !fs.existsSync(destDir)) return { ok: false, error: 'Elige una carpeta o unidad USB de destino.' };
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(destDir, `XHANNIZER0_Migracion_${safeName(os.hostname())}_${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  // 1. Programas instalados
  onProgress({ step: 'Leyendo programas instalados (winget export)…', percent: 5 });
  const wingetFile = path.join(dir, 'winget-apps.json');
  await runWinget(['export', '-o', wingetFile, '--accept-source-agreements', '--disable-interactivity'], 180000);
  let packages = [];
  try {
    const data = JSON.parse(fs.readFileSync(wingetFile, 'utf8'));
    for (const source of data.Sources || []) {
      const sourceName = source.SourceDetails?.Name || 'winget';
      for (const p of source.Packages || []) {
        const id = String(p.PackageIdentifier || '');
        if (!WINGET_ID_RE.test(id)) continue;
        const known = catalog.find((c) => String(c.wingetId || '').toLowerCase() === id.toLowerCase());
        packages.push({ wingetId: id, source: sourceName, catalogId: known?.id || null, name: known?.name || id });
      }
    }
  } catch {
    packages = [];
  }

  // 2. Carpetas personales
  const folderEntries = [];
  const totals = await Promise.all(folders.map((f) => measureFolder(f.path)));
  const totalBytes = totals.reduce((s, t) => s + t.bytes, 0) || 1;
  let doneBytes = 0;
  for (let i = 0; i < folders.length; i += 1) {
    const f = folders[i];
    if (!f.path || !fs.existsSync(f.path)) continue;
    const rel = path.join('Archivos', `${i + 1}_${safeName(f.name)}`);
    const res = await copyTree(f.path, path.join(dir, rel), (p) => {
      const pct = 10 + Math.round(((doneBytes + p.bytes) / totalBytes) * 85);
      onProgress({ step: `Copiando ${f.name}: ${p.copied} archivos…`, percent: Math.min(95, pct) });
    });
    doneBytes += res.bytes;
    folderEntries.push({ id: `f${i + 1}`, key: f.key || null, name: f.name, originalPath: f.path, relPath: rel, files: res.copied, bytes: res.bytes, skipped: res.skipped });
  }

  // 3. Manifiesto + script para instalar sin la app
  const manifest = {
    app: 'XHANNIZER0',
    format: 1,
    createdAt: new Date().toISOString(),
    pcName: os.hostname(),
    packages,
    settingIds: settingIds.filter((s) => /^[a-z0-9-]{3,40}$/.test(s)),
    folders: folderEntries,
    profile,
    // Foto del rendimiento antes de formatear, para comparar en el PC nuevo
    before,
  };
  fs.writeFileSync(path.join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2), 'utf8');
  const ps1 = [
    '# XHANNIZER0 — Reinstalar programas de la migración sin abrir la app',
    `winget import -i "$PSScriptRoot\\winget-apps.json" --accept-package-agreements --accept-source-agreements --ignore-unavailable`,
    'Pause',
  ].join('\r\n');
  fs.writeFileSync(path.join(dir, 'reinstalar-programas.ps1'), ps1, 'utf8');
  fs.writeFileSync(
    path.join(dir, 'reinstalar-programas.bat'),
    '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0reinstalar-programas.ps1"\r\n',
    'utf8'
  );

  onProgress({ step: 'Migración lista.', percent: 100 });
  return {
    ok: true,
    dir,
    packages: packages.length,
    folders: folderEntries.length,
    files: folderEntries.reduce((s, f) => s + f.files, 0),
    bytes: folderEntries.reduce((s, f) => s + f.bytes, 0),
  };
}

// ---------- Restaurar (PC nuevo)
function readMigration(manifestPath) {
  if (path.basename(String(manifestPath || '')) !== MANIFEST_NAME) {
    return { ok: false, error: `Selecciona el archivo ${MANIFEST_NAME} de tu migración.` };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { ok: false, error: 'El archivo de migración está dañado.' };
  }
  if (data.app !== 'XHANNIZER0' || !Array.isArray(data.packages)) {
    return { ok: false, error: 'No es un archivo de migración de XHANNIZER0.' };
  }
  const base = path.dirname(manifestPath);
  const folders = (Array.isArray(data.folders) ? data.folders : []).filter((f) => {
    const abs = path.resolve(base, String(f.relPath || ''));
    return abs.startsWith(path.resolve(base) + path.sep) && fs.existsSync(abs);
  });
  return {
    ok: true,
    manifestPath,
    createdAt: data.createdAt,
    pcName: data.pcName,
    packages: data.packages.filter((p) => WINGET_ID_RE.test(String(p.wingetId || ''))),
    settingIds: Array.isArray(data.settingIds) ? data.settingIds.filter((s) => /^[a-z0-9-]{3,40}$/.test(s)) : [],
    folders,
    profile: data.profile || null,
    before: data.before && typeof data.before === 'object' ? data.before : null,
  };
}

// Copia las carpetas elegidas a su ubicación en este PC. `resolveKnown(key)` da la ruta actual de
// Escritorio, Documentos, etc.; las carpetas personalizadas van a Documentos\XHANNIZER0_Restaurado.
async function restoreFolders({ manifestPath, folderIds = [], resolveKnown, onProgress = () => {} }) {
  const mig = readMigration(manifestPath);
  if (!mig.ok) return mig;
  const base = path.dirname(manifestPath);
  const chosen = mig.folders.filter((f) => folderIds.includes(f.id));
  const results = [];
  for (const f of chosen) {
    const known = f.key ? resolveKnown(f.key) : null;
    const target = known || path.join(resolveKnown('documents'), 'XHANNIZER0_Restaurado', safeName(f.name));
    const res = await copyTree(path.resolve(base, f.relPath), target, (p) =>
      onProgress({ step: `Restaurando ${f.name}: ${p.copied} archivos…`, percent: Math.min(99, Math.round((p.bytes / (f.bytes || 1)) * 100)) })
    );
    results.push({ name: f.name, target, ...res });
  }
  onProgress({ step: 'Carpetas restauradas.', percent: 100 });
  const skipped = results.reduce((s, r) => s + r.skipped, 0);
  return {
    ok: true,
    results,
    message: `Se restauraron ${results.reduce((s, r) => s + r.copied, 0)} archivo(s)${skipped ? `; ${skipped} omitidos porque ya existían` : ''}.`,
  };
}

module.exports = { exportMigration, readMigration, restoreFolders, measureFolder, WINGET_ID_RE, MANIFEST_NAME };
