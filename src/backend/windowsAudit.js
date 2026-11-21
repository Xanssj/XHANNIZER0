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

async function scanWindowsSettings(hardwareSystem) {
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$gameMode = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AllowAutoGameMode').AllowAutoGameMode
$hags = (Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode').HwSchMode
$hideExt = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt').HideFileExt
$mouseSpeed = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed').MouseSpeed
$advId = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Name 'Enabled').Enabled
$clipboard = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Name 'EnableClipboardHistory').EnableClipboardHistory
$darkApps = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'AppsUseLightTheme').AppsUseLightTheme
$powerRaw = (powercfg /getactivescheme) -join ' '
$refreshRates = @(Get-CimInstance Win32_VideoController | Where-Object { $_.CurrentRefreshRate -gt 0 } | Select-Object -ExpandProperty CurrentRefreshRate)
$maxHz = if ($refreshRates.Count -gt 0) { ($refreshRates | Measure-Object -Maximum).Maximum } else { 60 }
$startupCount = @(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' | ForEach-Object { $_.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } }).Count

@{
  gameMode = $gameMode
  hags = $hags
  hideExt = $hideExt
  mouseSpeed = $mouseSpeed
  advId = $advId
  clipboard = $clipboard
  darkApps = $darkApps
  powerRaw = $powerRaw
  maxHz = $maxHz
  startupCount = $startupCount
} | ConvertTo-Json -Compress
`;

  const res = await runPowerShell(psScript, 15000);
  let data = {};
  if (res.ok && res.stdout) {
    try {
      data = JSON.parse(res.stdout);
    } catch {
      data = {};
    }
  }

  const hasDedicatedGpu = Boolean(hardwareSystem?.dedicatedGpuName);
  const powerRaw = String(data.powerRaw || '');
  const isHighPerf = /8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c|e9a42b02-d5df-448d-aa00-03f14749eb61|alto rendimiento|high performance|ultimate/i.test(powerRaw);
  const isBalanced = /381b4222-f694-41f0-9685-ff5bb260df2e|equilibrado|balanced/i.test(powerRaw);
  const powerLabel = isHighPerf ? 'Alto rendimiento' : isBalanced ? 'Equilibrado' : 'Plan personalizado';

  const items = [
    {
      id: 'win-gamemode',
      category: 'Rendimiento',
      name: 'Modo Juego de Windows (Game Mode)',
      description: 'Evita que Windows Update o tareas secundarias interrumpan partidas y prioriza recursos para juegos.',
      currentState: data.gameMode === 0 ? 'Desactivado' : 'Activado',
      isOptimal: data.gameMode !== 0,
      canApply: true,
      impact: 'Recomendado',
    },
    {
      id: 'win-hags',
      category: 'Gráficos',
      name: 'Programación de GPU acelerada por hardware (HAGS)',
      description: hasDedicatedGpu
        ? `Tu ${hardwareSystem.dedicatedGpuName} aprovecha HAGS para menor latencia y soporte de Frame Generation.`
        : 'Permite a la GPU gestionar su propia cola de memoria de video para reducir sobrecarga en CPU.',
      currentState: data.hags === 2 ? 'Activado' : 'Desactivado',
      isOptimal: data.hags === 2,
      canApply: true,
      requiresRestart: true,
      impact: hasDedicatedGpu ? 'Alta prioridad' : 'Opcional',
    },
    {
      id: 'win-refresh-rate',
      category: 'Monitor',
      name: 'Frecuencia de actualización del monitor (Hz)',
      description: 'Tras formatear, Windows suele dejar los monitores de 144Hz/165Hz/240Hz limitados a 60 Hz. Verifica que estés usando el máximo real de tu pantalla.',
      currentState: `${data.maxHz || 60} Hz detectados`,
      isOptimal: Number(data.maxHz || 60) > 60,
      canApply: true,
      applyLabel: 'Abrir pantalla',
      impact: Number(data.maxHz || 60) <= 60 ? 'Revisar tras formateo' : 'Óptimo',
    },
    {
      id: 'win-mouse-accel',
      category: 'Precisión',
      name: 'Desactivar aceleración del mouse (1:1 Raw)',
      description: 'Desactiva «Mejorar la precisión del puntero» para lograr movimiento 1:1 consistente en escritorio y shooters.',
      currentState: String(data.mouseSpeed) === '0' ? 'Desactivada (1:1)' : 'Activada',
      isOptimal: String(data.mouseSpeed) === '0',
      canApply: true,
      impact: 'Recomendado',
    },
    {
      id: 'win-file-ext',
      category: 'Seguridad / Dev',
      name: 'Mostrar extensiones de archivo en el Explorador',
      description: 'Evita confundir ejecutables disfrazados (.pdf.exe) y agiliza el trabajo con archivos de configuración y código.',
      currentState: data.hideExt === 0 ? 'Visibles' : 'Ocultas',
      isOptimal: data.hideExt === 0,
      canApply: true,
      impact: 'Esencial',
    },
    {
      id: 'win-clipboard',
      category: 'Productividad',
      name: 'Historial del portapapeles (Win + V)',
      description: 'Guarda múltiples textos y enlaces copiados para pegarlos rápidamente con Win + V.',
      currentState: data.clipboard === 1 ? 'Activado' : 'Desactivado',
      isOptimal: data.clipboard === 1,
      canApply: true,
      impact: 'Muy útil',
    },
    {
      id: 'win-privacy-ads',
      category: 'Privacidad',
      name: 'Desactivar ID de publicidad de Windows',
      description: 'Impide que Windows y apps utilicen un identificador de seguimiento para anuncios personalizados.',
      currentState: data.advId === 0 ? 'Desactivado (Limpio)' : 'Activado',
      isOptimal: data.advId === 0,
      canApply: true,
      impact: 'Privacidad',
    },
    {
      id: 'win-power-plan',
      category: 'Energía',
      name: 'Plan de energía óptimo del sistema',
      description: 'Configura un plan de energía estable sin estrangulamiento agresivo de frecuencia para escritorio.',
      currentState: powerLabel,
      isOptimal: isHighPerf || isBalanced,
      canApply: true,
      impact: 'Rendimiento',
    },
    {
      id: 'win-dark-mode',
      category: 'Estética',
      name: 'Modo oscuro nativo de Windows',
      description: 'Mantiene coherencia visual en todo el sistema operativo y reduce fatiga visual nocturna.',
      currentState: data.darkApps === 0 ? 'Activado' : 'Modo claro',
      isOptimal: data.darkApps === 0,
      canApply: true,
      impact: 'Estética',
    },
  ];

  const pendingCount = items.filter((i) => !i.isOptimal).length;
  return {
    items,
    pendingCount,
    optimalCount: items.length - pendingCount,
    startupCount: Number(data.startupCount || 0),
  };
}

async function applyWindowsSetting({ settingId, backupId }) {
  if (!backupId) {
    return {
      ok: false,
      error: 'Se requiere una copia de seguridad vigente antes de modificar configuraciones de Windows.',
    };
  }

  const commands = {
    'win-gamemode': `
      New-Item -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Force | Out-Null
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AllowAutoGameMode' -Value 1 -Type DWord
      Write-Output 'Modo Juego activado correctamente.'
    `,
    'win-hags': `
      Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2 -Type DWord -ErrorAction Stop
      Write-Output 'HAGS activado (requiere reiniciar Windows para aplicar).'
    `,
    'win-refresh-rate': `
      Start-Process 'ms-settings:display-advancedgraphics'
      Write-Output 'Configuración avanzada de pantalla abierta para seleccionar los Hz máximos.'
    `,
    'win-mouse-accel': `
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed' -Value '0'
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold1' -Value '0'
      Set-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseThreshold2' -Value '0'
      Write-Output 'Aceleración del mouse desactivada (movimiento 1:1).'
    `,
    'win-file-ext': `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt' -Value 0 -Type DWord
      Write-Output 'Extensiones de archivo visibles habilitadas.'
    `,
    'win-clipboard': `
      New-Item -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Force | Out-Null
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Name 'EnableClipboardHistory' -Value 1 -Type DWord
      Write-Output 'Historial del portapapeles (Win + V) activado.'
    `,
    'win-privacy-ads': `
      New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Force | Out-Null
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Name 'Enabled' -Value 0 -Type DWord
      Write-Output 'ID de publicidad de Windows desactivado.'
    `,
    'win-power-plan': `
      powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
      if ($LASTEXITCODE -ne 0) { powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null }
      Write-Output 'Plan de energía óptimo aplicado.'
    `,
    'win-dark-mode': `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'AppsUseLightTheme' -Value 0 -Type DWord
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'SystemUsesLightTheme' -Value 0 -Type DWord
      Write-Output 'Modo oscuro nativo activado.'
    `,
  };

  const ps = commands[settingId];
  if (!ps) return { ok: false, error: 'Configuración desconocida.' };

  const res = await runPowerShell(ps, 12000);
  if (!res.ok && settingId === 'win-hags') {
    // Auto-elevación UAC bajo demanda solo cuando se requiere modificar HKLM
    const elevatedCmd = `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "Set-ItemProperty -Path ''HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers'' -Name ''HwSchMode'' -Value 2 -Type DWord"'`;
    const elevRes = await runPowerShell(elevatedCmd, 25000);
    return {
      ok: elevRes.ok,
      message: elevRes.ok
        ? 'HAGS activado con elevación UAC (reinicia Windows para aplicar).'
        : 'Elevación UAC cancelada por el usuario.',
    };
  }
  return {
    ok: res.ok,
    message: res.stdout || (res.ok ? 'Configuración aplicada.' : res.stderr || 'No se pudo aplicar.'),
  };
}

module.exports = {
  scanWindowsSettings,
  applyWindowsSetting,
};
