'use strict';

// «Antes y después»: toma una foto del estado del PC (RAM en reposo, procesos, servicios,
// programas al inicio, uso de CPU, espacio libre y tiempo de arranque) para comparar la mejora.
const fs = require('fs');
const path = require('path');
const { runPowerShell } = require('./powershell');

let storeFile = null;
function initBenchmark(dir) {
  storeFile = path.join(dir, 'antes-y-despues.json');
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  } catch {
    return { baseline: null, latest: null };
  }
}

function writeStore(data) {
  if (!storeFile) return;
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf8');
}

const SNAPSHOT_PS = `
$os = Get-CimInstance Win32_OperatingSystem
$samples = 1..4 | ForEach-Object { (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; Start-Sleep -Milliseconds 600 }
$boot = $null
try {
  $ev = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100 } -MaxEvents 1 -ErrorAction Stop
  $boot = [int](([xml]$ev.ToXml()).Event.EventData.Data | Where-Object { $_.Name -eq 'BootTime' }).'#text'
} catch { }
$sys = Get-PSDrive -Name ($env:SystemDrive.TrimEnd(':'))
@{
  ramUsedMb = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1024)
  ramTotalMb = [math]::Round($os.TotalVisibleMemorySize / 1024)
  processes = @(Get-Process).Count
  services = @(Get-Service | Where-Object Status -eq 'Running').Count
  cpuIdlePct = [math]::Round(($samples | Measure-Object -Average).Average, 1)
  diskFreeGb = [math]::Round($sys.Free / 1GB, 1)
  bootMs = $boot
  uptimeMin = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalMinutes)
} | ConvertTo-Json -Compress`;

async function takeSnapshot({ startupEnabled = null } = {}) {
  const r = await runPowerShell(SNAPSHOT_PS, 45000);
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    return { ok: false, error: 'No se pudo medir el estado del PC.' };
  }
  return { ok: true, snapshot: { ...data, startupEnabled, takenAt: new Date().toISOString() } };
}

// Métricas comparables: menos es mejor en todas menos el espacio libre
const METRICS = [
  { key: 'bootMs', label: 'Tiempo de arranque', unit: 's', scale: 0.001, lowerIsBetter: true },
  { key: 'ramUsedMb', label: 'RAM usada en reposo', unit: 'GB', scale: 1 / 1024, lowerIsBetter: true },
  { key: 'processes', label: 'Procesos en ejecución', unit: '', scale: 1, lowerIsBetter: true },
  { key: 'services', label: 'Servicios activos', unit: '', scale: 1, lowerIsBetter: true },
  { key: 'startupEnabled', label: 'Programas al inicio', unit: '', scale: 1, lowerIsBetter: true },
  { key: 'cpuIdlePct', label: 'Uso de CPU en reposo', unit: '%', scale: 1, lowerIsBetter: true },
  { key: 'diskFreeGb', label: 'Espacio libre en el disco del sistema', unit: 'GB', scale: 1, lowerIsBetter: false },
];

function compareSnapshots(before, after) {
  if (!before || !after) return [];
  return METRICS.filter((m) => Number.isFinite(before[m.key]) && Number.isFinite(after[m.key])).map((m) => {
    const b = before[m.key];
    const a = after[m.key];
    const changePct = b === 0 ? 0 : Math.round(((a - b) / b) * 100);
    const improved = m.lowerIsBetter ? a < b : a > b;
    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      before: Math.round(b * m.scale * 10) / 10,
      after: Math.round(a * m.scale * 10) / 10,
      changePct,
      improved,
      same: a === b,
    };
  });
}

function getBenchmark() {
  const store = readStore();
  return { ok: true, ...store, comparison: compareSnapshots(store.baseline, store.latest) };
}

function saveSnapshot(snapshot, asBaseline) {
  const store = readStore();
  if (asBaseline || !store.baseline) store.baseline = snapshot;
  else store.latest = snapshot;
  if (asBaseline) store.latest = null;
  writeStore(store);
  return getBenchmark();
}

// Deja solo números conocidos: la foto puede venir de un archivo de migración (USB).
function sanitizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const m of METRICS) if (Number.isFinite(raw[m.key])) out[m.key] = raw[m.key];
  if (Number.isFinite(raw.ramTotalMb)) out.ramTotalMb = raw.ramTotalMb;
  if (!Object.keys(out).length) return null;
  const at = new Date(raw.takenAt);
  out.takenAt = Number.isNaN(at.getTime()) ? null : at.toISOString();
  if (typeof raw.pcName === 'string') out.pcName = raw.pcName.slice(0, 64);
  return out;
}

// «Antes» traído desde la USB de migración: lo que se midió en el PC antes de formatear.
// Solo reemplaza una línea base más vieja (o inexistente).
function importBaseline(raw) {
  const snap = sanitizeSnapshot(raw);
  if (!snap) return { imported: false };
  const store = readStore();
  const current = store.baseline?.takenAt ? new Date(store.baseline.takenAt).getTime() : 0;
  const incoming = snap.takenAt ? new Date(snap.takenAt).getTime() : 0;
  if (store.baseline && current >= incoming) return { imported: false };
  store.baseline = { ...snap, fromMigration: true };
  store.latest = null;
  writeStore(store);
  return { imported: true };
}

module.exports = { initBenchmark, takeSnapshot, saveSnapshot, getBenchmark, compareSnapshots, importBaseline, sanitizeSnapshot, METRICS };
