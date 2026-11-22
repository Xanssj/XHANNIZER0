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
      wingetId: 'Nvidia.NvidiaApp',
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

function compareVersions(a, b) {
  const pa = String(a || '0').replace(/[^0-9.]/g, '').split('.').map(Number);
  const pb = String(b || '0').replace(/[^0-9.]/g, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// Clasifica con precisión si una GPU es integrada del CPU (iGPU) o dedicada (dGPU)
function classifyGpu(gpu, cpuName, allGpus) {
  const name = String(gpu.Name || '').toUpperCase();
  const cpu = String(cpuName || '').toUpperCase();
  const vramGb = Number(gpu.realVramGb || 0);

  // Gráficos integrados AMD (Ryzen 7000/8000/9000 o APU Vega)
  const isAmdIntegratedName =
    /^AMD RADEON\(TM\) GRAPHICS$/i.test(gpu.Name?.trim() || '') ||
    /RADEON\(TM\) VEGA|RADEON\(TM\) \d{3}M|RADEON GRAPHICS$/i.test(name);
  const isAmdDedicated = /RX\s*\d|RADEON PRO|FIREPRO|VII|FUR[Y]/i.test(name);

  // Gráficos integrados Intel (UHD, Iris, HD Graphics — excluyendo Arc dedicada)
  const isIntelIntegrated = /INTEL.*(UHD|HD GRAPHICS|IRIS|INTEGRATED)/i.test(name) && !/ARC\s*A\d|ARC\s*B\d/i.test(name);

  // Gráficos dedicados NVIDIA
  const isNvidiaDedicated = /NVIDIA|GEFORCE|RTX|GTX|QUADRO|TITAN/i.test(name);

  const hasDedicatedAlongside = allGpus.some((g) => /NVIDIA|GEFORCE|RTX|GTX|RX\s*\d|ARC\s*[AB]\d/i.test(String(g.Name || '')));

  if (isNvidiaDedicated || isAmdDedicated) {
    return { isIntegrated: false, roleLabel: 'GPU Dedicada (dGPU)' };
  }
  if (isIntelIntegrated || (isAmdIntegratedName && !isAmdDedicated)) {
    return { isIntegrated: true, roleLabel: 'GPU Integrada del CPU (iGPU)' };
  }
  if (hasDedicatedAlongside && vramGb > 0 && vramGb <= 2.5 && (cpu.includes('AMD') || cpu.includes('INTEL'))) {
    return { isIntegrated: true, roleLabel: 'GPU Integrada del CPU (iGPU)' };
  }
  return { isIntegrated: false, roleLabel: 'GPU / Gráficos' };
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
  if (component.category === 'igpu') {
    const isAmd = combined.includes('AMD') || combined.includes('RADEON');
    return {
      ...component,
      vendor: isAmd ? 'AMD' : 'Intel',
      installedVersionDisplay: component.installedVersion || 'Detectado',
      latestVersion: isAmd ? 'Adrenalin / Chipset iGPU' : '32.0.101.6647',
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
      const latestVersion = '576.28';
      const safeVersion = '566.36 WHQL';
      const cmp = compareVersions(displayInstalled, latestVersion);
      const isOutdated = cmp < 0;
      const isIn572Branch = /^572\./.test(displayInstalled);
      return {
        ...component,
        vendor: 'NVIDIA',
        installedVersionDisplay: displayInstalled,
        latestVersion: isOutdated ? latestVersion : displayInstalled,
        safeVersion,
        sourceName: 'NVIDIA Official Drivers',
        officialUrl: 'https://www.nvidia.com/es-la/drivers/',
        safeUrl: 'https://www.nvidia.com/es-la/drivers/details/237719/',
        wingetId: 'Nvidia.NvidiaApp',
        needsUpdate: isOutdated,
        status: isIn572Branch ? 'warning' : isOutdated ? 'available' : 'ok',
        advisory: isIn572Branch
          ? {
              level: 'warn',
              title: 'Precaución reportada en rama 572.xx (GPU)',
              summary: 'Notas oficiales de NVIDIA reportan pantallas negras intermitentes con G-SYNC/DisplayPort en la rama 572.xx. Se recomienda actualizar o usar la versión segura 566.36 WHQL.',
              recommendation: 'safe',
            }
          : isOutdated
          ? {
              level: 'info',
              title: 'Rama estable WHQL disponible',
              summary: 'Si prefieres máxima estabilidad tras formatear en lugar de la última rama Game Ready, puedes elegir la versión segura 566.36 WHQL.',
              recommendation: 'safe',
            }
          : null,
      };
    }

    if (combined.includes('AMD') || combined.includes('RADEON')) {
      const latestVersion = '25.3.1';
      const safeVersion = '24.12.1 WHQL';
      return {
        ...component,
        vendor: 'AMD',
        installedVersionDisplay: component.installedVersion || 'Detectado',
        latestVersion,
        safeVersion,
        sourceName: 'AMD Official Support',
        officialUrl: 'https://www.amd.com/es/support/download/drivers.html',
        safeUrl: 'https://www.amd.com/es/resources/support-articles/release-notes/RN-RAD-WIN-24-12-1.html',
        needsUpdate: true,
        status: 'warning',
        advisory: {
          level: 'warn',
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
        latestVersion: '32.0.101.6647',
        safeVersion: '32.0.101.6559 WHQL',
        sourceName: 'Intel Download Center',
        officialUrl: 'https://www.intel.la/content/www/xl/es/download-center/home.html',
        safeUrl: 'https://www.intel.la/content/www/xl/es/support/detect.html',
        needsUpdate: compareVersions(component.installedVersion, '32.0.101.6559') < 0,
        status: compareVersions(component.installedVersion, '32.0.101.6559') < 0 ? 'available' : 'ok',
        advisory: null,
      };
    }
  }

  // ---------- CPU ----------
  if (component.category === 'cpu') {
    if (combined.includes('AMD') || combined.includes('RYZEN')) {
      return {
        ...component,
        vendor: 'AMD',
        latestVersion: '7.02.13.148',
        safeVersion: '6.10.17.152 WHQL',
        sourceName: 'AMD Ryzen Chipset Drivers',
        officialUrl: 'https://www.amd.com/es/support/download/drivers.html',
        safeUrl: 'https://www.amd.com/es/support/download/drivers.html',
        needsUpdate: true,
        status: 'available',
        advisory: {
          level: 'info',
          title: 'Plan de energía y programación de núcleos',
          summary: 'Instalar el paquete oficial de chipset AMD habilita el correcto estacionamiento de núcleos (CPPC) y reduce latencias en Ryzen.',
          recommendation: 'latest',
        },
      };
    }
    return {
      ...component,
      vendor: combined.includes('INTEL') ? 'Intel' : component.vendor || 'Fabricante',
      latestVersion: '10.1.19913.8607',
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
    return {
      ...component,
      sourceName,
      officialUrl,
      safeUrl: officialUrl,
      latestVersion: 'Chipset / BIOS Oficial',
      safeVersion: 'Rama WHQL Estable',
      needsUpdate: true,
      status: 'warning',
      advisory: {
        level: 'warn',
        title: 'Precaución en placa madre y chipset',
        summary: 'Evita instalar utilidades RGB/bloatware del fabricante (Armoury Crate, MSI Center, GCC) si solo necesitas el driver limpio de chipset. Verifica la revisión exacta de tu placa antes de actualizar BIOS.',
        recommendation: 'safe',
      },
    };
  }

  // ---------- AUDIO ----------
  if (component.category === 'audio') {
    const isRealtek = combined.includes('REALTEK');
    return {
      ...component,
      vendor: isRealtek ? 'Realtek' : component.vendor || 'Audio',
      latestVersion: isRealtek ? '6.0.9733.1' : 'Última WHQL',
      safeVersion: isRealtek ? '6.0.9689.1 WHQL (UAD)' : 'Driver OEM Estable',
      sourceName: isRealtek ? 'Realtek / OEM UAD Oficial' : 'Controlador oficial de audio',
      officialUrl: isRealtek
        ? 'https://www.realtek.com/Download/List?cate_id=593'
        : 'https://support.microsoft.com/windows',
      safeUrl: 'https://www.realtek.com/Download/List?cate_id=593',
      needsUpdate: isRealtek && compareVersions(component.installedVersion, '6.0.9689.1') < 0,
      status: isRealtek ? 'warning' : 'ok',
      advisory: isRealtek
        ? {
            level: 'warn',
            title: 'Aviso conocido en drivers Realtek UAD',
            summary: 'Algunas actualizaciones genéricas de Realtek alteran el volumen del micrófono o desactivan el panel OEM. Se recomienda respaldo previo y usar la versión WHQL estable.',
            recommendation: 'safe',
          }
        : null,
    };
  }

  // ---------- RED ----------
  if (component.category === 'network') {
    const isIntel = combined.includes('INTEL');
    const isRealtek = combined.includes('REALTEK');
    return {
      ...component,
      vendor: isIntel ? 'Intel' : isRealtek ? 'Realtek' : component.vendor || 'Red',
      latestVersion: isIntel ? '23.110.0' : isRealtek ? '10.073.0815' : 'Oficial',
      safeVersion: isIntel ? '23.100.0 WHQL' : isRealtek ? '10.072.0524 WHQL' : 'Estable',
      sourceName: isIntel ? 'Intel Wired / Wi-Fi Drivers' : isRealtek ? 'Realtek Ethernet / Wi-Fi' : 'Fabricante de Red',
      officialUrl: isIntel
        ? 'https://www.intel.la/content/www/xl/es/download-center/home.html'
        : isRealtek
        ? 'https://www.realtek.com/Download/List?cate_id=584'
        : 'https://support.microsoft.com/windows',
      safeUrl: isIntel
        ? 'https://www.intel.la/content/www/xl/es/support/detect.html'
        : 'https://www.realtek.com/Download/List?cate_id=584',
      needsUpdate: false,
      status: 'ok',
      advisory: null,
    };
  }

  // ---------- ALMACENAMIENTO ----------
  return {
    ...component,
    sourceName: 'Windows / NVMe Oficial',
    officialUrl: 'https://support.microsoft.com/windows',
    safeUrl: 'https://support.microsoft.com/windows',
    latestVersion: 'NVMe Estable',
    safeVersion: 'Estándar Microsoft WHQL',
    needsUpdate: false,
    status: 'ok',
    advisory: null,
  };
}

async function detectHardwareAndDrivers() {
  const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed
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
$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1 Manufacturer, Product, Version
$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1 SMBIOSBIOSVersion, ReleaseDate
$ramPhysical = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
$audio = @(Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -eq 'MEDIA' -and $_.DeviceName } | Select-Object DeviceName, Manufacturer, DriverVersion, DriverDate, DeviceID)
$net = @(Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true -and $_.Name -notmatch 'Bluetooth|Virtual|TAP|Hyper-V|WAN' } | Select-Object -First 3 Name, Manufacturer, NetConnectionID, Speed, PNPDeviceID)
$netDrivers = @(Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -eq 'NET' -and $_.DeviceName } | Select-Object DeviceName, DriverVersion, DriverDate)
$disks = @(Get-CimInstance Win32_DiskDrive | Select-Object Model, Size, InterfaceType, MediaType)
$osInfo = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption, Version, BuildNumber, TotalVisibleMemorySize
@{
  cpu = $cpu
  gpus = @($gpusEnriched)
  board = $board
  bios = $bios
  ramPhysical = $ramPhysical
  audio = $audio
  net = $net
  netDrivers = $netDrivers
  disks = $disks
  os = $osInfo
} | ConvertTo-Json -Depth 4 -Compress
`;

  const result = await runPowerShell(psScript, 20000);
  let parsed = null;
  if (result.ok && result.stdout) {
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }
  }

  const cpus = os.cpus() || [];
  const usableRamGb = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
  const installedRamGb = parsed?.ramPhysical
    ? Math.round(Number(parsed.ramPhysical) / (1024 ** 3))
    : Math.ceil(usableRamGb);

  const rawGpus = Array.isArray(parsed?.gpus) ? parsed.gpus : parsed?.gpus ? [parsed.gpus] : [];
  const gpusNormalized = rawGpus
    .filter((g) => g && g.Name && !/Microsoft Basic|Parsec|Virtual Display|Meta Virtual/i.test(g.Name))
    .map((g) => ({
      ...g,
      realVramGb: g.RealVramBytes ? Math.round((Number(g.RealVramBytes) / (1024 ** 3)) * 10) / 10 : 0,
    }));

  const cpuName = parsed?.cpu?.Name?.trim() || cpus[0]?.model?.trim() || 'Procesador x64';
  const classifiedGpus = gpusNormalized.map((g) => ({
    ...g,
    ...classifyGpu(g, cpuName, gpusNormalized),
  }));

  const dedicatedGpu = classifiedGpus.find((g) => !g.isIntegrated) || null;
  const integratedGpu = classifiedGpus.find((g) => g.isIntegrated) || null;

  const systemSummary = {
    hostname: os.hostname(),
    osName: parsed?.os?.Caption || `Windows ${os.release()}`,
    osBuild: parsed?.os?.BuildNumber ? `Build ${parsed.os.BuildNumber}` : os.release(),
    cpuName,
    cores: parsed?.cpu?.NumberOfCores || Math.max(1, Math.floor(cpus.length / 2)),
    threads: parsed?.cpu?.NumberOfLogicalProcessors || cpus.length,
    ramGb: installedRamGb,
    usableRamGb,
    hasIntegratedGpu: Boolean(integratedGpu),
    integratedGpuName: integratedGpu ? integratedGpu.Name : null,
    dedicatedGpuName: dedicatedGpu ? dedicatedGpu.Name : null,
    dedicatedGpuVramGb: dedicatedGpu ? Math.round(dedicatedGpu.realVramGb) : 0,
    gpuVendor: dedicatedGpu
      ? /NVIDIA/i.test(dedicatedGpu.Name)
        ? 'NVIDIA'
        : /AMD|RADEON/i.test(dedicatedGpu.Name)
        ? 'AMD'
        : 'Intel'
      : integratedGpu && /AMD|RADEON/i.test(integratedGpu.Name)
      ? 'AMD'
      : 'Intel',
    detectedVia: parsed ? 'WMI / CIM + Registro 64-bit' : 'Detección base del sistema',
    scannedAt: new Date().toISOString(),
  };

  const components = [];

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
        vendor: gpu.AdapterCompatibility || 'GPU',
        installedVersion: gpu.DriverVersion || 'Desconocida',
        installedDate: formatDriverDate(gpu.DriverDate),
        hardwareDetail: gpu.isIntegrated ? `Integrada en CPU · ${vramLabel}` : `Dedicada · ${vramLabel}`,
        pnpInstanceIds: gpu.PNPDeviceID ? [gpu.PNPDeviceID] : [],
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
      vendor: parsed?.cpu?.Manufacturer || (systemSummary.cpuName.includes('AMD') ? 'AMD' : 'Intel'),
      installedVersion: `${systemSummary.cores}C / ${systemSummary.threads}T`,
      installedDate: 'Activo',
      hardwareDetail: `${parsed?.cpu?.MaxClockSpeed ? `${(parsed.cpu.MaxClockSpeed / 1000).toFixed(2)} GHz · ` : ''}${igpuTag}`,
      pnpScope: 'system-pci',
    })
  );

  // 3. Placa madre / Chipset
  const boardName = parsed?.board
    ? `${parsed.board.Manufacturer || ''} ${parsed.board.Product || ''}`.trim()
    : 'Placa madre principal (Chipset)';
  components.push(
    enrichDriverMetadata({
      id: 'drv-mobo-0',
      category: 'motherboard',
      categoryLabel: 'Placa Madre / Chipset',
      name: boardName,
      vendor: parsed?.board?.Manufacturer || 'Fabricante OEM',
      installedVersion: parsed?.bios?.SMBIOSBIOSVersion || 'BIOS detectada',
      installedDate: formatDriverDate(parsed?.bios?.ReleaseDate),
      hardwareDetail: parsed?.board?.Version ? `Rev. ${parsed.board.Version}` : 'Chipset y controladores de sistema',
      pnpScope: 'system-pci',
    })
  );

  // 4. Audio (filtrando webcams virtuales como Iriun/DroidCam/VB-Cable)
  const audioList = Array.isArray(parsed?.audio) ? parsed.audio : parsed?.audio ? [parsed.audio] : [];
  const realAudio = audioList.filter(
    (a) => a && a.DeviceName && !/Iriun|DroidCam|Webcam|Camera|Virtual|Steam Streaming|VB-Audio|Oculus/i.test(a.DeviceName)
  );
  const primaryAudio =
    realAudio.find((a) => /Realtek/i.test(a.DeviceName)) ||
    realAudio.find((a) => /High Definition Audio|USB Audio|Focusrite|HyperX|Logitech|Razer|SteelSeries/i.test(a.DeviceName)) ||
    realAudio[0] ||
    audioList[0];

  if (primaryAudio) {
    components.push(
      enrichDriverMetadata({
        id: 'drv-audio-0',
        category: 'audio',
        categoryLabel: 'Audio Principal',
        name: primaryAudio.DeviceName,
        vendor: primaryAudio.Manufacturer || 'Audio',
        installedVersion: primaryAudio.DriverVersion || 'Detectado',
        installedDate: formatDriverDate(primaryAudio.DriverDate),
        hardwareDetail: 'Controlador de sonido principal',
        pnpInstanceIds: primaryAudio.DeviceID ? [primaryAudio.DeviceID] : [],
      })
    );
  }

  // 5. Red
  const netList = Array.isArray(parsed?.net) ? parsed.net : parsed?.net ? [parsed.net] : [];
  const netDrivers = Array.isArray(parsed?.netDrivers) ? parsed.netDrivers : [];
  const primaryNet = netList[0];
  if (primaryNet) {
    const matchedNetDrv = netDrivers.find(
      (d) => d.DeviceName && primaryNet.Name && d.DeviceName.toLowerCase().includes(primaryNet.Name.toLowerCase().slice(0, 14))
    );
    components.push(
      enrichDriverMetadata({
        id: 'drv-net-0',
        category: 'network',
        categoryLabel: 'Red / Ethernet & Wi-Fi',
        name: primaryNet.Name,
        vendor: primaryNet.Manufacturer || 'Red',
        installedVersion: matchedNetDrv?.DriverVersion || 'Instalado',
        installedDate: formatDriverDate(matchedNetDrv?.DriverDate),
        hardwareDetail: primaryNet.NetConnectionID || 'Interfaz de red física',
        pnpInstanceIds: primaryNet.PNPDeviceID ? [primaryNet.PNPDeviceID] : [],
      })
    );
  }

  // 6. Almacenamiento principal (excluyendo pendrives USB removibles)
  const rawDisks = Array.isArray(parsed?.disks) ? parsed.disks : parsed?.disks ? [parsed.disks] : [];
  const internalDisks = rawDisks.filter(
    (d) => d && d.Model && !/USB/i.test(String(d.InterfaceType || '')) && !/Removable/i.test(String(d.MediaType || ''))
  );
  const primaryDisk = internalDisks[0] || rawDisks[0];
  if (primaryDisk) {
    const gb = primaryDisk.Size ? Math.round(Number(primaryDisk.Size) / (1024 ** 3)) : 0;
    const isNvme = /NVMe|PCIe/i.test(primaryDisk.Model || '') || /SCSI/i.test(primaryDisk.InterfaceType || '');
    components.push(
      enrichDriverMetadata({
        id: 'drv-storage-0',
        category: 'storage',
        categoryLabel: 'Almacenamiento Principal',
        name: primaryDisk.Model,
        vendor: isNvme ? 'NVMe / SSD' : 'SATA',
        installedVersion: 'Estándar Windows',
        installedDate: 'Verificado',
        hardwareDetail: gb ? `${gb} GB · ${isNvme ? 'NVMe / SSD interno' : primaryDisk.InterfaceType || 'Disco interno'}` : 'Unidad interna',
        pnpScope: 'storage-pci',
      })
    );
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

module.exports = {
  detectHardwareAndDrivers,
  getLastHardwareScan,
  fetchJson,
};
