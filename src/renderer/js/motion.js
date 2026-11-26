'use strict';

// motion.js — Motor físico de fluidez a 60-240 Hz (GPU-composited).
// 1. Luz especular + borde reactivo al cursor en tarjetas de cristal.
// 2. Inclinación 3D física suave (interpolada con amortiguación rAF) en tarjetas interactivas.
// 3. Efecto magnético sutil + onda táctil (ripple) desde el punto exacto del clic en botones.
// 4. Píldoras deslizantes con spring en sub-pestañas, filtros, segmentados y barra lateral.
// 5. Entrada en cascada al cambiar de sección + revelado fluido al hacer scroll.
(function (global) {
  const prefersReduced = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GLOW_SELECTOR = '.app-card, .driver-card, .owner-metric-card, .preset-card, .checklist-card';
  const TILT_SELECTOR = '.app-card, .preset-card, button.owner-metric-card.dash-metric-btn';
  const MAGNETIC_SELECTOR = '.btn-primary, .btn-secondary, .xh-chrome-icon-btn, .xh-downloads-btn, .xh-svc-pill';
  const RIPPLE_SELECTOR = '.btn-primary, .btn-secondary, .btn-action-small, .xh-chrome-icon-btn, .xh-downloads-btn, .xh-svc-pill';
  const SLIDER_CONTAINERS = '.xh-subnav, .owner-filter-chips, .xh-segmented';

  // ---------- 1 & 2. Borde reactivo 1px + inclinación 3D física independiente de Hz
  let activeGlowCard = null;
  let activeTiltCard = null;
  let tiltCurX = 0;
  let tiltCurY = 0;
  let tiltTargetX = 0;
  let tiltTargetY = 0;
  let tiltRaf = null;
  let tiltLastTs = 0;
  let glowRaf = null;
  let pendingX = 0;
  let pendingY = 0;

  function stepTilt(now) {
    tiltRaf = null;
    if (!activeTiltCard) {
      tiltLastTs = 0;
      return;
    }
    const dt = tiltLastTs ? Math.min(0.05, (now - tiltLastTs) / 1000) : 0.016;
    tiltLastTs = now;
    // Amortiguación exponencial independiente del refresco (idéntica en 60 Hz y 240 Hz)
    const alpha = 1 - Math.exp(-dt * 14);
    tiltCurX += (tiltTargetX - tiltCurX) * alpha;
    tiltCurY += (tiltTargetY - tiltCurY) * alpha;
    activeTiltCard.style.transform = `perspective(900px) translate3d(0, -3px, 0) rotateX(${tiltCurX.toFixed(2)}deg) rotateY(${tiltCurY.toFixed(2)}deg)`;
    if (Math.abs(tiltTargetX - tiltCurX) > 0.02 || Math.abs(tiltTargetY - tiltCurY) > 0.02) {
      tiltRaf = requestAnimationFrame(stepTilt);
    } else {
      tiltLastTs = 0;
    }
  }

  function releaseTilt(card) {
    if (!card) return;
    if (tiltRaf) {
      cancelAnimationFrame(tiltRaf);
      tiltRaf = null;
    }
    tiltLastTs = 0;
    card.classList.remove('is-tilting');
    card.style.transform = '';
    tiltCurX = 0;
    tiltCurY = 0;
    tiltTargetX = 0;
    tiltTargetY = 0;
  }

  // ---------- 3. Efecto magnético suave en botones principales y barra superior
  let activeMagBtn = null;
  let magRaf = null;
  let magX = 0;
  let magY = 0;

  function releaseMagnetic() {
    if (!activeMagBtn) return;
    activeMagBtn.style.transform = '';
    activeMagBtn = null;
  }

  function initPointerEffects() {
    document.addEventListener(
      'pointermove',
      (e) => {
        if (prefersReduced() || e.pointerType !== 'mouse') return;

        // Tarjetas: reflejo especular + 3D tilt
        const card = e.target && e.target.closest ? e.target.closest(GLOW_SELECTOR) : null;
        if (card !== activeGlowCard) {
          if (activeGlowCard) activeGlowCard.classList.remove('is-glow');
          activeGlowCard = card;
          if (activeGlowCard) activeGlowCard.classList.add('is-glow');
        }

        const tiltCard = e.target && e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
        if (tiltCard !== activeTiltCard) {
          releaseTilt(activeTiltCard);
          activeTiltCard = tiltCard;
          if (activeTiltCard) activeTiltCard.classList.add('is-tilting');
        }

        if (activeGlowCard || activeTiltCard) {
          pendingX = e.clientX;
          pendingY = e.clientY;
          if (!glowRaf) {
            glowRaf = requestAnimationFrame(() => {
              glowRaf = null;
              if (activeGlowCard) {
                const rect = activeGlowCard.getBoundingClientRect();
                const rx = pendingX - rect.left;
                const ry = pendingY - rect.top;
                activeGlowCard.style.setProperty('--mx', `${Math.round(rx)}px`);
                activeGlowCard.style.setProperty('--my', `${Math.round(ry)}px`);

                if (activeTiltCard === activeGlowCard && rect.width > 0 && rect.height > 0) {
                  const nx = (rx / rect.width) - 0.5;
                  const ny = (ry / rect.height) - 0.5;
                  tiltTargetY = nx * 5.2;  // máx ±2.6° horizontal
                  tiltTargetX = -ny * 4.4; // máx ±2.2° vertical
                  if (!tiltRaf) tiltRaf = requestAnimationFrame(stepTilt);
                }
              }
            });
          }
        }

        // Botones magnéticos (atracción sutil ±3px)
        const magBtn = e.target && e.target.closest ? e.target.closest(MAGNETIC_SELECTOR) : null;
        if (magBtn !== activeMagBtn) {
          releaseMagnetic();
          if (magBtn && !magBtn.disabled) activeMagBtn = magBtn;
        }
        if (activeMagBtn) {
          magX = e.clientX;
          magY = e.clientY;
          if (!magRaf) {
            magRaf = requestAnimationFrame(() => {
              magRaf = null;
              if (!activeMagBtn || activeMagBtn.disabled) return;
              const r = activeMagBtn.getBoundingClientRect();
              const dx = Math.max(-3.5, Math.min(3.5, ((magX - (r.left + r.width / 2)) / (r.width / 2)) * 3.5));
              const dy = Math.max(-2.5, Math.min(2.5, ((magY - (r.top + r.height / 2)) / (r.height / 2)) * 2.5));
              activeMagBtn.style.transform = `translate3d(${dx.toFixed(1)}px, ${(dy - 1).toFixed(1)}px, 0)`;
            });
          }
        }
      },
      { passive: true }
    );

    document.addEventListener(
      'pointerleave',
      () => {
        if (activeGlowCard) {
          activeGlowCard.classList.remove('is-glow');
          activeGlowCard = null;
        }
        releaseTilt(activeTiltCard);
        activeTiltCard = null;
        releaseMagnetic();
      },
      { passive: true }
    );

    // Onda táctil (ripple) desde el punto exacto donde el usuario hace clic
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (prefersReduced() || e.button !== 0) return;
        const btn = e.target && e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
        if (!btn || btn.disabled) return;
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 0.9;
        const ripple = document.createElement('span');
        ripple.className = 'xh-ripple';
        ripple.style.width = `${Math.round(size)}px`;
        ripple.style.height = `${Math.round(size)}px`;
        ripple.style.left = `${Math.round(e.clientX - rect.left)}px`;
        ripple.style.top = `${Math.round(e.clientY - rect.top)}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
      },
      { passive: true }
    );
  }

  // ---------- 4. Píldoras deslizantes para .xh-subnav, .owner-filter-chips y .xh-segmented
  const sliderInitialized = new WeakSet();

  function syncSlider(container, instant = false) {
    if (!container || container.hidden) return;
    const active = container.querySelector('.is-active');
    let slider = container.querySelector(':scope > .xh-pill-slider');
    if (!slider) {
      slider = document.createElement('span');
      slider.className = 'xh-pill-slider';
      slider.setAttribute('aria-hidden', 'true');
      container.prepend(slider);
      container.classList.add('has-slider');
    }
    if (!active || active.offsetWidth === 0) {
      slider.style.opacity = '0';
      return;
    }
    const firstTime = !sliderInitialized.has(container);
    if (instant || firstTime || prefersReduced()) slider.classList.add('no-anim');

    slider.style.width = `${active.offsetWidth}px`;
    slider.style.height = `${active.offsetHeight}px`;
    slider.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`;
    slider.style.opacity = '1';
    sliderInitialized.add(container);

    if (instant || firstTime) {
      slider.getBoundingClientRect();
      slider.classList.remove('no-anim');
    }
  }

  function syncAllSliders(instant = false) {
    document.querySelectorAll(SLIDER_CONTAINERS).forEach((c) => syncSlider(c, instant));
    syncSidebarActive(instant);
  }

  // ---------- 5. Barra lateral: pill flotante VisionOS + barra de acento con física spring (240 Hz)
  let sideNav = null;
  let sideHoverPill = null;
  let sideActiveBar = null;
  let sideActiveInit = false;
  let activeBarSpringY = null;
  let activeBarX = 0;
  let activeBarY = 0;

  function posInSideNav(btn) {
    const navRect = sideNav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      x: btnRect.left - navRect.left,
      y: btnRect.top - navRect.top + sideNav.scrollTop,
      w: btnRect.width,
      h: btnRect.height,
    };
  }

  function renderActiveBar() {
    if (!sideActiveBar) return;
    sideActiveBar.style.transform = `translate3d(${Math.round(activeBarX)}px, ${activeBarY.toFixed(2)}px, 0)`;
  }

  function syncSidebarActive(instant = false) {
    if (!sideNav || !sideActiveBar) return;
    const activeBtn = sideNav.querySelector('.owner-menu-item.is-active > button');
    if (!activeBtn) {
      sideActiveBar.style.opacity = '0';
      return;
    }
    const pos = posInSideNav(activeBtn);
    const h = Math.max(16, pos.h - 14);
    const y = pos.y + Math.round((pos.h - h) / 2);
    activeBarX = pos.x;
    sideActiveBar.style.height = `${h}px`;
    sideActiveBar.style.opacity = '1';

    const needSnap = instant || !sideActiveInit || prefersReduced();
    if (activeBarSpringY) {
      if (needSnap) activeBarSpringY.jump(y);
      else activeBarSpringY.setTarget(y);
    } else {
      activeBarY = y;
      renderActiveBar();
    }
    sideActiveInit = true;
  }

  function initSidebarMotion() {
    sideNav = document.getElementById('sidebar-nav');
    if (!sideNav) return;

    sideHoverPill = document.createElement('span');
    sideHoverPill.className = 'xh-side-hover-pill';
    sideHoverPill.setAttribute('aria-hidden', 'true');
    sideNav.prepend(sideHoverPill);

    sideActiveBar = document.createElement('span');
    sideActiveBar.className = 'xh-side-active-bar';
    sideActiveBar.setAttribute('aria-hidden', 'true');
    sideNav.prepend(sideActiveBar);

    sideNav.classList.add('has-hover-pill');

    const hasSpring = Boolean(global.XhSpring && typeof global.XhSpring.createSpring === 'function');
    let pillX = 0;
    let pillYVal = 0;
    let pillHVal = 36;
    const renderHoverPill = () => {
      if (!sideHoverPill) return;
      sideHoverPill.style.height = `${Math.round(pillHVal)}px`;
      sideHoverPill.style.transform = `translate3d(${Math.round(pillX)}px, ${pillYVal.toFixed(2)}px, 0)`;
    };

    const pillSpringY = hasSpring
      ? global.XhSpring.createSpring({
          value: 0,
          dampingRatio: 0.92,
          response: 0.19,
          onUpdate: (v) => {
            pillYVal = v;
            renderHoverPill();
          },
        })
      : null;

    const pillSpringH = hasSpring
      ? global.XhSpring.createSpring({
          value: 36,
          dampingRatio: 0.96,
          response: 0.18,
          onUpdate: (v) => {
            pillHVal = v;
            renderHoverPill();
          },
        })
      : null;

    if (hasSpring) {
      activeBarSpringY = global.XhSpring.createSpring({
        value: 0,
        dampingRatio: 0.84,
        response: 0.25,
        onUpdate: (v) => {
          activeBarY = v;
          renderActiveBar();
        },
      });
    }

    // Mantiene el anclaje continuo para que al pasar rápido por encabezados o espacios
    // entre botones el efecto se deslice sin cortarse ni teletransportarse.
    let pillAnchored = false;
    let hideTimer = null;
    let unanchorTimer = null;

    const movePillTo = (pos, show) => {
      pillX = pos.x;
      sideHoverPill.style.width = `${Math.round(pos.w)}px`;
      if (!pillAnchored) {
        pillAnchored = true;
        if (pillSpringY && pillSpringH) {
          pillSpringY.jump(pos.y);
          pillSpringH.jump(pos.h);
        } else {
          pillYVal = pos.y;
          pillHVal = pos.h;
          renderHoverPill();
        }
      } else if (pillSpringY && pillSpringH) {
        pillSpringY.setTarget(pos.y);
        pillSpringH.setTarget(pos.h);
      } else {
        pillYVal = pos.y;
        pillHVal = pos.h;
        renderHoverPill();
      }
      sideHoverPill.style.opacity = show ? '1' : '0';
    };

    sideNav.addEventListener(
      'pointermove',
      (e) => {
        if (prefersReduced() || e.pointerType !== 'mouse') return;
        const btn = e.target && e.target.closest ? e.target.closest('.owner-menu-item > button') : null;
        if (!btn) {
          // Cursor pasando por encabezados (HARDWARE, PROGRAMAS, SISTEMA) o espacios:
          // espera un breve margen antes de ocultar para que barridos rápidos jamás se corten.
          if (pillAnchored && !hideTimer) {
            hideTimer = setTimeout(() => {
              hideTimer = null;
              sideHoverPill.style.opacity = '0';
            }, 150);
          }
          return;
        }
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (unanchorTimer) {
          clearTimeout(unanchorTimer);
          unanchorTimer = null;
        }
        const isActive = Boolean(btn.closest('.owner-menu-item')?.classList.contains('is-active'));
        const pos = posInSideNav(btn);
        // Al cruzar el ítem activo, sigue acompañando su posición en silencio (opacidad 0)
        // para que al salir hacia el siguiente botón continúe deslizando sin salto.
        movePillTo(pos, !isActive);
      },
      { passive: true }
    );

    sideNav.addEventListener(
      'click',
      (e) => {
        if (e.target && e.target.closest && e.target.closest('.owner-menu-item > button')) {
          sideHoverPill.style.opacity = '0';
        }
      },
      { passive: true }
    );

    sideNav.addEventListener(
      'pointerleave',
      () => {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        sideHoverPill.style.opacity = '0';
        clearTimeout(unanchorTimer);
        unanchorTimer = setTimeout(() => {
          unanchorTimer = null;
          pillAnchored = false;
        }, 210);
      },
      { passive: true }
    );

    syncSidebarActive(true);
  }

  // ---------- 6. Cascada al entrar a una vista + revelado fluido al hacer scroll
  const STAGGER_MS = [0, 32, 60, 86, 110, 132, 152, 170, 186, 200, 214, 226];
  let scrollObserver = null;

  function ensureScrollObserver() {
    if (scrollObserver || typeof IntersectionObserver === 'undefined') return;
    const root = document.querySelector('.owner-content');
    scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          ent.target.classList.remove('xh-scroll-hidden');
          ent.target.classList.add('xh-scroll-visible');
          scrollObserver.unobserve(ent.target);
        }
      },
      { root, rootMargin: '0px 0px 40px 0px', threshold: 0.04 }
    );
  }

  function animatePanelEnter(panel) {
    if (!panel || prefersReduced()) return;
    panel.classList.remove('xh-panel-enter');
    void panel.offsetWidth;
    panel.classList.add('xh-panel-enter');
    const clearPanelEnter = () => panel.classList.remove('xh-panel-enter');
    panel.addEventListener('animationend', clearPanelEnter, { once: true });
    setTimeout(clearPanelEnter, 360);

    ensureScrollObserver();
    const cards = panel.querySelectorAll('.owner-metric-card, .app-card, .driver-card, .preset-card, .checklist-card');
    cards.forEach((c, idx) => {
      c.classList.remove('xh-stagger-in', 'xh-scroll-hidden', 'xh-scroll-visible');
      if (idx < STAGGER_MS.length) {
        const delay = STAGGER_MS[idx];
        c.style.setProperty('--stagger-delay', `${delay}ms`);
        void c.offsetWidth;
        c.classList.add('xh-stagger-in');
        const clearStagger = () => c.classList.remove('xh-stagger-in');
        c.addEventListener('animationend', clearStagger, { once: true });
        setTimeout(clearStagger, delay + 380);
      } else if (scrollObserver) {
        c.classList.add('xh-scroll-hidden');
        scrollObserver.observe(c);
      }
    });
  }

  // ---------- 7. Transición suave de tema (Oscuro <-> Claro)
  let themeTimer = null;
  function animateThemeSwitch() {
    if (prefersReduced()) return;
    document.documentElement.classList.add('xh-theme-switching');
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => {
      document.documentElement.classList.remove('xh-theme-switching');
    }, 280);
  }

  // ---------- 8. Sincronización de píldoras tras eventos nativos de ventana (Windows 11 DWM)
  function handleWindowEvent(st) {
    if (!st) return;
    const ev = st.event || '';
    if (ev === 'restore' || ev === 'maximize' || ev === 'unmaximize') {
      requestAnimationFrame(() => syncAllSliders(true));
    }
  }

  function init() {
    initPointerEffects();
    initSidebarMotion();

    document.addEventListener('click', (e) => {
      const container = e.target && e.target.closest ? e.target.closest(SLIDER_CONTAINERS) : null;
      if (container) requestAnimationFrame(() => syncSlider(container, false));
    });

    window.addEventListener('resize', () => syncAllSliders(true), { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const ent of entries) {
          const container = ent.target.closest ? ent.target.closest(SLIDER_CONTAINERS) : null;
          if (container && !container.hidden) syncSlider(container, true);
        }
      });
      document.querySelectorAll('.xh-subnav-btn, .xh-seg-btn').forEach((el) => ro.observe(el));
    }
    requestAnimationFrame(() => syncAllSliders(true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.XhMotion = {
    syncAllSliders,
    syncSlider,
    syncSidebarActive,
    animatePanelEnter,
    animateThemeSwitch,
    handleWindowEvent,
  };
})(window);
