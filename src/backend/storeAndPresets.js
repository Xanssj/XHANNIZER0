'use strict';

const { execFile } = require('child_process');
const { iconFromDomain } = require('./catalog');

const FEATURED_MSSTORE = [
  {
    id: 'ms-spotify',
    storeId: '9NCBCSZSJRSB',
    name: 'Spotify',
    vendor: 'Spotify AB',
    category: 'Música',
    iconUrl: iconFromDomain('spotify.com'),
    description: 'Música y podcasts en streaming con integración nativa de controles multimedia en Windows.',
  },
  {
    id: 'ms-whatsapp',
    storeId: '9NKSQGP7F2NH',
    name: 'WhatsApp',
    vendor: 'WhatsApp Inc.',
    category: 'Mensajería',
    iconUrl: iconFromDomain('whatsapp.com'),
    description: 'Cliente nativo rápido para Windows con llamadas, videollamadas y notificaciones instantáneas.',
  },
  {
    id: 'ms-netflix',
    storeId: '9WZDNCRFJ3TJ',
    name: 'Netflix',
    vendor: 'Netflix, Inc.',
    category: 'Entretenimiento',
    iconUrl: iconFromDomain('netflix.com'),
    description: 'Reproducción oficial en alta definición y audio espacial desde Microsoft Store.',
  },
  {
    id: 'ms-apple-music',
    storeId: '9PFHDD62MXS1',
    name: 'Apple Music',
    vendor: 'Apple Inc.',
    category: 'Música',
    iconUrl: iconFromDomain('music.apple.com'),
    description: 'Aplicación oficial de Apple Music para Windows con Audio Lossless y Dolby Atmos.',
  },
  {
    id: 'ms-telegram',
    storeId: '9NZTWSQNTD0S',
    name: 'Telegram Desktop',
    vendor: 'Telegram Messenger',
    category: 'Mensajería',
    iconUrl: iconFromDomain('telegram.org'),
    description: 'Mensajería ultrarrápida en la nube con envío de archivos grandes y sincronización instantánea.',
  },
  {
    id: 'ms-eartrumpet',
    storeId: '9NBLGGH516XP',
    name: 'EarTrumpet',
    vendor: 'File-New-Project',
    category: 'Audio Windows',
    iconUrl: iconFromDomain('github.com'),
    description: 'Mezclador de volumen moderno en la bandeja del sistema para controlar audio por aplicación.',
  },
  {
    id: 'ms-translucenttb',
    storeId: '9PF4KZ2VN4W9',
    name: 'TranslucentTB',
    vendor: 'Charles Milette',
    category: 'Personalización',
    iconUrl: iconFromDomain('github.com'),
    description: 'Barra de tareas translúcida/acrílica minimalista con consumo mínimo de RAM y CPU.',
  },
  {
    id: 'ms-icloud',
    storeId: '9PKTQ5699M62',
    name: 'iCloud para Windows',
    vendor: 'Apple Inc.',
    category: 'Nube',
    iconUrl: iconFromDomain('icloud.com'),
    description: 'Sincroniza Fotos de iCloud, iCloud Drive y Contraseñas de Apple directamente en Windows.',
  },
  {
    id: 'ms-canva',
    storeId: '9P6G39C2B32R',
    name: 'Canva',
    vendor: 'Canva Pty Ltd',
    category: 'Diseño',
    iconUrl: iconFromDomain('canva.com'),
    description: 'Diseño gráfico rápido para presentaciones, redes sociales y documentos visuales.',
  },
  {
    id: 'ms-tiktok',
    storeId: '9NH2GPH4JZS4',
    name: 'TikTok',
    vendor: 'TikTok Pte. Ltd.',
    category: 'Social',
    iconUrl: iconFromDomain('tiktok.com'),
    description: 'Aplicación oficial de TikTok para Windows desde Microsoft Store.',
  },
];

function getFeaturedStoreApps() {
  return FEATURED_MSSTORE;
}

// Busca en vivo en el catálogo real de Microsoft Store usando winget --source msstore
function searchMicrosoftStore(query) {
  const clean = String(query || '').trim();
  if (!clean) return Promise.resolve({ ok: true, source: 'featured', items: FEATURED_MSSTORE });

  return new Promise((resolve) => {
    execFile(
      'winget.exe',
      ['search', clean, '--source', 'msstore', '--accept-source-agreements', '--disable-interactivity'],
      { windowsHide: true, timeout: 14000, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        if (error || !stdout) {
          // Fallback local filtrando destacados si winget/red no responde
          const q = clean.toLowerCase();
          const localMatches = FEATURED_MSSTORE.filter(
            (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
          );
          resolve({
            ok: true,
            source: 'fallback',
            items: localMatches,
            note: 'Búsqueda en catálogo local (WinGet MS Store no disponible en esta sesión).',
          });
          return;
        }

        const lines = String(stdout).split(/\r?\n/);
        const sepIndex = lines.findIndex((l) => /^-{5,}/.test(l.trim()));
        if (sepIndex === -1) {
          resolve({ ok: true, source: 'msstore', items: [] });
          return;
        }

        const parsed = [];
        for (const rawLine of lines.slice(sepIndex + 1)) {
          const line = rawLine.trim();
          if (!line) continue;
          // Formato típico de tabla msstore: Name   Id (9XXXXXXXXXXX o XPXXXXXXXXXX)   Version
          const match = line.match(/^(.+?)\s{2,}([A-Z0-9]{10,16})\s*(.*)$/i);
          if (!match) continue;
          const name = match[1].trim();
          const storeId = match[2].trim();
          if (!name || !storeId) continue;

          const known = FEATURED_MSSTORE.find((f) => f.storeId.toUpperCase() === storeId.toUpperCase());
          parsed.push({
            id: `ms-${storeId.toLowerCase()}`,
            storeId,
            name,
            vendor: known?.vendor || 'Microsoft Store',
            category: known?.category || 'Microsoft Store',
            iconUrl: known?.iconUrl || iconFromDomain('apps.microsoft.com'),
            description: known?.description || `Aplicación oficial de Microsoft Store (ID: ${storeId}).`,
          });
          if (parsed.length >= 24) break;
        }

        resolve({ ok: true, source: 'msstore', items: parsed });
      }
    );
  });
}

// Construye los 4 Presets Experimentales adaptados al hardware real detectado del PC
function buildHardwarePresets(system) {
  const sys = system || {};
  const ramGb = Number(sys.ramGb || 16);
  const gpuVendor = sys.gpuVendor || 'Desconocida';
  const dGpuName = sys.dedicatedGpuName || null;
  const dGpuVram = Number(sys.dedicatedGpuVramGb || 0);
  const hasStrongGpu = Boolean(dGpuName && dGpuVram >= 6);
  const has16GbRam = ramGb >= 16;
  const laptop = sys.formFactor === 'laptop';

  const hwBadge = dGpuName
    ? `${sys.cpuName?.split(' ').slice(0, 4).join(' ') || 'CPU'} · ${dGpuName} (${dGpuVram || '?'} GB) · ${ramGb} GB RAM`
    : `${sys.cpuName?.split(' ').slice(0, 4).join(' ') || 'CPU'} · iGPU · ${ramGb} GB RAM`;

  const gamingApps = ['steam', 'discord', 'brave', 'vcredist', 'hwinfo64', 'msi-afterburner', '7zip'];
  if (gpuVendor === 'NVIDIA') gamingApps.splice(1, 0, 'nvidia-app');

  const devApps = ['vscode', 'cursor', 'git', 'nodejs-lts', 'python3', 'windows-terminal', 'postman', 'obsidian', '7zip', 'brave'];
  if (has16GbRam) devApps.push('docker-desktop');
  if (hasStrongGpu && dGpuVram >= 8) devApps.push('ollama');

  return [
    {
      id: 'preset-gaming',
      name: 'Gaming',
      badge: 'Recomendado',
      tone: 'accent',
      summary: 'Máxima fluidez en juegos, monitoreo de temperaturas/FPS y librerías esenciales adaptadas a tu tarjeta gráfica.',
      hardwareNote:
        gpuVendor === 'NVIDIA'
          ? `Detectada GPU NVIDIA (${dGpuName}): incluye NVIDIA App y evita herramientas de otros fabricantes.`
          : dGpuName
          ? `Detectada GPU ${gpuVendor} (${dGpuName}): se omite NVIDIA App automáticamente para evitar conflictos.`
          : 'Detectada solo GPU integrada (iGPU): se priorizan utilidades ligeras sin overlays pesados.',
      hardwareProfile: hwBadge,
      appIds: gamingApps,
      optimizations: [
        'Activar Modo Juego nativo de Windows (Game Mode)',
        laptop
          ? 'Configurar plan de energía Equilibrado (en portátiles cuida la batería y la temperatura)'
          : 'Configurar plan de energía de Alto Rendimiento (seguro en PC de escritorio)',
        'Verificar librerías Visual C++ Redistributable x64',
      ],
    },
    {
      id: 'preset-dev',
      name: 'Programadores / Developers',
      badge: 'Más aclamado',
      tone: 'purple',
      summary: 'Entorno completo de desarrollo moderno: editores, IA para programar, runtimes, Git, APIs y organización técnica.',
      hardwareNote: [
        has16GbRam
          ? `RAM suficiente (${ramGb} GB): incluye Docker Desktop.`
          : `RAM ajustada (${ramGb} GB): Docker Desktop se omite por defecto para no saturar memoria.`,
        hasStrongGpu && dGpuVram >= 8
          ? `GPU con ${dGpuVram} GB VRAM: incluye Ollama para ejecutar IA local sin lags.`
          : 'Sin GPU >= 8 GB VRAM: se prioriza Cursor (IA en la nube) en lugar de modelos locales pesados.',
      ].join(' '),
      hardwareProfile: hwBadge,
      appIds: devApps,
      optimizations: [
        'Crear estructura limpia de carpetas para proyectos (XhanniWorkspace)',
        'Activar extensiones de archivo visibles en el Explorador de Windows',
        'Configurar plan de energía Equilibrado / Alto Rendimiento',
      ],
    },
    {
      id: 'preset-school',
      name: 'Uso Escolar / Estudios',
      badge: 'Ligero',
      tone: 'green',
      summary: 'Equipo rápido, sin distracciones, ideal para clases, apuntes, investigación, PDFs y videollamadas.',
      hardwareNote: `Optimizado para bajo consumo y estabilidad en ${ramGb} GB RAM sin procesos en segundo plano innecesarios.`,
      hardwareProfile: hwBadge,
      appIds: ['brave', 'notion', 'obsidian', 'vlc', '7zip', 'everything'],
      optimizations: [
        'Configurar plan de energía Equilibrado para menor ruido y temperatura',
        'Crear carpeta limpia de estudios y documentos',
      ],
    },
    {
      id: 'preset-office',
      name: 'Uso de Oficina / Productividad',
      badge: 'Estable',
      tone: 'orange',
      summary: 'Productividad diaria en Windows 11 con búsqueda instantánea, ventanas organizadas y archivadores modernos.',
      hardwareNote: `Configuración estable y conservadora compatible con ${hwBadge}.`,
      hardwareProfile: hwBadge,
      appIds: ['brave', 'nanazip', '7zip', 'everything', 'powertoys', 'notepadpp', 'notion', 'vlc'],
      optimizations: [
        'Configurar plan de energía Equilibrado',
        'Mostrar extensiones de archivos para trabajo seguro con documentos',
      ],
    },
  ];
}

// Ejecuta únicamente optimizaciones seguras y reversibles de Windows (siempre tras Backup Gate)
function applyPresetOptimizations({ presetId, backupId }) {
  if (!backupId) {
    return Promise.resolve({
      ok: false,
      error: 'Se requiere una copia de seguridad verificada antes de aplicar optimizaciones del sistema.',
    });
  }

  let ps = `$ErrorActionPreference = 'SilentlyContinue'\n`;
  const laptop = require('./hardware').getLastHardwareScan()?.system?.formFactor === 'laptop';
  if (presetId === 'preset-gaming') {
    // En portátiles Alto rendimiento gasta la batería y calienta: se usa Equilibrado
    const plan = laptop ? '381b4222-f694-41f0-9685-ff5bb260df2e' : '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
    ps += `
if (-not (Test-Path -Path 'HKCU:\\Software\\Microsoft\\GameBar')) { New-Item -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Force | Out-Null }
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AllowAutoGameMode' -Value 1 -Type DWord
powercfg /setactive ${plan} 2>$null
Write-Output 'Game Mode activado y plan de energía ajustado.'
`;
  } else if (presetId === 'preset-dev' || presetId === 'preset-office') {
    ps += `
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'HideFileExt' -Value 0 -Type DWord
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null
Write-Output 'Extensiones visibles habilitadas y plan de energía equilibrado aplicado.'
`;
  } else {
    ps += `
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null
Write-Output 'Plan de energía equilibrado aplicado de forma segura.'
`;
  }

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, timeout: 12000 },
      (err, stdout) => {
        resolve({
          ok: !err,
          message: String(stdout || '').trim() || 'Optimizaciones seguras aplicadas correctamente.',
        });
      }
    );
  });
}

module.exports = {
  getFeaturedStoreApps,
  searchMicrosoftStore,
  buildHardwarePresets,
  applyPresetOptimizations,
};
