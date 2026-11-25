'use strict';

// Chequeo de PC recién armado: errores típicos de BIOS / montaje que Windows no avisa.
// Todo se lee sin permisos de administrador.
const { runPowerShell } = require('./powershell');
const { getLastHardwareScan, isIntegratedGpuName } = require('./hardware');

const PROBLEM_CODES = {
  1: 'Dispositivo no configurado correctamente',
  3: 'Driver dañado o falta memoria',
  10: 'El dispositivo no puede iniciar',
  12: 'Sin recursos suficientes',
  14: 'Requiere reiniciar Windows',
  18: 'Driver que debe reinstalarse',
  19: 'Configuración del registro dañada',
  21: 'Windows está quitando el dispositivo',
  28: 'Sin driver instalado',
  31: 'El driver no funciona correctamente',
  37: 'El driver no pudo inicializarse',
  39: 'Driver dañado o ausente',
  43: 'El dispositivo informó un problema (código 43)',
  52: 'Firma digital del driver no verificada',
};

// Velocidad nominal (XMP/EXPO) a partir del número de pieza de la RAM
function ratedSpeedFromPart(partNumber) {
  const p = String(partNumber || '').toUpperCase().replace(/\s+/g, '');
  const rules = [
    [/^KF[45](\d{2})C/, (m) => Number(m[1]) * 100], // Kingston Fury: KF552C40 → 5200, KF432C16 → 3200
    [/^KHX(\d{4})C/, (m) => Number(m[1])], // HyperX: KHX3200C16
    [/^KVR(\d{2})/, (m) => Number(m[1]) * 100], // Kingston ValueRAM: KVR32N22 → 3200
    [/^F[45]-(\d{4})/, (m) => Number(m[1])], // G.Skill: F5-6000J3038
    [/^CM[A-Z0-9]*?X[45]M\d[A-Z]?(\d{4})C\d/, (m) => Number(m[1])], // Corsair: CMK32GX4M2E3200C16
    [/^BL\d*K?\d*G(\d{2})C/, (m) => Number(m[1]) * 100], // Crucial Ballistix: BL16G36C16U4B → 3600
    [/^TF[A-Z0-9]*?(\d{4})HC/, (m) => Number(m[1])], // TeamGroup T-Force: TF3D416G3600HC18J
  ];
  for (const [re, fn] of rules) {
    const m = p.match(re);
    if (m) {
      const v = fn(m);
      if (v >= 1600 && v <= 10000) return v;
    }
  }
  const generic = p.match(/(?:^|\D)(2133|2400|2666|2933|3000|3200|3466|3600|3733|3866|4000|4133|4266|4400|4800|5200|5600|6000|6200|6400|6600|6800|7200|7600|8000|8200|8400)(?=C|\D|$)/);
  return generic ? Number(generic[1]) : null;
}

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$ram = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
  [pscustomobject]@{ capacity = [int64]$_.Capacity; speed = $_.Speed; configured = $_.ConfiguredClockSpeed; type = $_.SMBIOSMemoryType; part = ([string]$_.PartNumber).Trim(); slot = [string]$_.DeviceLocator; bank = [string]$_.BankLabel }
})
$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object {
  [pscustomobject]@{ name = $_.Name; res = $_.CurrentHorizontalResolution; pnp = $_.PNPDeviceID }
})
$pci = @(Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'PCI\\*' -and $_.Class -in @('Display','SCSIAdapter') } | ForEach-Object {
  $k = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName 'DEVPKEY_PciDevice_CurrentLinkSpeed','DEVPKEY_PciDevice_MaxLinkSpeed','DEVPKEY_PciDevice_CurrentLinkWidth','DEVPKEY_PciDevice_MaxLinkWidth'
  [pscustomobject]@{ name = $_.FriendlyName; cls = $_.Class; id = $_.InstanceId; curSpeed = $k[0].Data; maxSpeed = $k[1].Data; curWidth = $k[2].Data; maxWidth = $k[3].Data }
})
$sb = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State').UEFISecureBootEnabled
$tpm = (tpmtool getdeviceinformation 2>&1 | Out-String)
$bar = $null
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { $bar = (nvidia-smi -q -d MEMORY 2>$null | Out-String) }
$disks = @(Get-PhysicalDisk | Where-Object { $_.BusType -ne 'USB' } | ForEach-Object {
  $rc = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
  [pscustomobject]@{ name = $_.FriendlyName; health = [string]$_.HealthStatus; bus = [string]$_.BusType; media = [string]$_.MediaType
    temp = $rc.Temperature; wear = $rc.Wear; hours = $rc.PowerOnHours; readErr = $rc.ReadErrorsUncorrected }
})
$gpuTemp = $null
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { $gpuTemp = (nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>$null | Out-String) }
$problems = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.ConfigManagerErrorCode -and @(0,22,24,45) -notcontains $_.ConfigManagerErrorCode } | ForEach-Object {
  [pscustomobject]@{ name = $(if ($_.Name) { $_.Name } else { $_.Description }); id = $_.PNPDeviceID; code = $_.ConfigManagerErrorCode; cls = $_.PNPClass }
})
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
@{
  ram = $ram; gpus = $gpus; pci = $pci; secureBoot = $sb; firmware = $env:firmware_type; tpm = $tpm; bar = $bar
  disks = $disks; gpuTemp = $gpuTemp; problems = $problems; virt = $cpu.VirtualizationFirmwareEnabled; hyperv = [bool](Get-CimInstance Win32_ComputerSystem).HypervisorPresent
} | ConvertTo-Json -Depth 4 -Compress
`;

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const GEN = (n) => (n ? `Gen${n}` : '?');

function analyze(d, ctx = {}) {
  // En portátiles la RAM suele venir soldada, sin XMP en la BIOS, y la pantalla interna pasa por la
  // GPU integrada (gráficos híbridos): esos avisos de PC de escritorio no aplican.
  const laptop = ctx.formFactor === 'laptop';
  const vm = ctx.formFactor === 'vm';
  const checks = [];
  const push = (c) => checks.push(c);

  // ---------- RAM: XMP/EXPO y canales
  const ram = arr(d.ram).filter((m) => m && m.capacity > 0);
  if (ram.length) {
    const type = ram[0].type === 34 ? 'DDR5' : ram[0].type === 26 ? 'DDR4' : 'RAM';
    const configured = Math.min(...ram.map((m) => Number(m.configured || m.speed || 0)).filter(Boolean));
    const rated = Math.max(...ram.map((m) => ratedSpeedFromPart(m.part) || 0));
    const totalGb = Math.round(ram.reduce((s, m) => s + m.capacity, 0) / 1024 ** 3);
    const profile = 'XMP (Intel) o EXPO/DOCP (AMD)';
    if (laptop && rated && configured && rated - configured >= 200) {
      push({
        id: 'ram-xmp', category: 'Memoria RAM', status: 'info',
        title: `RAM a ${configured} MHz (los módulos admiten ${rated} MHz)`,
        detail: `${type} · ${totalGb} GB. En portátiles la velocidad la fija el fabricante y casi nunca se puede cambiar en la BIOS.`,
      });
    } else if (rated && configured && rated - configured >= 200) {
      push({
        id: 'ram-xmp', category: 'Memoria RAM', status: 'warn',
        title: `Tu RAM funciona a ${configured} MHz, pero es de ${rated} MHz`,
        detail: `Módulos ${ram[0].part} (${type}, ${totalGb} GB). Estás perdiendo rendimiento, sobre todo en juegos.`,
        fix: `Entra a la BIOS y activa el perfil ${profile}.`,
      });
    } else if (!laptop && !rated && configured && ((type === 'DDR4' && configured <= 2400) || (type === 'DDR5' && configured <= 4800))) {
      push({
        id: 'ram-xmp', category: 'Memoria RAM', status: 'info',
        title: `RAM a ${configured} MHz (velocidad base ${type})`,
        detail: `No se pudo leer la velocidad nominal de ${ram[0].part || 'tus módulos'}. Si tu kit es más rápido, está funcionando por debajo.`,
        fix: `Revisa la etiqueta de la RAM y, si corresponde, activa ${profile} en la BIOS.`,
      });
    } else {
      push({
        id: 'ram-xmp', category: 'Memoria RAM', status: 'ok',
        title: `RAM a ${configured} MHz${rated ? ` (nominal ${rated} MHz)` : ''}`,
        detail: `${type} · ${totalGb} GB en ${ram.length} módulo${ram.length > 1 ? 's' : ''}.`,
      });
    }

    const channelOf = (m) => {
      const s = `${m.bank} ${m.slot}`.toUpperCase();
      const x = s.match(/CHANNEL\s*([A-D])/) || s.match(/DIMM[_\s-]?([A-D])\d/) || s.match(/\b([A-D])\d\b/);
      return x ? x[1] : null;
    };
    const channels = new Set(ram.map(channelOf).filter(Boolean));
    if (ram.length === 1 && laptop) {
      push({
        id: 'ram-channel', category: 'Memoria RAM', status: 'info',
        title: 'RAM en un solo módulo',
        detail: 'Con un solo módulo la memoria rinde menos, sobre todo con gráficos integrados. Muchos portátiles traen la RAM soldada.',
        fix: 'Si tu portátil tiene una ranura libre, agrega un módulo igual (revisa el manual de tu modelo).',
      });
    } else if (ram.length === 1) {
      push({
        id: 'ram-channel', category: 'Memoria RAM', status: 'warn',
        title: 'RAM en un solo canal (single channel)',
        detail: 'Con un solo módulo la memoria rinde bastante menos, sobre todo con gráficos integrados.',
        fix: 'Agrega un segundo módulo igual para usar dual channel.',
      });
    } else if (channels.size === 1 && ram.every(channelOf)) {
      push({
        id: 'ram-channel', category: 'Memoria RAM', status: 'warn',
        title: 'Los módulos de RAM están en el mismo canal',
        detail: `Ranuras detectadas: ${ram.map((m) => m.slot).join(', ')}.`,
        fix: 'Mueve los módulos a las ranuras que indica el manual (normalmente A2 y B2).',
      });
    } else {
      push({ id: 'ram-channel', category: 'Memoria RAM', status: 'ok', title: 'RAM en dual channel', detail: `Ranuras: ${ram.map((m) => m.slot).join(', ')}.` });
    }
    if (new Set(ram.map((m) => `${m.part}|${m.capacity}`)).size > 1) {
      push({
        id: 'ram-mixed', category: 'Memoria RAM', status: 'info',
        title: 'Módulos de RAM distintos',
        detail: 'Mezclar modelos puede impedir que XMP/EXPO sea estable.',
        fix: 'Si notas pantallazos o reinicios, usa un kit de módulos idénticos.',
      });
    }
  }

  // ---------- Monitor conectado a la placa madre
  const gpus = arr(d.gpus).filter((g) => g && g.name && !/Basic|Virtual|Parsec|Meta/i.test(g.name));
  const isIgpu = (g) => isIntegratedGpuName(g.name);
  const dgpu = gpus.find((g) => !isIgpu(g));
  const igpu = gpus.find(isIgpu);
  if (dgpu && !laptop && !vm) {
    if (!dgpu.res && igpu?.res) {
      push({
        id: 'display-port', category: 'Gráficos', status: 'warn',
        title: 'El monitor está conectado a la placa madre',
        detail: `Tu pantalla usa ${igpu.name} en lugar de ${dgpu.name}: los juegos rendirán mucho menos.`,
        fix: 'Conecta el cable del monitor a la tarjeta de video (salidas horizontales de la parte baja del gabinete).',
      });
    } else if (dgpu.res) {
      push({ id: 'display-port', category: 'Gráficos', status: 'ok', title: 'Monitor conectado a la tarjeta de video', detail: dgpu.name });
    }
  }

  // ---------- Resizable BAR (solo verificable en NVIDIA)
  if (d.bar) {
    const fb = d.bar.match(/FB Memory Usage[\s\S]*?Total\s*:\s*(\d+)\s*MiB/i);
    const b1 = d.bar.match(/BAR1 Memory Usage[\s\S]*?Total\s*:\s*(\d+)\s*MiB/i);
    if (fb && b1) {
      const on = Number(b1[1]) >= Number(fb[1]) * 0.9;
      push({
        id: 'rebar', category: 'Gráficos', status: on ? 'ok' : 'warn',
        title: on ? 'Resizable BAR activado' : 'Resizable BAR desactivado',
        detail: on ? `BAR1 de ${b1[1]} MiB (VRAM completa accesible).` : `BAR1 de solo ${b1[1]} MiB de ${fb[1]} MiB de VRAM. Algunos juegos rinden hasta un 10 % menos.`,
        fix: on ? undefined : 'En la BIOS activa «Above 4G Decoding» y «Re-Size BAR Support» (requiere arranque UEFI y CSM desactivado).',
      });
    }
  }

  // ---------- Enlaces PCIe
  for (const dev of arr(d.pci)) {
    if (!dev.maxSpeed || !dev.maxWidth) continue;
    if (dev.cls === 'SCSIAdapter') {
      const slow = dev.curSpeed < dev.maxSpeed || dev.curWidth < dev.maxWidth;
      push({
        id: `pcie-${dev.id}`, category: 'Almacenamiento', status: slow ? 'warn' : 'ok',
        title: slow ? `SSD NVMe limitado: PCIe ${GEN(dev.curSpeed)} x${dev.curWidth} (soporta ${GEN(dev.maxSpeed)} x${dev.maxWidth})` : `SSD NVMe a máxima velocidad: PCIe ${GEN(dev.curSpeed)} x${dev.curWidth}`,
        detail: dev.name,
        fix: slow ? 'Muévelo a la ranura M.2 principal (la más cercana al CPU) o revisa si comparte líneas con otra ranura.' : undefined,
      });
    } else if (dev.cls === 'Display' && !laptop && dev.curWidth < dev.maxWidth && dev.maxWidth >= 8) {
      // La velocidad baja sola en reposo para ahorrar energía; el ancho de enlace no
      push({
        id: `pcie-${dev.id}`, category: 'Gráficos', status: 'warn',
        title: `La tarjeta de video funciona a x${dev.curWidth} en lugar de x${dev.maxWidth}`,
        detail: dev.name,
        fix: 'Colócala en la ranura PCIe principal (la superior) y verifica que esté bien insertada.',
      });
    }
  }

  // ---------- Firmware: UEFI, Secure Boot y TPM
  const uefi = String(d.firmware || '').toUpperCase() === 'UEFI';
  if (d.firmware && !uefi) {
    push({
      id: 'firmware', category: 'Seguridad', status: 'warn',
      title: 'Windows arranca en modo Legacy (BIOS antigua)',
      detail: 'Sin UEFI no puedes usar Secure Boot ni Resizable BAR.',
      fix: 'Convierte el disco a GPT con «mbr2gpt» y cambia la BIOS a UEFI (haz un respaldo antes).',
    });
  }
  push(d.secureBoot === 1
    ? { id: 'secureboot', category: 'Seguridad', status: 'ok', title: 'Secure Boot activado' }
    : {
        id: 'secureboot', category: 'Seguridad', status: 'warn',
        title: 'Secure Boot desactivado',
        detail: 'Lo exigen anticheats como Vanguard (Valorant), Battlefield 6 y Call of Duty, y protege contra malware de arranque.',
        fix: uefi ? 'En la BIOS: Boot → Secure Boot → Enabled (con las claves de fábrica / «Standard»).' : 'Primero cambia a arranque UEFI.',
      });
  const tpmText = String(d.tpm || '');
  if (/2\.0/.test(tpmText)) {
    push({ id: 'tpm', category: 'Seguridad', status: 'ok', title: 'TPM 2.0 presente' });
  } else if (/1\.2/.test(tpmText)) {
    push({ id: 'tpm', category: 'Seguridad', status: 'warn', title: 'TPM 1.2 (antiguo)', detail: 'Windows 11 exige TPM 2.0.', fix: 'Activa fTPM (AMD) o PTT (Intel) en la BIOS si tu placa lo permite.' });
  } else {
    push({ id: 'tpm', category: 'Seguridad', status: 'info', title: 'No se detectó TPM', detail: 'Puede estar desactivado en la BIOS.', fix: 'Activa fTPM (AMD) o PTT (Intel) en la BIOS.' });
  }

  // ---------- Virtualización (WSL, Docker, emuladores Android)
  if (d.virt === false && !d.hyperv) {
    push({
      id: 'virt', category: 'Procesador', status: 'info',
      title: 'Virtualización desactivada en la BIOS',
      detail: 'Necesaria para WSL, Docker, máquinas virtuales y emuladores de Android.',
      fix: 'Activa SVM (AMD) o Intel VT-x en la BIOS.',
    });
  } else {
    push({ id: 'virt', category: 'Procesador', status: 'ok', title: 'Virtualización disponible' });
  }

  // ---------- Salud de discos (estado de Windows + contadores SMART cuando el disco los informa)
  arr(d.disks).forEach((disk, idx) => {
    const temp = Number(disk.temp) || 0;
    const wear = Number(disk.wear) || 0;
    const hours = Number(disk.hours) || 0;
    const readErr = Number(disk.readErr) || 0;
    const facts = [
      temp ? `${temp} °C` : null,
      wear ? `${wear} % de vida útil usada` : null,
      hours ? `${hours.toLocaleString('es')} h encendido` : null,
    ].filter(Boolean);
    const problems = [];
    if (disk.health && disk.health !== 'Healthy') problems.push(`Windows informa estado «${disk.health}»`);
    if (wear >= 90) problems.push(`desgaste del ${wear} %`);
    if (readErr > 0) problems.push(`${readErr} errores de lectura sin corregir`);
    if (temp >= 70) problems.push(`temperatura alta (${temp} °C)`);
    if (problems.length) {
      push({
        id: `disk-${idx}`, category: 'Almacenamiento', status: 'warn',
        title: `Revisa el disco ${disk.name}`,
        detail: `${problems.join(', ')}.${facts.length ? ` ${facts.join(' · ')}.` : ''}`,
        fix: temp >= 70 && problems.length === 1
          ? 'Mejora el flujo de aire o pon un disipador al SSD NVMe.'
          : 'Respalda tus datos cuanto antes y revisa el disco con CrystalDiskInfo.',
      });
    } else {
      push({
        id: `disk-${idx}`, category: 'Almacenamiento', status: 'ok',
        title: `Disco sano: ${disk.name}`,
        detail: facts.length ? facts.join(' · ') : 'Windows no informa problemas.',
      });
    }
  });

  // ---------- Temperatura de la GPU en reposo (NVIDIA: nvidia-smi viene con el driver)
  for (const line of String(d.gpuTemp || '').split(/\r?\n/).filter((l) => l.includes(','))) {
    const [name, t, util] = line.split(',').map((x) => x.trim());
    const temp = Number(t);
    if (!temp) continue;
    const idle = Number(util) < 15;
    const hot = idle ? temp >= 70 : temp >= 87;
    push({
      id: `gpu-temp-${name}`, category: 'Gráficos', status: hot ? 'warn' : 'ok',
      title: hot ? `GPU caliente: ${temp} °C${idle ? ' en reposo' : ''}` : `GPU a ${temp} °C${idle ? ' en reposo' : ''}`,
      detail: `${name} · uso ${util} %.`,
      fix: hot ? 'Revisa que los ventiladores giren, el flujo de aire del gabinete y que no haya polvo.' : undefined,
    });
  }

  const devices = arr(d.problems)
    .filter((p) => p && p.id)
    .map((p) => ({
      instanceId: String(p.id),
      name: p.name || 'Dispositivo desconocido',
      code: Number(p.code),
      problem: PROBLEM_CODES[p.code] || `Problema (código ${p.code})`,
      pnpClass: p.cls || '',
      canSearchDriver: [1, 10, 18, 28, 31, 37, 39, 43].includes(Number(p.code)),
    }));

  return { checks, devices };
}

let lastPcCheck = null;

async function runPcCheck() {
  const r = await runPowerShell(PS_SCRIPT, 45000);
  let data = {};
  try {
    data = JSON.parse(r.stdout || '{}');
  } catch {
    return { ok: false, error: 'No se pudo analizar el hardware.' };
  }
  const result = analyze(data, { formFactor: getLastHardwareScan()?.system?.formFactor });
  lastPcCheck = { ...result, scannedAt: new Date().toISOString() };
  return {
    ok: true,
    ...lastPcCheck,
    warnCount: result.checks.filter((c) => c.status === 'warn').length + result.devices.length,
  };
}

function getLastPcCheck() {
  return lastPcCheck;
}

module.exports = { runPcCheck, getLastPcCheck, _internals: { analyze, ratedSpeedFromPart } };
