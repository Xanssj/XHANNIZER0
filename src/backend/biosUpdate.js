'use strict';

// Actualización de BIOS segura: XHANNIZER0 NUNCA flashea la BIOS desde Windows.
// 1. Consulta la última BIOS publicada por el fabricante (hoy: MSI, vía su API pública de soporte).
// 2. Si hay una más nueva, descarga el archivo oficial, verifica su SHA-256 contra el publicado
//    por el fabricante y lo copia a una memoria USB en FAT32.
// 3. El usuario la instala desde la propia BIOS (MSI M-Flash), que es el método oficial.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { runPowerShell, runElevated, psData } = require('./powershell');
const { isStrictHttpsHostUrl } = require('./securityGuards');

const MSI_DOWNLOAD_HOST = 'download.msi.com';
const MAX_BIOS_BYTES = 128 * 1024 * 1024;
const WORK_DIR = path.join(os.tmpdir(), 'XHANNIZER0_bios');

function electronNet() {
  try {
    return require('electron').net;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  // net.fetch usa la red de Chromium (proxy y certificados del sistema); fuera de Electron, fetch de Node.
  const net = electronNet();
  const doFetch = net?.fetch ? net.fetch.bind(net) : globalThis.fetch;
  if (!doFetch) throw new Error('Red no disponible');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await doFetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json, */*' } });
  } finally {
    clearTimeout(timer);
  }
}

function isMsi(manufacturer) {
  return /MSI|MICRO-STAR/i.test(String(manufacturer || ''));
}

// "PRO B660M-A WIFI DDR4 (MS-7D43)" -> { slug: 'PRO-B660M-A-WIFI-DDR4', boardCode: '7D43' }
function parseMsiProduct(product) {
  const raw = String(product || '');
  const codeMatch = raw.match(/\(MS-([0-9A-Z]{4})\)/i);
  const name = raw.replace(/\(MS-[0-9A-Z]{4}\)/i, '').trim();
  const slug = name.replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return { slug, boardCode: codeMatch ? codeMatch[1].toUpperCase() : null };
}

// Versión MSI en SMBIOS («1.L0») o en la descarga («7D43v1L», «7D43v1P1»).
// Las letras siguen el orden 0-9 y luego A-Z, que coincide con el orden ASCII.
function parseMsiVersion(value) {
  const s = String(value || '').trim().toUpperCase();
  let m = s.match(/V(\d)([0-9A-Z])(\d*)/);
  if (!m) m = s.match(/^(\d)\.([0-9A-Z])(\d*)$/);
  if (!m) return null;
  return { major: Number(m[1]), rev: m[2], minor: Number(m[3] || 0) };
}

function compareMsiVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.rev !== b.rev) return a.rev < b.rev ? -1 : 1;
  return a.minor - b.minor;
}

function supportUrlFor(manufacturer, product) {
  if (isMsi(manufacturer)) {
    const { slug } = parseMsiProduct(product);
    return slug ? `https://www.msi.com/Motherboard/${slug}/support#bios` : 'https://www.msi.com/support/download/';
  }
  // ASUS, Gigabyte y ASRock no tienen una API pública de BIOS: se abre la búsqueda oficial del modelo.
  const m = String(manufacturer || '').toUpperCase();
  const model = encodeURIComponent(String(product || '').replace(/\(.*?\)/g, '').trim());
  if (/ASUS/.test(m)) return model ? `https://www.asus.com/support/search-results/?keyword=${model}` : 'https://www.asus.com/support/download-center/';
  if (/GIGABYTE/.test(m)) return model ? `https://www.gigabyte.com/Search?kw=${model}` : 'https://www.gigabyte.com/Support';
  if (/ASROCK/.test(m)) return model ? `https://www.asrock.com/search/index.asp?Keyword=${model}` : 'https://www.asrock.com/support/index.asp';
  return null;
}

function flashToolFor(manufacturer) {
  const m = String(manufacturer || '').toUpperCase();
  if (/MSI|MICRO-STAR/.test(m)) return 'M-Flash';
  if (/ASUS/.test(m)) return 'EZ Flash';
  if (/GIGABYTE/.test(m)) return 'Q-Flash';
  if (/ASROCK/.test(m)) return 'Instant Flash';
  return 'la herramienta de actualización de la BIOS';
}

let cache = null; // { key, at, result }

// Devuelve { supported, installed, latest?, isNewer, supportUrl, flashTool, error? }
async function lookupLatestBios({ manufacturer, product, biosVersion }) {
  const base = {
    supported: false,
    installed: String(biosVersion || ''),
    latest: null,
    isNewer: false,
    supportUrl: supportUrlFor(manufacturer, product),
    flashTool: flashToolFor(manufacturer),
  };
  if (!isMsi(manufacturer)) return base;

  const { slug, boardCode } = parseMsiProduct(product);
  const installed = parseMsiVersion(biosVersion);
  if (!slug || !boardCode || !installed) return base;

  const key = `${slug}|${biosVersion}`;
  if (cache && cache.key === key && Date.now() - cache.at < 30 * 60 * 1000) return cache.result;

  let result;
  try {
    const res = await fetchWithTimeout(
      `https://www.msi.com/api/v1/product/support/panel?product=${encodeURIComponent(slug)}&type=bios`,
      8000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const groups = json?.result?.downloads || {};
    const entries = Object.entries(groups)
      .filter(([k]) => /BIOS/i.test(k))
      .flatMap(([, list]) => (Array.isArray(list) ? list : []));
    // Solo versiones de ESTA placa (mismo código MS-xxxx): evita cruzar BIOS de otro modelo.
    const candidates = entries
      .map((e) => ({ e, v: parseMsiVersion(e.download_version) }))
      .filter(({ e, v }) => v && String(e.download_version || '').toUpperCase().startsWith(boardCode) && v.major === installed.major)
      .filter(({ e }) => isStrictHttpsHostUrl(e.download_url, MSI_DOWNLOAD_HOST))
      .sort((a, b) => compareMsiVersions(b.v, a.v));
    const top = candidates[0];
    if (!top) {
      result = { ...base, supported: true, error: 'MSI no publica BIOS para esta placa.' };
    } else {
      const sha = String(top.e.download_sha256 || '').match(/[a-f0-9]{64}/i);
      result = {
        ...base,
        supported: true,
        latest: {
          version: top.e.download_version,
          date: top.e.download_release || null,
          url: top.e.download_url,
          size: Number(top.e.download_size) || 0,
          sha256: sha ? sha[0].toLowerCase() : null,
          notes: String(top.e.download_description || '')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .map((l) => l.replace(/^[\s–-]+/, '').trim())
            .map((l) => l.replace(/\.+$/, ''))
            .filter((l) => l && !/^ME Firmware (ver|update)/i.test(l))
            .slice(0, 4),
        },
        isNewer: compareMsiVersions(top.v, installed) > 0,
      };
    }
  } catch (err) {
    result = { ...base, supported: true, error: `No se pudo consultar la web de MSI (${err.message}).` };
  }
  if (!result.error) cache = { key, at: Date.now(), result };
  return result;
}

// Memorias USB conectadas (unidades extraíbles con letra + identidad física del disco).
async function listUsbDrives() {
  const r = await runPowerShell(
    `$disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" | ForEach-Object {
  $l = ($_.DeviceID -replace ':','').Trim()
  $disk = $null
  try { $disk = Get-Partition -DriveLetter $l -ErrorAction SilentlyContinue | Get-Disk -ErrorAction SilentlyContinue | Select-Object -First 1 } catch {}
  [PSCustomObject]@{
    DeviceID = $_.DeviceID
    VolumeName = $_.VolumeName
    Size = $_.Size
    FreeSpace = $_.FreeSpace
    FileSystem = $_.FileSystem
    UniqueId = if ($disk) { [string]$disk.UniqueId } else { '' }
    DiskSize = if ($disk) { [int64]$disk.Size } else { 0 }
    BusType = if ($disk) { [string]$disk.BusType } else { '' }
  }
})
$disks | ConvertTo-Json -Compress`,
    15000
  );
  let list = [];
  try {
    const parsed = JSON.parse(r.stdout || '[]');
    list = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    list = [];
  }
  return list
    .filter((d) => d && /^[A-Z]:$/i.test(String(d.DeviceID || '')) && Number(d.Size) > 0)
    .map((d) => ({
      letter: String(d.DeviceID).toUpperCase(),
      label: d.VolumeName || 'USB',
      sizeGb: Math.round((Number(d.Size) / 1024 ** 3) * 10) / 10,
      sizeBytes: Number(d.Size) || 0,
      diskSizeBytes: Number(d.DiskSize) || 0,
      uniqueId: String(d.UniqueId || ''),
      freeBytes: Number(d.FreeSpace) || 0,
      fileSystem: String(d.FileSystem || ''),
    }));
}

// Formatea una memoria USB extraíble en FAT32 (borra todo su contenido). Solo unidades
// extraíbles (DriveType=2) de hasta 32 GB: Windows no crea FAT32 en volúmenes más grandes.
async function formatUsbFat32(target) {
  const expectedLetter = typeof target === 'string' ? target : target?.letter;
  const expectedUniqueId = typeof target === 'object' && target ? String(target.uniqueId || '') : '';
  const expectedDiskSize = typeof target === 'object' && target ? Number(target.diskSizeBytes || 0) : 0;
  const drives = await listUsbDrives();
  const usb = drives.find((d) => d.letter === String(expectedLetter || '').toUpperCase());
  if (!usb) return { ok: false, error: 'No encuentro esa memoria USB.' };
  if (expectedUniqueId && usb.uniqueId && usb.uniqueId !== expectedUniqueId) {
    return { ok: false, error: 'La memoria USB conectada cambió desde la confirmación. Se canceló el formateo por seguridad.' };
  }
  if (expectedDiskSize > 0 && usb.diskSizeBytes > 0 && usb.diskSizeBytes !== expectedDiskSize) {
    return { ok: false, error: 'El tamaño físico de la USB cambió desde la confirmación. Se canceló el formateo por seguridad.' };
  }
  if (usb.sizeGb > 32.5) {
    return { ok: false, error: `La USB ${usb.letter} tiene ${usb.sizeGb} GB y Windows solo formatea en FAT32 hasta 32 GB. Usa una USB de 32 GB o menos.` };
  }
  const elev = await runElevated(
    `$cfg = ${psData({ letter: usb.letter.slice(0, 1), uniqueId: expectedUniqueId || usb.uniqueId || '', diskSize: expectedDiskSize || usb.diskSizeBytes || 0 })}
$disk = Get-Partition -DriveLetter $cfg.letter | Get-Disk | Select-Object -First 1
if (-not $disk -or $disk.BusType -ne 'USB') { exit 3 }
if ($cfg.uniqueId -and ([string]$disk.UniqueId -ne [string]$cfg.uniqueId)) { exit 4 }
if ($cfg.diskSize -gt 0 -and ([int64]$disk.Size -ne [int64]$cfg.diskSize)) { exit 5 }
Format-Volume -DriveLetter $cfg.letter -FileSystem FAT32 -NewFileSystemLabel 'BIOS' -Force -Confirm:$false | Out-Null`,
    5 * 60 * 1000
  );
  if (elev.cancelled) return { ok: false, error: 'Formateo cancelado: Windows pidió permisos de administrador.' };
  const after = (await listUsbDrives()).find((d) => d.letter === usb.letter);
  if (!after || !/^FAT32$/i.test(after.fileSystem)) return { ok: false, error: 'Windows no pudo formatear la USB en FAT32.' };
  return { ok: true, drive: after };
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Descarga, verifica y copia la BIOS a la USB. `latest` viene del proceso principal (nunca de la interfaz).
async function prepareBiosUsb({ latest, boardCode, drive, onProgress = () => {} }) {
  if (!latest?.url || !latest.sha256) return { ok: false, error: 'MSI no publicó la huella SHA-256 de esta BIOS: descárgala desde su web.' };
  if (!/^[0-9A-Z]{4}$/i.test(String(boardCode || ''))) return { ok: false, error: 'Código de placa madre inválido.' };
  if (!isStrictHttpsHostUrl(latest.url, MSI_DOWNLOAD_HOST)) return { ok: false, error: 'La descarga no viene por HTTPS del servidor oficial de MSI.' };

  // La unidad debe seguir conectada, ser extraíble y estar en FAT32 (M-Flash no lee NTFS).
  const drives = await listUsbDrives();
  const usb = drives.find((d) => d.letter === String(drive || '').toUpperCase());
  if (!usb) return { ok: false, error: 'No encuentro esa memoria USB. Conéctala y vuelve a intentarlo.' };
  if (!/^FAT32$/i.test(usb.fileSystem)) {
    return { ok: false, error: `La USB ${usb.letter} está en ${usb.fileSystem || 'formato desconocido'}. M-Flash necesita FAT32: formatéala en FAT32 y vuelve a intentarlo.` };
  }
  if (usb.freeBytes < (latest.size || 0) * 2 + 32 * 1024 * 1024) return { ok: false, error: `La USB ${usb.letter} no tiene espacio suficiente.` };

  onProgress('Descargando la BIOS oficial de MSI…');
  let buf;
  try {
    const res = await fetchWithTimeout(latest.url, 180000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.url && !isStrictHttpsHostUrl(res.url, MSI_DOWNLOAD_HOST)) {
      throw new Error('la redirección salió del servidor oficial HTTPS de MSI');
    }
    const cl = Number(res.headers?.get?.('content-length') || 0);
    if (cl > MAX_BIOS_BYTES) throw new Error('el archivo excede el tamaño máximo esperado para una BIOS');
    buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BIOS_BYTES) throw new Error('el archivo excede el tamaño máximo esperado para una BIOS');
  } catch (err) {
    return { ok: false, error: `No se pudo descargar la BIOS (${err.message}).` };
  }

  onProgress('Verificando la huella SHA-256…');
  const actual = sha256(buf);
  if (actual !== latest.sha256) {
    return { ok: false, error: 'La huella SHA-256 no coincide con la publicada por MSI. Se descartó el archivo por seguridad.' };
  }

  const safeVer = String(latest.version || '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '') || 'bios';
  const work = path.resolve(WORK_DIR, safeVer);
  const workRoot = path.resolve(WORK_DIR) + path.sep;
  if (!work.startsWith(workRoot)) return { ok: false, error: 'Nombre de versión de BIOS no válido.' };
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  try {
    const zipPath = path.join(work, `${safeVer}.zip`);
    fs.writeFileSync(zipPath, buf);

    onProgress('Descomprimiendo…');
    const outDir = path.join(work, 'x');
    const ex = await runPowerShell(
      `$d = ${psData({ zip: zipPath, out: outDir })}; Expand-Archive -LiteralPath $d.zip -DestinationPath $d.out -Force`,
      60000
    );
    if (!ex.ok) return { ok: false, error: 'No se pudo descomprimir el archivo de la BIOS.' };

    // El archivo de BIOS de MSI se llama E<código><plataforma>MS.<versión>:
    // E7D43IMS.1P0 en placas Intel, E7E27AMS.1J3 en placas AMD.
    const files = [];
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(outDir);
    const image = files.find((f) => new RegExp(`^E${boardCode}[A-Z]MS\\.[0-9A-Z]{3}$`, 'i').test(path.basename(f)));
    if (!image) return { ok: false, error: 'El archivo descargado no contiene una BIOS para tu placa. No se copió nada.' };

    onProgress(`Copiando a la USB ${usb.letter}…`);
    const dest = path.join(`${usb.letter}\\`, path.basename(image));
    try {
      fs.copyFileSync(image, dest);
      const copied = fs.readFileSync(dest);
      if (sha256(copied) !== sha256(fs.readFileSync(image))) throw new Error('la copia no coincide');
    } catch (err) {
      return { ok: false, error: `No se pudo copiar a la USB (${err.message}).` };
    }
    return { ok: true, drive: usb.letter, file: path.basename(image), version: latest.version };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = {
  lookupLatestBios,
  listUsbDrives,
  formatUsbFat32,
  prepareBiosUsb,
  parseMsiProduct,
  parseMsiVersion,
  compareMsiVersions,
  supportUrlFor,
};
