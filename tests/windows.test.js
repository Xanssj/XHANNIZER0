'use strict';

// Pruebas que tocan el registro de Windows, solo bajo HKCU\Software\XhzTestSuite (se borra al final).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const isWin = process.platform === 'win32';
const KEY = 'HKCU:\\Software\\XhzTestSuite';
// `exit 0`: un -ErrorAction SilentlyContinue al final haría salir a PowerShell con código 1
const ps = (s) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `${s}; exit 0`], { encoding: 'utf8' }).trim();

test('deshacer: restaura valores del registro y borra las claves que no existían', { skip: !isWin }, async () => {
  const { _internals: I } = require(path.join(__dirname, '..', 'src', 'backend', 'restore.js'));
  try {
    ps(`New-Item -Path '${KEY}' -Force | Out-Null; Set-ItemProperty '${KEY}' -Name A -Value 5 -Type DWord; Set-ItemProperty '${KEY}' -Name S -Value "it's" -Type String`);
    const snap = await I.captureRegistry(['A', 'S', 'M'].map((name) => ({ path: KEY, name })));
    assert.deepStrictEqual(snap.map((s) => s.existed), [true, true, false]);
    ps(`Set-ItemProperty '${KEY}' -Name A -Value 9 -Type DWord; Set-ItemProperty '${KEY}' -Name S -Value x; Set-ItemProperty '${KEY}' -Name M -Value 1 -Type DWord`);
    assert.strictEqual((await I.restoreRegistry(snap)).ok, true);
    const after = JSON.parse(ps(`$i = Get-Item '${KEY}'; @{ A = $i.GetValue('A'); S = $i.GetValue('S'); hasM = ($i.GetValueNames() -contains 'M') } | ConvertTo-Json -Compress`));
    assert.deepStrictEqual(after, { A: 5, S: "it's", hasM: false });

    const sub = `${KEY}\\Nueva`;
    const keys = await I.captureKeys([sub]);
    ps(`New-Item -Path '${sub}' -Force | Out-Null; Set-Item -Path '${sub}' -Value ''`);
    assert.strictEqual((await I.restoreKeys(keys)).ok, true);
    assert.strictEqual(ps(`Test-Path '${sub}'`), 'False');
  } finally {
    ps(`Remove-Item -Path '${KEY}' -Recurse -Force -ErrorAction SilentlyContinue`);
  }
});

test('powershell: psData no permite inyectar comandos', { skip: !isWin }, async () => {
  const { runPowerShell, psData } = require(path.join(__dirname, '..', 'src', 'backend', 'powershell.js'));
  const evil = "'; Write-Output INYECTADO; '";
  const r = await runPowerShell(psData(evil), 15000);
  assert.strictEqual(r.stdout, evil);
});

test('seguridad: cleanup emptyDir nunca sigue junctions de Windows hacia fuera de la carpeta', { skip: !isWin }, async () => {
  const fs = require('fs');
  const os = require('os');
  const { emptyDir } = require(path.join(__dirname, '..', 'src', 'backend', 'cleanup.js'));
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-junc-test-'));
  const victim = path.join(base, 'victim');
  const tempDir = path.join(base, 'temp');
  const linkDir = path.join(tempDir, 'enlace-malicioso');
  const victimFile = path.join(victim, 'intacto.txt');
  const normalFile = path.join(tempDir, 'borrar.tmp');
  try {
    fs.mkdirSync(victim, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(victimFile, 'no-borrar', 'utf8');
    fs.writeFileSync(normalFile, 'temporal', 'utf8');
    execFileSync('cmd.exe', ['/c', 'mklink', '/J', linkDir, victim], { windowsHide: true });

    await emptyDir(tempDir);

    assert.strictEqual(fs.existsSync(normalFile), false);
    assert.strictEqual(fs.existsSync(victimFile), true);
    assert.strictEqual(fs.readFileSync(victimFile, 'utf8'), 'no-borrar');
  } finally {
    try { fs.unlinkSync(linkDir); } catch {}
    fs.rmSync(base, { recursive: true, force: true });
  }
});
