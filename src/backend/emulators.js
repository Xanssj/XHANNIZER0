'use strict';

const https = require('https');
const { iconFromDomain } = require('./catalog');

const EMULATORS = [
  {
    id: 'emu-retroarch',
    section: 'emuladores',
    platform: 'multi',
    platformLabel: 'Multi-sistema',
    name: 'RetroArch',
    vendor: 'Libretro',
    githubRepo: 'libretro/RetroArch',
    wingetId: 'Libretro.RetroArch',
    iconUrl: iconFromDomain('retroarch.com'),
    recommended: true,
    recommendedLabel: 'Todo-en-uno',
    description: 'Frontend oficial multi-sistema con núcleos para consolas clásicas, shaders CRT, logros RetroAchievements y baja latencia.',
    tags: ['Multi-consola', 'GitHub', 'Shaders CRT'],
  },
  {
    id: 'emu-pcsx2',
    section: 'emuladores',
    platform: 'playstation',
    platformLabel: 'PlayStation 2',
    name: 'PCSX2',
    vendor: 'PCSX2 Team',
    githubRepo: 'PCSX2/pcsx2',
    wingetId: 'PCSX2Team.PCSX2',
    iconUrl: iconFromDomain('pcsx2.net'),
    recommended: true,
    recommendedLabel: 'PS2 Oficial',
    description: 'El emulador estándar de PlayStation 2 con interfaz Qt moderna, renderizado Vulkan/DX12 y resolución hasta 4K+.',
    tags: ['PS2', 'Vulkan / DX12', 'GitHub'],
  },
  {
    id: 'emu-rpcs3',
    section: 'emuladores',
    platform: 'playstation',
    platformLabel: 'PlayStation 3',
    name: 'RPCS3',
    vendor: 'RPCS3 Team',
    githubRepo: 'RPCS3/rpcs3',
    iconUrl: iconFromDomain('rpcs3.net'),
    description: 'Emulador open-source de PlayStation 3 de alto rendimiento con compilación LLVM, Vulkan y parches de 60 FPS.',
    tags: ['PS3', 'Vulkan', 'GitHub'],
  },
  {
    id: 'emu-duckstation',
    section: 'emuladores',
    platform: 'playstation',
    platformLabel: 'PlayStation 1',
    name: 'DuckStation',
    vendor: 'stenzek',
    githubRepo: 'stenzek/duckstation',
    iconUrl: iconFromDomain('duckstation.org'),
    description: 'Emulador rápido y preciso de PS1 con corrección de geometría PGXP, upscaling HD y soporte para RetroAchievements.',
    tags: ['PS1', 'PGXP', 'GitHub'],
  },
  {
    id: 'emu-ppsspp',
    section: 'emuladores',
    platform: 'playstation',
    platformLabel: 'PSP',
    name: 'PPSSPP',
    vendor: 'Henrik Rydgård',
    githubRepo: 'hrydgard/ppsspp',
    wingetId: 'PPSSPPTeam.PPSSPP',
    iconUrl: iconFromDomain('ppsspp.org'),
    description: 'Emulador de PlayStation Portable ultrarrápido con texturas HD, Vulkan y compatibilidad casi total del catálogo.',
    tags: ['PSP', 'Ligero', 'GitHub'],
  },
  {
    id: 'emu-vita3k',
    section: 'emuladores',
    platform: 'playstation',
    platformLabel: 'PS Vita',
    name: 'Vita3K',
    vendor: 'Vita3K Team',
    githubRepo: 'Vita3K/Vita3K',
    iconUrl: iconFromDomain('vita3k.org'),
    description: 'Emulador open-source de PlayStation Vita en desarrollo activo con soporte Vulkan y escalado de resolución.',
    tags: ['PS Vita', 'Vulkan', 'GitHub'],
  },
  {
    id: 'emu-shadps4',
    section: 'emuladores',
    platform: 'playstation',
    platformLabel: 'PlayStation 4',
    name: 'shadPS4',
    vendor: 'shadps4-emu',
    githubRepo: 'shadps4-emu/shadPS4',
    iconUrl: iconFromDomain('shadps4.net'),
    description: 'Emulador experimental de PlayStation 4 de código abierto en C++ con avances acelerados en Vulkan.',
    tags: ['PS4', 'Experimental', 'GitHub'],
  },
  {
    id: 'emu-dolphin',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'GameCube / Wii',
    name: 'Dolphin Emulator',
    vendor: 'Dolphin Team',
    githubRepo: 'dolphin-emu/dolphin',
    wingetId: 'DolphinEmulator.Dolphin',
    iconUrl: iconFromDomain('dolphin-emu.org'),
    recommended: true,
    recommendedLabel: 'GC / Wii',
    description: 'Referente absoluto para GameCube y Nintendo Wii con soporte para mandos originales, HD packs y netplay.',
    tags: ['GameCube', 'Wii', 'GitHub'],
  },
  {
    id: 'emu-cemu',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Wii U',
    name: 'Cemu',
    vendor: 'Cemu Project',
    githubRepo: 'cemu-project/Cemu',
    wingetId: 'Cemu.Cemu',
    iconUrl: iconFromDomain('cemu.info'),
    description: 'Emulador open-source de Wii U con gráficos Vulkan, packs de rendimiento/resolución y compilación asíncrona de shaders.',
    tags: ['Wii U', 'Vulkan', 'GitHub'],
  },
  {
    id: 'emu-azahar',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Nintendo 3DS',
    name: 'Azahar (3DS)',
    vendor: 'Azahar Team',
    githubRepo: 'azahar-emu/azahar',
    iconUrl: iconFromDomain('azahar-emu.org'),
    description: 'Sucesor open-source moderno de Nintendo 3DS mantenido activamente en GitHub con mejoras de Vulkan y estabilidad.',
    tags: ['3DS', 'Open Source', 'GitHub'],
  },
  {
    id: 'emu-melonds',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Nintendo DS',
    name: 'melonDS',
    vendor: 'melonDS Team',
    githubRepo: 'melonDS-emu/melonDS',
    iconUrl: iconFromDomain('melonds.kuribo64.net'),
    description: 'Emulador preciso de Nintendo DS y DSi con soporte Wi-Fi local, renderizador OpenGL y diseño limpio.',
    tags: ['NDS / DSi', 'Precisión', 'GitHub'],
  },
  {
    id: 'emu-mgba',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Game Boy Advance',
    name: 'mGBA',
    vendor: 'endrift',
    githubRepo: 'mgba-emu/mgba',
    wingetId: 'mGBA.mGBA',
    iconUrl: iconFromDomain('mgba.io'),
    description: 'El emulador más preciso y ligero para Game Boy Advance, GB y GBC con cable link multijugador.',
    tags: ['GBA / GBC', 'Ligero', 'GitHub'],
  },
  {
    id: 'emu-rmg',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Nintendo 64',
    name: 'RMG (Mupen64Plus)',
    vendor: 'Rosalie241',
    githubRepo: 'Rosalie241/RMG',
    iconUrl: iconFromDomain('github.com'),
    description: 'Interfaz Qt moderna y directa para Mupen64Plus con configuración sencilla de mandos y gráficos ParaLLEl-RDP.',
    tags: ['N64', 'Qt', 'GitHub'],
  },
  {
    id: 'emu-snes9x',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Super Nintendo',
    name: 'Snes9x',
    vendor: 'Snes9x Team',
    githubRepo: 'snes9xgit/snes9x',
    iconUrl: iconFromDomain('snes9x.com'),
    description: 'Emulador clásico de Super Nintendo (SNES) con compatibilidad excelente, netplay y consumo mínimo.',
    tags: ['SNES', 'Clásico', 'GitHub'],
  },
  {
    id: 'emu-xemu',
    section: 'emuladores',
    platform: 'xbox',
    platformLabel: 'Xbox Original',
    name: 'xemu',
    vendor: 'xemu Project',
    githubRepo: 'xemu-project/xemu',
    iconUrl: iconFromDomain('xemu.app'),
    description: 'Emulador open-source de bajo nivel para la Xbox original con escalado de resolución y soporte de red LAN.',
    tags: ['Xbox', 'Open Source', 'GitHub'],
  },
  {
    id: 'emu-xenia',
    section: 'emuladores',
    platform: 'xbox',
    platformLabel: 'Xbox 360',
    name: 'Xenia Canary',
    vendor: 'Xenia Canary',
    githubRepo: 'xenia-canary/xenia-canary',
    iconUrl: iconFromDomain('xenia.jp'),
    description: 'Rama experimental activa de Xenia para Xbox 360 con parches de juegos y mejoras continuas en Direct3D 12.',
    tags: ['Xbox 360', 'DX12', 'GitHub'],
  },
  {
    id: 'emu-flycast',
    section: 'emuladores',
    platform: 'retro',
    platformLabel: 'Dreamcast / Arcade',
    name: 'Flycast',
    vendor: 'flyinghead',
    githubRepo: 'flyinghead/flycast',
    iconUrl: iconFromDomain('github.com'),
    description: 'Emulador multiplataforma para Sega Dreamcast, NAOMI y Atomiswave con Vulkan, widescreen y RetroAchievements.',
    tags: ['Dreamcast', 'Arcade', 'GitHub'],
  },
  {
    id: 'emu-ryubing',
    section: 'emuladores',
    platform: 'nintendo',
    platformLabel: 'Switch (Fork)',
    name: 'Ryubing',
    vendor: 'Comunidad GitHub',
    githubRepo: 'Ryubing/Stable-Releases',
    iconUrl: iconFromDomain('github.com'),
    description: 'Continuación comunitaria open-source alojada en GitHub con builds estables para Windows x64.',
    tags: ['Open Source', 'Builds x64', 'GitHub'],
  },
];

function getEmulatorsCatalog() {
  return EMULATORS.map((e) => ({
    ...e,
    officialUrl: `https://github.com/${e.githubRepo}/releases/latest`,
    repoUrl: `https://github.com/${e.githubRepo}`,
  }));
}

function getEmulatorById(id) {
  return getEmulatorsCatalog().find((e) => e.id === id) || null;
}

function fetchGithubJson(apiPath, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const req = https.get(
      `https://api.github.com${apiPath}`,
      {
        headers: {
          'User-Agent': 'XHANNIZER0/1.2 (Xhanni Studios)',
          Accept: 'application/vnd.github+json',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 400000) req.destroy();
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Elige el mejor asset de Windows x64 dentro de un release de GitHub
function pickWindowsAsset(assets) {
  if (!Array.isArray(assets) || !assets.length) return null;
  const valid = assets.filter((a) => {
    const n = String(a.name || '').toLowerCase();
    if (!/\.(exe|msi|zip|7z)$/.test(n)) return false;
    if (/linux|macos|darwin|osx|android|arm64|aarch64|symbols|pdb|debug|source|sha256/.test(n)) return false;
    return true;
  });

  // Prioridad 1: instalador o zip que mencione win/windows + x64/qt
  const scored = valid
    .map((a) => {
      const n = String(a.name || '').toLowerCase();
      let score = 0;
      if (/win|windows|msvc/.test(n)) score += 10;
      if (/x64|x86_64|64bit|amd64/.test(n)) score += 6;
      if (/\.exe$|\.msi$/.test(n)) score += 4;
      if (/\.zip$|\.7z$/.test(n)) score += 3;
      if (/qt/.test(n)) score += 2;
      if (/avx2/.test(n)) score += 1;
      return { asset: a, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.asset || null;
}

async function resolveGithubLatestRelease(repo) {
  let data = await fetchGithubJson(`/repos/${repo}/releases/latest`);
  if (!data) {
    // Algunos emuladores publican solo prereleases / nightlies (ej. Xenia Canary, Vita3K, RPCS3)
    const list = await fetchGithubJson(`/repos/${repo}/releases?per_page=3`);
    if (Array.isArray(list) && list.length) data = list[0];
  }
  if (!data) {
    return {
      ok: false,
      repo,
      htmlUrl: `https://github.com/${repo}/releases`,
      tag: null,
      asset: null,
    };
  }
  const best = pickWindowsAsset(data.assets);
  return {
    ok: true,
    repo,
    tag: data.tag_name || data.name || 'latest',
    publishedAt: data.published_at ? String(data.published_at).slice(0, 10) : '',
    htmlUrl: data.html_url || `https://github.com/${repo}/releases`,
    asset: best
      ? {
          name: best.name,
          url: best.browser_download_url,
          sizeMb: best.size ? Math.round((best.size / (1024 * 1024)) * 10) / 10 : null,
        }
      : null,
  };
}

module.exports = {
  EMULATORS,
  getEmulatorsCatalog,
  getEmulatorById,
  resolveGithubLatestRelease,
};
