'use strict';

const { execFile } = require('child_process');
const { runElevated, psData } = require('./powershell');

// =========================================================================
// Windows 11: limpieza opcional (todos reversibles con «Deshacer cambios»)
// values: valores de registro que se escriben · keys: claves que se crean (se borran al deshacer)
// =========================================================================
const ADV = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const CDM = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager';
const CLASSIC_MENU_KEY = 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}';
const dword = (path, name, value) => ({ path, name, value, type: 'DWord' });

const WIN11_TWEAKS = [
  {
    id: 'w11-start-ads', name: 'Quitar anuncios y recomendaciones del menú Inicio',
    description: 'Oculta apps «recomendadas», sugerencias y promociones del menú Inicio y de Configuración.',
    values: [dword(ADV, 'Start_IrisRecommendations', 0), dword(CDM, 'SubscribedContent-338388Enabled', 0), dword(CDM, 'SubscribedContent-338389Enabled', 0), dword(CDM, 'SystemPaneSuggestionsEnabled', 0)],
    restartExplorer: true,
  },
  {
    id: 'w11-lockscreen-ads', name: 'Quitar anuncios de la pantalla de bloqueo',
    description: 'Desactiva los datos curiosos, consejos y publicidad sobre la pantalla de bloqueo.',
    values: [dword(CDM, 'RotatingLockScreenOverlayEnabled', 0), dword(CDM, 'SubscribedContent-338387Enabled', 0)],
  },
  {
    id: 'w11-bing', name: 'Quitar búsquedas de Bing del menú Inicio',
    description: 'La búsqueda de Inicio solo mostrará apps, archivos y ajustes de tu PC, sin resultados web.',
    values: [dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', 0)],
    restartExplorer: true,
  },
  {
    id: 'w11-widgets', name: 'Desactivar Widgets (noticias y clima de MSN)',
    description: 'Quita el panel de Widgets y su feed de noticias de la barra de tareas. Pide permisos de administrador.',
    values: [dword('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh', 'AllowNewsAndInterests', 0)],
    elevated: true, restartExplorer: true,
  },
  {
    id: 'w11-recall', name: 'Desactivar Recall (capturas de pantalla con IA)',
    description: 'Impide que Windows guarde capturas periódicas de tu actividad en equipos Copilot+. Pide permisos de administrador.',
    values: [dword('HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsAI', 'DisableAIDataAnalysis', 1)],
    elevated: true, minBuild: 26100,
  },
  {
    id: 'w11-tailored', name: 'Desactivar experiencias personalizadas y encuestas',
    description: 'Microsoft deja de usar tus datos de diagnóstico para sugerencias y Windows no te pedirá opiniones.',
    values: [dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', 'TailoredExperiencesWithDiagnosticDataEnabled', 0), dword('HKCU:\\Software\\Microsoft\\Siuf\\Rules', 'NumberOfSIUFInPeriod', 0)],
  },
  {
    id: 'w11-context-menu', name: 'Menú contextual clásico (clic derecho completo)',
    description: 'Muestra el menú de clic derecho completo de Windows 10, sin pasar por «Mostrar más opciones».',
    values: [{ path: `${CLASSIC_MENU_KEY}\\InprocServer32`, name: '(default)', value: '', type: 'String' }],
    keys: [CLASSIC_MENU_KEY],
    restartExplorer: true,
  },
  {
    id: 'w11-taskbar-left', name: 'Barra de tareas alineada a la izquierda',
    description: 'Vuelve a poner el botón Inicio y los iconos a la izquierda, como en Windows 10.',
    values: [dword(ADV, 'TaskbarAl', 0)],
  },
];

const needsElevation = (p) => /^HKLM:/i.test(p) || /^HKCU:\\Software\\Policies/i.test(p);

function applyValuesScript(values) {
  return `
foreach ($v in @(${psData(values)})) {
  if (-not (Test-Path -LiteralPath $v.path)) { New-Item -Path $v.path -Force | Out-Null }
  if ($v.name -eq '(default)') { Set-Item -LiteralPath $v.path -Value $v.value }
  else { Set-ItemProperty -LiteralPath $v.path -Name $v.name -Value $v.value -Type $v.type -ErrorAction Stop }
}
exit 0`;
}

async function scanWin11Tweaks(build) {
  const available = WIN11_TWEAKS.filter((t) => build >= 22000 && build >= (t.minBuild || 0));
  if (!available.length) return [];
  const ps = `
$out = @{}
foreach ($t in @(${psData(available.map((t) => ({ id: t.id, values: t.values })))})) {
  $ok = $true
  foreach ($v in @($t.values)) {
    $item = Get-Item -LiteralPath $v.path -ErrorAction SilentlyContinue
    $name = if ($v.name -eq '(default)') { '' } else { $v.name }
    if (-not $item -or -not ($item.GetValueNames() -contains $name) -or ([string]$item.GetValue($name) -ne [string]$v.value)) { $ok = $false }
  }
  $out[$t.id] = $ok
}
$out | ConvertTo-Json -Compress`;
  const r = await runPowerShell(ps, 12000);
  let state = {};
  try {
    state = JSON.parse(r.stdout || '{}');
  } catch {
    state = {};
  }
  return available.map((t) => ({
    id: t.id,
    group: 'win11',
    optional: true,
    category: 'Windows 11',
    name: t.name,
    description: t.description,
    currentState: state[t.id] ? 'Aplicado' : 'Predeterminado de Windows',
    isOptimal: Boolean(state[t.id]),
    canApply: true,
    impact: t.elevated ? 'Opcional · Admin' : 'Opcional',
    requiresRestart: false,
    restartExplorer: Boolean(t.restartExplorer),
  }));
}

async function applyWin11Tweak(tweak) {
  const script = applyValuesScript(tweak.values);
  const r = tweak.elevated || tweak.values.some((v) => needsElevation(v.path))
    ? await runElevated(script, 30000)
    : await runPowerShell(`$ErrorActionPreference = 'Stop'
${script}`, 12000);
  const tail = tweak.restartExplorer ? ' Reinicia el Explorador para verlo.' : '';
  if (r.ok) return { ok: true, message: `${tweak.name}: aplicado.${tail}` };
  return { ok: false, message: r.cancelled ? 'Elevación UAC cancelada por el usuario.' : `No se pudo aplicar: ${tweak.name}.` };
}

async function restartExplorer() {
  const r = await runPowerShell('Stop-Process -Name explorer -Force; Start-Sleep -Milliseconds 1500; if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }', 15000);
  return { ok: r.ok, message: r.ok ? 'Explorador de Windows reiniciado.' : 'No se pudo reiniciar el Explorador.' };
}

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
$showHidden = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden').Hidden
$mouseSpeed = (Get-ItemProperty -Path 'HKCU:\\Control Panel\\Mouse' -Name 'MouseSpeed').MouseSpeed
$advId = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Name 'Enabled').Enabled
$clipboard = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Name 'EnableClipboardHistory').EnableClipboardHistory
$darkApps = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'AppsUseLightTheme').AppsUseLightTheme
$powerRaw = (powercfg /getactivescheme) -join ' '
$hiberEnabled = (Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power' -Name 'HibernateEnabled').HibernateEnabled
$hiberFile = Test-Path -LiteralPath "$env:SystemDrive\\hiberfil.sys"
$refreshRates = @(Get-CimInstance Win32_VideoController | Where-Object { $_.CurrentRefreshRate -gt 0 } | Select-Object -ExpandProperty CurrentRefreshRate)
$maxHz = if ($refreshRates.Count -gt 0) { ($refreshRates | Measure-Object -Maximum).Maximum } else { 60 }
$build = [Environment]::OSVersion.Version.Build
$startupCount = @(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' | ForEach-Object { $_.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } }).Count

@{
  gameMode = $gameMode
  hags = $hags
  hideExt = $hideExt
  showHidden = $showHidden
  mouseSpeed = $mouseSpeed
  advId = $advId
  clipboard = $clipboard
  darkApps = $darkApps
  powerRaw = $powerRaw
  hiberEnabled = $hiberEnabled
  hiberFile = $hiberFile
  maxHz = $maxHz
  startupCount = $startupCount
  build = $build
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
      caution: 'Requiere reiniciar Windows. En tarjetas muy antiguas o ciertos flujos con OBS/VR puede causar tirones; es 100 % reversible.',
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
      description: hardwareSystem?.formFactor === 'laptop'
        ? 'En portátiles se usa Equilibrado: rinde bien enchufado y cuida la batería y la temperatura.'
        : 'Configura un plan de energía estable sin estrangulamiento agresivo de frecuencia para escritorio.',
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
  const build = Number(data.build || 0);
  const win11Items = await scanWin11Tweaks(build);
  const isLaptop = hardwareSystem?.formFactor === 'laptop';
  const isUltimate = /e9a42b02-d5df-448d-aa00-03f14749eb61|ultimate|m[aá]ximo rendimiento/i.test(powerRaw);
  const hiberOff = data.hiberEnabled === 0 && !data.hiberFile;

  const extraOptional = [
    {
      id: 'win-show-hidden',
      group: 'win11',
      optional: true,
      category: 'Explorador',
      name: 'Mostrar archivos y carpetas ocultos',
      description: 'Muestra AppData, .env y archivos ocultos en el Explorador de Windows. Muy útil para desarrolladores y técnicos.',
      currentState: data.showHidden === 1 ? 'Visibles' : 'Ocultos (predeterminado)',
      isOptimal: data.showHidden === 1,
      canApply: true,
      impact: 'Opcional',
    },
    {
      id: 'win-ultimate-power',
      group: 'win11',
      optional: true,
      category: 'Energía avanzada',
      name: 'Desbloquear plan «Máximo rendimiento» (Ultimate Performance)',
      description: 'Desbloquea el perfil nativo oculto de Windows para PCs de escritorio de alto rendimiento sin micro-ahorros de energía.',
      currentState: isUltimate ? 'Activo' : 'No activo',
      isOptimal: isUltimate,
      canApply: true,
      impact: isLaptop ? 'Precaución · Portátil' : 'Opcional · Escritorio',
      riskLevel: isLaptop ? 'warn' : 'info',
      caution: isLaptop
        ? 'No recomendado en portátiles: reduce la duración de la batería y aumenta la temperatura en reposo. En portátiles usa «Equilibrado».'
        : 'Aumenta levemente el consumo eléctrico en reposo porque evita los estados profundos de ahorro. Reversible desde Respaldos.',
    },
    {
      id: 'win-hibernation-off',
      group: 'win11',
      optional: true,
      category: 'Espacio SSD',
      name: 'Desactivar hibernación y liberar hiberfil.sys (6–16 GB)',
      description: 'Ejecuta powercfg /h off para eliminar el archivo de hibernación del disco C: y recuperar espacio en el SSD.',
      currentState: hiberOff ? 'Desactivada (espacio libre)' : 'Activada',
      isOptimal: hiberOff,
      canApply: true,
      impact: 'Precaución · Admin',
      riskLevel: 'warn',
      caution: isLaptop
        ? 'NO recomendado en portátiles: desactiva la hibernación por batería crítica (riesgo de perder trabajo abierto si se agota la batería) y el Inicio rápido.'
        : 'Desactiva también el «Inicio rápido» de Windows (en SSD NVMe apenas cambia 1–2 s). Reversible con «Deshacer cambios» o powercfg /h on.',
    },
  ];

  return {
    // Los ajustes opcionales (Windows 11 + avanzados) no cuentan como «pendientes»
    items: [...items, ...extraOptional, ...win11Items],
    pendingCount,
    optimalCount: items.length - pendingCount,
    startupCount: Number(data.startupCount || 0),
    isWindows11: build >= 22000,
  };
}

async function applyWindowsSetting({ settingId, backupId }) {
  if (!backupId) {
    return {
      ok: false,
      error: 'Se requiere una copia de seguridad vigente antes de modificar configuraciones de Windows.',
    };
  }

  const tweak = WIN11_TWEAKS.find((t) => t.id === settingId);
  if (tweak) return applyWin11Tweak(tweak);
  // En portátiles el plan óptimo es Equilibrado (Alto rendimiento gasta batería y calienta)
  const laptop = require('./hardware').getLastHardwareScan()?.system?.formFactor === 'laptop';
  const powerPlan = laptop ? '381b4222-f694-41f0-9685-ff5bb260df2e' : '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';

  const commands = {
    'win-gamemode': `
      if (-not (Test-Path -Path 'HKCU:\\Software\\Microsoft\\GameBar')) { New-Item -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Force | Out-Null }
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
      if (-not (Test-Path -Path 'HKCU:\\Software\\Microsoft\\Clipboard')) { New-Item -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Force | Out-Null }
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Name 'EnableClipboardHistory' -Value 1 -Type DWord
      Write-Output 'Historial del portapapeles (Win + V) activado.'
    `,
    'win-privacy-ads': `
      if (-not (Test-Path -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo')) { New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Force | Out-Null }
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo' -Name 'Enabled' -Value 0 -Type DWord
      Write-Output 'ID de publicidad de Windows desactivado.'
    `,
    'win-power-plan': `
      powercfg /setactive ${powerPlan} 2>$null
      if ($LASTEXITCODE -ne 0) { powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null }
      Write-Output 'Plan de energía óptimo aplicado.'
    `,
    'win-dark-mode': `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'AppsUseLightTheme' -Value 0 -Type DWord
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name 'SystemUsesLightTheme' -Value 0 -Type DWord
      Write-Output 'Modo oscuro nativo activado.'
    `,
    'win-show-hidden': `
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'Hidden' -Value 1 -Type DWord
      Write-Output 'Archivos y carpetas ocultos visibles en el Explorador.'
    `,
    'win-ultimate-power': `
      $existing = (powercfg /list) -join "\`n"
      $guid = $null
      if ($existing -match '([0-9a-f-]{36})\\s*\\([^)]*(?:Ultimate|M[aá]ximo rendimiento)') {
        $guid = $Matches[1]
      } else {
        $dup = (powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>&1) -join ' '
        if ($dup -match '([0-9a-f-]{36})') { $guid = $Matches[1] }
      }
      if ($guid) {
        powercfg /setactive $guid 2>$null
        if ($LASTEXITCODE -eq 0) { Write-Output 'Plan Máximo rendimiento (Ultimate Performance) activado.' } else { exit 1 }
      } else {
        powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
        Write-Output 'Plan Alto rendimiento activado (Ultimate Performance no disponible en este equipo).'
      }
    `,
  };

  if (settingId === 'win-hibernation-off') {
    const elevRes = await runElevated('powercfg /h off; if ($LASTEXITCODE -ne 0) { exit 1 }', 30000);
    return {
      ok: elevRes.ok,
      message: elevRes.ok
        ? 'Hibernación desactivada (hiberfil.sys liberado). Puedes reactivarla con «Deshacer cambios».'
        : elevRes.cancelled
          ? 'Elevación UAC cancelada por el usuario.'
          : 'No se pudo desactivar la hibernación.',
    };
  }

  const ps = commands[settingId];
  if (!ps) return { ok: false, error: 'Configuración desconocida.' };

  const res = await runPowerShell(ps, 12000);
  if (!res.ok && settingId === 'win-hags') {
    // Auto-elevación UAC bajo demanda solo cuando se requiere modificar HKLM
    const elevRes = await runElevated(
      "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name 'HwSchMode' -Value 2 -Type DWord",
      30000
    );
    return {
      ok: elevRes.ok,
      message: elevRes.ok
        ? 'HAGS activado con elevación UAC (reinicia Windows para aplicar).'
        : elevRes.cancelled
          ? 'Elevación UAC cancelada por el usuario.'
          : 'No se pudo activar HAGS.',
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
  restartExplorer,
  WIN11_TWEAKS,
};
