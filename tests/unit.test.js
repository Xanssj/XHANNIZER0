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

test('biosUpdate: interpreta placas MSI, compara versiones y genera URLs oficiales', () => {
  const bu = backend('biosUpdate');
  assert.deepStrictEqual(bu.parseMsiProduct('PRO B660M-A WIFI DDR4 (MS-7D43)'), {
    slug: 'PRO-B660M-A-WIFI-DDR4',
    boardCode: '7D43',
  });
  const vOld = bu.parseMsiVersion('1.L0');
  const vSame = bu.parseMsiVersion('7D43v1L');
  const vNew = bu.parseMsiVersion('7D43v1P1');
  assert.strictEqual(bu.compareMsiVersions(vOld, vSame), 0);
  assert.ok(bu.compareMsiVersions(vNew, vOld) > 0);
  assert.ok(bu.compareMsiVersions(vOld, vNew) < 0);
  assert.strictEqual(bu.parseMsiVersion('invalida'), null);
  assert.strictEqual(bu.supportUrlFor('Micro-Star International', 'PRO B660M-A (MS-7D43)'), 'https://www.msi.com/Motherboard/PRO-B660M-A/support#bios');
  assert.match(bu.supportUrlFor('ASUSTeK COMPUTER INC.', 'ROG STRIX B650E-F'), /^https:\/\/www\.asus\.com\//);
  assert.match(bu.supportUrlFor('Gigabyte Technology', 'B650 AORUS ELITE'), /^https:\/\/www\.gigabyte\.com\//);
  assert.match(bu.supportUrlFor('ASRock', 'B650M Pro RS'), /^https:\/\/www\.asrock\.com\//);
  assert.strictEqual(bu.supportUrlFor('Desconocido', 'XYZ'), null);
});

test('windowsMedia: solo acepta descargas HTTPS de dominios oficiales de Microsoft', () => {
  const { isAllowedMicrosoftUrl } = backend('windowsMedia');
  assert.strictEqual(isAllowedMicrosoftUrl('https://go.microsoft.com/fwlink/?linkid=2156295'), true);
  assert.strictEqual(isAllowedMicrosoftUrl('https://download.microsoft.com/download/a/b/MCT.exe'), true);
  assert.strictEqual(isAllowedMicrosoftUrl('https://software-static.download.prss.microsoft.com/dbazure/MCT.exe'), true);
  assert.strictEqual(isAllowedMicrosoftUrl('http://download.microsoft.com/MCT.exe'), false);
  assert.strictEqual(isAllowedMicrosoftUrl('https://microsoft.com.evil.example/MCT.exe'), false);
  assert.strictEqual(isAllowedMicrosoftUrl('https://fakemicrosoft.com/MCT.exe'), false);
  assert.strictEqual(isAllowedMicrosoftUrl('notaurl'), false);
});

test('hardware: reconoce OEMs, GPUs integradas modernas y versiones NVIDIA', () => {
  const hw = backend('hardware');
  assert.strictEqual(hw.oemFor('Dell Inc.', 'XPS 15')?.short, 'Dell');
  assert.strictEqual(hw.oemFor('LENOVO', 'ThinkPad T14')?.short, 'Lenovo');
  assert.strictEqual(hw.isIntegratedGpuName('Intel(R) Arc(TM) Graphics'), true);
  assert.strictEqual(hw.isIntegratedGpuName('Intel(R) Arc(TM) A770 Graphics'), false);
  assert.strictEqual(hw.isIntegratedGpuName('AMD Radeon 780M Graphics'), true);
  assert.strictEqual(hw.isIntegratedGpuName('Qualcomm(R) Adreno(TM) X1-85 GPU'), true);
  assert.strictEqual(hw.isIntegratedGpuName('NVIDIA GeForce RTX 4070'), false);
  assert.strictEqual(hw.formatNvidiaVersion('32.0.15.6636'), '566.36');
});

test('pcCheck y bios: adaptan avisos y teclas en portátiles y equipos de marca', () => {
  const { analyze } = backend('pcCheck')._internals;
  const laptopCheck = analyze(
    {
      ram: [{ capacity: 16 * 1024 ** 3, configured: 4800, speed: 4800, type: 34, part: 'KF552C40BBK2', slot: 'DIMM_A1', bank: '' }],
      gpus: [{ name: 'NVIDIA GeForce RTX 4060 Laptop GPU', res: null }, { name: 'AMD Radeon 780M Graphics', res: 2560 }],
      pci: [],
      secureBoot: 1,
      firmware: 'UEFI',
      tpm: '2.0',
      virt: true,
      hyperv: false,
      problems: [],
    },
    { formFactor: 'laptop' }
  );
  const st = Object.fromEntries(laptopCheck.checks.map((c) => [c.id, c.status]));
  assert.notStrictEqual(st['ram-xmp'], 'warn');
  assert.notStrictEqual(st['ram-channel'], 'warn');
  assert.notStrictEqual(st['display-port'], 'warn');

  const { getBiosGuide } = backend('bios');
  const dellGuide = getBiosGuide({ manufacturer: 'Dell Inc.', product: 'XPS 15', brandSystem: true });
  assert.strictEqual(dellGuide.brand, 'Dell');
  assert.match(dellGuide.keys, /F2/);
});

test('i18n-en: traduce textos exactos, menú contextual y plantillas con parámetros', () => {
  const i18n = require(path.join(__dirname, '..', 'src', 'renderer', 'js', 'i18n-en.js'));
  assert.strictEqual(i18n.translate('Cortar'), 'Cut');
  assert.strictEqual(i18n.translate('Copiar'), 'Copy');
  assert.strictEqual(i18n.translate('Pegar'), 'Paste');
  assert.strictEqual(i18n.translate('Seleccionar todo'), 'Select all');
  assert.strictEqual(i18n.translate('Al día'), 'Up to date');
  assert.strictEqual(
    i18n.translate('Probando 8 GB de RAM en 16 hilos…'),
    'Testing 8 GB of RAM on 16 threads…'
  );
  assert.strictEqual(i18n.translate('12345'), null);
});

test('seguridad: postFormatTools bloquea inyección en bloatware y wingetId', async () => {
  const pft = backend('postFormatTools');
  const r1 = await pft.removeBloatware({
    backupId: 'b1',
    packageFullNames: ['Microsoft.BingNews; calc.exe', 'Microsoft.BingNewsEvil_1.0', 'Microsoft.WindowsStore_1.0'],
  });
  assert.strictEqual(r1.ok, false);
  const r2 = await pft.runWingetUpgrade({ wingetId: '--override calc.exe' });
  assert.strictEqual(r2.ok, false);
  const r3 = await pft.runWingetUpgrade({ wingetId: 'Brave.Brave; calc' });
  assert.strictEqual(r3.ok, false);
});

test('seguridad: biosUpdate rechaza descargas sin SHA-256 o fuera de download.msi.com', async () => {
  const bu = backend('biosUpdate');
  const noSha = await bu.prepareBiosUsb({
    latest: { url: 'https://download.msi.com/bos_exe/mb/7D43v1P.zip', sha256: null, version: '7D43v1P' },
    boardCode: '7D43',
    drive: 'E:',
  });
  assert.strictEqual(noSha.ok, false);
  const badHost = await bu.prepareBiosUsb({
    latest: { url: 'https://evil.example/7D43v1P.zip', sha256: 'a'.repeat(64), version: '7D43v1P' },
    boardCode: '7D43',
    drive: 'E:',
  });
  assert.strictEqual(badHost.ok, false);
});

test('pcCheck: detecta monitor atascado en 60 Hz y salud de batería en portátiles', () => {
  const { analyze } = backend('pcCheck')._internals;
  const stuck60 = analyze({
    ram: [],
    gpus: [{ name: 'NVIDIA GeForce RTX 4070', res: 2560, curHz: 60, maxHz: 144 }],
    pci: [],
    secureBoot: 1,
    firmware: 'UEFI',
    tpm: '2.0',
    virt: true,
    battery: { designed: 60000, full: 34000 },
    problems: [],
  });
  const byId = Object.fromEntries(stuck60.checks.map((c) => [c.id, c]));
  assert.strictEqual(byId['display-hz'].status, 'warn');
  assert.match(byId['display-hz'].title, /60 Hz.*144 Hz/);
  assert.strictEqual(byId['battery-health'].status, 'warn');

  const healthy = analyze({
    ram: [],
    gpus: [{ name: 'NVIDIA GeForce RTX 4070', res: 2560, curHz: 144, maxHz: 144 }],
    pci: [],
    secureBoot: 1,
    firmware: 'UEFI',
    tpm: '2.0',
    virt: true,
    battery: { designed: 60000, full: 56000 },
    problems: [],
  });
  const okById = Object.fromEntries(healthy.checks.map((c) => [c.id, c]));
  assert.strictEqual(okById['display-hz'].status, 'ok');
  assert.strictEqual(okById['battery-health'].status, 'ok');
});

test('seguridad: uninstallWingetApp bloquea IDs inválidos o inyección de argumentos', async () => {
  const pft = backend('postFormatTools');
  assert.strictEqual((await pft.uninstallWingetApp({ wingetId: '' })).ok, false);
  assert.strictEqual((await pft.uninstallWingetApp({ wingetId: '--force' })).ok, false);
  assert.strictEqual((await pft.uninstallWingetApp({ wingetId: 'Brave.Brave; calc.exe' })).ok, false);
});

test('pcCheck: detecta pantallazos azules (BSOD) y apagados inesperados Kernel-Power 41', () => {
  const { analyze } = backend('pcCheck')._internals;
  const base = { ram: [], gpus: [], pci: [], secureBoot: 1, firmware: 'UEFI', tpm: '2.0', virt: true, problems: [] };
  const clean = analyze({ ...base, crashes: { minidumps: 0, bsod30d: 0, powerLoss30d: 0, lastAt: null } });
  assert.strictEqual(clean.checks.find((c) => c.id === 'stability-bsod').status, 'ok');

  const crashed = analyze({ ...base, crashes: { minidumps: 2, bsod30d: 2, powerLoss30d: 1, lastAt: '2026-11-20T12:00:00.000Z' } });
  const c = crashed.checks.find((c) => c.id === 'stability-bsod');
  assert.strictEqual(c.status, 'warn');
  assert.match(c.title, /2 pantallazo/);
});

test('seguridad: isProtectedSystemDir bloquea raíces de disco y carpetas críticas de Windows', () => {
  const sb = backend('safetyBackup');
  assert.strictEqual(sb.isProtectedSystemDir('C:\\'), true);
  assert.strictEqual(sb.isProtectedSystemDir('C:\\Windows'), true);
  assert.strictEqual(sb.isProtectedSystemDir('C:\\Windows\\System32'), true);
  assert.strictEqual(sb.isProtectedSystemDir('C:\\Program Files'), true);
  assert.strictEqual(sb.isProtectedSystemDir('C:\\Users'), true);
  assert.strictEqual(sb.isProtectedSystemDir(path.join(os.homedir(), 'Downloads')), false);
});

test('seguridad: maintenance wu-reset y cleanup wu-cache garantizan reinicio de servicios con finally', () => {
  const maint = backend('maintenance');
  assert.match(maint.REPAIRS['wu-reset'].script, /finally\s*\{[\s\S]*Start-Service/i);
  const cleanupSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'backend', 'cleanup.js'), 'utf8');
  assert.match(cleanupSrc, /finally\s*\{[\s\S]*Start-Service wuauserv,bits/i);
});

test('restore: soporta deshacer para nuevos ajustes (archivos ocultos, máximo rendimiento e hibernación)', () => {
  const { SETTING_TARGETS } = backend('restore')._internals;
  assert.ok(SETTING_TARGETS['win-show-hidden']?.reg?.length === 1);
  assert.strictEqual(SETTING_TARGETS['win-ultimate-power']?.power, true);
  assert.strictEqual(SETTING_TARGETS['win-hibernation-off']?.hibernate, true);
});

test('hardware: getLiveSystemMetrics devuelve CPU, RAM y disco del sistema válidos', async () => {
  const hw = backend('hardware');
  const m = await hw.getLiveSystemMetrics();
  assert.strictEqual(m.ok, true);
  assert.ok(m.cpuPct >= 0 && m.cpuPct <= 100);
  assert.ok(m.ramTotalGb > 0 && m.ramPct >= 0 && m.ramPct <= 100);
  if (m.disk) assert.ok(m.disk.totalGb > 0 && m.disk.freeGb >= 0);
});

test('seguridad: navegación Electron, registro de ejecutables, rutas protegidas y diálogos fail-closed', async () => {
  const { pathToFileURL } = require('url');
  const guards = backend('securityGuards');
  const { isProtectedSystemDir } = backend('safetyBackup');
  const indexPath = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
  const allowedUrl = pathToFileURL(path.resolve(indexPath)).toString();

  assert.strictEqual(guards.isAllowedRendererNavigation(allowedUrl, indexPath), true);
  assert.strictEqual(guards.isAllowedRendererNavigation('file:///C:/Windows/win.ini', indexPath), false);
  assert.strictEqual(guards.isAllowedRendererNavigation('file://attacker/share/evil.html', indexPath), false);
  assert.strictEqual(guards.isAllowedRendererNavigation('https://example.com', indexPath), false);
  assert.strictEqual(guards.isAllowedRendererNavigation('javascript:alert(1)', indexPath), false);

  const reg = guards.createAllowedExeRegistry();
  assert.strictEqual(reg.add('C:\\Program Files\\App\\app.exe'), true);
  assert.strictEqual(reg.add('C:\\Windows\\notepad.txt'), false);
  assert.strictEqual(reg.has('c:\\program files\\app\\app.exe'), true);
  assert.strictEqual(reg.has('C:\\Users\\Public\\evil.exe'), false);

  let dialogCalled = false;
  const fakeShow = async () => { dialogCalled = true; return { response: 0 }; };
  const nullRes = await guards.confirmOrFailClosed(null, fakeShow, {});
  assert.strictEqual(nullRes.confirmed, false);
  assert.strictEqual(nullRes.canceled, true);
  const destroyedRes = await guards.confirmOrFailClosed({ isDestroyed: () => true }, fakeShow, {});
  assert.strictEqual(destroyedRes.confirmed, false);
  assert.strictEqual(destroyedRes.canceled, true);
  assert.strictEqual(dialogCalled, false);

  assert.strictEqual(guards.isSafeDestinationDir('C:\\Windows', isProtectedSystemDir), false);
  assert.strictEqual(guards.isSafeDestinationDir('C:\\Program Files\\Test', isProtectedSystemDir), false);
  assert.strictEqual(guards.isSafeDestinationDir('C:\\', isProtectedSystemDir), false);
  assert.strictEqual(guards.isSafeDestinationDir(path.join(os.homedir(), 'Desktop'), isProtectedSystemDir), true);
});

test('seguridad: cleanup elevado filtra ReparsePoint y biosUpdate exige HTTPS y boardCode válido', async () => {
  const cleanup = backend('cleanup');
  const script = cleanup._internals.elevatedScript(['win-temp', 'wu-cache', 'windows-old']);
  assert.match(script, /!ReparsePoint/);
  assert.match(script, /Remove-SafeChildren/);
  assert.match(script, /finally\s*\{[\s\S]*StateFlags0742/i);

  const bu = backend('biosUpdate');
  const fakeSha = 'a'.repeat(64);
  const httpRes = await bu.prepareBiosUsb({
    latest: { url: 'http://download.msi.com/bos_exe/mb/7D43v1P.zip', sha256: fakeSha, version: '7D43v1P' },
    boardCode: '7D43',
    drive: 'Z:',
  });
  assert.strictEqual(httpRes.ok, false);
  assert.match(httpRes.error, /HTTPS/i);

  const badCodeRes = await bu.prepareBiosUsb({
    latest: { url: 'https://download.msi.com/bos_exe/mb/7D43v1P.zip', sha256: fakeSha, version: '7D43v1P' },
    boardCode: '7D43.*',
    drive: 'Z:',
  });
  assert.strictEqual(badCodeRes.ok, false);
  assert.match(badCodeRes.error, /inválido/i);
});

test('seguridad: downloadFile aplica límite de tamaño, bloquea redirecciones inseguras y limpia parciales; powershell usa ruta absoluta', async () => {
  const { EventEmitter } = require('events');
  const { PassThrough } = require('stream');
  const { downloadFile } = backend('installer')._internals;
  const psMod = backend('powershell');

  assert.doesNotThrow(() => psMod.psData(undefined));
  if (process.platform === 'win32') {
    assert.match(psMod.POWERSHELL_EXE, /\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-dl-test-'));
  try {
    // 1. Límite de tamaño excedido -> rechaza y borra archivo parcial
    const overDest = path.join(tmpDir, 'over.bin');
    const mockOversize = {
      get: (_url, _opts, cb) => {
        const req = new EventEmitter();
        req.destroy = () => {};
        const res = new PassThrough();
        res.statusCode = 200;
        res.headers = {};
        setImmediate(() => {
          cb(res);
          res.write(Buffer.alloc(2048, 0x41));
          res.end();
        });
        return req;
      },
    };
    await assert.rejects(
      () => downloadFile('https://example.com/file.bin', overDest, () => {}, { maxBytes: 1024, httpsClient: mockOversize }),
      /tamaño máximo/i
    );
    assert.strictEqual(fs.existsSync(overDest), false);

    // 2. Redirección a http:// o host no autorizado -> rechaza
    const redirDest = path.join(tmpDir, 'redir.bin');
    const mockHttpRedir = {
      get: (_url, _opts, cb) => {
        const req = new EventEmitter();
        req.destroy = () => {};
        const res = new EventEmitter();
        res.statusCode = 302;
        res.headers = { location: 'http://evil.example.com/drop.exe' };
        res.resume = () => {};
        setImmediate(() => cb(res));
        return req;
      },
    };
    await assert.rejects(
      () => downloadFile('https://trusted.example.com/app.exe', redirDest, () => {}, { allowedHosts: ['trusted.example.com'], httpsClient: mockHttpRedir }),
      /HTTPS/i
    );
    assert.strictEqual(fs.existsSync(redirDest), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
