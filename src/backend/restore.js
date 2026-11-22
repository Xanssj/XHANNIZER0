'use strict';

// Restauración real: antes de cada cambio se guarda el estado previo en el diario del respaldo
// (undo-journal.json) y «Deshacer» lo revierte en orden inverso.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runPowerShell, runElevated, psData } = require('./powershell');
const {
  readJournal,
  writeJournal,
  appendJournal,
  CLEAN_STRUCTURE_FOLDERS,
  ORGANIZE_GROUPS,
} = require('./safetyBackup');
const { toggleStartupApp } = require('./startupManager');

// ---------- Valores de registro que toca cada acción
const R = {
  gameMode: { path: 'HKCU:\\Software\\Microsoft\\GameBar', name: 'AllowAutoGameMode' },
  hags: { path: 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', name: 'HwSchMode' },
  mouseSpeed: { path: 'HKCU:\\Control Panel\\Mouse', name: 'MouseSpeed' },
  mouseT1: { path: 'HKCU:\\Control Panel\\Mouse', name: 'MouseThreshold1' },
  mouseT2: { path: 'HKCU:\\Control Panel\\Mouse', name: 'MouseThreshold2' },
  hideExt: { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'HideFileExt' },
  clipboard: { path: 'HKCU:\\Software\\Microsoft\\Clipboard', name: 'EnableClipboardHistory' },
  adsId: { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', name: 'Enabled' },
  appsLight: { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'AppsUseLightTheme' },
  systemLight: { path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'SystemUsesLightTheme' },
};

const SETTING_TARGETS = {
  'win-gamemode': { label: 'Modo Juego', reg: [R.gameMode] },
  'win-hags': { label: 'HAGS (GPU)', reg: [R.hags] },
  'win-mouse-accel': { label: 'Aceleración del mouse', reg: [R.mouseSpeed, R.mouseT1, R.mouseT2] },
  'win-file-ext': { label: 'Extensiones de archivo', reg: [R.hideExt] },
  'win-clipboard': { label: 'Historial del portapapeles', reg: [R.clipboard] },
  'win-privacy-ads': { label: 'ID de publicidad', reg: [R.adsId] },
  'win-power-plan': { label: 'Plan de energía', reg: [], power: true },
  'win-dark-mode': { label: 'Modo oscuro', reg: [R.appsLight, R.systemLight] },
};

const PRESET_TARGETS = {
  'preset-gaming': { reg: [R.gameMode], power: true },
  'preset-dev': { reg: [R.hideExt], power: true },
  'preset-office': { reg: [R.hideExt], power: true },
};

const isHklm = (p) => /^HKLM:/i.test(p);

// ---------- Registro
async function captureRegistry(targets) {
  if (!targets.length) return [];
  const ps = `
$out = foreach ($x in @(${psData(targets)})) {
  $item = Get-Item -LiteralPath $x.path -ErrorAction SilentlyContinue
  if ($item -and ($item.GetValueNames() -contains $x.name)) {
    [pscustomobject]@{ path = $x.path; name = $x.name; existed = $true; kind = [string]$item.GetValueKind($x.name); value = $item.GetValue($x.name, $null, 'DoNotExpandEnvironmentNames') }
  } else {
    [pscustomobject]@{ path = $x.path; name = $x.name; existed = $false }
  }
}
ConvertTo-Json -InputObject @($out) -Compress -Depth 4`;
  const r = await runPowerShell(ps, 12000);
  if (!r.ok) throw new Error('No se pudo leer el registro antes del cambio.');
  const parsed = JSON.parse(r.stdout || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

function restoreRegistryScript(values) {
  return `
foreach ($x in @(${psData(values)})) {
  if ($x.existed) {
    if (-not (Test-Path -LiteralPath $x.path)) { New-Item -Path $x.path -Force | Out-Null }
    $val = $x.value
    if ($x.kind -eq 'Binary') { $val = [byte[]]@($x.value) }
    if ($x.kind -eq 'MultiString') { $val = [string[]]@($x.value) }
    Set-ItemProperty -LiteralPath $x.path -Name $x.name -Value $val -Type $x.kind -ErrorAction Stop
  } else {
    Remove-ItemProperty -LiteralPath $x.path -Name $x.name -ErrorAction SilentlyContinue
  }
}`;
}

async function restoreRegistry(values) {
  const user = values.filter((v) => !isHklm(v.path));
  const system = values.filter((v) => isHklm(v.path));
  if (user.length) {
    const r = await runPowerShell(`$ErrorActionPreference = 'Stop'\n${restoreRegistryScript(user)}`, 12000);
    if (!r.ok) return { ok: false, note: 'No se pudo restaurar el registro del usuario.' };
  }
  if (system.length) {
    const r = await runElevated(restoreRegistryScript(system), 30000);
    if (!r.ok) return { ok: false, note: r.cancelled ? 'Elevación UAC cancelada.' : 'No se pudo restaurar el registro del sistema.' };
  }
  return { ok: true };
}

// ---------- Plan de energía
async function capturePowerPlan() {
  const r = await runPowerShell('powercfg /getactivescheme', 8000);
  const m = r.stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!m) throw new Error('No se pudo leer el plan de energía activo.');
  return m[0];
}

async function restorePowerPlan(guid) {
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return { ok: false, note: 'Plan de energía inválido.' };
  const r = await runPowerShell(`powercfg /setactive ${guid}; if ($LASTEXITCODE -ne 0) { exit 1 }`, 8000);
  return r.ok ? { ok: true } : { ok: false, note: 'El plan de energía original ya no existe.' };
}

async function captureSystemState(target) {
  return {
    registry: await captureRegistry(target.reg || []),
    powerScheme: target.power ? await capturePowerPlan() : null,
  };
}

async function restoreSystemState(data) {
  const notes = [];
  let ok = true;
  if (data.registry?.length) {
    const r = await restoreRegistry(data.registry);
    if (!r.ok) { ok = false; notes.push(r.note); }
  }
  if (data.powerScheme) {
    const r = await restorePowerPlan(data.powerScheme);
    if (!r.ok) { ok = false; notes.push(r.note); }
  }
  return { ok, note: notes.join(' ') };
}

// ---------- Bloatware (paquetes Appx)
async function captureAppx(fullNames) {
  const ps = `
$names = @(${psData(fullNames)})
$out = Get-AppxPackage | Where-Object { $names -contains $_.PackageFullName } | ForEach-Object {
  [pscustomobject]@{ name = $_.Name; fullName = $_.PackageFullName; family = $_.PackageFamilyName }
}
ConvertTo-Json -InputObject @($out) -Compress`;
  const r = await runPowerShell(ps, 15000);
  if (!r.ok) throw new Error('No se pudo leer la lista de apps instaladas.');
  const parsed = JSON.parse(r.stdout || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function stillInstalledAppx(names) {
  const ps = `
$names = @(${psData(names)})
ConvertTo-Json -InputObject @(Get-AppxPackage | Where-Object { $names -contains $_.Name } | ForEach-Object { $_.Name }) -Compress`;
  const r = await runPowerShell(ps, 15000);
  try {
    return new Set(JSON.parse(r.stdout || '[]'));
  } catch {
    return new Set();
  }
}

async function restoreAppx(packages) {
  const ps = `
$out = foreach ($p in @(${psData(packages)})) {
  if (Get-AppxPackage -Name $p.name) { [pscustomobject]@{ family = $p.family; status = 'present' }; continue }
  try {
    Add-AppxPackage -RegisterByFamilyName -MainPackage $p.family -ErrorAction Stop
    [pscustomobject]@{ family = $p.family; status = 'restored' }
  } catch {
    [pscustomobject]@{ family = $p.family; status = 'store' }
  }
}
ConvertTo-Json -InputObject @($out) -Compress`;
  const r = await runPowerShell(ps, 90000);
  let results = [];
  try {
    results = JSON.parse(r.stdout || '[]');
    if (!Array.isArray(results)) results = [results];
  } catch {
    results = packages.map((p) => ({ family: p.family, status: 'store' }));
  }
  const storeFamilies = results.filter((x) => x.status === 'store').map((x) => x.family);
  return {
    ok: storeFamilies.length === 0,
    storeFamilies,
    note: storeFamilies.length
      ? `${storeFamilies.length} app(s) deben reinstalarse desde Microsoft Store (se abrirá su ficha).`
      : '',
  };
}

// ---------- DNS
async function captureDns(adapterName) {
  const ps = `
$name = ${psData(adapterName)}
$a = Get-NetAdapter -Name $name -ErrorAction Stop
$reg = Get-ItemProperty -LiteralPath "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\$($a.InterfaceGuid)" -ErrorAction SilentlyContinue
$static = [string]$reg.NameServer
@{ dhcp = [string]::IsNullOrWhiteSpace($static); servers = @($static -split '[ ,]' | Where-Object { $_ }) } | ConvertTo-Json -Compress`;
  const r = await runPowerShell(`$ErrorActionPreference = 'Stop'\n${ps}`, 12000);
  if (!r.ok) throw new Error('No se pudo leer la configuración DNS actual.');
  const data = JSON.parse(r.stdout);
  return { adapter: adapterName, dhcp: Boolean(data.dhcp), servers: [].concat(data.servers || []) };
}

async function restoreDns({ adapter, dhcp, servers }) {
  const ps = `
$d = ${psData({ adapter, dhcp, servers })}
if ($d.dhcp) {
  Set-DnsClientServerAddress -InterfaceAlias $d.adapter -ResetServerAddresses
} else {
  Set-DnsClientServerAddress -InterfaceAlias $d.adapter -ServerAddresses ([string[]]@($d.servers))
}
ipconfig /flushdns | Out-Null`;
  const r = await runElevated(ps, 30000);
  return r.ok ? { ok: true } : { ok: false, note: r.cancelled ? 'Elevación UAC cancelada.' : 'No se pudo restaurar el DNS.' };
}

// ---------- Carpetas y archivos
function captureCleanStructure(targetDir) {
  const base = targetDir || path.join(os.homedir(), 'XhanniWorkspace');
  const all = [base, ...CLEAN_STRUCTURE_FOLDERS.map((f) => path.join(base, f))];
  return { created: all.filter((p) => !fs.existsSync(p)) };
}

function restoreCleanStructure({ created }) {
  const kept = [];
  // Primero subcarpetas, luego la base; solo se borran si siguen vacías
  for (const dir of [...created].sort((a, b) => b.length - a.length)) {
    try {
      if (fs.existsSync(dir)) fs.rmdirSync(dir);
    } catch {
      kept.push(path.basename(dir));
    }
  }
  return kept.length
    ? { ok: true, note: `Se conservaron carpetas con contenido nuevo: ${kept.join(', ')}.` }
    : { ok: true };
}

function captureOrganize(targetDir) {
  const dir = targetDir || path.join(os.homedir(), 'Downloads');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
    : [];
  const groupsExisting = Object.keys(ORGANIZE_GROUPS).filter((g) => fs.existsSync(path.join(dir, g)));
  return { dir, files, groupsExisting };
}

function finalizeOrganize(snap) {
  const moves = [];
  for (const name of snap.files) {
    if (fs.existsSync(path.join(snap.dir, name))) continue;
    const group = Object.keys(ORGANIZE_GROUPS).find((g) => fs.existsSync(path.join(snap.dir, g, name)));
    if (group) moves.push({ from: path.join(snap.dir, name), to: path.join(snap.dir, group, name) });
  }
  const groupsCreated = Object.keys(ORGANIZE_GROUPS)
    .filter((g) => !snap.groupsExisting.includes(g) && fs.existsSync(path.join(snap.dir, g)))
    .map((g) => path.join(snap.dir, g));
  return { moves, groupsCreated };
}

function restoreOrganize({ moves, groupsCreated }) {
  let back = 0;
  let skipped = 0;
  for (const m of moves) {
    try {
      if (fs.existsSync(m.to) && !fs.existsSync(m.from)) {
        fs.renameSync(m.to, m.from);
        back += 1;
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }
  for (const dir of groupsCreated) {
    try {
      fs.rmdirSync(dir);
    } catch {
      // Tiene contenido nuevo: se conserva
    }
  }
  return {
    ok: skipped === 0,
    note: skipped ? `${back} archivo(s) devueltos; ${skipped} omitidos porque ya no estaban o el nombre está ocupado.` : `${back} archivo(s) devueltos a su lugar.`,
  };
}

// =========================================================================
// API: envolver una acción para que registre cómo deshacerla
// =========================================================================
async function prepareUndo(kind, payload) {
  switch (kind) {
    case 'windows-setting': {
      const target = SETTING_TARGETS[payload.settingId];
      if (!target) return null; // p. ej. «abrir pantalla»: no cambia nada
      return { type: 'system', label: `Ajuste de Windows: ${target.label}`, data: await captureSystemState(target) };
    }
    case 'preset': {
      const target = PRESET_TARGETS[payload.presetId] || { reg: [], power: true };
      return { type: 'system', label: `Optimización de preset (${payload.presetId || 'general'})`, data: await captureSystemState(target) };
    }
    case 'startup':
      return { type: 'startup', label: `${payload.enable ? 'Reactivar' : 'Desactivar'} en inicio: ${payload.name}`, data: { name: String(payload.name || ''), enable: Boolean(payload.enable) } };
    case 'bloatware': {
      const list = Array.isArray(payload.packageFullNames) ? payload.packageFullNames.map(String) : [];
      return { type: 'appx', label: 'Eliminar bloatware', data: { packages: await captureAppx(list) } };
    }
    case 'network':
      if (payload.action === 'flush-dns') return null;
      return { type: 'dns', label: `Cambio de DNS en ${payload.adapterName}`, data: await captureDns(String(payload.adapterName || '')) };
    case 'disk':
      if (payload.actionId === 'create-clean-structure') {
        return { type: 'folders', label: 'Crear estructura de carpetas', data: captureCleanStructure(payload.targetDir) };
      }
      if (payload.actionId === 'organize-downloads') {
        return { type: 'organize', label: 'Organizar Descargas', snapshot: captureOrganize(payload.targetDir) };
      }
      if (payload.actionId === 'clean-temp-cache') {
        return { type: 'note', irreversible: true, label: 'Limpieza de temporales (no reversible)', data: {} };
      }
      return null;
    default:
      return null;
  }
}

async function finalizeUndo(prepared) {
  if (prepared.type === 'organize') {
    const data = finalizeOrganize(prepared.snapshot);
    if (!data.moves.length && !data.groupsCreated.length) return null;
    return { type: 'organize', label: `${prepared.label} (${data.moves.length} archivos)`, data };
  }
  if (prepared.type === 'appx') {
    const present = await stillInstalledAppx(prepared.data.packages.map((p) => p.name));
    const removed = prepared.data.packages.filter((p) => !present.has(p.name));
    if (!removed.length) return null;
    return { type: 'appx', label: `${prepared.label} (${removed.length} apps)`, data: { packages: removed } };
  }
  if (prepared.type === 'folders' && !prepared.data.created.length) return null;
  return { type: prepared.type, label: prepared.label, irreversible: prepared.irreversible, data: prepared.data };
}

// Ejecuta `run` guardando antes el estado previo. Si no se puede capturar, la acción NO se aplica.
async function withUndo(backupId, kind, payload, run) {
  let prepared;
  try {
    prepared = await prepareUndo(kind, payload || {});
  } catch (err) {
    const msg = `Acción cancelada: ${err.message} No se modificó nada.`;
    return { ok: false, error: msg, message: msg };
  }
  const res = await run();
  if (res?.ok && prepared) {
    try {
      const entry = await finalizeUndo(prepared);
      if (entry) appendJournal(backupId, entry);
    } catch {
      // El cambio ya se aplicó; el fallo del diario no debe ocultar el resultado
    }
  }
  return res;
}

async function restoreEntry(entry, backupId) {
  switch (entry.type) {
    case 'system':
      return restoreSystemState(entry.data);
    case 'startup': {
      const r = await toggleStartupApp({ name: entry.data.name, enable: !entry.data.enable, backupId });
      return r.ok ? { ok: true } : { ok: false, note: r.message || 'No se pudo revertir la entrada de inicio.' };
    }
    case 'appx':
      return restoreAppx(entry.data.packages);
    case 'dns':
      return restoreDns(entry.data);
    case 'folders':
      return restoreCleanStructure(entry.data);
    case 'organize':
      return restoreOrganize(entry.data);
    default:
      return { ok: false, note: 'Tipo de cambio desconocido.' };
  }
}

function pendingEntries(backupId) {
  return readJournal(backupId).entries.filter((e) => !e.restoredAt && !e.irreversible);
}

// Revierte todos los cambios pendientes del respaldo, del más reciente al más antiguo.
async function restoreBackup(backupId) {
  const journal = readJournal(backupId);
  const pending = journal.entries.filter((e) => !e.restoredAt && !e.irreversible).sort((a, b) => b.seq - a.seq);
  if (!pending.length) return { ok: false, error: 'Este respaldo no tiene cambios pendientes por deshacer.' };

  const results = [];
  const storeFamilies = [];
  for (const entry of pending) {
    let r;
    try {
      r = await restoreEntry(entry, backupId);
    } catch (err) {
      r = { ok: false, note: err.message };
    }
    if (r.storeFamilies) storeFamilies.push(...r.storeFamilies);
    // Las apps que se mandan a la Store también cuentan como gestionadas
    if (r.ok || r.storeFamilies?.length) {
      entry.restoredAt = new Date().toISOString();
    }
    entry.restoreNote = r.note || '';
    results.push({ label: entry.label, ok: r.ok, note: r.note || '' });
    writeJournal(backupId, journal);
  }

  const failed = results.filter((r) => !r.ok).length;
  return {
    ok: failed === 0,
    results,
    storeFamilies,
    message: failed === 0
      ? `Se deshicieron ${results.length} cambio(s).`
      : `Se deshicieron ${results.length - failed} de ${results.length} cambio(s). Revisa los detalles.`,
  };
}

module.exports = {
  withUndo,
  restoreBackup,
  pendingEntries,
  // Solo para pruebas
  _internals: { captureRegistry, restoreRegistry, capturePowerPlan, restorePowerPlan, captureAppx, stillInstalledAppx, captureDns },
};
