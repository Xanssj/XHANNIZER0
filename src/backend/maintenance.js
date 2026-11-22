'use strict';

// Mantenimiento: reparar Windows (SFC / DISM / Windows Update), actualizaciones programadas
// con WinGet y exportación de un paquete de diagnóstico para soporte.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runPowerShell, runElevated, psData } = require('./powershell');

// ---------- Reparar Windows (requiere administrador)
const REPAIRS = {
  sfc: {
    label: 'Comprobador de archivos de sistema (SFC)',
    script: `[Console]::OutputEncoding = [System.Text.Encoding]::Unicode
$out = (sfc /scannow 2>&1 | Out-String)
$code = $LASTEXITCODE`,
    timeoutMin: 45,
  },
  dism: {
    label: 'Reparación de la imagen de Windows (DISM)',
    script: `$out = (DISM /Online /Cleanup-Image /RestoreHealth 2>&1 | Out-String)
$code = $LASTEXITCODE`,
    timeoutMin: 60,
  },
  'wu-reset': {
    label: 'Restablecer Windows Update',
    script: `$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$svcs = 'wuauserv','bits','cryptsvc','msiserver'
foreach ($s in $svcs) { Stop-Service -Name $s -Force -ErrorAction SilentlyContinue }
$lines = @()
foreach ($d in @("$env:SystemRoot\\SoftwareDistribution", "$env:SystemRoot\\System32\\catroot2")) {
  if (Test-Path $d) { Rename-Item -LiteralPath $d -NewName ("{0}.old-{1}" -f (Split-Path $d -Leaf), $stamp) -ErrorAction Stop; $lines += "Renombrado: $d (copia conservada)" }
}
foreach ($s in $svcs) { Start-Service -Name $s -ErrorAction SilentlyContinue }
$lines += 'Servicios de Windows Update reiniciados.'
$out = $lines -join [Environment]::NewLine
$code = 0`,
    timeoutMin: 5,
  },
};

async function runRepair(kind) {
  const repair = REPAIRS[kind];
  if (!repair) return { ok: false, error: 'Reparación desconocida.' };
  const logPath = path.join(os.tmpdir(), `xhannizer0-${kind}-${Date.now()}.log`);
  const script = `${repair.script}
@{ code = $code; out = $out } | ConvertTo-Json -Compress | Set-Content -LiteralPath ${psData(logPath)} -Encoding UTF8
exit 0`;
  const elev = await runElevated(script, repair.timeoutMin * 60 * 1000);
  if (elev.cancelled) return { ok: false, error: 'Elevación UAC cancelada por el usuario.' };
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(logPath, 'utf8').replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: `${repair.label}: no terminó o se interrumpió.` };
  } finally {
    try {
      fs.rmSync(logPath, { force: true });
    } catch {
      // Ignorar
    }
  }
  const text = String(data.out || '').replace(/\u0000/g, '').replace(/\r/g, '');
  const tail = text.split('\n').map((l) => l.trim()).filter((l) => l && !/^\[=*\s*\d/.test(l)).slice(-6).join('\n');
  const ok = Number(data.code) === 0;
  return {
    ok,
    label: repair.label,
    message: ok ? `${repair.label}: completado.` : `${repair.label}: terminó con código ${data.code}.`,
    output: tail,
  };
}

// ---------- Actualizaciones programadas (tarea del usuario, sin admin)
const TASK_NAME = 'XHANNIZER0 Actualizacion semanal';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getScheduledUpdate() {
  const ps = `
$t = Get-ScheduledTask -TaskName ${psData(TASK_NAME)} -ErrorAction SilentlyContinue
if (-not $t) { '{"enabled":false}'; exit 0 }
$i = Get-ScheduledTaskInfo -TaskName ${psData(TASK_NAME)}
$tr = $t.Triggers | Select-Object -First 1
@{
  enabled = $true
  nextRun = $(if ($i.NextRunTime) { $i.NextRunTime.ToString('o') } else { $null })
  lastRun = $(if ($i.LastRunTime -and $i.LastRunTime.Year -gt 2000) { $i.LastRunTime.ToString('o') } else { $null })
  lastResult = $i.LastTaskResult
  day = [string]$tr.DaysOfWeek
  time = $(if ($tr.StartBoundary) { ([datetime]$tr.StartBoundary).ToString('HH:mm') } else { $null })
} | ConvertTo-Json -Compress`;
  const r = await runPowerShell(ps, 15000);
  try {
    const data = JSON.parse(r.stdout || '{"enabled":false}');
    // DaysOfWeek llega como máscara de bits (1 = domingo … 64 = sábado)
    const mask = Number(data.day);
    if (mask > 0) data.day = DAYS[Math.log2(mask & -mask)] || 'Sunday';
    if (!data.lastRun) data.lastResult = null;
    return { ok: true, ...data };
  } catch {
    return { ok: false, enabled: false };
  }
}

async function setScheduledUpdate({ enabled, day = 'Sunday', time = '12:00' }) {
  if (!enabled) {
    const r = await runPowerShell(`Unregister-ScheduledTask -TaskName ${psData(TASK_NAME)} -Confirm:$false -ErrorAction SilentlyContinue; exit 0`, 15000);
    return { ok: r.ok, message: 'Actualización automática desactivada.' };
  }
  if (!DAYS.includes(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: 'Día u hora inválidos.' };
  const ps = `
$ErrorActionPreference = 'Stop'
$cmd = 'winget upgrade --all --silent --accept-package-agreements --accept-source-agreements --disable-interactivity'
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -Command "' + $cmd + '"')
$t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${psData(day)} -At ${psData(time)}
$p = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName ${psData(TASK_NAME)} -Description 'Creada por XHANNIZER0: actualiza tus apps con WinGet.' -Action $a -Trigger $t -Principal $p -Settings $s -Force | Out-Null`;
  const r = await runPowerShell(ps, 20000);
  return r.ok
    ? { ok: true, message: 'Actualización automática semanal activada.' }
    : { ok: false, error: 'No se pudo crear la tarea programada.' };
}

// ---------- Paquete de diagnóstico (.zip)
async function exportDiagnostics({ destFile, data }) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'xhannizer0-diag-'));
  try {
    for (const [name, value] of Object.entries(data)) {
      const file = path.join(work, name);
      if (typeof value === 'string') fs.writeFileSync(file, value, 'utf8');
      else fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
    }
    const r = await runPowerShell(
      `Compress-Archive -Path (Join-Path ${psData(work)} '*') -DestinationPath ${psData(destFile)} -Force -ErrorAction Stop`,
      60000
    );
    return r.ok ? { ok: true, path: destFile } : { ok: false, error: 'No se pudo crear el archivo .zip.' };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { runRepair, REPAIRS, getScheduledUpdate, setScheduledUpdate, exportDiagnostics, TASK_NAME };
