'use strict';

// USB de instalación de Windows 11 con la herramienta OFICIAL de Microsoft (Media Creation Tool).
// XHANNIZER0 solo la descarga desde el enlace oficial, verifica que esté firmada por Microsoft
// y la abre: la creación de la USB la hace la herramienta de Microsoft.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { shell } = require('electron');
const { runPowerShell, psData } = require('./powershell');

const MCT_URL = 'https://go.microsoft.com/fwlink/?linkid=2156295';
const ALLOWED_HOSTS = ['go.microsoft.com', 'download.microsoft.com'];

async function verifyMicrosoftSignature(filePath) {
  const r = await runPowerShell(
    `$s = Get-AuthenticodeSignature -LiteralPath ${psData(filePath)}; @{ status = [string]$s.Status; subject = [string]$s.SignerCertificate.Subject } | ConvertTo-Json -Compress`,
    20000
  );
  try {
    const sig = JSON.parse(r.stdout);
    return sig.status === 'Valid' && /O=Microsoft Corporation/i.test(sig.subject);
  } catch {
    return false;
  }
}

async function launchMediaCreationTool(onProgress = () => {}) {
  const { net } = require('electron');
  onProgress('Descargando la herramienta oficial de Microsoft…');
  let res;
  try {
    res = await net.fetch(MCT_URL);
  } catch (err) {
    return { ok: false, error: `No se pudo descargar (${err.message}).` };
  }
  const finalHost = (() => {
    try {
      return new URL(res.url).hostname;
    } catch {
      return '';
    }
  })();
  if (!res.ok || !ALLOWED_HOSTS.includes(finalHost)) {
    return { ok: false, error: 'La descarga no vino de los servidores de Microsoft.' };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = path.join(os.tmpdir(), 'XHANNIZER0_windows');
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, 'MediaCreationToolW11.exe');
  fs.writeFileSync(exe, buf);

  onProgress('Verificando la firma de Microsoft…');
  if (!(await verifyMicrosoftSignature(exe))) {
    fs.rmSync(exe, { force: true });
    return { ok: false, error: 'La herramienta no tiene una firma válida de Microsoft. Se borró por seguridad.' };
  }
  onProgress('Abriendo la herramienta de Microsoft…');
  const err = await shell.openPath(exe);
  return err ? { ok: false, error: err } : { ok: true };
}

module.exports = { launchMediaCreationTool };
