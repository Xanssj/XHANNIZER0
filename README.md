<div align="center">

<br>

<img src="build/icon.png" width="92" height="92" alt="XHANNIZER0">

# XHANNIZER0

**Deja Windows listo después de formatear o armar tu PC.**
Sin anuncios, sin telemetría, sin instaladores ocultos — 100 % reversible.

<p>
  <a href="https://github.com/Xanssj/XHANNIZER0/releases/latest">
    <img src="https://img.shields.io/badge/Descargar-v2.3.0-0071E3?style=for-the-badge&logo=windows11&logoColor=white" alt="Descargar v2.3.0">
  </a>
  <img src="https://img.shields.io/badge/Windows-11%20%2F%2010%20x64-1C1C1E?style=for-the-badge" alt="Windows 11 / 10 x64">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/Licencia-GNU%20GPLv3-2C2C2E?style=for-the-badge" alt="GNU GPLv3">
  </a>
  <a href="https://github.com/Xanssj/XHANNIZER0/actions/workflows/tests.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/Xanssj/XHANNIZER0/tests.yml?label=Pruebas&style=for-the-badge" alt="Estado de pruebas">
  </a>
</p>

<p>
  <a href="https://github.com/Xanssj/XHANNIZER0/releases/latest"><strong>Descargar</strong></a>
  &nbsp;·&nbsp;
  <a href="CHANGELOG.md">Novedades</a>
  &nbsp;·&nbsp;
  <a href="SECURITY.md">Seguridad</a>
  &nbsp;·&nbsp;
  <a href="PRIVACY.md">Privacidad</a>
  &nbsp;·&nbsp;
  <a href="TRADEMARK.md">Marca</a>
  &nbsp;·&nbsp;
  <a href="https://discord.gg/QKmUekvX2X">Discord</a>
</p>

<sub>Una app gratuita y de código abierto de <a href="https://xhannistudios.org"><strong>xhanni (Xhanni Studios)</strong></a>.</sub>

</div>

<br>

| **Sin telemetría** | **100 % reversible** | **Fuentes verificadas** | **Diseño nativo 240 Hz** |
| :---: | :---: | :---: | :---: |
| Sin cuentas, sin anuncios ni envío de datos | Respaldo previo obligatorio y botón *Deshacer* | SHA-256, firma Authenticode y canales oficiales | Windows 11 Acrylic, modo oscuro/claro y ES/EN |

---

## Qué incluye

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Resumen y Monitor en vivo</h3>
      Panel inicial con el estado real de tu equipo, checklist post-formateo, copia de especificaciones en 1 clic y <strong>monitor en vivo</strong> (CPU, RAM, disco del sistema y temperatura de GPU NVIDIA) con pausa automática en segundo plano.
    </td>
    <td width="50%" valign="top">
      <h3>Piloto automático</h3>
      Un flujo guiado deja tu PC recién formateado listo de principio a fin: respaldo, punto de restauración, drivers, runtimes, tus apps, ajustes de Windows, limpieza y chequeo final. Si necesita reiniciar, retoma solo al volver y avisa con <strong>notificaciones nativas</strong>.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Chequeo de PC y Asistente de BIOS</h3>
      Detecta lo que Windows no avisa: RAM sin XMP/EXPO, monitor conectado a la placa madre o atascado en 60 Hz, salud de batería en portátiles, <strong>pantallazos azules (BSOD) y apagados <code>Kernel-Power 41</code></strong> (30 días), Resizable BAR, Secure Boot y SSD limitado. Incluye guía exacta por marca (ASUS, MSI, Gigabyte, ASRock) y reinicio directo a la BIOS.
    </td>
    <td width="50%" valign="top">
      <h3>Drivers reales y BIOS por USB</h3>
      Detecta CPU, GPU dedicada/integrada, placa madre, audio, red y discos en PCs armados, portátiles y equipos de marca. Compara drivers con <strong>Windows Update por Hardware ID exacto</strong> y prepara memorias USB en FAT32 con BIOS verificada por SHA-256 (sin flashear desde Windows).
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Catálogo oficial y Mis perfiles</h3>
      Más de <strong>100 programas</strong> por WinGet o sitios oficiales (con <strong>desinstalador integrado</strong>), emuladores open-source desde GitHub y búsqueda en Microsoft Store. Guarda tus selecciones en <strong>Mis perfiles</strong> o compártelas mediante código <code>XHZ1-…</code>, enlace, QR o JSON.
    </td>
    <td width="50%" valign="top">
      <h3>Windows y Red (Comparador DNS)</h3>
      Ajustes post-formateo 100 % reversibles (Modo Juego, HAGS, mouse 1:1, extensiones, archivos ocultos, limpieza de Windows 11, energía e hibernación con avisos en portátiles), gestor de inicio, bloatware seguro y <strong>comparador de DNS en vivo</strong> (Cloudflare, Google, Quad9, AdGuard y OpenDNS) con aplicación en 1 clic.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Migrar mi PC y Mantenimiento</h3>
      Antes de formatear, respalda tus programas, ajustes y carpetas a un USB y restáuralos en el equipo nuevo sin sobrescribir archivos. Incluye reparación de Windows (<code>SFC</code>, <code>DISM</code>, Windows Update), limpieza de <code>Windows.old</code> y cachés de sombreadores, y actualizaciones semanales automáticas.
    </td>
    <td width="50%" valign="top">
      <h3>Rendimiento e Informe PDF</h3>
      Compara tu PC <strong>antes y después</strong> de optimizarlo, valida la estabilidad de la RAM tras activar XMP/EXPO (detectando errores WHEA) y genera un <strong>informe técnico en PDF</strong> listo para entregar a clientes.
    </td>
  </tr>
</table>

---

## Seguridad por diseño

XHANNIZER0 modifica configuraciones del sistema, por eso cada acción crítica pasa por capas de verificación en el proceso principal:

| Capa de protección | Qué garantiza |
| --- | --- |
| **Respaldo obligatorio y diario de deshacer** | Ningún cambio de registro, DNS, inicio o carpeta se aplica sin respaldo verificado en disco; todo queda registrado para revertirse en orden inverso. |
| **Avisos explícitos en cambios sensibles** | Confirmación nativa antes de tocar hibernación (`hiberfil.sys`), plan *Máximo rendimiento* en portátiles, HAGS, reinicio del Explorador, reinicios del sistema o borrado permanente. |
| **Protección de servicios y rutas críticas** | Los scripts de Windows Update garantizan reactivar `wuauserv`/`bits`/`cryptsvc`/`msiserver` mediante `try/finally`, y las acciones de disco bloquean `C:\Windows`, `Program Files` y raíces de unidad. |
| **Descargas y firmas verificadas** | Panel de auditoría en tiempo real con origen exacto, huella **SHA-256** y verificación de firma digital **Authenticode** (los instaladores sin firma no se ejecutan automáticamente). |
| **Aislamiento de Electron** | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, CSP estricta y parametrización completa de PowerShell (sin interpolación de texto). |

> [!NOTE]
> XHANNIZER0 no tiene cuentas, publicidad ni telemetría. Consulta todos los detalles de archivos locales y conexiones de red en [PRIVACY.md](PRIVACY.md) y nuestra política de reportes en [SECURITY.md](SECURITY.md).

---

## Descargar e instalar

**Requisitos:** Windows 10 u 11 de 64 bits. Algunas acciones solicitan elevación de administrador (UAC) solo cuando es necesario.

1. Descarga el instalador oficial desde **[GitHub Releases](https://github.com/Xanssj/XHANNIZER0/releases/latest)**:
   `XHANNIZER0-2.3.0-x64-nsis.exe` *(incluye actualizaciones automáticas)*.
2. Ejecuta el instalador y sigue el asistente de bienvenida inicial.

> [!TIP]
> Si Windows muestra **«Windows protegió su PC»** (SmartScreen), haz clic en **Más información → Ejecutar de todas formas**. Este aviso aparece mientras el binario no cuente con certificado comercial de firma de código; puedes verificar el código fuente completo en este repositorio o compilarlo tú mismo.

---

## Atajos de teclado

| Atajo | Acción |
| :---: | --- |
| `Ctrl + K` | Abrir paleta de comandos **Spotlight** (buscar secciones, programas o acciones) |
| `Ctrl + 1` … `Ctrl + 9` | Saltar directamente entre las secciones principales |
| `Ctrl + ,` | Abrir **Ajustes** |
| `Esc` | Cerrar modal, búsqueda o panel activo |

---

## Soporte

¿Encontraste un fallo o tienes una sugerencia?

- Desde la app ve a **Acerca de y soporte → Reportar un problema**: se genera un paquete de diagnóstico `.zip` (sin contraseñas ni archivos personales) y se abre el **[Discord oficial de xhanni](https://discord.gg/QKmUekvX2X)** para crear un ticket.
- Para vulnerabilidades de seguridad, sigue el proceso privado descrito en [SECURITY.md](SECURITY.md).

---

## Para desarrolladores

```powershell
git clone https://github.com/Xanssj/XHANNIZER0.git
cd XHANNIZER0
npm install
npm start
```

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia la aplicación en modo desarrollo con Electron |
| `npm test` | Ejecuta la suite completa de pruebas unitarias y de seguridad (29 tests) |
| `npm run dist:nsis` | Compila el instalador oficial de Windows (`x64`) en `dist/` |
| `npm run validate:catalog` | Verifica la disponibilidad de los IDs de WinGet del catálogo |
| `npx electron scripts/build-icon.js` | Regenera `build/icon.ico` y `build/icon.png` desde `assets/icon.svg` |

<details>
<summary><strong>Publicación de versiones y mantenimiento del catálogo</strong></summary>

<br>

- **Publicar una versión:** actualiza `version` en `package.json` y los changelogs (`CHANGELOG.md` y `CHANGELOG.en.md`), crea y sube la etiqueta (`git tag -a v2.3.0 -m "XHANNIZER0 v2.3.0"` y `git push origin v2.3.0`). GitHub Actions ejecuta las pruebas, compila el instalador NSIS y publica el release automáticamente. Si están configurados `CSC_LINK` y `CSC_KEY_PASSWORD`, también firma el ejecutable.
- **Correcciones rápidas del catálogo:** edita [`catalog-overrides.json`](catalog-overrides.json). Las instancias instaladas sincronizan correcciones válidas (mismo dominio HTTPS / ID de WinGet válido) al abrirse sin necesidad de nueva versión.

</details>

---

## Licencia, marca y avisos legales

| Documento | Alcance |
| --- | --- |
| **[GNU GPLv3](LICENSE)** | El código fuente se distribuye bajo `GPL-3.0-or-later`, sin garantías. Cualquier derivado redistribuido debe mantener el código abierto bajo GPLv3 y conservar la atribución original *(versiones hasta v2.3.0 fueron publicadas bajo MIT)*. |
| **[Política de marca](TRADEMARK.md)** | Los nombres **XHANNIZER0**, **Xhanni Studios**, el logotipo oficial, `studio.xhanni.xhannizer0` y `xhannistudios.org` están reservados. Los forks deben usar nombre, ícono e identificador propios. |
| **[Terceros](THIRD-PARTY-NOTICES.md)** | Licencias de dependencias empaquetadas (`Electron`, `electron-updater`, `qrcode`). XHANNIZER0 no incluye ni distribuye BIOS, firmware ni juegos; las marcas mencionadas pertenecen a sus propietarios. |

---

<div align="center">
  <br>
  <sub>Hecho con cuidado por <a href="https://xhannistudios.org/nosotros"><strong>xhanni</strong></a> · <a href="https://xhannistudios.org">xhannistudios.org</a> · <a href="https://discord.gg/QKmUekvX2X">Discord</a></sub>
</div>
