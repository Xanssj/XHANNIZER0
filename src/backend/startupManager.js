'use strict';

const { execFile } = require('child_process');

function runPowerShell(script, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024 },
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

async function listStartupApps() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$items = @()

# Leer HKCU\\...\\Run (activos)
$hkcuRun = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
if ($hkcuRun) {
  foreach ($p in $hkcuRun.PSObject.Properties) {
    if ($p.Name -match '^PS') { continue }
    $items += [PSCustomObject]@{
      id = "hkcu::$($p.Name)"
      name = $p.Name
      command = [string]$p.Value
      scope = 'Usuario (HKCU)'
      enabled = $true
      canToggle = $true
    }
  }
}

# Leer desactivados por XHANNIZER0 (reversibles 100%)
$hkcuOff = Get-ItemProperty -Path 'HKCU:\\Software\\XHANNIZER0\\DisabledStartup'
if ($hkcuOff) {
  foreach ($p in $hkcuOff.PSObject.Properties) {
    if ($p.Name -match '^PS') { continue }
    $items += [PSCustomObject]@{
      id = "hkcu::$($p.Name)"
      name = $p.Name
      command = [string]$p.Value
      scope = 'Usuario (HKCU)'
      enabled = $false
      canToggle = $true
    }
  }
}

# Leer HKLM\\...\\Run (solo lectura sin admin, o informativo)
$hklmRun = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
if ($hklmRun) {
  foreach ($p in $hklmRun.PSObject.Properties) {
    if ($p.Name -match '^PS') { continue }
    $items += [PSCustomObject]@{
      id = "hklm::$($p.Name)"
      name = $p.Name
      command = [string]$p.Value
      scope = 'Sistema (HKLM)'
      enabled = $true
      canToggle = $false
    }
  }
}

@($items) | ConvertTo-Json -Compress
`;
  const res = await runPowerShell(ps, 12000);
  if (!res.ok || !res.stdout) return { ok: true, items: [] };
  try {
    const parsed = JSON.parse(res.stdout);
    const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    return { ok: true, items: list };
  } catch {
    return { ok: true, items: [] };
  }
}

async function toggleStartupApp({ name, enable, backupId }) {
  if (!backupId) {
    return { ok: false, error: 'Se requiere una copia de seguridad vigente antes de modificar el inicio de Windows.' };
  }
  const safeName = String(name || '').replace(/'/g, "''");
  if (!safeName) return { ok: false, error: 'Nombre de entrada inválido.' };

  const ps = enable
    ? `
$ErrorActionPreference = 'Stop'
$src = 'HKCU:\\Software\\XHANNIZER0\\DisabledStartup'
$dst = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
$val = (Get-ItemProperty -Path $src -Name '${safeName}').'${safeName}'
Set-ItemProperty -Path $dst -Name '${safeName}' -Value $val
Remove-ItemProperty -Path $src -Name '${safeName}'
Write-Output 'Aplicación reactivada en el inicio de Windows.'
`
    : `
$ErrorActionPreference = 'Stop'
$src = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
$dst = 'HKCU:\\Software\\XHANNIZER0\\DisabledStartup'
if (-not (Test-Path -Path $dst)) { New-Item -Path $dst -Force | Out-Null }
$val = (Get-ItemProperty -Path $src -Name '${safeName}').'${safeName}'
Set-ItemProperty -Path $dst -Name '${safeName}' -Value $val
Remove-ItemProperty -Path $src -Name '${safeName}'
Write-Output 'Aplicación desactivada del inicio de Windows (reversible en cualquier momento).'
`;

  const res = await runPowerShell(ps, 10000);
  return {
    ok: res.ok,
    message: res.ok ? res.stdout : res.stderr || 'No se pudo modificar esta entrada de inicio.',
  };
}

module.exports = {
  listStartupApps,
  toggleStartupApp,
};
