'use strict';

// Motor puro de compatibilidad de hardware: clasifica CPU, GPU y placa/chipset para
// sugerir únicamente funciones que el hardware realmente soporta.
// Regla de oro: ante cualquier modelo desconocido o ambiguo, devuelve 'unknown'
// para que los consumidores actúen de forma conservadora (nunca generar falsos warn).

const VIRTUAL_GPU_RE = /Basic Display|Microsoft Basic|Virtual|Parsec|Meta |Citrix|VMware|VirtualBox|Remote Desktop|Indirect Display|Spacedesk/i;

function isIntegratedGpu(name) {
  const n = String(name || '');
  if (!n) return false;
  if (/Intel.*(?:UHD|HD Graphics|Iris|Graphics Family|Arc\(TM\)\s*Graphics)/i.test(n) && !/\bArc\b.*\b[AB]\d{3}\b/i.test(n)) {
    return true;
  }
  if (/AMD\s+Radeon(?:\(TM\))?\s+Graphics\b/i.test(n)) return true;
  if (/AMD\s+Radeon.*Vega\s*(?:3|6|7|8|9|10|11)\b/i.test(n) && !/\b(?:56|64)\b/.test(n)) return true;
  if (/Radeon\s*R[2-7]\s*Graphics/i.test(n)) return true;
  return false;
}

function classifySingleGpu(rawName) {
  const name = String(rawName || '').trim();
  if (!name) {
    return { name: null, vendor: 'unknown', family: 'unknown', arch: 'unknown', integrated: false, supportsRebar: 'unknown', supportsHags: 'unknown', supportsFrameGen: false, rebarCritical: false };
  }

  if (isIntegratedGpu(name)) {
    const vendor = /AMD|Radeon/i.test(name) ? 'amd' : /Intel/i.test(name) ? 'intel' : 'unknown';
    return { name, vendor, family: 'iGPU', arch: 'integrated', integrated: true, supportsRebar: false, supportsHags: false, supportsFrameGen: false, rebarCritical: false };
  }

  // ---------- NVIDIA
  if (/NVIDIA|GeForce|Quadro|TITAN|RTX|GTX|GT\s*\d/i.test(name)) {
    const rtx = name.match(/\bRTX\s*(\d{4})\b/i);
    if (rtx) {
      const num = Number(rtx[1]);
      if (num >= 5000 && num < 6000) return { name, vendor: 'nvidia', family: 'RTX 50', arch: 'Blackwell', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: true, rebarCritical: false };
      if (num >= 4000 && num < 5000) return { name, vendor: 'nvidia', family: 'RTX 40', arch: 'Ada Lovelace', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: true, rebarCritical: false };
      if (num >= 3000 && num < 4000) return { name, vendor: 'nvidia', family: 'RTX 30', arch: 'Ampere', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 2000 && num < 3000) return { name, vendor: 'nvidia', family: 'RTX 20', arch: 'Turing', integrated: false, supportsRebar: false, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      // Futura serie desconocida (ej. RTX 60xx+) -> conservador
      return { name, vendor: 'nvidia', family: `RTX ${Math.floor(num / 1000) * 10}`, arch: 'unknown', integrated: false, supportsRebar: 'unknown', supportsHags: 'unknown', supportsFrameGen: false, rebarCritical: false };
    }
    const gtx = name.match(/\bGTX\s*(\d{3,4})\b/i);
    if (gtx) {
      const num = Number(gtx[1]);
      if (num >= 1600 && num < 1700) return { name, vendor: 'nvidia', family: 'GTX 16', arch: 'Turing', integrated: false, supportsRebar: false, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 1000 && num < 1100) return { name, vendor: 'nvidia', family: 'GTX 10', arch: 'Pascal', integrated: false, supportsRebar: false, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 400 && num < 1000) return { name, vendor: 'nvidia', family: `GTX ${Math.floor(num / 100) * 100}`, arch: num >= 900 ? 'Maxwell' : 'Legacy', integrated: false, supportsRebar: false, supportsHags: false, supportsFrameGen: false, rebarCritical: false };
    }
    if (/\bGT\s*\d{3,4}\b/i.test(name)) {
      return { name, vendor: 'nvidia', family: 'GT', arch: 'Legacy', integrated: false, supportsRebar: false, supportsHags: false, supportsFrameGen: false, rebarCritical: false };
    }
    if (/\bQuadro\b/i.test(name)) {
      const modernQuadro = /\bRTX\s*(?:A\d{4}|[456]000\s*Ada)\b/i.test(name);
      return { name, vendor: 'nvidia', family: 'Quadro', arch: modernQuadro ? 'Ampere/Ada' : 'Legacy', integrated: false, supportsRebar: modernQuadro ? 'unknown' : false, supportsHags: modernQuadro ? true : false, supportsFrameGen: false, rebarCritical: false };
    }
    if (/\bTITAN\b/i.test(name)) {
      const turingOrPascal = /\bRTX\b|\bXp\b|\bV\b/i.test(name);
      return { name, vendor: 'nvidia', family: 'TITAN', arch: turingOrPascal ? 'Pascal/Turing' : 'Legacy', integrated: false, supportsRebar: false, supportsHags: turingOrPascal, supportsFrameGen: false, rebarCritical: false };
    }
    return { name, vendor: 'nvidia', family: 'unknown', arch: 'unknown', integrated: false, supportsRebar: 'unknown', supportsHags: 'unknown', supportsFrameGen: false, rebarCritical: false };
  }

  // ---------- AMD
  if (/AMD|Radeon|FirePro/i.test(name)) {
    const rx = name.match(/\bRX\s*(\d{3,4})\b/i);
    if (rx) {
      const num = Number(rx[1]);
      if (num >= 9000 && num < 10000) return { name, vendor: 'amd', family: 'RX 9000', arch: 'RDNA 4', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 7000 && num < 8000) return { name, vendor: 'amd', family: 'RX 7000', arch: 'RDNA 3', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 6000 && num < 7000) return { name, vendor: 'amd', family: 'RX 6000', arch: 'RDNA 2', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 5000 && num < 6000) return { name, vendor: 'amd', family: 'RX 5000', arch: 'RDNA 1', integrated: false, supportsRebar: true, supportsHags: true, supportsFrameGen: false, rebarCritical: false };
      if (num >= 400 && num < 600) return { name, vendor: 'amd', family: `RX ${Math.floor(num / 100) * 100}`, arch: 'Polaris', integrated: false, supportsRebar: false, supportsHags: false, supportsFrameGen: false, rebarCritical: false };
    }
    if (/\bVega\s*(?:56|64|Frontier|FE)\b|\bRadeon\s+VII\b/i.test(name)) {
      return { name, vendor: 'amd', family: 'Vega', arch: 'Vega', integrated: false, supportsRebar: false, supportsHags: false, supportsFrameGen: false, rebarCritical: false };
    }
    if (/\bR[579]\s*\d{3}\b|\bHD\s*\d{4}\b|\bFirePro\b/i.test(name)) {
      return { name, vendor: 'amd', family: 'Legacy Radeon', arch: 'GCN/Legacy', integrated: false, supportsRebar: false, supportsHags: false, supportsFrameGen: false, rebarCritical: false };
    }
    return { name, vendor: 'amd', family: 'unknown', arch: 'unknown', integrated: false, supportsRebar: 'unknown', supportsHags: 'unknown', supportsFrameGen: false, rebarCritical: false };
  }

  // ---------- Intel Arc dedicada
  if (/Intel/i.test(name) && /\bArc\b/i.test(name)) {
    const arc = name.match(/\b([AB])(\d{3})\b/i);
    if (arc) {
      const series = arc[1].toUpperCase();
      return {
        name,
        vendor: 'intel',
        family: `Arc ${series}`,
        arch: series === 'B' ? 'Battlemage' : 'Alchemist',
        integrated: false,
        supportsRebar: true,
        supportsHags: true,
        supportsFrameGen: false,
        rebarCritical: true,
      };
    }
    return { name, vendor: 'intel', family: 'Arc', arch: 'unknown', integrated: false, supportsRebar: 'unknown', supportsHags: 'unknown', supportsFrameGen: false, rebarCritical: false };
  }

  return { name, vendor: 'unknown', family: 'unknown', arch: 'unknown', integrated: false, supportsRebar: 'unknown', supportsHags: 'unknown', supportsFrameGen: false, rebarCritical: false };
}

function classifyGpu(gpuNames) {
  const list = (Array.isArray(gpuNames) ? gpuNames : gpuNames ? [gpuNames] : [])
    .map((g) => (typeof g === 'string' ? g : g?.name))
    .map((s) => String(s || '').trim())
    .filter((s) => s && !VIRTUAL_GPU_RE.test(s));
  if (!list.length) return classifySingleGpu('');
  const classified = list.map(classifySingleGpu);
  const dedicated = classified.find((g) => !g.integrated);
  return dedicated || classified[0];
}

function classifyCpu(rawCpuName) {
  const name = String(rawCpuName || '').trim();
  const base = { name: name || null, vendor: 'unknown', family: 'unknown', generation: null, maxPcieGen: null, supportsRebar: 'unknown', supportsTpm2Firmware: 'unknown', ramProfileName: 'XMP / EXPO' };
  if (!name) return base;

  // ---------- Intel
  if (/Intel/i.test(name)) {
    // Core Ultra (Series 1 / 2)
    const ultra = name.match(/Core(?:\(TM\))?\s*Ultra\s*[3579]\s*(\d{3})/i);
    if (ultra || /Core(?:\(TM\))?\s*Ultra/i.test(name)) {
      return { name, vendor: 'intel', family: 'Core Ultra', generation: 15, maxPcieGen: 5, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'XMP' };
    }
    // Core i3/i5/i7/i9-XXXXX
    const core = name.match(/i[3579][-\s](\d{4,5})/i);
    if (core) {
      const model = Number(core[1]);
      const gen = model >= 10000 ? Math.floor(model / 1000) : Math.floor(model / 1000);
      if (gen >= 12 && gen <= 14) return { name, vendor: 'intel', family: `Core ${gen}th`, generation: gen, maxPcieGen: 5, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'XMP' };
      if (gen === 11) return { name, vendor: 'intel', family: 'Core 11th', generation: 11, maxPcieGen: 4, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'XMP' };
      if (gen === 10) return { name, vendor: 'intel', family: 'Core 10th', generation: 10, maxPcieGen: 3, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'XMP' };
      if (gen === 8 || gen === 9) return { name, vendor: 'intel', family: `Core ${gen}th`, generation: gen, maxPcieGen: 3, supportsRebar: 'unknown', supportsTpm2Firmware: true, ramProfileName: 'XMP' };
      if (gen === 6 || gen === 7) return { name, vendor: 'intel', family: `Core ${gen}th`, generation: gen, maxPcieGen: 3, supportsRebar: false, supportsTpm2Firmware: 'unknown', ramProfileName: 'XMP' };
      if (gen >= 3 && gen <= 5) return { name, vendor: 'intel', family: `Core ${gen}th`, generation: gen, maxPcieGen: 3, supportsRebar: false, supportsTpm2Firmware: false, ramProfileName: 'XMP' };
      if (gen >= 1 && gen <= 2) return { name, vendor: 'intel', family: `Core ${gen}th`, generation: gen, maxPcieGen: 2, supportsRebar: false, supportsTpm2Firmware: false, ramProfileName: 'XMP' };
    }
    // Core i-xxx (1st gen 3 digits), Core 2, Pentium/Celeron legacy
    if (/\b(?:Core\(TM\)\s*2|Pentium|Celeron)\b/i.test(name) || /i[357][-\s]\d{3}\b/i.test(name)) {
      const modernLow = /\b(?:G6\d{3}|G7\d{3}|N\d{3})\b/i.test(name);
      return {
        name,
        vendor: 'intel',
        family: modernLow ? 'Intel Entry' : 'Intel Legacy',
        generation: null,
        maxPcieGen: modernLow ? 3 : 2,
        supportsRebar: false,
        supportsTpm2Firmware: modernLow ? true : false,
        ramProfileName: 'XMP',
      };
    }
    return { ...base, vendor: 'intel', ramProfileName: 'XMP' };
  }

  // ---------- AMD
  if (/AMD|Ryzen|Threadripper|Athlon|Phenom|\bFX-/i.test(name)) {
    const ryzen = name.match(/Ryzen\s*(?:AI\s*)?[3579]?\s*(?:PRO\s*)?(\d{4})([A-Z0-9]*)/i);
    if (ryzen) {
      const num = Number(ryzen[1]);
      const suffix = String(ryzen[2] || '').toUpperCase();
      const series = Math.floor(num / 1000) * 1000;
      const isApuG = suffix.includes('G');

      if (series === 9000 || series === 7000) {
        return { name, vendor: 'amd', family: `Ryzen ${series}`, generation: series, maxPcieGen: 5, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'EXPO' };
      }
      if (series === 8000) {
        return { name, vendor: 'amd', family: 'Ryzen 8000', generation: 8000, maxPcieGen: 4, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'EXPO' };
      }
      if (series === 5000) {
        // Ryzen 5500 y APUs 5xxxG/GT (Cezanne) son PCIe 3.0
        const pcie3 = isApuG || num === 5500 || num === 5100;
        return { name, vendor: 'amd', family: 'Ryzen 5000', generation: 5000, maxPcieGen: pcie3 ? 3 : 4, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'DOCP / XMP' };
      }
      if (series === 4000) {
        return { name, vendor: 'amd', family: 'Ryzen 4000', generation: 4000, maxPcieGen: 3, supportsRebar: 'unknown', supportsTpm2Firmware: true, ramProfileName: 'DOCP / XMP' };
      }
      if (series === 3000) {
        // 3200G / 3400G son Zen+ (Picasso): sin ReBAR y PCIe 3.0
        if (isApuG || num === 3200 || num === 3400) {
          return { name, vendor: 'amd', family: 'Ryzen 3000G', generation: 3000, maxPcieGen: 3, supportsRebar: false, supportsTpm2Firmware: true, ramProfileName: 'DOCP / XMP' };
        }
        return { name, vendor: 'amd', family: 'Ryzen 3000', generation: 3000, maxPcieGen: 4, supportsRebar: true, supportsTpm2Firmware: true, ramProfileName: 'DOCP / XMP' };
      }
      if (series === 2000) {
        return { name, vendor: 'amd', family: 'Ryzen 2000', generation: 2000, maxPcieGen: 3, supportsRebar: false, supportsTpm2Firmware: true, ramProfileName: 'DOCP / XMP' };
      }
      if (series === 1000) {
        return { name, vendor: 'amd', family: 'Ryzen 1000', generation: 1000, maxPcieGen: 3, supportsRebar: false, supportsTpm2Firmware: 'unknown', ramProfileName: 'DOCP / XMP' };
      }
      return { ...base, vendor: 'amd', family: `Ryzen ${series}`, generation: series, ramProfileName: 'EXPO' };
    }
    if (/\bFX[-\s]?\d{4}|\bA(?:4|6|8|10|12)[-\s]\d{4}|\bPhenom\b|\bAthlon\b/i.test(name)) {
      return { name, vendor: 'amd', family: 'AMD Legacy', generation: null, maxPcieGen: 2, supportsRebar: false, supportsTpm2Firmware: false, ramProfileName: 'XMP / EXPO' };
    }
    return { ...base, vendor: 'amd', ramProfileName: 'DOCP / XMP' };
  }

  return base;
}

const AMD_PCIE3_CHIPSETS = new Set(['A320', 'B350', 'X370', 'B450', 'X470', 'A520']);
const AMD_PCIE4_CHIPSETS = new Set(['B550', 'X570', 'A620']);
const AMD_PCIE5_CHIPSETS = new Set(['B650', 'B650E', 'X670', 'X670E', 'B840', 'B850', 'X870', 'X870E']);

const INTEL_LOCKED_PCIE3_CHIPSETS = new Set(['H110', 'H310', 'B360', 'B365', 'H410', 'B460']);
const INTEL_LOCKED_PCIE4_CHIPSETS = new Set(['H510', 'H610']);
const INTEL_UNLOCKED_PCIE3_CHIPSETS = new Set(['Z170', 'Z270', 'Z370', 'Z390']);
const INTEL_UNLOCKED_PCIE4_CHIPSETS = new Set(['Z490', 'B560', 'H570', 'Z590']);
const INTEL_UNLOCKED_PCIE5_CHIPSETS = new Set(['B660', 'H670', 'Z690', 'B760', 'H770', 'Z790', 'B860', 'Z890']);

const RETAIL_BOARD_RE = /ASUS|ASUSTEK|MICRO-STAR|\bMSI\b|GIGABYTE|AORUS|ASROCK|EVGA|BIOSTAR|NZXT|COLORFUL/i;
const OEM_BRAND_RE = /HEWLETT|\bHP\b|\bDELL\b|ALIENWARE|LENOVO|\bACER\b|MEDION|PACKARD BELL|FUJITSU|TOSHIBA|DYNABOOK/i;

function extractChipset(model) {
  const s = String(model || '').toUpperCase();
  if (!s) return null;
  const m = s.match(/(?:^|[^A-Z0-9])([ABHXZ]\d{3}E?)(?=[MI\-\s/_.]|$)/);
  return m ? m[1] : null;
}

function classifyPlatform({ motherboardVendor, motherboardModel, formFactor } = {}) {
  const vendor = String(motherboardVendor || '').trim();
  const model = String(motherboardModel || '').trim();
  const combined = `${vendor} ${model}`;
  const chipset = extractChipset(model);

  const isLaptopOrVm = formFactor === 'laptop' || formFactor === 'vm';
  const isOemBoard = !RETAIL_BOARD_RE.test(combined) && OEM_BRAND_RE.test(combined);
  const isOemLocked = Boolean(isLaptopOrVm || isOemBoard);

  let maxPcieGen = null;
  let supportsXmpExpo = 'unknown';

  if (chipset) {
    if (AMD_PCIE3_CHIPSETS.has(chipset)) { maxPcieGen = 3; supportsXmpExpo = true; }
    else if (AMD_PCIE4_CHIPSETS.has(chipset)) { maxPcieGen = 4; supportsXmpExpo = true; }
    else if (AMD_PCIE5_CHIPSETS.has(chipset)) { maxPcieGen = 5; supportsXmpExpo = true; }
    else if (INTEL_LOCKED_PCIE3_CHIPSETS.has(chipset)) { maxPcieGen = 3; supportsXmpExpo = false; }
    else if (INTEL_LOCKED_PCIE4_CHIPSETS.has(chipset)) { maxPcieGen = 4; supportsXmpExpo = false; }
    else if (INTEL_UNLOCKED_PCIE3_CHIPSETS.has(chipset)) { maxPcieGen = 3; supportsXmpExpo = true; }
    else if (INTEL_UNLOCKED_PCIE4_CHIPSETS.has(chipset)) { maxPcieGen = 4; supportsXmpExpo = true; }
    else if (INTEL_UNLOCKED_PCIE5_CHIPSETS.has(chipset)) { maxPcieGen = 5; supportsXmpExpo = true; }
  }

  if (isOemLocked) {
    supportsXmpExpo = false;
  }

  return { chipset, isOemLocked, maxPcieGen, supportsXmpExpo };
}

function detectCapabilities(input = {}) {
  const formFactor = input.formFactor || 'desktop';
  const ramType = String(input.ramType || '').toUpperCase();
  const osBuild = Number(input.osBuild) || 0;

  const gpu = classifyGpu(input.gpuNames);
  const cpu = classifyCpu(input.cpuName);
  const platform = classifyPlatform({
    motherboardVendor: input.motherboardVendor,
    motherboardModel: input.motherboardModel,
    formFactor,
  });

  // PCIe máximo real de la plataforma = mínimo entre CPU y chipset (si ambos son conocidos)
  const pcieCandidates = [cpu.maxPcieGen, platform.maxPcieGen].filter((v) => typeof v === 'number' && v > 0);
  const maxPlatformPcieGen = pcieCandidates.length ? Math.min(...pcieCandidates) : null;

  // Resizable BAR: exige GPU compatible Y CPU compatible Y escritorio/placa no OEM bloqueada
  let supportsRebar = 'unknown';
  if (formFactor === 'vm' || platform.isOemLocked || gpu.supportsRebar === false || cpu.supportsRebar === false) {
    supportsRebar = false;
  } else if (gpu.supportsRebar === true && cpu.supportsRebar === true) {
    supportsRebar = true;
  }

  const rebarCritical = Boolean(gpu.rebarCritical && supportsRebar === true);

  // HAGS: requiere Windows 10 2004+ (build >= 19041 si se informa) y GPU compatible
  let supportsHags = gpu.supportsHags;
  if (osBuild > 0 && osBuild < 19041) supportsHags = false;
  if (formFactor === 'vm') supportsHags = false;

  // Frame Generation (DLSS 3/4): solo NVIDIA RTX 40xx / 50xx con HAGS soportado
  const supportsFrameGen = Boolean(gpu.supportsFrameGen && supportsHags === true);

  // XMP / EXPO
  let supportsXmpExpo = platform.supportsXmpExpo;
  if (ramType === 'DDR3' && cpu.vendor === 'amd' && cpu.family === 'AMD Legacy') {
    supportsXmpExpo = false;
  }

  // Perfil de memoria recomendado según plataforma/RAM
  let ramProfileName = cpu.ramProfileName || 'XMP / EXPO';
  if (ramType === 'DDR5' && cpu.vendor === 'amd') ramProfileName = 'EXPO';
  else if (ramType === 'DDR4' && cpu.vendor === 'amd') ramProfileName = 'DOCP / XMP';
  else if (cpu.vendor === 'intel') ramProfileName = 'XMP';

  const supportsTpm2Firmware = cpu.supportsTpm2Firmware;

  return {
    gpu,
    cpu,
    platform,
    supportsRebar,
    rebarCritical,
    supportsHags,
    supportsFrameGen,
    maxPlatformPcieGen,
    supportsXmpExpo,
    ramProfileName,
    supportsTpm2Firmware,
  };
}

module.exports = {
  detectCapabilities,
  _internals: { classifyGpu, classifySingleGpu, classifyCpu, classifyPlatform, extractChipset, isIntegratedGpu },
};
