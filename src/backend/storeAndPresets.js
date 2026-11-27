'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { iconFromDomain } = require('./catalog');
const { runPowerShell, runElevated, psData } = require('./powershell');
const { detectCapabilities } = require('./hardwareCapabilities');
const { createRestorePoint } = require('./maintenance');
const { CLEAN_STRUCTURE_FOLDERS } = require('./safetyBackup');

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

// =========================================================================
// Presets profesionales por niveles — Cero humo y 100 % reversibles
// Nunca toca Defender, Windows Update, Audio, Xbox, Anticheats, pagefile ni bcdedit
// =========================================================================
const POWER_BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const POWER_HIGH = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const POWER_ULTIMATE_TEMPLATE = 'e9a42b02-d5df-448d-aa00-03f14749eb61';

const ADV = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const CDM = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager';
const dword = (p, name, value) => ({ path: p, name, value, type: 'DWord' });
const strVal = (p, name, value) => ({ path: p, name, value: String(value), type: 'String' });
const isHklm = (p) => /^HKLM:/i.test(p) || /^HKCU:\\Software\\Policies/i.test(p);

// Servicios no críticos seguros de pasar a Manual (Start = 3) solo en Gaming Full Competitivo
const SAFE_COMPETITIVE_SERVICES = ['DiagTrack', 'MapsBroker', 'RetailDemo', 'Fax'];
const STUDY_FOLDERS = ['01_Clases', '02_Apuntes', '03_Trabajos', '04_Lecturas_PDF', '05_Examenes'];

const TWEAK_DISTRACTIONS_USER = [
  dword(ADV, 'Start_IrisRecommendations', 0),
  dword(CDM, 'SubscribedContent-338388Enabled', 0),
  dword(CDM, 'SubscribedContent-338389Enabled', 0),
  dword(CDM, 'SystemPaneSuggestionsEnabled', 0),
  dword(CDM, 'RotatingLockScreenOverlayEnabled', 0),
  dword(CDM, 'SubscribedContent-338387Enabled', 0),
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', 0),
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', 'Enabled', 0),
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', 'TailoredExperiencesWithDiagnosticDataEnabled', 0),
  dword('HKCU:\\Software\\Microsoft\\Siuf\\Rules', 'NumberOfSIUFInPeriod', 0),
];

const TWEAK_WIDGETS_POLICY = [
  dword('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh', 'AllowNewsAndInterests', 0),
];

const TWEAK_GAME_CORE = [
  dword('HKCU:\\Software\\Microsoft\\GameBar', 'AllowAutoGameMode', 1),
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', 0),
  dword('HKCU:\\System\\GameConfigStore', 'GameDVR_Enabled', 0),
  strVal('HKCU:\\Control Panel\\Mouse', 'MouseSpeed', '0'),
  strVal('HKCU:\\Control Panel\\Mouse', 'MouseThreshold1', '0'),
  strVal('HKCU:\\Control Panel\\Mouse', 'MouseThreshold2', '0'),
];

const TWEAK_HAGS_ON = [
  dword('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers', 'HwSchMode', 2),
];

const TWEAK_WINDOWED_GAMING = [
  strVal('HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences', 'DirectXUserGlobalSettings', 'SwapEffectUpgradeEnable=1;'),
];

const TWEAK_BACKGROUND_APPS_OFF = [
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications', 'GlobalUserDisabled', 1),
];

const TWEAK_VISUAL_FX_LIGHT = [
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects', 'VisualFXSetting', 3),
  strVal('HKCU:\\Control Panel\\Desktop\\WindowMetrics', 'MinAnimate', '0'),
  dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'EnableTransparency', 0),
];

const TWEAK_MMCSS_GAMING = [
  dword('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile', 'NetworkThrottlingIndex', 0xffffffff),
  dword('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile', 'SystemResponsiveness', 10),
];

const TWEAK_VBS_OFF = [
  dword('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard', 'EnableVirtualizationBasedSecurity', 0),
  dword('HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity', 'Enabled', 0),
];

const TWEAK_FILE_EXT = [dword(ADV, 'HideFileExt', 0)];
const TWEAK_SHOW_HIDDEN = [dword(ADV, 'Hidden', 1)];
const TWEAK_CLIPBOARD = [dword('HKCU:\\Software\\Microsoft\\Clipboard', 'EnableClipboardHistory', 1)];

const DEFAULT_TIER_BY_PRESET = {
  'preset-gaming': 'gaming-basic',
  'preset-dev': 'dev-standard',
  'preset-office': 'office-stable',
  'preset-school': 'school-light',
};

function dedupeRegValues(list) {
  const seen = new Map();
  for (const v of list) {
    seen.set(`${v.path.toLowerCase()}::${v.name.toLowerCase()}`, v);
  }
  return Array.from(seen.values());
}

function getSystemCapabilities(system, overrideCaps) {
  const sys = system || {};
  if (overrideCaps) return overrideCaps;
  const gpuNames = [sys.dedicatedGpuName, sys.integratedGpuName].filter(Boolean);
  return detectCapabilities({
    cpuName: sys.cpuName || '',
    gpuNames,
    motherboardVendor: sys.motherboardVendor || '',
    motherboardModel: sys.motherboardModel || '',
    formFactor: sys.formFactor || 'desktop',
    osBuild: Number(sys.buildNumber) || 0,
  });
}

// Resuelve el plan exacto y declarativo de un preset + nivel (usado por UI, aplicador y restore.js)
function resolvePresetPlan({ presetId, tierId, disableVbs = false } = {}, system = null, overrideCaps = null) {
  const sys = system || {};
  const caps = getSystemCapabilities(sys, overrideCaps);
  const ramGb = Number(sys.ramGb || 16);
  const gpuVendor = sys.gpuVendor || 'Desconocida';
  const dGpuName = sys.dedicatedGpuName || null;
  const dGpuVram = Number(sys.dedicatedGpuVramGb || 0);
  const hasStrongGpu = Boolean(dGpuName && dGpuVram >= 6);
  const has16GbRam = ramGb >= 16;
  const laptop = sys.formFactor === 'laptop';
  const supportsHags = caps.supportsHags === true;

  const resolvedPresetId = DEFAULT_TIER_BY_PRESET[presetId] ? presetId : 'preset-gaming';
  const resolvedTierId = tierId || DEFAULT_TIER_BY_PRESET[resolvedPresetId];

  const gamingApps = ['steam', 'discord', 'brave', 'vcredist', 'hwinfo64', 'msi-afterburner', '7zip'];
  if (gpuVendor === 'NVIDIA') gamingApps.splice(1, 0, 'nvidia-app');

  const devStandardApps = ['vscode', 'cursor', 'git', 'nodejs-lts', 'python3', 'windows-terminal', 'postman', 'obsidian', '7zip', 'brave'];
  const devProApps = [...devStandardApps];
  if (has16GbRam) devProApps.push('docker-desktop');
  if (hasStrongGpu && dGpuVram >= 8) devProApps.push('ollama');

  const officeApps = ['brave', 'nanazip', '7zip', 'everything', 'powertoys', 'notepadpp', 'notion', 'vlc'];
  const schoolApps = ['brave', 'notion', 'obsidian', 'vlc', '7zip', 'everything'];

  const home = os.homedir();
  const workspaceDev = { baseDir: path.join(home, 'XhanniWorkspace'), subdirs: CLEAN_STRUCTURE_FOLDERS };
  const workspaceStudy = { baseDir: path.join(home, 'XhanniEstudios'), subdirs: STUDY_FOLDERS };

  if (resolvedPresetId === 'preset-gaming') {
    if (resolvedTierId === 'gaming-basic') {
      return {
        presetId: 'preset-gaming',
        tierId: 'gaming-basic',
        tierName: 'Básico / Seguro',
        tierLabel: 'Gaming Básico',
        badge: 'Seguro',
        experimental: false,
        requiresRestorePoint: false,
        failClosedRestorePoint: false,
        warningNote: '',
        appIds: gamingApps,
        powerMode: laptop ? 'balanced' : 'high',
        regValues: dedupeRegValues([...TWEAK_GAME_CORE]),
        services: [],
        workspaceDir: null,
        optimizations: [
          'Activar Modo Juego nativo de Windows (Game Mode ON)',
          'Desactivar Game DVR / grabación en segundo plano (sin pérdida de FPS)',
          laptop
            ? 'Plan de energía Equilibrado (en portátiles cuida batería y temperaturas)'
            : 'Plan de energía Alto Rendimiento (seguro en PC de escritorio)',
          'Precisión del mouse 1:1 (desactivar aceleración de Windows)',
        ],
        capabilities: caps,
      };
    }

    if (resolvedTierId === 'gaming-medium') {
      const regValues = [
        ...TWEAK_GAME_CORE,
        ...(supportsHags ? TWEAK_HAGS_ON : []),
        ...TWEAK_WINDOWED_GAMING,
        ...TWEAK_DISTRACTIONS_USER,
        ...TWEAK_WIDGETS_POLICY,
        ...TWEAK_BACKGROUND_APPS_OFF,
      ];
      const optimizations = [
        'Todo lo de Gaming Básico (Game Mode ON, Game DVR OFF, plan adaptado y mouse 1:1)',
        ...(supportsHags
          ? ['Activar HAGS (programación acelerada por GPU compatible con tu gráfica)']
          : []),
        'Activar optimizaciones para juegos en ventana (menor latencia de cuadro)',
        'Quitar anuncios del menú Inicio, pantalla de bloqueo, Bing, Widgets y telemetría publicitaria',
        'Limitar aplicaciones en segundo plano de Windows',
        'Crear Punto de Restauración real de Windows antes de aplicar',
      ];
      return {
        presetId: 'preset-gaming',
        tierId: 'gaming-medium',
        tierName: 'Medio / Optimizado',
        tierLabel: 'Gaming Medio',
        badge: 'Recomendado',
        experimental: false,
        requiresRestorePoint: true,
        failClosedRestorePoint: false,
        warningNote: '',
        appIds: gamingApps,
        powerMode: laptop ? 'balanced' : 'high',
        regValues: dedupeRegValues(regValues),
        services: [],
        workspaceDir: null,
        optimizations,
        capabilities: caps,
      };
    }

    // gaming-competitive (Experimental)
    const regValues = [
      ...TWEAK_GAME_CORE,
      ...(supportsHags ? TWEAK_HAGS_ON : []),
      ...TWEAK_WINDOWED_GAMING,
      ...TWEAK_DISTRACTIONS_USER,
      ...TWEAK_WIDGETS_POLICY,
      ...TWEAK_BACKGROUND_APPS_OFF,
      ...TWEAK_VISUAL_FX_LIGHT,
      ...TWEAK_MMCSS_GAMING,
      ...(disableVbs ? TWEAK_VBS_OFF : []),
    ];
    const optimizations = [
      'Todo lo de Gaming Medio (Game Mode, Game DVR OFF, mouse 1:1, sin anuncios/Widgets ni apps en segundo plano)',
      ...(supportsHags ? ['Activar HAGS (programación acelerada por GPU compatible)'] : []),
      laptop
        ? 'Mantener plan Equilibrado en portátil (evita sobrecalentamiento; nunca fuerza Máximo rendimiento en laptop)'
        : 'Activar plan de energía Máximo rendimiento (Ultimate Performance en escritorio)',
      'Reducir efectos visuales y transparencias de Windows (mantiene fuentes nítidas)',
      'Ajustar MMCSS (NetworkThrottlingIndex y SystemResponsiveness) para menor latencia',
      'Pasar a inicio Manual 4 servicios no críticos seguros (DiagTrack, MapsBroker, RetailDemo y Fax) — intactos Defender, Audio, Update y Anticheats',
      ...(disableVbs
        ? ['Desactivar VBS / Integridad de memoria (opción marcada: reduce aislamiento de núcleo por FPS extra; requiere reinicio)']
        : []),
      'Punto de Restauración real de Windows OBLIGATORIO (si falla, se bloquea la aplicación)',
    ];
    return {
      presetId: 'preset-gaming',
      tierId: 'gaming-competitive',
      tierName: 'Full Competitivo',
      tierLabel: 'Gaming Full Competitivo (Experimental)',
      badge: 'Experimental',
      experimental: true,
      requiresRestorePoint: true,
      failClosedRestorePoint: true,
      supportsVbsOption: true,
      warningNote: 'Solo para PC dedicado a jugar. Crea un Punto de Restauración real obligatorio; si falla, el cambio se cancela por seguridad.',
      appIds: gamingApps,
      powerMode: laptop ? 'balanced' : 'ultimate',
      regValues: dedupeRegValues(regValues),
      services: [...SAFE_COMPETITIVE_SERVICES],
      workspaceDir: null,
      optimizations,
      capabilities: caps,
    };
  }

  if (resolvedPresetId === 'preset-dev') {
    if (resolvedTierId === 'dev-pro') {
      return {
        presetId: 'preset-dev',
        tierId: 'dev-pro',
        tierName: 'Pro',
        tierLabel: 'Dev Pro',
        badge: 'Más aclamado',
        experimental: false,
        requiresRestorePoint: true,
        failClosedRestorePoint: false,
        warningNote: '',
        appIds: devProApps,
        powerMode: laptop ? 'balanced' : 'high',
        regValues: dedupeRegValues([
          ...TWEAK_FILE_EXT,
          ...TWEAK_SHOW_HIDDEN,
          ...TWEAK_CLIPBOARD,
          ...TWEAK_DISTRACTIONS_USER,
          ...TWEAK_WIDGETS_POLICY,
        ]),
        services: [],
        workspaceDir: workspaceDev,
        optimizations: [
          'Mostrar extensiones de archivo y archivos ocultos en el Explorador',
          'Activar historial del portapapeles (Win + V)',
          laptop
            ? 'Plan de energía Equilibrado para trabajo sostenido en portátil'
            : 'Plan de energía Alto Rendimiento para compilaciones y contenedores',
          'Crear carpeta real de proyectos en tu usuario (XhanniWorkspace)',
          'Limpiar distracciones (anuncios de Inicio, Bing, Widgets y telemetría publicitaria)',
          'Crear Punto de Restauración real de Windows antes de aplicar',
        ],
        capabilities: caps,
      };
    }

    return {
      presetId: 'preset-dev',
      tierId: 'dev-standard',
      tierName: 'Estándar',
      tierLabel: 'Dev Estándar',
      badge: 'Estándar',
      experimental: false,
      requiresRestorePoint: false,
      failClosedRestorePoint: false,
      warningNote: '',
      appIds: devStandardApps,
      powerMode: laptop ? 'balanced' : 'high',
      regValues: dedupeRegValues([...TWEAK_FILE_EXT, ...TWEAK_CLIPBOARD]),
      services: [],
      workspaceDir: workspaceDev,
      optimizations: [
        'Mostrar extensiones de archivo visibles en el Explorador',
        'Activar historial del portapapeles (Win + V)',
        laptop
          ? 'Plan de energía Equilibrado en portátil'
          : 'Plan de energía Alto Rendimiento en escritorio',
        'Crear carpeta real de proyectos en tu usuario (XhanniWorkspace)',
      ],
      capabilities: caps,
    };
  }

  if (resolvedPresetId === 'preset-office') {
    if (resolvedTierId === 'office-clean') {
      return {
        presetId: 'preset-office',
        tierId: 'office-clean',
        tierLabel: 'Oficina Productividad limpia',
        tierName: 'Productividad limpia',
        badge: 'Productividad',
        experimental: false,
        requiresRestorePoint: true,
        failClosedRestorePoint: false,
        warningNote: '',
        appIds: officeApps,
        powerMode: 'balanced',
        regValues: dedupeRegValues([
          ...TWEAK_FILE_EXT,
          ...TWEAK_CLIPBOARD,
          ...TWEAK_DISTRACTIONS_USER,
          ...TWEAK_WIDGETS_POLICY,
        ]),
        services: [],
        workspaceDir: workspaceDev,
        optimizations: [
          'Plan de energía Equilibrado para silencio y estabilidad',
          'Mostrar extensiones de archivo y activar historial del portapapeles (Win + V)',
          'Limpiar distracciones (anuncios Inicio, pantalla de bloqueo, Bing, Widgets y telemetría publicitaria)',
          'Crear carpeta real de trabajo (XhanniWorkspace)',
          'Crear Punto de Restauración real de Windows antes de aplicar',
        ],
        capabilities: caps,
      };
    }

    return {
      presetId: 'preset-office',
      tierId: 'office-stable',
      tierName: 'Estable',
      tierLabel: 'Oficina Estable',
      badge: 'Estable',
      experimental: false,
      requiresRestorePoint: false,
      failClosedRestorePoint: false,
      warningNote: '',
      appIds: officeApps,
      powerMode: 'balanced',
      regValues: dedupeRegValues([...TWEAK_FILE_EXT, ...TWEAK_CLIPBOARD]),
      services: [],
      workspaceDir: null,
      optimizations: [
        'Plan de energía Equilibrado',
        'Mostrar extensiones de archivo para trabajar seguro con documentos',
        'Activar historial del portapapeles (Win + V)',
      ],
      capabilities: caps,
    };
  }

  // preset-school
  return {
    presetId: 'preset-school',
    tierId: 'school-light',
    tierName: 'Ligero / Silencioso',
    tierLabel: 'Estudios Ligero',
    badge: 'Ligero',
    experimental: false,
    requiresRestorePoint: false,
    failClosedRestorePoint: false,
    warningNote: '',
    appIds: schoolApps,
    powerMode: 'balanced',
    regValues: dedupeRegValues([...TWEAK_FILE_EXT, ...TWEAK_CLIPBOARD, ...TWEAK_DISTRACTIONS_USER]),
    services: [],
    workspaceDir: workspaceStudy,
    optimizations: [
      'Plan de energía Equilibrado para menor ruido y temperatura',
      'Mostrar extensiones de archivo y activar historial del portapapeles (Win + V)',
      'Limpiar anuncios y sugerencias del menú Inicio, pantalla de bloqueo y Bing',
      'Crear carpeta real de estudios y apuntes (XhanniEstudios)',
    ],
    capabilities: caps,
  };
}

// Devuelve los objetivos exactos que restore.js debe respaldar antes de aplicar un preset
function getPresetUndoTarget(payload = {}, system = null, overrideCaps = null) {
  const sys = system || require('./hardware').getLastHardwareScan()?.system || {};
  const plan = resolvePresetPlan(payload, sys, overrideCaps);
  const reg = [
    ...plan.regValues.map((v) => ({ path: v.path, name: v.name })),
    ...plan.services.map((svc) => ({ path: `HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${svc}`, name: 'Start' })),
  ];
  const workspaceDirs = plan.workspaceDir
    ? [plan.workspaceDir.baseDir, ...plan.workspaceDir.subdirs.map((sub) => path.join(plan.workspaceDir.baseDir, sub))]
    : [];
  return {
    label: `Optimización de preset (${plan.tierLabel})`,
    reg,
    power: Boolean(plan.powerMode),
    workspaceDirs,
  };
}

// Construye los 4 perfiles profesionales por niveles adaptados al hardware real detectado
function buildHardwarePresets(system, overrideCaps = null) {
  const sys = system || {};
  const caps = getSystemCapabilities(sys, overrideCaps);
  const ramGb = Number(sys.ramGb || 16);
  const gpuVendor = sys.gpuVendor || 'Desconocida';
  const dGpuName = sys.dedicatedGpuName || null;
  const dGpuVram = Number(sys.dedicatedGpuVramGb || 0);
  const hasStrongGpu = Boolean(dGpuName && dGpuVram >= 6);
  const has16GbRam = ramGb >= 16;

  const hwBadge = dGpuName
    ? `${sys.cpuName?.split(' ').slice(0, 4).join(' ') || 'CPU'} · ${dGpuName} (${dGpuVram || '?'} GB) · ${ramGb} GB RAM`
    : `${sys.cpuName?.split(' ').slice(0, 4).join(' ') || 'CPU'} · iGPU · ${ramGb} GB RAM`;

  const tierSummary = (plan) => ({
    id: plan.tierId,
    name: plan.tierName,
    label: plan.tierLabel,
    badge: plan.badge,
    experimental: plan.experimental,
    requiresRestorePoint: plan.requiresRestorePoint,
    failClosedRestorePoint: plan.failClosedRestorePoint,
    supportsVbsOption: Boolean(plan.supportsVbsOption),
    warningNote: plan.warningNote || '',
    appIds: plan.appIds,
    optimizations: plan.optimizations,
    powerMode: plan.powerMode,
  });

  const gamingTiers = [
    tierSummary(resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-basic' }, sys, caps)),
    tierSummary(resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-medium' }, sys, caps)),
    tierSummary(resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-competitive' }, sys, caps)),
  ];
  const devTiers = [
    tierSummary(resolvePresetPlan({ presetId: 'preset-dev', tierId: 'dev-standard' }, sys, caps)),
    tierSummary(resolvePresetPlan({ presetId: 'preset-dev', tierId: 'dev-pro' }, sys, caps)),
  ];
  const officeTiers = [
    tierSummary(resolvePresetPlan({ presetId: 'preset-office', tierId: 'office-stable' }, sys, caps)),
    tierSummary(resolvePresetPlan({ presetId: 'preset-office', tierId: 'office-clean' }, sys, caps)),
  ];
  const schoolTiers = [
    tierSummary(resolvePresetPlan({ presetId: 'preset-school', tierId: 'school-light' }, sys, caps)),
  ];

  const hagsNote = caps.supportsHags === true
    ? 'GPU compatible con HAGS (se activa desde el nivel Medio).'
    : 'Tu GPU no admite HAGS o no es concluyente: se omite automáticamente.';

  return [
    {
      id: 'preset-gaming',
      name: 'Gaming',
      badge: '3 niveles',
      tone: 'accent',
      defaultTierId: 'gaming-basic',
      tiers: gamingTiers,
      summary: 'Elige entre Básico seguro, Medio optimizado o Full Competitivo (Experimental) adaptado a tu GPU y equipo.',
      hardwareNote:
        (gpuVendor === 'NVIDIA'
          ? `Detectada GPU NVIDIA (${dGpuName}): incluye NVIDIA App y evita herramientas de otros fabricantes.`
          : dGpuName
          ? `Detectada GPU ${gpuVendor} (${dGpuName}): se omite NVIDIA App automáticamente para evitar conflictos.`
          : 'Detectada solo GPU integrada (iGPU): se priorizan utilidades ligeras sin overlays pesados.') + ` ${hagsNote}`,
      hardwareProfile: hwBadge,
      appIds: gamingTiers[0].appIds,
      optimizations: gamingTiers[0].optimizations,
    },
    {
      id: 'preset-dev',
      name: 'Programación / Dev',
      badge: '2 niveles',
      tone: 'purple',
      defaultTierId: 'dev-standard',
      tiers: devTiers,
      summary: 'Entorno completo de desarrollo moderno: Estándar listo en minutos o Pro con contenedores e IA local según tu hardware.',
      hardwareNote: [
        has16GbRam
          ? `RAM suficiente (${ramGb} GB): el nivel Pro incluye Docker Desktop.`
          : `RAM ajustada (${ramGb} GB): Docker Desktop se omite por defecto para no saturar memoria.`,
        hasStrongGpu && dGpuVram >= 8
          ? `GPU con ${dGpuVram} GB VRAM: el nivel Pro incluye Ollama para ejecutar IA local sin lags.`
          : 'Sin GPU >= 8 GB VRAM: se prioriza Cursor (IA en la nube) en lugar de modelos locales pesados.',
      ].join(' '),
      hardwareProfile: hwBadge,
      appIds: devTiers[0].appIds,
      optimizations: devTiers[0].optimizations,
    },
    {
      id: 'preset-office',
      name: 'Oficina / Trabajo',
      badge: '2 niveles',
      tone: 'orange',
      defaultTierId: 'office-stable',
      tiers: officeTiers,
      summary: 'Productividad diaria en Windows: elige Estable conservador o Productividad limpia sin anuncios ni distracciones.',
      hardwareNote: `Configuración estable y reversible adaptada a ${hwBadge}.`,
      hardwareProfile: hwBadge,
      appIds: officeTiers[0].appIds,
      optimizations: officeTiers[0].optimizations,
    },
    {
      id: 'preset-school',
      name: 'Estudios / Casa',
      badge: 'Ligero',
      tone: 'green',
      defaultTierId: 'school-light',
      tiers: schoolTiers,
      summary: 'Equipo rápido, silencioso y sin distracciones, ideal para clases, apuntes, investigación, PDFs y videollamadas.',
      hardwareNote: `Optimizado para bajo consumo y estabilidad en ${ramGb} GB RAM sin procesos en segundo plano innecesarios.`,
      hardwareProfile: hwBadge,
      appIds: schoolTiers[0].appIds,
      optimizations: schoolTiers[0].optimizations,
    },
  ];
}

function buildValuesScript(values) {
  if (!values.length) return '';
  return `
foreach ($v in @(${psData(values)})) {
  if (-not (Test-Path -LiteralPath $v.path)) { New-Item -Path $v.path -Force | Out-Null }
  if ($v.name -eq '(default)') { Set-Item -LiteralPath $v.path -Value $v.value -ErrorAction Stop }
  else { Set-ItemProperty -LiteralPath $v.path -Name $v.name -Value $v.value -Type $v.type -ErrorAction Stop }
}`;
}

function buildServicesManualScript(services) {
  if (!services.length) return '';
  return `
foreach ($svc in @(${psData(services)})) {
  $p = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\$svc"
  if (Test-Path -LiteralPath $p) {
    Set-ItemProperty -LiteralPath $p -Name 'Start' -Value 3 -Type DWord -ErrorAction SilentlyContinue
  }
}`;
}

function buildUltimatePowerScript() {
  return `
$out = powercfg -duplicatescheme ${POWER_ULTIMATE_TEMPLATE} 2>&1 | Out-String
$m = [regex]::Match($out, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
if ($m.Success) {
  powercfg /setactive $m.Value 2>$null
} else {
  powercfg /setactive ${POWER_HIGH} 2>$null
}`;
}

// Ejecuta optimizaciones reales y reversibles del preset + Punto de Restauración real cuando corresponde
async function applyPresetOptimizations(payload = {}, deps = {}) {
  const { presetId, tierId, backupId, disableVbs = false } = payload || {};
  if (!backupId) {
    return {
      ok: false,
      error: 'Se requiere una copia de seguridad verificada antes de aplicar optimizaciones del sistema.',
    };
  }

  const sys = deps.system || payload.system || require('./hardware').getLastHardwareScan()?.system || {};
  const plan = resolvePresetPlan({ presetId, tierId, disableVbs: Boolean(disableVbs) }, sys, deps.capabilities || null);
  const runPs = deps.runPowerShell || runPowerShell;
  const runElev = deps.runElevated || runElevated;
  const makeRestorePoint = deps.createRestorePoint || createRestorePoint;

  let restorePointCreated = false;
  let restorePointWarning = '';

  if (plan.requiresRestorePoint) {
    const rp = await makeRestorePoint(`XHANNIZER0 ${plan.tierLabel}`);
    if (!rp?.ok) {
      if (plan.failClosedRestorePoint) {
        return {
          ok: false,
          blocked: true,
          restorePointFailed: true,
          cancelled: Boolean(rp?.cancelled),
          error:
            (rp?.error ? `${rp.error} ` : '') +
            'Por seguridad, el nivel Experimental no se aplica sin un Punto de Restauración real de Windows. Activa Protección del sistema en Panel de control → Sistema → Protección del sistema → Configurar → Activar protección del sistema (5–10 % de disco) y vuelve a intentarlo.',
        };
      }
      if (rp?.cancelled) {
        return { ok: false, cancelled: true, error: rp.error || 'Elevación UAC cancelada: no se aplicó el preset.' };
      }
      restorePointWarning = rp?.error || 'Windows no permitió crear el Punto de Restauración (se mantiene el respaldo verificable de XHANNIZER0).';
    } else {
      restorePointCreated = true;
    }
  }

  const userValues = plan.regValues.filter((v) => !isHklm(v.path));
  const systemValues = plan.regValues.filter((v) => isHklm(v.path));
  const needsUltimate = plan.powerMode === 'ultimate' && sys.formFactor !== 'laptop';

  // 1. Cambios de usuario (HKCU) + plan Equilibrado / Alto rendimiento (sin UAC extra)
  const userChunks = [`$ErrorActionPreference = 'Stop'`];
  if (userValues.length) userChunks.push(buildValuesScript(userValues));
  if (plan.powerMode === 'balanced' || plan.powerMode === 'high') {
    const guid = plan.powerMode === 'high' ? POWER_HIGH : POWER_BALANCED;
    userChunks.push(`powercfg /setactive ${guid} 2>$null`);
  }
  userChunks.push('exit 0');

  if (userValues.length || plan.powerMode === 'balanced' || plan.powerMode === 'high') {
    const rUser = await runPs(userChunks.join('\n'), 20000);
    if (!rUser.ok) {
      return { ok: false, error: 'No se pudieron aplicar los ajustes de usuario del preset.' };
    }
  }

  // 2. Cambios de sistema (HKLM, servicios no críticos a Manual, Máximo rendimiento en escritorio) en un solo UAC
  if (systemValues.length || plan.services.length || needsUltimate) {
    const elevChunks = [`$ErrorActionPreference = 'Stop'`];
    if (systemValues.length) elevChunks.push(buildValuesScript(systemValues));
    if (plan.services.length) elevChunks.push(buildServicesManualScript(plan.services));
    if (needsUltimate) elevChunks.push(buildUltimatePowerScript());
    elevChunks.push('exit 0');

    const rElev = await runElev(elevChunks.join('\n'), 40000);
    if (!rElev.ok) {
      return {
        ok: false,
        cancelled: Boolean(rElev.cancelled),
        error: rElev.cancelled
          ? 'Elevación UAC cancelada por el usuario.'
          : 'No se pudieron aplicar los ajustes de administrador del preset.',
      };
    }
  }

  // 3. Carpeta real de trabajo / estudios (si el nivel la lista)
  if (plan.workspaceDir && !deps.skipFilesystem) {
    try {
      fs.mkdirSync(plan.workspaceDir.baseDir, { recursive: true });
      for (const sub of plan.workspaceDir.subdirs) {
        fs.mkdirSync(path.join(plan.workspaceDir.baseDir, sub), { recursive: true });
      }
    } catch {
      return { ok: false, error: `No se pudo crear la carpeta ${plan.workspaceDir.baseDir}.` };
    }
  }

  const extra = [];
  if (restorePointCreated) extra.push('Punto de restauración de Windows creado.');
  else if (restorePointWarning) extra.push(`Aviso: ${restorePointWarning}`);
  if (disableVbs && plan.experimental) extra.push('Reinicia Windows para que el cambio de VBS surta efecto.');

  return {
    ok: true,
    presetId: plan.presetId,
    tierId: plan.tierId,
    tierLabel: plan.tierLabel,
    restorePointCreated,
    restorePointWarning,
    message: [`${plan.tierLabel}: optimizaciones aplicadas correctamente.`, ...extra].join(' '),
  };
}

module.exports = {
  getFeaturedStoreApps,
  searchMicrosoftStore,
  buildHardwarePresets,
  resolvePresetPlan,
  getPresetUndoTarget,
  applyPresetOptimizations,
  SAFE_COMPETITIVE_SERVICES,
};
