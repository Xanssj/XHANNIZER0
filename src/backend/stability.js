'use strict';

// Prueba de estabilidad rápida (tras activar XMP/EXPO): llena una parte de la RAM con patrones,
// los verifica una y otra vez desde todos los núcleos, y al final revisa si Windows registró
// errores de hardware (WHEA). No reemplaza a MemTest86 / TestMem5, pero detecta lo grueso.
const os = require('os');
const { Worker } = require('worker_threads');
const { runPowerShell } = require('./powershell');

// Código del hilo: se pasa como texto (eval) para que funcione también dentro del .asar
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const { megabytes, durationMs, seed } = workerData;
const CHUNK = 16 * 1024 * 1024;
const chunks = [];
try {
  for (let mb = 0; mb < megabytes; mb += 16) chunks.push(new Uint32Array(CHUNK / 4));
} catch (e) {
  // Si no hay tanta memoria libre, se prueba con lo que se pudo reservar
}
let errors = 0;
let passes = 0;
let bytesVerified = 0;
const end = Date.now() + durationMs;
const patterns = [0x55555555, 0xAAAAAAAA, 0x00000000, 0xFFFFFFFF, -1];
while (Date.now() < end && chunks.length) {
  for (const p of patterns) {
    let x = (seed + passes * 2654435761) >>> 0;
    for (const arr of chunks) {
      if (p === -1) {
        for (let i = 0; i < arr.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; arr[i] = x >>> 0; }
      } else arr.fill(p >>> 0);
    }
    x = (seed + passes * 2654435761) >>> 0;
    for (const arr of chunks) {
      if (p === -1) {
        for (let i = 0; i < arr.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; if (arr[i] !== (x >>> 0)) errors++; }
      } else {
        const v = p >>> 0;
        for (let i = 0; i < arr.length; i++) if (arr[i] !== v) errors++;
      }
      bytesVerified += arr.byteLength;
    }
    if (Date.now() >= end) break;
  }
  passes++;
  parentPort.postMessage({ type: 'progress', passes, errors, bytesVerified });
}
parentPort.postMessage({ type: 'done', passes, errors, bytesVerified, reservedMb: chunks.length * 16 });
`;

let current = null;

async function wheaErrorsSince(sinceIso) {
  const r = await runPowerShell(
    `$s = [datetime]::Parse('${new Date(sinceIso).toISOString()}').ToLocalTime()
@(Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WHEA-Logger'; StartTime = $s } -ErrorAction SilentlyContinue).Count`,
    20000
  );
  return Number(r.stdout) || 0;
}

// minutes: 1..60. memoryPercent: % de la RAM libre que se prueba (máx. 70).
function runStabilityTest({ minutes = 5, memoryPercent = 50, onProgress = () => {} } = {}) {
  if (current) return Promise.resolve({ ok: false, error: 'Ya hay una prueba en curso.' });
  const durationMs = Math.max(0.05, Math.min(60, Number(minutes) || 5)) * 60 * 1000;
  const threads = Math.max(1, os.cpus().length);
  const testMb = Math.floor((os.freemem() / (1024 * 1024)) * (Math.max(5, Math.min(70, Number(memoryPercent) || 50)) / 100));
  const perThread = Math.max(16, Math.floor(testMb / threads / 16) * 16);
  const startedAt = new Date().toISOString();
  const started = Date.now();

  return new Promise((resolve) => {
    const workers = [];
    const stats = new Map();
    let finished = 0;
    let stopped = false;
    const timer = setInterval(() => {
      const agg = [...stats.values()].reduce((a, s) => ({ errors: a.errors + s.errors, bytes: a.bytes + s.bytesVerified }), { errors: 0, bytes: 0 });
      onProgress({
        percent: Math.min(99, Math.round(((Date.now() - started) / durationMs) * 100)),
        errors: agg.errors,
        gbVerified: Math.round(agg.bytes / 1024 ** 3),
        step: `Probando ${Math.round((perThread * threads) / 1024 * 10) / 10} GB de RAM en ${threads} hilos…`,
      });
    }, 1000);

    const finish = async () => {
      clearInterval(timer);
      current = null;
      const all = [...stats.values()];
      const errors = all.reduce((s, x) => s + x.errors, 0);
      const reservedMb = all.reduce((s, x) => s + (x.reservedMb || 0), 0);
      const whea = await wheaErrorsSince(startedAt);
      const stable = errors === 0 && whea === 0;
      onProgress({ percent: 100, errors, step: 'Prueba terminada.' });
      resolve({
        ok: true,
        stopped,
        stable,
        errors,
        wheaErrors: whea,
        threads,
        testedGb: Math.round((reservedMb / 1024) * 10) / 10,
        gbVerified: Math.round(all.reduce((s, x) => s + x.bytesVerified, 0) / 1024 ** 3),
        minutes: Math.round(((Date.now() - started) / 60000) * 10) / 10,
        verdict: stable
          ? stopped ? 'Sin errores hasta que la detuviste. Para estar seguro, déjala correr al menos 10 minutos.' : 'Sin errores: tu RAM y CPU se ven estables con la configuración actual.'
          : errors > 0
            ? `Se detectaron ${errors} errores de memoria: el perfil XMP/EXPO no es estable. Baja la frecuencia un paso o sube un poco el voltaje de la RAM (DRAM Voltage / VDD).`
            : `Windows registró ${whea} error(es) de hardware (WHEA) durante la prueba: revisa el perfil de la RAM o el overclock.`,
      });
    };

    for (let i = 0; i < threads; i += 1) {
      const w = new Worker(WORKER_SOURCE, { eval: true, workerData: { megabytes: perThread, durationMs, seed: (Date.now() + i * 7919) >>> 0 } });
      stats.set(i, { errors: 0, bytesVerified: 0 });
      w.on('message', (m) => stats.set(i, { ...stats.get(i), ...m }));
      w.on('error', () => {});
      w.on('exit', () => {
        finished += 1;
        if (finished === threads) finish();
      });
      workers.push(w);
    }
    current = {
      stop: () => {
        stopped = true;
        workers.forEach((w) => w.terminate());
      },
    };
  });
}

function stopStabilityTest() {
  if (!current) return { ok: false };
  current.stop();
  return { ok: true };
}

module.exports = { runStabilityTest, stopStabilityTest, wheaErrorsSince, WORKER_SOURCE };
