'use strict';

// Utilidades compartidas para ejecutar PowerShell de forma segura desde el proceso principal.
const { execFile } = require('child_process');
const path = require('path');

const POWERSHELL_EXE = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell.exe';

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

// Ejecuta `script` en un PowerShell elevado (UAC). El script viaja como -EncodedCommand.
// Devuelve { ok, cancelled }.
async function runElevated(script, timeout = 60000) {
  const encoded = Buffer.from(`$ErrorActionPreference = 'Stop'\n${script}`, 'utf16le').toString('base64');
  const launcher = [
    "$ErrorActionPreference = 'Stop'",
    `$psExe = ${psData(POWERSHELL_EXE)}`,
    'try {',
    `  $p = Start-Process -FilePath $psExe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}'`,
    "} catch { Write-Output 'UAC_CANCELLED'; exit 2 }",
    'exit $p.ExitCode',
  ].join('\n');
  const r = await runPowerShell(launcher, timeout);
  return { ok: r.ok, cancelled: /UAC_CANCELLED/.test(r.stdout) };
}

module.exports = { runPowerShell, runElevated, psData, POWERSHELL_EXE };
