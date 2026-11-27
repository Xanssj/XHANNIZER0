'use strict';

// Actualización automática de XHANNIZER0 desde GitHub Releases (latest.yml + instalador NSIS).
// La versión instalada descarga la nueva en segundo plano y se actualiza al reiniciar,
// sin que el usuario tenga que volver a bajar ni ejecutar el .exe.
// La versión portable no puede reemplazarse a sí misma: solo avisa y abre la descarga.

const { app } = require('electron');

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const PORTABLE_DOWNLOAD = 'https://xhannistudios.org/xhannizer0/descargar/portable';

let updater = null;
let send = () => {};
let state = { state: 'idle', currentVersion: null };
let timer = null;

function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function setState(next) {
  state = { ...state, ...next, currentVersion: app.getVersion() };
  send(state);
}

function getUpdater() {
  if (updater) return updater;
  // Se carga aquí para no costar tiempo de arranque cuando no se usa (desarrollo / portable).
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.autoDownload = true;
  // Sin certificado comercial de firma de código, nunca instalamos silenciosamente al cerrar:
  // la actualización se aplica solo cuando el usuario hace clic explícito en «Reiniciar y actualizar».
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.logger = null;
  updater.on('checking-for-update', () => setState({ state: 'checking' }));
  updater.on('update-not-available', () => setState({ state: 'none' }));
  updater.on('update-available', (info) => setState({ state: 'downloading', version: info?.version || null, percent: 0 }));
  updater.on('download-progress', (p) => setState({ state: 'downloading', percent: Math.round(p?.percent || 0) }));
  updater.on('update-downloaded', (info) => setState({ state: 'ready', version: info?.version || state.version, percent: 100 }));
  updater.on('error', (err) => setState({ state: 'error', error: String(err?.message || err).slice(0, 200) }));
  return updater;
}

// Para la portable (y como respaldo) se compara con la última versión de GitHub.
async function checkPortable(checkLatest) {
  setState({ state: 'checking' });
  const res = await checkLatest();
  if (res?.hasUpdate) setState({ state: 'portable', version: res.latestVersion, url: PORTABLE_DOWNLOAD });
  else setState({ state: res?.ok ? 'none' : 'error' });
}

async function checkNow(checkLatest) {
  if (!app.isPackaged) {
    setState({ state: 'dev' });
    return state;
  }
  if (isPortable()) {
    await checkPortable(checkLatest);
    return state;
  }
  if (state.state === 'checking' || state.state === 'downloading' || state.state === 'ready') return state;
  try {
    await getUpdater().checkForUpdates();
  } catch (err) {
    setState({ state: 'error', error: String(err?.message || err).slice(0, 200) });
  }
  return state;
}

function init({ onState, checkLatest }) {
  send = onState;
  state.currentVersion = app.getVersion();
  // Primera revisión unos segundos después de abrir, para no competir con el escaneo inicial.
  const initTimer = setTimeout(() => checkNow(checkLatest), 8000);
  initTimer.unref?.();
  timer = setInterval(() => checkNow(checkLatest), CHECK_EVERY_MS);
  timer.unref?.();
}

function installNow() {
  if (state.state !== 'ready' || !updater) return { ok: false, error: 'La actualización todavía no está descargada.' };
  // Instalación silenciosa en la misma carpeta y vuelve a abrir la app al terminar.
  setImmediate(() => updater.quitAndInstall(true, true));
  return { ok: true };
}

module.exports = { init, checkNow, installNow, getState: () => state, isPortable };
