'use strict';

// Limpieza post-formateo: Windows.old, temporales, caché de Windows Update, cachés de
// sombreadores de la GPU y componentes reemplazados de Windows (WinSxS).
// Lo que se borra aquí NO va a la papelera: main.js pide confirmación antes de llamar a runCleanup.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runElevated, runPowerShell, psData } = require('./powershell');

const SYSTEM_DRIVE = process.env.SystemDrive || 'C:';
const WINDIR = process.env.SystemRoot || path.join(SYSTEM_DRIVE, 'Windows');
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

// Cachés de sombreadores: los drivers y juegos las regeneran solos
const SHADER_DIRS = [
  path.join(LOCAL, 'D3DSCache'),
  path.join(LOCAL, 'NVIDIA', 'DXCache'),
  path.join(LOCAL, 'NVIDIA', 'GLCache'),
  path.join(LOCAL, 'AMD', 'DxCache'),
  path.join(LOCAL, 'AMD', 'DxcCache'),
  path.join(LOCAL, 'AMD', 'VkCache'),
  path.join(LOCAL, 'AMD', 'GLCache'),
  path.join(LOCAL, 'Intel', 'ShaderCache'),
];

const ITEMS = {
  'windows-old': {
    name: 'Instalación anterior de Windows (Windows.old)',
    detail: 'Copia del Windows de antes del formateo o de la última actualización grande. Al borrarla ya no podrás volver a esa versión.',
    dirs: [path.join(SYSTEM_DRIVE + path.sep, 'Windows.old')],
    elevated: true,
    defaultOn: false,
  },
  'user-temp': {
    name: 'Archivos temporales de tu usuario',
    detail: 'Restos de instaladores y programas. Los archivos en uso se omiten.',
    dirs: [os.tmpdir()],
    elevated: false,
    defaultOn: true,
  },
  'shader-cache': {
    name: 'Caché de sombreadores de la GPU',
    detail: 'DirectX, NVIDIA, AMD e Intel la regeneran solos. Útil tras cambiar de driver de video.',
    dirs: SHADER_DIRS,
    elevated: false,
    defaultOn: true,
  },
  'win-temp': {
    name: 'Temporales de Windows',
    detail: `Carpeta ${path.join(WINDIR, 'Temp')}.`,
    dirs: [path.join(WINDIR, 'Temp')],
    elevated: true,
    defaultOn: true,
  },
  'wu-cache': {
    name: 'Descargas de Windows Update',
    detail: 'Instaladores de actualizaciones ya aplicadas. Windows vuelve a bajar lo que necesite.',
    dirs: [path.join(WINDIR, 'SoftwareDistribution', 'Download')],
    elevated: true,
    defaultOn: true,
  },
  'component-store': {
    name: 'Componentes reemplazados de Windows (WinSxS)',
    detail: 'DISM /StartComponentCleanup: quita versiones viejas de componentes ya actualizados. Puede tardar varios minutos.',
    dirs: [],
    elevated: true,
    defaultOn: false,
  },
};

// Suma tamaños sin seguir enlaces ni uniones; tolera carpetas sin permiso
async function measureDir(dir) {
  let bytes = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) {
        try {
          bytes += (await fs.promises.stat(full)).size;
          files += 1;
        } catch {
          // Inaccesible
        }
      }
    }
  }
  return { bytes, files };
}

// Borra el contenido de `dir` (no la carpeta). Omite lo que esté en uso. Devuelve bytes liberados.
async function emptyDir(dir, { keep = [] } = {}) {
  let freed = 0;
  let skipped = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return { freed, skipped };
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (keep.some((k) => full.toLowerCase().startsWith(k.toLowerCase()))) continue;
    if (e.isSymbolicLink()) {
      skipped += 1;
      continue;
    }
    const size = e.isDirectory() ? (await measureDir(full)).bytes : await fs.promises.stat(full).then((s) => s.size, () => 0);
    try {
      await fs.promises.rm(full, { recursive: true, force: true, maxRetries: 0 });
      freed += size;
    } catch {
      // En uso: rm puede haber borrado una parte; se cuenta lo que ya no está
      const left = e.isDirectory() ? (await measureDir(full)).bytes : await fs.promises.stat(full).then((s) => s.size, () => 0);
      freed += Math.max(0, size - left);
      skipped += 1;
    }
  }
  return { freed, skipped };
}

async function scanCleanup() {
  const items = [];
  for (const [id, it] of Object.entries(ITEMS)) {
    let bytes = 0;
    let present = it.dirs.length === 0;
    for (const d of it.dirs) {
      if (!fs.existsSync(d)) continue;
      present = true;
      bytes += (await measureDir(d)).bytes;
    }
    items.push({
      id,
      name: it.name,
      detail: it.detail,
      elevated: it.elevated,
      defaultOn: it.defaultOn,
      present,
      bytes: it.dirs.length ? bytes : null,
      approximate: it.elevated, // sin admin no se pueden leer todas las subcarpetas
    });
  }
  return { ok: true, items: items.filter((i) => i.present) };
}

async function freeSpace() {
  const r = await runPowerShell(`(Get-PSDrive -Name ${psData(SYSTEM_DRIVE.replace(':', ''))}).Free`, 10000);
  return Number(r.stdout) || 0;
}

function elevatedScript(ids) {
  const parts = [];
  if (ids.includes('windows-old')) {
    // Liberador de espacio oficial de Windows: maneja los permisos especiales de Windows.old
    parts.push(`$vc = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VolumeCaches'
$keys = 'Previous Installations','Temporary Setup Files','Windows Upgrade Log Files'
foreach ($k in $keys) { if (Test-Path "$vc\\$k") { Set-ItemProperty "$vc\\$k" -Name StateFlags0742 -Value 2 -Type DWord } }
Start-Process cleanmgr.exe -ArgumentList '/sagerun:742' -Wait -WindowStyle Hidden
foreach ($k in $keys) { Remove-ItemProperty "$vc\\$k" -Name StateFlags0742 -ErrorAction SilentlyContinue }`);
  }
  if (ids.includes('win-temp')) {
    parts.push(`Get-ChildItem -LiteralPath ${psData(path.join(WINDIR, 'Temp'))} -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue`);
  }
  if (ids.includes('wu-cache')) {
    parts.push(`try {
  Stop-Service wuauserv,bits -Force -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath ${psData(path.join(WINDIR, 'SoftwareDistribution', 'Download'))} -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} finally {
  Start-Service wuauserv,bits -ErrorAction SilentlyContinue
}`);
  }
  if (ids.includes('component-store')) {
    parts.push('DISM.exe /Online /Cleanup-Image /StartComponentCleanup /Quiet | Out-Null');
  }
  return parts.length ? `$ErrorActionPreference = 'Continue'\n${parts.join('\n')}\nexit 0` : null;
}

async function runCleanup(ids, onProgress = () => {}) {
  const chosen = (Array.isArray(ids) ? ids : []).filter((id) => ITEMS[id]);
  if (!chosen.length) return { ok: false, error: 'No elegiste nada para limpiar.' };
  const before = await freeSpace();
  const notes = [];

  if (chosen.includes('user-temp')) {
    onProgress({ step: 'Borrando temporales de tu usuario…', percent: 10 });
    const r = await emptyDir(os.tmpdir());
    if (r.skipped) notes.push(`${r.skipped} temporales en uso se dejaron.`);
  }
  if (chosen.includes('shader-cache')) {
    onProgress({ step: 'Borrando caché de sombreadores…', percent: 25 });
    for (const d of SHADER_DIRS) await emptyDir(d);
  }

  const script = elevatedScript(chosen);
  let cancelled = false;
  if (script) {
    onProgress({ step: chosen.includes('component-store') || chosen.includes('windows-old') ? 'Limpiando con permisos de administrador (puede tardar varios minutos)…' : 'Limpiando con permisos de administrador…', percent: 45 });
    const elev = await runElevated(script, 60 * 60 * 1000);
    if (elev.cancelled) {
      cancelled = true;
      notes.push('No diste permisos de administrador: se limpió solo lo de tu usuario.');
    }
  }

  const after = await freeSpace();
  onProgress({ step: 'Limpieza terminada.', percent: 100 });
  const freed = Math.max(0, after - before);
  return { ok: true, freedBytes: freed, cancelledElevation: cancelled, notes };
}

module.exports = { scanCleanup, runCleanup, measureDir, emptyDir, ITEMS };
