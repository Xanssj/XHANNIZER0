# Estrategia de difusión orgánica — XHANNIZER0 ({{VERSION}})

> **Estado:** Borrador listo para producción post-hotfix. **No publicar nada en redes sin aprobación del usuario (Board).**
> **Versión objetivo:** `{{VERSION}}` (reemplazar al publicar el hotfix final).

## 1. Posicionamiento base (cero humo)

- **Mensaje central:** *«Deja Windows listo después de formatear o armar tu PC. 100 % gratis, GNU GPLv3, sin telemetría, sin cuentas, sin anuncios y 100 % reversible.»*
- **Lo que NUNCA prometemos:** nada de «+100 FPS mágicos» ni «Windows ultra liviano extremo». El valor real de **XHANNIZER0** es **claridad, estabilidad, fuentes oficiales (WinGet / Windows Update WHQL / SHA-256 + Authenticode) y respaldo obligatorio con botón Deshacer**.
- **Identidad oficial (`TRADEMARK.md`):** nombrar siempre **XHANNIZER0** de **xhanni (Xhanni Studios)** y enlazar únicamente a:
  - Descarga oficial: `https://github.com/Xanssj/XHANNIZER0/releases/latest`
  - Sitio oficial: `https://xhannistudios.org`
  - Soporte y comunidad: `https://discord.gg/QKmUekvX2X`

## 2. Canales y cadencia realista (4 semanas · creador independiente)

| Canal | Frecuencia | Formato y enfoque |
| :--- | :--- | :--- |
| **TikTok / YouTube Shorts / Reels** | 2 videos / semana (35–45 s) | Micro-demos de 1 problema concreto en pantalla real (1080p/60fps, modo oscuro Acrylic, 0 rellenos):<br>1. Post-formateo sin perder horas ([Guión A](guion-a-vertical-40s.md)).<br>2. Errores ocultos al armar PC (`Chequeo de PC`: XMP/EXPO, 60 Hz, placa madre, BSOD / `Kernel-Power 41`, `Asistente de BIOS`).<br>3. Comparador DNS en vivo (3 pings paralelos + 1 clic).<br>4. Seguridad real: `Respaldo obligatorio activo` + `Deshacer cambios` + panel `Descargas` (SHA-256 y Authenticode).<br>5. Modo técnico: `Antes y después` + `Generar informe PDF` + perfiles `XHZ1-…` con QR.<br>6. SmartScreen explicado en 30 s transparentes. |
| **YouTube** | 1 video ancla al lanzamiento (90 s) + 1 tutorial quincenal (4–6 min) | Demo oficial de 90 s ([Guión B](guion-b-demo-90s.md)), embebible en `README.md` y `xhannistudios.org`. Seguimiento: «Formateé Windows 11 desde cero y usé XHANNIZER0 paso a paso» (sin cortes engañosos). |
| **GitHub** | En cada release | Notas curadas de `CHANGELOG.md`, GIF/video corto, enlaces a `PRIVACY.md` y `SECURITY.md`, nota clara de SmartScreen, GitHub Discussions (Ideas / Soporte / Perfiles `XHZ1-…`) y topics (`windows`, `post-install`, `winget`, `open-source`, `gplv3`, `pc-building`). |
| **Reddit** | 1 post de valor por comunidad (sin spam el mismo día) | `r/opensource`, `r/Windows11`, `r/pcmasterrace` (EN) y `r/chilegames`, `r/Argaming`, `r/pcgamingES` (ES). Tono honesto de dev independiente: problema real, respaldo en `%USERPROFILE%\XhanniBackups\XHANNIZER0`, cero telemetría (`PRIVACY.md`), mención proactiva de SmartScreen y petición de feedback técnico. |
| **Discord (`discord.gg/QKmUekvX2X`)** | Continuo | `#anuncios-xhannizer0` (releases y catálogo), `#perfiles-xhz1` (códigos compartidos Gaming/Dev/Estudio) y soporte vía `Acerca de → Reportar un problema` (paquete `.zip` sin contraseñas ni archivos personales). |

## 3. Protocolo obligatorio de transparencia para Windows SmartScreen

Aplicar en **todo** video, descripción, comentario fijado y publicación escrita:

1. **Anticiparlo siempre, nunca esconderlo:** avisar desde el primer momento que al ejecutar `XHANNIZER0-{{VERSION}}-x64-nsis.exe`, Windows puede mostrar *«Windows protegió su PC»*.
2. **Explicar el motivo real:** es un proyecto 100 % gratuito, open-source y sin fines comerciales; el instalador aún no cuenta con certificado EV pago de firma de código.
3. **Dar las 3 vías de verificación:**
   - **Más información → Ejecutar de todas formas** (solo descargado desde `github.com/Xanssj/XHANNIZER0/releases` o `xhannistudios.org`).
   - Revisar el código fuente completo (**GNU GPLv3**) y el estado público de las pruebas en GitHub Actions.
   - Compilar el instalador localmente (`git clone` → `npm install` → `npm run dist:nsis`).

## 4. Checklist previo a grabar

- [ ] Confirmar que el hotfix `{{VERSION}}` ya está compilado y probado.
- [ ] Confirmar en cámara que `Acerca de` muestra **GNU GPLv3** (sin restos de «Licencia MIT»).
- [ ] Grabar en resolución limpia 1080p/60fps, modo oscuro Acrylic, sin datos personales ni claves visibles en escritorio.
