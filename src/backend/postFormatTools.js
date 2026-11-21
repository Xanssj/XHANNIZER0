'use strict';

const { execFile } = require('child_process');

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

  // Validar que solo se eliminen paquetes de nuestra lista blanca segura
  const allowedPrefixes = SAFE_BLOATWARE_LIST.map((b) => b.appxPattern.toLowerCase());
  const safeList = list.filter((fullName) =>
    allowedPrefixes.some((prefix) => String(fullName).toLowerCase().startsWith(prefix))
  );

  if (!safeList.length) {
    return { ok: false, error: 'Paquete bloqueado: solo se permite eliminar bloatware reversible autorizado.' };
  }

  let removed = 0;
  for (const fullName of safeList) {
    const safe = String(fullName).replace(/'/g, "''");
    const r = await runPowerShell(`Remove-AppxPackage -Package '${safe}' -ErrorAction Stop`, 15000);
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
  if (!wingetId) return { ok: false, error: 'ID inválido' };
  const args = wingetId === '__ALL__'
    ? ['upgrade', '--all', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity']
    : ['upgrade', '--id', String(wingetId), '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'];

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

// =========================================================================
// 3. DIAGNÓSTICO RÁPIDO DE RED Y DNS (Cloudflare / Google / DHCP / Flush)
// =========================================================================
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

async function applyNetworkAction({ action, adapterName, backupId }) {
  if (!backupId) {
    return { ok: false, error: 'Se requiere una copia de seguridad vigente antes de modificar DNS o red.' };
  }

  if (action === 'flush-dns') {
    const r = await runExec('ipconfig.exe', ['/flushdns'], 8000);
    return { ok: r.ok, message: r.ok ? 'Caché DNS vaciada correctamente.' : 'No se pudo vaciar la caché DNS.' };
  }

  const safeAdapter = String(adapterName || '').replace(/'/g, "''");
  if (!safeAdapter || safeAdapter === 'Sin adaptador activo') {
    return { ok: false, error: 'No se encontró un adaptador de red activo.' };
  }

  let innerCmd = '';
  let label = '';
  if (action === 'dns-cloudflare') {
    innerCmd = `Set-DnsClientServerAddress -InterfaceAlias '${safeAdapter}' -ServerAddresses ('1.1.1.1','1.0.0.1'); ipconfig /flushdns`;
    label = 'DNS Cloudflare (1.1.1.1) aplicado';
  } else if (action === 'dns-google') {
    innerCmd = `Set-DnsClientServerAddress -InterfaceAlias '${safeAdapter}' -ServerAddresses ('8.8.8.8','8.8.4.4'); ipconfig /flushdns`;
    label = 'DNS Google (8.8.8.8) aplicado';
  } else if (action === 'dns-dhcp') {
    innerCmd = `Set-DnsClientServerAddress -InterfaceAlias '${safeAdapter}' -ResetServerAddresses; ipconfig /flushdns`;
    label = 'DNS restaurado a Automático (DHCP)';
  } else {
    return { ok: false, error: 'Acción de red desconocida.' };
  }

  // Cambiar DNS requiere elevación UAC bajo demanda
  const escaped = innerCmd.replace(/"/g, '\\"');
  const elevCmd = `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "${escaped}"'`;
  const r = await runPowerShell(elevCmd, 25000);
  return {
    ok: r.ok,
    message: r.ok ? `${label} en ${adapterName}.` : 'Elevación UAC cancelada por el usuario.',
  };
}

module.exports = {
  scanBloatware,
  removeBloatware,
  scanWingetUpgrades,
  runWingetUpgrade,
  scanNetworkAndDns,
  applyNetworkAction,
};
