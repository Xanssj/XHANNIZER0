'use strict';

(function () {
  const api = window.xhApi;

  // Bloquea arrastre de archivos/enlaces hacia la ventana para evitar navegaciones accidentales a file://
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  function loadOmittedUpgrades() {
    try {
      const raw = JSON.parse(localStorage.getItem('xh_omitted_upgrades') || '[]');
      return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && x.trim()) : []);
    } catch {
      return new Set();
    }
  }

  function saveOmittedUpgrades() {
    try {
      localStorage.setItem('xh_omitted_upgrades', JSON.stringify(Array.from(state.omittedUpgrades)));
    } catch { /* almacenamiento no disponible */ }
  }

  // =========================================================================
  // Estado global de la aplicación
  // =========================================================================
  const state = {
    activeTab: 'resumen',
    previousTab: 'resumen',
    techMode: localStorage.getItem('xh_tech_mode') !== '0',
    backupCount: 0,
    driverFilter: 'all',
    devFilter: 'all',
    utilFilter: 'all',
    emuFilter: 'all',
    emuSearch: '',
    installFilters: {
      herramientas: 'all',
      launchers: 'all',
      navegadores: 'all',
      utilidades: 'all',
      dev: 'all',
    },
    searchQueries: {
      herramientas: '',
      launchers: '',
      navegadores: '',
      utilidades: '',
      dev: '',
    },
    hardware: null,
    catalog: [],
    emulators: [],
    emuReleases: new Map(), // repo -> { tag, publishedAt, asset }
    storeItems: [],
    presets: [],
    presetTiers: {},
    presetDisableVbs: false,
    wingetAvailable: false,
    disksData: null,
    recentBackup: null, // Respaldo verificado vigente (< 24h) en disco o sesión
    winAudit: null,
    startupApps: [],
    upgrades: [],
    upgradesNote: '',
    bloatware: [],
    networkInfo: null,
    pcCheck: null,
    migFolders: null,
    migration: null,
    cleanup: null,
    bench: null,
    pilot: null, // { status, startedAt, backupId, steps:[{id,enabled,status,note}], appIds, cleanupIds }
    pilotCode: null,
    pilotDraft: null,
    pilotSettingIds: [],
    theme: localStorage.getItem('xh_theme') || 'dark',
    lang: localStorage.getItem('xh_lang') || 'es',
    liteMode: ['auto', 'on', 'off'].includes(localStorage.getItem('xh_lite_mode')) ? localStorage.getItem('xh_lite_mode') : 'auto',
    liteActive: false,
    winNotify: localStorage.getItem('xh_win_notify') !== '0',
    livePaused: false,
    liveUserToggled: false,
    windowFocused: true,
    pendingDriverConfirm: null,
    auditLog: new Map(), // id -> { id, name, state, progress, detail, sourceType, sourceOrigin, sha256, signatureStatus, signatureSigner, timestamp }
    auditDrawerOpen: false,
    selected: new Map(), // id -> { id, type: 'driver'|'app'|'msstore', name, ... }
    omittedDrivers: new Set(),
    omittedUpgrades: loadOmittedUpgrades(),
    itemStatus: new Map(), // id -> { state, progress, detail }
    installing: false,
    pendingProtectedAction: null,
    backupRunning: false,
  };

  // =========================================================================
  // Utilidades DOM & Escape
  // =========================================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    }[ch]));
  }

  let toastTimer = null;
  function showToast(message) {
    const el = $('#xh-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 3800);
  }

  function notifyDone(title, body) {
    if (!state.winNotify || !api.notify) return;
    api.notify({ title, body }).catch(() => {});
  }

  function statusLabel(st) {
    return {
      pending: 'Pendiente',
      downloading: 'Descargando',
      installing: 'Instalando',
      done: 'Listo',
      warning: 'Aviso',
    }[st] || 'Pendiente';
  }

  function monogramFor(name) {
    const words = String(name || 'X').trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0].slice(0, 2).toUpperCase();
  }

  function appIconHtml(item) {
    const mono = esc(monogramFor(item.name));
    if (item.iconUrl) {
      return `<div class="app-monogram" aria-hidden="true"><img class="app-logo-img" src="${esc(item.iconUrl)}" alt="" loading="lazy" data-fallback="${mono}"></div>`;
    }
    return `<div class="app-monogram" aria-hidden="true">${mono}</div>`;
  }

  function driverIconSvg(category) {
    const icons = {
      gpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M16 10h2M16 14h2M6 18v2M18 18v2"/></svg>',
      igpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/><circle cx="16.5" cy="13.5" r="1.5"/></svg>',
      cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
      motherboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="5" height="5"/><path d="M15 7h2M15 11h2M7 16h10"/></svg>',
      audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
      network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
      storage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18"/><circle cx="17" cy="17" r="1"/></svg>',
    };
    return icons[category] || icons.cpu;
  }

  // =========================================================================
  // Motores Spring (Apple Design: interrumpibles y con amortiguación crítica)
  // =========================================================================
  const dockEl = $('#xh-batch-dock');
  const dockSpring = window.XhSpring.createSpring({
    value: 0,
    dampingRatio: 1.0,
    response: 0.34,
    onUpdate(v) {
      const y = (1 - v) * 96;
      dockEl.style.transform = `translate3d(-50%, ${y.toFixed(2)}px, 0)`;
      dockEl.style.opacity = String(Math.max(0, Math.min(1, v)));
    },
  });

  const sheetEl = $('#xh-backup-sheet');
  const sheetSpring = window.XhSpring.createSpring({
    value: 0,
    dampingRatio: 1.0,
    response: 0.3,
    onUpdate(v) {
      const scale = 0.94 + v * 0.06;
      const y = (1 - v) * 18;
      sheetEl.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      sheetEl.style.opacity = String(Math.max(0, Math.min(1, v)));
    },
  });

  const statusPopEl = $('#xh-status-pop');
  const popSpring = window.XhSpring.createSpring({
    value: 0,
    dampingRatio: 1.0,
    response: 0.24,
    onUpdate(v) {
      const scale = 0.95 + v * 0.05;
      const y = (1 - v) * -6;
      statusPopEl.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      statusPopEl.style.opacity = String(Math.max(0, Math.min(1, v)));
    },
  });

  const auditDrawerEl = $('#xh-audit-drawer');
  const auditSpring = window.XhSpring.createSpring({
    value: 0,
    dampingRatio: 1.0,
    response: 0.3,
    onUpdate(v) {
      const x = (1 - v) * 410;
      auditDrawerEl.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
      auditDrawerEl.style.opacity = String(Math.max(0, Math.min(1, v)));
    },
  });

  function setAuditDrawerOpen(open) {
    state.auditDrawerOpen = open;
    auditDrawerEl.classList.toggle('is-open', open);
    auditDrawerEl.setAttribute('aria-hidden', String(!open));
    const btn = $('#xh-downloads-btn');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    auditSpring.setTarget(open ? 1 : 0);
  }

  function renderAuditDrawer() {
    const listEl = $('#xh-audit-list');
    const countBadge = $('#xh-downloads-count');
    const entries = Array.from(state.auditLog.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (countBadge) {
      countBadge.textContent = String(entries.length);
      countBadge.hidden = entries.length === 0;
    }

    if (!listEl) return;
    if (!entries.length) {
      listEl.innerHTML = `
        <div class="audit-entry">
          <strong>Sin descargas recientes</strong>
          <span class="audit-origin-url">Cuando instales apps, drivers o emuladores verás aquí su canal oficial, URL/ID exacto y progreso en tiempo real.</span>
        </div>`;
      return;
    }

    listEl.innerHTML = entries
      .map(
        (entry) => `
      <div class="audit-entry">
        <div class="audit-entry-top">
          <strong title="${esc(entry.name)}">${esc(entry.name)}</strong>
          <span class="pill-badge state-${esc(entry.state)}">${esc(statusLabel(entry.state))}</span>
        </div>
        <div class="audit-origin-row">
          <span class="pill-badge is-recommended">${esc(entry.sourceType || 'Canal Oficial')}</span>
          <span class="pill-badge is-ok">Verificado</span>
        </div>
        <div class="audit-origin-url">${esc(entry.sourceOrigin || 'Oficial')}</div>
        ${entry.sha256 || entry.signatureStatus
          ? `<div class="audit-crypto-box">
              ${entry.sha256 ? `<div>SHA-256: ${esc(entry.sha256)}</div>` : ''}
              ${entry.signatureStatus ? `<div>Firma: ${esc(entry.signatureStatus)}${entry.signatureSigner ? ` (${esc(entry.signatureSigner)})` : ''}</div>` : ''}
            </div>`
          : ''}
        <div class="item-progress">
          <div class="item-progress-head">
            <span class="item-progress-detail">${esc(entry.detail || '')}</span>
            <span class="item-progress-pct">${Math.round(entry.progress || 0)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar ${entry.state === 'done' ? 'is-done' : entry.state === 'warning' ? 'is-warn' : entry.state === 'installing' ? 'is-installing' : ''}" style="width:${Math.round(entry.progress || 0)}%"></div>
          </div>
        </div>
      </div>`
      )
      .join('');
  }

  // =========================================================================
  // Chrome de ventana estilo macOS / Xhanni Consola + Scroll independiente
  // =========================================================================
  const contentEl = $('.owner-content');

  function initChrome() {
    $$('[data-win]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.windowAction(btn.dataset.win);
      });
      btn.addEventListener('dblclick', (e) => e.stopPropagation());
    });

    const titlebar = $('#xh-titlebar');
    titlebar.addEventListener('dblclick', () => api.windowAction('zoom'));

    // Escucha el scroll del contenedor .owner-content (arregla el bug de scroll del sidebar)
    const onScroll = () => titlebar.classList.toggle('is-scrolled', contentEl.scrollTop > 4);
    contentEl.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Fallback automático si falla la carga de un ícono oficial (sin inline onerror por CSP)
    document.addEventListener(
      'error',
      (e) => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && (img.classList.contains('app-logo-img') || img.classList.contains('vendor-logo-img'))) {
          const parent = img.parentElement;
          if (parent) parent.textContent = img.dataset.fallback || 'X';
        }
      },
      true
    );

    // Tema Claro / Oscuro (Apple Glass)
    let themeBooted = false;
    const applyTheme = (theme) => {
      if (themeBooted) window.XhMotion?.animateThemeSwitch?.();
      themeBooted = true;
      state.theme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = state.theme;
      localStorage.setItem('xh_theme', state.theme);
      api.setTheme(state.theme);
      syncSettingsUi();
    };
    state.applyTheme = applyTheme;
    applyTheme(state.theme);

    // Idioma ES / EN
    const I18N = {
      es: {
        downloads: 'Descargas',
        export_profile: 'Exportar',
        import_profile: 'Importar',
        nav_startup: 'Inicio Windows',
        startup_title: 'Gestor de Inicio de Windows',
        startup_sub: 'Controla qué programas arrancan con tu PC. Desactivar apps innecesarias acelera el inicio tras formatear (100% reversible).',
        refresh: 'Actualizar lista',
        tabs: {
          drivers: 'Drivers',
          herramientas: 'Herramientas',
          launchers: 'Launchers',
          navegadores: 'Navegadores',
          utilidades: 'Compresores',
          dev: 'Programadores',
          emuladores: 'Emuladores',
          store: 'Microsoft Store',
          presets: 'Presets',
          'windows-audit': 'Auditoría Windows',
          startup: 'Inicio Windows',
          upgrades: 'Actualizaciones',
          'cleaner-net': 'Limpieza y Red',
          discos: 'Carpetas y Discos',
        },
      },
      en: {
        downloads: 'Downloads',
        export_profile: 'Export',
        import_profile: 'Import',
        nav_startup: 'Windows Startup',
        startup_title: 'Windows Startup Manager',
        startup_sub: 'Control which programs start with Windows. Disabling unnecessary apps speeds up boot time (100% reversible).',
        refresh: 'Refresh list',
        tabs: {
          drivers: 'Drivers',
          herramientas: 'Tools',
          launchers: 'Launchers',
          navegadores: 'Browsers',
          utilidades: 'Archivers & Utils',
          dev: 'Developers',
          emuladores: 'Emulators',
          store: 'Microsoft Store',
          presets: 'Presets',
          'windows-audit': 'Windows Audit',
          startup: 'Windows Startup',
          upgrades: 'Updates',
          'cleaner-net': 'Cleaner & Net',
          discos: 'Folders & Disks',
        },
      },
    };

    const applyLanguage = (lang) => {
      state.lang = lang === 'en' ? 'en' : 'es';
      localStorage.setItem('xh_lang', state.lang);
      document.documentElement.lang = state.lang;
      const dict = I18N[state.lang];
      $$('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        if (dict[key]) el.textContent = dict[key];
      });
      if (window.XhI18n) window.XhI18n.apply(state.lang);
      syncSettingsUi();
      requestAnimationFrame(() => window.XhMotion?.syncAllSliders?.(true));
    };
    applyLanguage(state.lang);
    state.applyLanguage = applyLanguage;

    api.onWindowState((st) => {
      state.windowFocused = Boolean(st.focused);
      document.documentElement.classList.toggle('xh-blurred', !st.focused);
      document.documentElement.classList.toggle('xh-maximized', Boolean(st.maximized));
      window.XhMotion?.handleWindowEvent?.(st);
      syncLiveMonitorSchedule();
    });

    // Popover de estado arriba a la derecha
    const statusBtn = $('#xh-status-btn');
    let popOpen = false;
    const setPopOpen = (open) => {
      popOpen = open;
      statusBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        statusPopEl.hidden = false;
        popSpring.setTarget(1);
        refreshBackupCount();
      } else {
        popSpring.setTarget(0);
        setTimeout(() => {
          if (!popOpen) statusPopEl.hidden = true;
        }, 220);
      }
    };

    statusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setPopOpen(!popOpen);
    });
    document.addEventListener('click', (e) => {
      if (popOpen && !$('#xh-status-wrap').contains(e.target)) setPopOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (popOpen) setPopOpen(false);
        if (state.pendingProtectedAction && !state.backupRunning) {
          const onCancel = state.pendingProtectedAction.onCancel;
          closeBackupModal();
          if (typeof onCancel === 'function') onCancel();
        }
      }
    });

    $('#btn-open-backups').addEventListener('click', () => {
      setPopOpen(false);
      api.openPath();
    });
    $('#btn-pop-rescan').addEventListener('click', () => {
      setPopOpen(false);
      scanHardware(true);
    });

    // Botón y drawer de Auditoría de Descargas a la derecha
    $('#xh-downloads-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (popOpen) setPopOpen(false);
      setAuditDrawerOpen(!state.auditDrawerOpen);
    });
    $('#btn-audit-close').addEventListener('click', () => setAuditDrawerOpen(false));
    $('#btn-audit-clear').addEventListener('click', () => {
      state.auditLog.clear();
      renderAuditDrawer();
    });
    $('#btn-audit-open-backups').addEventListener('click', () => api.openPath());
  }

  function updateStatusPill() {
    const wrap = $('#xh-status-wrap');
    const label = $('#xh-status-label');
    const qState = $('#pop-queue-state');
    if (state.installing) {
      const statuses = Array.from(state.itemStatus.values());
      const done = statuses.filter((s) => s.state === 'done' || s.state === 'warning').length;
      const total = statuses.length;
      wrap.dataset.level = 'busy';
      label.textContent = `Instalando ${done}/${total}…`;
      qState.textContent = `${done} de ${total}`;
      return;
    }
    const adv = state.hardware?.advisoriesCount || 0;
    wrap.dataset.level = adv > 0 ? 'warn' : 'ready';
    label.textContent = adv > 0 ? `${adv} aviso${adv > 1 ? 's' : ''} en drivers` : 'Sistema listo';
    qState.textContent = state.selected.size > 0 ? `${state.selected.size} en selección` : 'Inactiva';
  }

  async function refreshBackupCount() {
    try {
      const res = await api.listBackups();
      const count = res?.backups?.length || 0;
      state.backupCount = count;
      state.recentBackup = res?.recentBackup || state.recentBackup || null;
      $('#pop-backup-count').textContent = state.recentBackup
        ? `${count} (vigente)`
        : `${count} guardada${count === 1 ? '' : 's'}`;
      const sidePill = $('#side-safety-pill');
      if (sidePill) {
        sidePill.innerHTML = state.recentBackup
          ? `<span class="status-dot"></span><span>Respaldo vigente listo</span>`
          : `<span class="status-dot warn"></span><span>Sin respaldo reciente</span>`;
      }
      renderDashboard();
    } catch {
      // Ignorar
    }
  }

  // Puerta inteligente de respaldo: si ya existe una copia vigente (< 24h), permite avanzar directo;
  // si NO existe, obliga a crearla mediante la casilla de seguridad antes de continuar.
  function ensureVerifiedBackup({ scope, label, detail, items, targetPath, onConfirmed, onCancel, forceNew = false }) {
    if (!forceNew && state.recentBackup?.id) {
      showToast(`Respaldo vigente verificado (${state.recentBackup.id}).`);
      if (typeof onConfirmed === 'function') onConfirmed(state.recentBackup);
      return;
    }
    openBackupModal({
      scope,
      label,
      detail,
      items,
      targetPath,
      onConfirmed: async (backupRes) => {
        state.recentBackup = backupRes;
        await refreshBackupCount();
        if (typeof onConfirmed === 'function') await onConfirmed(backupRes);
      },
      onCancel,
    });
  }

  // =========================================================================
  // Navegación lateral agrupada + sub-pestañas + Dashboard + Ajustes
  // =========================================================================
  const NAV_GROUPS = {
    catalog: ['herramientas', 'launchers', 'navegadores', 'utilidades', 'dev', 'emuladores', 'store'],
    windows: ['windows-audit', 'startup', 'cleaner-net'],
    tools: ['migracion', 'mantenimiento', 'rendimiento'],
  };
  const groupForTab = (tab) => Object.keys(NAV_GROUPS).find((g) => NAV_GROUPS[g].includes(tab)) || null;

  function shouldEnableLiteMode(mode, sys) {
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return true;
    if (sys) {
      const ramGb = Number(sys.ramGb || 0);
      const threads = Number(sys.threads || 0);
      if (ramGb > 0 && ramGb <= 8) return true;
      if (threads > 0 && threads <= 4) return true;
      if (!sys.dedicatedGpuName) return true;
      return false;
    }
    const hc = Number(navigator.hardwareConcurrency || 0);
    return hc > 0 && hc <= 4;
  }

  function applyLiteMode({ fromHardware = false } = {}) {
    const active = shouldEnableLiteMode(state.liteMode, state.hardware?.system || null);
    state.liteActive = active;
    if (active) document.documentElement.setAttribute('data-lite', 'true');
    else document.documentElement.removeAttribute('data-lite');
    window.XhMotion?.setLiteMode?.(active);

    if (fromHardware && state.liteMode === 'auto' && active && !state.liveUserToggled) {
      state.livePaused = true;
    }
    syncSettingsUi();
    syncLiveMonitorSchedule();
  }

  function syncSettingsUi() {
    $$('[data-settings-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset.settingsLang === state.lang));
    $$('[data-settings-theme]').forEach((b) => b.classList.toggle('is-active', b.dataset.settingsTheme === state.theme));
    $$('[data-settings-lite]').forEach((b) => b.classList.toggle('is-active', b.dataset.settingsLite === state.liteMode));
    const liteHint = $('#settings-lite-hint');
    if (liteHint) {
      if (state.liteMode === 'on') {
        liteHint.textContent = 'Activado manualmente: sin blur, sombras ni animaciones 3D.';
      } else if (state.liteMode === 'off') {
        liteHint.textContent = 'Desactivado: efectos visuales completos activos.';
      } else if (state.liteActive) {
        liteHint.textContent = 'Automático (activo en este PC): modo ligero encendido para máxima fluidez.';
      } else {
        liteHint.textContent = 'Automático (efectos completos): tu PC tiene recursos suficientes.';
      }
    }
    const techToggle = $('#toggle-tech-mode');
    if (techToggle) techToggle.checked = Boolean(state.techMode);
    const notifyToggle = $('#toggle-win-notify');
    if (notifyToggle) notifyToggle.checked = Boolean(state.winNotify);
    const reportSec = $('#tech-report-section');
    if (reportSec) reportSec.hidden = !state.techMode;
  }

  // ---------- Monitor en vivo liviano (solo activo en Resumen y con ventana enfocada)
  let liveTimer = null;
  let liveBusy = false;

  async function pollLiveMetrics() {
    if (liveBusy || !api.liveMetrics) return;
    liveBusy = true;
    try {
      const m = await api.liveMetrics();
      if (!m?.ok) return;
      const cpuEl = $('#live-cpu-val');
      const cpuBar = $('#live-cpu-bar');
      if (cpuEl) cpuEl.textContent = `${m.cpuPct} %`;
      if (cpuBar) cpuBar.style.width = `${Math.max(2, Math.min(100, m.cpuPct))}%`;

      const ramEl = $('#live-ram-val');
      const ramBar = $('#live-ram-bar');
      if (ramEl) ramEl.textContent = `${m.ramUsedGb} / ${m.ramTotalGb} GB (${m.ramPct} %)`;
      if (ramBar) ramBar.style.width = `${Math.max(2, Math.min(100, m.ramPct))}%`;

      if (m.disk) {
        const dLbl = $('#live-disk-label');
        const dVal = $('#live-disk-val');
        const dBar = $('#live-disk-bar');
        if (dLbl) dLbl.textContent = `Disco ${m.disk.drive}`;
        if (dVal) dVal.textContent = `${m.disk.freeGb} GB libres (${m.disk.usedPct} %)`;
        if (dBar) dBar.style.width = `${Math.max(2, Math.min(100, m.disk.usedPct))}%`;
      }

      const gpuWrap = $('#live-gpu-wrap');
      if (gpuWrap && m.gpu) {
        gpuWrap.hidden = false;
        const gVal = $('#live-gpu-val');
        const gBar = $('#live-gpu-bar');
        if (gVal) gVal.textContent = `${m.gpu.tempC} °C${m.gpu.utilPct != null ? ` · ${m.gpu.utilPct} %` : ''}`;
        if (gBar) gBar.style.width = `${Math.max(5, Math.min(100, Math.round((m.gpu.tempC / 95) * 100)))}%`;
      }
    } catch {
      // Ignorar fallos transitorios
    } finally {
      liveBusy = false;
    }
  }

  function syncLiveMonitorSchedule() {
    const active = state.activeTab === 'resumen' && state.windowFocused && !state.livePaused;
    const dot = $('#live-monitor-dot');
    const stEl = $('#live-monitor-state');
    const btn = $('#btn-live-toggle');
    if (dot) dot.classList.toggle('is-paused', !active);
    if (stEl) stEl.textContent = state.livePaused ? 'En pausa' : active ? 'Actualizando cada 3 s' : 'En espera';
    if (btn) btn.textContent = state.livePaused ? 'Reanudar' : 'Pausar';

    if (active) {
      if (!liveTimer) {
        pollLiveMetrics();
        liveTimer = setInterval(pollLiveMetrics, 3000);
      }
    } else if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
  }

  function renderDashboard() {
    const sys = state.hardware?.system || null;
    if (sys) {
      const kind = sys.isVirtualMachine ? 'Máquina virtual' : sys.isLaptop ? 'Portátil' : 'PC de escritorio';
      $('#dash-form-badge').textContent = kind;
      $('#dash-os-line').textContent = [sys.osName, sys.osBuild ? `Compilación ${sys.osBuild}` : ''].filter(Boolean).join(' · ') || 'Windows';
      $('#dash-pc-title').textContent = sys.isBrandSystem && sys.model ? sys.model : (sys.hostname || 'Tu PC');
      const gpuText = sys.dedicatedGpuName
        ? `${sys.dedicatedGpuName}${sys.dedicatedGpuVramGb ? ` (${sys.dedicatedGpuVramGb} GB)` : ''}`
        : (sys.integratedGpuName || 'Gráficos integrados');
      $('#dash-specs-line').textContent = [sys.cpuName, gpuText, sys.ramGb ? `${sys.ramGb} GB RAM` : ''].filter(Boolean).join(' · ');

      const updates = state.hardware.updatesCount || 0;
      const advisories = state.hardware.advisoriesCount || 0;
      $('#dash-kpi-drivers').textContent = updates > 0 ? `${updates} por actualizar` : 'Al día';
      $('#dash-kpi-drivers-sub').textContent = advisories > 0
        ? `${state.hardware.drivers.length} componentes · ${advisories} aviso(s)`
        : `${state.hardware.drivers.length} componentes detectados`;
      const drvCard = $('#dash-card-drivers');
      if (drvCard) {
        drvCard.classList.toggle('tone-warn', updates > 0 || advisories > 0);
        drvCard.classList.toggle('tone-ok', updates === 0 && advisories === 0);
      }
    }

    if (state.pcCheck) {
      const w = state.pcCheck.warnCount || 0;
      const d = state.pcCheck.devices?.length || 0;
      // pcCheck.warnCount ya incluye los dispositivos con problemas (d): no sumarlos dos veces.
      const checkWarns = Math.max(0, w - d);
      const totalReview = Math.max(w, d);
      $('#dash-kpi-pccheck').textContent = totalReview > 0 ? `${totalReview} por revisar` : 'Todo correcto';
      $('#dash-kpi-pccheck-sub').textContent = d > 0
        ? `${checkWarns} avisos de BIOS/armado · ${d} dispositivo(s)`
        : `${state.pcCheck.checks?.length || 0} comprobaciones completadas`;
      const pcCard = $('#dash-card-pccheck');
      if (pcCard) {
        pcCard.classList.toggle('tone-warn', totalReview > 0);
        pcCard.classList.toggle('tone-ok', totalReview === 0);
      }
    }

    const totalApps = (state.catalog?.length || 0) + (state.emulators?.length || 0);
    if (totalApps > 0) {
      const inst = state.catalog.filter((i) => i.installed).length;
      $('#dash-kpi-apps').textContent = `${inst} instaladas`;
      $('#dash-kpi-apps-sub').textContent = `${totalApps} disponibles en catálogo y emuladores`;
      const catBadge = $('#badge-catalog-total');
      if (catBadge) {
        catBadge.textContent = String(totalApps);
        catBadge.hidden = false;
      }
    }

    $('#dash-kpi-backup').textContent = state.recentBackup ? 'Vigente' : `${state.backupCount || 0} guardadas`;
    $('#dash-kpi-backup-sub').textContent = state.recentBackup
      ? `${state.backupCount || 1} respaldo(s) · listo para cambios`
      : 'Se creará uno automáticamente antes de cambiar nada';
    const bkCard = $('#dash-card-backup');
    if (bkCard) {
      bkCard.classList.toggle('tone-ok', Boolean(state.recentBackup));
      bkCard.classList.toggle('tone-warn', !state.recentBackup);
    }
  }

  function activateTab(target) {
    if (state.activeTab !== target) {
      state.previousTab = state.activeTab;
      state.activeTab = target;
    }
    const activeGroup = groupForTab(target);
    $$('#sidebar-nav .owner-menu-item').forEach((li) => {
      const btn = li.querySelector('[data-tab]');
      const isMatch = btn && (btn.dataset.tab === target || (activeGroup && btn.dataset.navGroup === activeGroup));
      li.classList.toggle('is-active', Boolean(isMatch));
    });
    $$('.side-foot-nav [data-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === target);
    });
    Object.keys(NAV_GROUPS).forEach((g) => {
      const bar = $(`#subnav-${g}`);
      if (bar) bar.hidden = g !== activeGroup;
    });
    $$('.xh-subnav-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === target);
    });
    $$('.owner-tab-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === `tab-${target}`);
    });
    contentEl.scrollTop = 0;
    $('#xh-titlebar').classList.remove('is-scrolled');
    if (window.XhMotion) {
      window.XhMotion.animatePanelEnter($(`#tab-${target}`));
      requestAnimationFrame(() => window.XhMotion.syncAllSliders(false));
    }

    if (target === 'resumen') renderDashboard();
    syncLiveMonitorSchedule();
    if (target === 'ajustes') syncSettingsUi();
    if (target === 'emuladores' && !state.emulators.length) loadEmulators();
    if (target === 'store' && !state.storeItems.length) loadFeaturedStore();
    if (target === 'presets') loadPresets();
    if (target === 'windows-audit' && !state.winAudit) loadWindowsAudit();
    if (target === 'startup') loadStartupApps();
    if (target === 'upgrades' && !state.upgrades.length) loadUpgrades(false);
    if (target === 'cleaner-net' && !state.networkInfo) loadCleanerAndNet(false);
    if (target === 'discos') loadDisks();
    if (target === 'pc-check' && !state.pcCheck) loadPcCheck();
    if (target === 'migracion' && !state.migFolders) loadMigrationFolders();
    if (target === 'mantenimiento') loadMaintenance();
    if (target === 'piloto') renderPilot();
    if (target === 'rendimiento') { syncSettingsUi(); loadBenchmark(); }
    if (target === 'acerca') loadAbout();
  }

  // =========================================================================
  // Acerca de y soporte
  // =========================================================================
  const ABOUT_LINKS = {
    discord: 'https://discord.gg/QKmUekvX2X',
    web: 'https://xhannistudios.org',
    team: 'https://xhannistudios.org/nosotros',
    github: 'https://github.com/Xanssj/XHANNIZER0',
    changelog: 'https://github.com/Xanssj/XHANNIZER0/blob/main/CHANGELOG.md',
    privacy: 'https://github.com/Xanssj/XHANNIZER0/blob/main/PRIVACY.md',
  };

  async function loadAbout() {
    try {
      const info = await api.appInfo();
      if (!info?.ok) return;
      const edition = info.portable ? 'portable' : info.packaged ? 'instalada' : 'desde el código';
      $('#about-version').textContent = `Versión ${info.version} · edición ${edition} · Electron ${info.electron}`;
    } catch {
      // Se queda con el texto por defecto
    }
  }

  function initAbout() {
    $('#tab-acerca').addEventListener('click', async (e) => {
      const link = e.target.closest('[data-about-link]');
      if (link && ABOUT_LINKS[link.dataset.aboutLink]) api.openExternal(ABOUT_LINKS[link.dataset.aboutLink]);
    });
    $('#btn-about-data').addEventListener('click', async () => {
      const res = await api.openDataFolder();
      if (!res?.ok) showToast(res?.error || 'No se pudo abrir la carpeta de datos.');
    });
    $('#btn-about-report').addEventListener('click', async () => {
      const res = await api.exportDiagnostics();
      if (res?.canceled) return;
      if (res?.ok) showToast(`Diagnóstico guardado en ${res.path}. Adjúntalo en tu ticket de Discord.`);
      else showToast(res?.error || 'No se pudo guardar el diagnóstico; igual puedes abrir un ticket.');
      api.openExternal(ABOUT_LINKS.discord);
    });
    $('#btn-about-update').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const st = await api.updateCheck();
        if (st?.state === 'downloading') showToast(`Descargando v${st.version || ''} en segundo plano. Te avisamos arriba cuando esté lista.`);
        else if (st?.state === 'ready') showToast('La actualización ya está lista: toca «Reiniciar para actualizar» arriba.');
        else if (st?.state === 'portable') showToast(`Hay una versión nueva (v${st.version}). Toca el botón de arriba para descargar la portable.`);
        else if (st?.state === 'dev') showToast('Modo desarrollo: las actualizaciones automáticas solo funcionan en la app instalada.');
        else if (st?.state === 'error') showToast('No se pudo revisar: sin conexión o GitHub no respondió.');
        else showToast('Ya tienes la última versión.');
      } catch {
        showToast('No se pudo revisar: sin conexión o GitHub no respondió.');
      } finally {
        btn.disabled = false;
      }
    });
  }

  function initSettings() {
    $$('[data-settings-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.applyLanguage) state.applyLanguage(btn.dataset.settingsLang);
        showToast(state.lang === 'en' ? 'Language switched to English.' : 'Idioma cambiado a Español.');
      });
    });
    $$('[data-settings-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.applyTheme) state.applyTheme(btn.dataset.settingsTheme);
      });
    });
    $$('[data-settings-lite]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.settingsLite;
        if (!['auto', 'on', 'off'].includes(mode)) return;
        state.liteMode = mode;
        localStorage.setItem('xh_lite_mode', mode);
        applyLiteMode();
        showToast(
          mode === 'on'
            ? 'Modo ligero activado.'
            : mode === 'off'
            ? 'Modo ligero desactivado.'
            : state.liteActive
            ? 'Modo ligero en Automático (activo en este PC).'
            : 'Modo ligero en Automático (efectos completos).'
        );
      });
    });
    $('#toggle-tech-mode')?.addEventListener('change', (e) => {
      state.techMode = Boolean(e.target.checked);
      localStorage.setItem('xh_tech_mode', state.techMode ? '1' : '0');
      syncSettingsUi();
      showToast(state.techMode ? 'Modo técnico activado.' : 'Modo técnico oculto.');
    });
    $('#toggle-win-notify')?.addEventListener('change', (e) => {
      state.winNotify = Boolean(e.target.checked);
      localStorage.setItem('xh_win_notify', state.winNotify ? '1' : '0');
      showToast(state.winNotify ? 'Notificaciones de Windows activadas.' : 'Notificaciones de Windows desactivadas.');
    });
    $('#btn-live-toggle')?.addEventListener('click', () => {
      state.liveUserToggled = true;
      state.livePaused = !state.livePaused;
      syncLiveMonitorSchedule();
    });
    $('#btn-dns-benchmark')?.addEventListener('click', () => runDnsBenchmark());
    $('#btn-settings-setup')?.addEventListener('click', () => openSetup());
    $('#btn-settings-backups')?.addEventListener('click', () => api.openPath());
    $('#btn-settings-data')?.addEventListener('click', async () => {
      const res = await api.openDataFolder();
      if (!res?.ok) showToast(res?.error || 'No se pudo abrir la carpeta de datos.');
    });
    $('#btn-dash-rescan')?.addEventListener('click', () => scanHardware(true));
    $('#btn-dash-copy-specs')?.addEventListener('click', () => copyPcSpecs());
    $('#btn-save-local-profile')?.addEventListener('click', () => saveCurrentLocalProfile());
    $('#saved-profiles-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const list = state.savedProfiles || [];
      if (btn.dataset.loadProfile) {
        const p = list.find((x) => x.id === btn.dataset.loadProfile);
        if (!p) return;
        let added = 0;
        for (const id of p.appIds || []) {
          const item = state.catalog.find((c) => c.id === id);
          if (item && !state.selected.has(id)) {
            state.selected.set(id, { id: item.id, type: 'app', name: item.name, officialUrl: item.officialUrl });
            added += 1;
          }
        }
        renderAllCatalogSections();
        updateBatchDock();
        showToast(`Perfil «${p.name}» cargado (${added} app(s) añadidas al lote).`);
      } else if (btn.dataset.shareProfile) {
        const p = list.find((x) => x.id === btn.dataset.shareProfile);
        if (!p) return;
        const res = await api.profileCodeEncode({ name: p.name, appIds: p.appIds, settingIds: p.settingIds });
        showToast(res?.ok ? `Código de «${p.name}» copiado al portapapeles.` : res?.error || 'No se pudo generar el código.');
      } else if (btn.dataset.deleteProfile) {
        const res = await api.profilesDelete(btn.dataset.deleteProfile);
        if (res?.ok) {
          state.savedProfiles = res.items || [];
          renderSavedProfiles();
          showToast('Perfil eliminado.');
        }
      }
    });
    syncSettingsUi();
  }

  async function copyPcSpecs() {
    const hw = state.hardware;
    if (!hw?.system) {
      showToast('Espera a que termine el escaneo de hardware.');
      return;
    }
    const sys = hw.system;
    const board = hw.drivers?.find((d) => d.category === 'motherboard');
    const disks = (hw.drivers || []).filter((d) => d.category === 'storage').map((d) => d.name);
    const kind = sys.isVirtualMachine ? 'Máquina virtual' : sys.isLaptop ? 'Portátil' : 'PC de escritorio';
    const lines = [
      `PC: ${sys.isBrandSystem && sys.model ? sys.model : (sys.hostname || 'Windows PC')} (${kind})`,
      `Sistema: ${[sys.osName, sys.osBuild ? `Build ${sys.osBuild}` : ''].filter(Boolean).join(' · ')}`,
      `CPU: ${sys.cpuName || '—'}`,
      sys.dedicatedGpuName ? `GPU: ${sys.dedicatedGpuName}${sys.dedicatedGpuVramGb ? ` (${sys.dedicatedGpuVramGb} GB)` : ''}` : null,
      sys.integratedGpuName ? `iGPU: ${sys.integratedGpuName}` : null,
      `RAM: ${sys.ramGb ? `${sys.ramGb} GB` : '—'}`,
      board ? `Placa madre: ${board.name}${board.installedVersionDisplay || board.installedVersion ? ` (${board.installedVersionDisplay || board.installedVersion})` : ''}` : null,
      disks.length ? `Almacenamiento: ${disks.join(', ')}` : null,
    ].filter(Boolean);
    const res = await api.copyText(lines.join('\n'));
    showToast(res?.ok ? 'Especificaciones del PC copiadas al portapapeles.' : 'No se pudieron copiar las especificaciones.');
  }

  async function loadSavedProfiles() {
    try {
      const res = await api.profilesList();
      state.savedProfiles = res?.items || [];
    } catch {
      state.savedProfiles = [];
    }
    renderSavedProfiles();
  }

  function renderSavedProfiles() {
    const el = $('#saved-profiles-list');
    if (!el) return;
    const list = state.savedProfiles || [];
    if (!list.length) {
      el.innerHTML = `<article class="driver-card"><p class="section-subtitle">Todavía no guardaste perfiles propios. Selecciona apps en el Catálogo, ponle nombre arriba y guárdalo.</p></article>`;
      return;
    }
    el.innerHTML = list
      .map(
        (p) => `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-name">${esc(p.name)}</div>
            <div class="driver-meta">
              <span>${p.appIds?.length || 0} programa(s) · ${p.settingIds?.length || 0} ajuste(s)</span>
              <span>Guardado el ${esc(String(p.createdAt || '').slice(0, 10))}</span>
            </div>
          </div>
          <div class="driver-actions">
            <button type="button" class="btn-action-small is-primary" data-load-profile="${esc(p.id)}">Cargar al lote</button>
            <button type="button" class="btn-action-small is-ghost" data-share-profile="${esc(p.id)}">Copiar código</button>
            <button type="button" class="btn-action-small is-ghost" data-delete-profile="${esc(p.id)}">Eliminar</button>
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  async function saveCurrentLocalProfile() {
    const input = $('#saved-profile-name');
    const name = String(input?.value || '').trim();
    if (!name) {
      showToast('Escribe un nombre para el perfil.');
      input?.focus();
      return;
    }
    const appIds = Array.from(state.selected.values()).filter((t) => t.type === 'app').map((t) => t.id);
    const settingIds = (state.winAudit?.items || []).filter((i) => i.isOptimal && i.id !== 'win-refresh-rate').map((i) => i.id);
    const res = await api.profilesSave({ name, appIds, settingIds });
    if (res?.ok) {
      state.savedProfiles = res.items || [];
      if (input) input.value = '';
      renderSavedProfiles();
      showToast(`Perfil «${name}» guardado.`);
    } else {
      showToast(res?.error || 'No se pudo guardar el perfil.');
    }
  }

  function initNavigation() {
    const navigateTo = (target) => {
      if (target === 'discos' && !state.recentBackup?.id) {
        const fallbackTab = state.activeTab;
        activateTab('discos');
        ensureVerifiedBackup({
          scope: 'system',
          label: 'Acceso protegido a Carpetas y Discos',
          detail: 'No se detectó una copia de seguridad reciente. Por seguridad, crea un respaldo preventivo del sistema antes de modificar o reordenar carpetas y discos.',
          items: ['Respaldo preventivo de sistema y estructura de carpetas'],
          onConfirmed: () => {
            showToast('Copia de seguridad verificada. Sección Carpetas y Discos desbloqueada.');
          },
          onCancel: () => {
            activateTab(fallbackTab === 'discos' ? 'resumen' : fallbackTab);
          },
        });
        return;
      }
      activateTab(target);
    };

    $$('#sidebar-nav [data-tab], .side-foot-nav [data-tab], .xh-subnav [data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
    });

    // Atajos de teclado rápidos: Ctrl+, (Ajustes) y Ctrl+1..9 (secciones principales)
    const QUICK_KEYS = ['resumen', 'piloto', 'drivers', 'pc-check', 'herramientas', 'presets', 'upgrades', 'windows-audit', 'discos'];
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === ',') {
        e.preventDefault();
        navigateTo('ajustes');
        return;
      }
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < QUICK_KEYS.length) {
        e.preventDefault();
        navigateTo(QUICK_KEYS[idx]);
      }
    });
  }

  // =========================================================================
  // Render de Drivers (Sección Principal — con iGPU/dGPU exacto)
  // =========================================================================
  async function scanHardware(notify = false, { deferSecondary = false } = {}) {
    $('#hw-scan-meta').textContent = 'Analizando CPU, gráficos, placa madre, audio, red, Bluetooth y discos…';
    $('#pop-hw-state').textContent = 'Escaneando…';
    try {
      const data = await api.scanHardware();
      state.hardware = data;

      const sys = data.system;
      $('#m-cpu').textContent = sys.cpuName.replace(/\(R\)|\(TM\)|Processor|CPU/gi, '').trim();
      $('#m-cpu-sub').textContent = `${sys.cores}C / ${sys.threads}T · ${sys.hasIntegratedGpu ? 'Con GPU integrada' : 'Sin GPU integrada'}`;
      $('#m-ram').textContent = `${sys.ramGb} GB RAM`;
      $('#m-os-sub').textContent = `${sys.usableRamGb} GB utilizables · ${sys.osBuild}`;
      $('#m-updates').textContent = String(data.updatesCount);
      $('#m-advisories').textContent = String(data.advisoriesCount);
      $('#side-pc-name').textContent = sys.hostname;
      $('#side-os-name').textContent = `${sys.ramGb} GB · ${sys.osBuild}`;
      applySetupToSidebar(state.setup);
      const kind = sys.isVirtualMachine ? 'Máquina virtual' : sys.isLaptop ? 'Portátil' : 'PC de escritorio';
      const brand = sys.isBrandSystem && sys.model ? ` ${sys.model}` : '';
      $('#hw-scan-meta').textContent = `${kind}${brand} · ${data.drivers.length} componentes detectados · ${sys.detectedVia}`;
      $('#pop-hw-state').textContent = `${data.drivers.length} detectados`;

      const drvBadge = $('#badge-drivers');
      if (data.advisoriesCount > 0) {
        drvBadge.textContent = String(data.advisoriesCount);
        drvBadge.hidden = false;
      } else {
        drvBadge.hidden = true;
      }

      applyLiteMode({ fromHardware: true });
      renderDrivers();
      renderDashboard();
      loadPresets();
      if (!deferSecondary) {
        loadWindowsAudit();
      }
      renderPostFormatChecklist();
      updateStatusPill();
      if (notify) showToast('Escaneo de hardware actualizado.');
      if (!deferSecondary) {
        liveCheckDrivers(notify);
      }
    } catch (err) {
      $('#hw-scan-meta').textContent = 'Error al escanear hardware.';
      showToast(`Error al detectar hardware: ${err.message}`);
    }
  }

  // Pregunta a Windows Update por versiones más nuevas (tarda: corre después de mostrar el escaneo)
  let liveDriversPromise = null;
  function liveCheckDrivers(_notify = false) {
    const scanned = state.hardware;
    const p = (async () => {
      try {
        const res = await api.driversLiveCheck();
        if (!res?.drivers || state.hardware !== scanned) return;
        state.hardware.drivers = res.drivers;
        state.hardware.updatesCount = res.updatesCount;
        $('#m-updates').textContent = String(res.updatesCount);
        renderDrivers();
        renderDashboard();
        renderPostFormatChecklist();
        updateStatusPill();
        if (res.updatesCount === 0) {
          showToast('Todos tus drivers están al día.');
        }
      } catch {
        // Sin Windows Update: las tarjetas quedan con su enlace oficial
      } finally {
        if (liveDriversPromise === p) liveDriversPromise = null;
      }
    })();
    liveDriversPromise = p;
    return p;
  }

  function renderDrivers() {
    const container = $('#driver-list');
    const drivers = state.hardware?.drivers || [];
    const filtered = drivers.filter((drv) => {
      if (state.driverFilter === 'advisory') return Boolean(drv.advisory);
      if (state.driverFilter === 'updates') return Boolean(drv.needsUpdate);
      return true;
    });

    if (!filtered.length) {
      container.innerHTML = `<article class="driver-card"><p class="section-subtitle">No hay componentes que coincidan con el filtro seleccionado.</p></article>`;
      return;
    }

    container.innerHTML = filtered
      .map((drv) => {
        const isSelected = state.selected.has(drv.id);
        const isOmitted = state.omittedDrivers.has(drv.id);
        const live = state.itemStatus.get(drv.id);
        const installedVer = drv.installedVersionDisplay || drv.installedVersion;

        let badgeHtml = '';
        if (live) {
          badgeHtml = `<span class="pill-badge state-${live.state}">${esc(statusLabel(live.state))}</span>`;
        } else if (isOmitted) {
          badgeHtml = `<span class="pill-badge is-neutral">Omitido</span>`;
        } else if (drv.advisory && drv.advisory.level === 'warn') {
          badgeHtml = `<span class="pill-badge is-warn">Aviso de estabilidad</span>`;
        } else if (drv.needsUpdate) {
          badgeHtml = `<span class="pill-badge is-recommended">Actualización oficial</span>`;
        } else if (drv.bios?.isNewer) {
          badgeHtml = `<span class="pill-badge is-recommended">BIOS nueva</span>`;
        } else if (drv.liveCheck === 'pending') {
          badgeHtml = `<span class="pill-badge is-neutral">Consultando…</span>`;
        } else if (drv.liveCheck === 'error' || (drv.category === 'motherboard' && !drv.bios?.latestVersion)) {
          badgeHtml = `<span class="pill-badge is-neutral">Sin comparar</span>`;
        } else {
          badgeHtml = `<span class="pill-badge is-ok">Al día</span>`;
        }

        const roleBadge = drv.category === 'igpu'
          ? `<span class="pill-badge is-purple">GPU Integrada (iGPU)</span>`
          : drv.category === 'gpu'
          ? `<span class="pill-badge is-recommended">GPU Dedicada</span>`
          : '';

        const advisoryHtml = drv.advisory
          ? `<div class="driver-advisory ${drv.advisory.level === 'info' ? 'is-info' : ''}">
              <svg class="driver-advisory-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div class="driver-advisory-body">
                <strong>${esc(drv.advisory.title)}</strong>
                <p>${esc(drv.advisory.summary)}</p>
              </div>
            </div>`
          : '';

        const progressHtml = live
          ? `<div class="item-progress">
              <div class="item-progress-head">
                <span class="item-progress-detail">${esc(live.detail || statusLabel(live.state))}</span>
                <span class="item-progress-pct">${Math.round(live.progress || 0)}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar ${live.state === 'done' ? 'is-done' : live.state === 'warning' ? 'is-warn' : live.state === 'installing' ? 'is-installing' : ''}" style="width:${Math.round(live.progress || 0)}%"></div>
              </div>
            </div>`
          : '';

        const targetVersionLabel = drv.needsUpdate
          ? `${drv.latestVersion || drv.safeVersion}${drv.latestDate ? ` (${drv.latestDate})` : ''}`
          : drv.targetLabel || 'Actualizado';

        const companionBadge = drv.companionApp?.installed
          ? `<span class="pill-badge is-ok">App oficial detectada: ${esc(drv.companionApp.name)}</span>`
          : '';

        const vendorLogoHtml = drv.vendorIconUrl
          ? `<img class="vendor-logo-img" src="${esc(drv.vendorIconUrl)}" alt="" loading="lazy" data-fallback="${esc((drv.vendor || 'H').slice(0, 2).toUpperCase())}">`
          : driverIconSvg(drv.category);

        return `
          <article class="driver-card ${isSelected ? 'is-selected' : ''} ${isOmitted ? 'is-omitted' : ''}" data-driver-id="${esc(drv.id)}">
            <div class="driver-top">
              <label class="xh-check" title="Seleccionar para lote">
                <input type="checkbox" data-toggle-driver="${esc(drv.id)}" ${isSelected ? 'checked' : ''} ${isOmitted ? 'disabled' : ''}>
              </label>
              <div class="driver-icon ${drv.advisory?.level === 'warn' ? 'is-warn' : ''}">
                ${vendorLogoHtml}
              </div>
              <div class="driver-main">
                <div class="driver-title-row">
                  <span class="driver-category">${esc(drv.categoryLabel)}</span>
                  ${roleBadge}
                  ${badgeHtml}
                  ${companionBadge}
                </div>
                <div class="driver-name" title="${esc(drv.name)}">${esc(drv.name)}</div>
                <div class="driver-meta">
                  <span class="version-compare">
                    <span>Actual: ${esc(installedVer)}</span>
                    <span class="ver-arrow">→</span>
                    <span class="ver-new">${esc(targetVersionLabel)}</span>
                  </span>
                  <span>Fuente: ${esc(drv.needsUpdate && drv.latestTitle ? 'Windows Update (WHQL)' : drv.sourceName)}</span>
                  ${drv.vendorHint && !drv.needsUpdate && drv.liveCheck === 'done' ? `<span>${esc(drv.vendorHint)}</span>` : ''}
                  <span>${esc(drv.hardwareDetail)}</span>
                </div>
              </div>
              <div class="driver-actions">
                ${drv.category === 'motherboard'
                  ? `${drv.bios?.canPrepareUsb ? `<button type="button" class="btn-action-small is-primary" data-bios-usb>Preparar USB de BIOS</button>` : ''}
                     ${drv.officialUrl ? `<button type="button" class="btn-action-small is-safe" data-open-url="${esc(drv.officialUrl)}">${drv.oem ? 'Web del fabricante' : 'Web de la placa'}</button>` : ''}
                     <button type="button" class="btn-action-small ${drv.bios?.canPrepareUsb ? 'is-ghost' : 'is-primary'}" data-install-driver="${esc(drv.id)}" data-branch="latest" title="Busca en Windows Update los drivers de chipset de la placa">${drv.oem ? 'Drivers del sistema' : 'Drivers de chipset'}</button>`
                  : `${drv.advisory?.recommendation === 'safe'
                      ? `<button type="button" class="btn-action-small is-safe" data-install-driver="${esc(drv.id)}" data-branch="safe">Versión segura</button>`
                      : ''}
                     ${drv.needsUpdate
                      ? `<button type="button" class="btn-action-small is-primary" data-install-driver="${esc(drv.id)}" data-branch="latest">Instalar última</button>`
                      : ''}`}
                <button type="button" class="btn-action-small is-ghost" data-omit-driver="${esc(drv.id)}">${isOmitted ? 'Restaurar' : 'Omitir'}</button>
              </div>
            </div>
            ${advisoryHtml}
            ${progressHtml}
          </article>`;
      })
      .join('');
  }

  // =========================================================================
  // Render de Catálogo (Herramientas, Launchers, Navegadores, Utilidades, Dev)
  // =========================================================================
  async function loadCatalog() {
    const res = await api.getCatalog();
    state.catalog = res.items || [];
    state.wingetAvailable = Boolean(res.wingetAvailable);
    $('#xh-winget-badge').textContent = state.wingetAvailable ? 'WinGet activo' : 'Descarga directa';
    const instCount = typeof res.installedCount === 'number'
      ? res.installedCount
      : state.catalog.filter((i) => i.installed).length;
    const popInst = $('#pop-installed-count');
    if (popInst) popInst.textContent = `${instCount} detectadas`;
    renderAllCatalogSections();
    renderDashboard();
  }

  function renderAllCatalogSections() {
    ['herramientas', 'launchers', 'navegadores', 'utilidades', 'dev'].forEach(renderCatalogSection);
  }

  function renderCatalogSection(section) {
    const grid = $(`#grid-${section}`);
    if (!grid) return;
    const query = (state.searchQueries[section] || '').trim().toLowerCase();
    const instFilter = state.installFilters[section] || 'all';
    const items = state.catalog.filter((item) => {
      if (item.section !== section) return false;
      if (instFilter === 'installed' && !item.installed) return false;
      if (instFilter === 'missing' && item.installed) return false;
      if (section === 'dev' && state.devFilter !== 'all' && item.subCategory !== state.devFilter) return false;
      if (section === 'utilidades' && state.utilFilter !== 'all' && !(item.kinds || []).includes(state.utilFilter)) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.vendor.toLowerCase().includes(query) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(query))
      );
    });

    const sectionAll = state.catalog.filter((i) => i.section === section);
    const badgeEl = $(`#badge-${section}`);
    if (badgeEl) {
      badgeEl.textContent = String(sectionAll.length);
      badgeEl.hidden = sectionAll.length === 0;
    }

    if (!items.length) {
      grid.innerHTML = `<article class="app-card"><p class="app-card-desc">No se encontraron elementos con ese filtro.</p></article>`;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const isSelected = state.selected.has(item.id);
        const live = state.itemStatus.get(item.id);

        let statusBadge = '';
        if (live) {
          statusBadge = `<span class="pill-badge state-${live.state}">${esc(statusLabel(live.state))}</span>`;
        } else if (item.installed) {
          const verShort = item.installedVersion ? ` · v${String(item.installedVersion).slice(0, 14)}` : '';
          statusBadge = `<span class="pill-badge is-ok">Instalado${esc(verShort)}</span>`;
        }

        const recBadge = item.recommended
          ? `<span class="pill-badge is-recommended">${esc(item.recommendedLabel || 'Recomendado')}</span>`
          : '';

        const progressHtml = live
          ? `<div class="item-progress">
              <div class="item-progress-head">
                <span class="item-progress-detail">${esc(live.detail || statusLabel(live.state))}</span>
                <span class="item-progress-pct">${Math.round(live.progress || 0)}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar ${live.state === 'done' ? 'is-done' : live.state === 'warning' ? 'is-warn' : live.state === 'installing' ? 'is-installing' : ''}" style="width:${Math.round(live.progress || 0)}%"></div>
              </div>
            </div>`
          : '';

        const primaryAction = item.installed && item.installedPath
          ? `<button type="button" class="btn-action-small is-safe" data-open-app="${esc(item.installedPath)}">Abrir</button>`
          : `<button type="button" class="btn-action-small is-primary" data-install-app="${esc(item.id)}">Instalar</button>`;

        return `
          <article class="app-card ${isSelected ? 'is-selected' : ''} ${item.recommended ? 'is-featured' : ''}" data-app-id="${esc(item.id)}">
            <div class="app-card-head">
              ${appIconHtml(item)}
              <div class="app-card-titles">
                <div class="app-card-name-row">
                  <strong>${esc(item.name)}</strong>
                  ${recBadge}
                  ${statusBadge}
                </div>
                <span class="app-card-vendor">${esc(item.vendor)} · ${esc(item.sizeHint)}</span>
              </div>
              <label class="xh-check" title="Añadir a selección por lote">
                <input type="checkbox" data-toggle-app="${esc(item.id)}" ${isSelected ? 'checked' : ''}>
              </label>
            </div>
            <p class="app-card-desc">${esc(item.description)}</p>
            <div class="app-card-tags">
              ${(item.tags || []).map((t) => `<span class="tag-chip">${esc(t)}</span>`).join('')}
            </div>
            ${progressHtml}
            <div class="app-card-foot">
              <button type="button" class="btn-action-small is-ghost" data-open-url="${esc(item.officialUrl)}">Web oficial</button>
              <div class="driver-actions">
                ${item.installed && item.wingetId ? `<button type="button" class="btn-action-small is-ghost" data-uninstall-app="${esc(item.id)}">Desinstalar</button>` : ''}
                ${item.installed ? `<button type="button" class="btn-action-small" data-install-app="${esc(item.id)}">Actualizar</button>` : ''}
                ${primaryAction}
              </div>
            </div>
          </article>`;
      })
      .join('');
  }

  // =========================================================================
  // Emuladores (GitHub Releases)
  // =========================================================================
  async function loadEmulators() {
    const res = await api.getEmulators();
    state.emulators = res?.items || [];
    const badge = $('#badge-emuladores');
    if (badge) {
      badge.textContent = String(state.emulators.length);
      badge.hidden = state.emulators.length === 0;
    }
    renderEmulators();
    renderDashboard();
  }

  async function checkEmulatorsGithub() {
    const btn = $('#btn-emu-check-gh');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Consultando GitHub…';
    const visible = getFilteredEmulators().slice(0, 8);
    let okCount = 0;
    for (const emu of visible) {
      const rel = await api.checkEmulatorRelease(emu.githubRepo);
      if (rel?.ok) {
        state.emuReleases.set(emu.githubRepo, rel);
        okCount += 1;
        renderEmulators();
      }
    }
    btn.disabled = false;
    btn.textContent = 'Verificar versiones en GitHub';
    showToast(
      okCount > 0
        ? `Versiones verificadas desde GitHub (${okCount} repositorios actualizados).`
        : 'GitHub API alcanzó límite temporal; las descargas directas siguen activas.'
    );
  }

  function getFilteredEmulators() {
    const q = (state.emuSearch || '').trim().toLowerCase();
    return state.emulators.filter((e) => {
      if (state.emuFilter !== 'all' && e.platform !== state.emuFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.platformLabel.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.githubRepo.toLowerCase().includes(q)
      );
    });
  }

  function renderEmulators() {
    const grid = $('#grid-emuladores');
    if (!grid) return;
    const list = getFilteredEmulators();
    if (!list.length) {
      grid.innerHTML = `<article class="app-card"><p class="app-card-desc">No se encontraron emuladores con ese filtro.</p></article>`;
      return;
    }

    grid.innerHTML = list
      .map((emu) => {
        const isSelected = state.selected.has(emu.id);
        const live = state.itemStatus.get(emu.id);
        const rel = state.emuReleases.get(emu.githubRepo);

        const statusBadge = live
          ? `<span class="pill-badge state-${live.state}">${esc(statusLabel(live.state))}</span>`
          : rel?.tag
          ? `<span class="pill-badge is-ok">${esc(rel.tag)}</span>`
          : '';

        const recBadge = emu.recommended
          ? `<span class="pill-badge is-recommended">${esc(emu.recommendedLabel || 'Recomendado')}</span>`
          : '';

        const progressHtml = live
          ? `<div class="item-progress">
              <div class="item-progress-head">
                <span class="item-progress-detail">${esc(live.detail || statusLabel(live.state))}</span>
                <span class="item-progress-pct">${Math.round(live.progress || 0)}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar ${live.state === 'done' ? 'is-done' : live.state === 'warning' ? 'is-warn' : live.state === 'installing' ? 'is-installing' : ''}" style="width:${Math.round(live.progress || 0)}%"></div>
              </div>
            </div>`
          : '';

        const sizeNote = rel?.asset?.sizeMb ? ` · ${rel.asset.sizeMb} MB` : '';

        return `
          <article class="app-card ${isSelected ? 'is-selected' : ''} ${emu.recommended ? 'is-featured' : ''}" data-emu-id="${esc(emu.id)}">
            <div class="app-card-head">
              ${appIconHtml(emu)}
              <div class="app-card-titles">
                <div class="app-card-name-row">
                  <strong>${esc(emu.name)}</strong>
                  ${recBadge}
                  ${statusBadge}
                </div>
                <span class="app-card-vendor">${esc(emu.platformLabel)} · github.com/${esc(emu.githubRepo)}${esc(sizeNote)}</span>
              </div>
              <label class="xh-check" title="Añadir a selección por lote">
                <input type="checkbox" data-toggle-emu="${esc(emu.id)}" ${isSelected ? 'checked' : ''}>
              </label>
            </div>
            <p class="app-card-desc">${esc(emu.description)}</p>
            <div class="app-card-tags">
              ${(emu.tags || []).map((t) => `<span class="tag-chip">${esc(t)}</span>`).join('')}
            </div>
            ${progressHtml}
            <div class="app-card-foot">
              <button type="button" class="btn-action-small is-ghost" data-open-url="${esc(emu.repoUrl)}">Repo GitHub</button>
              <button type="button" class="btn-action-small is-primary" data-install-emu="${esc(emu.id)}">Descargar (GitHub)</button>
            </div>
          </article>`;
      })
      .join('');
  }

  function toggleEmulatorSelection(id, forceState) {
    const emu = state.emulators.find((e) => e.id === id);
    if (!emu) return;
    const shouldAdd = typeof forceState === 'boolean' ? forceState : !state.selected.has(id);
    if (shouldAdd) {
      state.selected.set(id, { id: emu.id, type: 'emulator', name: emu.name, officialUrl: emu.officialUrl });
    } else {
      state.selected.delete(id);
    }
    renderEmulators();
    updateBatchDock();
  }

  // =========================================================================
  // Microsoft Store (búsqueda real + instalación directa)
  // =========================================================================
  async function loadFeaturedStore() {
    $('#store-status-meta').textContent = 'Cargando destacados de Microsoft Store…';
    const res = await api.storeFeatured();
    state.storeItems = res?.items || [];
    $('#store-status-meta').textContent = `Mostrando ${state.storeItems.length} aplicaciones populares de Microsoft Store.`;
    renderStoreGrid();
  }

  async function searchStore(query) {
    const clean = String(query || '').trim();
    if (!clean) return loadFeaturedStore();
    $('#store-status-meta').textContent = `Buscando «${clean}» en Microsoft Store…`;
    $('#btn-store-search').disabled = true;
    try {
      const res = await api.storeSearch(clean);
      state.storeItems = res?.items || [];
      $('#store-status-meta').textContent = state.storeItems.length
        ? `${state.storeItems.length} resultado${state.storeItems.length === 1 ? '' : 's'} en Microsoft Store para «${clean}».${res.note ? ' ' + res.note : ''}`
        : `No se encontraron resultados en Microsoft Store para «${clean}».`;
      renderStoreGrid();
    } finally {
      $('#btn-store-search').disabled = false;
    }
  }

  function renderStoreGrid() {
    const grid = $('#grid-store');
    if (!grid) return;
    if (!state.storeItems.length) {
      grid.innerHTML = `<article class="app-card"><p class="app-card-desc">No se encontraron aplicaciones para esa búsqueda. Prueba con Spotify, WhatsApp, Netflix o Telegram.</p></article>`;
      return;
    }

    grid.innerHTML = state.storeItems
      .map((item) => {
        const isSelected = state.selected.has(item.id);
        const live = state.itemStatus.get(item.id);
        const statusBadge = live ? `<span class="pill-badge state-${live.state}">${esc(statusLabel(live.state))}</span>` : '';
        const progressHtml = live
          ? `<div class="item-progress">
              <div class="item-progress-head">
                <span class="item-progress-detail">${esc(live.detail || statusLabel(live.state))}</span>
                <span class="item-progress-pct">${Math.round(live.progress || 0)}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar ${live.state === 'done' ? 'is-done' : live.state === 'warning' ? 'is-warn' : live.state === 'installing' ? 'is-installing' : ''}" style="width:${Math.round(live.progress || 0)}%"></div>
              </div>
            </div>`
          : '';

        return `
          <article class="app-card ${isSelected ? 'is-selected' : ''}" data-store-id="${esc(item.storeId)}">
            <div class="app-card-head">
              ${appIconHtml(item)}
              <div class="app-card-titles">
                <div class="app-card-name-row">
                  <strong>${esc(item.name)}</strong>
                  ${statusBadge}
                </div>
                <span class="app-card-vendor">${esc(item.vendor)} · ID: ${esc(item.storeId)}</span>
              </div>
              <label class="xh-check" title="Añadir a selección por lote">
                <input type="checkbox" data-toggle-store="${esc(item.id)}" ${isSelected ? 'checked' : ''}>
              </label>
            </div>
            <p class="app-card-desc">${esc(item.description)}</p>
            <div class="app-card-tags">
              <span class="tag-chip">${esc(item.category || 'Microsoft Store')}</span>
              <span class="tag-chip">MS Store Oficial</span>
            </div>
            ${progressHtml}
            <div class="app-card-foot">
              <button type="button" class="btn-action-small is-ghost" data-open-msstore="${esc(item.storeId)}">Abrir en Store</button>
              <button type="button" class="btn-action-small is-primary" data-install-store="${esc(item.id)}">Instalar</button>
            </div>
          </article>`;
      })
      .join('');
  }

  // =========================================================================
  // Presets Experimentales (Hardware-Aware)
  // =========================================================================
  async function loadPresets() {
    const sys = state.hardware?.system || null;
    if (sys) {
      $('#preset-hw-text').textContent = `${sys.cpuName} · ${sys.dedicatedGpuName ? `${sys.dedicatedGpuName} (${sys.dedicatedGpuVramGb} GB VRAM)` : 'Solo GPU integrada'} · ${sys.ramGb} GB RAM`;
    }
    const res = await api.getPresets(sys);
    state.presets = res?.presets || [];
    renderPresets();
    loadSavedProfiles();
  }

  function activePresetTier(preset) {
    if (!preset) return null;
    const tiers = Array.isArray(preset.tiers) && preset.tiers.length ? preset.tiers : null;
    if (!tiers) {
      return {
        id: preset.id,
        name: preset.name,
        label: preset.name,
        badge: preset.badge,
        experimental: false,
        requiresRestorePoint: false,
        supportsVbsOption: false,
        warningNote: '',
        appIds: preset.appIds || [],
        optimizations: preset.optimizations || [],
      };
    }
    const chosenId = state.presetTiers[preset.id] || preset.defaultTierId;
    return tiers.find((t) => t.id === chosenId) || tiers[0];
  }

  function renderPresets() {
    const grid = $('#preset-grid');
    if (!grid) return;

    grid.innerHTML = state.presets
      .map((preset) => {
        const tier = activePresetTier(preset);
        const appNames = (tier.appIds || [])
          .map((id) => state.catalog.find((c) => c.id === id)?.name || id);
        const badgeClass = tier.experimental
          ? 'is-warn'
          : preset.tone === 'purple'
          ? 'is-purple'
          : preset.tone === 'green'
          ? 'is-ok'
          : preset.tone === 'orange'
          ? 'is-warn'
          : 'is-recommended';

        const tierSelector =
          Array.isArray(preset.tiers) && preset.tiers.length > 1
            ? `
            <div class="preset-tier-bar" role="tablist" aria-label="Nivel de optimización">
              ${preset.tiers
                .map((t) => {
                  const isActive = t.id === tier.id;
                  return `<button type="button" class="preset-tier-btn ${isActive ? 'is-active' : ''} ${t.experimental ? 'is-exp' : ''}" data-preset-tier="${esc(preset.id)}|${esc(t.id)}" aria-selected="${isActive ? 'true' : 'false'}">${esc(t.name)}${t.experimental ? ' · Exp.' : ''}</button>`;
                })
                .join('')}
            </div>`
            : '';

        const expWarn = tier.experimental
          ? `
            <div class="preset-exp-warn">
              <strong>Nivel Experimental · Solo para jugar</strong>
              <span>${esc(tier.warningNote || 'Crea un Punto de Restauración real de Windows obligatorio antes de aplicar.')}</span>
            </div>`
          : tier.requiresRestorePoint
          ? `
            <div class="preset-rp-note">
              <strong>Protección extra:</strong> crea un Punto de Restauración real de Windows antes de aplicar cambios.
            </div>`
          : '';

        const vbsOption = tier.supportsVbsOption
          ? `
            <label class="preset-vbs-opt">
              <input type="checkbox" data-preset-vbs-opt="1" ${state.presetDisableVbs ? 'checked' : ''}>
              <span><strong>Opcional:</strong> desactivar Integridad de memoria (VBS / HVCI) para ganar FPS extra (reduce el aislamiento de seguridad del núcleo y pide confirmación).</span>
            </label>`
          : '';

        return `
          <article class="preset-card ${preset.id === 'preset-dev' ? 'is-highlighted' : ''} ${tier.experimental ? 'is-experimental' : ''}">
            <div class="preset-head">
              <div>
                <h2>${esc(preset.name)}</h2>
                <p>${esc(preset.summary)}</p>
              </div>
              <span class="pill-badge ${badgeClass}">${esc(tier.badge || preset.badge)}</span>
            </div>

            ${tierSelector}

            <div class="preset-hw-box">
              <strong>Adaptado a tu hardware · ${esc(preset.hardwareProfile)}</strong>
              <span>${esc(preset.hardwareNote)}</span>
            </div>

            ${expWarn}

            <div>
              <div class="preset-list-label">Apps incluidas (${appNames.length})</div>
              <div class="app-card-tags">
                ${appNames.map((n) => `<span class="tag-chip">${esc(n)}</span>`).join('')}
              </div>
            </div>

            <div>
              <div class="preset-list-label">Optimizaciones reales y reversibles (${esc(tier.name)})</div>
              <ul class="preset-opt-list">
                ${(tier.optimizations || []).map((opt) => `<li>${esc(opt)}</li>`).join('')}
              </ul>
            </div>

            ${vbsOption}

            <div class="preset-foot">
              <button type="button" class="btn-action-small" data-preset-select="${esc(preset.id)}">Cargar al lote</button>
              <button type="button" class="btn-action-small is-primary" data-preset-apply="${esc(preset.id)}">Aplicar ${esc(tier.name)}</button>
            </div>
          </article>`;
      })
      .join('');
  }

  // =========================================================================
  // Auditoría de Configuraciones de Windows (detecta ajustes faltantes)
  // =========================================================================
  async function loadWindowsAudit(notify = false) {
    const res = await api.scanWindowsAudit(state.hardware?.system || null);
    state.winAudit = res;
    $('#wa-pending').textContent = String(res?.pendingCount || 0);
    $('#wa-optimal').textContent = String(res?.optimalCount || 0);
    $('#wa-startup').textContent = String(res?.startupCount || 0);
    const badge = $('#badge-winaudit');
    if (badge) {
      badge.textContent = String(res?.pendingCount || 0);
      badge.hidden = !(res?.pendingCount > 0);
    }
    const winGrpBadge = $('#badge-windows-group');
    if (winGrpBadge) {
      winGrpBadge.textContent = String(res?.pendingCount || 0);
      winGrpBadge.hidden = !(res?.pendingCount > 0);
    }
    renderWindowsAudit();
    if (notify) showToast('Auditoría de configuraciones de Windows actualizada.');
  }

  function renderWindowsAudit() {
    const list = $('#winaudit-list');
    if (!list) return;
    const items = state.winAudit?.items || [];
    if (!items.length) {
      list.innerHTML = `<article class="driver-card"><p class="section-subtitle">Analizando configuraciones de Windows…</p></article>`;
      return;
    }

    const card = (item) => `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-icon ${item.isOptimal ? '' : 'is-warn'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>${item.isOptimal ? '<path d="m9 12 2 2 4-4"/>' : '<path d="M12 8v4M12 16h.01"/>'}</svg>
          </div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(item.category)}</span>
              <span class="pill-badge ${item.isOptimal ? 'is-ok' : 'is-warn'}">${item.isOptimal ? 'Configurado' : esc(item.impact)}</span>
              ${item.requiresRestart ? '<span class="pill-badge is-neutral">Requiere reinicio</span>' : ''}
            </div>
            <div class="driver-name">${esc(item.name)}</div>
            <div class="driver-meta">
              <span class="version-compare"><span>Estado actual: ${esc(item.currentState)}</span></span>
              <span>${esc(item.description)}</span>
              ${item.caution ? `<div class="win-caution-note"><strong>Aviso:</strong> ${esc(item.caution)}</div>` : ''}
            </div>
          </div>
          <div class="driver-actions">
            ${item.isOptimal
              ? `<span class="pill-badge is-ok">Óptimo</span>`
              : `<button type="button" class="btn-action-small is-primary" data-apply-win="${esc(item.id)}">${esc(item.applyLabel || 'Aplicar')}</button>`}
          </div>
        </div>
      </article>`;

    const base = items.filter((i) => i.group !== 'win11');
    const win11 = items.filter((i) => i.group === 'win11');
    list.innerHTML =
      base.map(card).join('') +
      (win11.length
        ? `
      <article class="driver-card">
        <div class="driver-title-row" style="justify-content:space-between;">
          <span><strong>Windows 11: quitar anuncios y molestias</strong>
          <span class="section-subtitle">Opcionales, se aplican uno a uno y se pueden deshacer desde el respaldo.</span></span>
          <button type="button" class="btn-action-small is-ghost" id="btn-restart-explorer">Reiniciar Explorador</button>
        </div>
      </article>` + win11.map(card).join('')
        : '');
  }

  // =========================================================================
  // Checklist Post-Formateo (0% -> 100%)
  // =========================================================================
  function renderPostFormatChecklist() {
    const stepsEl = $('#checklist-steps');
    if (!stepsEl) return;
    const hasBackup = Boolean(state.recentBackup?.id);
    const hasHw = Boolean(state.hardware?.drivers?.length);
    const winOptimal = Boolean(state.winAudit && state.winAudit.pendingCount <= 1);
    const installedCount = state.catalog.filter((c) => c.installed).length;
    const hasApps = installedCount >= 5;
    const startupClean = state.startupApps.length > 0 && state.startupApps.filter((s) => s.enabled).length <= 10;

    const steps = [
      { label: '1. Respaldo del sistema', done: hasBackup, tab: 'discos' },
      { label: '2. Drivers verificados', done: hasHw, tab: 'drivers' },
      { label: '3. Auditoría Windows', done: winOptimal, tab: 'windows-audit' },
      { label: `4. Apps esenciales (${installedCount})`, done: hasApps, tab: 'utilidades' },
      { label: '5. Inicio optimizado', done: startupClean, tab: 'startup' },
      { label: '6. Chequeo de PC', done: Boolean(state.pcCheck && !state.pcCheck.warnCount), tab: 'pc-check' },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const pct = Math.round((doneCount / steps.length) * 100);
    $('#checklist-pct').textContent = `${pct}% listo`;
    const bar = $('#checklist-bar');
    bar.style.width = `${pct}%`;
    bar.classList.toggle('is-done', pct === 100);

    stepsEl.innerHTML = steps
      .map(
        (s) => `
      <button type="button" class="checklist-step ${s.done ? 'is-done' : ''}" data-jump-tab="${esc(s.tab)}">
        <span class="checklist-step-dot"></span>
        <span>${esc(s.label)}</span>
      </button>`
      )
      .join('');
  }

  // =========================================================================
  // Actualizador Global (winget upgrade)
  // =========================================================================
  function updateUpgradesSummary() {
    const total = state.upgrades.length;
    const activeCount = state.upgrades.filter((u) => !state.omittedUpgrades.has(u.wingetId)).length;
    const omittedCount = total - activeCount;
    const badge = $('#badge-upgrades');
    if (badge) {
      badge.textContent = String(activeCount);
      badge.hidden = activeCount === 0;
    }
    const meta = $('#upgrades-meta');
    if (meta) {
      if (!total) {
        meta.textContent = state.upgradesNote || 'Todas tus aplicaciones están actualizadas.';
      } else if (activeCount === 0) {
        meta.textContent = `Todas las actualizaciones disponibles están omitidas (${omittedCount}).`;
      } else if (omittedCount > 0) {
        meta.textContent = `${activeCount} aplicaci${activeCount === 1 ? 'ón' : 'ones'} con actualización disponible (${omittedCount} omitida${omittedCount === 1 ? '' : 's'}).`;
      } else {
        meta.textContent = `${activeCount} aplicaci${activeCount === 1 ? 'ón' : 'ones'} con actualización disponible.`;
      }
    }
  }

  async function loadUpgrades(notify = false) {
    $('#upgrades-meta').textContent = 'Buscando actualizaciones en todo tu PC vía WinGet…';
    const res = await api.scanUpgrades();
    state.upgrades = res?.items || [];
    state.upgradesNote = res?.note || '';
    updateUpgradesSummary();
    renderUpgrades();
    if (notify) showToast('Escaneo global de actualizaciones completado.');
  }

  function renderUpgrades() {
    const list = $('#upgrades-list');
    if (!list) return;
    if (!state.upgrades.length) {
      list.innerHTML = `<article class="driver-card"><p class="section-subtitle">No hay actualizaciones pendientes detectadas por WinGet.</p></article>`;
      return;
    }
    list.innerHTML = state.upgrades
      .map((u) => {
        const isOmitted = state.omittedUpgrades.has(u.wingetId);
        return `
      <article class="driver-card ${isOmitted ? 'is-omitted' : ''}">
        <div class="driver-top">
          <div class="driver-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>
          </div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(u.source)}</span>
              ${isOmitted ? '<span class="pill-badge is-muted">Omitido</span>' : '<span class="pill-badge is-recommended">Actualización</span>'}
            </div>
            <div class="driver-name">${esc(u.name)}</div>
            <div class="driver-meta">
              <span class="version-compare">
                <span>${esc(u.currentVersion)}</span>
                <span class="ver-arrow">→</span>
                <span class="ver-new">${esc(u.availableVersion)}</span>
              </span>
              <span>ID: ${esc(u.wingetId)}</span>
            </div>
          </div>
          <div class="driver-actions">
            ${isOmitted ? '' : `<button type="button" class="btn-action-small is-primary" data-run-upgrade="${esc(u.wingetId)}">Actualizar</button>`}
            <button type="button" class="btn-action-small is-ghost" data-omit-upgrade="${esc(u.wingetId)}">${isOmitted ? 'Restaurar' : 'Omitir'}</button>
          </div>
        </div>
      </article>`;
      })
      .join('');
  }

  // =========================================================================
  // Limpieza de Bloatware y Red/DNS
  // =========================================================================
  async function runDnsBenchmark() {
    const btn = $('#btn-dns-benchmark');
    const card = $('#dns-bench-card');
    const listEl = $('#dns-bench-list');
    const stEl = $('#dns-bench-status');
    if (!btn || !card || !listEl || !api.benchmarkDns) return;
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Midiendo DNS…';
    card.hidden = false;
    if (stEl) stEl.textContent = 'Enviando 3 pings paralelos a 5 servidores…';
    listEl.innerHTML = '';
    try {
      const res = await api.benchmarkDns();
      const items = res?.items || [];
      if (!items.length) {
        if (stEl) stEl.textContent = 'No se pudo medir la latencia.';
        return;
      }
      const validMs = items.filter((x) => typeof x.avgMs === 'number').map((x) => x.avgMs);
      const maxMs = Math.max(40, ...(validMs.length ? validMs : [100]));
      const best = items.find((x) => x.recommended);
      if (stEl) {
        stEl.textContent = best
          ? `Recomendado: ${best.name} (${best.avgMs} ms)`
          : 'Sin respuesta ICMP (el firewall puede bloquear ping)';
      }
      listEl.innerHTML = items
        .map((it) => {
          const pct = it.reachable ? Math.max(8, Math.min(100, Math.round((it.avgMs / maxMs) * 100))) : 100;
          return `
            <div class="dns-bench-row ${it.recommended ? 'is-best' : ''}">
              <div class="dns-bench-name">
                <strong>${esc(it.name)}${it.recommended ? ' <span class="pill-badge is-ok">Más rápido</span>' : ''}</strong>
                <small>${esc(it.primary)} · ${esc(it.note)}</small>
              </div>
              <div class="progress-track">
                <div class="progress-bar" style="width:${pct}%${it.recommended ? ';background:var(--green)' : !it.reachable ? ';background:var(--orange)' : ''}"></div>
              </div>
              <div class="dns-bench-ms">${it.reachable ? `${it.avgMs} ms` : 'Sin resp.'}</div>
              <button type="button" class="btn-action-small ${it.recommended ? 'is-primary' : ''}" data-net-action="${esc(it.id)}">Aplicar</button>
            </div>`;
        })
        .join('');
    } catch {
      if (stEl) stEl.textContent = 'Error al medir servidores DNS.';
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function loadCleanerAndNet(notify = false) {
    const [netRes, bloatRes] = await Promise.all([api.scanNetwork(), api.scanBloatware()]);
    state.networkInfo = netRes;
    state.bloatware = bloatRes?.items || [];

    $('#net-adapter').textContent = netRes?.adapterName || 'Sin adaptador';
    $('#net-speed').textContent = `Velocidad enlace: ${netRes?.linkSpeed || '--'}`;
    $('#net-dns').textContent = netRes?.dnsProvider || '--';
    $('#net-dns-ips').textContent = (netRes?.dnsServers || []).join(', ') || 'Automático';
    $('#net-ping-cf').textContent = netRes?.pingCloudflare || '--';
    $('#net-ping-gg').textContent = netRes?.pingGoogle || '--';

    renderBloatware();
    if (notify) showToast('Diagnóstico de red y bloatware actualizado.');
  }

  function renderBloatware() {
    const grid = $('#bloatware-grid');
    if (!grid) return;
    grid.innerHTML = state.bloatware
      .map(
        (b) => `
      <article class="app-card ${b.installed ? '' : 'is-omitted'}">
        <div class="app-card-head">
          <div class="app-monogram" aria-hidden="true">${esc(monogramFor(b.name))}</div>
          <div class="app-card-titles">
            <div class="app-card-name-row">
              <strong>${esc(b.name)}</strong>
              <span class="pill-badge ${b.installed ? 'is-warn' : 'is-ok'}">${b.installed ? 'Instalado' : 'Limpio'}</span>
            </div>
            <span class="app-card-vendor">${esc(b.category)}</span>
          </div>
        </div>
        <p class="app-card-desc">${esc(b.desc)}</p>
        <div class="app-card-foot">
          <span class="tag-chip">Reversible (Store)</span>
          ${b.installed && b.packageFullName
            ? `<button type="button" class="btn-action-small is-primary" data-remove-bloat="${esc(b.packageFullName)}">Desinstalar</button>`
            : `<span class="pill-badge is-ok">Eliminado</span>`}
        </div>
      </article>`
      )
      .join('');
  }

  // =========================================================================
  // Gestor de Inicio de Windows (Startup Manager)
  // =========================================================================
  async function loadStartupApps(notify = false) {
    const res = await api.listStartup();
    state.startupApps = res?.items || [];
    const activeCount = state.startupApps.filter((i) => i.enabled).length;
    const badge = $('#badge-startup');
    if (badge) {
      badge.textContent = String(activeCount);
      badge.hidden = activeCount === 0;
    }
    renderStartupApps();
    if (notify) showToast('Lista de inicio de Windows actualizada.');
  }

  function renderStartupApps() {
    const list = $('#startup-list');
    if (!list) return;
    if (!state.startupApps.length) {
      list.innerHTML = `<article class="driver-card"><p class="section-subtitle">No se detectaron aplicaciones de inicio registradas.</p></article>`;
      return;
    }

    list.innerHTML = state.startupApps
      .map(
        (item) => `
      <article class="driver-card ${item.enabled ? '' : 'is-omitted'}">
        <div class="driver-top">
          <div class="driver-icon ${item.enabled ? 'is-warn' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(item.scope)}</span>
              <span class="pill-badge ${item.enabled ? 'is-warn' : 'is-ok'}">${item.enabled ? 'Activo al inicio' : 'Desactivado'}</span>
            </div>
            <div class="driver-name">${esc(item.name)}</div>
            <div class="driver-meta">
              <span class="audit-origin-url">${esc(item.command)}</span>
            </div>
          </div>
          <div class="driver-actions">
            ${item.canToggle
              ? `<button type="button" class="btn-action-small ${item.enabled ? 'is-primary' : 'is-safe'}" data-toggle-startup="${esc(item.name)}" data-enable="${item.enabled ? 'false' : 'true'}">${item.enabled ? 'Desactivar' : 'Reactivar'}</button>`
              : `<span class="pill-badge is-neutral">Sistema</span>`}
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  // =========================================================================
  // Modal de Confirmación con 2 Opciones para Drivers (XHANNIZER0 vs App Oficial)
  // =========================================================================
  const drvConfirmBackdrop = $('#xh-driver-confirm-backdrop');
  const drvConfirmSheet = $('#xh-driver-confirm-sheet');
  const drvConfirmSpring = window.XhSpring.createSpring({
    value: 0,
    dampingRatio: 1.0,
    response: 0.28,
    onUpdate(v) {
      const scale = 0.94 + v * 0.06;
      const y = (1 - v) * 16;
      drvConfirmSheet.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      drvConfirmSheet.style.opacity = String(Math.max(0, Math.min(1, v)));
    },
  });

  function openDriverConfirmModal(drv, branch, isPostCheck = false) {
    state.pendingDriverConfirm = { drv, branch, isPostCheck };
    const comp = drv.companionApp;

    $('#drv-confirm-title').textContent = isPostCheck
      ? `Confirmación final para ${drv.vendor} (${drv.categoryLabel})`
      : '¿Estás seguro de realizar esta instalación?';
    $('#drv-confirm-desc').textContent = isPostCheck
      ? 'La verificación/instalación inicial finalizó. ¿Deseas confirmar y re-aplicar desde XHANNIZER0 o abrir la app oficial del fabricante para revisar la versión exacta?'
      : 'Elige si deseas instalar el controlador directamente desde XHANNIZER0 o mediante la aplicación oficial del componente.';
    $('#drv-confirm-target').textContent = `${drv.categoryLabel}: ${drv.name}`;
    $('#drv-confirm-note').textContent = comp?.installed
      ? `Se detectó ${comp.name} instalada en tu equipo.`
      : comp
      ? `${comp.name} disponible como app oficial del fabricante.`
      : 'Instalación directa verificada por canal WHQL de Windows.';

    const officialBtn = $('#btn-drv-choice-official');
    if (comp) {
      officialBtn.hidden = false;
      $('#drv-choice-official-title').textContent = comp.installed
        ? `2. Actualizar a través de ${comp.name}`
        : `2. Instalar / abrir ${comp.name}`;
      $('#drv-choice-official-sub').textContent = comp.installed
        ? 'Abre directamente la app oficial detectada en tu PC.'
        : 'Instala o abre la herramienta oficial del fabricante.';
      $('#drv-choice-official-badge').textContent = comp.installed ? 'Detectada' : 'Oficial';
    } else {
      officialBtn.hidden = true;
    }

    document.body.classList.add('has-modal');
    drvConfirmBackdrop.classList.add('is-open');
    drvConfirmBackdrop.setAttribute('aria-hidden', 'false');
    drvConfirmSpring.setTarget(1);
  }

  function closeDriverConfirmModal() {
    state.pendingDriverConfirm = null;
    document.body.classList.remove('has-modal');
    drvConfirmBackdrop.classList.remove('is-open');
    drvConfirmBackdrop.setAttribute('aria-hidden', 'true');
    drvConfirmSpring.setTarget(0);
  }

  function initDriverConfirmModal() {
    $('#btn-drv-confirm-cancel').addEventListener('click', closeDriverConfirmModal);
    drvConfirmBackdrop.addEventListener('click', (e) => {
      if (e.target === drvConfirmBackdrop) closeDriverConfirmModal();
    });

    // Opción 1: Instalar a través de XHANNIZER0
    $('#btn-drv-choice-app').addEventListener('click', () => {
      const ctx = state.pendingDriverConfirm;
      if (!ctx) return;
      const { drv, branch, isPostCheck } = ctx;
      closeDriverConfirmModal();
      const task = {
        id: drv.id,
        type: 'driver',
        name: `${drv.categoryLabel}: ${drv.name} (${branch === 'safe' ? 'Versión segura' : 'Última oficial'})`,
        driverBranch: branch,
        officialUrl: drv.officialUrl,
        safeUrl: drv.safeUrl,
        wingetId: drv.wingetId || null,
        askPostConfirm: Boolean(!isPostCheck && drv.isNvidiaOrAmd && (drv.category === 'gpu' || drv.category === 'igpu' || drv.category === 'cpu')),
        drvRef: drv,
      };
      requestInstallTasks([task]);
    });

    // Opción 2: Actualizar a través de la app oficial del componente
    $('#btn-drv-choice-official').addEventListener('click', async () => {
      const ctx = state.pendingDriverConfirm;
      if (!ctx?.drv?.companionApp) return;
      const comp = ctx.drv.companionApp;
      closeDriverConfirmModal();
      if (comp.installed && comp.exePath) {
        await api.openApp(comp.exePath);
        showToast(`Abriendo app oficial: ${comp.name}`);
      } else if (comp.wingetId) {
        requestInstallTasks([{ id: `comp-${ctx.drv.id}`, type: 'app', name: comp.name, officialUrl: comp.officialUrl }]);
        await api.openExternal(comp.officialUrl);
      } else {
        await api.openExternal(comp.officialUrl);
      }
    });
  }

  // =========================================================================
  // Sección Carpetas y Discos (Protegida con Backup Gate obligatorio)
  // =========================================================================
  const DISK_ACTIONS = [
    {
      id: 'create-clean-structure',
      name: 'Crear estructura limpia de carpetas',
      tag: 'Configuración de carpetas',
      desc: 'Crea una estructura ordenada (Proyectos, Juegos, Instaladores, Drivers_Oficiales, Documentos_Trabajo) en la carpeta o disco que elijas.',
      pickFolder: true,
      cta: 'Elegir carpeta y crear',
    },
    {
      id: 'organize-downloads',
      name: 'Reordenar carpeta Descargas',
      tag: 'Ordenamiento automático',
      desc: 'Clasifica instaladores (.exe/.msi), comprimidos (.zip/.rar/.7z), imágenes y documentos en subcarpetas limpias sin borrar archivos.',
      pickFolder: false,
      cta: 'Reordenar Descargas',
    },
    {
      id: 'clean-temp-cache',
      name: 'Limpiar temporales de instalación',
      tag: 'Mantenimiento seguro',
      desc: 'Elimina restos temporales de instaladores y caché de XHANNIZER0 sin tocar sesiones activas ni archivos personales.',
      pickFolder: false,
      cta: 'Limpiar temporales',
    },
    {
      id: 'export-drivers-only',
      name: 'Respaldo preventivo de drivers',
      tag: 'Copia de seguridad',
      desc: 'Genera una instantánea verificada del inventario de drivers firmados y solicita un punto de restauración antes de tocar nada.',
      pickFolder: false,
      cta: 'Crear respaldo ahora',
    },
  ];

  async function loadDisks() {
    const data = await api.scanDisks();
    state.disksData = data;
    renderDisks();
  }

  function undoSummaryText(b) {
    const parts = [`${b.undoTotal} cambio${b.undoTotal === 1 ? '' : 's'} registrado${b.undoTotal === 1 ? '' : 's'}`];
    const restored = b.undoTotal - b.undoPending - (b.undoIrreversible || 0);
    if (b.undoPending) parts.push(`${b.undoPending} reversible${b.undoPending === 1 ? '' : 's'}`);
    if (restored > 0) parts.push(`${restored} ya deshecho${restored === 1 ? '' : 's'}`);
    if (b.undoIrreversible) parts.push(`${b.undoIrreversible} no reversible${b.undoIrreversible === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }

  function renderBackupsHistory(backups) {
    const listEl = $('#backups-history-list');
    if (!listEl) return;
    const list = Array.isArray(backups) ? backups : [];
    if (!list.length) {
      listEl.innerHTML = `<article class="driver-card"><p class="section-subtitle">Aún no hay copias de seguridad guardadas en este equipo.</p></article>`;
      return;
    }
    listEl.innerHTML = list
      .map(
        (b) => `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(b.scope)}</span>
              <span class="pill-badge is-ok">${esc(String(b.createdAt || '').slice(0, 16).replace('T', ' '))}</span>
            </div>
            <div class="driver-name">${esc(b.label || b.id)}</div>
            <div class="driver-meta">
              <span>${esc(b.restorePointNote || b.backupDir)}</span>
            </div>
            ${b.undoTotal
              ? `<div class="driver-meta"><span>${esc(undoSummaryText(b))}</span></div>`
              : ''}
          </div>
          <div class="driver-actions">
            ${b.undoPending
              ? `<button type="button" class="btn-action-small is-primary" data-restore-backup="${esc(b.id)}">Deshacer cambios (${Number(b.undoPending)})</button>`
              : ''}
            <button type="button" class="btn-action-small" data-open-backup-dir="${esc(b.backupDir)}">Abrir</button>
            <button type="button" class="btn-action-small is-ghost" data-delete-backup="${esc(b.id)}">Eliminar</button>
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  function renderDisks() {
    const disks = state.disksData?.disks || [];
    $('#disk-grid').innerHTML = disks
      .map(
        (d) => `
      <article class="disk-card">
        <div class="disk-card-head">
          <strong>${esc(d.letter)} · ${esc(d.label)}</strong>
          <span>${esc(d.fileSystem)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar ${d.usedPct > 85 ? 'is-warn' : ''}" style="width:${d.usedPct}%"></div>
        </div>
        <div class="disk-card-sub">
          <span>Usado: ${d.usedGb} GB (${d.usedPct}%)</span>
          <span>Libre: ${d.freeGb} GB / ${d.totalGb} GB</span>
        </div>
      </article>`
      )
      .join('');

    $('#disk-actions-grid').innerHTML = DISK_ACTIONS.map(
      (act) => `
      <article class="app-card">
        <div class="app-card-head">
          <div class="app-monogram" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="app-card-titles">
            <div class="app-card-name-row">
              <strong>${esc(act.name)}</strong>
            </div>
            <span class="app-card-vendor">${esc(act.tag)} · Requiere respaldo previo</span>
          </div>
        </div>
        <p class="app-card-desc">${esc(act.desc)}</p>
        <div class="app-card-foot">
          <span class="pill-badge is-warn">Copia obligatoria</span>
          <button type="button" class="btn-action-small is-primary" data-disk-action="${esc(act.id)}">${esc(act.cta)}</button>
        </div>
      </article>`
    ).join('');
    renderBackupsHistory(state.disksData?.backups || []);
  }

  // =========================================================================
  // Selección por lote y Floating Batch Dock
  // =========================================================================
  function updateBatchDock() {
    const count = state.selected.size;
    let driversCount = 0;
    let appsCount = 0;
    for (const item of state.selected.values()) {
      if (item.type === 'driver') driversCount += 1;
      else appsCount += 1;
    }

    $('#batch-count').textContent = String(count);
    const parts = [];
    if (driversCount) parts.push(`${driversCount} driver${driversCount > 1 ? 's' : ''}`);
    if (appsCount) parts.push(`${appsCount} app${appsCount > 1 ? 's' : ''}`);
    $('#batch-breakdown').textContent = parts.join(' · ') || '0 elementos';
    $('#btn-batch-install').textContent = driversCount > 0 ? 'Respaldar e instalar lote' : 'Instalar selección';

    dockEl.classList.toggle('is-visible', count > 0);
    dockSpring.setTarget(count > 0 ? 1 : 0);
    updateStatusPill();
  }

  function toggleDriverSelection(id, forceState) {
    const drv = state.hardware?.drivers?.find((d) => d.id === id);
    if (!drv || state.omittedDrivers.has(id)) return;
    const shouldAdd = typeof forceState === 'boolean' ? forceState : !state.selected.has(id);
    if (shouldAdd) {
      state.selected.set(id, {
        id: drv.id,
        type: 'driver',
        name: `${drv.categoryLabel}: ${drv.name}`,
        driverBranch: drv.advisory?.recommendation === 'safe' ? 'safe' : 'latest',
        officialUrl: drv.officialUrl,
        safeUrl: drv.safeUrl,
        wingetId: drv.wingetId || null,
      });
    } else {
      state.selected.delete(id);
    }
    renderDrivers();
    updateBatchDock();
  }

  function toggleAppSelection(id, forceState) {
    const item = state.catalog.find((c) => c.id === id);
    if (!item) return;
    const shouldAdd = typeof forceState === 'boolean' ? forceState : !state.selected.has(id);
    if (shouldAdd) {
      state.selected.set(id, {
        id: item.id,
        type: 'app',
        name: item.name,
        officialUrl: item.officialUrl,
      });
    } else {
      state.selected.delete(id);
    }
    renderCatalogSection(item.section);
    updateBatchDock();
  }

  function toggleStoreSelection(id, forceState) {
    const item = state.storeItems.find((s) => s.id === id);
    if (!item) return;
    const shouldAdd = typeof forceState === 'boolean' ? forceState : !state.selected.has(id);
    if (shouldAdd) {
      state.selected.set(id, {
        id: item.id,
        type: 'msstore',
        storeId: item.storeId,
        name: item.name,
      });
    } else {
      state.selected.delete(id);
    }
    renderStoreGrid();
    updateBatchDock();
  }

  // =========================================================================
  // MODAL OBLIGATORIO DE COPIA DE SEGURIDAD
  // =========================================================================
  const backdropEl = $('#xh-backup-backdrop');
  const checkInput = $('#backup-required-checkbox');
  const checkCard = $('#backup-check-card');
  const confirmBtn = $('#btn-backup-confirm');
  const cancelBtn = $('#btn-backup-cancel');
  const progressBox = $('#backup-progress-box');

  function openBackupModal({ scope, label, detail, items, targetPath, onConfirmed, onCancel }) {
    state.pendingProtectedAction = { scope, label, detail, items, targetPath, onConfirmed, onCancel };
    state.backupRunning = false;

    $('#backup-target-label').textContent = label;
    $('#backup-target-detail').textContent = detail || '';
    checkInput.checked = false;
    checkInput.disabled = false;
    $('#backup-rp-checkbox').checked = false;
    checkCard.classList.remove('is-checked');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Hacer copia de seguridad y continuar';
    cancelBtn.disabled = false;
    progressBox.hidden = true;
    $('#backup-progress-bar').style.width = '0%';
    $('#backup-progress-pct').textContent = '0%';

    document.body.classList.add('has-modal');
    backdropEl.classList.add('is-open');
    backdropEl.setAttribute('aria-hidden', 'false');
    sheetSpring.setTarget(1);
  }

  function closeBackupModal() {
    state.pendingProtectedAction = null;
    state.backupRunning = false;
    document.body.classList.remove('has-modal');
    backdropEl.classList.remove('is-open');
    backdropEl.setAttribute('aria-hidden', 'true');
    sheetSpring.setTarget(0);
  }

  function initBackupModal() {
    checkInput.addEventListener('change', () => {
      const checked = checkInput.checked;
      checkCard.classList.toggle('is-checked', checked);
      confirmBtn.disabled = !checked || state.backupRunning;
    });

    cancelBtn.addEventListener('click', () => {
      if (state.backupRunning) return;
      const onCancel = state.pendingProtectedAction?.onCancel;
      closeBackupModal();
      if (typeof onCancel === 'function') onCancel();
    });

    backdropEl.addEventListener('click', (e) => {
      if (e.target === backdropEl && !state.backupRunning) {
        const onCancel = state.pendingProtectedAction?.onCancel;
        closeBackupModal();
        if (typeof onCancel === 'function') onCancel();
      }
    });

    api.onBackupProgress((prog) => {
      progressBox.hidden = false;
      $('#backup-progress-step').textContent = prog.step || 'Respaldando…';
      const pct = Math.max(0, Math.min(100, Math.round(prog.percent || 0)));
      $('#backup-progress-pct').textContent = `${pct}%`;
      $('#backup-progress-bar').style.width = `${pct}%`;
    });

    confirmBtn.addEventListener('click', async () => {
      if (!checkInput.checked || !state.pendingProtectedAction || state.backupRunning) return;
      state.backupRunning = true;
      checkInput.disabled = true;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmBtn.textContent = 'Creando copia de seguridad…';
      progressBox.hidden = false;

      const action = state.pendingProtectedAction;
      try {
        const backupRes = await api.createBackup({
          scope: action.scope,
          label: action.label,
          items: action.items || [],
          targetPath: action.targetPath || null,
        });
        if (!backupRes?.ok) {
          throw new Error(backupRes?.error || 'No se pudo completar la copia de seguridad.');
        }
        await refreshBackupCount();
        if ($('#backup-rp-checkbox').checked) {
          confirmBtn.textContent = 'Creando punto de restauración…';
          const rp = await api.createRestorePoint();
          showToast(rp?.ok ? rp.message : rp?.error || 'No se pudo crear el punto de restauración.');
        }
        const callback = action.onConfirmed;
        closeBackupModal();
        showToast(`Respaldo verificado: ${backupRes.id}`);
        if (typeof callback === 'function') {
          await callback(backupRes);
        }
      } catch (err) {
        state.backupRunning = false;
        checkInput.disabled = false;
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        confirmBtn.textContent = 'Reintentar copia de seguridad';
        showToast(`Error en respaldo: ${err.message}`);
      }
    });
  }

  // =========================================================================
  // Ejecución de instalaciones (individual o por lote)
  // =========================================================================
  async function executeInstallTasks(tasks, backupId = null) {
    if (!tasks.length || state.installing) return;
    state.installing = true;
    for (const t of tasks) {
      state.itemStatus.set(t.id, { state: 'pending', progress: 0, detail: 'Pendiente…' });
    }
    renderDrivers();
    renderAllCatalogSections();
    renderStoreGrid();
    updateStatusPill();

    let res = null;
    try {
      res = await api.installBatch({ tasks, backupId });
      if (!res?.ok) {
        showToast(res?.error || 'No se pudo iniciar la instalación.');
      } else {
        for (const t of tasks) state.selected.delete(t.id);
        updateBatchDock();
        await loadCatalog();
        showToast('Cola de instalación completada.');
        notifyDone('Instalación completada — XHANNIZER0', `Finalizó la cola de ${tasks.length} elemento(s).`);
        // Para drivers NVIDIA o AMD (GPU / CPU), volver a confirmar post-instalación con opción de app oficial
        const postDrv = tasks.find((t) => t.askPostConfirm && t.drvRef);
        if (postDrv) {
          setTimeout(() => openDriverConfirmModal(postDrv.drvRef, postDrv.driverBranch || 'latest', true), 450);
        }
      }
    } finally {
      state.installing = false;
      updateStatusPill();
    }
    return res;
  }

  function requestInstallTasks(tasks) {
    const hasDrivers = tasks.some((t) => t.type === 'driver');
    if (hasDrivers) {
      const names = tasks.filter((t) => t.type === 'driver').map((t) => t.name);
      ensureVerifiedBackup({
        scope: 'drivers',
        label: names.length === 1 ? names[0] : `${names.length} controladores de hardware`,
        detail: 'No tienes una copia de seguridad reciente. Se exportará el inventario actual de drivers firmados y se solicitará un punto de restauración antes de instalar.',
        items: names,
        onConfirmed: (backupRes) => executeInstallTasks(tasks, backupRes.id),
      });
      return;
    }
    executeInstallTasks(tasks, null);
  }

  // =========================================================================
  // Listeners delegados de la UI
  // =========================================================================
  function initEvents() {
    api.onInstallProgress((upd) => {
      state.itemStatus.set(upd.id, {
        state: upd.state,
        progress: upd.progress,
        detail: upd.detail,
      });
      // Registrar en la Auditoría de Descargas y Procedencia (panel derecho)
      const prev = state.auditLog.get(upd.id) || {};
      state.auditLog.set(upd.id, {
        id: upd.id,
        name: upd.name || prev.name || upd.id,
        state: upd.state,
        progress: upd.progress,
        detail: upd.detail,
        sourceType: upd.sourceType || prev.sourceType || 'Canal Oficial',
        sourceOrigin: upd.sourceOrigin || prev.sourceOrigin || 'Oficial',
        sha256: upd.sha256 || prev.sha256 || null,
        signatureStatus: upd.signatureStatus || prev.signatureStatus || null,
        signatureSigner: upd.signatureSigner || prev.signatureSigner || null,
        timestamp: upd.timestamp || Date.now(),
      });
      renderAuditDrawer();

      if (upd.installed) {
        const appItem = state.catalog.find((c) => c.id === upd.id);
        if (appItem) {
          appItem.installed = true;
          if (upd.installedPath) appItem.installedPath = upd.installedPath;
        }
      }
      if (upd.id.startsWith('drv-')) renderDrivers();
      else if (upd.id.startsWith('emu-')) renderEmulators();
      else if (upd.id.startsWith('ms-')) renderStoreGrid();
      else renderAllCatalogSections();
      updateStatusPill();
    });

    // Filtros de drivers
    $$('#driver-filters .owner-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.driverFilter = chip.dataset.filter;
        $$('#driver-filters .owner-filter-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        renderDrivers();
      });
    });

    // Filtros de Programadores
    $$('#dev-filters .owner-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.devFilter = chip.dataset.devFilter;
        $$('#dev-filters .owner-filter-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        renderCatalogSection('dev');
      });
    });

    // Filtros de Compresores: Archivos / Video / Audio
    $$('#util-filters .owner-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.utilFilter = chip.dataset.utilFilter;
        $$('#util-filters .owner-filter-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        renderCatalogSection('utilidades');
      });
    });

    // Filtros Todas / Instaladas / Por instalar
    $$('[data-install-filter]').forEach((group) => {
      const sec = group.dataset.installFilter;
      group.querySelectorAll('[data-state-filter]').forEach((chip) => {
        chip.addEventListener('click', () => {
          state.installFilters[sec] = chip.dataset.stateFilter;
          group.querySelectorAll('.owner-filter-chip').forEach((c) => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          renderCatalogSection(sec);
        });
      });
    });

    // Filtros y búsqueda de Emuladores (GitHub)
    $$('#emu-filters .owner-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.emuFilter = chip.dataset.emuFilter;
        $$('#emu-filters .owner-filter-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        renderEmulators();
      });
    });
    const emuSearchEl = $('#emu-search-input');
    if (emuSearchEl) {
      emuSearchEl.addEventListener('input', () => {
        state.emuSearch = emuSearchEl.value;
        renderEmulators();
      });
    }
    const emuCheckBtn = $('#btn-emu-check-gh');
    if (emuCheckBtn) emuCheckBtn.addEventListener('click', checkEmulatorsGithub);

    $('#btn-rescan-hw').addEventListener('click', () => scanHardware(true));

    $('#btn-select-drivers').addEventListener('click', () => {
      const drivers = state.hardware?.drivers || [];
      let added = 0;
      drivers.forEach((d) => {
        if ((d.needsUpdate || d.advisory?.level === 'warn') && !state.omittedDrivers.has(d.id)) {
          toggleDriverSelection(d.id, true);
          added += 1;
        }
      });
      if (added) showToast(`${added} driver${added > 1 ? 's' : ''} añadidos al lote.`);
    });

    // Búsqueda por sección
    $$('[data-search-section]').forEach((input) => {
      input.addEventListener('input', () => {
        const sec = input.dataset.searchSection;
        state.searchQueries[sec] = input.value;
        renderCatalogSection(sec);
      });
    });

    // Microsoft Store search form
    $('#store-search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      searchStore($('#store-search-input').value);
    });
    $('#btn-store-featured').addEventListener('click', () => {
      $('#store-search-input').value = '';
      loadFeaturedStore();
    });

    // Seleccionar toda una sección
    $$('[data-select-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.selectSection;
        const targets = state.catalog.filter((i) => i.section === sec && !i.installed);
        const list = targets.length ? targets : state.catalog.filter((i) => i.section === sec);
        list.forEach((item) => toggleAppSelection(item.id, true));
      });
    });

    // Controles del Batch Dock
    $('#btn-batch-clear').addEventListener('click', () => {
      state.selected.clear();
      renderDrivers();
      renderAllCatalogSections();
      renderStoreGrid();
      updateBatchDock();
    });

    $('#btn-batch-install').addEventListener('click', () => {
      const tasks = Array.from(state.selected.values());
      if (tasks.length) requestInstallTasks(tasks);
    });

    $('#btn-refresh-disks').addEventListener('click', () => loadDisks());
    $('#btn-open-backups-main').addEventListener('click', () => api.openPath());
    $('#btn-create-usb-kit').addEventListener('click', async () => {
      const pick = await api.pickFolder();
      if (pick.canceled || !pick.path) return;
      const selectedWinget = Array.from(state.selected.keys())
        .map((id) => state.catalog.find((c) => c.id === id)?.wingetId)
        .filter(Boolean);
      const res = await api.createUsbKit({ destDir: pick.path, wingetIds: selectedWinget });
      if (res?.ok) {
        showToast(`Kit USB creado en ${res.kitDir} (${res.count} paquetes).`);
        api.openPath(res.kitDir);
      } else {
        showToast(res?.error || 'No se pudo crear el Kit USB.');
      }
    });

    // Actualizador Global y Limpieza/Red
    $('#btn-upgrades-scan').addEventListener('click', () => loadUpgrades(true));
    $('#btn-upgrades-all').addEventListener('click', async () => {
      const btn = $('#btn-upgrades-all');
      if (btn.disabled) return;
      const origText = btn.textContent;
      btn.disabled = true;
      try {
        if (!state.upgrades.length) {
          await loadUpgrades(false);
        }
        if (!state.upgrades.length) {
          showToast('Todas tus aplicaciones están actualizadas.');
          return;
        }
        const active = state.upgrades.filter((u) => !state.omittedUpgrades.has(u.wingetId));
        const omittedCount = state.upgrades.length - active.length;
        if (!active.length) {
          showToast('Todas las actualizaciones disponibles están omitidas. Restaura alguna para actualizar.');
          return;
        }
        if (omittedCount === 0) {
          btn.textContent = 'Actualizando todo…';
          showToast('Iniciando actualización global vía WinGet…');
          const res = await api.runUpgrade({ wingetId: '__ALL__' });
          showToast(res?.message || 'Proceso finalizado.');
        } else {
          let okCount = 0;
          let failCount = 0;
          for (let i = 0; i < active.length; i += 1) {
            const u = active[i];
            btn.textContent = `Actualizando (${i + 1}/${active.length})…`;
            showToast(`Actualizando ${u.name} (${i + 1}/${active.length})…`);
            const res = await api.runUpgrade({ wingetId: u.wingetId });
            if (res?.ok) okCount += 1;
            else failCount += 1;
          }
          showToast(
            failCount > 0
              ? `Actualización completada: ${okCount} de ${active.length} actualizadas (${failCount} con aviso, ${omittedCount} omitida${omittedCount === 1 ? '' : 's'}).`
              : `Actualización completada: ${okCount} de ${active.length} aplicaciones actualizadas (${omittedCount} omitida${omittedCount === 1 ? '' : 's'}).`
          );
        }
        await loadUpgrades(false);
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    });
    $('#btn-cleanernet-refresh').addEventListener('click', () => loadCleanerAndNet(true));
    $('#btn-bloat-remove-all').addEventListener('click', () => {
      const targets = state.bloatware.filter((b) => b.installed && b.packageFullName);
      if (!targets.length) {
        showToast('Tu Windows ya está limpio de bloatware.');
        return;
      }
      ensureVerifiedBackup({
        scope: 'bloatware',
        label: `Eliminar ${targets.length} apps preinstaladas de Windows`,
        detail: targets.map((t) => t.name).join(', '),
        items: targets.map((t) => t.name),
        onConfirmed: async (backupRes) => {
          const res = await api.removeBloatware({
            packageFullNames: targets.map((t) => t.packageFullName),
            backupId: backupRes.id,
          });
          showToast(res?.ok ? res.message : res?.error || 'Error al limpiar.');
          await loadCleanerAndNet(false);
        },
      });
    });

    // Gestor de Inicio de Windows y Exportar / Importar Perfil (.json)
    $('#btn-startup-refresh').addEventListener('click', () => loadStartupApps(true));

    $('#btn-export-profile').addEventListener('click', async () => {
      const profile = {
        app: 'XHANNIZER0',
        studio: 'Xhanni Studios',
        version: null, // lo completa el proceso principal
        exportedAt: new Date().toISOString(),
        theme: state.theme,
        lang: state.lang,
        selectedIds: Array.from(state.selected.keys()),
        installedAppIds: state.catalog.filter((c) => c.installed).map((c) => c.id),
      };
      const res = await api.exportProfile(profile);
      if (res?.ok) showToast(`Perfil exportado en ${res.path}`);
    });

    $('#btn-import-profile').addEventListener('click', async () => {
      const res = await api.importProfile();
      if (!res?.ok || !res.data) {
        if (res?.error) showToast(res.error);
        return;
      }
      const ids = Array.from(new Set([...(res.data.selectedIds || []), ...(res.data.installedAppIds || [])]));
      let queued = 0;
      for (const id of ids) {
        const item = state.catalog.find((c) => c.id === id);
        if (item && !item.installed) {
          toggleAppSelection(item.id, true);
          queued += 1;
        }
      }
      showToast(
        queued > 0
          ? `Perfil importado: ${queued} app${queued > 1 ? 's' : ''} faltantes cargadas al lote.`
          : 'Perfil importado: todas las apps del perfil ya están instaladas.'
      );
    });

    // Auditoría de Windows
    $('#btn-winaudit-rescan').addEventListener('click', () => loadWindowsAudit(true));
    $('#btn-winaudit-apply-all').addEventListener('click', () => {
      const pending = (state.winAudit?.items || []).filter(
        (i) => !i.isOptimal && !i.optional && i.id !== 'win-refresh-rate' && i.id !== 'win-hags'
      );
      if (!pending.length) {
        showToast('Todas las configuraciones recomendadas automáticas ya están activas.');
        return;
      }
      ensureVerifiedBackup({
        scope: 'windows-config',
        label: `Aplicar ${pending.length} configuraciones recomendadas de Windows`,
        detail: pending.map((p) => p.name).join(' · '),
        items: pending.map((p) => p.name),
        onConfirmed: async (backupRes) => {
          for (const item of pending) {
            await api.applyWindowsSetting({ settingId: item.id, backupId: backupRes.id });
          }
          await loadWindowsAudit(false);
          showToast(`${pending.length} configuraciones de Windows aplicadas correctamente.`);
        },
      });
    });

    // Delegación global de clics en botones
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      // Abrir o eliminar respaldo desde el Historial de Respaldos
      if (btn.dataset.openBackupDir) {
        await api.openPath(btn.dataset.openBackupDir);
        return;
      }
      if (btn.dataset.deleteBackup) {
        const res = await api.deleteBackup(btn.dataset.deleteBackup);
        if (res?.ok) {
          showToast('Respaldo eliminado.');
          await Promise.all([loadDisks(), refreshBackupCount()]);
        } else if (!res?.canceled) {
          showToast(res?.error || 'No se pudo eliminar el respaldo.');
        }
        return;
      }
      if (btn.dataset.restoreBackup) {
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Deshaciendo…';
        try {
          const res = await api.restoreBackup(btn.dataset.restoreBackup);
          if (res?.canceled) return;
          const failed = (res?.results || []).filter((r) => !r.ok);
          const detail = failed.length ? ` ${failed.map((r) => `${r.label}: ${r.note}`).join(' | ')}` : '';
          showToast((res?.message || res?.error || 'No se pudo deshacer.') + detail);
          // Los datos mostrados pueden haber cambiado: se recargan en la próxima visita
          state.winAudit = null;
          state.networkInfo = null;
          await Promise.all([loadDisks(), refreshBackupCount()]);
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
        return;
      }

      // Saltar a sección desde el Checklist Post-Formateo
      if (btn.dataset.jumpTab) {
        activateTab(btn.dataset.jumpTab);
        return;
      }

      // Omitir / Restaurar una app en Actualizaciones (persistente)
      if (btn.dataset.omitUpgrade) {
        const wingetId = btn.dataset.omitUpgrade;
        if (state.omittedUpgrades.has(wingetId)) state.omittedUpgrades.delete(wingetId);
        else state.omittedUpgrades.add(wingetId);
        saveOmittedUpgrades();
        updateUpgradesSummary();
        renderUpgrades();
        return;
      }

      // Actualizar una app desde el Actualizador Global
      if (btn.dataset.runUpgrade) {
        const wingetId = btn.dataset.runUpgrade;
        if (state.omittedUpgrades.has(wingetId)) return;
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Actualizando…';
        try {
          const res = await api.runUpgrade({ wingetId });
          showToast(res?.message || 'Actualización finalizada.');
          await loadUpgrades(false);
        } finally {
          btn.disabled = false;
          btn.textContent = origText;
        }
        return;
      }

      // Desinstalar una app oficial vía WinGet (con confirmación nativa en main.js)
      if (btn.dataset.uninstallApp) {
        const id = btn.dataset.uninstallApp;
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Desinstalando…';
        try {
          const res = await api.uninstallApp({ id });
          if (res?.canceled) return;
          showToast(res?.message || res?.error || 'Desinstalación finalizada.');
          if (res?.ok) await loadCatalog();
        } finally {
          btn.disabled = false;
          btn.textContent = orig;
        }
        return;
      }

      // Acción de Red / DNS (1 clic)
      if (btn.dataset.netAction) {
        const action = btn.dataset.netAction;
        ensureVerifiedBackup({
          scope: 'network',
          label: `Configuración de Red / DNS (${action})`,
          detail: `Adaptador: ${state.networkInfo?.adapterName || 'Principal'}`,
          items: [action],
          onConfirmed: async (backupRes) => {
            const res = await api.applyNetwork({
              action,
              adapterName: state.networkInfo?.adapterName,
              backupId: backupRes.id,
            });
            showToast(res?.ok ? res.message : res?.error || 'No se pudo aplicar.');
            await loadCleanerAndNet(false);
          },
        });
        return;
      }

      // Desinstalar bloatware individual
      if (btn.dataset.removeBloat) {
        const pkg = btn.dataset.removeBloat;
        ensureVerifiedBackup({
          scope: 'bloatware',
          label: 'Desinstalar app preinstalada de Windows',
          detail: pkg,
          items: [pkg],
          onConfirmed: async (backupRes) => {
            const res = await api.removeBloatware({ packageFullNames: [pkg], backupId: backupRes.id });
            showToast(res?.ok ? res.message : res?.error || 'No se pudo desinstalar.');
            await loadCleanerAndNet(false);
          },
        });
        return;
      }

      // BIOS nueva: descarga oficial verificada a una USB (se instala desde la BIOS, nunca desde Windows)
      if (btn.hasAttribute('data-bios-usb')) {
        btn.disabled = true;
        const stop = api.onBiosUsbProgress((p) => {
          if (p?.detail) btn.textContent = p.detail;
        });
        try {
          const res = await api.prepareBiosUsb();
          if (!res?.canceled) {
            showToast(res?.ok ? `BIOS ${res.version} lista en la USB ${res.drive}.` : res?.error || 'No se pudo preparar la USB.');
          }
        } finally {
          stop();
          btn.disabled = false;
          btn.textContent = 'Preparar USB de BIOS';
        }
        return;
      }

      // Driver individual -> Modal de confirmación con 2 opciones (XHANNIZER0 vs App Oficial)
      if (btn.dataset.installDriver) {
        const drv = state.hardware?.drivers?.find((d) => d.id === btn.dataset.installDriver);
        if (!drv) return;
        const branch = btn.dataset.branch || 'latest';
        if (branch === 'latest' && drv.category !== 'motherboard' && !drv.needsUpdate) {
          showToast('Este driver ya está en la última versión.');
          return;
        }
        openDriverConfirmModal(drv, branch, false);
        return;
      }

      // Toggle entrada de inicio de Windows (Startup Manager)
      if (btn.dataset.toggleStartup) {
        const name = btn.dataset.toggleStartup;
        const enable = btn.dataset.enable === 'true';
        ensureVerifiedBackup({
          scope: 'startup',
          label: `${enable ? 'Reactivar' : 'Desactivar'} inicio automático: ${name}`,
          detail: 'Cambio 100% reversible en HKCU\\Run.',
          items: [name],
          onConfirmed: async (backupRes) => {
            const res = await api.toggleStartup({ name, enable, backupId: backupRes.id });
            showToast(res?.ok ? res.message : res?.error || 'No se pudo actualizar.');
            await loadStartupApps(false);
          },
        });
        return;
      }

      if (btn.dataset.omitDriver) {
        const id = btn.dataset.omitDriver;
        if (state.omittedDrivers.has(id)) state.omittedDrivers.delete(id);
        else {
          state.omittedDrivers.add(id);
          state.selected.delete(id);
          updateBatchDock();
        }
        renderDrivers();
        return;
      }

      if (btn.dataset.installApp) {
        const item = state.catalog.find((c) => c.id === btn.dataset.installApp);
        if (!item) return;
        requestInstallTasks([{ id: item.id, type: 'app', name: item.name, officialUrl: item.officialUrl }]);
        return;
      }

      if (btn.dataset.installStore) {
        const item = state.storeItems.find((s) => s.id === btn.dataset.installStore);
        if (!item) return;
        requestInstallTasks([{ id: item.id, type: 'msstore', storeId: item.storeId, name: item.name }]);
        return;
      }

      if (btn.dataset.installEmu) {
        const emu = state.emulators.find((x) => x.id === btn.dataset.installEmu);
        if (!emu) return;
        requestInstallTasks([{ id: emu.id, type: 'emulator', name: emu.name, officialUrl: emu.officialUrl }]);
        return;
      }

      if (btn.dataset.openMsstore) {
        await api.storeOpen(btn.dataset.openMsstore);
        return;
      }

      if (btn.dataset.openApp) {
        await api.openApp(btn.dataset.openApp);
        return;
      }

      if (btn.dataset.openUrl) {
        await api.openExternal(btn.dataset.openUrl);
        return;
      }

      // Presets: cambiar nivel seleccionado dentro de la tarjeta
      if (btn.dataset.presetTier) {
        const [presetId, tierId] = btn.dataset.presetTier.split('|');
        if (presetId && tierId) {
          state.presetTiers[presetId] = tierId;
          renderPresets();
        }
        return;
      }

      // Presets: cargar apps al lote para revisión
      if (btn.dataset.presetSelect) {
        const preset = state.presets.find((p) => p.id === btn.dataset.presetSelect);
        if (!preset) return;
        const tier = activePresetTier(preset);
        const ids = tier?.appIds || preset.appIds || [];
        ids.forEach((appId) => toggleAppSelection(appId, true));
        showToast(`Preset «${tier?.label || preset.name}» cargado al lote (${ids.length} apps).`);
        return;
      }

      // Presets: aplicar optimizaciones + instalar apps (con puerta inteligente de respaldo)
      if (btn.dataset.presetApply) {
        const preset = state.presets.find((p) => p.id === btn.dataset.presetApply);
        if (!preset) return;
        const tier = activePresetTier(preset);
        const ids = tier?.appIds || preset.appIds || [];
        const tasks = ids
          .map((id) => state.catalog.find((c) => c.id === id))
          .filter(Boolean)
          .map((item) => ({ id: item.id, type: 'app', name: item.name, officialUrl: item.officialUrl }));
        const disableVbs = Boolean(tier?.supportsVbsOption && state.presetDisableVbs);

        ensureVerifiedBackup({
          scope: 'preset',
          label: `Preset: ${tier?.label || preset.name}`,
          detail: tier?.requiresRestorePoint
            ? `Se creará un Punto de Restauración real de Windows${tier.experimental ? ' obligatorio (si falla, no se aplica nada)' : ''}, se aplicarán las optimizaciones reversibles y se instalarán ${tasks.length} aplicaciones.`
            : `Se respaldará la configuración del sistema antes de aplicar las optimizaciones reversibles e instalar ${tasks.length} aplicaciones.`,
          items: [tier?.label || preset.name, ...tasks.map((t) => t.name)],
          onConfirmed: async (backupRes) => {
            const optRes = await api.applyPresetOpt({
              presetId: preset.id,
              tierId: tier?.id,
              disableVbs,
              backupId: backupRes.id,
            });
            if (!optRes?.ok) {
              showToast(optRes?.error || 'No se pudieron aplicar las optimizaciones del preset.');
              return;
            }
            showToast(optRes.message);
            await executeInstallTasks(tasks, backupRes.id);
          },
        });
        return;
      }

      // Aplicar ajuste individual de Auditoría Windows
      if (btn.dataset.applyWin) {
        const settingId = btn.dataset.applyWin;
        const item = (state.winAudit?.items || []).find((i) => i.id === settingId);
        if (!item) return;
        ensureVerifiedBackup({
          scope: 'windows-config',
          label: item.name,
          detail: item.description,
          items: [item.name],
          onConfirmed: async (backupRes) => {
            const res = await api.applyWindowsSetting({ settingId, backupId: backupRes.id });
            if (res?.canceled) return;
            showToast(res?.ok ? res.message : res?.error || 'No se pudo aplicar el ajuste.');
            await loadWindowsAudit(false);
          },
        });
        return;
      }

      // Carpetas y Discos -> Puerta inteligente (si es respaldo preventivo, siempre crea uno nuevo)
      if (btn.dataset.diskAction) {
        const act = DISK_ACTIONS.find((a) => a.id === btn.dataset.diskAction);
        if (!act) return;
        let chosenPath = null;
        if (act.pickFolder) {
          const pick = await api.pickFolder();
          if (pick.canceled || !pick.path) return;
          chosenPath = pick.path;
        }
        ensureVerifiedBackup({
          scope: act.id === 'export-drivers-only' ? 'drivers' : 'folders',
          label: act.name,
          detail: chosenPath ? `Carpeta objetivo: ${chosenPath}` : act.desc,
          items: [act.name],
          targetPath: chosenPath,
          forceNew: act.id === 'export-drivers-only',
          onConfirmed: async (backupRes) => {
            const res = await api.runDiskAction({
              actionId: act.id,
              targetDir: chosenPath,
              backupId: backupRes.id,
            });
            if (res?.ok) {
              showToast(res.message);
              await loadDisks();
            } else {
              showToast(res?.error || 'No se pudo completar la acción.');
            }
          },
        });
      }
    });

    // Checkboxes de selección múltiple
    document.addEventListener('change', (e) => {
      const input = e.target;
      if (input.dataset.toggleDriver) toggleDriverSelection(input.dataset.toggleDriver, input.checked);
      else if (input.dataset.toggleApp) toggleAppSelection(input.dataset.toggleApp, input.checked);
      else if (input.dataset.toggleStore) toggleStoreSelection(input.dataset.toggleStore, input.checked);
      else if (input.dataset.toggleEmu) toggleEmulatorSelection(input.dataset.toggleEmu, input.checked);
      else if (input.dataset.presetVbsOpt) {
        state.presetDisableVbs = Boolean(input.checked);
      }
    });
  }

  // =========================================================================
  // Buscador Global Spotlight (Ctrl + K) + Auto-actualizador GitHub
  // =========================================================================
  const spotlightBackdrop = $('#xh-spotlight-backdrop');
  const spotlightBox = $('#xh-spotlight-box');
  const spotlightInput = $('#spotlight-input');
  const spotlightResults = $('#spotlight-results');
  let spotlightOpen = false;
  let spotlightActiveIndex = 0;
  let spotlightMatches = [];

  const spotlightSpring = window.XhSpring.createSpring({
    value: 0,
    dampingRatio: 1.0,
    response: 0.25,
    onUpdate(v) {
      const scale = 0.95 + v * 0.05;
      const y = (1 - v) * -14;
      spotlightBox.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      spotlightBox.style.opacity = String(Math.max(0, Math.min(1, v)));
    },
  });

  function openSpotlight() {
    spotlightOpen = true;
    spotlightBackdrop.classList.add('is-open');
    spotlightBackdrop.setAttribute('aria-hidden', 'false');
    spotlightSpring.setTarget(1);
    spotlightInput.value = '';
    updateSpotlightResults('');
    setTimeout(() => spotlightInput.focus(), 20);
  }

  function closeSpotlight() {
    spotlightOpen = false;
    spotlightBackdrop.classList.remove('is-open');
    spotlightBackdrop.setAttribute('aria-hidden', 'true');
    spotlightSpring.setTarget(0);
  }

  function buildSpotlightIndex() {
    const entries = [];
    for (const item of state.catalog) {
      entries.push({
        title: item.name,
        sub: `${item.vendor} · ${item.section} ${item.installed ? '· Instalado' : ''}`,
        badge: item.installed ? 'Abrir / Ver' : 'Instalar',
        run: () => {
          activateTab(item.section);
          if (item.installed && item.installedPath) api.openApp(item.installedPath);
          else toggleAppSelection(item.id, true);
        },
      });
    }
    for (const emu of state.emulators) {
      entries.push({
        title: emu.name,
        sub: `Emulador · ${emu.platformLabel} · github.com/${emu.githubRepo}`,
        badge: 'GitHub',
        run: () => {
          activateTab('emuladores');
          toggleEmulatorSelection(emu.id, true);
        },
      });
    }
    for (const drv of state.hardware?.drivers || []) {
      entries.push({
        title: drv.name,
        sub: `Driver · ${drv.categoryLabel} · ${drv.sourceName}`,
        badge: 'Drivers',
        run: () => activateTab('drivers'),
      });
    }
    const quickActions = [
      ['Copiar especificaciones del PC', 'Copia CPU, GPU, RAM, placa madre, BIOS y discos al portapapeles', () => copyPcSpecs()],
      ['Reescanear hardware del PC', 'Actualiza detección de CPU, GPU, placa y drivers', () => scanHardware(true)],
      ['Analizar mi PC (Chequeo)', 'Revisa XMP/EXPO, BIOS, PCIe, Secure Boot y dispositivos', () => { activateTab('pc-check'); loadPcCheck(true); }],
      ['Cambiar tema (Oscuro / Claro)', 'Alterna entre modo oscuro y claro', () => state.applyTheme && state.applyTheme(state.theme === 'dark' ? 'light' : 'dark')],
      ['Cambiar idioma (ES / EN)', 'Alterna entre Español e Inglés', () => { if (state.applyLanguage) state.applyLanguage(state.lang === 'es' ? 'en' : 'es'); }],
      ['Abrir carpeta de respaldos', 'Abre la carpeta donde se guardan tus copias de seguridad', () => api.openPath()],
      ['Abrir configuración inicial', 'Vuelve a abrir el asistente de bienvenida', () => openSetup()],
      ['Buscar actualización de XHANNIZER0', 'Comprueba si existe una versión nueva en GitHub', () => { activateTab('acerca'); $('#btn-about-update')?.click(); }],
    ];
    for (const [title, sub, run] of quickActions) {
      entries.push({ title, sub, badge: 'Acción', run });
    }
    const quickTabs = [
      ['Resumen del equipo', 'resumen'],
      ['Piloto automático', 'piloto'],
      ['Drivers y BIOS', 'drivers'],
      ['Chequeo de PC', 'pc-check'],
      ['Herramientas', 'herramientas'],
      ['Launchers y Gaming', 'launchers'],
      ['Navegadores', 'navegadores'],
      ['Compresores y Utilidades', 'utilidades'],
      ['Programadores', 'dev'],
      ['Emuladores (GitHub)', 'emuladores'],
      ['Microsoft Store', 'store'],
      ['Presets Post-Formateo', 'presets'],
      ['Auditoría de Windows', 'windows-audit'],
      ['Gestor de Inicio Windows', 'startup'],
      ['Actualizador Global', 'upgrades'],
      ['Bloatware y Red / DNS', 'cleaner-net'],
      ['Carpetas y Discos', 'discos'],
      ['Migrar mi PC', 'migracion'],
      ['Mantenimiento y Limpieza', 'mantenimiento'],
      ['Rendimiento e informe', 'rendimiento'],
      ['Ajustes', 'ajustes'],
      ['Acerca de y soporte', 'acerca'],
    ];
    for (const [label, tab] of quickTabs) {
      entries.push({ title: label, sub: 'Ir a sección', badge: 'Sección', run: () => activateTab(tab) });
    }
    return entries;
  }

  function updateSpotlightResults(query) {
    const q = String(query || '').trim().toLowerCase();
    const all = buildSpotlightIndex();
    spotlightMatches = (q
      ? all.filter((e) => e.title.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q))
      : all.slice(0, 10)
    ).slice(0, 12);
    spotlightActiveIndex = 0;

    if (!spotlightMatches.length) {
      spotlightResults.innerHTML = `<div style="padding:14px;color:var(--label-2);font-size:13px;">Sin resultados para «${esc(q)}».</div>`;
      return;
    }

    spotlightResults.innerHTML = spotlightMatches
      .map(
        (m, idx) => `
      <button type="button" class="spotlight-item ${idx === 0 ? 'is-active' : ''}" data-spot-idx="${idx}">
        <div class="spotlight-item-copy">
          <strong>${esc(m.title)}</strong>
          <small>${esc(m.sub)}</small>
        </div>
        <span class="pill-badge is-neutral">${esc(m.badge)}</span>
      </button>`
      )
      .join('');
  }

  function initSpotlight() {
    $('#btn-open-spotlight').addEventListener('click', openSpotlight);
    spotlightBackdrop.addEventListener('click', (e) => {
      if (e.target === spotlightBackdrop) closeSpotlight();
    });
    spotlightInput.addEventListener('input', () => updateSpotlightResults(spotlightInput.value));
    spotlightResults.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-spot-idx]');
      if (!btn) return;
      const item = spotlightMatches[Number(btn.dataset.spotIdx)];
      closeSpotlight();
      if (item) item.run();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (spotlightOpen) closeSpotlight();
        else openSpotlight();
        return;
      }
      if (!spotlightOpen) return;
      if (e.key === 'Escape') {
        closeSpotlight();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        spotlightActiveIndex = Math.min(spotlightMatches.length - 1, spotlightActiveIndex + 1);
        $$('.spotlight-item', spotlightResults).forEach((el, i) => {
          el.classList.toggle('is-active', i === spotlightActiveIndex);
          if (i === spotlightActiveIndex) el.scrollIntoView({ block: 'nearest' });
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        spotlightActiveIndex = Math.max(0, spotlightActiveIndex - 1);
        $$('.spotlight-item', spotlightResults).forEach((el, i) => {
          el.classList.toggle('is-active', i === spotlightActiveIndex);
          if (i === spotlightActiveIndex) el.scrollIntoView({ block: 'nearest' });
        });
      } else if (e.key === 'Enter' && spotlightMatches[spotlightActiveIndex]) {
        e.preventDefault();
        const item = spotlightMatches[spotlightActiveIndex];
        closeSpotlight();
        item.run();
      }
    });
  }

  // Actualización automática: el proceso principal descarga la versión nueva en segundo plano
  // y aquí solo se muestra el botón de arriba («Reiniciar para actualizar»).
  let updateInfo = { state: 'idle' };
  function renderUpdateButton(st) {
    updateInfo = st || updateInfo;
    const btn = $('#xh-update-btn');
    const label = $('#xh-update-label');
    if (!btn || !label) return;
    const v = updateInfo.version ? ` v${updateInfo.version}` : '';
    let text = null;
    if (updateInfo.state === 'downloading') text = `Descargando${v} · ${Number(updateInfo.percent) || 0}%`;
    else if (updateInfo.state === 'ready') text = `Reiniciar para actualizar${v}`;
    else if (updateInfo.state === 'portable') text = `Nueva versión${v}`;
    btn.hidden = !text;
    btn.classList.toggle('is-ready', updateInfo.state === 'ready' || updateInfo.state === 'portable');
    btn.disabled = updateInfo.state === 'downloading';
    btn.title = updateInfo.state === 'ready'
      ? 'La actualización ya se descargó. Se instala en segundos y la app se vuelve a abrir sola.'
      : updateInfo.state === 'portable'
      ? 'La versión portable no se actualiza sola: descarga la nueva y reemplaza el archivo.'
      : 'Descargando la actualización en segundo plano.';
    if (text) label.textContent = text;
  }

  // Ventana superpuesta (con desenfoque) para instalar la actualización descargada
  function isAppBusy() {
    const busyStates = ['pending', 'downloading', 'installing'];
    return Array.from(state.itemStatus?.values?.() || []).some((s) => busyStates.includes(s?.state))
      || !$('#xh-setup')?.hidden
      || Boolean(pilotBusy)
      || Boolean(state.backupRunning)
      || Boolean($('#btn-cleanup-run')?.disabled)
      || Boolean($('#btn-mig-restore')?.disabled)
      || Boolean($('#btn-stab-run')?.disabled);
  }

  function openUpdateOverlay() {
    const v = updateInfo.version ? `v${updateInfo.version}` : 'la versión nueva';
    $('#update-ov-spinner').classList.remove('is-spinning');
    $('#update-ov-title').textContent = 'Actualización lista';
    $('#update-ov-desc').textContent = `XHANNIZER0 ${v} ya se descargó. Se instala en unos segundos y la app se vuelve a abrir sola. Si prefieres seguir ahora, se instalará cuando cierres la app.`;
    $('#update-ov-track').hidden = true;
    $('#update-ov-actions').hidden = false;
    $('#xh-update-overlay').hidden = false;
    $('#update-ov-now').focus();
  }

  async function runUpdateInstall() {
    const v = updateInfo.version ? ` v${updateInfo.version}` : '';
    $('#update-ov-actions').hidden = true;
    $('#update-ov-spinner').classList.add('is-spinning');
    $('#update-ov-title').textContent = `Actualizando XHANNIZER0${v}…`;
    $('#update-ov-desc').textContent = 'No apagues el PC. La app se cerrará un momento y se volverá a abrir sola cuando esté lista.';
    $('#xh-update-overlay').hidden = false;
    // Un instante para que se vea el aviso antes de que la app se cierre
    await new Promise((r) => setTimeout(r, 1400));
    const res = await api.updateInstall();
    if (!res?.ok) {
      $('#xh-update-overlay').hidden = true;
      showToast(res?.error || 'No se pudo instalar la actualización.');
    }
  }

  function initAppUpdates() {
    api.onUpdateState((st) => {
      const wasReady = updateInfo.state === 'ready';
      renderUpdateButton(st);
      if (st?.state === 'ready' && !wasReady) {
        // Si estás instalando algo o en el asistente, no se interrumpe: queda el botón de arriba
        if (isAppBusy()) showToast(`XHANNIZER0 v${st.version} está lista. Toca «Reiniciar para actualizar» arriba cuando termines.`);
        else openUpdateOverlay();
      }
    });
    api.updateState().then(renderUpdateButton).catch(() => {});
    $('#xh-update-btn')?.addEventListener('click', () => {
      if (updateInfo.state === 'portable') {
        api.openExternal(updateInfo.url);
        return;
      }
      if (updateInfo.state === 'ready') openUpdateOverlay();
    });
    $('#update-ov-later').addEventListener('click', () => {
      $('#xh-update-overlay').hidden = true;
      showToast('Se instalará cuando cierres XHANNIZER0. También puedes usar el botón de arriba.');
    });
    $('#update-ov-now').addEventListener('click', runUpdateInstall);
  }

  // Novedades: se muestran una vez, la primera vez que se abre una versión nueva
  async function showWhatsNewIfUpdated() {
    try {
      const res = await api.whatsNew();
      if (!res?.show) return;
      $('#whats-new-badge').textContent = `Actualizado a v${res.version}`;
      $('#whats-new-title').textContent = `Novedades de XHANNIZER0 ${res.version}`;
      const notes = res.notes?.length ? res.notes : ['Mejoras de estabilidad y correcciones.'];
      $('#whats-new-list').innerHTML = notes.map((n) => `<li>${esc(n)}</li>`).join('');
      $('#xh-whats-new').hidden = false;
    } catch {
      // Sin novedades que mostrar
    }
  }

  // =========================================================================
  // Asistente de bienvenida (primera vez)
  // =========================================================================
  const setup = { step: 1, mode: 'auto', use: null };
  const PRESET_FOR_USE = { gaming: 'preset-gaming', office: 'preset-office', school: 'preset-school', dev: 'preset-dev' };

  function showSetupStep(n) {
    setup.step = n;
    $$('#xh-setup .setup-step').forEach((sec) => {
      sec.hidden = Number(sec.dataset.step) !== n;
    });
    $$('#xh-setup [data-step-dot]').forEach((dot) => dot.classList.toggle('is-done', Number(dot.dataset.stepDot) <= n));
    const first = $(`#xh-setup .setup-step[data-step="${n}"] button, #xh-setup .setup-step[data-step="${n}"] input`);
    first?.focus();
  }

  function syncSetupLang() {
    $$('[data-setup-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset.setupLang === state.lang));
  }

  async function waitForHardware(timeoutMs = 30000) {
    const t0 = Date.now();
    while (!state.hardware && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 400));
    return state.hardware;
  }

  async function setSetupMode(mode) {
    setup.mode = mode;
    $$('[data-setup-mode]').forEach((b) => {
      const on = b.dataset.setupMode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    const status = $('#setup-detect-status');
    if (mode === 'manual') {
      status.hidden = true;
      $('#setup-cpu').focus();
      return;
    }
    status.hidden = false;
    status.textContent = 'Detectando tu PC…';
    $('#setup-step2-next').disabled = true;
    const hw = await waitForHardware();
    $('#setup-step2-next').disabled = false;
    if (setup.mode !== 'auto') return;
    if (!hw?.system) {
      status.textContent = 'No se pudo detectar tu PC. Escribe los datos a mano o continúa sin ellos.';
      return;
    }
    const sys = hw.system;
    $('#setup-windows').value = /Windows 10/i.test(sys.osName || '') ? 'Windows 10' : 'Windows 11';
    $('#setup-cpu').value = String(sys.cpuName || '').replace(/\s+/g, ' ').trim();
    $('#setup-gpu').value = sys.dedicatedGpuName || sys.integratedGpuName || '';
    const ram = String(sys.ramGb || '');
    $('#setup-ram').value = $(`#setup-ram option[value="${ram}"]`) ? ram : '';
    status.textContent = 'Listo: revisa que esté bien. Si algo no coincide, corrígelo aquí mismo.';
  }

  function setSetupUse(use) {
    setup.use = use;
    $$('[data-setup-use]').forEach((b) => {
      const on = b.dataset.setupUse === use;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function applySetupToSidebar(cfg) {
    if (!cfg?.completed || !cfg.pc) return;
    const parts = [cfg.pc.ramGb ? `${cfg.pc.ramGb} GB` : null, cfg.pc.windows].filter(Boolean);
    if (cfg.mode === 'manual' && parts.length) $('#side-os-name').textContent = parts.join(' · ');
  }

  async function finishSetup() {
    const btn = $('#setup-finish');
    btn.disabled = true;
    const res = await api.setupSave({
      mode: setup.mode,
      use: setup.use || 'general',
      pc: {
        windows: $('#setup-windows').value,
        cpu: $('#setup-cpu').value,
        gpu: $('#setup-gpu').value,
        ramGb: $('#setup-ram').value,
      },
    });
    btn.disabled = false;
    if (!res?.ok) {
      showToast('No se pudo guardar la configuración.');
      return;
    }
    state.setup = res;
    applySetupToSidebar(res);
    $('#xh-setup').hidden = true;
    const presetId = PRESET_FOR_USE[res.use];
    if (presetId) {
      activateTab('presets');
      setTimeout(() => {
        const card = $(`[data-preset-select="${presetId}"]`)?.closest('article');
        if (card) {
          card.classList.add('is-recommended-preset');
          card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 300);
      showToast('Listo. Te marcamos el preset recomendado: toca «Cargar al lote» para revisar sus apps.');
    } else {
      activateTab('piloto');
      showToast('Listo. Cuando quieras, el Piloto automático deja tu PC configurado con un botón.');
    }
  }

  // Desenfoca también la barra lateral mientras haya una ventana superpuesta abierta
  function watchOverlays() {
    const overlays = $$('.xh-overlay');
    const sync = () => document.documentElement.classList.toggle('xh-overlay-open', overlays.some((o) => !o.hidden));
    const mo = new MutationObserver(sync);
    overlays.forEach((o) => mo.observe(o, { attributes: true, attributeFilter: ['hidden'] }));
    sync();
  }

  function initSetup() {
    watchOverlays();
    $$('[data-setup-next]').forEach((b) => b.addEventListener('click', () => showSetupStep(Number(b.dataset.setupNext))));
    $$('[data-setup-mode]').forEach((b) => b.addEventListener('click', () => setSetupMode(b.dataset.setupMode)));
    $$('[data-setup-use]').forEach((b) => b.addEventListener('click', () => setSetupUse(b.dataset.setupUse)));
    $$('[data-setup-lang]').forEach((b) => b.addEventListener('click', () => {
      state.applyLanguage?.(b.dataset.setupLang);
      syncSetupLang();
    }));
    $('#setup-finish').addEventListener('click', finishSetup);
    $('#whats-new-close').addEventListener('click', () => {
      $('#xh-whats-new').hidden = true;
    });
    $('#btn-about-setup')?.addEventListener('click', () => openSetup());
  }

  async function openSetup() {
    syncSetupLang();
    const cfg = state.setup;
    if (cfg?.completed) {
      $('#setup-windows').value = cfg.pc?.windows || 'Windows 11';
      $('#setup-cpu').value = cfg.pc?.cpu || '';
      $('#setup-gpu').value = cfg.pc?.gpu || '';
      $('#setup-ram').value = cfg.pc?.ramGb ? String(cfg.pc.ramGb) : '';
      setSetupUse(cfg.use);
    }
    $('#xh-setup').hidden = false;
    showSetupStep(1);
    if (cfg?.mode === 'manual') setSetupMode('manual');
    else setSetupMode('auto');
  }

  // Primera vez: asistente. Si ya se configuró, se aplica y, si hubo actualización, se muestran las novedades.
  async function startOnboarding() {
    try {
      state.setup = await api.setupGet();
    } catch {
      state.setup = { completed: false };
    }
    if (!state.setup?.completed) {
      openSetup();
      api.whatsNew().catch(() => {}); // registra la versión para no mostrar «novedades» en la primera instalación
      return;
    }
    applySetupToSidebar(state.setup);
    showWhatsNewIfUpdated();
  }

  // =========================================================================
  // Chequeo de PC armado
  // =========================================================================
  const STATUS_PILL = { ok: ['is-ok', 'Correcto'], warn: ['is-warn', 'Revisar'], info: ['is-neutral', 'Info'] };
  const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>';
  const ICON_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>';

  async function loadPcCheck() {
    const btn = $('#btn-pccheck-run');
    btn.disabled = true;
    btn.textContent = 'Analizando…';
    try {
      const res = await api.pcCheck();
      if (!res?.ok) {
        showToast(res?.error || 'No se pudo analizar el PC.');
        return;
      }
      state.pcCheck = res;
      renderPcCheck();
      renderPostFormatChecklist();
      loadBiosGuide(false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Analizar de nuevo';
    }
  }

  function renderPcCheck() {
    const data = state.pcCheck;
    if (!data) return;
    const order = { warn: 0, info: 1, ok: 2 };
    const checks = [...data.checks].sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1));
    $('#pc-warn').textContent = String(checks.filter((c) => c.status === 'warn').length);
    $('#pc-ok').textContent = String(checks.filter((c) => c.status === 'ok').length);
    $('#pc-devices').textContent = String(data.devices.length);
    const badge = $('#badge-pccheck');
    badge.hidden = !data.warnCount;
    badge.textContent = String(data.warnCount || 0);
    renderDashboard();

    $('#pccheck-list').innerHTML = checks
      .map((c) => {
        const [cls, label] = STATUS_PILL[c.status] || STATUS_PILL.info;
        return `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-icon ${c.status === 'ok' ? '' : 'is-warn'}">${c.status === 'ok' ? ICON_OK : ICON_WARN}</div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(c.category)}</span>
              <span class="pill-badge ${cls}">${label}</span>
            </div>
            <div class="driver-name">${esc(c.title)}</div>
            <div class="driver-meta">
              ${c.detail ? `<span>${esc(c.detail)}</span>` : ''}
              ${c.fix ? `<span class="pc-fix">Cómo arreglarlo: ${esc(c.fix)}</span>` : ''}
            </div>
          </div>
        </div>
      </article>`;
      })
      .join('');

    $('#pccheck-devices').innerHTML = data.devices.length
      ? data.devices
          .map(
            (d) => `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-icon is-warn">${ICON_WARN}</div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(d.pnpClass || 'Dispositivo')}</span>
              <span class="pill-badge is-warn">${esc(d.problem)}</span>
            </div>
            <div class="driver-name">${esc(d.name)}</div>
            <div class="driver-meta"><span class="audit-origin-url">${esc(d.instanceId)}</span></div>
          </div>
          <div class="driver-actions">
            ${d.canSearchDriver
              ? `<button type="button" class="btn-action-small is-primary" data-device-driver="${esc(d.instanceId)}">Buscar driver</button>`
              : '<span class="pill-badge is-neutral">Revisar manualmente</span>'}
          </div>
        </div>
      </article>`
          )
          .join('')
      : `<article class="driver-card"><p class="section-subtitle">Todos tus dispositivos tienen su driver funcionando.</p></article>`;
  }

  function requestDeviceDriver(btn) {
    const instanceId = btn.dataset.deviceDriver;
    const device = state.pcCheck?.devices?.find((d) => d.instanceId === instanceId);
    if (!device) return;
    ensureVerifiedBackup({
      scope: 'drivers',
      label: `Driver para ${device.name}`,
      detail: 'Se buscará en Windows Update el driver WHQL cuyo Hardware ID coincide exactamente con este dispositivo.',
      items: [device.name],
      onConfirmed: async (backupRes) => {
        btn.disabled = true;
        btn.textContent = 'Buscando…';
        try {
          const res = await api.installDeviceDriver({ instanceId, backupId: backupRes.id });
          showToast(res?.ok ? `Driver de ${device.name} instalado o verificado.` : res?.error || 'No se pudo instalar el driver: revisa la Auditoría de descargas.');
          await loadPcCheck();
        } finally {
          btn.disabled = false;
          btn.textContent = 'Buscar driver';
        }
      },
    });
  }

  // =========================================================================
  // Migrar mi PC
  // =========================================================================
  const formatBytes = (n) => {
    const v = Number(n) || 0;
    if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`;
    if (v >= 1024 ** 2) return `${Math.round(v / 1024 ** 2)} MB`;
    return `${Math.max(1, Math.round(v / 1024))} KB`;
  };

  async function loadMigrationFolders() {
    const res = await api.migrationFolders();
    state.migFolders = (res?.folders || []).map((f) => ({ ...f, checked: ['desktop', 'documents', 'pictures'].includes(f.key), size: null }));
    renderMigrationFolders();
    // Medir tamaños en segundo plano, de a una carpeta
    for (const f of state.migFolders) {
      const m = await api.migrationMeasure(f.path);
      if (m?.ok) {
        f.size = m;
        renderMigrationFolders();
      }
    }
  }

  function renderMigrationFolders() {
    const list = $('#mig-folders');
    if (!list) return;
    list.innerHTML = (state.migFolders || [])
      .map(
        (f, i) => `
      <article class="driver-card">
        <label class="mig-check-row">
          <input type="checkbox" data-mig-folder="${i}" ${f.checked ? 'checked' : ''}>
          <span class="driver-main">
            <span class="driver-name">${esc(f.name)}</span>
            <span class="driver-meta"><span class="audit-origin-url">${esc(f.path)}</span>
            <span>${f.size ? `${f.size.files} archivos · ${formatBytes(f.size.bytes)}` : 'Calculando tamaño…'}</span></span>
          </span>
        </label>
      </article>`
      )
      .join('');
    const total = (state.migFolders || []).filter((f) => f.checked && f.size).reduce((s, f) => s + f.size.bytes, 0);
    $('#btn-mig-export').textContent = total ? `Exportar a USB o carpeta (${formatBytes(total)})` : 'Exportar a USB o carpeta';
  }

  function setMigrationProgress(p) {
    const box = $('#mig-progress-box');
    box.hidden = false;
    $('#mig-progress-step').textContent = p.step || '';
    $('#mig-progress-pct').textContent = `${Math.round(p.percent || 0)}%`;
    $('#mig-progress-bar').style.width = `${Math.round(p.percent || 0)}%`;
  }

  async function runMigrationExport() {
    const dest = await api.pickFolder();
    if (dest?.canceled || !dest?.path) return;
    const folders = (state.migFolders || []).filter((f) => f.checked).map((f) => (f.key ? { key: f.key } : { path: f.path }));
    const btn = $('#btn-mig-export');
    btn.disabled = true;
    setMigrationProgress({ step: 'Preparando migración…', percent: 1 });
    try {
      const res = await api.migrationExport({
        destDir: dest.path,
        folders,
        profile: { theme: state.theme, lang: state.lang, selectedIds: Array.from(state.selected.keys()) },
      });
      if (!res?.ok) {
        showToast(res?.error || 'No se pudo exportar la migración.');
        return;
      }
      showToast(`Migración lista: ${res.packages} programas y ${res.files} archivos (${formatBytes(res.bytes)}).`);
      await api.openPath(res.dir);
    } finally {
      btn.disabled = false;
    }
  }

  async function openMigration() {
    const res = await api.migrationOpen();
    if (res?.canceled) return;
    if (!res?.ok) {
      showToast(res?.error || 'No se pudo abrir la migración.');
      return;
    }
    if (res.importedBaseline) {
      showToast('Se cargó la medición «Antes» de tu PC anterior. Mide el «Después» en Rendimiento e informe.');
      state.bench = await api.benchmarkGet().catch(() => state.bench);
    }
    if (!state.winAudit) await loadWindowsAudit(false);
    state.migration = {
      ...res,
      packages: res.packages.map((p) => ({ ...p, checked: !p.installed })),
      settings: res.settingIds
        .map((id) => (state.winAudit?.items || []).find((i) => i.id === id))
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, isOptimal: s.isOptimal, checked: !s.isOptimal })),
      folders: res.folders.map((f) => ({ ...f, checked: true })),
    };
    renderMigrationRestore();
  }

  function renderMigrationRestore() {
    const mig = state.migration;
    const list = $('#mig-restore-list');
    if (!mig || !list) return;
    const group = (title, key, rows) => `
      <article class="driver-card">
        <div class="driver-title-row" style="justify-content:space-between;">
          <strong>${esc(title)}</strong>
          ${rows.length ? `<span><button type="button" class="btn-action-small is-ghost" data-mig-all="${key}" data-value="1">Todos</button>
          <button type="button" class="btn-action-small is-ghost" data-mig-all="${key}" data-value="0">Ninguno</button></span>` : ''}
        </div>
        ${rows.length ? rows.join('') : '<p class="section-subtitle">Nada para restaurar.</p>'}
      </article>`;
    const row = (key, i, checked, name, meta) => `
        <label class="mig-check-row" style="padding:6px 0;">
          <input type="checkbox" data-mig-item="${key}" data-index="${i}" ${checked ? 'checked' : ''}>
          <span><span class="driver-name" style="font-size:14px;">${esc(name)}</span> <span class="section-subtitle">${esc(meta)}</span></span>
        </label>`;
    list.innerHTML = `
      <div class="safety-banner"><div>Migración de <strong>${esc(mig.pcName || 'PC')}</strong> creada el ${esc(String(mig.createdAt || '').slice(0, 10))}.</div></div>
      ${group(`Programas (${mig.packages.length})`, 'packages', mig.packages.map((p, i) => row('packages', i, p.checked, p.name, `${p.wingetId}${p.installed ? ' · ya instalado' : ''}`)))}
      ${group(`Ajustes de Windows (${mig.settings.length})`, 'settings', mig.settings.map((s, i) => row('settings', i, s.checked, s.name, s.isOptimal ? 'ya aplicado aquí' : 'se aplicará con respaldo')))}
      ${group(`Carpetas (${mig.folders.length})`, 'folders', mig.folders.map((f, i) => row('folders', i, f.checked, f.name, `${f.files} archivos · ${formatBytes(f.bytes)}`)))}`;
    $('#btn-mig-restore').disabled = false;
  }

  async function runMigrationRestore() {
    const mig = state.migration;
    if (!mig) return;
    const folders = mig.folders.filter((f) => f.checked);
    const settings = mig.settings.filter((s) => s.checked);
    const tasks = mig.packages
      .filter((p) => p.checked)
      .map((p) => (p.catalogId && state.catalog.some((c) => c.id === p.catalogId)
        ? { id: p.catalogId, type: 'app', name: p.name }
        : { id: `wg-${p.wingetId}`, type: 'winget', wingetId: p.wingetId, wingetSource: p.source === 'msstore' ? 'msstore' : undefined, name: p.name }));
    if (!folders.length && !settings.length && !tasks.length) {
      showToast('No marcaste nada para restaurar.');
      return;
    }
    const btn = $('#btn-mig-restore');
    btn.disabled = true;
    try {
      if (folders.length) {
        setMigrationProgress({ step: 'Restaurando carpetas…', percent: 1 });
        const res = await api.migrationRestoreFolders({ manifestPath: mig.manifestPath, folderIds: folders.map((f) => f.id) });
        showToast(res?.ok ? res.message : res?.error || 'No se pudieron restaurar las carpetas.');
      }
      const installAll = async (backupId) => {
        if (tasks.length) await executeInstallTasks(tasks, backupId);
      };
      if (settings.length) {
        ensureVerifiedBackup({
          scope: 'windows-config',
          label: `Restaurar ${settings.length} ajustes de Windows de la migración`,
          detail: settings.map((s) => s.name).join(' · '),
          items: settings.map((s) => s.name),
          onConfirmed: async (backupRes) => {
            for (const s of settings) await api.applyWindowsSetting({ settingId: s.id, backupId: backupRes.id });
            state.winAudit = null;
            await installAll(backupRes.id);
          },
        });
      } else {
        await installAll(null);
      }
    } finally {
      btn.disabled = false;
    }
  }

  // =========================================================================
  // Mantenimiento
  // =========================================================================
  const REPAIR_CARDS = [
    { id: 'sfc', title: 'Reparar archivos de Windows (SFC)', desc: 'Busca y reemplaza archivos del sistema dañados o modificados. Tarda unos 10–20 minutos.' },
    { id: 'dism', title: 'Reparar la imagen de Windows (DISM)', desc: 'Descarga de Windows Update los componentes dañados que SFC no puede arreglar. Ejecútalo antes de SFC si SFC falla.' },
    { id: 'wu-reset', title: 'Restablecer Windows Update', desc: 'Para cuando Windows Update se queda trabado o da errores. Conserva una copia de la caché anterior.' },
  ];
  const DAY_NAMES = { Sunday: 'domingo', Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves', Friday: 'viernes', Saturday: 'sábado' };
  const ACTION_NAMES = {
    install: 'Instalación', 'windows-setting': 'Ajuste de Windows', preset: 'Preset', startup: 'Inicio de Windows', bloatware: 'Bloatware',
    network: 'Red / DNS', disk: 'Carpetas y discos', restore: 'Deshacer cambios', repair: 'Reparación de Windows', 'scheduled-update': 'Actualización programada',
    cleanup: 'Limpieza', 'restore-point': 'Punto de restauración', autopilot: 'Piloto automático', bios: 'BIOS', stability: 'Prueba de estabilidad', report: 'Informe técnico',
  };

  function renderRepairGrid() {
    $('#repair-grid').innerHTML = REPAIR_CARDS.map(
      (r) => `
      <article class="app-card">
        <div class="app-card-head"><strong>${esc(r.title)}</strong></div>
        <p class="app-card-desc">${esc(r.desc)}</p>
        <div class="repair-output" id="repair-out-${r.id}"></div>
        <button type="button" class="btn-action-small is-primary" data-repair="${r.id}">Ejecutar</button>
      </article>`
    ).join('');
  }

  async function runRepairFromCard(btn) {
    const kind = btn.dataset.repair;
    $$('[data-repair]').forEach((b) => (b.disabled = true));
    btn.textContent = 'En curso…';
    try {
      const res = await api.runRepair(kind);
      if (res?.canceled) return;
      showToast(res?.message || res?.error || 'Reparación terminada.');
      notifyDone('Mantenimiento terminado — XHANNIZER0', res?.message || 'Reparación finalizada.');
      const out = $(`#repair-out-${kind}`);
      if (out) out.textContent = res?.output || res?.error || '';
      loadActionLog();
    } finally {
      $$('[data-repair]').forEach((b) => (b.disabled = false));
      btn.textContent = 'Ejecutar';
    }
  }

  async function loadScheduledUpdate() {
    const s = await api.getScheduledUpdate();
    const status = $('#sched-status');
    if (s?.enabled) {
      const next = s.nextRun ? new Date(s.nextRun).toLocaleString() : '—';
      status.textContent = `Activada: cada ${DAY_NAMES[s.day] || s.day} a las ${s.time || '--:--'} · próxima: ${next}`;
      if (s.day) $('#sched-day').value = s.day;
      if (s.time) $('#sched-time').value = s.time;
    } else {
      status.textContent = 'Desactivada';
    }
  }

  async function loadActionLog() {
    const res = await api.getActionLog();
    const items = res?.items || [];
    const describe = (e) => {
      if (Array.isArray(e.items)) return e.items.map((i) => `${i.name || i.id}${i.ok ? '' : ' (falló)'}`).join(', ');
      if (e.action === 'restore') return `${e.total} cambio(s) deshechos${e.failed ? `, ${e.failed} con problemas` : ''}`;
      if (e.action === 'cleanup') return `${formatBytes(e.freedBytes)} liberados`;
      return e.label || e.kind || '';
    };
    $('#actionlog-list').innerHTML = items.length
      ? items
          .map(
            (e) => `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(ACTION_NAMES[e.action] || e.action)}</span>
              <span class="pill-badge ${e.ok === false ? 'is-warn' : 'is-ok'}">${esc(new Date(e.at).toLocaleString())}</span>
              ${e.reversible ? '<span class="pill-badge is-neutral">Reversible</span>' : ''}
            </div>
            <div class="driver-name" style="font-size:14px;">${esc(describe(e))}</div>
          </div>
        </div>
      </article>`
          )
          .join('')
      : `<article class="driver-card"><p class="section-subtitle">Todavía no hay acciones registradas.</p></article>`;
  }

  function loadMaintenance() {
    renderRepairGrid();
    loadScheduledUpdate();
    loadActionLog();
  }

  function initNewFeatures() {
    $('#btn-pccheck-run').addEventListener('click', loadPcCheck);

    api.onMigrationProgress(setMigrationProgress);
    $('#btn-mig-export').addEventListener('click', runMigrationExport);
    $('#btn-mig-add-folder').addEventListener('click', async () => {
      const res = await api.pickFolder();
      if (res?.canceled || !res?.path) return;
      if ((state.migFolders || []).some((f) => f.path === res.path)) return;
      const entry = { name: res.path.split(/[\\/]/).filter(Boolean).pop() || res.path, path: res.path, checked: true, size: null };
      state.migFolders = [...(state.migFolders || []), entry];
      renderMigrationFolders();
      const m = await api.migrationMeasure(res.path);
      if (m?.ok) {
        entry.size = m;
        renderMigrationFolders();
      }
    });
    $('#mig-folders').addEventListener('change', (e) => {
      const i = e.target.dataset.migFolder;
      if (i === undefined) return;
      state.migFolders[Number(i)].checked = e.target.checked;
      renderMigrationFolders();
    });
    $('#btn-mig-open').addEventListener('click', openMigration);
    $('#btn-mig-restore').addEventListener('click', runMigrationRestore);
    $('#mig-restore-list').addEventListener('change', (e) => {
      const key = e.target.dataset.migItem;
      if (!key || !state.migration) return;
      state.migration[key][Number(e.target.dataset.index)].checked = e.target.checked;
    });

    $('#btn-sched-enable').addEventListener('click', async () => {
      const res = await api.setScheduledUpdate({ enabled: true, day: $('#sched-day').value, time: $('#sched-time').value });
      showToast(res?.ok ? res.message : res?.error || 'No se pudo programar.');
      loadScheduledUpdate();
    });
    $('#btn-sched-disable').addEventListener('click', async () => {
      const res = await api.setScheduledUpdate({ enabled: false });
      showToast(res?.message || 'Actualización automática desactivada.');
      loadScheduledUpdate();
    });
    $('#btn-actionlog-refresh').addEventListener('click', loadActionLog);
    $('#btn-windows-usb')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const stop = api.onWindowsUsbProgress((p) => {
        if (p?.detail) btn.textContent = p.detail;
      });
      try {
        const res = await api.windowsUsb();
        showToast(res?.ok ? 'Se abrió la herramienta de Microsoft: elige «Unidad flash USB» y sigue los pasos.' : res?.error || 'No se pudo abrir la herramienta.');
      } finally {
        stop();
        btn.disabled = false;
        btn.textContent = 'Crear USB de Windows';
      }
    });

    $('#btn-export-diagnostics').addEventListener('click', async () => {
      const res = await api.exportDiagnostics();
      if (res?.canceled) return;
      showToast(res?.ok ? `Diagnóstico guardado en ${res.path}` : res?.error || 'No se pudo exportar el diagnóstico.');
    });

    // Botones creados dinámicamente
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.deviceDriver) {
        requestDeviceDriver(btn);
      } else if (btn.dataset.repair) {
        runRepairFromCard(btn);
      } else if (btn.dataset.migAll && state.migration) {
        const key = btn.dataset.migAll;
        state.migration[key].forEach((x) => (x.checked = btn.dataset.value === '1'));
        renderMigrationRestore();
      } else if (btn.id === 'btn-restart-explorer') {
        btn.disabled = true;
        try {
          const res = await api.restartExplorer();
          if (!res?.canceled) showToast(res?.message || 'Explorador reiniciado.');
        } finally {
          btn.disabled = false;
        }
      }
    });
  }

  // =========================================================================
  // Errores inesperados: se registran y se ofrece exportar el diagnóstico
  // =========================================================================
  let lastErrorBarAt = 0;
  function showErrorBar(message) {
    if (Date.now() - lastErrorBarAt < 8000) return;
    lastErrorBarAt = Date.now();
    $('#xh-error-bar')?.remove();
    const bar = document.createElement('div');
    bar.id = 'xh-error-bar';
    bar.className = 'xh-error-bar';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = `<span>Algo falló: ${esc(String(message || 'error inesperado').slice(0, 160))}</span>
      <button type="button" class="btn-action-small is-primary" data-error-diag>Exportar diagnóstico</button>
      <button type="button" class="btn-action-small is-ghost" data-error-close>Cerrar</button>`;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 20000);
  }

  function reportUiError(err) {
    const message = err?.message || String(err || 'Error desconocido');
    api.reportError({ message, stack: err?.stack || '' });
    showErrorBar(message);
  }
  window.addEventListener('error', (e) => {
    if (e.error || e.message) reportUiError(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => reportUiError(e.reason));

  // =========================================================================
  // Asistente de BIOS
  // =========================================================================
  async function loadBiosGuide(all) {
    const res = await api.biosGuide({ all });
    const list = $('#bios-guide');
    if (!res?.ok || !list) return;
    $('#bios-sub').textContent = `Guía para ${res.brand}${res.board ? ` (${res.board})` : ''}. Para entrar: ${res.keys}. ${res.note}`;
    if (!res.sections.length) {
      list.innerHTML = `<article class="driver-card"><p class="section-subtitle">${all ? 'No hay guías disponibles.' : 'El chequeo no encontró nada que cambiar en la BIOS. Si quieres revisar igual, toca «Ver todas las guías».'}</p></article>`;
      return;
    }
    list.innerHTML = res.sections
      .map(
        (s) => `
      <article class="driver-card">
        <div class="driver-name" style="font-size:15px;">${esc(s.title)}</div>
        <div class="bios-path">${s.path.map((p) => `<span>${esc(p)}</span>`).join('<i>›</i>')}</div>
      </article>`
      )
      .join('') + `<p class="section-subtitle">${esc(res.disclaimer)}</p>`;
  }

  // =========================================================================
  // Limpieza post-formateo
  // =========================================================================
  async function loadCleanup() {
    const btn = $('#btn-cleanup-scan');
    btn.disabled = true;
    btn.textContent = 'Analizando…';
    $('#cleanup-list').innerHTML = `<article class="driver-card"><p class="section-subtitle">Midiendo carpetas… Windows.old puede tardar un poco.</p></article>`;
    try {
      const res = await api.cleanupScan();
      state.cleanup = (res?.items || []).map((i) => ({ ...i, checked: i.defaultOn }));
      renderCleanup();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Analizar de nuevo';
    }
  }

  function renderCleanup() {
    const items = state.cleanup || [];
    $('#cleanup-list').innerHTML = items
      .map(
        (it, i) => `
      <article class="driver-card">
        <label class="mig-check-row">
          <input type="checkbox" data-cleanup="${i}" ${it.checked ? 'checked' : ''}>
          <span class="driver-main">
            <span class="driver-name" style="font-size:14px;">${esc(it.name)}
              ${it.bytes !== null ? `<span class="pill-badge ${it.bytes > 1024 ** 3 ? 'is-warn' : 'is-neutral'}">${it.approximate ? '≈ ' : ''}${formatBytes(it.bytes)}</span>` : ''}
              ${it.elevated ? '<span class="pill-badge is-neutral">Admin</span>' : ''}</span>
            <span class="driver-meta"><span>${esc(it.detail)}</span></span>
          </span>
        </label>
      </article>`
      )
      .join('');
    $('#btn-cleanup-run').disabled = !items.some((i) => i.checked);
  }

  async function runCleanupSelection(ids) {
    const res = await api.cleanupRun({ ids });
    if (res?.canceled) return res;
    $('#cleanup-progress-box').hidden = true;
    if (!res?.ok) {
      showToast(res?.error || 'No se pudo limpiar.');
      return res;
    }
    const msg = `Limpieza terminada: ${formatBytes(res.freedBytes)} liberados.${res.notes?.length ? ` ${res.notes.join(' ')}` : ''}`;
    showToast(msg);
    notifyDone('Limpieza terminada — XHANNIZER0', msg);
    return res;
  }

  // =========================================================================
  // Antes y después
  // =========================================================================
  function benchHeadline(cmp) {
    const by = Object.fromEntries(cmp.map((m) => [m.key, m]));
    const parts = [];
    if (by.bootMs?.improved && by.bootMs.changePct <= -5) parts.push(`arranca ${Math.abs(by.bootMs.changePct)}% más rápido`);
    if (by.ramUsedMb?.improved) {
      const gb = Math.round((by.ramUsedMb.before - by.ramUsedMb.after) * 10) / 10;
      if (gb >= 0.1) parts.push(`usa ${gb} GB menos de RAM`);
    }
    if (by.processes?.improved) parts.push(`tiene ${by.processes.before - by.processes.after} procesos menos`);
    if (by.diskFreeGb?.improved && by.diskFreeGb.after - by.diskFreeGb.before >= 1) parts.push(`ganó ${Math.round(by.diskFreeGb.after - by.diskFreeGb.before)} GB de espacio`);
    if (!parts.length) return 'Sin cambios importantes por ahora.';
    const last = parts.pop();
    return `Tu PC ${parts.length ? `${parts.join(', ')} y ${last}` : last}.`;
  }

  async function loadBenchmark() {
    state.bench = await api.benchmarkGet();
    renderBenchmark();
  }

  function renderBenchmark() {
    const b = state.bench;
    const card = $('#bench-card');
    if (!b?.baseline) {
      card.innerHTML = '<p class="section-subtitle">Todavía no hay mediciones. Empieza con «Medir “Antes”».</p>';
      $('#btn-bench-share').disabled = true;
      return;
    }
    const fmtDate = (iso) => new Date(iso).toLocaleString();
    if (!b.comparison?.length) {
      const s = b.baseline;
      card.innerHTML = `
        <div class="bench-headline">Medición «Antes» guardada</div>
        <p class="section-subtitle">${esc(fmtDate(s.takenAt))}${s.fromMigration ? ` · traída desde la migración${s.pcName ? ` de ${esc(s.pcName)}` : ''} (antes de formatear)` : ''}. Optimiza tu PC y luego toca «Medir “Después”».</p>
        <div class="bench-grid">
          <div class="bench-metric"><span>RAM usada en reposo</span><strong>${(s.ramUsedMb / 1024).toFixed(1)} GB</strong></div>
          <div class="bench-metric"><span>Procesos</span><strong>${esc(s.processes)}</strong></div>
          <div class="bench-metric"><span>Programas al inicio</span><strong>${esc(s.startupEnabled ?? '—')}</strong></div>
          <div class="bench-metric"><span>Arranque</span><strong>${s.bootMs ? `${(s.bootMs / 1000).toFixed(1)} s` : 'No disponible'}</strong></div>
        </div>`;
      $('#btn-bench-share').disabled = true;
      return;
    }
    card.innerHTML = `
      <div class="bench-headline">${esc(benchHeadline(b.comparison))}</div>
      <p class="section-subtitle">Antes: ${esc(fmtDate(b.baseline.takenAt))}${b.baseline.fromMigration ? ' (antes de formatear)' : ''} · Después: ${esc(fmtDate(b.latest.takenAt))} · XHANNIZER0</p>
      <div class="bench-grid">
        ${b.comparison
          .map(
            (m) => `
          <div class="bench-metric">
            <span>${esc(m.label)}</span>
            <strong>${esc(m.before)} → ${esc(m.after)} ${esc(m.unit)}</strong>
            <em class="${m.same ? '' : m.improved ? 'is-good' : 'is-bad'}">${m.same ? 'Igual' : `${m.changePct > 0 ? '+' : ''}${m.changePct}%`}</em>
          </div>`
          )
          .join('')}
      </div>
      ${b.comparison.some((m) => m.key === 'bootMs') ? '' : '<p class="section-subtitle" style="margin-top:8px;">El tiempo de arranque solo aparece si Windows lo registró (requiere haber reiniciado al menos una vez).</p>'}`;
    $('#btn-bench-share').disabled = false;
  }

  async function takeBenchmark(asBaseline) {
    const btn = asBaseline ? $('#btn-bench-baseline') : $('#btn-bench-after');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Midiendo…';
    try {
      const res = await api.benchmarkTake({ asBaseline });
      if (!res?.ok) {
        showToast(res?.error || 'No se pudo medir.');
        return res;
      }
      state.bench = res;
      renderBenchmark();
      return res;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // =========================================================================
  // Prueba de estabilidad
  // =========================================================================
  async function runStability() {
    $('#btn-stab-run').disabled = true;
    $('#btn-stab-stop').hidden = false;
    $('#stab-progress-box').hidden = false;
    $('#stab-result').innerHTML = '';
    try {
      const res = await api.stabilityRun({ minutes: Number($('#stab-min').value), memoryPercent: 60 });
      if (!res?.ok) {
        showToast(res?.error || 'No se pudo iniciar la prueba.');
        return;
      }
      $('#stab-result').innerHTML = `
        <article class="driver-card">
          <div class="driver-top">
            <div class="driver-icon ${res.stable ? '' : 'is-warn'}">${res.stable ? ICON_OK : ICON_WARN}</div>
            <div class="driver-main" style="grid-column: span 2;">
              <div class="driver-title-row">
                <span class="pill-badge ${res.stable ? 'is-ok' : 'is-warn'}">${res.stable ? 'Estable' : 'Inestable'}</span>
                <span class="pill-badge is-neutral">${esc(res.testedGb)} GB · ${esc(res.threads)} hilos · ${esc(res.minutes)} min</span>
              </div>
              <div class="driver-name" style="font-size:15px;">${esc(res.verdict)}</div>
              <div class="driver-meta"><span>Errores de memoria: ${esc(res.errors)} · Errores de hardware de Windows (WHEA): ${esc(res.wheaErrors)} · ${esc(res.gbVerified)} GB verificados</span>
              <span>Para temperaturas usa HWiNFO (en Herramientas) mientras corre la prueba.</span></div>
            </div>
          </div>
        </article>`;
      notifyDone('Prueba de estabilidad terminada — XHANNIZER0', res.verdict || 'Análisis completado.');
    } finally {
      $('#btn-stab-run').disabled = false;
      $('#btn-stab-stop').hidden = true;
      $('#stab-progress-box').hidden = true;
    }
  }

  // =========================================================================
  // Perfiles con código
  // =========================================================================
  async function ensureWinAudit() {
    if (!state.winAudit) await loadWindowsAudit(false);
    return state.winAudit?.items || [];
  }

  async function generateProfileCode() {
    const settings = await ensureWinAudit();
    const appIds = Array.from(new Set([
      ...Array.from(state.selected.values()).filter((s) => s.type === 'app').map((s) => s.id),
      ...state.catalog.filter((c) => c.installed).map((c) => c.id),
    ]));
    const settingIds = settings.filter((s) => s.isOptimal && s.id !== 'win-refresh-rate').map((s) => s.id);
    const res = await api.profileCodeEncode({ name: $('#side-pc-name')?.textContent || '', appIds, settingIds });
    if (!res?.ok) {
      showToast(res?.error || 'No se pudo generar el código.');
      return;
    }
    $('#code-output').value = res.code;
    state.profileLink = res.link;
    const qr = $('#profile-qr');
    // El SVG lo genera el proceso principal con la librería qrcode (solo rect/path, sin scripts)
    if (res.qrSvg && /^<svg[\s\S]*<\/svg>\s*$/.test(res.qrSvg) && !/<script|on\w+=/i.test(res.qrSvg)) {
      qr.innerHTML = res.qrSvg;
      qr.classList.remove('is-empty');
    } else {
      qr.textContent = 'Perfil muy grande para QR: usa el enlace';
      qr.classList.add('is-empty');
    }
    $('#profile-share').hidden = false;
    showToast(`Código copiado: ${res.apps} apps y ${res.settings} ajustes.`);
  }

  async function decodeCode(code) {
    const res = await api.profileCodeDecode(code);
    if (!res?.ok) showToast(res?.error || 'Código inválido.');
    return res?.ok ? res : null;
  }

  async function importProfileCode() {
    const data = await decodeCode($('#code-input').value);
    if (!data) return;
    let queued = 0;
    for (const id of data.appIds) {
      const item = state.catalog.find((c) => c.id === id);
      if (item && !item.installed && !state.selected.has(id)) {
        toggleAppSelection(id, true);
        queued += 1;
      }
    }
    const items = await ensureWinAudit();
    const pending = data.settingIds.map((id) => items.find((i) => i.id === id)).filter((i) => i && !i.isOptimal);
    showToast(`Código${data.name ? ` de ${data.name}` : ''}: ${queued} apps agregadas a tu selección${pending.length ? `, ${pending.length} ajustes por aplicar` : ''}.`);
    if (pending.length) {
      ensureVerifiedBackup({
        scope: 'windows-config',
        label: `Aplicar ${pending.length} ajustes del código de perfil`,
        detail: pending.map((p) => p.name).join(' · '),
        items: pending.map((p) => p.name),
        onConfirmed: async (backupRes) => {
          for (const p of pending) await api.applyWindowsSetting({ settingId: p.id, backupId: backupRes.id });
          await loadWindowsAudit(false);
          showToast(`${pending.length} ajustes del perfil aplicados.`);
        },
      });
    }
  }

  // =========================================================================
  // Piloto automático
  // =========================================================================
  const PILOT_STEPS = [
    { id: 'baseline', title: 'Medir «Antes»', desc: 'Guarda cómo está el PC ahora para mostrarte la mejora al final.', on: true },
    { id: 'backup', title: 'Respaldo verificado', desc: 'Obligatorio: permite deshacer cada cambio desde Carpetas y Discos.', on: true, locked: true },
    { id: 'restore-point', title: 'Punto de restauración de Windows', desc: 'Red de seguridad extra de Windows.', on: true },
    { id: 'drivers', title: 'Drivers con actualización', desc: 'Instala la versión recomendada de cada componente que la necesite.', on: true },
    { id: 'runtimes', title: 'Runtimes esenciales', desc: 'Visual C++, DirectX, .NET Desktop y XNA que falten (los piden muchos juegos).', on: true },
    { id: 'apps', title: 'Tus apps', desc: '', on: true },
    { id: 'settings', title: 'Ajustes recomendados de Windows', desc: 'Los mismos de «Aplicar recomendadas» en la Auditoría de Windows.', on: true },
    { id: 'win11', title: 'Quitar anuncios de Windows 11', desc: 'Anuncios del Inicio, Bing en la búsqueda, widgets, Recall y más.', on: false },
    { id: 'cleanup', title: 'Limpieza post-formateo', desc: 'Temporales, caché de Windows Update y de la GPU. Windows.old no se toca.', on: true },
    { id: 'pccheck', title: 'Chequeo de PC final', desc: 'Revisa XMP/EXPO, Resizable BAR, Secure Boot y dispositivos sin driver.', on: true },
    { id: 'after', title: 'Medir «Después»', desc: 'Compara con la medición inicial en Rendimiento e informe.', on: true },
  ];
  const PILOT_CLEANUP = ['user-temp', 'shader-cache', 'win-temp', 'wu-cache'];
  const PILOT_STATUS = {
    pending: ['is-neutral', 'Pendiente'],
    running: ['is-warn', 'En curso…'],
    done: ['is-ok', 'Listo'],
    skipped: ['is-neutral', 'Omitido'],
    failed: ['is-warn', 'Con problemas'],
  };
  let pilotBusy = false;
  let pilotStopRequested = false;

  function pilotAppIds() {
    if (state.pilotCode?.appIds?.length) return state.pilotCode.appIds;
    return Array.from(state.selected.values()).filter((s) => s.type === 'app').map((s) => s.id);
  }

  function renderPilot() {
    const run = state.pilot;
    const appCount = run ? run.appIds.length : pilotAppIds().length;
    $('#pilot-apps-info').textContent = state.pilotCode
      ? `Código cargado${state.pilotCode.name ? ` (${state.pilotCode.name})` : ''}: ${state.pilotCode.appIds.length} apps y ${state.pilotCode.settingIds.length} ajustes.`
      : appCount
        ? `${appCount} apps de tu selección actual. También puedes pegar un código de perfil.`
        : 'No elegiste apps: márcalas en el catálogo o pega un código de perfil (XHZ1-…).';
    $('#pilot-steps').innerHTML = PILOT_STEPS.map((s) => {
      const st = run?.steps.find((x) => x.id === s.id);
      const enabled = run ? st?.enabled : state.pilotDraft?.[s.id] ?? s.on;
      const [cls, label] = PILOT_STATUS[st?.status || 'pending'];
      const desc = s.id === 'apps' ? `${appCount} apps del catálogo que todavía no tienes instaladas.` : s.desc;
      return `
      <article class="driver-card">
        <div class="driver-top">
          <label class="mig-check-row" style="grid-column: span 2;">
            <input type="checkbox" data-pilot-step="${s.id}" ${enabled ? 'checked' : ''} ${s.locked || run ? 'disabled' : ''}>
            <span class="driver-main">
              <span class="driver-name" style="font-size:14px;">${esc(s.title)}</span>
              <span class="driver-meta"><span>${esc(st?.note || desc)}</span></span>
            </span>
          </label>
          <div class="driver-actions pilot-step-status">${run && enabled ? `<span class="pill-badge ${cls}">${label}</span>` : ''}</div>
        </div>
      </article>`;
    }).join('');
    const active = run && ['running', 'awaiting-reboot'].includes(run.status);
    $('#btn-pilot-start').textContent = !run ? 'Iniciar piloto automático' : active ? 'Continuar' : 'Empezar de nuevo';
    $('#btn-pilot-start').disabled = pilotBusy;
    $('#btn-pilot-stop').hidden = !pilotBusy;
    $('#pilot-reboot-box').hidden = !(run?.status === 'awaiting-reboot' && !pilotBusy);
    const doneSteps = run ? run.steps.filter((x) => x.enabled && ['done', 'skipped', 'failed'].includes(x.status)).length : 0;
    const total = run ? run.steps.filter((x) => x.enabled).length : 0;
    if (run) {
      $('#pilot-progress-box').hidden = false;
      const pct = total ? Math.round((doneSteps / total) * 100) : 0;
      $('#pilot-progress-pct').textContent = `${pct}%`;
      $('#pilot-progress-bar').style.width = `${pct}%`;
      if (!pilotBusy) {
        $('#pilot-progress-step').textContent = run.status === 'done'
          ? '¡Listo! Mira el resultado en «Rendimiento e informe».'
          : run.status === 'awaiting-reboot' ? 'Esperando reinicio.' : run.status === 'stopped' ? 'Detenido.' : 'Quedó a medias: toca «Continuar».';
      }
    }
  }

  function setPilotStep(id, status, note = '') {
    const st = state.pilot.steps.find((s) => s.id === id);
    if (!st) return;
    st.status = status;
    if (note) st.note = note;
    if (status === 'running') $('#pilot-progress-step').textContent = `${PILOT_STEPS.find((s) => s.id === id)?.title}…`;
    api.autopilotSave(state.pilot);
    renderPilot();
  }

  async function startPilot() {
    if (pilotBusy) return;
    const run = state.pilot;
    if (run && ['running', 'awaiting-reboot'].includes(run.status)) {
      await continuePilot();
      return;
    }
    const enabled = Object.fromEntries(PILOT_STEPS.map((s) => [s.id, s.locked ? true : Boolean($(`[data-pilot-step="${s.id}"]`)?.checked)]));
    const titles = PILOT_STEPS.filter((s) => enabled[s.id]).map((s) => s.title);
    ensureVerifiedBackup({
      scope: 'drivers',
      label: 'Piloto automático post-formateo',
      detail: titles.join(' · '),
      items: titles,
      forceNew: true,
      onConfirmed: async (backupRes) => {
        state.pilotSettingIds = state.pilotCode?.settingIds || [];
        state.pilot = {
          status: 'running',
          startedAt: new Date().toISOString(),
          backupId: backupRes.id,
          steps: PILOT_STEPS.map((s) => ({ id: s.id, enabled: enabled[s.id], status: s.id === 'backup' ? 'done' : 'pending', note: s.id === 'backup' ? `Respaldo ${backupRes.id}` : '' })),
          appIds: pilotAppIds(),
          settingIds: state.pilotSettingIds,
          cleanupIds: PILOT_CLEANUP,
        };
        await api.autopilotSave(state.pilot);
        await runPilotSteps();
      },
    });
  }

  async function continuePilot() {
    await refreshBackupCount();
    const keepOriginal = state.pilot?.backupId && (state.backups || []).some((b) => b.id === state.pilot.backupId);
    if (keepOriginal || state.recentBackup?.id) {
      if (!keepOriginal) state.pilot.backupId = state.recentBackup.id;
      state.pilot.status = 'running';
      await runPilotSteps();
      return;
    }
    ensureVerifiedBackup({
      scope: 'drivers',
      label: 'Continuar el piloto automático',
      detail: 'El respaldo anterior venció (dura 24 horas): se crea uno nuevo antes de seguir.',
      items: [],
      forceNew: true,
      onConfirmed: async (backupRes) => {
        state.pilot.backupId = backupRes.id;
        state.pilot.status = 'running';
        await runPilotSteps();
      },
    });
  }

  async function runPilotStep(id) {
    const bid = state.pilot.backupId;
    if (id === 'baseline' || id === 'after') {
      const res = await api.benchmarkTake({ asBaseline: id === 'baseline' });
      state.bench = res;
      return res?.ok ? { status: 'done' } : { status: 'failed', note: res?.error || 'No se pudo medir.' };
    }
    if (id === 'restore-point') {
      const res = await api.createRestorePoint();
      return res?.ok ? { status: 'done' } : { status: 'failed', note: res?.error };
    }
    if (id === 'drivers') {
      if (!state.hardware) await scanHardware(false);
      if (liveDriversPromise) await liveDriversPromise;
      const drivers = (state.hardware?.drivers || []).filter((d) => d.needsUpdate && !state.omittedDrivers.has(d.id));
      if (!drivers.length) return { status: 'skipped', note: 'Todos los drivers ya estaban al día.' };
      const tasks = drivers.map((d) => ({
        id: d.id,
        type: 'driver',
        name: `${d.categoryLabel}: ${d.name}`,
        driverBranch: d.advisory?.recommendation === 'safe' ? 'safe' : 'latest',
        officialUrl: d.officialUrl,
        safeUrl: d.safeUrl,
        wingetId: d.wingetId || null,
      }));
      const res = await executeInstallTasks(tasks, bid);
      const ok = (res?.results || []).filter((r) => r?.ok).length;
      if (!res?.ok) return { status: 'failed', note: res?.error || 'No se pudieron instalar los drivers.' };
      return { status: ok === tasks.length ? 'done' : 'failed', note: `${ok} de ${tasks.length} drivers instalados.`, reboot: ok > 0 };
    }
    if (id === 'runtimes' || id === 'apps') {
      const items = id === 'runtimes'
        ? state.catalog.filter((c) => /^(vcredist|directx|dotnet-desktop|xna)/.test(c.id))
        : state.pilot.appIds.map((aid) => state.catalog.find((c) => c.id === aid)).filter(Boolean);
      const missing = items.filter((c) => !c.installed);
      if (!missing.length) return { status: 'skipped', note: items.length ? 'Ya estaban todos instalados.' : 'No había apps elegidas.' };
      const res = await executeInstallTasks(missing.map((c) => ({ id: c.id, type: 'app', name: c.name, officialUrl: c.officialUrl })), bid);
      const ok = (res?.results || []).filter((r) => r?.ok).length;
      if (!res?.ok) return { status: 'failed', note: res?.error || 'No se pudo instalar.' };
      return { status: ok === missing.length ? 'done' : 'failed', note: `${ok} de ${missing.length} instalados.` };
    }
    if (id === 'settings' || id === 'win11') {
      state.winAudit = null;
      const items = await ensureWinAudit();
      const fromCode = new Set(state.pilotSettingIds || []);
      const pending = items.filter((i) => !i.isOptimal && (id === 'win11'
        ? i.group === 'win11'
        : i.group !== 'win11' && ((!i.optional && i.id !== 'win-refresh-rate' && i.id !== 'win-hags') || fromCode.has(i.id))));
      if (!pending.length) return { status: 'skipped', note: 'Ya estaban aplicados.' };
      let ok = 0;
      for (const p of pending) {
        const r = await api.applyWindowsSetting({ settingId: p.id, backupId: bid });
        if (r?.ok !== false) ok += 1;
      }
      if (id === 'win11') await api.restartExplorer();
      await loadWindowsAudit(false);
      return { status: ok === pending.length ? 'done' : 'failed', note: `${ok} de ${pending.length} ajustes aplicados.` };
    }
    if (id === 'cleanup') {
      const res = await runCleanupSelection(state.pilot.cleanupIds);
      if (res?.canceled) return { status: 'skipped', note: 'Cancelaste la limpieza.' };
      return res?.ok ? { status: 'done', note: `${formatBytes(res.freedBytes)} liberados.` } : { status: 'failed', note: res?.error };
    }
    if (id === 'pccheck') {
      await loadPcCheck();
      const warn = state.pcCheck?.warnCount || 0;
      return { status: 'done', note: warn ? `${warn} cosas para revisar: mira Chequeo de PC y el Asistente de BIOS.` : 'Todo correcto.' };
    }
    return { status: 'skipped' };
  }

  async function runPilotSteps() {
    if (pilotBusy) return;
    pilotBusy = true;
    pilotStopRequested = false;
    activateTab('piloto');
    renderPilot();
    try {
      for (const step of state.pilot.steps) {
        if (!step.enabled || ['done', 'skipped'].includes(step.status)) continue;
        if (pilotStopRequested) {
          state.pilot.status = 'stopped';
          break;
        }
        setPilotStep(step.id, 'running');
        let result;
        try {
          result = await runPilotStep(step.id);
        } catch (err) {
          result = { status: 'failed', note: err?.message || 'Error inesperado.' };
        }
        setPilotStep(step.id, result.status, result.note || '');
        if (result.reboot) {
          state.pilot.status = 'awaiting-reboot';
          break;
        }
      }
      if (state.pilot.status === 'running') {
        state.pilot.status = 'done';
        showToast('Piloto automático terminado.');
        notifyDone('Piloto automático terminado — XHANNIZER0', 'Todos los pasos seleccionados han finalizado.');
        if (state.pilot.steps.find((s) => s.id === 'after')?.status === 'done') loadBenchmark();
      }
    } finally {
      pilotBusy = false;
      await api.autopilotSave(state.pilot);
      renderPilot();
    }
  }

  async function resumePilotIfNeeded() {
    const res = await api.autopilotGet();
    const saved = res?.state;
    if (!saved || !['running', 'awaiting-reboot'].includes(saved.status)) return;
    state.pilot = saved;
    state.pilotSettingIds = Array.isArray(saved.settingIds) ? saved.settingIds : [];
    activateTab('piloto');
    renderPilot();
    if (res.resumed) {
      showToast('Volviste del reinicio: el piloto automático sigue donde quedó.');
      await continuePilot();
    } else {
      showToast('El piloto automático quedó a medias: toca «Continuar» para seguir.');
    }
  }

  function initExtraFeatures() {
    api.onAppError((info) => showErrorBar(info?.message));

    $('#btn-bios-all').addEventListener('click', () => loadBiosGuide(true));
    $('#btn-reboot-bios').addEventListener('click', async () => {
      const res = await api.rebootToBios();
      if (!res?.canceled) showToast(res?.ok ? res.message : res?.error || 'No se pudo reiniciar a la BIOS.');
    });

    $('#btn-cleanup-scan').addEventListener('click', loadCleanup);
    $('#cleanup-list').addEventListener('change', (e) => {
      const i = e.target.dataset.cleanup;
      if (i === undefined) return;
      state.cleanup[Number(i)].checked = e.target.checked;
      renderCleanup();
    });
    $('#btn-cleanup-run').addEventListener('click', async () => {
      const ids = (state.cleanup || []).filter((c) => c.checked).map((c) => c.id);
      const btn = $('#btn-cleanup-run');
      btn.disabled = true;
      let res;
      try {
        res = await runCleanupSelection(ids);
      } finally {
        btn.disabled = false;
      }
      if (res?.ok) {
        loadCleanup();
        loadActionLog();
      }
    });
    api.onCleanupProgress((p) => {
      $('#cleanup-progress-box').hidden = p.percent >= 100;
      $('#cleanup-progress-step').textContent = p.step || '';
      $('#cleanup-progress-pct').textContent = `${Math.round(p.percent || 0)}%`;
      $('#cleanup-progress-bar').style.width = `${Math.round(p.percent || 0)}%`;
      if (state.pilot && pilotBusy) $('#pilot-progress-step').textContent = p.step || '';
    });

    $('#btn-restore-point').addEventListener('click', async () => {
      const btn = $('#btn-restore-point');
      btn.disabled = true;
      let res;
      try {
        res = await api.createRestorePoint();
      } finally {
        btn.disabled = false;
      }
      showToast(res?.ok ? res.message : res?.error || 'No se pudo crear el punto de restauración.');
      loadActionLog();
    });

    $('#btn-bench-baseline').addEventListener('click', () => takeBenchmark(true));
    $('#btn-bench-after').addEventListener('click', () => takeBenchmark(false));
    $('#btn-bench-share').addEventListener('click', async () => {
      const r = $('#bench-card').getBoundingClientRect();
      const res = await api.benchmarkShare({ x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 });
      if (res?.ok) showToast(`Imagen guardada en ${res.path}`);
    });

    $('#btn-stab-run').addEventListener('click', runStability);
    $('#btn-stab-stop').addEventListener('click', () => api.stabilityStop());
    api.onStabilityProgress((p) => {
      $('#stab-progress-step').textContent = `${p.step || ''}${p.errors ? ` · ${p.errors} errores` : ''}`;
      $('#stab-progress-pct').textContent = `${Math.round(p.percent || 0)}%`;
      $('#stab-progress-bar').style.width = `${Math.round(p.percent || 0)}%`;
    });

    $('#btn-report-pdf').addEventListener('click', async () => {
      const sinceSel = $('#rep-since').value;
      const since = sinceSel === 'all' ? null : new Date(Date.now() - (sinceSel === 'week' ? 7 : 1) * 86400000).toISOString();
      if (!state.pcCheck) {
        showToast('Analizando el PC para el informe…');
        await loadPcCheck();
      }
      const res = await api.reportPdf({
        client: $('#rep-client').value,
        technician: $('#rep-tech').value,
        business: $('#rep-business').value,
        notes: $('#rep-notes').value,
        since,
      });
      if (res?.canceled) return;
      if (res?.ok) {
        showToast(`Informe guardado en ${res.path}`);
        api.openPath(res.path);
      } else showToast(res?.error || 'No se pudo crear el informe.');
    });

    $('#btn-code-generate').addEventListener('click', generateProfileCode);
    $('#btn-code-import').addEventListener('click', importProfileCode);
    $('#btn-code-copy-link')?.addEventListener('click', async () => {
      if (!state.profileLink) return;
      const res = await api.copyText(state.profileLink);
      showToast(res?.ok ? 'Enlace copiado. Pégalo en Discord, WhatsApp o donde quieras.' : 'No se pudo copiar el enlace.');
    });
    // Perfil recibido por enlace o QR: se deja listo para revisar, nunca se aplica solo
    const receiveProfile = (data) => {
      if (!data?.code) return;
      activateTab('migracion');
      $('#code-input').value = data.code;
      showToast('Recibiste un perfil por enlace. Revísalo y toca «Importar código» para agregarlo.');
    };
    api.onProfileLink(receiveProfile);
    api.profileLinkPending().then(receiveProfile).catch(() => {});

    $('#btn-pilot-start').addEventListener('click', () => {
      if (state.pilot && !['running', 'awaiting-reboot'].includes(state.pilot.status)) {
        state.pilot = null;
        api.autopilotSave(null);
        renderPilot();
        return;
      }
      startPilot();
    });
    $('#btn-pilot-stop').addEventListener('click', () => {
      pilotStopRequested = true;
      $('#pilot-progress-step').textContent = 'Se detendrá al terminar el paso actual…';
    });
    $('#btn-pilot-code').addEventListener('click', async () => {
      const data = await decodeCode($('#pilot-code').value);
      if (!data) return;
      state.pilotCode = data;
      renderPilot();
      showToast(`Código cargado: ${data.appIds.length} apps.`);
    });
    $('#pilot-steps').addEventListener('change', (e) => {
      const id = e.target.dataset.pilotStep;
      if (!id) return;
      state.pilotDraft = { ...(state.pilotDraft || {}), [id]: e.target.checked };
    });
    $('#btn-pilot-reboot').addEventListener('click', async () => {
      const res = await api.autopilotReboot();
      if (!res?.canceled) showToast(res?.ok ? res.message : res?.error || 'No se pudo reiniciar.');
    });
    $('#btn-pilot-continue-now').addEventListener('click', () => continuePilot());

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-error-diag')) {
        btn.closest('.xh-error-bar')?.remove();
        api.exportDiagnostics().then((res) => {
          if (res?.ok) showToast(`Diagnóstico guardado en ${res.path}`);
        });
      } else if (btn.hasAttribute('data-error-close')) {
        btn.closest('.xh-error-bar')?.remove();
      }
    });
  }

  // =========================================================================
  // Arranque inicial
  // =========================================================================
  async function boot() {
    initChrome();
    initNavigation();
    initBackupModal();
    initDriverConfirmModal();
    initSpotlight();
    initEvents();
    initNewFeatures();
    initExtraFeatures();
    initAbout();
    initSettings();
    applyLiteMode();
    initSetup();
    startOnboarding();

    // Arranque escalonado: primero escaneo principal de hardware + datos livianos sin saturar con múltiples PowerShell
    await Promise.all([scanHardware(false, { deferSecondary: true }), loadEmulators(), refreshBackupCount()]);
    renderDashboard();
    renderPostFormatChecklist();
    syncLiveMonitorSchedule();
    initAppUpdates();
    resumePilotIfNeeded();

    // Escaneos secundarios escalonados en segundo plano para mantener la UI fluida incluso en PCs modestas
    const staggerDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    (async () => {
      try {
        await staggerDelay(250);
        await loadCatalog();
        await staggerDelay(350);
        if (!state.startupApps.length) await loadStartupApps(false);
        await staggerDelay(450);
        if (!state.winAudit) await loadWindowsAudit(false);
        await staggerDelay(500);
        liveCheckDrivers(false);
      } catch {
        // Los escaneos secundarios pueden reintentarse al abrir cada pestaña
      }
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
