'use strict';

// Asistente de BIOS: rutas de menú por marca de placa madre para los ajustes que detecta el
// Chequeo de PC, y reinicio directo al firmware UEFI.
const { runElevated, runPowerShell } = require('./powershell');

const GUIDES = {
  asus: {
    brand: 'ASUS',
    keys: 'Supr o F2 al encender',
    note: 'Presiona F7 para pasar del modo EZ al modo avanzado.',
    steps: {
      'ram-xmp': ['Ai Tweaker', 'Ai Overclock Tuner', 'XMP I (Intel) / EXPO I o D.O.C.P. (AMD)'],
      rebar: ['Advanced', 'PCI Subsystem Settings', 'Above 4G Decoding: Enabled', 'Re-Size BAR Support: Enabled'],
      secureboot: ['Boot', 'CSM (Compatibility Support Module): Disabled', 'Secure Boot', 'OS Type: Windows UEFI mode', 'Key Management: Install default Secure Boot keys'],
      tpm: ['Advanced', 'PCH-FW Configuration: PTT (Intel) / AMD fTPM configuration: Firmware TPM (AMD)'],
      virtualization: ['Advanced', 'CPU Configuration', 'Intel Virtualization Technology / SVM Mode: Enabled'],
    },
  },
  msi: {
    brand: 'MSI',
    keys: 'Supr al encender',
    note: 'Presiona F7 para pasar del modo EZ al modo avanzado.',
    steps: {
      'ram-xmp': ['OC', 'Extreme Memory Profile (XMP) / A-XMP / EXPO: Profile 1'],
      rebar: ['Settings', 'Advanced', 'PCI Subsystem Settings', 'Above 4G memory / Crypto Currency mining: Enabled', 'Re-Size BAR Support: Enabled'],
      secureboot: ['Settings', 'Advanced', 'Windows OS Configuration', 'BIOS UEFI/CSM Mode: UEFI', 'Secure Boot: Enabled (Secure Boot Mode: Standard)'],
      tpm: ['Settings', 'Security', 'Trusted Computing', 'Security Device Support: Enable', 'PTT (Intel) / AMD fTPM switch: Enabled'],
      virtualization: ['OC', 'CPU Features', 'Intel Virtualization Tech / SVM Mode: Enabled'],
    },
  },
  gigabyte: {
    brand: 'Gigabyte / AORUS',
    keys: 'Supr al encender',
    note: 'Presiona F2 para alternar entre el modo fácil y el avanzado.',
    steps: {
      'ram-xmp': ['Tweaker', 'Extreme Memory Profile (X.M.P.) / EXPO: Profile1'],
      rebar: ['Settings', 'IO Ports', 'Above 4G Decoding: Enabled', 'Re-Size BAR Support: Auto'],
      secureboot: ['Boot', 'CSM Support: Disabled', 'Secure Boot', 'Secure Boot: Enabled (Secure Boot Mode: Standard)'],
      tpm: ['Settings', 'Miscellaneous', 'Intel Platform Trust Technology (PTT) / AMD CPU fTPM: Enabled'],
      virtualization: ['Tweaker', 'Advanced CPU Settings', 'Intel Virtualization Technology / SVM Mode: Enabled'],
    },
  },
  asrock: {
    brand: 'ASRock',
    keys: 'F2 o Supr al encender',
    note: 'Presiona F6 para pasar al modo avanzado.',
    steps: {
      'ram-xmp': ['OC Tweaker', 'DRAM Configuration', 'Load XMP Setting / DRAM Profile Setting: XMP / EXPO Profile 1'],
      rebar: ['Advanced', 'Chipset Configuration', 'Above 4G Decoding: Enabled', 'Re-Size BAR Support: Enabled'],
      secureboot: ['Boot', 'CSM: Disabled', 'Security', 'Secure Boot: Enabled', 'Install Default Secure Boot keys'],
      tpm: ['Security', 'Intel Platform Trust Technology / AMD fTPM switch: Enabled'],
      virtualization: ['Advanced', 'CPU Configuration', 'Intel Virtualization Technology / SVM Mode: Enabled'],
    },
  },
  generic: {
    brand: 'tu placa madre',
    keys: 'Supr, F2, F10 o F12 al encender (según la marca)',
    note: 'Los nombres cambian entre fabricantes: busca palabras parecidas en el modo avanzado.',
    steps: {
      'ram-xmp': ['Overclocking / Memoria', 'XMP, EXPO o D.O.C.P.: Profile 1'],
      rebar: ['Advanced / PCI', 'Above 4G Decoding: Enabled', 'Re-Size BAR Support: Enabled'],
      secureboot: ['Boot', 'CSM / Legacy: Disabled (solo UEFI)', 'Secure Boot: Enabled con las claves de fábrica'],
      tpm: ['Security / Advanced', 'PTT (Intel) o fTPM (AMD): Enabled'],
      virtualization: ['Advanced / CPU', 'VT-x (Intel) o SVM (AMD): Enabled'],
    },
  },
};

const TOPICS = {
  'ram-xmp': 'Activar el perfil de velocidad de la RAM (XMP / EXPO)',
  rebar: 'Activar Resizable BAR',
  secureboot: 'Activar Secure Boot',
  tpm: 'Activar TPM 2.0',
  virtualization: 'Activar la virtualización',
};

function brandFromManufacturer(manufacturer) {
  const m = String(manufacturer || '').toUpperCase();
  if (/ASUS/.test(m)) return 'asus';
  if (/MICRO-STAR|\bMSI\b/.test(m)) return 'msi';
  if (/GIGABYTE|AORUS/.test(m)) return 'gigabyte';
  if (/ASROCK/.test(m)) return 'asrock';
  return 'generic';
}

// Relaciona cada comprobación del Chequeo de PC con un tema de la guía
function topicForCheck(checkId) {
  if (/^ram-(xmp|speed)/.test(checkId)) return 'ram-xmp';
  if (/^rebar/.test(checkId)) return 'rebar';
  if (/^(secureboot|firmware)/.test(checkId)) return 'secureboot';
  if (/^tpm/.test(checkId)) return 'tpm';
  if (/^virt/.test(checkId)) return 'virtualization';
  return null;
}

// Devuelve la guía para la placa detectada. Si se pasan `checks`, solo los temas con aviso.
function getBiosGuide({ manufacturer, product, checks } = {}) {
  const key = brandFromManufacturer(manufacturer);
  const guide = GUIDES[key];
  let topics = Object.keys(TOPICS);
  if (Array.isArray(checks)) {
    const warned = new Set(checks.filter((c) => c.status === 'warn').map((c) => topicForCheck(c.id)).filter(Boolean));
    topics = topics.filter((t) => warned.has(t));
  }
  return {
    brandKey: key,
    brand: guide.brand,
    board: [manufacturer, product].filter(Boolean).join(' ').trim() || null,
    keys: guide.keys,
    note: guide.note,
    sections: topics.map((t) => ({ id: t, title: TOPICS[t], path: guide.steps[t] })),
    disclaimer: 'Las rutas pueden variar según la versión de BIOS. Guarda con F10 al terminar.',
  };
}

async function isUefiBoot() {
  const r = await runPowerShell("try { Confirm-SecureBootUEFI | Out-Null; 'uefi' } catch [System.PlatformNotSupportedException] { 'legacy' } catch { 'uefi' }", 10000);
  return r.stdout.trim() !== 'legacy';
}

// Reinicia el PC directo a la configuración del firmware (solo arranque UEFI)
async function rebootToFirmware() {
  if (!(await isUefiBoot())) {
    return { ok: false, error: 'Tu PC arranca en modo Legacy: entra a la BIOS manualmente con la tecla indicada al encender.' };
  }
  const elev = await runElevated('shutdown.exe /r /fw /t 5 /c "XHANNIZER0: reiniciando a la BIOS"\nexit $LASTEXITCODE', 30000);
  if (elev.cancelled) return { ok: false, error: 'Elevación UAC cancelada por el usuario.' };
  return elev.ok
    ? { ok: true, message: 'El PC se reiniciará a la BIOS en 5 segundos.' }
    : { ok: false, error: 'Windows no permitió reiniciar al firmware en este equipo.' };
}

module.exports = { getBiosGuide, rebootToFirmware, brandFromManufacturer, topicForCheck, GUIDES };
