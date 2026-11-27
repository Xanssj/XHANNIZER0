'use strict';

// Piloto automático post-formateo: guarda en disco en qué paso va, y si hace falta reiniciar
// deja una entrada RunOnce para que XHANNIZER0 se abra solo y siga donde quedó.
const fs = require('fs');
const path = require('path');
const { runPowerShell, psData } = require('./powershell');

const RUNONCE_KEY = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce';
const RUNONCE_NAME = 'XHANNIZER0PilotoAutomatico';
const RESUME_FLAG = '--piloto-continuar';
const STEP_IDS = ['baseline', 'restore-point', 'backup', 'drivers', 'runtimes', 'apps', 'settings', 'win11', 'cleanup', 'pccheck', 'after'];

let stateFile = null;
function initAutopilot(dir) {
  stateFile = path.join(dir, 'piloto-automatico.json');
}

function readAutopilot() {
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

// Solo se guardan campos conocidos: el estado viene de la interfaz
function saveAutopilot(raw) {
  if (!stateFile) return { ok: false };
  if (!raw) {
    fs.rmSync(stateFile, { force: true });
    return { ok: true };
  }
  const clean = {
    status: ['running', 'awaiting-reboot', 'done', 'stopped'].includes(raw.status) ? raw.status : 'running',
    startedAt: String(raw.startedAt || new Date().toISOString()),
    backupId: raw.backupId ? String(raw.backupId).slice(0, 80) : null,
    steps: (Array.isArray(raw.steps) ? raw.steps : [])
      .filter((s) => STEP_IDS.includes(s?.id))
      .map((s) => ({
        id: s.id,
        enabled: Boolean(s.enabled),
        status: ['pending', 'running', 'done', 'skipped', 'failed'].includes(s.status) ? s.status : 'pending',
        note: String(s.note || '').slice(0, 300),
      })),
    appIds: (Array.isArray(raw.appIds) ? raw.appIds : []).map(String).filter((s) => /^[a-z0-9][a-z0-9._+-]{0,79}$/i.test(s)).slice(0, 400),
    settingIds: (Array.isArray(raw.settingIds) ? raw.settingIds : []).map(String).filter((s) => /^[a-z0-9][a-z0-9._+-]{0,79}$/i.test(s)).slice(0, 80),
    cleanupIds: (Array.isArray(raw.cleanupIds) ? raw.cleanupIds : []).map(String).filter((s) => /^[a-z-]{3,30}$/.test(s)).slice(0, 10),
  };
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(clean, null, 2), 'utf8');
  return { ok: true, state: clean };
}

// Comando que reabre la app: en la versión instalada es el .exe; en desarrollo, electron + carpeta
function relaunchCommand({ execPath, appPath, isPackaged, portableExe }) {
  const q = (s) => `"${String(s).replace(/"/g, '')}"`;
  if (portableExe) return `${q(portableExe)} ${RESUME_FLAG}`;
  if (isPackaged) return `${q(execPath)} ${RESUME_FLAG}`;
  return `${q(execPath)} ${q(appPath)} ${RESUME_FLAG}`;
}

async function scheduleResumeAndReboot(launch) {
  const cmd = relaunchCommand(launch);
  const r = await runPowerShell(
    `New-ItemProperty -Path '${RUNONCE_KEY}' -Name '${RUNONCE_NAME}' -Value ${psData(cmd)} -PropertyType String -Force | Out-Null
shutdown.exe /r /t 15 /c "XHANNIZER0: reiniciando para continuar el piloto automático"
exit $LASTEXITCODE`,
    20000
  );
  return r.ok
    ? { ok: true, message: 'El PC se reiniciará en 15 segundos y XHANNIZER0 seguirá solo.' }
    : { ok: false, error: 'No se pudo programar el reinicio.' };
}

async function cancelResume() {
  await runPowerShell(`Remove-ItemProperty -Path '${RUNONCE_KEY}' -Name '${RUNONCE_NAME}' -ErrorAction SilentlyContinue; shutdown.exe /a 2>$null; exit 0`, 15000);
  return { ok: true };
}

module.exports = { initAutopilot, readAutopilot, saveAutopilot, scheduleResumeAndReboot, cancelResume, relaunchCommand, RESUME_FLAG, STEP_IDS };
