'use strict';

// Guardas de seguridad del proceso principal, extraídas para poder validarse con pruebas unitarias.
const path = require('path');
const { pathToFileURL } = require('url');

const LOCAL_DRIVE_PATH_RE = /^[A-Za-z]:\\/;

function normalizeWinPath(p) {
  if (!p || typeof p !== 'string') return '';
  return path.resolve(p).toLowerCase();
}

// Permite navegar únicamente al archivo `index.html` exacto de la aplicación (bloquea cualquier otro file:// o UNC).
function isAllowedRendererNavigation(targetUrl, indexHtmlPath) {
  if (!targetUrl || typeof targetUrl !== 'string' || !indexHtmlPath) return false;
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'file:') return false;
    if (parsed.hostname && parsed.hostname.toLowerCase() !== 'localhost') return false;
    const expected = pathToFileURL(path.resolve(indexHtmlPath));
    const normTarget = decodeURIComponent(parsed.pathname).toLowerCase();
    const normExpected = decodeURIComponent(expected.pathname).toLowerCase();
    return normTarget === normExpected;
  } catch {
    return false;
  }
}

// Registro de ejecutables verificados por el proceso principal (catálogo + apps de hardware + recién instalados).
function createAllowedExeRegistry() {
  const allowed = new Set();
  const add = (exePath) => {
    if (!exePath || typeof exePath !== 'string') return false;
    const resolved = path.resolve(exePath);
    if (!LOCAL_DRIVE_PATH_RE.test(resolved) || !/\.exe$/i.test(resolved)) return false;
    allowed.add(resolved.toLowerCase());
    return true;
  };
  const has = (exePath) => {
    const key = normalizeWinPath(exePath);
    return Boolean(key && allowed.has(key));
  };
  const clear = () => allowed.clear();
  return { add, has, clear, size: () => allowed.size };
}

// Confirmación nativa fail-closed: si la ventana ya no existe o se destruyó, siempre cancela.
async function confirmOrFailClosed(win, showMessageBox, options) {
  if (!win || typeof win.isDestroyed !== 'function' || win.isDestroyed()) {
    return { confirmed: false, response: -1, canceled: true };
  }
  const res = await showMessageBox(win, options);
  const response = typeof res?.response === 'number' ? res.response : -1;
  return { confirmed: response === 0, response, canceled: response !== 0 };
}

// Valida carpeta de destino en unidad local sin rutas críticas de Windows.
function isSafeDestinationDir(destDir, isProtectedSystemDir) {
  if (!destDir || typeof destDir !== 'string') return false;
  const resolved = path.resolve(destDir);
  if (!LOCAL_DRIVE_PATH_RE.test(resolved)) return false;
  if (typeof isProtectedSystemDir === 'function' && isProtectedSystemDir(resolved)) return false;
  return true;
}

// Valida estrictamente HTTPS + host exacto permitido (sirve para URL inicial y URL final tras redirección).
function isStrictHttpsHostUrl(rawUrl, allowedHost) {
  if (!rawUrl || typeof rawUrl !== 'string' || !allowedHost) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === String(allowedHost).toLowerCase();
  } catch {
    return false;
  }
}

module.exports = {
  LOCAL_DRIVE_PATH_RE,
  isAllowedRendererNavigation,
  createAllowedExeRegistry,
  confirmOrFailClosed,
  isSafeDestinationDir,
  isStrictHttpsHostUrl,
};
