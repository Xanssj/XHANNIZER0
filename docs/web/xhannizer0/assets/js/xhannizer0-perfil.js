// Página /xhannizer0/perfil#XHZ1-…
// El código del perfil viaja después del «#»: el navegador nunca lo envía al servidor.
// Esta página solo lo valida y ofrece abrirlo en la app (xhannizer0://perfil/…) o copiarlo.
(function () {
  'use strict';

  var code = decodeURIComponent((location.hash || '').slice(1)).replace(/\s+/g, '');
  var valid = /^XHZ1-[A-Za-z0-9_-]{4,12000}$/.test(code);
  var open = document.getElementById('xz-profile-open');
  var copy = document.getElementById('xz-profile-copy');
  var title = document.getElementById('xz-profile-title');
  var lead = document.getElementById('xz-profile-lead');

  if (!valid) {
    title.textContent = 'Este enlace de perfil está incompleto';
    lead.textContent = 'Pídele a quien te lo mandó que lo copie de nuevo desde XHANNIZER0 (Migrar mi PC → Compartir perfil).';
    open.textContent = 'Conocer XHANNIZER0';
    copy.hidden = true;
    return;
  }

  open.href = 'xhannizer0://perfil/' + code;

  copy.addEventListener('click', function () {
    var done = function () {
      copy.textContent = 'Código copiado';
      setTimeout(function () { copy.textContent = 'Copiar código'; }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { window.prompt('Copia el código:', code); });
    } else {
      window.prompt('Copia el código:', code);
    }
  });
})();
