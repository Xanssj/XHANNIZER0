'use strict';

// Pruebas unitarias sin efectos en el sistema (salvo carpetas temporales propias).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const backend = (m) => require(path.join(__dirname, '..', 'src', 'backend', m));

test('compareVersions entiende semver y sufijos', () => {
  const { compareVersions } = backend('semver');
  assert.strictEqual(compareVersions('2.0.10', '2.0.9'), 1);
  assert.strictEqual(compareVersions('v2.1.0', '2.1.0'), 0);
  assert.strictEqual(compareVersions('2.1.0-beta', '2.1.0'), -1);
  assert.strictEqual(compareVersions('2.1.0-beta.2', '2.1.0-beta.10'), -1);
  assert.strictEqual(compareVersions('3', '2.9.9'), 1);
});

test('código de perfil: ida y vuelta, y rechaza basura', () => {
  const { encodeProfileCode, decodeProfileCode } = backend('profileCode');
  const enc = encodeProfileCode({ name: 'PC Gamer', appIds: ['brave', 'steam', 'bad id!', 'steam'], settingIds: ['win-game-mode'] });
  assert.ok(enc.ok);
  assert.match(enc.code, /^XHZ1-[A-Za-z0-9_-]+$/);
  const dec = decodeProfileCode(`  ${enc.code}\n`);
  assert.deepStrictEqual(dec, { ok: true, name: 'PC Gamer', appIds: ['brave', 'steam'], settingIds: ['win-game-mode'] });
  assert.strictEqual(decodeProfileCode('hola').ok, false);
  assert.strictEqual(decodeProfileCode('XHZ1-!!!').ok, false);
  assert.strictEqual(decodeProfileCode(`XHZ1-${Buffer.from('no comprimido').toString('base64url')}`).ok, false);
  assert.strictEqual(encodeProfileCode({}).ok, false);
});

test('código de perfil: no infla bombas de compresión', () => {
  const zlib = require('zlib');
  const { decodeProfileCode } = backend('profileCode');
  const bomb = zlib.deflateRawSync(Buffer.alloc(5 * 1024 * 1024, 0x20)).toString('base64url');
  assert.strictEqual(decodeProfileCode(`XHZ1-${bomb}`).ok, false);
});

test('ratedSpeedFromPart reconoce marcas comunes', () => {
  const { ratedSpeedFromPart } = backend('pcCheck')._internals;
  const parts = {
    KF552C40BBK2: 5200, KF432C16BB: 3200, KHX3200C16D4: 3200, KVR32N22S8: 3200,
    'F5-6000J3038F16G': 6000, 'F4-3600C16D-32GTZN': 3600, CMK32GX4M2E3200C16: 3200,
    CMH32GX5M2B6000C30: 6000, BL16G36C16U4B: 3600, TF3D416G3600HC18J: 3600, 'M378A1K43EB2-CWE': null,
  };
  for (const [p, want] of Object.entries(parts)) assert.strictEqual(ratedSpeedFromPart(p), want, p);
});

test('analyze detecta los errores típicos de armado', () => {
  const { analyze } = backend('pcCheck')._internals;
  const a = analyze({
    ram: [{ capacity: 8 * 1024 ** 3, configured: 2133, speed: 2133, type: 26, part: 'F4-3600C16D', slot: 'DIMM_A1', bank: '' }],
    gpus: [{ name: 'NVIDIA GeForce RTX 4070', res: null }, { name: 'Intel(R) UHD Graphics 770', res: 1920 }],
    pci: [{ name: 'NVMe', cls: 'SCSIAdapter', id: 'x', curSpeed: 3, maxSpeed: 4, curWidth: 4, maxWidth: 4 }],
    secureBoot: 0, firmware: 'Legacy', tpm: '', virt: false, hyperv: false,
    problems: [{ name: 'Controlador PCI', id: 'PCI\\VEN_1', code: 28 }],
  });
  const st = Object.fromEntries(a.checks.map((c) => [c.id, c.status]));
  assert.strictEqual(st['ram-xmp'], 'warn');
  assert.strictEqual(st['ram-channel'], 'warn');
  assert.strictEqual(st['display-port'], 'warn');
  assert.strictEqual(st.firmware, 'warn');
  assert.strictEqual(st.secureboot, 'warn');
  assert.strictEqual(a.devices[0].problem, 'Sin driver instalado');
});

test('catálogo remoto: solo acepta cambios seguros', () => {
  const { validateOverrides, CATALOG } = backend('catalog');
  const withDownload = CATALOG.find((c) => c.downloadUrl);
  const clean = validateOverrides({
    format: 1,
    items: {
      [CATALOG[0].id]: { wingetId: 'Mal ID con espacios', officialUrl: 'http://inseguro.example' },
      ...(withDownload ? { [withDownload.id]: { downloadUrl: 'https://otro-host.example/malware.exe' } } : {}),
      'no-existe': { hidden: true },
    },
    added: [{ id: 'x', name: 'X', section: 'utilidades', wingetId: 'rm -rf' }],
  });
  assert.deepStrictEqual(clean.items, {});
  assert.deepStrictEqual(clean.added, []);
  assert.deepStrictEqual(validateOverrides({ format: 2, items: {} }), { items: {}, added: [] });
});

test('asistente de BIOS: marca y temas según el chequeo', () => {
  const { getBiosGuide, brandFromManufacturer } = backend('bios');
  assert.strictEqual(brandFromManufacturer('ASUSTeK COMPUTER INC.'), 'asus');
  assert.strictEqual(brandFromManufacturer('Micro-Star International Co., Ltd.'), 'msi');
  assert.strictEqual(brandFromManufacturer('Gigabyte Technology Co., Ltd.'), 'gigabyte');
  assert.strictEqual(brandFromManufacturer('ASRock'), 'asrock');
  assert.strictEqual(brandFromManufacturer('Dell Inc.'), 'generic');
  const g = getBiosGuide({
    manufacturer: 'Micro-Star International',
    product: 'B650 TOMAHAWK',
    checks: [{ id: 'ram-xmp', status: 'warn' }, { id: 'rebar', status: 'warn' }, { id: 'tpm', status: 'ok' }],
  });
  assert.deepStrictEqual(g.sections.map((s) => s.id), ['ram-xmp', 'rebar']);
  assert.strictEqual(g.brand, 'MSI');
  assert.strictEqual(getBiosGuide({}).sections.length, 5);
});

test('antes y después: compara bien y respeta la dirección de cada métrica', () => {
  const { compareSnapshots } = backend('benchmark');
  const cmp = compareSnapshots(
    { ramUsedMb: 4096, processes: 200, diskFreeGb: 100, bootMs: 30000, startupEnabled: 12, cpuIdlePct: 5, services: 120 },
    { ramUsedMb: 3072, processes: 150, diskFreeGb: 130, bootMs: null, startupEnabled: 12, cpuIdlePct: 2, services: 110 }
  );
  const by = Object.fromEntries(cmp.map((m) => [m.key, m]));
  assert.strictEqual(by.bootMs, undefined); // sin dato "después": no se compara
  assert.deepStrictEqual([by.ramUsedMb.before, by.ramUsedMb.after, by.ramUsedMb.improved], [4, 3, true]);
  assert.strictEqual(by.processes.changePct, -25);
  assert.strictEqual(by.diskFreeGb.improved, true);
  assert.strictEqual(by.startupEnabled.same, true);
});

test('informe: escapa todo lo que escribe el usuario', () => {
  const { buildReportHtml } = backend('report');
  const html = buildReportHtml({
    client: '<img src=x onerror=alert(1)>',
    notes: '"><script>alert(1)</script>',
    actions: [{ at: new Date().toISOString(), action: 'install', items: [{ name: '<b>App</b>', ok: true }] }],
  });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;b&gt;App&lt;/b&gt;'));
});

test('piloto automático: guarda solo campos válidos y arma el comando de reinicio', () => {
  const ap = backend('autopilot');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-ap-'));
  try {
    ap.initAutopilot(dir);
    const res = ap.saveAutopilot({
      status: 'hack',
      backupId: 'b1',
      steps: [{ id: 'drivers', enabled: 1, status: 'done' }, { id: 'rm-rf', enabled: true }],
      appIds: ['brave', '$(evil)'],
      extra: 'x',
    });
    assert.strictEqual(res.state.status, 'running');
    assert.deepStrictEqual(res.state.steps, [{ id: 'drivers', enabled: true, status: 'done', note: '' }]);
    assert.deepStrictEqual(res.state.appIds, ['brave']);
    assert.strictEqual(ap.readAutopilot().extra, undefined);
    ap.saveAutopilot(null);
    assert.strictEqual(ap.readAutopilot(), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.strictEqual(ap.relaunchCommand({ execPath: 'C:\\X\\XHANNIZER0.exe', isPackaged: true }), `"C:\\X\\XHANNIZER0.exe" ${ap.RESUME_FLAG}`);
  assert.strictEqual(ap.relaunchCommand({ execPath: 'C:\\e.exe', appPath: 'C:\\app', isPackaged: false }), `"C:\\e.exe" "C:\\app" ${ap.RESUME_FLAG}`);
  assert.strictEqual(ap.relaunchCommand({ portableExe: 'E:\\XHANNIZER0-Portable.exe' }), `"E:\\XHANNIZER0-Portable.exe" ${ap.RESUME_FLAG}`);
});

test('limpieza: mide y vacía carpetas sin borrar la carpeta raíz', async () => {
  const { measureDir, emptyDir } = backend('cleanup');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-clean-'));
  try {
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'a.tmp'), 'x'.repeat(1000));
    fs.writeFileSync(path.join(dir, 'sub', 'b.tmp'), 'y'.repeat(500));
    assert.deepStrictEqual(await measureDir(dir), { bytes: 1500, files: 2 });
    const r = await emptyDir(dir);
    assert.strictEqual(r.freed, 1500);
    assert.ok(fs.existsSync(dir));
    assert.deepStrictEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('migración: ignora rutas fuera de la carpeta y nunca sobrescribe', async () => {
  const migration = backend('migration');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-mig-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-mig-dest-'));
  try {
    fs.mkdirSync(path.join(base, 'Archivos', 'f1'), { recursive: true });
    fs.writeFileSync(path.join(base, 'Archivos', 'f1', 'nuevo.txt'), 'nuevo');
    fs.writeFileSync(path.join(base, 'Archivos', 'f1', 'existe.txt'), 'de la migración');
    fs.writeFileSync(path.join(target, 'existe.txt'), 'del usuario');
    const manifest = path.join(base, migration.MANIFEST_NAME);
    fs.writeFileSync(manifest, JSON.stringify({
      app: 'XHANNIZER0',
      packages: [{ wingetId: 'Brave.Brave' }, { wingetId: '; rm -rf' }],
      settingIds: ['win-game-mode', 'MAL ID'],
      folders: [
        { id: 'f1', key: 'documents', name: 'Documentos', relPath: 'Archivos/f1', files: 2, bytes: 20 },
        { id: 'f2', key: 'desktop', name: 'Escape', relPath: '../../Windows', files: 1, bytes: 1 },
      ],
    }));
    const mig = migration.readMigration(manifest);
    assert.ok(mig.ok);
    assert.deepStrictEqual(mig.packages.map((p) => p.wingetId), ['Brave.Brave']);
    assert.deepStrictEqual(mig.settingIds, ['win-game-mode']);
    assert.deepStrictEqual(mig.folders.map((f) => f.id), ['f1']);
    const res = await migration.restoreFolders({ manifestPath: manifest, folderIds: ['f1', 'f2'], resolveKnown: () => target });
    assert.ok(res.ok);
    assert.strictEqual(fs.readFileSync(path.join(target, 'existe.txt'), 'utf8'), 'del usuario');
    assert.strictEqual(fs.readFileSync(path.join(target, 'nuevo.txt'), 'utf8'), 'nuevo');
    assert.strictEqual(migration.readMigration(path.join(base, 'otro.json')).ok, false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('prueba de estabilidad: corre unos segundos sin errores de memoria', async () => {
  const { runStabilityTest } = backend('stability');
  const res = await runStabilityTest({ minutes: 0.05, memoryPercent: 5 });
  assert.ok(res.ok);
  assert.strictEqual(res.errors, 0);
  assert.ok(res.threads >= 1);
});
