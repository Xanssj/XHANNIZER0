'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const PROGRAM_FILES = process.env.ProgramFiles || 'C:\\Program Files';
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

function vendorLogoUrl(combinedText) {
  const s = String(combinedText || '').toUpperCase();
  const domain =
    /NVIDIA|GEFORCE|RTX|GTX/.test(s) ? 'nvidia.com' :
    /AMD|RYZEN|RADEON/.test(s) ? 'amd.com' :
    /INTEL/.test(s) ? 'intel.com' :
    /MSI|MICRO-STAR/.test(s) ? 'msi.com' :
    /ASUS|ASUSTEK/.test(s) ? 'asus.com' :
    /GIGABYTE|AORUS/.test(s) ? 'gigabyte.com' :
    /ASROCK/.test(s) ? 'asrock.com' :
    /REALTEK/.test(s) ? 'realtek.com' :
    /WESTERN DIGITAL|\bWD\b|\bWDC\b/.test(s) ? 'westerndigital.com' :
    /SAMSUNG/.test(s) ? 'samsung.com' :
    /KINGSTON/.test(s) ? 'kingston.com' :
    /CRUCIAL|MICRON/.test(s) ? 'crucial.com' :
    /LOGITECH/.test(s) ? 'logitech.com' :
    /RAZER/.test(s) ? 'razer.com' :
    /CORSAIR/.test(s) ? 'corsair.com' :
    /QUALCOMM|SNAPDRAGON|ADRENO|ATHEROS/.test(s) ? 'qualcomm.com' :
    /MEDIATEK/.test(s) ? 'mediatek.com' :
    /BROADCOM/.test(s) ? 'broadcom.com' :
    /\bDELL\b|ALIENWARE/.test(s) ? 'dell.com' :
    /HEWLETT|\bHP\b/.test(s) ? 'hp.com' :
    /LENOVO/.test(s) ? 'lenovo.com' :
    /\bACER\b/.test(s) ? 'acer.com' :
    /HUAWEI/.test(s) ? 'huawei.com' :
    /SEAGATE/.test(s) ? 'seagate.com' :
    /TOSHIBA|KIOXIA/.test(s) ? 'kioxia.com' :
    /SK ?HYNIX/.test(s) ? 'skhynix.com' :
    /CONEXANT|SYNAPTICS/.test(s) ? 'synaptics.com' :
    /CIRRUS/.test(s) ? 'cirrus.com' :
    /GOODIX/.test(s) ? 'goodix.com' :
    'microsoft.com';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      // Ignorar
    }
  }
  return null;
}

function detectCompanionApp(combinedText, category) {
  const s = String(combinedText || '').toUpperCase();
  if (/NVIDIA|GEFORCE|RTX|GTX/.test(s)) {
    const exePath = firstExisting([
      path.join(PROGRAM_FILES, 'NVIDIA Corporation', 'NVIDIA app', 'CEF', 'NVIDIA app.exe'),
      path.join(PROGRAM_FILES, 'NVIDIA Corporation', 'NVIDIA App', 'NVIDIA App.exe'),
      path.join(PROGRAM_FILES, 'NVIDIA Corporation', 'NVIDIA GeForce Experience', 'NVIDIA GeForce Experience.exe'),
    ]);
    return {
      name: 'NVIDIA App',
      installed: Boolean(exePath),
      exePath,
      wingetId: null, // NVIDIA App ya no está en WinGet: se instala desde su sitio oficial
      officialUrl: 'https://www.nvidia.com/es-la/software/nvidia-app/',
    };
  }
  if (/AMD|RYZEN|RADEON/.test(s) && (category === 'gpu' || category === 'igpu' || category === 'cpu')) {
    const exePath = firstExisting([
      path.join(PROGRAM_FILES, 'AMD', 'CNext', 'CNext', 'RadeonSoftware.exe'),
      path.join(PROGRAM_FILES, 'AMD', 'RyzenMaster', 'bin', 'AMD Ryzen Master.exe'),
    ]);
    return {
      name: category === 'cpu' ? 'AMD Adrenalin / Ryzen Master' : 'AMD Software: Adrenalin',
      installed: Boolean(exePath),
      exePath,
      wingetId: null,
      officialUrl: 'https://www.amd.com/es/support/download/drivers.html',
    };
  }
  if (/INTEL/.test(s) && (category === 'gpu' || category === 'igpu' || category === 'network' || category === 'cpu')) {
    const exePath = firstExisting([
      path.join(PROGRAM_FILES_X86, 'Intel', 'Driver and Support Assistant', 'DSATray.exe'),
      path.join(PROGRAM_FILES, 'Intel', 'Intel Graphics Command Center', 'IGCC.exe'),
    ]);
    return {
      name: 'Intel Driver & Support Assistant',
      installed: Boolean(exePath),
      exePath,
      wingetId: 'Intel.IntelDriverAndSupportAssistant',
      officialUrl: 'https://www.intel.la/content/www/xl/es/support/detect.html',
    };
  }
  if (/MSI|MICRO-STAR/.test(s) && category === 'motherboard') {
    const exePath = firstExisting([
      path.join(PROGRAM_FILES_X86, 'MSI', 'MSI Center', 'MSI Center.exe'),
      path.join(PROGRAM_FILES, 'MSI', 'MSI Center', 'MSI Center.exe'),
    ]);
    return {
      name: 'MSI Center',
      installed: Boolean(exePath),
      exePath,
      wingetId: '9NVMNJCR03XV',
      officialUrl: 'https://www.msi.com/Landing/MSI-Center',
    };
  }
  if (/ASUS|ASUSTEK/.test(s) && category === 'motherboard') {
    const exePath = firstExisting([
      path.join(PROGRAM_FILES, 'ASUS', 'ARMOURY CRATE Service', 'ArmouryCrate.UserSessionHelper.exe'),
    ]);
    return {
      name: 'ASUS Armoury Crate',
      installed: Boolean(exePath),
      exePath,
      wingetId: null,
      officialUrl: 'https://www.asus.com/support/download-center/',
    };
  }
  if (/REALTEK/.test(s) && category === 'audio') {
    return {
      name: 'Realtek Audio Console',
      installed: false,
      exePath: null,
      wingetId: '9P2B8MCSVPLN',
      officialUrl: 'https://www.realtek.com/Download/List?cate_id=593',
    };
  }
  return null;
}

function runPowerShell(script, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
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

function fetchJson(url, timeoutMs = 4500) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'XHANNIZER0/1.1 (Xhanni Studios)' }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 250000) req.destroy();
        });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function formatDriverDate(raw) {
  if (!raw) return 'Sin fecha';
  const str = String(raw);
  const wmiMatch = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (wmiMatch) return `${wmiMatch[1]}-${wmiMatch[2]}-${wmiMatch[3]}`;
  const msMatch = str.match(/\/Date\((\d+)\)\//);
  if (msMatch) {
    const d = new Date(Number(msMatch[1]));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const iso = new Date(str);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
  return str.slice(0, 10);
}

// Convierte versión interna de driver NVIDIA (ej. 32.0.15.6636 -> 566.36)
function formatNvidiaVersion(raw) {
  if (!raw) return 'Desconocida';
  const parts = String(raw).split('.');
  if (parts.length === 4) {
    const tail = parts[2].slice(-1) + parts[3].padStart(4, '0');
    if (tail.length === 5) {
      return `${tail.slice(0, 3)}.${tail.slice(3)}`;
    }
  }
  return String(raw);
}

// GPU integrada en el procesador: Intel (HD/UHD/Iris/Arc Graphics de Core Ultra), AMD (Radeon
// Graphics, Vega, 7xxM/8xxM) y Qualcomm Adreno (Snapdragon). Se comparte con el chequeo de PC.
const IGPU_RE = /INTEL.*(UHD|HD GRAPHICS|IRIS|INTEGRATED|ARC\(TM\) GRAPHICS|ARC GRAPHICS)|RADEON\(TM\) GRAPHICS|RADEON GRAPHICS|RADEON\(TM\) VEGA|VEGA \d+ GRAPHICS|RADEON(\(TM\))? \d{3}M\b|RADEON \d{3}M GRAPHICS|ADRENO|QUALCOMM/i;
const DGPU_RE = /NVIDIA|GEFORCE|RTX|GTX|QUADRO|TITAN|RX\s*\d|RADEON PRO|FIREPRO|RADEON VII|FURY|ARC\(TM\)\s*[AB]\d|ARC\s*[AB]\d|MOORE THREADS/i;

function isIntegratedGpuName(name) {
  const n = String(name || '');
  return IGPU_RE.test(n) && !DGPU_RE.test(n);
}

function gpuVendorOf(name) {
  const s = String(name || '').toUpperCase();
  if (/NVIDIA|GEFORCE|RTX|GTX|QUADRO|TITAN/.test(s)) return 'NVIDIA';
  if (/AMD|RADEON|FIREPRO/.test(s)) return 'AMD';
  if (/INTEL/.test(s)) return 'Intel';
  if (/QUALCOMM|ADRENO/.test(s)) return 'Qualcomm';
  return null;
}

// Clasifica con precisión si una GPU es integrada del CPU (iGPU) o dedicada (dGPU)
function classifyGpu(gpu, cpuName, allGpus) {
  const name = String(gpu.Name || '');
  const cpu = String(cpuName || '').toUpperCase();
  const vramGb = Number(gpu.realVramGb || 0);

  if (DGPU_RE.test(name)) return { isIntegrated: false, roleLabel: 'GPU Dedicada (dGPU)' };
  if (isIntegratedGpuName(name)) return { isIntegrated: true, roleLabel: 'GPU Integrada del CPU (iGPU)' };

  const hasDedicatedAlongside = allGpus.some((g) => DGPU_RE.test(String(g.Name || '')));
  if (hasDedicatedAlongside && vramGb > 0 && vramGb <= 2.5 && /AMD|INTEL|SNAPDRAGON/.test(cpu)) {
    return { isIntegrated: true, roleLabel: 'GPU Integrada del CPU (iGPU)' };
  }
  return { isIntegrated: false, roleLabel: 'GPU / Gráficos' };
}

// ---------- Equipos de marca (portátiles y PCs armados de fábrica)
// En estos equipos los drivers y la BIOS los publica el fabricante del equipo, no el de la placa.
const PLACEHOLDER_RE = /^(system manufacturer|system product name|to be filled by o\.?e\.?m\.?|default string|o\.?e\.?m\.?|not applicable|none|unknown|\s*)$/i;
const DIY_BOARD_RE = /MICRO-STAR|\bMSI\b|ASUSTEK|\bASUS\b|GIGABYTE|ASROCK|BIOSTAR|NZXT|EVGA|COLORFUL|MAXSUN|SOYO|JGINYUE|HUANANZHI|MACHINIST/i;

const OEMS = [
  { re: /ALIENWARE/i, short: 'Alienware', url: 'https://www.dell.com/support/home/', app: 'Alienware Command Center / Dell SupportAssist', appUrl: 'https://www.dell.com/support/home/' },
  { re: /\bDELL\b/i, short: 'Dell', url: 'https://www.dell.com/support/home/', app: 'Dell SupportAssist / Command Update', appUrl: 'https://www.dell.com/support/home/' },
  { re: /HEWLETT|\bHP\b/i, short: 'HP', url: 'https://support.hp.com/drivers', app: 'HP Support Assistant', appUrl: 'https://support.hp.com/drivers' },
  { re: /LENOVO/i, short: 'Lenovo', url: 'https://pcsupport.lenovo.com/', app: 'Lenovo Vantage', appUrl: 'https://pcsupport.lenovo.com/' },
  { re: /\bACER\b/i, short: 'Acer', url: 'https://www.acer.com/support', app: 'Acer Care Center', appUrl: 'https://www.acer.com/support' },
  { re: /ASUSTEK|\bASUS\b/i, short: 'ASUS', url: 'https://www.asus.com/support/download-center/', app: 'MyASUS', appUrl: 'https://www.asus.com/support/download-center/' },
  { re: /MICRO-STAR|\bMSI\b/i, short: 'MSI', url: 'https://www.msi.com/support/download', app: 'MSI Center', appUrl: 'https://www.msi.com/Landing/MSI-Center' },
  { re: /GIGABYTE|AORUS/i, short: 'GIGABYTE', url: 'https://www.gigabyte.com/Support', app: 'GIGABYTE Control Center', appUrl: 'https://www.gigabyte.com/Support' },
  { re: /MICROSOFT/i, short: 'Microsoft Surface', url: 'https://support.microsoft.com/surface', app: 'Windows Update', appUrl: 'https://support.microsoft.com/surface' },
  { re: /SAMSUNG/i, short: 'Samsung', url: 'https://www.samsung.com/support/', app: 'Samsung Update', appUrl: 'https://www.samsung.com/support/' },
  { re: /HUAWEI/i, short: 'Huawei', url: 'https://consumer.huawei.com/support/', app: 'Huawei PC Manager', appUrl: 'https://consumer.huawei.com/support/' },
  { re: /HONOR/i, short: 'HONOR', url: 'https://www.honor.com/global/support/', app: 'HONOR PC Manager', appUrl: 'https://www.honor.com/global/support/' },
  { re: /RAZER/i, short: 'Razer', url: 'https://mysupport.razer.com/', app: 'Razer Synapse', appUrl: 'https://mysupport.razer.com/' },
  { re: /DYNABOOK|TOSHIBA/i, short: 'Dynabook', url: 'https://support.dynabook.com/', app: 'Dynabook Service Station', appUrl: 'https://support.dynabook.com/' },
  { re: /\bLG\b|LG ELECTRONICS/i, short: 'LG', url: 'https://www.lg.com/support', app: 'LG Update', appUrl: 'https://www.lg.com/support' },
  { re: /XIAOMI|TIMI/i, short: 'Xiaomi', url: 'https://www.mi.com/global/support', app: 'Xiaomi PC Manager', appUrl: 'https://www.mi.com/global/support' },
  { re: /FRAMEWORK/i, short: 'Framework', url: 'https://knowledgebase.frame.work/', app: 'Framework BIOS y drivers', appUrl: 'https://knowledgebase.frame.work/' },
  { re: /\bVAIO\b|SONY/i, short: 'VAIO', url: 'https://us.vaio.com/pages/support', app: 'VAIO Update', appUrl: 'https://us.vaio.com/pages/support' },
  { re: /APPLE/i, short: 'Apple (Boot Camp)', url: 'https://support.apple.com/boot-camp', app: 'Apple Software Update', appUrl: 'https://support.apple.com/boot-camp' },
];

function oemFor(manufacturer) {
  const m = String(manufacturer || '');
  if (!m || PLACEHOLDER_RE.test(m.trim())) return null;
  return OEMS.find((o) => o.re.test(m)) || null;
}

const LAPTOP_CHASSIS = new Set([8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32]);
const VM_RE = /VIRTUAL|VMWARE|VIRTUALBOX|KVM|QEMU|HYPER-V|PARALLELS|XEN|BOCHS/i;

function formFactorOf(cs, chassisTypes, batteryCount) {
  const model = `${cs?.Manufacturer || ''} ${cs?.Model || ''}`;
  if (VM_RE.test(model)) return 'vm';
  const chassis = (Array.isArray(chassisTypes) ? chassisTypes : [chassisTypes]).map(Number).filter(Boolean);
  if (Number(cs?.PCSystemType) === 2 || chassis.some((c) => LAPTOP_CHASSIS.has(c))) return 'laptop';
  if (batteryCount > 0 && !chassis.length) return 'laptop';
  return 'desktop';
}

// Nombre comercial del equipo: Lenovo guarda el modelo legible en Version («ThinkPad X1 Carbon Gen 10»)
function friendlyModelOf(cs, csp) {
  const vendor = String(cs?.Manufacturer || csp?.Vendor || '').trim();
  const candidates = [csp?.Version, cs?.SystemFamily, cs?.Model, csp?.Name]
    .map((v) => String(v || '').trim())
    .filter((v) => v && !PLACEHOLDER_RE.test(v) && !/^\d+$/.test(v));
  const model = /LENOVO/i.test(vendor) ? candidates[0] : String(cs?.Model || candidates[0] || '').trim();
  return model || null;
}

// Cualquier componente sin reglas propias: se compara con Windows Update (WHQL) y se ofrece la web
// del fabricante del equipo (portátiles) o la de Windows.
function genericDriver(component, sourceName) {
  const url = component.oemSupportUrl || 'https://support.microsoft.com/windows';
  return {
    ...component,
    installedVersionDisplay: component.installedVersionDisplay || component.installedVersion || 'Detectado',
    latestVersion: null,
    safeVersion: null,
    sourceName: sourceName || (component.oemSupportUrl ? 'Fabricante del equipo' : 'Windows Update (WHQL)'),
    officialUrl: url,
    safeUrl: url,
    needsUpdate: false,
    status: 'ok',
    advisory: null,
  };
}

function enrichDriverMetadata(component) {
  const nameUpper = String(component.name || '').toUpperCase();
  const vendorUpper = String(component.vendor || '').toUpperCase();
  const combined = `${nameUpper} ${vendorUpper}`;
  const baseExtras = {
    vendorIconUrl: vendorLogoUrl(combined),
    companionApp: detectCompanionApp(combined, component.category),
    isNvidiaOrAmd: /NVIDIA|GEFORCE|RTX|GTX|AMD|RYZEN|RADEON/.test(combined),
  };
  component = { ...component, ...baseExtras };

  // ---------- GPU INTEGRADA (iGPU) ----------
  if (component.category === 'igpu' && /QUALCOMM|ADRENO/.test(combined)) {
    return genericDriver({ ...component, vendor: 'Qualcomm' }, 'Qualcomm / fabricante del equipo');
  }
  if (component.category === 'igpu') {
    const isAmd = combined.includes('AMD') || combined.includes('RADEON');
    return {
      ...component,
      vendor: isAmd ? 'AMD' : 'Intel',
      installedVersionDisplay: component.installedVersion || 'Detectado',
      latestVersion: null,
      safeVersion: isAmd ? 'Driver iGPU Estable (Solo Driver)' : '32.0.101.6559 WHQL',
      sourceName: isAmd ? 'AMD iGPU / Chipset Oficial' : 'Intel Graphics Oficial',
      officialUrl: isAmd
        ? 'https://www.amd.com/es/support/download/drivers.html'
        : 'https://www.intel.la/content/www/xl/es/download-center/home.html',
      safeUrl: isAmd
        ? 'https://www.amd.com/es/support/download/drivers.html'
        : 'https://www.intel.la/content/www/xl/es/support/detect.html',
      needsUpdate: false,
      status: 'ok',
      advisory: {
        level: 'info',
        title: 'GPU Integrada detectada en tu procesador',
        summary: component.hasDedicatedGpu
          ? 'Tienes una GPU dedicada instalada. Mantén el controlador de esta iGPU en modo minimalista o desactívala en BIOS solo si no usas salidas de video de la placa madre.'
          : 'Esta GPU integrada es tu adaptador principal. Usa el controlador oficial del fabricante para mejor aceleración de video y estabilidad.',
        recommendation: 'safe',
      },
    };
  }

  // ---------- GPU DEDICADA (dGPU) ----------
  if (component.category === 'gpu') {
    if (combined.includes('NVIDIA') || combined.includes('GEFORCE') || combined.includes('RTX') || combined.includes('GTX')) {
      const displayInstalled = formatNvidiaVersion(component.installedVersion);
      const safeVersion = '566.36 WHQL';
      const isIn572Branch = /^572\./.test(displayInstalled);
      return {
        ...component,
        vendor: 'NVIDIA',
        installedVersionDisplay: displayInstalled,
        latestVersion: null,
        safeVersion,
        sourceName: 'NVIDIA Official Drivers',
        officialUrl: 'https://www.nvidia.com/es-la/drivers/',
        safeUrl: 'https://www.nvidia.com/es-la/drivers/details/237719/',
        wingetId: null, // NVIDIA App ya no está en WinGet: se instala desde su sitio oficial
        vendorHint: 'Las versiones Game Ready más nuevas salen primero en NVIDIA App.',
        needsUpdate: false,
        status: isIn572Branch ? 'warning' : 'ok',
        advisory: isIn572Branch
          ? {
              level: 'warn',
              title: 'Precaución reportada en rama 572.xx (GPU)',
              summary: 'Notas oficiales de NVIDIA reportan pantallas negras intermitentes con G-SYNC/DisplayPort en la rama 572.xx. Se recomienda actualizar o usar la versión segura 566.36 WHQL.',
              recommendation: 'safe',
            }
          : null,
      };
    }

    if (combined.includes('AMD') || combined.includes('RADEON')) {
      const safeVersion = '24.12.1 WHQL';
      return {
        ...component,
        vendor: 'AMD',
        installedVersionDisplay: component.installedVersion || 'Detectado',
        latestVersion: null,
        safeVersion,
        sourceName: 'AMD Official Support',
        officialUrl: 'https://www.amd.com/es/support/download/drivers.html',
        safeUrl: 'https://www.amd.com/es/resources/support-articles/release-notes/RN-RAD-WIN-24-12-1.html',
        // Windows informa la versión interna del driver (32.0.x), que no se puede comparar con la de
        // Adrenalin (25.x): no se marca como desactualizado sin poder demostrarlo.
        targetLabel: 'Revisa AMD Adrenalin',
        needsUpdate: false,
        status: 'ok',
        advisory: {
          level: 'info',
          title: 'Recomendación oficial de instalación limpia (GPU AMD)',
          summary: 'AMD recomienda instalar primero el controlador de Chipset antes de Adrenalin y evitar mezclar versiones de Windows Update para prevenir reinicios TDR.',
          recommendation: 'safe',
        },
      };
    }

    if (combined.includes('INTEL')) {
      return {
        ...component,
        vendor: 'Intel',
        installedVersionDisplay: component.installedVersion || 'Detectado',
        latestVersion: null,
        safeVersion: '32.0.101.6559 WHQL',
        sourceName: 'Intel Download Center',
        officialUrl: 'https://www.intel.la/content/www/xl/es/download-center/home.html',
        safeUrl: 'https://www.intel.la/content/www/xl/es/support/detect.html',
        needsUpdate: false,
        status: 'ok',
        advisory: null,
      };
    }
    return genericDriver(component, null);
  }

  // ---------- CPU ----------
  if (component.category === 'cpu') {
    if (combined.includes('AMD') || combined.includes('RYZEN')) {
      return {
        ...component,
        vendor: 'AMD',
        latestVersion: null,
        safeVersion: '6.10.17.152 WHQL',
        sourceName: 'AMD Ryzen Chipset Drivers',
        officialUrl: 'https://www.amd.com/es/support/download/drivers.html',
        safeUrl: 'https://www.amd.com/es/support/download/drivers.html',
        // Windows no expone la versión instalada del paquete de chipset AMD: no se puede afirmar que falte.
        targetLabel: 'Revisa el chipset en AMD',
        needsUpdate: false,
        status: 'ok',
        advisory: {
          level: 'info',
          title: 'Plan de energía y programación de núcleos',
          summary: 'Instalar el paquete oficial de chipset AMD habilita el correcto estacionamiento de núcleos (CPPC) y reduce latencias en Ryzen.',
          recommendation: 'latest',
        },
      };
    }
    if (!combined.includes('INTEL')) {
      // Snapdragon u otros: el paquete de sistema lo entrega Windows Update o el fabricante del equipo
      return genericDriver(component, /QUALCOMM|SNAPDRAGON/.test(combined) ? 'Qualcomm / fabricante del equipo' : null);
    }
    return {
      ...component,
      vendor: 'Intel',
      latestVersion: null,
      safeVersion: '10.1.19600.8418 WHQL',
      sourceName: 'Intel Chipset Device Software',
      officialUrl: 'https://www.intel.la/content/www/xl/es/support/detect.html',
      safeUrl: 'https://www.intel.la/content/www/xl/es/download/19347/chipset-inf-utility.html',
      needsUpdate: false,
      status: 'ok',
      advisory: null,
    };
  }

  // ---------- PLACA MADRE / CHIPSET ----------
  if (component.category === 'motherboard' && component.oem) {
    // Portátil o PC de marca: BIOS y drivers los publica el fabricante del equipo
    const oem = component.oem;
    return {
      ...component,
      oem: { short: oem.short, url: oem.url, app: oem.app, appUrl: oem.appUrl },
      vendorIconUrl: vendorLogoUrl(oem.short),
      companionApp: { name: oem.app, installed: false, exePath: null, wingetId: null, officialUrl: oem.appUrl },
      sourceName: `Soporte de ${oem.short}`,
      officialUrl: oem.url,
      safeUrl: oem.url,
      installedVersionDisplay: `BIOS ${component.installedVersion}`,
      latestVersion: null,
      safeVersion: null,
      targetLabel: `Revisa la web de ${oem.short}`,
      needsUpdate: false,
      status: 'ok',
      advisory: {
        level: 'info',
        title: `Drivers y BIOS de ${oem.short}`,
        summary: `En equipos de marca, la BIOS y algunos drivers (touchpad, teclas, batería, audio) los publica ${oem.short}. Usa ${oem.app} o su web con tu modelo exacto, y en portátiles deja el cargador conectado al actualizar la BIOS.`,
        recommendation: 'oem',
      },
    };
  }
  if (component.category === 'motherboard') {
    let officialUrl = 'https://www.amd.com/es/support/download/drivers.html';
    let sourceName = 'Soporte oficial del fabricante';
    if (combined.includes('ASUS') || combined.includes('ASUSTEK')) {
      officialUrl = 'https://www.asus.com/support/download-center/';
      sourceName = 'ASUS Download Center';
    } else if (combined.includes('MSI') || combined.includes('MICRO-STAR')) {
      officialUrl = 'https://www.msi.com/support/download/';
      sourceName = 'MSI Official Support';
    } else if (combined.includes('GIGABYTE')) {
      officialUrl = 'https://www.gigabyte.com/Support';
      sourceName = 'GIGABYTE Support';
    } else if (combined.includes('ASROCK')) {
      officialUrl = 'https://www.asrock.com/support/index.asp';
      sourceName = 'ASRock Official Support';
    }
    // La última BIOS disponible la completa applyBiosLookup() con datos reales del fabricante.
    return {
      ...component,
      sourceName,
      officialUrl,
      safeUrl: officialUrl,
      installedVersionDisplay: `BIOS ${component.installedVersion}`,
      latestVersion: null,
      safeVersion: null,
      targetLabel: 'Revisa la web del fabricante',
      needsUpdate: false,
      status: 'ok',
      advisory: null,
    };
  }

  // ---------- AUDIO ----------
  if (component.category === 'audio') {
    const isRealtek = combined.includes('REALTEK');
    return {
      ...component,
      vendor: isRealtek ? 'Realtek' : component.vendor || 'Audio',
      latestVersion: null,
      safeVersion: isRealtek ? '6.0.9689.1 WHQL (UAD)' : 'Driver OEM Estable',
      sourceName: isRealtek ? 'Realtek / OEM UAD Oficial' : 'Controlador oficial de audio',
      officialUrl: component.oemSupportUrl || (isRealtek
        ? 'https://www.realtek.com/Download/List?cate_id=593'
        : 'https://support.microsoft.com/windows'),
      safeUrl: component.oemSupportUrl || 'https://www.realtek.com/Download/List?cate_id=593',
      needsUpdate: false,
      status: isRealtek && !component.oemSupportUrl ? 'warning' : 'ok',
      // En portátiles el audio Realtek viene personalizado por la marca: se usa el de su web, sin aviso genérico
      advisory: isRealtek && !component.oemSupportUrl
        ? {
            level: 'warn',
            title: 'Aviso conocido en drivers Realtek UAD',
            summary: 'Algunas actualizaciones genéricas de Realtek alteran el volumen del micrófono o desactivan el panel OEM. Se recomienda respaldo previo y usar la versión WHQL estable.',
            recommendation: 'safe',
          }
        : null,
    };
  }

  // ---------- BLUETOOTH, CÁMARA, LECTOR DE HUELLA: driver de Windows Update o del fabricante
  if (['bluetooth', 'camera', 'biometric'].includes(component.category)) {
    return genericDriver(component, null);
  }

  // ---------- RED ----------
  if (component.category === 'network') {
    const isIntel = combined.includes('INTEL');
    const isRealtek = combined.includes('REALTEK');
    return {
      ...component,
      vendor: isIntel ? 'Intel' : isRealtek ? 'Realtek' : component.vendor || 'Red',
      latestVersion: null,
      safeVersion: isIntel ? '23.100.0 WHQL' : isRealtek ? '10.072.0524 WHQL' : 'Estable',
      sourceName: isIntel ? 'Intel Wired / Wi-Fi Drivers' : isRealtek ? 'Realtek Ethernet / Wi-Fi' : component.oemSupportUrl ? 'Fabricante del equipo' : 'Windows Update (WHQL)',
      officialUrl: isIntel
        ? 'https://www.intel.la/content/www/xl/es/download-center/home.html'
        : isRealtek
        ? 'https://www.realtek.com/Download/List?cate_id=584'
        : component.oemSupportUrl || 'https://support.microsoft.com/windows',
      safeUrl: isIntel
        ? 'https://www.intel.la/content/www/xl/es/support/detect.html'
        : isRealtek
        ? 'https://www.realtek.com/Download/List?cate_id=584'
        : component.oemSupportUrl || 'https://support.microsoft.com/windows',
      needsUpdate: false,
      status: 'ok',
      advisory: null,
    };
  }

  // ---------- ALMACENAMIENTO ----------
  if (component.category !== 'storage') return genericDriver(component, null);
  return {
    ...component,
    sourceName: 'Windows / NVMe Oficial',
    officialUrl: 'https://support.microsoft.com/windows',
    safeUrl: 'https://support.microsoft.com/windows',
    latestVersion: null,
    safeVersion: 'Estándar Microsoft WHQL',
    needsUpdate: false,
    status: 'ok',
    advisory: null,
  };
}

async function detectHardwareAndDrivers() {
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, Architecture
$gpus = @(Get-CimInstance Win32_VideoController | Select-Object Name, AdapterCompatibility, DriverVersion, DriverDate, AdapterRAM, PNPDeviceID)
# Leer VRAM real de 64 bits desde el registro (evita el tope de 4GB de Win32_VideoController.AdapterRAM)
$vramMap = @{}
Get-ItemProperty "HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.DriverDesc -and $_.'HardwareInformation.qwMemorySize') {
    $vramMap[$_.DriverDesc.Trim()] = [int64]$_.'HardwareInformation.qwMemorySize'
  }
}
$gpusEnriched = $gpus | ForEach-Object {
  $n = if ($_.Name) { $_.Name.Trim() } else { '' }
  $realBytes = if ($vramMap.ContainsKey($n)) { $vramMap[$n] } else { [int64]$_.AdapterRAM }
  [PSCustomObject]@{
    Name = $n
    AdapterCompatibility = $_.AdapterCompatibility
    DriverVersion = $_.DriverVersion
    DriverDate = $_.DriverDate
    RealVramBytes = $realBytes
    PNPDeviceID = $_.PNPDeviceID
  }
}
$cs = Get-CimInstance Win32_ComputerSystem | Select-Object -First 1 Manufacturer, Model, SystemFamily, PCSystemType
$csp = Get-CimInstance Win32_ComputerSystemProduct | Select-Object -First 1 Vendor, Name, Version
$chassis = @((Get-CimInstance Win32_SystemEnclosure | Select-Object -First 1).ChassisTypes)
$battery = @(Get-CimInstance Win32_Battery).Count
$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer, Product, Version
$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1 SMBIOSBIOSVersion, ReleaseDate
$ramPhysical = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
# Una sola consulta de drivers firmados para audio, red, Bluetooth, cámaras y lectores de huella
$signed = @(Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceID -and $_.DeviceName -and $_.DeviceClass -in @('MEDIA','NET','BLUETOOTH','CAMERA','IMAGE','BIOMETRIC') } | Select-Object DeviceName, Manufacturer, DriverVersion, DriverDate, DeviceID, DeviceClass)
$net = @(Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true -and $_.PNPDeviceID } | Select-Object Name, Manufacturer, NetConnectionID, PNPDeviceID)
$pdisks = @(Get-CimInstance -Namespace root\\Microsoft\\Windows\\Storage -ClassName MSFT_PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, Size)
$disks = @(Get-CimInstance Win32_DiskDrive | Select-Object Index, Model, Size, InterfaceType, MediaType, PNPDeviceID)
$osInfo = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption, Version, BuildNumber, OSArchitecture
@{
  cpu = $cpu
  gpus = @($gpusEnriched)
  cs = $cs
  csp = $csp
  chassis = $chassis
  battery = $battery
  board = $board
  bios = $bios
  ramPhysical = $ramPhysical
  signed = $signed
  net = $net
  pdisks = $pdisks
  disks = $disks
  os = $osInfo
} | ConvertTo-Json -Depth 4 -Compress
`;

  // Win32_PnPSignedDriver puede tardar en equipos lentos o recién formateados
  const result = await runPowerShell(psScript, 60000);
  let parsed = null;
  if (result.ok && result.stdout) {
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }
  }
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const cpus = os.cpus() || [];
  const usableRamGb = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
  const installedRamGb = parsed?.ramPhysical
    ? Math.round(Number(parsed.ramPhysical) / (1024 ** 3))
    : Math.ceil(usableRamGb);

  const gpusNormalized = list(parsed?.gpus)
    .filter((g) => g && g.Name && !/Microsoft Basic|Microsoft Remote|Parsec|Virtual Display|Meta Virtual|Citrix|DisplayLink|Mirage|Spacedesk|Splashtop|IddSampleDriver|Remote Display/i.test(g.Name))
    .map((g) => ({
      ...g,
      realVramGb: g.RealVramBytes ? Math.round((Number(g.RealVramBytes) / (1024 ** 3)) * 10) / 10 : 0,
    }));

  const cpuName = parsed?.cpu?.Name?.trim() || cpus[0]?.model?.trim() || 'Procesador';
  const classifiedGpus = gpusNormalized.map((g) => ({
    ...g,
    ...classifyGpu(g, cpuName, gpusNormalized),
  }));

  const dedicatedGpu = classifiedGpus.find((g) => !g.isIntegrated) || null;
  const integratedGpu = classifiedGpus.find((g) => g.isIntegrated) || null;

  // ---------- Tipo de equipo y fabricante
  const cs = parsed?.cs || {};
  const formFactor = formFactorOf(cs, parsed?.chassis, Number(parsed?.battery || 0));
  const boardVendor = String(parsed?.board?.Manufacturer || '').trim();
  const systemVendor = String(cs.Manufacturer || parsed?.csp?.Vendor || '').trim();
  const oemCandidate = oemFor(systemVendor) || (formFactor === 'laptop' ? oemFor(boardVendor) : null);
  // PC armado: placa MSI/ASUS/Gigabyte/ASRock en un escritorio. Equipo de marca: portátil o un OEM (Dell, HP, Lenovo…).
  const isDiyDesktop = formFactor === 'desktop' && (!oemCandidate || DIY_BOARD_RE.test(systemVendor) || PLACEHOLDER_RE.test(systemVendor));
  const oem = formFactor === 'vm' || isDiyDesktop ? null : oemCandidate;
  const friendlyModel = friendlyModelOf(cs, parsed?.csp);
  const deviceModel = oem && friendlyModel
    ? (new RegExp(`^${oem.short.split(' ')[0]}`, 'i').test(friendlyModel) ? friendlyModel : `${oem.short} ${friendlyModel}`)
    : null;
  const cpuArch = Number(parsed?.cpu?.Architecture);
  const isArm = cpuArch === 12 || cpuArch === 5 || /ARM/i.test(String(parsed?.os?.OSArchitecture || '')) || /SNAPDRAGON|QUALCOMM/i.test(cpuName);
  const buildNumber = Number(parsed?.os?.BuildNumber || 0);
  const osCaption = String(parsed?.os?.Caption || '').replace(/^Microsoft\s+/i, '').trim();

  const systemSummary = {
    hostname: os.hostname(),
    osName: osCaption || `Windows ${os.release()}`,
    osBuild: parsed?.os?.BuildNumber ? `Build ${parsed.os.BuildNumber}` : os.release(),
    buildNumber,
    isWindows11: buildNumber >= 22000,
    architecture: isArm ? 'ARM64' : 'x64',
    formFactor,
    isLaptop: formFactor === 'laptop',
    isVirtualMachine: formFactor === 'vm',
    manufacturer: oem?.short || systemVendor || boardVendor || null,
    model: deviceModel || friendlyModel || null,
    isBrandSystem: Boolean(oem),
    oemSupportUrl: oem?.url || null,
    cpuName,
    cpuVendor: /AMD|RYZEN|ATHLON|EPYC|THREADRIPPER/i.test(cpuName) ? 'AMD' : /INTEL|CORE|XEON|CELERON|PENTIUM/i.test(cpuName) ? 'Intel' : isArm ? 'Qualcomm' : 'Otro',
    cores: parsed?.cpu?.NumberOfCores || Math.max(1, Math.floor(cpus.length / 2)),
    threads: parsed?.cpu?.NumberOfLogicalProcessors || cpus.length,
    ramGb: installedRamGb,
    usableRamGb,
    hasIntegratedGpu: Boolean(integratedGpu),
    integratedGpuName: integratedGpu ? integratedGpu.Name : null,
    dedicatedGpuName: dedicatedGpu ? dedicatedGpu.Name : null,
    dedicatedGpuVramGb: dedicatedGpu ? Math.round(dedicatedGpu.realVramGb) : 0,
    gpuVendor: gpuVendorOf(dedicatedGpu?.Name) || gpuVendorOf(integratedGpu?.Name) || 'Otro',
    detectedVia: parsed ? 'WMI / CIM + Registro 64-bit' : 'Detección base del sistema',
    scannedAt: new Date().toISOString(),
  };

  const oemSupportUrl = oem?.url || null;
  const components = [];

  // Drivers firmados por instancia de dispositivo (coincidencia exacta, sin adivinar por nombre)
  const signed = list(parsed?.signed);
  const byInstance = new Map(signed.map((d) => [String(d.DeviceID).toUpperCase(), d]));
  const physicalId = (id) => /^(PCI|USB|HDAUDIO|INTELAUDIO|ACPI|SDIO|SWD\\DRIVERENUM|AMDAUDIO|QCOM|MTK)/i.test(String(id || '')) && !/^SWD\\(?!DRIVERENUM)/i.test(String(id || ''));

  // 1. GPUs (primero la dedicada, luego la integrada del CPU)
  const orderedGpus = [
    ...classifiedGpus.filter((g) => !g.isIntegrated),
    ...classifiedGpus.filter((g) => g.isIntegrated),
  ];

  orderedGpus.forEach((gpu, index) => {
    const vramLabel = gpu.realVramGb >= 1 ? `${Math.round(gpu.realVramGb)} GB VRAM` : 'Memoria compartida';
    components.push(
      enrichDriverMetadata({
        id: `drv-${gpu.isIntegrated ? 'igpu' : 'gpu'}-${index}`,
        category: gpu.isIntegrated ? 'igpu' : 'gpu',
        categoryLabel: gpu.roleLabel,
        isIntegratedGpu: gpu.isIntegrated,
        hasDedicatedGpu: Boolean(dedicatedGpu),
        name: gpu.Name,
        vendor: gpu.AdapterCompatibility || gpuVendorOf(gpu.Name) || 'GPU',
        installedVersion: gpu.DriverVersion || 'Desconocida',
        installedDate: formatDriverDate(gpu.DriverDate),
        hardwareDetail: gpu.isIntegrated ? `Integrada en CPU · ${vramLabel}` : `Dedicada · ${vramLabel}`,
        pnpInstanceIds: gpu.PNPDeviceID ? [gpu.PNPDeviceID] : [],
        oemSupportUrl,
      })
    );
  });

  // 2. CPU (indicando explícitamente si posee GPU integrada)
  const igpuTag = integratedGpu ? `Con iGPU (${integratedGpu.Name})` : 'Sin GPU integrada';
  components.push(
    enrichDriverMetadata({
      id: 'drv-cpu-0',
      category: 'cpu',
      categoryLabel: 'CPU / Procesador',
      name: systemSummary.cpuName,
      vendor: parsed?.cpu?.Manufacturer || systemSummary.cpuVendor,
      installedVersion: `${systemSummary.cores}C / ${systemSummary.threads}T`,
      installedDate: 'Activo',
      hardwareDetail: `${parsed?.cpu?.MaxClockSpeed ? `${(parsed.cpu.MaxClockSpeed / 1000).toFixed(2)} GHz · ` : ''}${isArm ? 'ARM64 · ' : ''}${igpuTag}`,
      pnpScope: 'system-pci',
      oemSupportUrl,
    })
  );

  // 3. Placa madre / Chipset (o el equipo completo si es un portátil o PC de marca)
  const boardName = parsed?.board
    ? `${parsed.board.Manufacturer || ''} ${parsed.board.Product || ''}`.trim()
    : 'Placa madre principal (Chipset)';
  components.push(
    enrichDriverMetadata({
      id: 'drv-mobo-0',
      category: 'motherboard',
      categoryLabel: oem ? (formFactor === 'laptop' ? 'Portátil / BIOS' : 'Equipo / BIOS') : 'Placa Madre / Chipset',
      name: oem ? deviceModel || `${oem.short} ${boardName}` : boardName || 'Placa madre',
      vendor: oem ? oem.short : parsed?.board?.Manufacturer || 'Fabricante OEM',
      installedVersion: parsed?.bios?.SMBIOSBIOSVersion || 'BIOS detectada',
      installedDate: formatDriverDate(parsed?.bios?.ReleaseDate),
      hardwareDetail: oem
        ? `Placa ${boardName || '—'}`
        : parsed?.board?.Version && !PLACEHOLDER_RE.test(parsed.board.Version) ? `Rev. ${parsed.board.Version}` : 'Chipset y controladores de sistema',
      pnpScope: 'system-pci',
      oem,
      oemSupportUrl,
    })
  );

  // 4. Audio: todos los dispositivos de sonido reales (sin audio HDMI de la GPU ni virtuales)
  const VIRTUAL_AUDIO = /Iriun|DroidCam|Virtual|Steam Streaming|VB-Audio|Voicemeeter|Oculus|NVIDIA Broadcast|Nahimic Mirroring|Sonic Studio Virtual|Wave Link|Elgato|OBS|Discord|Camo|Display Audio|HDMI|DisplayPort/i;
  const audioDevices = signed
    .filter((a) => a.DeviceClass === 'MEDIA' && physicalId(a.DeviceID) && !/^SWD/i.test(a.DeviceID))
    .filter((a) => !VIRTUAL_AUDIO.test(a.DeviceName) && !/VEN_10DE|VEN_1002&DEV_AA|VEN_1002&DEV_AB/i.test(a.DeviceID))
    .sort((a, b) => {
      const rank = (d) => (/Realtek|Conexant|Cirrus|IDT|Synaptics|High Definition Audio|Intel.*Smart Sound|Smart Sound/i.test(d.DeviceName) ? 0 : /^USB/i.test(d.DeviceID) ? 2 : 1);
      return rank(a) - rank(b);
    })
    .slice(0, 3);
  audioDevices.forEach((a, i) => {
    components.push(
      enrichDriverMetadata({
        id: `drv-audio-${i}`,
        category: 'audio',
        categoryLabel: i === 0 ? 'Audio Principal' : 'Audio',
        name: a.DeviceName,
        vendor: a.Manufacturer || 'Audio',
        installedVersion: a.DriverVersion || 'Detectado',
        installedDate: formatDriverDate(a.DriverDate),
        hardwareDetail: /^USB/i.test(a.DeviceID) ? 'Dispositivo de audio USB' : 'Controlador de sonido principal',
        pnpInstanceIds: [a.DeviceID],
        oemSupportUrl,
      })
    );
  });

  // 5. Red: Ethernet y Wi-Fi por separado (sin adaptadores virtuales ni VPN)
  const isWifi = (n) => /Wi-?Fi|Wireless|WLAN|802\.11|Killer.*(AX|AC|BE)\d|Dual Band|\bAX\d{3}|\bBE\d{3}|MediaTek.*MT79|Qualcomm.*(QCA|WCN|FastConnect)/i.test(n);
  const netList = list(parsed?.net)
    .filter((n) => n && n.Name && /^(PCI|USB|SDIO|ACPI|QCOM)/i.test(String(n.PNPDeviceID || '')))
    .filter((n) => !/Bluetooth|Virtual|TAP|Hyper-V|WAN Miniport|VPN|Npcap|Loopback|ZeroTier|Tailscale|WireGuard|Hamachi|VirtualBox|VMware|Kernel Debug|Wi-Fi Direct/i.test(n.Name));
  const netOrdered = [...netList.filter((n) => !isWifi(n.Name)), ...netList.filter((n) => isWifi(n.Name))].slice(0, 3);
  netOrdered.forEach((n, i) => {
    const drv = byInstance.get(String(n.PNPDeviceID).toUpperCase());
    const wifi = isWifi(n.Name);
    components.push(
      enrichDriverMetadata({
        id: `drv-net-${i}`,
        category: 'network',
        categoryLabel: wifi ? 'Red Wi-Fi' : 'Red Ethernet',
        name: n.Name,
        vendor: n.Manufacturer || drv?.Manufacturer || 'Red',
        installedVersion: drv?.DriverVersion || 'Instalado',
        installedDate: formatDriverDate(drv?.DriverDate),
        hardwareDetail: n.NetConnectionID || (wifi ? 'Adaptador inalámbrico' : 'Interfaz de red física'),
        pnpInstanceIds: [n.PNPDeviceID],
        oemSupportUrl,
      })
    );
  });

  // 6. Bluetooth, cámaras y lectores de huella (comunes en portátiles)
  const extras = [
    { cls: ['BLUETOOTH'], category: 'bluetooth', label: 'Bluetooth', max: 1, skip: /Enumerator|LE Enumerator|RFCOMM|Personal Area|Device \(|Avrcp|Hands-?Free|A2DP|Microsoft Bluetooth/i, idRe: /^(USB|PCI|SDIO|ACPI|QCOM)/i },
    { cls: ['CAMERA', 'IMAGE'], category: 'camera', label: 'Cámara', max: 2, skip: /Virtual|OBS|DroidCam|Iriun|Camo|Snap Camera|NVIDIA Broadcast|XSplit|ManyCam|Scanner|Printer|Escáner|Impresora/i, idRe: /^(USB|PCI|ACPI|MIPI|INTELMIPI|QCOM|SWD\\DRIVERENUM)/i },
    { cls: ['BIOMETRIC'], category: 'biometric', label: 'Lector de huella / Windows Hello', max: 1, skip: /^$/, idRe: /^(USB|PCI|ACPI|SPI)/i },
  ];
  for (const ex of extras) {
    signed
      .filter((d) => ex.cls.includes(d.DeviceClass) && ex.idRe.test(String(d.DeviceID)) && !ex.skip.test(d.DeviceName))
      .slice(0, ex.max)
      .forEach((d, i) => {
        components.push(
          enrichDriverMetadata({
            id: `drv-${ex.category}-${i}`,
            category: ex.category,
            categoryLabel: ex.label,
            name: d.DeviceName,
            vendor: d.Manufacturer || ex.label,
            installedVersion: d.DriverVersion || 'Detectado',
            installedDate: formatDriverDate(d.DriverDate),
            hardwareDetail: ex.category === 'camera' && /IR\b|Infrared|Infrarroja/i.test(d.DeviceName) ? 'Cámara infrarroja (Windows Hello)' : ex.label,
            pnpInstanceIds: [d.DeviceID],
            oemSupportUrl,
          })
        );
      });
  }

  // 7. Almacenamiento interno: todos los discos (sin pendrives ni discos virtuales)
  const BUS = { 1: 'SCSI', 3: 'ATA', 6: 'Fibre', 7: 'USB', 8: 'RAID', 10: 'SAS', 11: 'SATA', 12: 'SD', 13: 'MMC', 15: 'Virtual', 17: 'NVMe', 18: 'SCM', 19: 'UFS' };
  const MEDIA = { 3: 'HDD', 4: 'SSD', 5: 'SCM' };
  const pdisks = new Map(list(parsed?.pdisks).map((p) => [String(p.DeviceId), p]));
  const internalDisks = list(parsed?.disks)
    .filter((d) => d && d.Model)
    .map((d) => {
      const p = pdisks.get(String(d.Index));
      const bus = BUS[Number(p?.BusType)] || (/USB/i.test(String(d.InterfaceType || '')) ? 'USB' : null);
      const media = MEDIA[Number(p?.MediaType)] || null;
      return { ...d, bus, media };
    })
    .filter((d) => d.bus !== 'USB' && d.bus !== 'Virtual' && !/Removable/i.test(String(d.MediaType || '')) && !/Virtual|Msft Virtual|VMware|VBOX/i.test(d.Model))
    .sort((a, b) => Number(a.Index) - Number(b.Index))
    .slice(0, 4);
  internalDisks.forEach((disk, i) => {
    const gb = disk.Size ? Math.round(Number(disk.Size) / (1024 ** 3)) : 0;
    const isNvme = disk.bus === 'NVMe' || /NVMe/i.test(disk.Model);
    const kind = isNvme ? 'NVMe SSD' : disk.media === 'SSD' ? `${disk.bus || 'SATA'} SSD` : disk.media === 'HDD' ? `${disk.bus || 'SATA'} HDD` : disk.bus || disk.InterfaceType || 'Disco';
    const size = gb >= 1000 ? `${(gb / 1024).toFixed(gb >= 10240 ? 0 : 1)} TB` : `${gb} GB`;
    components.push(
      enrichDriverMetadata({
        id: `drv-storage-${i}`,
        category: 'storage',
        categoryLabel: i === 0 ? 'Almacenamiento Principal' : 'Almacenamiento',
        name: disk.Model,
        vendor: kind,
        installedVersion: 'Estándar Windows',
        installedDate: 'Verificado',
        hardwareDetail: gb ? `${size} · ${kind}` : kind,
        // El controlador de discos (NVMe/SATA) se revisa una sola vez, con el primer disco
        pnpScope: i === 0 ? 'storage-pci' : null,
        oemSupportUrl,
      })
    );
  });

  // La versión más nueva de cada driver la completa después checkDriverUpdates() (Windows Update).
  for (const c of components) {
    if (c.category === 'motherboard') continue;
    c.liveCheck = 'pending';
    c.targetLabel = 'Consultando Windows Update…';
  }

  lastScan = {
    system: systemSummary,
    drivers: components,
    advisoriesCount: components.filter((c) => c.advisory && c.advisory.level === 'warn').length,
    updatesCount: components.filter((c) => c.needsUpdate).length,
  };
  return lastScan;
}

// Último escaneo en el proceso principal: el instalador de drivers toma de aquí los IDs de
// dispositivo en lugar de confiar en lo que envíe la interfaz.
let lastScan = null;
function getLastHardwareScan() {
  return lastScan;
}

// Monitor en vivo liviano (CPU %, RAM, disco del sistema y temp GPU NVIDIA si está disponible)
let prevCpuSnap = null;
let gpuProbeCache = { checkedAt: 0, available: true, data: null };

function readCpuUsagePct() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    const t = c.times || {};
    idle += t.idle || 0;
    total += (t.user || 0) + (t.nice || 0) + (t.sys || 0) + (t.irq || 0) + (t.idle || 0);
  }
  if (!prevCpuSnap) {
    prevCpuSnap = { idle, total };
    return 0;
  }
  const dIdle = Math.max(0, idle - prevCpuSnap.idle);
  const dTotal = Math.max(1, total - prevCpuSnap.total);
  prevCpuSnap = { idle, total };
  return Math.max(0, Math.min(100, Math.round(((dTotal - dIdle) / dTotal) * 100)));
}

function readSystemDiskMetrics() {
  const sysDrive = (process.env.SystemDrive || 'C:') + '\\';
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(sysDrive);
      const totalBytes = Number(s.blocks || 0) * Number(s.bsize || 0);
      const freeBytes = Number(s.bavail || s.bfree || 0) * Number(s.bsize || 0);
      if (totalBytes > 0) {
        const totalGb = Math.round((totalBytes / 1024 ** 3) * 10) / 10;
        const freeGb = Math.round((freeBytes / 1024 ** 3) * 10) / 10;
        const usedPct = Math.max(0, Math.min(100, Math.round(((totalBytes - freeBytes) / totalBytes) * 100)));
        return { drive: sysDrive.slice(0, 2), freeGb, totalGb, usedPct };
      }
    }
  } catch {
    // Ignorar si statfsSync falla
  }
  return null;
}

function probeNvidiaGpuLive() {
  const now = Date.now();
  if (!gpuProbeCache.available) return Promise.resolve(null);
  if (now - gpuProbeCache.checkedAt < 4500) return Promise.resolve(gpuProbeCache.data);
  gpuProbeCache.checkedAt = now;
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=temperature.gpu,utilization.gpu', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 2000 },
      (err, stdout) => {
        if (err || !stdout) {
          if (err && err.code === 'ENOENT') gpuProbeCache.available = false;
          gpuProbeCache.data = null;
          resolve(null);
          return;
        }
        const first = String(stdout).trim().split(/\r?\n/)[0] || '';
        const [t, u] = first.split(',').map((v) => Number(String(v).trim()));
        if (Number.isFinite(t) && t > 0) {
          gpuProbeCache.data = { tempC: Math.round(t), utilPct: Number.isFinite(u) ? Math.round(u) : null };
          resolve(gpuProbeCache.data);
        } else {
          gpuProbeCache.data = null;
          resolve(null);
        }
      }
    );
  });
}

async function getLiveSystemMetrics() {
  const cpuPct = readCpuUsagePct();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const ramTotalGb = Math.round((totalMem / 1024 ** 3) * 10) / 10;
  const ramUsedGb = Math.round((usedMem / 1024 ** 3) * 10) / 10;
  const ramPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
  const disk = readSystemDiskMetrics();
  const gpu = await probeNvidiaGpuLive();
  return {
    ok: true,
    cpuPct,
    ramUsedGb,
    ramTotalGb,
    ramPct,
    disk,
    gpu,
    uptimeSec: Math.round(os.uptime()),
  };
}

module.exports = {
  formatNvidiaVersion,
  isIntegratedGpuName,
  oemFor,
  detectHardwareAndDrivers,
  getLastHardwareScan,
  getLiveSystemMetrics,
  fetchJson,
};
