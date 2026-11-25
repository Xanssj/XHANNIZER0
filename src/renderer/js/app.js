'use strict';

(function () {
  const api = window.xhApi;

  // =========================================================================
  // Estado global de la aplicación
  // =========================================================================
  const state = {
    activeTab: 'drivers',
    previousTab: 'drivers',
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
    wingetAvailable: false,
    disksData: null,
    recentBackup: null, // Respaldo verificado vigente (< 24h) en disco o sesión
    winAudit: null,
    startupApps: [],
    upgrades: [],
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
    pendingDriverConfirm: null,
    auditLog: new Map(), // id -> { id, name, state, progress, detail, sourceType, sourceOrigin, sha256, signatureStatus, signatureSigner, timestamp }
    auditDrawerOpen: false,
    selected: new Map(), // id -> { id, type: 'driver'|'app'|'msstore', name, ... }
    omittedDrivers: new Set(),
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
    const applyTheme = (theme) => {
      state.theme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = state.theme;
      localStorage.setItem('xh_theme', state.theme);
      api.setTheme(state.theme);
      const icon = $('#xh-theme-icon');
      if (icon) {
        icon.innerHTML = state.theme === 'dark'
          ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
          : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      }
    };
    applyTheme(state.theme);
    $('#xh-theme-btn').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

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
      $('#xh-lang-label').textContent = state.lang.toUpperCase();
      $$('[data-i18n]').forEach((el) => {
        const key = el.dataset.i18n;
        if (dict[key]) el.textContent = dict[key];
      });
      $$('#sidebar-nav [data-tab]').forEach((btn) => {
        const span = btn.querySelector('span');
        const t = btn.dataset.tab;
        if (span && dict.tabs[t]) span.textContent = dict.tabs[t];
      });
      if (window.XhI18n) window.XhI18n.apply(state.lang);
    };
    applyLanguage(state.lang);
    $('#xh-lang-btn').addEventListener('click', () => {
      applyLanguage(state.lang === 'es' ? 'en' : 'es');
      showToast(state.lang === 'en' ? 'Language switched to English.' : 'Idioma cambiado a Español.');
    });

    api.onWindowState((st) => {
      document.documentElement.classList.toggle('xh-blurred', !st.focused);
      document.documentElement.classList.toggle('xh-maximized', Boolean(st.maximized));
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
  // Navegación lateral (con puerta obligatoria de respaldo en Carpetas y Discos)
  // =========================================================================
  function activateTab(target) {
    if (state.activeTab !== target) {
      state.previousTab = state.activeTab;
      state.activeTab = target;
    }
    $$('#sidebar-nav .owner-menu-item').forEach((li) => {
      const btn = li.querySelector('[data-tab]');
      li.classList.toggle('is-active', btn && btn.dataset.tab === target);
    });
    $$('.owner-tab-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === `tab-${target}`);
    });
    contentEl.scrollTop = 0;
    $('#xh-titlebar').classList.remove('is-scrolled');

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
    if (target === 'rendimiento') loadBenchmark();
    if (target === 'acerca') loadAbout();
  }

  // =========================================================================
  // Acerca de y soporte
  // =========================================================================
  const ABOUT_LINKS = {
    discord: 'https://discord.gg/Gcxfn7rvJN',
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

  function initNavigation() {
    $$('#sidebar-nav [data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
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
              activateTab(fallbackTab === 'discos' ? 'drivers' : fallbackTab);
            },
          });
          return;
        }
        activateTab(target);
      });
    });
  }

  // =========================================================================
  // Render de Drivers (Sección Principal — con iGPU/dGPU exacto)
  // =========================================================================
  async function scanHardware(notify = false) {
    $('#hw-scan-meta').textContent = 'Analizando CPU, iGPU/dGPU, placa madre, audio y red…';
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
      $('#hw-scan-meta').textContent = `${data.drivers.length} componentes detectados · ${sys.detectedVia}`;
      $('#pop-hw-state').textContent = `${data.drivers.length} detectados`;

      const drvBadge = $('#badge-drivers');
      if (data.advisoriesCount > 0) {
        drvBadge.textContent = String(data.advisoriesCount);
        drvBadge.hidden = false;
      } else {
        drvBadge.hidden = true;
      }

      renderDrivers();
      loadPresets();
      loadWindowsAudit();
      renderPostFormatChecklist();
      updateStatusPill();
      if (notify) showToast('Escaneo de hardware actualizado.');
      liveCheckDrivers();
    } catch (err) {
      $('#hw-scan-meta').textContent = 'Error al escanear hardware.';
      showToast(`Error al detectar hardware: ${err.message}`);
    }
  }

  // Pregunta a Windows Update por versiones más nuevas (tarda: corre después de mostrar el escaneo)
  async function liveCheckDrivers() {
    const scanned = state.hardware;
    try {
      const res = await api.driversLiveCheck();
      if (!res?.drivers || state.hardware !== scanned) return;
      state.hardware.drivers = res.drivers;
      state.hardware.updatesCount = res.updatesCount;
      $('#m-updates').textContent = String(res.updatesCount);
      renderDrivers();
      renderPostFormatChecklist();
      updateStatusPill();
    } catch {
      // Sin Windows Update: las tarjetas quedan con su enlace oficial
    }
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
                     ${drv.officialUrl ? `<button type="button" class="btn-action-small is-safe" data-open-url="${esc(drv.officialUrl)}">Web de la placa</button>` : ''}
                     <button type="button" class="btn-action-small ${drv.bios?.canPrepareUsb ? 'is-ghost' : 'is-primary'}" data-install-driver="${esc(drv.id)}" data-branch="latest" title="Busca en Windows Update los drivers de chipset de la placa">Drivers de chipset</button>`
                  : `${drv.advisory?.recommendation === 'safe'
                      ? `<button type="button" class="btn-action-small is-safe" data-install-driver="${esc(drv.id)}" data-branch="safe">Versión segura</button>`
                      : ''}
                     <button type="button" class="btn-action-small is-primary" data-install-driver="${esc(drv.id)}" data-branch="latest">${drv.needsUpdate ? 'Instalar última' : 'Buscar actualización'}</button>`}
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
    if (badgeEl) badgeEl.textContent = String(sectionAll.length);

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
    if (badge) badge.textContent = String(state.emulators.length);
    renderEmulators();
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
  }

  function renderPresets() {
    const grid = $('#preset-grid');
    if (!grid) return;

    grid.innerHTML = state.presets
      .map((preset) => {
        const appNames = preset.appIds
          .map((id) => state.catalog.find((c) => c.id === id)?.name || id);
        const badgeClass =
          preset.tone === 'purple'
            ? 'is-purple'
            : preset.tone === 'green'
            ? 'is-ok'
            : preset.tone === 'orange'
            ? 'is-warn'
            : 'is-recommended';

        return `
          <article class="preset-card ${preset.id === 'preset-dev' ? 'is-highlighted' : ''}">
            <div class="preset-head">
              <div>
                <h2>${esc(preset.name)}</h2>
                <p>${esc(preset.summary)}</p>
              </div>
              <span class="pill-badge ${badgeClass}">${esc(preset.badge)}</span>
            </div>

            <div class="preset-hw-box">
              <strong>Adaptado a tu hardware · ${esc(preset.hardwareProfile)}</strong>
              <span>${esc(preset.hardwareNote)}</span>
            </div>

            <div>
              <div class="preset-list-label">Apps incluidas (${appNames.length})</div>
              <div class="app-card-tags">
                ${appNames.map((n) => `<span class="tag-chip">${esc(n)}</span>`).join('')}
              </div>
            </div>

            <div>
              <div class="preset-list-label">Optimizaciones seguras de Windows</div>
              <ul class="preset-opt-list">
                ${preset.optimizations.map((opt) => `<li>${esc(opt)}</li>`).join('')}
              </ul>
            </div>

            <div class="preset-foot">
              <button type="button" class="btn-action-small" data-preset-select="${esc(preset.id)}">Cargar al lote</button>
              <button type="button" class="btn-action-small is-primary" data-preset-apply="${esc(preset.id)}">Aplicar preset</button>
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
  async function loadUpgrades(notify = false) {
    $('#upgrades-meta').textContent = 'Buscando actualizaciones en todo tu PC vía WinGet…';
    const res = await api.scanUpgrades();
    state.upgrades = res?.items || [];
    const badge = $('#badge-upgrades');
    if (badge) {
      badge.textContent = String(state.upgrades.length);
      badge.hidden = state.upgrades.length === 0;
    }
    $('#upgrades-meta').textContent = state.upgrades.length
      ? `${state.upgrades.length} aplicaci${state.upgrades.length === 1 ? 'ón' : 'ones'} con actualización disponible.`
      : res?.note || 'Todas tus aplicaciones están actualizadas.';
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
      .map(
        (u) => `
      <article class="driver-card">
        <div class="driver-top">
          <div class="driver-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/></svg>
          </div>
          <div class="driver-main" style="grid-column: span 2;">
            <div class="driver-title-row">
              <span class="driver-category">${esc(u.source)}</span>
              <span class="pill-badge is-recommended">Actualización</span>
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
            <button type="button" class="btn-action-small is-primary" data-run-upgrade="${esc(u.wingetId)}">Actualizar</button>
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  // =========================================================================
  // Limpieza de Bloatware y Red/DNS
  // =========================================================================
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
      showToast('Iniciando actualización global vía WinGet…');
      const res = await api.runUpgrade({ wingetId: '__ALL__' });
      showToast(res?.message || 'Proceso finalizado.');
      await loadUpgrades(false);
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

      // Actualizar una app desde el Actualizador Global
      if (btn.dataset.runUpgrade) {
        const wingetId = btn.dataset.runUpgrade;
        btn.disabled = true;
        btn.textContent = 'Actualizando…';
        const res = await api.runUpgrade({ wingetId });
        showToast(res?.message || 'Actualización finalizada.');
        await loadUpgrades(false);
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

      // Presets: cargar apps al lote para revisión
      if (btn.dataset.presetSelect) {
        const preset = state.presets.find((p) => p.id === btn.dataset.presetSelect);
        if (!preset) return;
        preset.appIds.forEach((appId) => toggleAppSelection(appId, true));
        showToast(`Preset «${preset.name}» cargado al lote (${preset.appIds.length} apps).`);
        return;
      }

      // Presets: aplicar optimizaciones + instalar apps (con puerta inteligente de respaldo)
      if (btn.dataset.presetApply) {
        const preset = state.presets.find((p) => p.id === btn.dataset.presetApply);
        if (!preset) return;
        const tasks = preset.appIds
          .map((id) => state.catalog.find((c) => c.id === id))
          .filter(Boolean)
          .map((item) => ({ id: item.id, type: 'app', name: item.name, officialUrl: item.officialUrl }));

        ensureVerifiedBackup({
          scope: 'preset',
          label: `Preset Experimental: ${preset.name}`,
          detail: `Se respaldará la configuración del sistema antes de aplicar las optimizaciones seguras e instalar ${tasks.length} aplicaciones.`,
          items: [preset.name, ...tasks.map((t) => t.name)],
          onConfirmed: async (backupRes) => {
            const optRes = await api.applyPresetOpt({ presetId: preset.id, backupId: backupRes.id });
            if (optRes?.ok) showToast(optRes.message);
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
    const quickTabs = [
      ['Drivers', 'drivers'],
      ['Herramientas', 'herramientas'],
      ['Launchers', 'launchers'],
      ['Navegadores', 'navegadores'],
      ['Compresores y Utilidades', 'utilidades'],
      ['Programadores', 'dev'],
      ['Emuladores (GitHub)', 'emuladores'],
      ['Microsoft Store', 'store'],
      ['Presets (Experimental)', 'presets'],
      ['Auditoría de Windows', 'windows-audit'],
      ['Gestor de Inicio Windows', 'startup'],
      ['Actualizador Global', 'upgrades'],
      ['Limpieza y Red / DNS', 'cleaner-net'],
      ['Carpetas y Discos', 'discos'],
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
        $$('.spotlight-item', spotlightResults).forEach((el, i) => el.classList.toggle('is-active', i === spotlightActiveIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        spotlightActiveIndex = Math.max(0, spotlightActiveIndex - 1);
        $$('.spotlight-item', spotlightResults).forEach((el, i) => el.classList.toggle('is-active', i === spotlightActiveIndex));
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

  function initAppUpdates() {
    api.onUpdateState((st) => {
      const wasReady = updateInfo.state === 'ready';
      renderUpdateButton(st);
      if (st?.state === 'ready' && !wasReady) showToast(`XHANNIZER0 v${st.version} está lista. Toca «Reiniciar para actualizar» arriba.`);
    });
    api.updateState().then(renderUpdateButton).catch(() => {});
    $('#xh-update-btn')?.addEventListener('click', async () => {
      if (updateInfo.state === 'portable') {
        api.openExternal(updateInfo.url);
        return;
      }
      if (updateInfo.state !== 'ready') return;
      const res = await api.updateInstall();
      if (!res?.ok) showToast(res?.error || 'No se pudo instalar la actualización.');
    });
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
        const res = await api.restartExplorer();
        showToast(res?.message || 'Explorador reiniciado.');
        btn.disabled = false;
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
    showToast(`Limpieza terminada: ${formatBytes(res.freedBytes)} liberados.${res.notes?.length ? ` ${res.notes.join(' ')}` : ''}`);
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
        state.pilot = {
          status: 'running',
          startedAt: new Date().toISOString(),
          backupId: backupRes.id,
          steps: PILOT_STEPS.map((s) => ({ id: s.id, enabled: enabled[s.id], status: s.id === 'backup' ? 'done' : 'pending', note: s.id === 'backup' ? `Respaldo ${backupRes.id}` : '' })),
          appIds: pilotAppIds(),
          cleanupIds: PILOT_CLEANUP,
        };
        state.pilotSettingIds = state.pilotCode?.settingIds || [];
        await api.autopilotSave(state.pilot);
        await runPilotSteps();
      },
    });
  }

  async function continuePilot() {
    await refreshBackupCount();
    if (state.recentBackup?.id) {
      state.pilot.backupId = state.recentBackup.id;
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
      const res = await runCleanupSelection(ids);
      btn.disabled = false;
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
      const res = await api.createRestorePoint();
      btn.disabled = false;
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
      showToast(res?.ok ? res.message : res?.error || 'No se pudo reiniciar.');
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
    await Promise.all([scanHardware(false), loadCatalog(), loadEmulators(), refreshBackupCount(), loadStartupApps(false)]);
    renderPostFormatChecklist();
    initAppUpdates();
    resumePilotIfNeeded();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
