'use strict';

const { execFile } = require('child_process');
const { runElevated, psData } = require('./powershell');
const WINGET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9.+_-]{1,120}$/;
const APPX_FULLNAME_RE = /^[A-Za-z0-9._-]+$/;

function runExec(file, args, timeout = 25000) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim(),
      });
    });
  });
}

function runPowerShell(script, timeout = 25000) {
  return runExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], timeout);
}

// =========================================================================
// 1. LIMPIADOR DE BLOATWARE DE WINDOWS (Solo AppX seguros y reversibles)
// =========================================================================
const SAFE_BLOATWARE_LIST = [
  { id: 'clipchamp', appxPattern: 'Clipchamp.Clipchamp', name: 'Microsoft Clipchamp', category: 'Video OEM', desc: 'Editor de video web preinstalado que consume espacio si usas OBS/DaVinci/Premiere.' },
  { id: 'bing-news', appxPattern: 'Microsoft.BingNews', name: 'Microsoft Noticias', category: 'Widgets / Feed', desc: 'App de noticias y notificaciones del feed de MSN.' },
  { id: 'bing-weather', appxPattern: 'Microsoft.BingWeather', name: 'Microsoft Clima', category: 'Widgets / Feed', desc: 'App de clima preinstalada vinculada al panel de Widgets.' },
  { id: 'solitaire', appxPattern: 'Microsoft.MicrosoftSolitaireCollection', name: 'Solitaire & Casual Games', category: 'Juegos OEM', desc: 'Colección de juegos casuales con anuncios preinstalada en Windows.' },
  { id: 'feedback-hub', appxPattern: 'Microsoft.WindowsFeedbackHub', name: 'Centro de opiniones', category: 'Telemetría', desc: 'Aplicación de envío de reportes de comentarios a Microsoft.' },
  { id: 'get-help', appxPattern: 'Microsoft.GetHelp', name: 'Obtener ayuda', category: 'Soporte OEM', desc: 'Asistente de soporte guiado de Microsoft rara vez usado tras formatear.' },
  { id: 'get-started', appxPattern: 'Microsoft.Getstarted', name: 'Sugerencias (Tips)', category: 'Sugerencias', desc: 'Notificaciones de consejos y tutoriales iniciales de Windows.' },
  { id: 'copilot-app', appxPattern: 'Microsoft.Copilot', name: 'Microsoft Copilot App', category: 'Asistente OEM', desc: 'Aplicación independiente de Copilot si prefieres usar tus propias herramientas de IA.' },
  { id: 'office-hub', appxPattern: 'Microsoft.MicrosoftOfficeHub', name: 'Microsoft 365 (Hub)', category: 'Promocional', desc: 'Acceso directo promocional a suscripciones de Office 365.' },
  { id: 'cortana', appxPattern: 'Microsoft.549981C3F5F10', name: 'Cortana (Legado)', category: 'Legado', desc: 'Asistente clásico descontinuado de Windows.' },
  { id: 'skype', appxPattern: 'Microsoft.SkypeApp', name: 'Skype (Preinstalado)', category: 'Legado', desc: 'Cliente clásico preinstalado en algunas imágenes de Windows.' },
  { id: 'power-automate', appxPattern: 'Microsoft.PowerAutomateDesktop', name: 'Power Automate Desktop', category: 'Oficina OEM', desc: 'Automatizador corporativo preinstalado que no se usa en PCs personales.' },
];

async function scanBloatware() {
  const res = await runPowerShell('@(Get-AppxPackage | Select-Object Name, PackageFullName, Version) | ConvertTo-Json -Compress', 15000);
  let installedPkgs = [];
  if (res.ok && res.stdout) {
    try {
      const parsed = JSON.parse(res.stdout);
      installedPkgs = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {
      installedPkgs = [];
    }
  }

  const items = SAFE_BLOATWARE_LIST.map((entry) => {
    const match = installedPkgs.find((p) => String(p.Name || '').toLowerCase() === entry.appxPattern.toLowerCase());
    return {
      ...entry,
      installed: Boolean(match),
      packageFullName: match?.PackageFullName || null,
      version: match?.Version || null,
    };
  });

  return {
    ok: true,
    items,
    installedCount: items.filter((i) => i.installed).length,
  };
}

async function removeBloatware({ packageFullNames, backupId }) {
  if (!backupId) {
    return { ok: false, error: 'Se requiere una copia de seguridad vigente antes de desinstalar paquetes de Windows.' };
  }
  const list = Array.isArray(packageFullNames) ? packageFullNames.filter(Boolean) : [];
  if (!list.length) return { ok: false, error: 'No se seleccionaron paquetes para eliminar.' };

  // Validar que solo se eliminen paquetes de nuestra lista blanca segura y con formato válido
  const allowedPrefixes = SAFE_BLOATWARE_LIST.map((b) => `${b.appxPattern.toLowerCase()}_`);
  const safeList = list.filter((fullName) => {
    const s = String(fullName);
    return APPX_FULLNAME_RE.test(s) && allowedPrefixes.some((prefix) => s.toLowerCase().startsWith(prefix));
  });

  if (!safeList.length) {
    return { ok: false, error: 'Paquete bloqueado: solo se permite eliminar bloatware reversible autorizado.' };
  }

  let removed = 0;
  for (const fullName of safeList) {
    const r = await runPowerShell(`Remove-AppxPackage -Package ${psData(String(fullName))} -ErrorAction Stop`, 15000);
    if (r.ok) removed += 1;
  }

  return {
    ok: true,
    removed,
    message: `Limpieza segura completada: ${removed} de ${safeList.length} app${safeList.length > 1 ? 's' : ''} eliminadas.`,
  };
}

// =========================================================================
// 2. ACTUALIZADOR GLOBAL DE APPS (winget upgrade)
// =========================================================================
async function scanWingetUpgrades() {
  const res = await runExec(
    'winget.exe',
    ['upgrade', '--accept-source-agreements', '--disable-interactivity'],
    22000
  );
  if (!res.ok && !res.stdout) {
    return { ok: false, items: [], note: 'WinGet no está disponible en esta sesión.' };
  }

  const lines = String(res.stdout || '').split(/\r?\n/);
  const sepIndex = lines.findIndex((l) => /^-{5,}/.test(l.trim()));
  if (sepIndex === -1) {
    return { ok: true, items: [], note: 'Todas tus aplicaciones gestionadas por WinGet están actualizadas.' };
  }

  const items = [];
  for (const rawLine of lines.slice(sepIndex + 1)) {
    const line = rawLine.trim();
    if (!line || /^\d+\s+actualizaci|\d+\s+upgrade/i.test(line)) continue;
    // Columnas separadas por 2+ espacios: Name  Id  Version  Available  Source
    const cols = line.split(/\s{2,}/);
    if (cols.length < 4) continue;
    const [name, id, currentVersion, availableVersion, source] = cols;
    if (!id || id.length < 3 || /^-+$/.test(id)) continue;
    items.push({
      id: `upg-${id}`,
      wingetId: id,
      name: name.trim(),
      currentVersion: currentVersion.trim(),
      availableVersion: availableVersion.trim(),
      source: (source || 'winget').trim(),
    });
    if (items.length >= 40) break;
  }

  return { ok: true, items };
}

async function runWingetUpgrade({ wingetId }) {
  const id = String(wingetId || '');
  if (!id || (id !== '__ALL__' && !WINGET_ID_RE.test(id))) return { ok: false, error: 'ID inválido' };
  const args = id === '__ALL__'
    ? ['upgrade', '--all', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity']
    : ['upgrade', '--id', id, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'];

  const res = await runExec('winget.exe', args, 120000);
  return {
    ok: res.ok,
    message: res.ok
      ? wingetId === '__ALL__'
        ? 'Actualización global completada.'
        : `${wingetId} actualizado correctamente.`
      : 'Algunas actualizaciones requieren cerrar la app o permisos de administrador.',
  };
}

async function uninstallWingetApp({ wingetId, name }) {
  const id = String(wingetId || '').trim();
  if (!WINGET_ID_RE.test(id)) return { ok: false, error: 'ID de paquete inválido.' };
  const args = ['uninstall', '--id', id, '--exact', '--silent', '--accept-source-agreements', '--disable-interactivity'];
  const res = await runExec('winget.exe', args, 180000);
  const label = String(name || id);
  return {
    ok: res.ok,
    message: res.ok
      ? `${label} desinstalado correctamente.`
      : `No se pudo desinstalar ${label} automáticamente (puede requerir cerrar la app o desinstalar desde Configuración de Windows).`,
  };
}

// =========================================================================
// 3. DIAGNÓSTICO RÁPIDO DE RED Y DNS (Comparador en vivo + Cloudflare/Google/Quad9/AdGuard/DHCP)
// =========================================================================
const DNS_PROVIDERS = [
  { id: 'dns-cloudflare', name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', note: 'Muy rápido y enfocado en privacidad' },
  { id: 'dns-google', name: 'Google DNS', primary: '8.8.8.8', secondary: '8.8.4.4', note: 'Alta disponibilidad global' },
  { id: 'dns-quad9', name: 'Quad9', primary: '9.9.9.9', secondary: '149.112.112.112', note: 'Bloquea dominios maliciosos y phishing' },
  { id: 'dns-adguard', name: 'AdGuard DNS', primary: '94.140.14.14', secondary: '94.140.15.15', note: 'Bloquea anuncios y rastreadores por DNS' },
  { id: 'dns-opendns', name: 'OpenDNS', primary: '208.67.222.222', secondary: '208.67.220.220', note: 'Estable con protección de Cisco' },
];

async function scanNetworkAndDns() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface -eq $true } | Select-Object -First 1 Name, InterfaceAlias, LinkSpeed, InterfaceIndex
$dns = if ($adapter) { @(Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses) } else { @() }
$pingCf = (Test-Connection -ComputerName 1.1.1.1 -Count 1 -ErrorAction SilentlyContinue).ResponseTime
$pingGg = (Test-Connection -ComputerName 8.8.8.8 -Count 1 -ErrorAction SilentlyContinue).ResponseTime
@{
  adapterName = if ($adapter) { $adapter.InterfaceAlias } else { 'Sin adaptador activo' }
  linkSpeed = if ($adapter) { $adapter.LinkSpeed } else { '--' }
  dnsServers = $dns
  pingCloudflare = $pingCf
  pingGoogle = $pingGg
} | ConvertTo-Json -Compress
`;
  const res = await runPowerShell(ps, 12000);
  let data = {};
  if (res.ok && res.stdout) {
    try { data = JSON.parse(res.stdout); } catch { data = {}; }
  }
  const dnsList = Array.isArray(data.dnsServers) ? data.dnsServers : data.dnsServers ? [data.dnsServers] : [];
  let provider = 'ISP / Automático';
  if (dnsList.includes('1.1.1.1')) provider = 'Cloudflare (1.1.1.1)';
  else if (dnsList.includes('8.8.8.8')) provider = 'Google (8.8.8.8)';
  else if (dnsList.includes('9.9.9.9')) provider = 'Quad9 (9.9.9.9)';
  else if (dnsList.includes('94.140.14.14')) provider = 'AdGuard DNS (94.140.14.14)';
  else if (dnsList.includes('208.67.222.222')) provider = 'OpenDNS (208.67.222.222)';

  return {
    ok: true,
    adapterName: data.adapterName || 'Adaptador principal',
    linkSpeed: data.linkSpeed || '--',
    dnsServers: dnsList,
    dnsProvider: provider,
    pingCloudflare: typeof data.pingCloudflare === 'number' ? `${data.pingCloudflare} ms` : 'Sin respuesta',
    pingGoogle: typeof data.pingGoogle === 'number' ? `${data.pingGoogle} ms` : 'Sin respuesta',
  };
}

// Mide en paralelo (3 pings por servidor) la latencia real de los principales DNS públicos
async function benchmarkDnsServers() {
  const ips = DNS_PROVIDERS.map((p) => p.primary);
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$ips = @(${psData(ips)})
$results = @{}
foreach ($ip in $ips) { $results[$ip] = @() }
for ($round = 0; $round -lt 3; $round++) {
  $tasks = @{}
  foreach ($ip in $ips) {
    $p = New-Object System.Net.NetworkInformation.Ping
    $tasks[$ip] = @{ ping = $p; task = $p.SendPingAsync($ip, 1200) }
  }
  foreach ($ip in $ips) {
    try {
      $r = $tasks[$ip].task.GetAwaiter().GetResult()
      if ($r -and $r.Status -eq 'Success') { $results[$ip] += [int]$r.RoundtripTime }
    } catch {}
    $tasks[$ip].ping.Dispose()
  }
}
$results | ConvertTo-Json -Compress
`;
  const res = await runPowerShell(ps, 14000);
  let raw = {};
  if (res.ok && res.stdout) {
    try { raw = JSON.parse(res.stdout); } catch { raw = {}; }
  }
  const items = DNS_PROVIDERS.map((prov) => {
    const samples = (Array.isArray(raw[prov.primary]) ? raw[prov.primary] : typeof raw[prov.primary] === 'number' ? [raw[prov.primary]] : [])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 0);
    const avgMs = samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null;
    const minMs = samples.length ? Math.min(...samples) : null;
    const lossPct = Math.round(((3 - samples.length) / 3) * 100);
    return { ...prov, avgMs, minMs, lossPct, reachable: samples.length > 0 };
  }).sort((a, b) => {
    if (a.avgMs == null && b.avgMs == null) return 0;
    if (a.avgMs == null) return 1;
    if (b.avgMs == null) return -1;
    return a.avgMs - b.avgMs;
  });

  if (items.length && items[0].reachable) {
    items[0].recommended = true;
  }
  return { ok: true, items, testedAt: new Date().toISOString() };
}

async function applyNetworkAction({ action, adapterName, backupId }) {
  if (!backupId) {
    return { ok: false, error: 'Se requiere una copia de seguridad vigente antes de modificar DNS o red.' };
  }

  if (action === 'flush-dns') {
    const r = await runExec('ipconfig.exe', ['/flushdns'], 8000);
    return { ok: r.ok, message: r.ok ? 'Caché DNS vaciada correctamente.' : 'No se pudo vaciar la caché DNS.' };
  }

  const adapter = String(adapterName || '').trim();
  if (!adapter || adapter === 'Sin adaptador activo' || adapter.length > 160) {
    return { ok: false, error: 'No se encontró un adaptador de red activo.' };
  }

  let innerCmd = '';
  let label = '';
  const provider = DNS_PROVIDERS.find((p) => p.id === action);
  if (provider) {
    innerCmd = `Set-DnsClientServerAddress -InterfaceAlias ${psData(adapter)} -ServerAddresses (${psData(provider.primary)},${psData(provider.secondary)}); ipconfig /flushdns`;
    label = `DNS ${provider.name} (${provider.primary}) aplicado`;
  } else if (action === 'dns-dhcp') {
    innerCmd = `Set-DnsClientServerAddress -InterfaceAlias ${psData(adapter)} -ResetServerAddresses; ipconfig /flushdns`;
    label = 'DNS restaurado a Automático (DHCP)';
  } else {
    return { ok: false, error: 'Acción de red desconocida.' };
  }

  // Cambiar DNS requiere elevación UAC bajo demanda (el comando viaja como -EncodedCommand).
  const r = await runElevated(innerCmd, 30000);
  if (r.ok) {
    return { ok: true, message: `${label} en ${adapterName}.` };
  }
  return {
    ok: false,
    message: r.cancelled
      ? 'Elevación UAC cancelada por el usuario.'
      : `No se pudo aplicar el cambio de DNS en ${adapterName}.`,
  };
}

module.exports = {
  scanBloatware,
  removeBloatware,
  scanWingetUpgrades,
  runWingetUpgrade,
  uninstallWingetApp,
  scanNetworkAndDns,
  benchmarkDnsServers,
  applyNetworkAction,
  DNS_PROVIDERS,
};
