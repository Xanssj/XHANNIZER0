<div align="center">

<img src="build/icon.png" width="96" alt="">

# XHANNIZER0

**Deja Windows listo después de formatear o armar tu PC, sin anuncios ni instaladores ocultos.**

Una app gratuita de [xhanni (Xhanni Studios)](https://xhannistudios.org).

![Versión](https://img.shields.io/badge/Versi%C3%B3n-2.2.3-0071E3?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/Windows-11%20%2F%2010%20x64-1C1C1E?style=for-the-badge)
![Licencia](https://img.shields.io/badge/Licencia-MIT-6E6E73?style=for-the-badge)
[![Pruebas](https://img.shields.io/github/actions/workflow/status/Xanssj/XHANNIZER0/tests.yml?label=Pruebas&style=for-the-badge)](https://github.com/Xanssj/XHANNIZER0/actions/workflows/tests.yml)

[Descargar](https://github.com/Xanssj/XHANNIZER0/releases/latest) · [Soporte en Discord](https://discord.gg/QKmUekvX2X) · [Privacidad](PRIVACY.md) · [Cambios](CHANGELOG.md)

</div>

---

## Qué hace

**🚀 Piloto automático.** Un botón deja tu PC recién formateado listo: respaldo, punto de restauración, drivers, runtimes, tus apps, ajustes de Windows, limpieza y chequeo final. Si hace falta reiniciar, la app se vuelve a abrir sola y sigue donde quedó.

**🩺 Chequeo de PC.** Encuentra los errores que Windows no avisa al armar o formatear: RAM sin XMP/EXPO, monitor conectado a la placa madre en vez de la tarjeta de video, Resizable BAR o Secure Boot apagados, SSD funcionando a menor velocidad y dispositivos sin driver. El **Asistente de BIOS** te muestra la ruta exacta del menú para tu placa (ASUS, MSI, Gigabyte, ASRock) y reinicia directo a la BIOS.

**🧩 Drivers con detección real de hardware.** CPU, GPU dedicada e integrada, placa madre, audio, red y almacenamiento, comparados con los canales oficiales de cada fabricante. Los dispositivos sin driver se resuelven desde Windows Update por su Hardware ID exacto.

**📦 Catálogo oficial.** Más de 100 programas por WinGet o desde su sitio oficial (herramientas, launchers, navegadores, utilidades, runtimes y desarrollo), emuladores open-source desde sus repositorios de GitHub y búsqueda en Microsoft Store.

**🔁 Migrar mi PC.** Antes de formatear, guarda tus programas, ajustes y carpetas en un USB; después, restáuralos en el PC nuevo sin sobrescribir nada. También puedes compartir tu selección como un código `XHZ1-…`.

**🛠️ Mantenimiento.** Reparar Windows (SFC, DISM, Windows Update), actualizar tus apps cada semana, limpiar Windows.old y cachés, crear puntos de restauración y ver el historial de todo lo que hizo la app.

**📊 Rendimiento e informe.** Compara tu PC antes y después de optimizarlo, prueba que la RAM aguante con XMP/EXPO y genera un **informe PDF para tu cliente** si formateas equipos por trabajo.

**🛡️ Seguro por diseño.** Cada cambio exige un respaldo verificado y se puede deshacer. Ves el origen exacto de cada descarga, su SHA-256 y su firma digital, y los instaladores sin firma se bloquean. Sin cuentas, sin publicidad y sin telemetría ([detalles](PRIVACY.md)).

---

## Descargar e instalar

1. Baja la última versión desde **[Releases](https://github.com/Xanssj/XHANNIZER0/releases/latest)**:
   - `XHANNIZER0-x.x.x-x64-nsis.exe`: instalador de Windows (con actualizaciones automáticas).
2. Si Windows muestra **«Windows protegió su PC»**, toca **Más información → Ejecutar de todas formas**. Aparece mientras la app no tenga firma de código.

Necesitas Windows 10 u 11 de 64 bits. Algunas acciones piden permiso de administrador (UAC).

## Soporte

¿Algo no funciona? En la app ve a **Acerca de y soporte → Reportar un problema**: se guarda un diagnóstico `.zip` y se abre el [Discord oficial](https://discord.gg/QKmUekvX2X), donde puedes abrir un ticket. Te responde quien hizo la app.

Para fallos de seguridad, lee [SECURITY.md](SECURITY.md).

## Para desarrolladores

```powershell
git clone https://github.com/Xanssj/XHANNIZER0.git
cd XHANNIZER0
npm install
npm start
```

| Comando | Qué hace |
| --- | --- |
| `npm test` | Pruebas automáticas |
| `npm run dist:all` | Compila el instalador y el portable en `dist/` |
| `npx electron scripts/build-icon.js` | Regenera `build/icon.ico` desde `assets/icon.svg` |
| `npm run validate:catalog` | Revisa que los IDs de WinGet del catálogo sigan existiendo |

**Publicar una versión:** sube la versión en `package.json`, crea la etiqueta y súbela (`git tag v2.1.0` y `git push origin v2.1.0`). GitHub Actions corre las pruebas, compila y publica la versión. Si existen los secretos `CSC_LINK` y `CSC_KEY_PASSWORD`, también la firma.

**Corregir el catálogo sin publicar una versión:** edita [`catalog-overrides.json`](catalog-overrides.json). Las apps instaladas lo descargan al abrirse.

## Aviso legal

XHANNIZER0 se entrega bajo la [licencia MIT](LICENSE), sin garantías: úsala bajo tu responsabilidad y mantén tus respaldos. Los emuladores se descargan desde sus proyectos oficiales; XHANNIZER0 no incluye ni distribuye BIOS, firmware ni juegos. Las marcas mencionadas pertenecen a sus dueños y se nombran solo para identificar el software que instala la app.

---

<div align="center">
  <sub>Hecho por <a href="https://xhannistudios.org/nosotros">xhanni</a> · <a href="https://xhannistudios.org">xhannistudios.org</a> · <a href="https://discord.gg/QKmUekvX2X">Discord</a></sub>
</div>
