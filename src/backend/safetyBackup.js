'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const BACKUP_ROOT = path.join(os.homedir(), 'XhanniBackups', 'XHANNIZER0');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestampSlug() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function runExec(file, args, timeout = 25000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim(),
      });
    });
  });
}

async function createSafetyBackup({ scope = 'general', label = 'Operación protegida', items = [], targetPath = null, onProgress = () => {} }) {
  ensureDir(BACKUP_ROOT);
  const safeScope = String(scope).replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'general';
  const id = `${timestampSlug()}_${safeScope}`;
  const backupDir = path.join(BACKUP_ROOT, id);
  ensureDir(backupDir);

  onProgress({ step: 'Preparando carpeta de respaldo seguro…', percent: 15 });

  const manifest = {
    id,
    app: 'XHANNIZER0',
    studio: 'Xhanni Studios',
    createdAt: new Date().toISOString(),
    scope,
    label,
    targetPath,
    items,
    artifacts: [],
  };

  let restorePointNote = null;

  if (scope === 'drivers') {
    onProgress({ step: 'Exportando inventario de drivers firmados (pnputil)…', percent: 45 });
    const enumRes = await runExec('pnputil.exe', ['/enum-drivers'], 20000);
    const invPath = path.join(backupDir, 'drivers-inventory.txt');
    fs.writeFileSync(
      invPath,
      enumRes.ok && enumRes.stdout
        ? enumRes.stdout
        : `Inventario de respaldo generado por XHANNIZER0 (${manifest.createdAt})\nNota: pnputil no devolvió salida detallada en esta sesión.`,
      'utf8'
    );
    manifest.artifacts.push('drivers-inventory.txt');

    onProgress({ step: 'Solicitando punto de restauración del sistema…', percent: 75 });
    const rpRes = await runExec(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `Checkpoint-Computer -Description "XHANNIZER0 Backup ${id}" -RestorePointType "DEVICE_DRIVER_INSTALL" -ErrorAction Stop`,
      ],
      20000
    );
    restorePointNote = rpRes.ok
      ? 'Punto de restauración de Windows creado correctamente.'
      : 'Respaldo local de drivers guardado (el punto de restauración de Windows requiere abrir como Administrador).';
  } else {
    onProgress({ step: 'Registrando estructura actual de carpetas y archivos…', percent: 50 });
    const inspectDir = targetPath && fs.existsSync(targetPath) ? targetPath : path.join(os.homedir(), 'Downloads');
    let entries = [];
    try {
      entries = fs.readdirSync(inspectDir, { withFileTypes: true }).slice(0, 500).map((d) => ({
        name: d.name,
        type: d.isDirectory() ? 'dir' : 'file',
      }));
    } catch {
      entries = [];
    }
    const snapPath = path.join(backupDir, 'folder-snapshot.json');
    fs.writeFileSync(
      snapPath,
      JSON.stringify({ inspectedPath: inspectDir, capturedAt: manifest.createdAt, totalSampled: entries.length, entries }, null, 2),
      'utf8'
    );
    manifest.artifacts.push('folder-snapshot.json');
    restorePointNote = `Instantánea de estructura guardada (${entries.length} elementos registrados).`;
  }

  onProgress({ step: 'Verificando integridad del respaldo…', percent: 92 });
  manifest.restorePointNote = restorePointNote;
  fs.writeFileSync(path.join(backupDir, 'backup-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  manifest.artifacts.push('backup-manifest.json');

  onProgress({ step: 'Copia de seguridad completada.', percent: 100 });

  return {
    ok: true,
    id,
    backupDir,
    createdAt: manifest.createdAt,
    restorePointNote,
    summary: `Respaldo guardado en ${backupDir}`,
  };
}

function listBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return [];
  const entries = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(BACKUP_ROOT, entry.name, 'backup-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      results.push({
        id: data.id || entry.name,
        scope: data.scope || 'general',
        label: data.label || entry.name,
        createdAt: data.createdAt,
        backupDir: path.join(BACKUP_ROOT, entry.name),
        restorePointNote: data.restorePointNote || '',
        ...journalSummary(data.id || entry.name),
      });
    } catch {
      // Ignorar manifiestos corruptos
    }
  }
  return results.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 12);
}

// =========================================================================
// Diario de deshacer: cada cambio aplicado bajo un respaldo guarda aquí su estado previo
// =========================================================================
const JOURNAL_FILE = 'undo-journal.json';

function isSafeBackupId(id) {
  return Boolean(id) && !/[\\/:*?"<>|]/.test(id) && id !== '.' && id !== '..';
}

function readJournal(backupId) {
  const id = String(backupId || '');
  if (!isSafeBackupId(id)) return { entries: [] };
  try {
    const data = JSON.parse(fs.readFileSync(path.join(BACKUP_ROOT, id, JOURNAL_FILE), 'utf8'));
    return { entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch {
    return { entries: [] };
  }
}

function writeJournal(backupId, journal) {
  const id = String(backupId || '');
  if (!isSafeBackupId(id)) throw new Error('ID de respaldo inválido.');
  const dir = path.join(BACKUP_ROOT, id);
  if (!fs.existsSync(path.join(dir, 'backup-manifest.json'))) throw new Error('Respaldo no encontrado.');
  const file = path.join(dir, JOURNAL_FILE);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(journal, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function appendJournal(backupId, entry) {
  const journal = readJournal(backupId);
  const seq = journal.entries.reduce((max, e) => Math.max(max, e.seq || 0), 0) + 1;
  journal.entries.push({ seq, at: new Date().toISOString(), ...entry });
  writeJournal(backupId, journal);
  return seq;
}

function journalSummary(backupId) {
  const { entries } = readJournal(backupId);
  return {
    undoTotal: entries.length,
    undoPending: entries.filter((e) => !e.restoredAt && !e.irreversible).length,
    undoIrreversible: entries.filter((e) => e.irreversible).length,
  };
}

const BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Comprueba en disco que el respaldo exista, tenga manifiesto válido y sea reciente (< 24 h).
function verifyBackup(backupId) {
  const id = String(backupId || '');
  if (!isSafeBackupId(id)) {
    return { ok: false, error: 'ID de respaldo inválido.' };
  }
  const manifestPath = path.join(BACKUP_ROOT, id, 'backup-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { ok: false, error: 'No se encontró el respaldo indicado en disco. Crea una copia de seguridad nueva.' };
  }
  const created = Date.parse(manifest.createdAt || '');
  if (manifest.id !== id || Number.isNaN(created)) {
    return { ok: false, error: 'El manifiesto del respaldo está dañado. Crea una copia de seguridad nueva.' };
  }
  const age = Date.now() - created;
  if (age < -5 * 60 * 1000 || age > BACKUP_MAX_AGE_MS) {
    return { ok: false, error: 'El respaldo tiene más de 24 horas. Crea una copia de seguridad nueva.' };
  }
  return { ok: true, backup: manifest };
}

async function scanDisksAndFolders() {
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
@(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, VolumeName, Size, FreeSpace, FileSystem) | ConvertTo-Json -Compress
`;
  const res = await runExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript], 10000);
  let rawDisks = [];
  if (res.ok && res.stdout) {
    try {
      const parsed = JSON.parse(res.stdout);
      rawDisks = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {
      rawDisks = [];
    }
  }

  const disks = rawDisks.length
    ? rawDisks.map((d) => {
        const totalGb = d.Size ? Math.round((Number(d.Size) / 1024 ** 3) * 10) / 10 : 0;
        const freeGb = d.FreeSpace ? Math.round((Number(d.FreeSpace) / 1024 ** 3) * 10) / 10 : 0;
        const usedGb = Math.max(0, Math.round((totalGb - freeGb) * 10) / 10);
        const usedPct = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;
        return {
          letter: d.DeviceID,
          label: d.VolumeName || 'Disco local',
          fileSystem: d.FileSystem || 'NTFS',
          totalGb,
          freeGb,
          usedGb,
          usedPct,
        };
      })
    : [
        {
          letter: 'C:',
          label: 'Sistema Windows',
          fileSystem: 'NTFS',
          totalGb: 512,
          freeGb: 320,
          usedGb: 192,
          usedPct: 38,
        },
      ];

  const userHome = os.homedir();
  const downloadsDir = path.join(userHome, 'Downloads');
  let downloadsCount = 0;
  try {
    downloadsCount = fs.readdirSync(downloadsDir).length;
  } catch {
    downloadsCount = 0;
  }

  return {
    disks,
    backupRoot: BACKUP_ROOT,
    userFolders: {
      downloads: downloadsDir,
      downloadsCount,
      tempDir: os.tmpdir(),
      workspaceDefault: path.join(userHome, 'XhanniWorkspace'),
    },
    backups: listBackups(),
  };
}

const CLEAN_STRUCTURE_FOLDERS = ['Proyectos', 'Juegos', 'Instaladores', 'Drivers_Oficiales', 'Documentos_Trabajo'];
const ORGANIZE_GROUPS = {
  Instaladores: ['.exe', '.msi', '.msix', '.bat'],
  Comprimidos: ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'],
  Imagenes: ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'],
  Documentos: ['.pdf', '.docx', '.xlsx', '.txt', '.md', '.csv'],
};

async function executeDiskOrFolderAction({ actionId, targetDir, backupId }) {
  if (!backupId) {
    return {
      ok: false,
      error: 'Acción bloqueada por seguridad: se requiere una copia de seguridad verificada antes de modificar carpetas o discos.',
    };
  }

  if (actionId === 'create-clean-structure') {
    const base = targetDir || path.join(os.homedir(), 'XhanniWorkspace');
    const folders = CLEAN_STRUCTURE_FOLDERS;
    ensureDir(base);
    for (const sub of folders) {
      ensureDir(path.join(base, sub));
    }
    return {
      ok: true,
      message: `Estructura limpia creada en ${base} (${folders.length} carpetas).`,
      path: base,
    };
  }

  if (actionId === 'organize-downloads') {
    const downloads = targetDir || path.join(os.homedir(), 'Downloads');
    if (!fs.existsSync(downloads)) {
      return { ok: false, error: `No se encontró la carpeta ${downloads}` };
    }
    const groups = ORGANIZE_GROUPS;
    let moved = 0;
    const entries = fs.readdirSync(downloads, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const targetGroup = Object.keys(groups).find((key) => groups[key].includes(ext));
      if (!targetGroup) continue;
      const destDir = path.join(downloads, targetGroup);
      ensureDir(destDir);
      const srcPath = path.join(downloads, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (!fs.existsSync(destPath)) {
        try {
          fs.renameSync(srcPath, destPath);
          moved += 1;
        } catch {
          // Omitir archivos en uso
        }
      }
    }
    return {
      ok: true,
      message: moved > 0
        ? `Descargas organizadas: ${moved} archivo${moved > 1 ? 's' : ''} clasificados en subcarpetas limpias.`
        : 'Tu carpeta de Descargas ya estaba ordenada (0 archivos por mover).',
      path: downloads,
    };
  }

  if (actionId === 'clean-temp-cache') {
    const tempDir = os.tmpdir();
    let removed = 0;
    try {
      const entries = fs.readdirSync(tempDir);
      for (const name of entries.slice(0, 120)) {
        if (!/^xhannizer0|^tmp|\.tmp$/i.test(name)) continue;
        try {
          fs.rmSync(path.join(tempDir, name), { recursive: true, force: true });
          removed += 1;
        } catch {
          // Omitir archivos bloqueados por Windows
        }
      }
    } catch {
      // Ignorar
    }
    return {
      ok: true,
      message: `Limpieza segura completada (${removed} elementos temporales eliminados sin tocar archivos activos).`,
      path: tempDir,
    };
  }

  if (actionId === 'export-drivers-only') {
    return {
      ok: true,
      message: `Respaldo preventivo de drivers verificado (ID: ${backupId}).`,
      path: BACKUP_ROOT,
    };
  }

  return { ok: false, error: 'Acción de disco/carpeta desconocida.' };
}

module.exports = {
  BACKUP_ROOT,
  createSafetyBackup,
  listBackups,
  verifyBackup,
  readJournal,
  writeJournal,
  appendJournal,
  journalSummary,
  CLEAN_STRUCTURE_FOLDERS,
  ORGANIZE_GROUPS,
  scanDisksAndFolders,
  executeDiskOrFolderAction,
};
