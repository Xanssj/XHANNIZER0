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

test('estabilidad y catálogo: emulators no cuelga >400KB y evita win32; pcCheck evita Infinity y limpia GPU temp / virt ok', async () => {
  const { EventEmitter } = require('events');
  const { PassThrough } = require('stream');
  const emu = backend('emulators')._internals;

  // Promesa no colgada cuando GitHub supera 400 KB
  const mockHuge = {
    get: (_url, _opts, cb) => {
      const req = new EventEmitter();
      req.destroy = () => {};
      const res = new PassThrough();
      res.statusCode = 200;
      setImmediate(() => {
        cb(res);
        res.write('x'.repeat(405000));
        res.end();
      });
      return req;
    },
  };
  const hugeRes = await emu.fetchGithubJson('/repos/test/huge/releases/latest', 3000, mockHuge);
  assert.strictEqual(hugeRes, null);

  // pickWindowsAsset descarta win32/x86 y prioriza win64/x64
  const picked = emu.pickWindowsAsset([
    { name: 'app-win32-setup.exe', browser_download_url: 'https://example.com/32.exe' },
    { name: 'app-win64-qt.zip', browser_download_url: 'https://example.com/64.zip' },
  ]);
  assert.strictEqual(picked?.name, 'app-win64-qt.zip');

  // pcCheck: RAM sin velocidad no produce Infinity MHz, no emite gpu-temp ni "Virtualización disponible", pero mantiene aviso cuando virt=false
  const { analyze } = backend('pcCheck')._internals;
  const resOk = analyze({
    ram: [{ capacity: 16 * 1024 ** 3, speed: 0, configured: 0, type: 34, part: '', slot: 'A1', bank: 'BANK 0' }],
    gpus: [], pci: [], secureBoot: 1, firmware: 'UEFI', tpm: '2.0',
    gpuTemp: 'RTX 4070, 52, 4', virt: true, problems: [],
  });
  const ramCheck = resOk.checks.find((c) => c.id === 'ram-xmp');
  assert.ok(ramCheck && !/Infinity/i.test(ramCheck.title));
  assert.strictEqual(resOk.checks.some((c) => c.id.startsWith('gpu-temp-')), false);
  assert.strictEqual(resOk.checks.some((c) => c.id === 'virt'), false);

  const resVirtOff = analyze({
    ram: [], gpus: [], pci: [], secureBoot: 1, firmware: 'UEFI', tpm: '2.0', virt: false, hyperv: false, problems: [],
  });
  const virtWarn = resVirtOff.checks.find((c) => c.id === 'virt');
  assert.ok(virtWarn && /desactivada/i.test(virtWarn.title));

  // autopilot persiste settingIds
  const ap = backend('autopilot');
  const tmpAp = fs.mkdtempSync(path.join(os.tmpdir(), 'xhz-ap-test-'));
  try {
    ap.initAutopilot(tmpAp);
    const saved = ap.saveAutopilot({ status: 'running', appIds: ['steam'], settingIds: ['win-game-mode', 'bad id!'] });
    assert.deepStrictEqual(saved.state.settingIds, ['win-game-mode']);
  } finally {
    fs.rmSync(tmpAp, { recursive: true, force: true });
  }

  // maintenance createRestorePoint restaura frecuencia en finally
  const maintSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'backend', 'maintenance.js'), 'utf8');
  assert.match(maintSrc, /finally\s*\{[\s\S]*SystemRestorePointCreationFrequency/i);
});

test('hardwareCapabilities: clasifica GPUs, CPUs, chipsets y modelos desconocidos de forma conservadora', () => {
  const { detectCapabilities } = backend('hardwareCapabilities');

  // 1. GTX 1650 SUPER + Intel i5-10400F + B460
  const c1 = detectCapabilities({
    cpuName: 'Intel(R) Core(TM) i5-10400F CPU @ 2.90GHz',
    gpuNames: ['NVIDIA GeForce GTX 1650 SUPER'],
    motherboardVendor: 'ASUSTeK COMPUTER INC.',
    motherboardModel: 'PRIME B460M-A',
    formFactor: 'desktop',
    ramType: 'DDR4',
  });
  assert.strictEqual(c1.supportsRebar, false);
  assert.strictEqual(c1.supportsHags, true);
  assert.strictEqual(c1.supportsFrameGen, false);
  assert.strictEqual(c1.maxPlatformPcieGen, 3);
  assert.strictEqual(c1.supportsXmpExpo, false);
  assert.strictEqual(c1.ramProfileName, 'XMP');

  // 2. GTX 970 + Intel i7-4790K + DDR3
  const c2 = detectCapabilities({
    cpuName: 'Intel(R) Core(TM) i7-4790K CPU @ 4.00GHz',
    gpuNames: ['NVIDIA GeForce GTX 970'],
    motherboardVendor: 'Gigabyte Technology Co., Ltd.',
    motherboardModel: 'Z97X-Gaming 5',
    formFactor: 'desktop',
    ramType: 'DDR3',
  });
  assert.strictEqual(c2.supportsRebar, false);
  assert.strictEqual(c2.supportsHags, false);
  assert.strictEqual(c2.supportsFrameGen, false);
  assert.strictEqual(c2.supportsTpm2Firmware, false);

  // 3. RX 580 + AMD Ryzen 5 2600 + B450
  const c3 = detectCapabilities({
    cpuName: 'AMD Ryzen 5 2600 Six-Core Processor',
    gpuNames: ['Radeon RX 580 Series'],
    motherboardVendor: 'Micro-Star International Co., Ltd.',
    motherboardModel: 'B450 TOMAHAWK MAX',
    formFactor: 'desktop',
    ramType: 'DDR4',
  });
  assert.strictEqual(c3.supportsRebar, false);
  assert.strictEqual(c3.supportsHags, false);
  assert.strictEqual(c3.maxPlatformPcieGen, 3);
  assert.strictEqual(c3.ramProfileName, 'DOCP / XMP');

  // 4. RTX 4070 + AMD Ryzen 7 7800X3D + B650 + DDR5
  const c4 = detectCapabilities({
    cpuName: 'AMD Ryzen 7 7800X3D 8-Core Processor',
    gpuNames: ['NVIDIA GeForce RTX 4070'],
    motherboardVendor: 'Micro-Star International Co., Ltd.',
    motherboardModel: 'MAG B650 TOMAHAWK WIFI',
    formFactor: 'desktop',
    ramType: 'DDR5',
  });
  assert.strictEqual(c4.supportsRebar, true);
  assert.strictEqual(c4.supportsHags, true);
  assert.strictEqual(c4.supportsFrameGen, true);
  assert.strictEqual(c4.ramProfileName, 'EXPO');
  assert.strictEqual(c4.maxPlatformPcieGen, 5);

  // 5. Intel Arc A750 + Intel i5-12400F
  const c5 = detectCapabilities({
    cpuName: '12th Gen Intel(R) Core(TM) i5-12400F',
    gpuNames: ['Intel(R) Arc(TM) A750 Graphics'],
    motherboardVendor: 'ASRock',
    motherboardModel: 'B660M Pro RS',
    formFactor: 'desktop',
    ramType: 'DDR4',
  });
  assert.strictEqual(c5.supportsRebar, true);
  assert.strictEqual(c5.rebarCritical, true);
  assert.strictEqual(c5.supportsHags, true);
  assert.strictEqual(c5.supportsFrameGen, false);

  // 6. Modelo futuro / desconocido -> conservador ('unknown', nunca falsos true/warn)
  const c6 = detectCapabilities({
    cpuName: 'QuantumCore Z9000',
    gpuNames: ['FutureGPU Nova 999'],
    motherboardVendor: 'Unknown Corp',
    motherboardModel: 'ProtoBoard X',
    formFactor: 'desktop',
  });
  assert.strictEqual(c6.supportsRebar, 'unknown');
  assert.strictEqual(c6.supportsHags, 'unknown');
  assert.strictEqual(c6.supportsFrameGen, false);
  assert.strictEqual(c6.supportsTpm2Firmware, 'unknown');
  assert.strictEqual(c6.supportsXmpExpo, 'unknown');
});

test('integración hardwareCapabilities: pcCheck, windowsAudit y bios filtran falsos positivos por hardware', () => {
  const { analyze } = backend('pcCheck')._internals;
  const { buildCoreAuditItems } = backend('windowsAudit')._internals;
  const { getBiosGuide } = backend('bios');
  const fakeBarOff = 'FB Memory Usage\n  Total : 4096 MiB\nBAR1 Memory Usage\n  Total : 256 MiB\n';

  // 1. GTX 1650 SUPER + i5-10400F + B460: cero aviso ReBAR, RAM degradada a info, HAGS sin Frame Gen
  const pc1 = analyze({
    cpuName: 'Intel(R) Core(TM) i5-10400F CPU @ 2.90GHz',
    boardVendor: 'ASUSTeK COMPUTER INC.',
    boardModel: 'PRIME B460M-A',
    ram: [{ capacity: 8 * 1024 ** 3, configured: 2666, speed: 2666, type: 26, part: 'CMK16GX4M2B3200C16', slot: 'DIMM_A1', bank: 'BANK 0' }],
    gpus: [{ name: 'NVIDIA GeForce GTX 1650 SUPER', res: 1920, curHz: 60, maxHz: 60 }],
    bar: fakeBarOff,
    pci: [], secureBoot: 1, firmware: 'UEFI', tpm: '2.0', problems: [],
  });
  assert.strictEqual(pc1.checks.some((c) => c.id === 'rebar'), false);
  assert.strictEqual(pc1.checks.find((c) => c.id === 'ram-xmp')?.status, 'info');

  const wa1 = buildCoreAuditItems({ hags: 1, curHz: 60, panelMaxHz: 60 }, {
    cpuName: 'Intel(R) Core(TM) i5-10400F',
    dedicatedGpuName: 'NVIDIA GeForce GTX 1650 SUPER',
    formFactor: 'desktop',
  });
  const hags1 = wa1.items.find((i) => i.id === 'win-hags');
  assert.ok(hags1 && !/Frame Generation/i.test(hags1.description));
  // Monitor 60 Hz real -> isOptimal: true
  const hz1 = wa1.items.find((i) => i.id === 'win-refresh-rate');
  assert.strictEqual(hz1?.isOptimal, true);

  // 2. GTX 970 + i7-4790K + DDR3: DDR3 reconocida, sin TPM BIOS fix, sin HAGS en windowsAudit
  const pc2 = analyze({
    cpuName: 'Intel(R) Core(TM) i7-4790K CPU @ 4.00GHz',
    ram: [{ capacity: 8 * 1024 ** 3, configured: 1600, speed: 1600, type: 24, part: 'KHX1600C10D3', slot: 'A1', bank: 'B0' }],
    gpus: [{ name: 'NVIDIA GeForce GTX 970', res: 1920 }],
    bar: fakeBarOff,
    pci: [], secureBoot: 1, firmware: 'UEFI', tpm: '', problems: [],
  });
  assert.match(pc2.checks.find((c) => c.id === 'ram-xmp')?.detail || '', /DDR3/);
  assert.strictEqual(pc2.checks.some((c) => c.id === 'rebar'), false);
  assert.strictEqual(pc2.checks.find((c) => c.id === 'tpm')?.fix, undefined);
  const wa2 = buildCoreAuditItems({ hags: 1, curHz: 60, panelMaxHz: 60 }, {
    cpuName: 'Intel(R) Core(TM) i7-4790K',
    dedicatedGpuName: 'NVIDIA GeForce GTX 970',
    formFactor: 'desktop',
  });
  assert.strictEqual(wa2.items.some((i) => i.id === 'win-hags'), false);

  // 3. RX 580 + Ryzen 5 2600 + B450 + SSD PCIe 4.0 en PCIe 3.0 -> SSD marcado ok al máximo de la placa
  const pc3 = analyze({
    cpuName: 'AMD Ryzen 5 2600 Six-Core Processor',
    boardVendor: 'Micro-Star International Co., Ltd.',
    boardModel: 'B450 TOMAHAWK MAX',
    ram: [],
    gpus: [{ name: 'Radeon RX 580 Series', res: 1920 }],
    pci: [{ name: 'Samsung 980 PRO', cls: 'SCSIAdapter', id: 'nvme0', curSpeed: 3, maxSpeed: 4, curWidth: 4, maxWidth: 4 }],
    secureBoot: 1, firmware: 'UEFI', tpm: '2.0', problems: [],
  });
  const ssd3 = pc3.checks.find((c) => c.id === 'pcie-nvme0');
  assert.strictEqual(ssd3?.status, 'ok');
  assert.match(ssd3?.title || '', /máximo de la placa/i);

  // 4. RTX 4070 + Ryzen 7 7800X3D + B650 + DDR5 -> ReBAR warn si apagado, HAGS menciona Frame Gen, EXPO
  const pc4 = analyze({
    cpuName: 'AMD Ryzen 7 7800X3D 8-Core Processor',
    boardVendor: 'Micro-Star International Co., Ltd.',
    boardModel: 'MAG B650 TOMAHAWK WIFI',
    ram: [{ capacity: 16 * 1024 ** 3, configured: 4800, speed: 4800, type: 34, part: 'F5-6000J3038F16G', slot: 'A2', bank: 'B0' }],
    gpus: [{ name: 'NVIDIA GeForce RTX 4070', res: 2560 }],
    bar: fakeBarOff,
    pci: [], secureBoot: 1, firmware: 'UEFI', tpm: '2.0', problems: [],
  });
  assert.strictEqual(pc4.checks.find((c) => c.id === 'rebar')?.status, 'warn');
  assert.match(pc4.checks.find((c) => c.id === 'ram-xmp')?.fix || '', /EXPO/);
  const wa4 = buildCoreAuditItems({ hags: 1, curHz: 60, panelMaxHz: 144 }, {
    cpuName: 'AMD Ryzen 7 7800X3D',
    dedicatedGpuName: 'NVIDIA GeForce RTX 4070',
    formFactor: 'desktop',
  });
  assert.match(wa4.items.find((i) => i.id === 'win-hags')?.description || '', /Frame Generation/);
  assert.strictEqual(wa4.items.find((i) => i.id === 'win-refresh-rate')?.isOptimal, false);

  // 5. bios.getBiosGuide filtra temas no soportados salvo showAll: true
  const gFiltered = getBiosGuide({ manufacturer: 'ASUS', product: 'PRIME B460M-A', capabilities: pc1.capabilities });
  assert.strictEqual(gFiltered.sections.some((s) => s.id === 'rebar'), false);
  assert.strictEqual(gFiltered.sections.some((s) => s.id === 'ram-xmp'), false);
  const gAll = getBiosGuide({ manufacturer: 'ASUS', product: 'PRIME B460M-A', capabilities: pc1.capabilities, showAll: true });
  assert.strictEqual(gAll.sections.length, 5);
});

test('presets por niveles: adapta desktop/laptop y HAGS, bloquea Experimental fail-closed y soporta deshacer completo', async () => {
  const {
    buildHardwarePresets,
    resolvePresetPlan,
    getPresetUndoTarget,
    applyPresetOptimizations,
    SAFE_COMPETITIVE_SERVICES,
  } = backend('storeAndPresets');

  // 1. Desktop con RTX 4070 + 32 GB RAM: Gaming Medio incluye HAGS, Competitivo usa Ultimate, Dev Pro incluye Docker + Ollama
  const desktopSys = {
    cpuName: 'AMD Ryzen 7 7800X3D',
    gpuVendor: 'NVIDIA',
    dedicatedGpuName: 'NVIDIA GeForce RTX 4070',
    dedicatedGpuVramGb: 12,
    ramGb: 32,
    formFactor: 'desktop',
  };
  const presetsDesktop = buildHardwarePresets(desktopSys);
  assert.strictEqual(presetsDesktop.find((p) => p.id === 'preset-gaming')?.tiers.length, 3);
  assert.strictEqual(presetsDesktop.find((p) => p.id === 'preset-dev')?.tiers.length, 2);

  const gMedDesktop = resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-medium' }, desktopSys);
  assert.strictEqual(gMedDesktop.powerMode, 'high');
  assert.strictEqual(gMedDesktop.requiresRestorePoint, true);
  assert.strictEqual(gMedDesktop.regValues.some((v) => v.name === 'HwSchMode' && v.value === 2), true);

  const gCompDesktop = resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-competitive' }, desktopSys);
  assert.strictEqual(gCompDesktop.powerMode, 'ultimate');
  assert.strictEqual(gCompDesktop.experimental, true);
  assert.strictEqual(gCompDesktop.failClosedRestorePoint, true);
  assert.strictEqual(gCompDesktop.regValues.some((v) => v.name === 'NetworkThrottlingIndex'), true);
  assert.strictEqual(gCompDesktop.regValues.some((v) => v.name === 'EnableVirtualizationBasedSecurity'), false);
  assert.deepStrictEqual(gCompDesktop.services, SAFE_COMPETITIVE_SERVICES);
  // Nunca toca Defender, Windows Update, Audio, Xbox ni Anticheats
  for (const forbidden of ['WinDefend', 'wuauserv', 'Audiosrv', 'XblAuthManager', 'vgc', 'EasyAntiCheat']) {
    assert.strictEqual(gCompDesktop.services.includes(forbidden), false);
  }

  const devProDesktop = resolvePresetPlan({ presetId: 'preset-dev', tierId: 'dev-pro' }, desktopSys);
  assert.strictEqual(devProDesktop.appIds.includes('docker-desktop'), true);
  assert.strictEqual(devProDesktop.appIds.includes('ollama'), true);
  assert.strictEqual(devProDesktop.regValues.some((v) => v.name === 'Hidden' && v.value === 1), true);
  assert.ok(devProDesktop.workspaceDir);

  // 2. Laptop con GTX 970M / 8 GB RAM: nunca Ultimate ni High, sin HAGS, Dev Pro omite Docker y Ollama
  const laptopSys = {
    cpuName: 'Intel(R) Core(TM) i7-6700HQ',
    gpuVendor: 'NVIDIA',
    dedicatedGpuName: 'NVIDIA GeForce GTX 970',
    dedicatedGpuVramGb: 4,
    ramGb: 8,
    formFactor: 'laptop',
  };
  const gMedLaptop = resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-medium' }, laptopSys);
  assert.strictEqual(gMedLaptop.powerMode, 'balanced');
  assert.strictEqual(gMedLaptop.regValues.some((v) => v.name === 'HwSchMode'), false);
  const gCompLaptop = resolvePresetPlan({ presetId: 'preset-gaming', tierId: 'gaming-competitive' }, laptopSys);
  assert.strictEqual(gCompLaptop.powerMode, 'balanced');
  const devProLaptop = resolvePresetPlan({ presetId: 'preset-dev', tierId: 'dev-pro' }, laptopSys);
  assert.strictEqual(devProLaptop.appIds.includes('docker-desktop'), false);
  assert.strictEqual(devProLaptop.appIds.includes('ollama'), false);

  // 3. Reversibilidad: getPresetUndoTarget cubre todos los valores de registro + servicios Start + carpetas
  const undoComp = getPresetUndoTarget({ presetId: 'preset-gaming', tierId: 'gaming-competitive' }, desktopSys);
  assert.strictEqual(undoComp.power, true);
  assert.strictEqual(undoComp.reg.some((r) => r.name === 'HwSchMode'), true);
  assert.strictEqual(undoComp.reg.some((r) => r.path.endsWith('\\Services\\DiagTrack') && r.name === 'Start'), true);
  const undoDev = getPresetUndoTarget({ presetId: 'preset-dev', tierId: 'dev-pro' }, desktopSys);
  assert.ok(undoDev.workspaceDirs.length > 0);

  // 4. Fail-closed en Experimental: si falla createRestorePoint, BLOQUEA y NO ejecuta PowerShell ni Elevación
  let psCalled = false;
  let elevCalled = false;
  const blockedRes = await applyPresetOptimizations(
    { presetId: 'preset-gaming', tierId: 'gaming-competitive', backupId: 'bkp-test' },
    {
      system: desktopSys,
      createRestorePoint: async () => ({ ok: false, error: 'Protección del sistema desactivada.' }),
      runPowerShell: async () => { psCalled = true; return { ok: true }; },
      runElevated: async () => { elevCalled = true; return { ok: true }; },
    }
  );
  assert.strictEqual(blockedRes.ok, false);
  assert.strictEqual(blockedRes.blocked, true);
  assert.strictEqual(blockedRes.restorePointFailed, true);
  assert.match(blockedRes.error, /Protección del sistema/i);
  assert.strictEqual(psCalled, false);
  assert.strictEqual(elevCalled, false);

  // 5. Cuando createRestorePoint funciona, Experimental sí aplica y marca restorePointCreated: true
  let psOk = false;
  let elevOk = false;
  const appliedRes = await applyPresetOptimizations(
    { presetId: 'preset-gaming', tierId: 'gaming-competitive', backupId: 'bkp-test' },
    {
      system: desktopSys,
      skipFilesystem: true,
      createRestorePoint: async () => ({ ok: true, message: 'Punto de restauración creado.' }),
      runPowerShell: async () => { psOk = true; return { ok: true }; },
      runElevated: async () => { elevOk = true; return { ok: true }; },
    }
  );
  assert.strictEqual(appliedRes.ok, true);
  assert.strictEqual(appliedRes.restorePointCreated, true);
  assert.strictEqual(psOk, true);
  assert.strictEqual(elevOk, true);
});

test('rendimiento y Modo ligero: auto-detección de PC modesta, caché de monitor en vivo y reglas CSS/motion', async () => {
  const { shouldAutoEnableLiteMode, getLiveSystemMetrics, _liveCacheConfig } = backend('hardware');

  // 1. Auto-detección de Modo ligero
  assert.strictEqual(shouldAutoEnableLiteMode({ ramGb: 8, threads: 8, dedicatedGpuName: 'GTX 1650' }), true);
  assert.strictEqual(shouldAutoEnableLiteMode({ ramGb: 16, threads: 4, dedicatedGpuName: 'GTX 1650' }), true);
  assert.strictEqual(shouldAutoEnableLiteMode({ ramGb: 16, threads: 8, dedicatedGpuName: null }), true);
  assert.strictEqual(shouldAutoEnableLiteMode({ ramGb: 32, threads: 16, dedicatedGpuName: 'RTX 4070' }, { reducedMotion: true }), true);
  assert.strictEqual(shouldAutoEnableLiteMode({ ramGb: 16, threads: 12, dedicatedGpuName: 'RTX 3060' }), false);

  // 2. Caché de consultas lentas en monitor en vivo (6–8 s) + CPU/RAM nativos
  assert.ok(_liveCacheConfig.DISK_CACHE_TTL_MS >= 6000 && _liveCacheConfig.DISK_CACHE_TTL_MS <= 10000);
  assert.ok(_liveCacheConfig.GPU_CACHE_TTL_MS >= 6000 && _liveCacheConfig.GPU_CACHE_TTL_MS <= 10000);
  const m1 = await getLiveSystemMetrics();
  const t0 = Date.now();
  const m2 = await getLiveSystemMetrics();
  assert.strictEqual(m1.ok, true);
  assert.strictEqual(m2.ok, true);
  assert.ok(Date.now() - t0 < 500, 'La segunda lectura en caché debe ser prácticamente instantánea');

  // 3. Reglas CSS de Modo ligero y content-visibility en listas largas
  const tokensCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles', 'tokens.css'), 'utf8');
  const appCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles', 'app.css'), 'utf8');
  const motionJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'js', 'motion.js'), 'utf8');
  assert.match(tokensCss, /:root\[data-lite="true"\]/);
  assert.match(tokensCss, /backdrop-filter:\s*none\s*!important/);
  assert.match(appCss, /content-visibility:\s*auto/);
  assert.match(motionJs, /data-lite/);
  assert.match(motionJs, /setLiteMode/);
});

test('powershell: runElevated omite Start-Process -Verb RunAs si ya es Admin y lo usa si es estándar', async () => {
  const { runElevated, relaunchAsAdmin, POWERSHELL_EXE } = backend('powershell');

  // 1. Cuando ya corre como Admin: ejecuta POWERSHELL_EXE directo con -EncodedCommand (cero -Verb RunAs)
  let directCall = null;
  let psLauncherCalled = false;
  const rAdmin = await runElevated('Write-Output "ok"', 10000, {
    isAdmin: true,
    execFile: (exe, args, _opts, cb) => {
      directCall = { exe, args };
      cb(null, 'ok', '');
    },
    runPowerShell: async () => {
      psLauncherCalled = true;
      return { ok: true, stdout: '' };
    },
  });
  assert.strictEqual(rAdmin.ok, true);
  assert.strictEqual(rAdmin.cancelled, false);
  assert.strictEqual(rAdmin.directAdmin, true);
  assert.strictEqual(psLauncherCalled, false);
  assert.strictEqual(directCall.exe, POWERSHELL_EXE);
  assert.ok(directCall.args.includes('-EncodedCommand'));

  // 2. Cuando NO es Admin: usa Start-Process -Verb RunAs y detecta cancelación UAC
  let capturedLauncher = '';
  const rStdCancel = await runElevated('Write-Output "ok"', 10000, {
    isAdmin: false,
    runPowerShell: async (script) => {
      capturedLauncher = script;
      return { ok: false, stdout: 'UAC_CANCELLED' };
    },
  });
  assert.strictEqual(rStdCancel.ok, false);
  assert.strictEqual(rStdCancel.cancelled, true);
  assert.match(capturedLauncher, /Start-Process\s+-FilePath\s+\$psExe\s+-Verb\s+RunAs/);

  // 3. relaunchAsAdmin codifica argumentos vía psData (sin interpolación) y reporta UAC cancelado
  let capturedRelaunch = '';
  const rRelCancel = await relaunchAsAdmin(
    { execPath: 'C:\\Program Files\\XHANNIZER0\\XHANNIZER0.exe', args: ["C:\\path with 'quote'"], cwd: 'C:\\' },
    {
      runPowerShell: async (script) => {
        capturedRelaunch = script;
        return { ok: false, stdout: 'UAC_CANCELLED' };
      },
    }
  );
  assert.strictEqual(rRelCancel.ok, false);
  assert.strictEqual(rRelCancel.cancelled, true);
  assert.match(capturedRelaunch, /FromBase64String/);
  assert.match(capturedRelaunch, /Verb\s*=\s*'RunAs'/);
  assert.strictEqual(capturedRelaunch.includes("path with 'quote'"), false);
});
