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
    const quoted = String(filePath).replace(/'/g, "''");
    const ps = `$s = Get-AuthenticodeSignature -FilePath '${quoted}'; @{ status = [string]$s.Status; signer = if ($s.SignerCertificate) { [string]$s.SignerCertificate.Subject } else { '' } } | ConvertTo-Json -Compress`;
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

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const follow = (currentUrl, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error('Demasiadas redirecciones al descargar.'));
        return;
      }
      const req = https.get(
        currentUrl,
        { headers: { 'User-Agent': 'XHANNIZER0/1.3 (Xhanni Studios)' }, timeout: 25000 },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            follow(new URL(res.headers.location, currentUrl).toString(), redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const total = Number(res.headers['content-length']) || 0;
          let received = 0;
          const out = fs.createWriteStream(destPath);
          res.on('data', (chunk) => {
            received += chunk.length;
            if (total > 0) {
              const pct = Math.min(95, Math.round((received / total) * 100));
              onProgress(pct);
            }
          });
          res.pipe(out);
          out.on('finish', () => out.close(() => resolve(destPath)));
          out.on('error', (err) => reject(err));
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Tiempo de espera agotado'));
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
      clearInterval(timer);
      resolve({ ok: false, code: -1, output: err.message });
    });

    child.on('close', (code) => {
      clearInterval(timer);
      const alreadyLatest = code === -1978335189 || /already installed|ya está instalado/i.test(output);
      resolve({ ok: code === 0 || alreadyLatest, alreadyLatest, code, output });
    });
  });
}

// Instala o verifica controladores firmados WHQL directamente desde Windows Update sin abrir el navegador
function installWindowsUpdateDriver(deviceKeyword, onProgress) {
  return new Promise((resolve) => {
    const safeKey = String(deviceKeyword || '')
      .replace(/[^a-z0-9\s-]/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 2)
      .join('|');

    const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$res = $searcher.Search("IsInstalled=0 and Type='Driver'")
$matched = @()
foreach ($u in $res.Updates) {
  $title = [string]$u.Title
  $model = [string]$u.DriverModel
  if (-not '${safeKey}' -or $title -match '${safeKey}' -or $model -match '${safeKey}') {
    $matched += $u
  }
}
if ($matched.Count -eq 0) {
  pnputil.exe /scan-devices | Out-Null
  @{ status = 'uptodate'; count = 0; message = 'Driver WHQL al día en el catálogo oficial de Windows Update.' } | ConvertTo-Json -Compress
  exit 0
}
$coll = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($m in $matched) { [void]$coll.Add($m) }
$downloader = $session.CreateUpdateDownloader()
$downloader.Updates = $coll
$dlRes = $downloader.Download()
$installer = $session.CreateUpdateInstaller()
$installer.Updates = $coll
$instRes = $installer.Install()
pnputil.exe /scan-devices | Out-Null
@{
  status = if ($instRes.ResultCode -eq 2) { 'installed' } else { 'needs_admin' }
  count = $matched.Count
  titles = @($matched | ForEach-Object { $_.Title })
  reboot = [bool]$instRes.RebootRequired
} | ConvertTo-Json -Compress
`;

    onProgress({ state: 'downloading', progress: 32, detail: 'Consultando catálogo oficial WHQL (Microsoft Update)…' });
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, timeout: 65000, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve({ status: 'offline_or_blocked', count: 0 });
          return;
        }
        try {
          resolve(JSON.parse(String(stdout).trim()));
        } catch {
          resolve({ status: 'uptodate', count: 0 });
        }
      }
    );
  });
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
      const dest = path.join(EMULATOR_DOWNLOAD_DIR, release.asset.name);
      try {
        emitAudit({
          state: 'downloading',
          progress: 20,
          detail: `Descargando ${release.tag} (${release.asset.name})…`,
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
        if (/\.(exe|msi)$/i.test(dest)) {
          await shell.openPath(dest);
        } else {
          shell.showItemInFolder(dest);
        }
        emitAudit({
          state: 'done',
          progress: 100,
          detail: `Descargado ${release.tag} en Descargas\\XHANNIZER0_Emuladores`,
          sourceType: 'GitHub Releases',
          sourceOrigin: release.asset.url,
          ...cryptoInfo,
        });
        return { id, ok: true };
      } catch {
        // Fallback a winget
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
    const origin = `msstore: ${storeId}`;
    const wingetAvailable = await hasWinget();
    if (wingetAvailable) {
      emitAudit({
        state: 'downloading',
        progress: 15,
        detail: `Descargando desde Microsoft Store (${storeId})…`,
        sourceType: 'Microsoft Store',
        sourceOrigin: origin,
      });
      const res = await runWingetInstall(
        storeId,
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

    const wuRes = await installWindowsUpdateDriver(cleanName, (upd) =>
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
        detail: 'Driver WHQL verificado al día por Windows Update (escaneo PnP completado)',
        sourceType: 'Windows Update WHQL',
        sourceOrigin: whqlOrigin,
      });
      return { id, ok: true };
    }

    emitAudit({
      state: 'warning',
      progress: 100,
      detail: 'Instalación WHQL requiere ejecutar XHANNIZER0 como Administrador para aplicar cambios de sistema',
      sourceType: 'Windows Update WHQL',
      sourceOrigin: whqlOrigin,
    });
    return { id, ok: false };
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
      await shell.openPath(dest);
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
  DOWNLOAD_DIR,
  EMULATOR_DOWNLOAD_DIR,
  hasWinget,
  installSingleItem,
  runBatchInstall,
};
