// spring.js — Motor de resortes interrumpibles (Apple Design: dampingRatio + response)
// Anima siempre desde el valor actual en pantalla y conserva la velocidad al cambiar de objetivo.
(function (global) {
  'use strict';

  const reducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function createSpring({ value = 0, dampingRatio = 1.0, response = 0.34, onUpdate }) {
    let current = value;
    let target = value;
    let velocity = 0;
    let rafId = null;
    let lastTime = 0;

    // Conversión directa de parámetros Apple (dampingRatio, response) a stiffness/damping físicos
    const omega = (2 * Math.PI) / Math.max(0.08, response);
    const stiffness = omega * omega;
    const damping = 2 * dampingRatio * omega;

    function tick(now) {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.032, (now - lastTime) / 1000);
      lastTime = now;

      const displacement = current - target;
      const force = -stiffness * displacement - damping * velocity;
      velocity += force * dt;
      current += velocity * dt;

      if (Math.abs(current - target) < 0.002 && Math.abs(velocity) < 0.002) {
        current = target;
        velocity = 0;
        rafId = null;
        lastTime = 0;
        onUpdate(current);
        return;
      }

      onUpdate(current);
      rafId = requestAnimationFrame(tick);
    }

    return {
      setTarget(nextTarget, initialVelocity) {
        target = nextTarget;
        if (typeof initialVelocity === 'number') velocity = initialVelocity;
        if (reducedMotion()) {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = null;
          current = target;
          velocity = 0;
          onUpdate(current);
          return;
        }
        if (!rafId) {
          lastTime = 0;
          rafId = requestAnimationFrame(tick);
        }
      },
      getValue() {
        return current;
      },
      jump(nextValue) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        current = nextValue;
        target = nextValue;
        velocity = 0;
        onUpdate(current);
      },
    };
  }

  global.XhSpring = { createSpring };
})(window);
