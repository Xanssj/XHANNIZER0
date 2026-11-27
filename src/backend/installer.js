'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const { spawn, execFile } = require('child_process');
const { shell } = require('electron');
const { getCatalogItem, detectInstalledPath } = require('./catalog');
const { getEmulatorById, resolveGithubLatestRelease } = require('./emulators');
const { runPowerShell, runElevated, psData } = require('./powershell');

// Calcula hash SHA-256 real y verifica firma Authenticode de Windows en archivos descargados
function computeSha256(filePath) {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

function checkAuthenticodeSignature(filePath) {
  return new Promise((resolve) => {
    if (!/\.(exe|msi|dll|ps1|cab)$/i.test(filePath)) {
      resolve({ status: 'Archivo comprimido', signer: null });
      return;
    }
    const ps = `$s = Get-AuthenticodeSignature -LiteralPath ${psData(String(filePath))}; @{ status = [string]$s.Status; signer = if ($s.SignerCertificate) { [string]$s.SignerCertificate.Subject } else { '' } } | ConvertTo-Json -Compress`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve({ status: 'No verificada', signer: null });
          return;
        }
        try {
          const parsed = JSON.parse(String(stdout).trim());
          const cnMatch = String(parsed.signer || '').match(/CN=([^,]+)/);
          resolve({
            status: parsed.status === 'Valid' ? 'Firma válida' : parsed.status || 'Sin firma',
            signer: cnMatch ? cnMatch[1].replace(/^"|"$/g, '') : null,
          });
        } catch {
          resolve({ status: 'No verificada', signer: null });
        }
      }
    );
  });
}

async function verifyDownloadedFile(filePath) {
  const [sha256, sig] = await Promise.all([computeSha256(filePath), checkAuthenticodeSignature(filePath)]);
  return {
    sha256: sha256 ? `${sha256.slice(0, 16)}…${sha256.slice(-8)}` : null,
    sha256Full: sha256,
    signatureStatus: sig.status,
    signatureSigner: sig.signer,
  };
}

const DOWNLOAD_DIR = path.join(os.tmpdir(), 'XHANNIZER0_downloads');
const EMULATOR_DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'XHANNIZER0_Emuladores');

let wingetCached = null;

function hasWinget() {
  if (wingetCached !== null) return Promise.resolve(wingetCached);
  return new Promise((resolve) => {
    execFile('winget.exe', ['--version'], { windowsHide: true, timeout: 4000 }, (err) => {
      wingetCached = !err;
      resolve(wingetCached);
    });
  });
}

const DEFAULT_MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024; // 1 GiB

function downloadFile(url, destPath, onProgress = () => {}, opts = {}) {
  const maxBytes = Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : DEFAULT_MAX_DOWNLOAD_BYTES;
  const allowedHosts = Array.isArray(opts.allowedHosts) && opts.allowedHosts.length
    ? new Set(opts.allowedHosts.map((h) => String(h).toLowerCase()))
    : null;
  const client = opts.httpsClient || https;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 25000;

  return new Promise((resolve, reject) => {
    let settled = false;
    let activeOut = null;
    let activeRes = null;
    let activeReq = null;
    const unlinkPartial = () => {
      try {
        fs.rmSync(destPath, { force: true });
      } catch {
        // Ignorar
      }
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      const errObj = err instanceof Error ? err : new Error(String(err));
      try { activeRes?.unpipe?.(activeOut); } catch {}
      try { activeReq?.destroy?.(); } catch {}
      try { activeRes?.destroy?.(); } catch {}
      const out = activeOut;
      if (out && !out.closed) {
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          unlinkPartial();
          reject(errObj);
        };
        out.once('close', done);
        out.once('error', done);
        try {
          out.destroy();
        } catch {
          done();
        }
        return;
      }
      unlinkPartial();
      reject(errObj);
    };
    const succeed = (filePath) => {
      if (settled) return;
      settled = true;
      resolve(filePath);
    };

    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
    } catch (err) {
      fail(err);
      return;
    }

    const follow = (currentUrl, redirects = 0) => {
      if (settled) return;
      if (redirects > 5) {
        fail(new Error('Demasiadas redirecciones al descargar.'));
        return;
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(currentUrl);
      } catch {
        fail(new Error('URL de descarga inválida.'));
        return;
      }
      if (parsedUrl.protocol !== 'https:') {
        fail(new Error('Solo se permiten descargas por HTTPS.'));
        return;
      }
      if (allowedHosts && !allowedHosts.has(parsedUrl.hostname.toLowerCase())) {
        fail(new Error(`Host de descarga no autorizado (${parsedUrl.hostname}).`));
        return;
      }
      const req = client.get(
        parsedUrl.toString(),
        { headers: { 'User-Agent': 'XHANNIZER0/2.3 (Xhanni Studios)' }, timeout: timeoutMs },
        (res) => {
          activeRes = res;
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            let nextUrl;
            try {
              nextUrl = new URL(res.headers.location, currentUrl).toString();
            } catch {
              fail(new Error('Redirección con URL inválida.'));
              return;
            }
            follow(nextUrl, redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            fail(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const total = Number(res.headers['content-length']) || 0;
          if (total > maxBytes) {
            res.resume();
            fail(new Error('El archivo excede el tamaño máximo permitido.'));
            return;
          }
          let received = 0;
          const out = fs.createWriteStream(destPath);
          activeOut = out;
          res.on('error', (err) => fail(err));
          res.on('data', (chunk) => {
            if (settled) return;
            received += chunk.length;
            if (received > maxBytes) {
              fail(new Error('La descarga superó el tamaño máximo permitido.'));
              return;
            }
            if (total > 0) {
              const pct = Math.min(95, Math.round((received / total) * 100));
              onProgress(pct);
            }
          });
          res.pipe(out);
          out.on('finish', () => {
            if (settled) return;
            out.close(() => succeed(destPath));
          });
          out.on('error', (err) => fail(err));
        }
      );
      activeReq = req;
      req.on('error', (err) => fail(err));
      req.on('timeout', () => {
        fail(new Error('Tiempo de espera agotado'));
      });
    };
    follow(url);
  });
}

function runWingetInstall(wingetId, onProgress, source = null) {
  return new Promise((resolve) => {
    const args = [
      'install',
      '--id',
      wingetId,
      '--exact',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
    ];
    if (source) {
      args.push('--source', source);
    } else {
      args.push('--silent');
    }

    const child = spawn('winget.exe', args, { windowsHide: true });
    let phase = 'downloading';
    let fakePct = 18;
    let output = '';
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      clearTimeout(killTimer);
      resolve(res);
    };
    const killTimer = setTimeout(() => {
      try { child.kill(); } catch { /* ignorar */ }
      finish({ ok: false, code: -2, output: 'Tiempo de espera agotado en WinGet.' });
    }, 15 * 60 * 1000);

    const timer = setInterval(() => {
      if (phase === 'downloading' && fakePct < 68) {
        fakePct += 6;
        onProgress({ state: 'downloading', progress: fakePct, detail: 'Descargando paquete oficial…' });
      } else if (phase === 'installing' && fakePct < 94) {
        fakePct += 4;
        onProgress({ state: 'installing', progress: fakePct, detail: 'Instalando paquete oficial…' });
      }
    }, 900);

    const inspectChunk = (chunk) => {
      const text = String(chunk || '');
      output += text;
      if (/installing|instalando|starting package install|iniciando la instalación/i.test(text)) {
        phase = 'installing';
        fakePct = Math.max(fakePct, 72);
        onProgress({ state: 'installing', progress: fakePct, detail: 'Instalando paquete oficial…' });
      }
      const pctMatch = text.match(/(\d{1,3})\s*%/);
      if (pctMatch) {
        const parsed = Math.min(95, Number(pctMatch[1]));
        if (parsed > fakePct) {
          fakePct = parsed;
          onProgress({
            state: phase,
            progress: fakePct,
            detail: phase === 'installing' ? 'Instalando…' : `Descargando ${fakePct}%`,
          });
        }
      }
    };

    child.stdout.on('data', inspectChunk);
    child.stderr.on('data', inspectChunk);

    child.on('error', (err) => {
      finish({ ok: false, code: -1, output: err.message });
    });

    child.on('close', (code) => {
      const alreadyLatest = code === -1978335189 || /already installed|ya está instalado/i.test(output);
      finish({ ok: code === 0 || alreadyLatest, alreadyLatest, code, output });
    });
  });
}

// Resuelve los Hardware IDs exactos de los dispositivos (DEVPKEY_Device_HardwareIds).
// `instanceIds`: IDs de instancia PnP concretos; `scope`: grupo de dispositivos PCI del sistema.
async function resolveHardwareIds({ instanceIds = [], scope = null }) {
  const ps = `
$ids = @(${psData(instanceIds.map(String))})
$scope = ${psData(scope || '')}
if ($scope -eq 'system-pci') {
  $ids += @(Get-PnpDevice -PresentOnly -Class System -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like 'PCI\\*' } | ForEach-Object { $_.InstanceId })
} elseif ($scope -eq 'storage-pci') {
  $ids += @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like 'PCI\\*' -and $_.Class -in @('SCSIAdapter','HDC') } | ForEach-Object { $_.InstanceId })
}
$hw = foreach ($id in ($ids | Select-Object -Unique)) {
  (Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_HardwareIds' -ErrorAction SilentlyContinue).Data
}
ConvertTo-Json -InputObject @($hw | Where-Object { $_ } | Select-Object -Unique) -Compress`;
  const r = await runPowerShell(ps, 20000);
  try {
    const list = JSON.parse(r.stdout || '[]');
    return (Array.isArray(list) ? list : [list]).map((x) => String(x).toLowerCase());
  } catch {
    return [];
  }
}

// Busca en Windows Update solo drivers cuyo DriverHardwareID coincide EXACTAMENTE con un
// Hardware ID del dispositivo. La búsqueda no requiere admin; la instalación se eleva (UAC).
// Devuelve los drivers pendientes de Windows Update que coinciden con los Hardware IDs, o null si falla
async function searchDriverUpdates(hardwareIds) {
  const searchPs = `
$hw = @(${psData(hardwareIds)})
$searcher = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher()
$res = $searcher.Search("IsInstalled=0 and Type='Driver'")
$out = foreach ($u in $res.Updates) {
  if ($u.DriverHardwareID -and ($hw -contains ([string]$u.DriverHardwareID).ToLower())) {
    [pscustomobject]@{ id = $u.Identity.UpdateID; title = [string]$u.Title; hwid = [string]$u.DriverHardwareID }
  }
}
ConvertTo-Json -InputObject @($out) -Compress`;
  const search = await runPowerShell(`$ErrorActionPreference = 'Stop'\n${searchPs}`, 120000);
  if (!search.ok) return null;
  try {
    const matches = JSON.parse(search.stdout || '[]');
    return Array.isArray(matches) ? matches : [matches];
  } catch {
    return null;
  }
}

async function installWindowsUpdateDriver(target, onProgress) {
  onProgress({ state: 'downloading', progress: 20, detail: 'Identificando el dispositivo (Hardware ID)…' });
  const hardwareIds = await resolveHardwareIds(target || {});
  if (!hardwareIds.length) {
    return { status: 'no_hwid', count: 0 };
  }

  onProgress({ state: 'downloading', progress: 32, detail: 'Consultando catálogo oficial WHQL (Microsoft Update)…' });
  const matches = await searchDriverUpdates(hardwareIds);
  if (!matches) return { status: 'offline_or_blocked', count: 0 };
  if (!matches.length) {
    return { status: 'uptodate', count: 0 };
  }

  onProgress({ state: 'installing', progress: 60, detail: `Instalando ${matches.length} driver(s) WHQL (se pedirán permisos de administrador)…` });
  const resultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhannizer0-wu-'));
  const resultFile = path.join(resultDir, 'result.json');
  const installPs = `
$ids = @(${psData(matches.map((m) => m.id))})
$session = New-Object -ComObject Microsoft.Update.Session
$res = $session.CreateUpdateSearcher().Search("IsInstalled=0 and Type='Driver'")
$coll = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($u in $res.Updates) { if ($ids -contains $u.Identity.UpdateID) { [void]$coll.Add($u) } }
$result = @{ status = 'uptodate'; count = 0; reboot = $false }
if ($coll.Count -gt 0) {
  $dl = $session.CreateUpdateDownloader(); $dl.Updates = $coll; [void]$dl.Download()
  $inst = $session.CreateUpdateInstaller(); $inst.Updates = $coll
  $r = $inst.Install()
  $result = @{ status = $(if ($r.ResultCode -eq 2) { 'installed' } else { 'failed' }); count = $coll.Count; reboot = [bool]$r.RebootRequired }
}
$result | ConvertTo-Json -Compress | Set-Content -LiteralPath ${psData(resultFile)} -Encoding UTF8`;
  let result = { status: 'failed', count: matches.length };
  try {
    const elev = await runElevated(installPs, 15 * 60 * 1000);
    result = { status: elev.cancelled ? 'needs_admin' : 'failed', count: matches.length };
    try {
      result = { ...JSON.parse(fs.readFileSync(resultFile, 'utf8').replace(/^﻿/, '')), titles: matches.map((m) => m.title) };
    } catch {
      // Sin archivo de resultado: UAC cancelado o error
    }
  } finally {
    try {
      fs.rmSync(resultDir, { recursive: true, force: true });
    } catch {
      // Ignorar
    }
  }
  return result;
}

async function installSingleItem(task, emit) {
  const { id, type, driverBranch, officialUrl, name, storeId } = task;
  const emitAudit = (payload) =>
    emit({
      id,
      name: name || id,
      timestamp: Date.now(),
      ...payload,
    });

  emitAudit({
    state: 'pending',
    progress: 0,
    detail: 'En cola…',
    sourceType: type === 'emulator' ? 'GitHub Releases' : type === 'msstore' ? 'Microsoft Store' : type === 'driver' ? 'Canal Oficial WHQL' : 'WinGet / Oficial',
    sourceOrigin: officialUrl || storeId || 'Oficial',
  });

  // Caso 1: Emulador desde GitHub Releases (descarga directa sin abrir navegador)
  if (type === 'emulator') {
    const emu = getEmulatorById(id);
    if (!emu) {
      emitAudit({ state: 'warning', progress: 0, detail: 'Emulador no encontrado' });
      return { id, ok: false };
    }
    const repoOrigin = `github.com/${emu.githubRepo}`;
    emitAudit({
      state: 'downloading',
      progress: 12,
      detail: `Consultando último release en GitHub (${emu.githubRepo})…`,
      sourceType: 'GitHub Releases',
      sourceOrigin: repoOrigin,
    });
    const release = await resolveGithubLatestRelease(emu.githubRepo);

    if (release.ok && release.asset?.url) {
      const safeAssetName = path.basename(String(release.asset.name || '')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      const dest = safeAssetName && safeAssetName !== '.' && safeAssetName !== '..'
        ? path.resolve(EMULATOR_DOWNLOAD_DIR, safeAssetName)
        : null;
      const emuRoot = path.resolve(EMULATOR_DOWNLOAD_DIR) + path.sep;
      if (dest && dest.startsWith(emuRoot)) {
      try {
        emitAudit({
          state: 'downloading',
          progress: 20,
          detail: `Descargando ${release.tag} (${safeAssetName})…`,
          sourceType: 'GitHub Releases',
          sourceOrigin: release.asset.url,
        });
        await downloadFile(release.asset.url, dest, (pct) => {
          emitAudit({
            state: 'downloading',
            progress: pct,
            detail: `Descargando ${release.tag} · ${pct}%`,
            sourceType: 'GitHub Releases',
            sourceOrigin: release.asset.url,
          });
        });
        emitAudit({
          state: 'installing',
          progress: 96,
          detail: 'Verificando SHA-256 y firma digital…',
          sourceType: 'GitHub Releases',
          sourceOrigin: release.asset.url,
        });
        const cryptoInfo = await verifyDownloadedFile(dest);
        // Solo se inicia automáticamente un instalador si tiene firma Authenticode válida;
        // si no está firmado (habitual en proyectos open-source), se muestra la carpeta al usuario.
        const autoLaunched = /\.(exe|msi)$/i.test(dest) && cryptoInfo.signatureStatus === 'Firma válida';
        if (autoLaunched) {
          await shell.openPath(dest);
        } else {
          shell.showItemInFolder(dest);
        }
        emitAudit({
          state: 'done',
          progress: 100,
          detail: autoLaunched
            ? `Instalador verificado ${release.tag} iniciado desde Descargas\\XHANNIZER0_Emuladores`
            : `Descargado ${release.tag} en Descargas\\XHANNIZER0_Emuladores (sin firma: revisa antes de ejecutar)`,
          sourceType: 'GitHub Releases',
          sourceOrigin: release.asset.url,
          ...cryptoInfo,
        });
        return { id, ok: true };
      } catch {
        // Fallback a winget
      }
      }
    }

    if (emu.wingetId && (await hasWinget())) {
      emitAudit({
        state: 'downloading',
        progress: 22,
        detail: `Instalando vía WinGet (${emu.wingetId})…`,
        sourceType: 'WinGet Oficial',
        sourceOrigin: `winget: ${emu.wingetId}`,
      });
      const res = await runWingetInstall(emu.wingetId, (upd) =>
        emitAudit({ ...upd, sourceType: 'WinGet Oficial', sourceOrigin: `winget: ${emu.wingetId}` })
      );
      if (res.ok) {
        emitAudit({
          state: 'done',
          progress: 100,
          detail: 'Instalado correctamente',
          sourceType: 'WinGet Oficial',
          sourceOrigin: `winget: ${emu.wingetId}`,
        });
        return { id, ok: true };
      }
    }

    emitAudit({
      state: 'warning',
      progress: 100,
      detail: 'Sin asset automático disponible; usa "Repo GitHub" para descarga manual',
      sourceType: 'GitHub Releases',
      sourceOrigin: repoOrigin,
    });
    return { id, ok: false };
  }

  // Caso 2: Microsoft Store (instala directo con winget --source msstore)
  if (type === 'msstore' && storeId) {
    const cleanStoreId = String(storeId).trim();
    const origin = `msstore: ${cleanStoreId}`;
    if (!/^[A-Z0-9]{8,20}$/i.test(cleanStoreId)) {
      emitAudit({ state: 'warning', progress: 100, detail: 'ID de Microsoft Store inválido', sourceType: 'Microsoft Store', sourceOrigin: origin });
      return { id, ok: false };
    }
    const wingetAvailable = await hasWinget();
    if (wingetAvailable) {
      emitAudit({
        state: 'downloading',
        progress: 15,
        detail: `Descargando desde Microsoft Store (${cleanStoreId})…`,
        sourceType: 'Microsoft Store',
        sourceOrigin: origin,
      });
      const res = await runWingetInstall(
        cleanStoreId,
        (upd) => emitAudit({ ...upd, sourceType: 'Microsoft Store', sourceOrigin: origin }),
        'msstore'
      );
      if (res.ok) {
        emitAudit({
          state: 'done',
          progress: 100,
          detail: res.alreadyLatest ? 'Ya instalado desde Microsoft Store' : 'Instalado desde Microsoft Store',
          sourceType: 'Microsoft Store',
          sourceOrigin: origin,
        });
        return { id, ok: true };
      }
    }
    emitAudit({
      state: 'warning',
      progress: 100,
      detail: 'Requiere abrir ficha en Microsoft Store (botón «Abrir en Store»)',
      sourceType: 'Microsoft Store',
      sourceOrigin: origin,
    });
    return { id, ok: false };
  }

  // Caso 3: Driver de hardware — AUTOMÁTICO dentro de la app (SIN abrir el navegador)
  if (type === 'driver') {
    const cleanName = String(name || '').replace(/^[^:]+:\s*/, '');

    // 3A. Si tiene paquete oficial en WinGet (ej. NVIDIA App) y eligió última
    if (task.wingetId && driverBranch !== 'safe' && (await hasWinget())) {
      const origin = `winget: ${task.wingetId}`;
      emitAudit({
        state: 'downloading',
        progress: 16,
        detail: `Instalando paquete oficial (${task.wingetId})…`,
        sourceType: 'WinGet Oficial (Fabricante)',
        sourceOrigin: origin,
      });
      const res = await runWingetInstall(task.wingetId, (upd) =>
        emitAudit({ ...upd, sourceType: 'WinGet Oficial (Fabricante)', sourceOrigin: origin })
      );
      if (res.ok) {
        emitAudit({
          state: 'done',
          progress: 100,
          detail: 'Controlador / paquete oficial instalado automáticamente',
          sourceType: 'WinGet Oficial (Fabricante)',
          sourceOrigin: origin,
        });
        return { id, ok: true };
      }
    }

    // 3B. Instalación / verificación automática vía Windows Update WHQL Driver API (sin abrir navegador)
    const whqlOrigin = `Windows Update WHQL (${cleanName.slice(0, 36)})`;
    emitAudit({
      state: 'downloading',
      progress: 25,
      detail: 'Buscando e instalando controlador oficial WHQL en segundo plano…',
      sourceType: 'Windows Update WHQL',
      sourceOrigin: whqlOrigin,
    });

    // pnpTarget lo completa el proceso principal desde el último escaneo (nunca la interfaz)
    const wuRes = await installWindowsUpdateDriver(task.pnpTarget || {}, (upd) =>
      emitAudit({ ...upd, sourceType: 'Windows Update WHQL', sourceOrigin: whqlOrigin })
    );

    if (wuRes.status === 'installed') {
      emitAudit({
        state: 'done',
        progress: 100,
        detail: wuRes.reboot
          ? `Driver WHQL instalado (${wuRes.count}). Reinicia Windows para finalizar.`
          : `Driver WHQL instalado automáticamente (${wuRes.count}).`,
        sourceType: 'Windows Update WHQL',
        sourceOrigin: whqlOrigin,
      });
      return { id, ok: true };
    }

    if (wuRes.status === 'uptodate') {
      emitAudit({
        state: 'done',
        progress: 100,
        detail: 'Windows Update no tiene un driver más nuevo para este Hardware ID exacto',
        sourceType: 'Windows Update WHQL',
        sourceOrigin: whqlOrigin,
      });
      return { id, ok: true };
    }

    const wuWarnings = {
      no_hwid: 'No se pudo identificar el Hardware ID del dispositivo: reescanea el hardware o usa la web oficial del fabricante',
      needs_admin: 'Instalación cancelada: Windows pidió permisos de administrador (UAC) y no se concedieron',
      offline_or_blocked: 'No se pudo consultar Windows Update (sin conexión o servicio bloqueado)',
      failed: 'Windows Update no pudo instalar el driver; revisa Windows Update o la web oficial',
    };
    emitAudit({
      state: 'warning',
      progress: 100,
      detail: wuWarnings[wuRes.status] || wuWarnings.failed,
      sourceType: 'Windows Update WHQL',
      sourceOrigin: whqlOrigin,
    });
    return { id, ok: false };
  }

  // Caso 3C: Paquete WinGet genérico (programas de una migración que no están en el catálogo)
  if (type === 'winget') {
    const wingetId = String(task.wingetId || '');
    const origin = `winget: ${wingetId}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9.+_-]{1,120}$/.test(wingetId) || !(await hasWinget())) {
      emitAudit({ state: 'warning', progress: 100, detail: 'Paquete WinGet inválido o WinGet no disponible', sourceType: 'WinGet Oficial', sourceOrigin: origin });
      return { id, ok: false };
    }
    emitAudit({ state: 'downloading', progress: 12, detail: `Instalando ${wingetId}…`, sourceType: 'WinGet Oficial', sourceOrigin: origin });
    const res = await runWingetInstall(
      wingetId,
      (upd) => emitAudit({ ...upd, sourceType: 'WinGet Oficial', sourceOrigin: origin }),
      task.wingetSource === 'msstore' ? 'msstore' : null
    );
    emitAudit({
      state: res.ok ? 'done' : 'warning',
      progress: 100,
      detail: res.ok ? (res.alreadyLatest ? 'Ya instalado' : 'Instalado correctamente') : 'WinGet no pudo instalar este paquete',
      sourceType: 'WinGet Oficial',
      sourceOrigin: origin,
    });
    return { id, ok: res.ok };
  }

  // Caso 4: Software del catálogo (WinGet silencioso -> descarga HTTPS directa en app)
  const item = getCatalogItem(id);
  if (!item) {
    emitAudit({ state: 'warning', progress: 0, detail: 'Elemento no encontrado en catálogo' });
    return { id, ok: false };
  }

  const wingetAvailable = await hasWinget();
  if (wingetAvailable && item.wingetId) {
    const origin = `winget: ${item.wingetId}`;
    const srcLabel = item.wingetSource === 'msstore' ? 'Microsoft Store' : 'WinGet Oficial';
    emitAudit({
      state: 'downloading',
      progress: 12,
      detail: `Descargando desde ${srcLabel} (${item.wingetId})…`,
      sourceType: srcLabel,
      sourceOrigin: origin,
    });
    const res = await runWingetInstall(
      item.wingetId,
      (upd) => emitAudit({ ...upd, sourceType: srcLabel, sourceOrigin: origin }),
      item.wingetSource || null
    );
    if (res.ok) {
      const installedPath = detectInstalledPath(item);
      emitAudit({
        state: 'done',
        progress: 100,
        detail: res.alreadyLatest ? 'Ya actualizado' : 'Instalado correctamente',
        installed: true,
        installedPath,
        sourceType: srcLabel,
        sourceOrigin: origin,
      });
      return { id, ok: true };
    }
  }

  // Fallback limpio: descarga directa HTTPS del instalador oficial dentro de la app (sin abrir navegador)
  const directBinary = /\.(exe|msi)$/i.test(item.downloadUrl || '') || /winx64|vc_redist|win32-x64/i.test(item.downloadUrl || '');
  if (directBinary) {
    const ext = /\.msi$/i.test(item.downloadUrl) ? '.msi' : '.exe';
    const dest = path.join(DOWNLOAD_DIR, `${item.id}-setup${ext}`);
    try {
      emitAudit({
        state: 'downloading',
        progress: 10,
        detail: 'Descargando instalador oficial directamente…',
        sourceType: 'CDN Oficial del Fabricante',
        sourceOrigin: item.downloadUrl,
      });
      await downloadFile(item.downloadUrl, dest, (pct) => {
        emitAudit({
          state: 'downloading',
          progress: pct,
          detail: `Descargando ${pct}%`,
          sourceType: 'CDN Oficial del Fabricante',
          sourceOrigin: item.downloadUrl,
        });
      });
      emitAudit({
        state: 'installing',
        progress: 96,
        detail: 'Verificando SHA-256 y firma Authenticode…',
        sourceType: 'CDN Oficial del Fabricante',
        sourceOrigin: item.downloadUrl,
      });
      const cryptoInfo = await verifyDownloadedFile(dest);
      if (cryptoInfo.signatureStatus !== 'Firma válida') {
        // Nunca ejecutar un instalador sin firma Authenticode válida: se descarta el archivo.
        try {
          fs.rmSync(dest, { force: true });
        } catch {
          // Si Windows lo bloquea, al menos no se ejecuta
        }
        emitAudit({
          state: 'warning',
          progress: 100,
          detail: `Instalación bloqueada: el instalador no tiene una firma digital válida (${cryptoInfo.signatureStatus}). Descárgalo manualmente desde la web oficial.`,
          sourceType: 'CDN Oficial del Fabricante',
          sourceOrigin: item.downloadUrl,
          ...cryptoInfo,
        });
        return { id, ok: false };
      }
      const openErr = await shell.openPath(dest);
      if (openErr) throw new Error(openErr);
      emitAudit({
        state: 'done',
        progress: 100,
        detail: 'Instalador oficial verificado e iniciado',
        sourceType: 'CDN Oficial del Fabricante',
        sourceOrigin: item.downloadUrl,
        ...cryptoInfo,
      });
      return { id, ok: true };
    } catch {
      // Si falla descarga directa
    }
  }

  emitAudit({
    state: 'warning',
    progress: 100,
    detail: 'No se pudo instalar automáticamente; usa el botón «Web oficial» para descarga manual',
    sourceType: 'Fuente Oficial',
    sourceOrigin: item.officialUrl,
  });
  return { id, ok: false };
}

async function runBatchInstall(tasks, emit) {
  for (const task of tasks) {
    emit({
      id: task.id,
      name: task.name || task.id,
      state: 'pending',
      progress: 0,
      detail: 'Pendiente en cola',
      sourceType: task.type === 'emulator' ? 'GitHub Releases' : task.type === 'msstore' ? 'Microsoft Store' : task.type === 'driver' ? 'Windows Update WHQL' : 'WinGet Oficial',
      sourceOrigin: task.officialUrl || task.storeId || 'Oficial',
      timestamp: Date.now(),
    });
  }
  const results = [];
  for (const task of tasks) {
    const res = await installSingleItem(task, emit);
    results.push(res);
  }
  return results;
}

module.exports = {
  _internals: { resolveHardwareIds, searchDriverUpdates, downloadFile },
  DOWNLOAD_DIR,
  EMULATOR_DOWNLOAD_DIR,
  hasWinget,
  installSingleItem,
  runBatchInstall,
};
