'use strict';

// Modo técnico: arma el informe de servicio para el cliente (HTML que main.js imprime a PDF).
const fs = require('fs');
const path = require('path');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ACTION_LABELS = {
  install: 'Instalación',
  uninstall: 'Desinstalación',
  'windows-setting': 'Ajuste de Windows',
  preset: 'Preset',
  startup: 'Programas al inicio',
  bloatware: 'Apps preinstaladas',
  network: 'Red / DNS',
  disk: 'Carpetas y discos',
  restore: 'Deshacer cambios',
  repair: 'Reparación de Windows',
  'scheduled-update': 'Actualización programada',
  cleanup: 'Limpieza',
  'restore-point': 'Punto de restauración',
  autopilot: 'Piloto automático',
};

function describeAction(e) {
  if (Array.isArray(e.items)) return e.items.map((i) => `${i.name || i.id}${i.ok === false ? ' (falló)' : ''}`).join(', ');
  if (e.action === 'cleanup' && e.freedBytes) return `${(e.freedBytes / 1024 ** 3).toFixed(1)} GB liberados`;
  return e.label || e.name || e.kind || e.settingId || '';
}

function logoSvg() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'icon.svg'), 'utf8');
  } catch {
    return '';
  }
}

function buildReportHtml({ client = '', technician = '', business = '', notes = '', hardware = null, pcCheck = null, comparison = [], installedApps = [], actions = [], generatedAt = new Date() } = {}) {
  const sys = hardware?.system || {};
  const comps = (hardware?.drivers || []).map((d) => `<tr><td>${esc(d.categoryLabel)}</td><td>${esc(d.name)}</td><td>${esc(d.installedVersionDisplay || d.installedVersion || '—')}</td></tr>`).join('');
  const checks = (pcCheck?.checks || []).map((c) => `<tr><td><span class="st st-${esc(c.status)}">${c.status === 'ok' ? 'Correcto' : c.status === 'warn' ? 'Revisar' : 'Info'}</span></td><td><strong>${esc(c.title)}</strong>${c.fix && c.status === 'warn' ? `<div class="fix">${esc(c.fix)}</div>` : ''}</td></tr>`).join('');
  const cmp = comparison.map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(m.before)} ${esc(m.unit)}</td><td>${esc(m.after)} ${esc(m.unit)}</td><td class="${m.same ? '' : m.improved ? 'good' : 'bad'}">${m.same ? '=' : `${m.changePct > 0 ? '+' : ''}${esc(m.changePct)}%`}</td></tr>`).join('');
  const acts = actions.map((e) => `<tr><td>${esc(new Date(e.at).toLocaleString('es'))}</td><td>${esc(ACTION_LABELS[e.action] || e.action)}</td><td>${esc(describeAction(e))}</td></tr>`).join('');
  const apps = installedApps.map((a) => `<span class="chip">${esc(a)}</span>`).join('');
  const date = new Date(generatedAt).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de servicio</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1d1d1f; font-size: 11px; line-height: 1.45; margin: 0; }
  header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1d1d1f; padding-bottom: 12px; margin-bottom: 16px; }
  header svg { width: 46px; height: 46px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: -0.02em; }
  h2 { font-size: 13px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 6px; }
  .meta div { background: #f5f5f7; border-radius: 8px; padding: 8px 10px; }
  .meta span { display: block; color: #6e6e73; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; }
  td, th { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e5e5ea; vertical-align: top; }
  th { font-size: 9.5px; color: #6e6e73; text-transform: uppercase; }
  .st { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 9.5px; font-weight: 600; }
  .st-ok { background: #e3f6e8; color: #1a7f37; } .st-warn { background: #fff1d6; color: #9a6700; } .st-info { background: #eef; color: #445; }
  .fix { color: #6e6e73; margin-top: 2px; }
  .good { color: #1a7f37; font-weight: 600; } .bad { color: #b42318; font-weight: 600; }
  .chip { display: inline-block; background: #f5f5f7; border-radius: 10px; padding: 2px 8px; margin: 2px; }
  .notes { white-space: pre-wrap; background: #f5f5f7; border-radius: 8px; padding: 10px; }
  footer { margin-top: 24px; color: #8e8e93; font-size: 9.5px; display: flex; justify-content: space-between; }
  .sign { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sign div { border-top: 1px solid #1d1d1f; padding-top: 4px; text-align: center; color: #6e6e73; }
  section { break-inside: avoid; }
</style></head><body>
<header>${logoSvg()}<div><h1>Informe de servicio técnico</h1><div>${esc(business || 'Servicio técnico')} · ${esc(date)}</div></div></header>
<div class="meta">
  <div><span>Cliente</span>${esc(client || '—')}</div>
  <div><span>Técnico</span>${esc(technician || '—')}</div>
  <div><span>Equipo</span>${esc(sys.hostname || '—')}</div>
  <div><span>Procesador</span>${esc(sys.cpuName || '—')}</div>
  <div><span>Memoria</span>${esc(sys.ramGb ? `${sys.ramGb} GB` : '—')}</div>
  <div><span>Sistema</span>${esc([sys.osName, sys.osBuild].filter(Boolean).join(' · ') || '—')}</div>
</div>
${comps ? `<section><h2>Componentes detectados</h2><table><tr><th>Componente</th><th>Modelo</th><th>Driver</th></tr>${comps}</table></section>` : ''}
${checks ? `<section><h2>Chequeo del equipo</h2><table>${checks}</table></section>` : ''}
${cmp ? `<section><h2>Antes y después</h2><table><tr><th>Medición</th><th>Antes</th><th>Después</th><th>Cambio</th></tr>${cmp}</table></section>` : ''}
${acts ? `<section><h2>Trabajo realizado</h2><table><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr>${acts}</table></section>` : ''}
${apps ? `<section><h2>Programas instalados</h2><div>${apps}</div></section>` : ''}
${notes ? `<section><h2>Observaciones</h2><div class="notes">${esc(notes)}</div></section>` : ''}
<div class="sign"><div>Firma del técnico</div><div>Firma del cliente</div></div>
<footer><span>Generado con XHANNIZER0 · Xhanni Studios</span><span>${esc(new Date(generatedAt).toLocaleString('es'))}</span></footer>
</body></html>`;
}

module.exports = { buildReportHtml, describeAction, esc };
