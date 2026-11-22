'use strict';

// Historial local de todo lo que XHANNIZER0 hace en el sistema (una línea JSON por acción).
// Sirve al usuario para saber qué cambió y para el diagnóstico de soporte.
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;
let logFile = null;

function initActionLog(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // Si no se puede crear, logAction fallará en silencio
  }
  logFile = path.join(dir, 'xhannizer0-acciones.log');
}

function logAction(action, detail = {}) {
  if (!logFile) return;
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_BYTES) {
      fs.renameSync(logFile, `${logFile}.1`);
    }
    const line = JSON.stringify({ at: new Date().toISOString(), action, ...detail });
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  } catch {
    // El historial nunca debe impedir una acción
  }
}

function readActionLog(limit = 200) {
  if (!logFile || !fs.existsSync(logFile)) return [];
  try {
    return fs
      .readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}

function getActionLogPath() {
  return logFile;
}

module.exports = { initActionLog, logAction, readActionLog, getActionLogPath };
