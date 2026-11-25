'use strict';

// Versiones de drivers EN VIVO: en lugar de números escritos a mano en el código (que quedan
// viejos), se pregunta a Windows Update qué driver WHQL más nuevo existe para el Hardware ID
// exacto de cada componente. Solo consulta: no descarga ni instala nada y no pide admin.

const { runPowerShell, psData } = require('./powershell');

// targets: [{ id, instanceIds: [], scope: 'system-pci' | 'storage-pci' | null }]
// Devuelve { ok, byId: { [id]: [{ title, version, date, provider }] } } o { ok: false }
async function checkDriverUpdates(targets) {
  const input = (targets || []).map((t) => ({
    id: String(t.id),
    instanceIds: (t.instanceIds || []).map(String),
    scope: t.scope || '',
  }));
  if (!input.length) return { ok: true, byId: {} };

  const ps = `
$ErrorActionPreference = 'Stop'
$targets = @(${psData(input)})
$map = @{}
foreach ($t in $targets) {
  $ids = @($t.instanceIds)
  if ($t.scope -eq 'system-pci') {
    $ids += @(Get-PnpDevice -PresentOnly -Class System -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like 'PCI\\*' } | ForEach-Object { $_.InstanceId })
  } elseif ($t.scope -eq 'storage-pci') {
    $ids += @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like 'PCI\\*' -and $_.Class -in @('SCSIAdapter','HDC') } | ForEach-Object { $_.InstanceId })
  }
  foreach ($i in ($ids | Where-Object { $_ } | Select-Object -Unique)) {
    $hw = (Get-PnpDeviceProperty -InstanceId $i -KeyName 'DEVPKEY_Device_HardwareIds' -ErrorAction SilentlyContinue).Data
    foreach ($h in @($hw)) { if ($h) { $k = ([string]$h).ToLower(); if (-not $map.ContainsKey($k)) { $map[$k] = @() }; $map[$k] += $t.id } }
  }
}
$res = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search("IsInstalled=0 and Type='Driver'")
$out = foreach ($u in $res.Updates) {
  $k = ([string]$u.DriverHardwareID).ToLower()
  if ($k -and $map.ContainsKey($k)) {
    foreach ($owner in ($map[$k] | Select-Object -Unique)) {
      [pscustomobject]@{ owner = $owner; title = [string]$u.Title; provider = [string]$u.DriverProvider; date = $(if ($u.DriverVerDate) { ([datetime]$u.DriverVerDate).ToString('yyyy-MM-dd') } else { '' }) }
    }
  }
}
ConvertTo-Json -InputObject @($out) -Compress`;

  const r = await runPowerShell(ps, 180000);
  if (!r.ok) return { ok: false };
  let list;
  try {
    list = JSON.parse(r.stdout || '[]');
    if (!Array.isArray(list)) list = [list];
  } catch {
    return { ok: false };
  }
  const byId = {};
  for (const m of list) {
    if (!m?.owner) continue;
    const version = (String(m.title).match(/(\d+\.\d+\.\d+\.\d+)/) || [])[1] || null;
    (byId[m.owner] = byId[m.owner] || []).push({ title: m.title, version, date: m.date || null, provider: m.provider || null });
  }
  return { ok: true, byId };
}

module.exports = { checkDriverUpdates };
