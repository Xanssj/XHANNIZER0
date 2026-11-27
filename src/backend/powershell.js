'use strict';

// Utilidades compartidas para ejecutar PowerShell de forma segura desde el proceso principal.
const { execFile } = require('child_process');
const path = require('path');

const POWERSHELL_EXE = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell.exe';

let cachedAdminState = null;

function runPowerShell(script, timeout = 25000) {
  return new Promise((resolve) => {
    execFile(
      POWERSHELL_EXE,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
        });
      }
    );
  });
}

// Expresión PowerShell que reconstruye `value` desde JSON en Base64:
// los datos nunca se interpolan como texto, así que las comillas no pueden romper el script.
function psData(value) {
  const safeVal = value === undefined ? null : value;
  const b64 = Buffer.from(JSON.stringify(safeVal), 'utf8').toString('base64');
  return `([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | ConvertFrom-Json)`;
}

// Detecta una sola vez por sesión si el proceso ya corre con permisos de Administrador.
async function isRunningAsAdmin(deps = {}) {
  if (process.platform !== 'win32') return false;
  if (!deps.forceRefresh && typeof cachedAdminState === 'boolean') return cachedAdminState;
  const runPs = deps.runPowerShell || runPowerShell;
  const checkScript =
    '([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)';
  const r = await runPs(checkScript, 8000);
  const isAdmin = Boolean(r.ok && /^true$/i.test(String(r.stdout || '').trim()));
  if (!deps.runPowerShell) cachedAdminState = isAdmin;
  return isAdmin;
}

// Ejecuta `script` en un PowerShell elevado. El script viaja como -EncodedCommand.
// Si el proceso ya es Administrador, ejecuta POWERSHELL_EXE directo (cero UAC repetidos).
// Devuelve { ok, cancelled }.
async function runElevated(script, timeout = 60000, deps = {}) {
  const encoded = Buffer.from(`$ErrorActionPreference = 'Stop'\n${script}`, 'utf16le').toString('base64');
  const alreadyAdmin = typeof deps.isAdmin === 'boolean' ? deps.isAdmin : await isRunningAsAdmin();

  if (alreadyAdmin) {
    const execFn = deps.execFile || execFile;
    return new Promise((resolve) => {
      execFn(
        POWERSHELL_EXE,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 },
        (error) => {
          resolve({ ok: !error, cancelled: false, directAdmin: true });
        }
      );
    });
  }

  const runPs = deps.runPowerShell || runPowerShell;
  const launcher = [
    "$ErrorActionPreference = 'Stop'",
    `$psExe = ${psData(POWERSHELL_EXE)}`,
    'try {',
    `  $p = Start-Process -FilePath $psExe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}'`,
    "} catch { Write-Output 'UAC_CANCELLED'; exit 2 }",
    'exit $p.ExitCode',
  ].join('\n');
  const r = await runPs(launcher, timeout);
  return { ok: r.ok, cancelled: /UAC_CANCELLED/.test(r.stdout) };
}

// Relanza un ejecutable con -Verb RunAs pasando ruta, argumentos y cwd de forma segura vía psData.
async function relaunchAsAdmin({ execPath, args = [], cwd = '' } = {}, deps = {}) {
  if (!execPath || typeof execPath !== 'string') {
    return { ok: false, cancelled: false, error: 'Ruta de ejecutable inválida.' };
  }
  const safeArgs = Array.isArray(args) ? args.map((a) => String(a)) : [];
  const runPs = deps.runPowerShell || runPowerShell;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$cfg = ${psData({ exe: execPath, args: safeArgs, cwd: String(cwd || '') })}`,
    "$params = @{ FilePath = $cfg.exe; Verb = 'RunAs' }",
    'if ($cfg.args -and @($cfg.args).Count -gt 0) { $params.ArgumentList = [string[]]@($cfg.args) }',
    'if ($cfg.cwd) { $params.WorkingDirectory = $cfg.cwd }',
    'try {',
    '  Start-Process @params | Out-Null',
    "  Write-Output 'ELEVATED_OK'",
    "} catch { Write-Output 'UAC_CANCELLED'; exit 2 }",
  ].join('\n');
  const r = await runPs(script, 30000);
  const cancelled = /UAC_CANCELLED/.test(r.stdout);
  if (r.ok && /ELEVATED_OK/.test(r.stdout)) {
    return { ok: true, cancelled: false };
  }
  return {
    ok: false,
    cancelled,
    error: cancelled
      ? 'Elevación UAC cancelada por el usuario.'
      : 'No se pudo relanzar XHANNIZER0 como Administrador.',
  };
}

module.exports = {
  runPowerShell,
  runElevated,
  isRunningAsAdmin,
  relaunchAsAdmin,
  psData,
  POWERSHELL_EXE,
};
