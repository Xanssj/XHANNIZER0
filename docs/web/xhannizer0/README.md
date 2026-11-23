# Kit web de XHANNIZER0 para xhannistudios.org

Todo lo necesario para sumar XHANNIZER0 a la web. Las carpetas copian la estructura del sitio, así que los archivos van en la misma ruta.

| Archivo del kit | Dónde va en el sitio | Qué es |
| --- | --- | --- |
| `xhannizer0.html` | raíz (queda en `/xhannizer0`) | La página completa de la app |
| `assets/css/xhannizer0.css` | `assets/css/` | Estilos propios de esa página (capturas y preguntas) |
| `assets/images/xhannizer0/` | `assets/images/xhannizer0/` | Capturas, ícono e imagen para redes |
| `fragmentos/inicio.html` | `index.html` | Enlace del menú, tarjeta en Servicios y columna del pie |
| `fragmentos/tienda.html` | `store.html` | Estantería «Apps gratis» |
| `fragmentos/legal.html` | `privacidad.html` y `terminos.html` | Secciones sobre la app |
| `fragmentos/i18n-en-xhannizer0.js` | `assets/js/i18n-en.js` | Traducciones al inglés |
| `fragmentos/sitemap.xml` | `sitemap.xml` | La nueva URL para Google |

## Antes de empezar

Los botones «Descargar» apuntan a `xhannizer0/descargar` (y el enlace portable a `xhannizer0/descargar/portable`). Esa ruta del sitio debe:

1. Pedir la última versión: `https://api.github.com/repos/Xanssj/XHANNIZER0/releases/latest` (sin token el límite es 60 consultas por hora e IP; guarda la respuesta en caché unos minutos).
2. Elegir el archivo de `assets[]` cuyo `name` **termina en** `-x64-nsis.exe` (instalador) o `-Portable.exe` (portable). Usa «termina en», no «contiene»: también existe `…-x64-nsis.exe.blockmap`, que no es el instalador.
3. Redirigir (302) a su `browser_download_url`. GitHub lo sirve como descarga directa.

La versión 2.1.0 ya está publicada, así que la ruta funciona desde hoy y toma sola cada versión nueva.

## Paso a paso

1. **Copia los archivos nuevos** a la carpeta del sitio:
   - `xhannizer0.html` en la raíz, junto a `index.html` y `store.html`.
   - `assets/css/xhannizer0.css` en `assets/css/`.
   - La carpeta `assets/images/xhannizer0/` completa en `assets/images/`.
2. **Portada:** abre `fragmentos/inicio.html` y pega los tres bloques donde indica cada comentario (menú, tarjeta en Servicios y pie de página).
3. **Tienda:** pega `fragmentos/tienda.html` después de la estantería `#shelf-apps`.
4. **Legal:** pega las secciones de `fragmentos/legal.html` en privacidad y términos, renumera las secciones siguientes y cambia la fecha de «Última actualización».
5. **Inglés:** pega el contenido de `fragmentos/i18n-en-xhannizer0.js` dentro de `text: { … }` en `assets/js/i18n-en.js`. Luego sube la versión del script en todas las páginas (`i18n-en.js?v=30` → `?v=31`) para que los navegadores no usen la copia vieja.
6. **Sitemap:** agrega la línea de `fragmentos/sitemap.xml`.
7. **Menú en las demás páginas:** si `nosotros`, `store`, las páginas legales y otras tienen su propio menú, agrega ahí también `<a href="xhannizer0">XHANNIZER0</a>`.
8. **Publica** el sitio como siempre y revisa la lista de abajo.

## Revisar después de publicar

- [ ] `https://xhannistudios.org/xhannizer0` abre y se ve bien en celular y computador.
- [ ] Los botones «Descargar» llevan a la versión publicada en GitHub.
- [ ] Con el botón de idioma en **EN**, la página queda entera en inglés.
- [ ] El tema claro y el oscuro se ven bien (las capturas son de la app en modo oscuro).
- [ ] El menú, la tarjeta de la portada y la tienda llevan a `/xhannizer0`.
- [ ] La vista previa al compartir el enlace muestra la imagen (pruébalo pegando el enlace en Discord).

## Imágenes

| Archivo | Uso |
| --- | --- |
| `og-xhannizer0.png` (1200×630) | Vista previa al compartir el enlace (Discord, X, WhatsApp) |
| `icono.svg` / `icono.png` | Ícono de la app en la portada de la página |
| `piloto-automatico.png` | Captura principal |
| `chequeo-pc.png`, `drivers.png`, `catalogo.png`, `migrar-pc.png`, `mantenimiento.png`, `rendimiento.png` | Galería «Así se ve» |
| `acerca-soporte.png` | De reserva (no se usa en la página) |

Las capturas son de la app real, a 2880×1800. La carpeta de usuario se reemplazó por `C:\Users\Usuario` y no aparece el nombre del equipo. Si el sitio carga lento, puedes convertirlas a WebP (por ejemplo en squoosh.app) y cambiar `.png` por `.webp` en `xhannizer0.html`.

## Textos para redes

**Anuncio corto (X / Discord):**
> Lanzamos **XHANNIZER0**, nuestra app gratis para Windows 🖥️
> Formateaste o armaste tu PC: un botón instala drivers oficiales, tus programas y deja Windows limpio. Revisa si tu RAM corre a su velocidad real y si te falta activar algo en la BIOS.
> Sin anuncios, sin cuentas y sin telemetría.
> 👉 xhannistudios.org/xhannizer0

**Descripción para el repositorio de GitHub** (Settings → About):
> Deja Windows listo después de formatear: drivers oficiales, más de 100 programas, chequeo de BIOS y migración de PC. Gratis, sin anuncios ni telemetría.

Temas sugeridos: `windows`, `electron`, `drivers`, `winget`, `post-install`, `windows-11`, `pc-setup`.

## Al publicar una versión nueva

Cambia el número de versión en dos lugares de `xhannizer0.html`: el texto «Versión 2.1.0» y `"softwareVersion"` dentro del bloque `ld+json`. Los enlaces de descarga no se tocan, porque siempre apuntan a la última versión.
