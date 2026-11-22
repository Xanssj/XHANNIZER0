'use strict';

// Perfiles compartibles como código de texto (XHZ1-…): las apps y ajustes elegidos se comprimen
// dentro del propio código, sin servidor. Al importar se valida todo y se ignora lo desconocido.
const zlib = require('zlib');

const PREFIX = 'XHZ1-';
const ID_RE = /^[a-z0-9][a-z0-9._+-]{0,79}$/i;
const MAX_CODE = 12000;
const MAX_JSON = 64 * 1024;

function cleanIds(list, max) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map(String).filter((s) => ID_RE.test(s)))).slice(0, max);
}

function encodeProfileCode({ name = '', appIds = [], settingIds = [] } = {}) {
  const payload = {
    v: 1,
    n: String(name || '').slice(0, 60),
    a: cleanIds(appIds, 400),
    s: cleanIds(settingIds, 100),
  };
  if (!payload.a.length && !payload.s.length) return { ok: false, error: 'El perfil está vacío: elige apps o aplica ajustes primero.' };
  const packed = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 }).toString('base64url');
  return { ok: true, code: PREFIX + packed, apps: payload.a.length, settings: payload.s.length };
}

function decodeProfileCode(code) {
  const text = String(code || '').trim().replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) return { ok: false, error: 'Ese no es un código de perfil de XHANNIZER0 (empieza con XHZ1-).' };
  if (text.length > MAX_CODE) return { ok: false, error: 'El código es demasiado largo.' };
  const body = text.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return { ok: false, error: 'El código tiene caracteres inválidos: cópialo completo.' };
  let data;
  try {
    const raw = zlib.inflateRawSync(Buffer.from(body, 'base64url'), { maxOutputLength: MAX_JSON });
    data = JSON.parse(raw.toString('utf8'));
  } catch {
    return { ok: false, error: 'El código está incompleto o dañado: cópialo completo.' };
  }
  if (!data || data.v !== 1) return { ok: false, error: 'Código de una versión no compatible.' };
  return {
    ok: true,
    name: String(data.n || '').slice(0, 60),
    appIds: cleanIds(data.a, 400),
    settingIds: cleanIds(data.s, 100),
  };
}

module.exports = { encodeProfileCode, decodeProfileCode, PREFIX };
