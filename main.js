// XHANNIZER0 — Xhanni Studios
// Utilidad post-formateo para Windows con estética macOS / Apple Design y arquitectura limpia.
'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu, nativeTheme, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { detectHardwareAndDrivers, getLastHardwareScan } = require('./src/backend/hardware');
const { getCatalogWithStatusAsync, setCatalogOverrides } = require('./src/backend/catalog');
const { getEmulatorsCatalog, resolveGithubLatestRelease } = require('./src/backend/emulators');
const { hasWinget, runBatchInstall } = require('./src/backend/installer');
const {
  BACKUP_ROOT,
  createSafetyBackup,
  listBackups,
  verifyBackup,
  scanDisksAndFolders,
  executeDiskOrFolderAction,
} = require('./src/backend/safetyBackup');
const {
  getFeaturedStoreApps,
  searchMicrosoftStore,
  buildHardwarePresets,
  applyPresetOptimizations,
} = require('./src/backend/storeAndPresets');
const { scanWindowsSettings, applyWindowsSetting } = require('./src/backend/windowsAudit');
const { listStartupApps, toggleStartupApp } = require('./src/backend/startupManager');
const {
  scanBloatware,
  removeBloatware,
  scanWingetUpgrades,
  runWingetUpgrade,
  scanNetworkAndDns,
  applyNetworkAction,
} = require('./src/backend/postFormatTools');
const { withUndo, restoreBackup, pendingEntries } = require('./src/backend/restore');
const { runPcCheck, getLastPcCheck } = require('./src/backend/pcCheck');
const migration = require('./src/backend/migration');
const maintenance = require('./src/backend/maintenance');
const { initActionLog, logAction, readActionLog } = require('./src/backend/actionLog');
const { restartExplorer } = require('./src/backend/windowsAudit');

app.setAppUserModelId('studio.xhanni.xhannizer0');
app.setName('XHANNIZER0');

// Modo portátil: la versión Portable guarda su configuración junto al .exe (ideal para un USB).
// Los respaldos siguen en el PC, porque protegen a ese equipo.
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'XHANNIZER0-datos'));
}
initActionLog(app.getPath('userData'));
Menu.setApplicationMenu(null);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Modo oscuro forzado para consistencia visual con el ecosistema Xhanni Studios
nativeTheme.themeSource = 'dark';

const STATE_FILE = () => path.join(app.getPath('userData'), 'ventana-xhannizer0.json');
function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
  } catch {
    return {};
  }
}
function saveWindowState(targetWin) {
  try {
    const bounds = targetWin.getNormalBounds();
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...bounds, maximized: targetWin.isMaximized() }));
  } catch {
    // Sin importancia
  }
}

let win = null;
let installBusy = false;

// Las operaciones que modifican el sistema exigen un respaldo real en disco (no solo un ID).
function withVerifiedBackup(handler) {
  return async (_event, payload) => {
    const check = verifyBackup(payload?.backupId);
    if (!check.ok) return { ok: false, error: check.error, message: check.error };
    return handler(payload || {});
  };
}

// Compara versiones tipo semver ("2.0.10" > "2.0.9"); un sufijo -beta cuenta como menor.
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = String(v || '').replace(/^v/i, '').split('-', 2);
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre };
  };
  const va = parse(a);
  const vb = parse(b);
  for (let i = 0; i < Math.max(va.nums.length, vb.nums.length); i += 1) {
    const diff = (va.nums[i] || 0) - (vb.nums[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  if (va.pre === vb.pre) return 0;
  if (!va.pre) return 1;
  if (!vb.pre) return -1;
  return va.pre.localeCompare(vb.pre, undefined, { numeric: true }) > 0 ? 1 : -1;
}

function openExternalSafe(url) {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    return shell.openExternal(url);
  }
  return Promise.resolve();
}

function createWindow() {
  const state = loadWindowState();
  win = new BrowserWindow({
    width: state.width || 1360,
    height: state.height || 880,
    x: state.x,
    y: state.y,
    minWidth: 1020,
    minHeight: 660,
    frame: false,
    show: false,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    title: 'XHANNIZER0 — Xhanni Studios',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  if (state.maximized) win.maximize();

  const contents = win.webContents;
  win.once('ready-to-show', () => win.show());

  // Todo enlace externo se abre en el navegador del sistema
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      openExternalSafe(url);
    }
  });

  // Atajos de teclado estándar de escritorio
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (input.control && key === 'w') {
      event.preventDefault();
      win.close();
    } else if ((input.control && key === 'r') || key === 'f5') {
      event.preventDefault();
      contents.reload();
    } else if (input.control && key === 'm') {
      event.preventDefault();
      win.minimize();
    }
  });

  // Menú contextual limpio en español
  contents.on('context-menu', (_event, params) => {
    const items = [];
    if (params.isEditable) {
      items.push(
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      );
    } else if (params.selectionText) {
      items.push({ role: 'copy', label: 'Copiar' });
    }
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  const sendWindowState = () => {
    if (!win || win.isDestroyed()) return;
    contents.send('xh:window', {
      focused: win.isFocused(),
      maximized: win.isMaximized(),
      dark: true,
    });
  };

  ['focus', 'blur', 'maximize', 'unmaximize', 'restore'].forEach((ev) => win.on(ev, sendWindowState));
  contents.on('did-finish-load', sendWindowState);
  win.on('close', () => saveWindowState(win));

  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
}

// ---------- Controles de ventana (semáforo macOS) y tema claro/oscuro
ipcMain.on('xh:window', (event, action) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target) return;
  if (action === 'close') target.close();
  else if (action === 'minimize') target.minimize();
  else if (action === 'zoom') {
    if (target.isMaximized()) target.unmaximize();
    else target.maximize();
  }
});

ipcMain.on('xh:set-theme', (_event, theme) => {
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
});

// ---------- Hardware y Drivers
ipcMain.handle('xh:scan-hardware', async () => {
  return detectHardwareAndDrivers();
});

// ---------- Chequeo de PC armado (BIOS, RAM, PCIe, Secure Boot, dispositivos sin driver)
ipcMain.handle('xh:pc-check', async () => runPcCheck());

// Busca e instala vía Windows Update el driver de un dispositivo con problemas del último chequeo
ipcMain.handle('xh:install-device-driver', withVerifiedBackup(async (payload) => {
  if (installBusy) return { ok: false, error: 'Ya hay una cola de instalación en curso.' };
  const device = getLastPcCheck()?.devices?.find((d) => d.instanceId === payload.instanceId);
  if (!device) return { ok: false, error: 'Dispositivo no encontrado: vuelve a ejecutar el chequeo.' };
  installBusy = true;
  const emit = (update) => {
    if (win && !win.isDestroyed()) win.webContents.send('xh:install-progress', update);
  };
  try {
    const results = await runBatchInstall([{
      id: `dev-${Buffer.from(device.instanceId).toString('hex').slice(0, 24)}`,
      type: 'driver',
      name: `Driver: ${device.name}`,
      driverBranch: 'safe',
      pnpTarget: { instanceIds: [device.instanceId] },
    }], emit);
    return { ok: Boolean(results[0]?.ok), results };
  } finally {
    installBusy = false;
  }
}));

// ---------- Catálogo de software (con detección real de apps instaladas en Windows)
ipcMain.handle('xh:get-catalog', async () => {
  const [items, winget] = await Promise.all([getCatalogWithStatusAsync(), hasWinget()]);
  const installedCount = items.filter((i) => i.installed).length;
  return { items, wingetAvailable: winget, installedCount };
});

// ---------- Emuladores (GitHub Releases)
ipcMain.handle('xh:get-emulators', async () => {
  return { items: getEmulatorsCatalog() };
});

ipcMain.handle('xh:check-emulator-release', async (_event, repo) => {
  if (!repo || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(String(repo))) return { ok: false };
  return resolveGithubLatestRelease(String(repo));
});

// ---------- Instalación individual o por lote
ipcMain.handle('xh:install-batch', async (_event, payload) => {
  if (installBusy) {
    return { ok: false, error: 'Ya hay una cola de instalación en curso.' };
  }
  // Los drivers toman su Hardware ID del último escaneo del proceso principal, nunca de la interfaz
  const scan = getLastHardwareScan();
  const tasks = (Array.isArray(payload?.tasks) ? payload.tasks : []).map((t) => {
    const { pnpTarget: _ignored, ...rest } = t || {};
    if (rest.type !== 'driver') return rest;
    const drv = scan?.drivers?.find((d) => d.id === rest.id);
    return { ...rest, pnpTarget: drv ? { instanceIds: drv.pnpInstanceIds || [], scope: drv.pnpScope || null } : {} };
  });
  const hasDrivers = tasks.some((t) => t.type === 'driver');
  if (hasDrivers) {
    const check = verifyBackup(payload?.backupId);
    if (!check.ok) {
      return {
        ok: false,
        error: `Por seguridad, se requiere una copia de seguridad vigente antes de instalar drivers. ${check.error}`,
      };
    }
  }
  installBusy = true;
  const emit = (update) => {
    if (win && !win.isDestroyed()) win.webContents.send('xh:install-progress', update);
  };
  try {
    const results = await runBatchInstall(tasks, emit);
    logAction('install', { items: tasks.map((t, i) => ({ id: t.id, name: t.name, type: t.type, ok: Boolean(results[i]?.ok) })) });
    return { ok: true, results };
  } finally {
    installBusy = false;
  }
});

// ---------- Abrir app instalada / URL oficial / Carpeta local
ipcMain.handle('xh:open-app', async (_event, exePath) => {
  if (!exePath || typeof exePath !== 'string') return { ok: false };
  const err = await shell.openPath(exePath);
  return { ok: !err, error: err || null };
});

ipcMain.handle('xh:open-external', async (_event, url) => {
  await openExternalSafe(url);
  return { ok: true };
});

ipcMain.handle('xh:open-path', async (_event, localPath) => {
  const target = localPath || BACKUP_ROOT;
  try {
    fs.mkdirSync(target, { recursive: true });
  } catch {
    // Ignorar si es archivo
  }
  const err = await shell.openPath(target);
  return { ok: !err, error: err || null };
});

ipcMain.handle('xh:pick-folder', async () => {
  if (!win || win.isDestroyed()) return { canceled: true };
  const res = await dialog.showOpenDialog(win, {
    title: 'Seleccionar carpeta de destino — XHANNIZER0',
    properties: ['openDirectory', 'createDirectory'],
  });
  return { canceled: res.canceled, path: res.filePaths?.[0] || null };
});

// ---------- Copia de seguridad obligatoria y organización de discos/carpetas
ipcMain.handle('xh:create-backup', async (_event, options) => {
  const onProgress = (prog) => {
    if (win && !win.isDestroyed()) win.webContents.send('xh:backup-progress', prog);
  };
  return createSafetyBackup({ ...(options || {}), onProgress });
});

ipcMain.handle('xh:list-backups', async () => {
  const backups = listBackups();
  const now = Date.now();
  const recentBackup = backups.find((b) => {
    const t = Date.parse(b.createdAt || '');
    return !Number.isNaN(t) && now - t <= 24 * 60 * 60 * 1000;
  }) || null;
  return { backupRoot: BACKUP_ROOT, backups, recentBackup };
});

ipcMain.handle('xh:scan-disks', async () => {
  return scanDisksAndFolders();
});

ipcMain.handle('xh:run-disk-action', withVerifiedBackup((payload) =>
  withUndo(payload.backupId, 'disk', payload, () => executeDiskOrFolderAction(payload))
));

// ---------- Microsoft Store (búsqueda y ficha nativa)
ipcMain.handle('xh:store-featured', async () => {
  return { items: getFeaturedStoreApps() };
});

ipcMain.handle('xh:store-search', async (_event, query) => {
  return searchMicrosoftStore(query);
});

ipcMain.handle('xh:store-open', async (_event, storeId) => {
  if (!storeId || !/^[A-Z0-9]{8,20}$/i.test(String(storeId))) return { ok: false };
  await shell.openExternal(`ms-windows-store://pdp/?productid=${encodeURIComponent(String(storeId))}`);
  return { ok: true };
});

// ---------- Presets Experimentales adaptados al hardware real
ipcMain.handle('xh:get-presets', async (_event, system) => {
  return { presets: buildHardwarePresets(system) };
});

ipcMain.handle('xh:apply-preset-opt', withVerifiedBackup((payload) =>
  withUndo(payload.backupId, 'preset', payload, () => applyPresetOptimizations(payload))
));

// ---------- Auditoría de Configuraciones de Windows
ipcMain.handle('xh:scan-windows-audit', async (_event, system) => {
  return scanWindowsSettings(system);
});

ipcMain.handle('xh:apply-windows-setting', withVerifiedBackup((payload) =>
  withUndo(payload.backupId, 'windows-setting', payload, () => applyWindowsSetting(payload))
));

// ---------- Gestor de Inicio de Windows (Startup Manager)
ipcMain.handle('xh:list-startup', async () => {
  return listStartupApps();
});

ipcMain.handle('xh:toggle-startup', withVerifiedBackup((payload) =>
  withUndo(payload.backupId, 'startup', payload, () => toggleStartupApp(payload))
));

// ---------- Bloatware, Actualizador Global WinGet y Red/DNS
ipcMain.handle('xh:scan-bloatware', async () => scanBloatware());
ipcMain.handle('xh:remove-bloatware', withVerifiedBackup((payload) =>
  withUndo(payload.backupId, 'bloatware', payload, () => removeBloatware(payload))
));
ipcMain.handle('xh:scan-upgrades', async () => scanWingetUpgrades());
ipcMain.handle('xh:run-upgrade', async (_event, payload) => runWingetUpgrade(payload || {}));
ipcMain.handle('xh:scan-network', async () => scanNetworkAndDns());
ipcMain.handle('xh:apply-network', withVerifiedBackup((payload) =>
  withUndo(payload.backupId, 'network', payload, () => applyNetworkAction(payload))
));

// ---------- Exportar / Importar Perfil XHANNIZER0 (.json)
ipcMain.handle('xh:export-profile', async (_event, profileData) => {
  if (!win || win.isDestroyed()) return { canceled: true };
  const res = await dialog.showSaveDialog(win, {
    title: 'Exportar perfil XHANNIZER0',
    defaultPath: 'XHANNIZER0-perfil.json',
    filters: [{ name: 'Perfil XHANNIZER0 (JSON)', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  fs.writeFileSync(res.filePath, JSON.stringify(profileData, null, 2), 'utf8');
  return { ok: true, path: res.filePath };
});

ipcMain.handle('xh:import-profile', async () => {
  if (!win || win.isDestroyed()) return { canceled: true };
  const res = await dialog.showOpenDialog(win, {
    title: 'Importar perfil XHANNIZER0',
    filters: [{ name: 'Perfil XHANNIZER0 (JSON)', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths?.[0]) return { canceled: true };
  try {
    const raw = fs.readFileSync(res.filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    return { ok: true, path: res.filePaths[0], data };
  } catch (err) {
    return { ok: false, error: `Archivo JSON inválido: ${err.message}` };
  }
});

// ---------- Auto-actualizador vía GitHub Releases (Xanssj/XHANNIZER0)
ipcMain.handle('xh:check-app-update', async () => {
  const currentVersion = app.getVersion();
  return new Promise((resolve) => {
    const req = https.get(
      'https://api.github.com/repos/Xanssj/XHANNIZER0/releases/latest',
      { headers: { 'User-Agent': 'XHANNIZER0/2.0 (Xhanni Studios)', Accept: 'application/vnd.github+json' }, timeout: 5000 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve({ ok: false, currentVersion, hasUpdate: false });
          return;
        }
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const latestTag = String(data.tag_name || '').replace(/^v/i, '');
            const hasUpdate = Boolean(latestTag && compareVersions(latestTag, currentVersion) > 0);
            resolve({
              ok: true,
              currentVersion,
              latestVersion: latestTag || currentVersion,
              hasUpdate,
              url: data.html_url || 'https://github.com/Xanssj/XHANNIZER0/releases',
            });
          } catch {
            resolve({ ok: false, currentVersion, hasUpdate: false });
          }
        });
      }
    );
    req.on('error', () => resolve({ ok: false, currentVersion, hasUpdate: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, currentVersion, hasUpdate: false }); });
  });
});

// ---------- Eliminar un respaldo antiguo (estrictamente limitado a BACKUP_ROOT)
ipcMain.handle('xh:delete-backup', async (_event, backupId) => {
  if (!backupId || /[\\/:*?"<>|]/.test(String(backupId))) {
    return { ok: false, error: 'ID de respaldo inválido.' };
  }
  const target = path.resolve(BACKUP_ROOT, String(backupId));
  const rootResolved = path.resolve(BACKUP_ROOT);
  if (!target.startsWith(rootResolved + path.sep)) {
    return { ok: false, error: 'Ruta de respaldo no autorizada.' };
  }
  const pendingUndo = pendingEntries(String(backupId)).length;
  if (pendingUndo > 0 && win && !win.isDestroyed()) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Eliminar de todos modos', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Eliminar respaldo — XHANNIZER0',
      message: `Este respaldo tiene ${pendingUndo} cambio(s) que todavía se pueden deshacer.`,
      detail: 'Si lo eliminas, ya no podrás revertir esos cambios desde XHANNIZER0.',
    });
    if (response !== 0) return { ok: false, canceled: true };
  }
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---------- Deshacer los cambios registrados en un respaldo (restauración real)
let restoreBusy = false;
ipcMain.handle('xh:restore-backup', async (_event, backupId) => {
  if (!backupId || /[\\/:*?"<>|]/.test(String(backupId))) {
    return { ok: false, error: 'ID de respaldo inválido.' };
  }
  if (restoreBusy) return { ok: false, error: 'Ya hay una restauración en curso.' };
  const pending = pendingEntries(String(backupId));
  if (!pending.length) return { ok: false, error: 'Este respaldo no tiene cambios pendientes por deshacer.' };

  // La confirmación vive en el proceso principal: el renderer no puede saltársela
  const shown = pending.slice(-12).reverse().map((e) => `• ${e.label}`);
  if (pending.length > 12) shown.push(`• …y ${pending.length - 12} más`);
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Deshacer cambios', 'Cancelar'],
    defaultId: 1,
    cancelId: 1,
    title: 'Deshacer cambios — XHANNIZER0',
    message: `¿Deshacer ${pending.length} cambio(s) hechos con este respaldo?`,
    detail: `${shown.join('\n')}\n\nSe revierten del más reciente al más antiguo. Algunos pasos pueden pedir permisos de administrador.`,
  });
  if (response !== 0) return { ok: false, canceled: true };

  restoreBusy = true;
  try {
    const res = await restoreBackup(String(backupId));
    for (const family of res.storeFamilies || []) {
      if (/^[A-Za-z0-9._-]+_[a-z0-9]{13}$/.test(family)) {
        await shell.openExternal(`ms-windows-store://pdp/?PFN=${encodeURIComponent(family)}`);
      }
    }
    return res;
  } finally {
    restoreBusy = false;
  }
});

// ---------- Mantenimiento: reparar Windows, actualizaciones programadas y diagnóstico
let repairBusy = false;
ipcMain.handle('xh:run-repair', async (_event, kind) => {
  const repair = maintenance.REPAIRS[kind];
  if (!repair) return { ok: false, error: 'Reparación desconocida.' };
  if (repairBusy) return { ok: false, error: 'Ya hay una reparación en curso.' };
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Iniciar', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    title: `${repair.label} — XHANNIZER0`,
    message: `¿Ejecutar ${repair.label}?`,
    detail: kind === 'wu-reset'
      ? 'Detiene los servicios de Windows Update y renombra sus carpetas de caché (se conserva una copia .old). Pide permisos de administrador.'
      : `Puede tardar hasta ${repair.timeoutMin} minutos y pide permisos de administrador. No apagues el PC mientras se ejecuta.`,
  });
  if (response !== 0) return { ok: false, canceled: true };
  repairBusy = true;
  try {
    const res = await maintenance.runRepair(kind);
    logAction('repair', { kind, ok: res.ok });
    return res;
  } finally {
    repairBusy = false;
  }
});

ipcMain.handle('xh:get-scheduled-update', async () => maintenance.getScheduledUpdate());
ipcMain.handle('xh:set-scheduled-update', async (_event, payload) => {
  const res = await maintenance.setScheduledUpdate(payload || {});
  logAction('scheduled-update', { enabled: Boolean(payload?.enabled), day: payload?.day, time: payload?.time, ok: res.ok });
  return res;
});

ipcMain.handle('xh:get-action-log', async () => ({ items: readActionLog(150) }));

ipcMain.handle('xh:export-diagnostics', async () => {
  if (!win || win.isDestroyed()) return { canceled: true };
  const stamp = new Date().toISOString().slice(0, 10);
  const res = await dialog.showSaveDialog(win, {
    title: 'Exportar diagnóstico — XHANNIZER0',
    defaultPath: path.join(app.getPath('desktop'), `XHANNIZER0-diagnostico-${stamp}.zip`),
    filters: [{ name: 'Archivo ZIP', extensions: ['zip'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const backups = listBackups().map((b) => ({ ...b, journal: pendingEntries(b.id).map((e) => ({ type: e.type, label: e.label, at: e.at })) }));
  return maintenance.exportDiagnostics({
    destFile: res.filePath,
    data: {
      'app.json': { app: 'XHANNIZER0', version: app.getVersion(), electron: process.versions.electron, os: `${require('os').release()} ${process.arch}`, portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR), createdAt: new Date().toISOString() },
      'hardware.json': getLastHardwareScan() || {},
      'chequeo-pc.json': getLastPcCheck() || {},
      'respaldos.json': backups,
      'acciones.json': readActionLog(500),
      'LEEME.txt': 'Diagnóstico generado por XHANNIZER0. Contiene el hardware detectado, el resultado del chequeo de PC, la lista de respaldos y el historial de acciones de la app. No incluye contraseñas ni archivos personales. Incluye el nombre del equipo y rutas de carpetas: revísalo antes de compartirlo.',
    },
  });
});

// ---------- Reiniciar el Explorador (para ver ajustes de Windows 11)
ipcMain.handle('xh:restart-explorer', async () => restartExplorer());

// ---------- Migrar mi PC
const KNOWN_FOLDERS = [
  { key: 'desktop', name: 'Escritorio' },
  { key: 'documents', name: 'Documentos' },
  { key: 'pictures', name: 'Imágenes' },
  { key: 'music', name: 'Música' },
  { key: 'videos', name: 'Videos' },
  { key: 'downloads', name: 'Descargas' },
];
const knownFolderPath = (key) => {
  if (!KNOWN_FOLDERS.some((f) => f.key === key)) return null;
  try {
    return app.getPath(key);
  } catch {
    return null;
  }
};
let migrationBusy = false;
const sendMigrationProgress = (p) => {
  if (win && !win.isDestroyed()) win.webContents.send('xh:migration-progress', p);
};

ipcMain.handle('xh:migration-folders', async () => ({
  folders: KNOWN_FOLDERS.map((f) => ({ ...f, path: knownFolderPath(f.key) })).filter((f) => f.path && fs.existsSync(f.path)),
}));

ipcMain.handle('xh:migration-measure', async (_event, folderPath) => {
  if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath) || !fs.existsSync(folderPath)) return { ok: false };
  return { ok: true, ...(await migration.measureFolder(folderPath)) };
});

ipcMain.handle('xh:migration-export', async (_event, payload) => {
  if (migrationBusy) return { ok: false, error: 'Ya hay una migración en curso.' };
  const folders = (Array.isArray(payload?.folders) ? payload.folders : [])
    .map((f) => {
      if (f?.key) {
        const known = KNOWN_FOLDERS.find((k) => k.key === f.key);
        return known ? { key: known.key, name: known.name, path: knownFolderPath(known.key) } : null;
      }
      return typeof f?.path === 'string' && path.isAbsolute(f.path) ? { name: path.basename(f.path), path: f.path } : null;
    })
    .filter((f) => f && f.path && fs.existsSync(f.path));
  // Ajustes que ya tienes aplicados en este PC: se proponen para el PC nuevo
  const audit = await scanWindowsSettings(getLastHardwareScan()?.system || null);
  const settingIds = (audit.items || []).filter((i) => i.isOptimal && i.id !== 'win-refresh-rate').map((i) => i.id);
  const catalog = await getCatalogWithStatusAsync();
  migrationBusy = true;
  try {
    return await migration.exportMigration({
      destDir: payload?.destDir,
      folders,
      settingIds,
      catalog,
      profile: payload?.profile || null,
      onProgress: sendMigrationProgress,
    });
  } finally {
    migrationBusy = false;
  }
});

ipcMain.handle('xh:migration-open', async () => {
  if (!win || win.isDestroyed()) return { canceled: true };
  const res = await dialog.showOpenDialog(win, {
    title: 'Abrir migración XHANNIZER0',
    filters: [{ name: 'Migración XHANNIZER0', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths?.[0]) return { canceled: true };
  const mig = migration.readMigration(res.filePaths[0]);
  if (!mig.ok) return mig;
  const catalog = await getCatalogWithStatusAsync();
  const installedIds = new Set(catalog.filter((c) => c.installed && c.wingetId).map((c) => c.wingetId.toLowerCase()));
  return {
    ...mig,
    packages: mig.packages.map((p) => ({ ...p, installed: installedIds.has(p.wingetId.toLowerCase()) })),
  };
});

ipcMain.handle('xh:migration-restore-folders', async (_event, payload) => {
  if (migrationBusy) return { ok: false, error: 'Ya hay una migración en curso.' };
  migrationBusy = true;
  try {
    return await migration.restoreFolders({
      manifestPath: payload?.manifestPath,
      folderIds: Array.isArray(payload?.folderIds) ? payload.folderIds.map(String) : [],
      resolveKnown: knownFolderPath,
      onProgress: sendMigrationProgress,
    });
  } finally {
    migrationBusy = false;
  }
});

// ---------- Crear Kit USB Post-Formateo (script offline + manifiesto)
ipcMain.handle('xh:create-usb-kit', async (_event, payload) => {
  const destBase = payload?.destDir;
  const wingetIds = Array.isArray(payload?.wingetIds) ? payload.wingetIds.filter(Boolean) : [];
  if (!destBase) return { ok: false, error: 'Selecciona una carpeta o unidad USB de destino.' };

  const kitDir = path.join(destBase, 'XHANNIZER0_USB_Kit');
  fs.mkdirSync(kitDir, { recursive: true });

  const list = wingetIds.length
    ? wingetIds
    : ['Brave.Brave', '7zip.7zip', 'Microsoft.VCRedist.2015+.x64', 'REALiX.HWiNFO', 'Valve.Steam'];

  const psContent = [
    '# XHANNIZER0 — Kit Post-Formateo USB (Xhanni Studios)',
    '# Ejecuta este script en PowerShell tras formatear Windows para instalar tu seleccion en lote.',
    '$packages = @(',
    ...list.map((id) => `  '${String(id).replace(/'/g, '')}'`),
    ')',
    'foreach ($pkg in $packages) {',
    '  Write-Host "Instalando $pkg..." -ForegroundColor Cyan',
    '  winget install --id $pkg --exact --silent --accept-package-agreements --accept-source-agreements',
    '}',
    'Write-Host "Kit XHANNIZER0 completado." -ForegroundColor Green',
    'Pause',
  ].join('\r\n');

  fs.writeFileSync(path.join(kitDir, 'instalar-kit-xhannizer0.ps1'), psContent, 'utf8');
  fs.writeFileSync(
    path.join(kitDir, 'kit-manifest.json'),
    JSON.stringify({ app: 'XHANNIZER0', studio: 'Xhanni Studios', createdAt: new Date().toISOString(), packages: list }, null, 2),
    'utf8'
  );
  return { ok: true, kitDir, count: list.length };
});

app.on('second-instance', () => {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

// ---------- Catálogo remoto (correcciones sin publicar una versión nueva)
const CATALOG_OVERRIDES_URL = 'https://raw.githubusercontent.com/Xanssj/XHANNIZER0/main/catalog-overrides.json';
const catalogCacheFile = () => path.join(app.getPath('userData'), 'catalog-overrides.json');

function loadCachedCatalogOverrides() {
  try {
    setCatalogOverrides(JSON.parse(fs.readFileSync(catalogCacheFile(), 'utf8')));
  } catch {
    // Sin caché todavía: se usa el catálogo incluido en la app
  }
}

function refreshRemoteCatalog() {
  const req = https.get(CATALOG_OVERRIDES_URL, { headers: { 'User-Agent': 'XHANNIZER0' }, timeout: 6000 }, (res) => {
    if (res.statusCode !== 200) {
      res.resume();
      return;
    }
    let raw = '';
    res.setEncoding('utf8');
    res.on('data', (c) => {
      raw += c;
      if (raw.length > 512 * 1024) req.destroy(); // Un catálogo de correcciones nunca debería pesar tanto
    });
    res.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (data?.format !== 1) return;
        setCatalogOverrides(data);
        fs.writeFileSync(catalogCacheFile(), JSON.stringify(data), 'utf8');
      } catch {
        // JSON inválido: se mantiene la versión anterior
      }
    });
  });
  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
}

app.whenReady().then(() => {
  loadCachedCatalogOverrides();
  refreshRemoteCatalog();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
