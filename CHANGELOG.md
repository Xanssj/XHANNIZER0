# Cambios

## 2.3.1 — 2026-11-27

### Seguridad
- **Aislamiento reforzado en Electron**: navegación restringida exactamente a `src/renderer/index.html`, bloqueo de arrastre `dragover`/`drop`, apertura de apps (`xh:open-app`) limitada a ejecutables verificados por el proceso principal, paquetes WinGet externos restringidos a migraciones abiertas con confirmación nativa, permisos de Chromium denegados por defecto y ventana PDF endurecida.
- **Limpieza elevada UAC sin junctions**: el borrado elevado sobre `C:\Windows\Temp` y `SoftwareDistribution\Download` ignora enlaces simbólicos/junctions (`!ReparsePoint`), protege `StateFlags0742` en `try/finally` y excluye temporales activos de XHANNIZER0.
- **Diálogos fail-closed y BIOS por USB**: las confirmaciones destructivas cancelan siempre si la ventana cerró; el formateo de USB para BIOS usa bloqueo de concurrencia previo, valida el disco físico (`UniqueId` y tamaño) y exige HTTPS estricto con límite de tamaño.
- **Descargas y actualizaciones más seguras**: `downloadFile` impone límite de tamaño, bloquea redirecciones no HTTPS y espera el cierre del stream antes de borrar archivos parciales; `powershell.exe` se invoca con ruta absoluta de System32 y el auto-actualizador solo instala al hacer clic en «Reiniciar y actualizar» (sin instalar silenciosamente al cerrar).

### Estabilidad, catálogo y CI
- **Piloto automático, restauración y Chequeo de PC**: el Piloto automático conserva `settingIds` y el `backupId` original tras reiniciar y espera el chequeo de drivers antes de evaluar actualizaciones; `createRestorePoint` restaura el registro en `finally`; `restore` maneja valores `(default)` y cancelación UAC; `pcCheck` mapea propiedades PCIe por `KeyName` y evita mostrar `RAM a Infinity MHz`; corregido el doble conteo en Resumen, ampliado `isAppBusy()` y protegidos botones async con `try/finally`.
- **Catálogo, emuladores y CI**: las releases en GitHub Actions se crean primero como borrador (`--draft`) y se publican solo tras comprobar `latest.yml` y el instalador `.exe`; el instalador ahora incluye `LICENSE` y `THIRD-PARTY-NOTICES.md` (GNU GPLv3); corregida la promesa colgada sobre respuestas grandes en `emulators.js` / `main.js` y selección de assets x64; validación del catálogo habilitada también en `pull_request`.
- **Textos legales y privacidad**: corregidas las traducciones de licencia en `i18n.js` a **GNU GPLv3** y documentados los favicons del catálogo (`www.google.com/s2/favicons`) en `PRIVACY.md`.

### Interfaz
- **Chequeo de PC más limpio**: eliminados la temperatura de GPU (ya presente en el monitor en vivo de Resumen) y el aviso positivo «Virtualización disponible» (manteniendo el aviso cuando está desactivada en BIOS).
- **Barra superior minimalista**: idioma y tema ahora se cambian únicamente desde **Ajustes** (y primer arranque), retirando los botones duplicados de la barra superior.
- **Drivers al día sin ruido**: oculto el botón «Buscar actualización» cuando el driver ya está actualizado, bloqueado el modal de instalación si no hay actualización disponible y mostrado un único aviso «Todos tus drivers están al día.» al finalizar el chequeo.

## 2.3.0 — 2026-11-26

### Nuevo
- **Pantalla de Resumen y navegación agrupada**: menú lateral organizado en 4 grupos (`Inicio`, `Hardware`, `Programas`, `Sistema`) con sub-pestañas estilo macOS, accesos rápidos, botón de 1 clic para copiar especificaciones del PC y vista dedicada de **Ajustes** (`Ctrl + ,`).
- **Monitor en vivo de hardware** en Resumen: muestra CPU, memoria RAM, espacio del disco del sistema y temperatura de GPU NVIDIA en tiempo real (con pausa manual y pausa automática al cambiar de pestaña o minimizar).
- **Comparador de DNS en vivo**: mide en paralelo la latencia real (3 pings) contra Cloudflare, Google, Quad9, AdGuard y OpenDNS, destaca el más rápido y permite aplicarlo en 1 clic.
- **Chequeo de PC ampliado**: ahora también detecta monitores atascados en 60 Hz, desgaste/salud de batería en portátiles y pantallazos azules (BSOD) o apagados inesperados `Kernel-Power 41` de los últimos 30 días.
- **Desinstalador oficial por WinGet** directo en las tarjetas instaladas del Catálogo (con confirmación nativa).
- **Mis perfiles guardados** dentro de Presets para guardar, cargar o compartir configuraciones propias sin archivos sueltos.
- **Nuevos ajustes reversibles de Windows**: mostrar archivos ocultos, desbloquear plan «Máximo rendimiento» y desactivar hibernación (`hiberfil.sys`) con avisos claros en portátiles.
- **Notificaciones nativas de Windows** al terminar instalaciones largas, Piloto automático, limpieza profunda, reparaciones o pruebas de estabilidad cuando la app está minimizada (activable en Ajustes).
- **Spotlight ampliado (`Ctrl + K`)** como paleta de comandos completa y atajos `Ctrl + 1..9`.

### Fluidez y diseño
- **Sistema de movimiento fluido a 60–240 Hz**: píldora flotante con resortes físicos en la barra lateral, sub-pestañas deslizantes, inclinación 3D física suave e independiente de los Hz, borde de cristal 1 px reactivo al cursor y ondas táctiles al hacer clic.
- **Animaciones nativas de Windows 11 DWM**: la ventana ahora usa `titleBarStyle: 'hidden'` + `thickFrame: true` para mantener las animaciones GPU nativas al abrir, minimizar, restaurar, maximizar y cerrar.
- Contraste corregido en notificaciones toast en modo claro.

### Seguridad y protección del PC
- **Protección de servicios de Windows Update**: los comandos de reinicio y limpieza de caché ahora usan bloques `try/finally` que garantizan reactivar siempre `wuauserv`, `bits`, `cryptsvc` y `msiserver`.
- **Bloqueo de carpetas críticas del sistema**: las acciones de discos/carpetas y migración rechazan rutas del sistema (`C:\Windows`, `Program Files`, raíces de disco) para evitar errores accidentales.
- **Avisos explícitos antes de cambios sensibles**: confirmación nativa y advertencias visibles antes de desactivar hibernación, activar Máximo rendimiento en portátiles, activar HAGS, reiniciar el Explorador o programar el reinicio del Piloto automático.
- Auditoría completa de seguridad, IPC (85/85) y pruebas unitarias ampliadas (29 tests).

## 2.2.5 — 2026-11-25

### Cambiado
- **Controles de ventana en orden de Windows**: los botones circulares ahora siguen el orden Minimizar (izquierda), Maximizar (medio) y Cerrar (derecha).
- Actualizado el empaquetador (`electron-builder` 26) para mejorar la seguridad de las compilaciones.

## 2.2.4 — 2026-11-25

### Seguridad y calidad
- **Endurecimiento de seguridad**: validación más estricta en descargas HTTPS, verificación de firmas digitales antes de abrir instaladores de emuladores, parametrización completa de comandos PowerShell y límites estrictos al abrir archivos o carpetas locales.
- **USB de Windows 11 más fiable**: soporte para redirecciones HTTPS de los servidores oficiales de Microsoft con tiempo de espera controlado (manteniendo la verificación de firma de Microsoft).
- **Instalaciones con WinGet**: límite de tiempo de seguridad para evitar bloqueos si un instalador externo se queda colgado.

### Arreglado
- El menú de clic derecho (Cortar, Copiar, Pegar, Seleccionar todo) ahora también se traduce al inglés.
- Enlace de invitación del Discord oficial actualizado.
- Las versiones publicadas en GitHub incluyen únicamente el instalador oficial de Windows (`-x64-nsis.exe`) con actualizaciones automáticas.

## 2.2.3 — 2026-11-25

### Nuevo
- **Inglés completo**: al elegir EN se traduce toda la app, también lo que aparece después (tarjetas de drivers, chequeo, avisos, resultados), las ventanas de Windows (confirmaciones, guardar y abrir archivos), el informe PDF y las novedades.
- **Detecta el hardware de cualquier PC**: portátiles, PCs de marca (Dell, HP, Lenovo, Acer, ASUS, MSI, Surface y más) y máquinas virtuales. Ahora también muestra Wi-Fi, Bluetooth, cámaras, lector de huella, varias tarjetas de audio y red, y todos los discos internos.
- **PCs de marca y portátiles**: drivers y BIOS apuntan a la web de soporte del fabricante con su app oficial (Dell SupportAssist, HP Support Assistant, Lenovo Vantage…), y el Asistente de BIOS muestra la tecla correcta para entrar.
- GPUs integradas nuevas reconocidas: Intel Arc integrada, Radeon 780M/890M y Qualcomm Adreno.

### Cambiado
- En portátiles el plan de energía recomendado es Equilibrado (cuida batería y temperatura) y el Chequeo de PC no marca como problema lo que el fabricante deja fijo (velocidad de la RAM, un solo módulo, salida de video).

### Arreglado
- La barra lateral ya no se desplaza por debajo de los botones de la ventana: el logo y el pie quedan fijos y solo el menú hace scroll, sin barra gris visible.

## 2.2.2 — 2026-11-25

### Nuevo
- **Asistente de bienvenida** al abrir la app por primera vez: idioma, datos del PC (detectados automáticamente o escritos a mano: Windows, CPU, GPU y RAM) y para qué usas el PC. Al terminar abre el preset recomendado para ese uso.
- **Ventana de actualización**: cuando la versión nueva termina de descargarse, la app se desenfoca y aparece una ventana «Actualización lista». Al aceptar muestra «Actualizando…», instala y se vuelve a abrir sola.
- **Novedades** después de actualizar: la app muestra qué cambió en la versión nueva.
- Botón **Configuración inicial** en «Acerca de» para volver a abrir el asistente.

## 2.2.1 — 2026-11-25

- Versión de prueba de la actualización automática: si tenías la 2.2.0, esta llegó sola con «Reiniciar para actualizar».

## 2.2.0 — 2026-11-25

### Nuevo
- **Actualización automática**: la app instalada descarga sola las versiones nuevas desde GitHub y arriba aparece «Reiniciar para actualizar»; se instala en segundos sin volver a bajar el `.exe`. La versión portable avisa y abre su descarga.
- **Drivers con versiones en vivo**: cada componente se compara con lo que Windows Update tiene para su Hardware ID exacto, en lugar de versiones escritas a mano que quedaban viejas.
- **BIOS de ASUS, Gigabyte y ASRock**: «Web de la placa» abre la búsqueda oficial de tu modelo y la tarjeta explica cómo actualizar con EZ Flash, Q-Flash o Instant Flash.
- **Formatear la USB en FAT32** dentro del flujo de BIOS, con doble confirmación (solo memorias USB de hasta 32 GB).
- **Chequeo de PC**: estado de cada disco (temperatura, desgaste y horas cuando el disco los informa) y temperatura de la GPU NVIDIA en reposo.
- **USB de instalación de Windows 11** con la Media Creation Tool oficial, verificada por su firma de Microsoft.
- **Antes y después entre formateos**: la migración guarda la medición «Antes» en la USB y el PC formateado la carga sola.
- **Perfiles por enlace y QR**: `xhannistudios.org/xhannizer0/perfil#XHZ1-…` y el esquema `xhannizer0://` abren el perfil en la app para revisarlo antes de aplicar nada.
- **BIOS por USB (MSI)**: la tarjeta de la placa madre muestra la BIOS instalada con su nombre de MSI (ej. `1.L0` = `7D43v1L`) y la última publicada por MSI. «Preparar USB de BIOS» descarga el archivo oficial, verifica su SHA-256 contra el publicado por MSI y lo copia a una USB en FAT32 para instalarlo con M-Flash. La app nunca actualiza la BIOS desde Windows.

### Arreglado
- La placa madre, la GPU AMD y el chipset AMD ya no aparecen siempre como «por actualizar»: solo se marca una actualización cuando se puede comparar la versión instalada.
- La placa madre ya no muestra «Rama WHQL Estable» (eso es de drivers de GPU) ni el botón «Versión segura».
- Los drivers al día dicen «Buscar actualización» en vez de «Instalar última».
- Filtro Archivos / Video / Audio en Compresores y listas desplegables legibles en tema oscuro.

## 2.1.0 — 2026-11-22

### Nuevo
- **Piloto automático post-formateo**: respaldo, punto de restauración, drivers, runtimes, tus apps, ajustes de Windows, limpieza y chequeo final con un solo botón. Si hace falta reiniciar, la app se vuelve a abrir sola y sigue donde quedó.
- **Chequeo de PC armado**: RAM sin XMP/EXPO, canales de RAM, monitor conectado a la placa madre, Resizable BAR, enlace PCIe del SSD y la GPU, UEFI, Secure Boot, TPM, virtualización y dispositivos sin driver.
- **Asistente de BIOS** con la ruta exacta del menú para ASUS, MSI, Gigabyte y ASRock, y botón para reiniciar directo a la BIOS.
- **Drivers por Hardware ID** desde Windows Update (WHQL).
- **Migrar mi PC**: programas, ajustes y carpetas a un USB, y restauración sin sobrescribir archivos.
- **Mantenimiento**: SFC, DISM, reinicio de Windows Update, actualización semanal de apps, historial de acciones, diagnóstico `.zip` y punto de restauración.
- **Limpieza post-formateo**: Windows.old, temporales, caché de Windows Update y de sombreadores de la GPU, y WinSxS.
- **Rendimiento e informe**: comparación antes y después, prueba de estabilidad de RAM/CPU con revisión de errores WHEA e informe PDF para el cliente (Modo técnico).
- **Perfiles con código** (`XHZ1-…`) para compartir apps y ajustes.
- **Windows 11**: 8 ajustes opcionales para quitar anuncios y molestias, todos reversibles.
- **Runtimes**: Visual C++ x86 y 2013, DirectX, .NET Desktop 8 y 9, XNA y Java 21.
- **Acerca de y soporte**: versión, enlaces oficiales y reporte de problemas con diagnóstico.
- Modo portable completo, catálogo con correcciones remotas validadas e interfaz fija en inglés.
- Ícono propio en la ventana, el instalador y el desinstalador.
- Aviso en Emuladores: la app no incluye BIOS, firmware ni juegos.
- Manifiestos listos para publicar en WinGet (`packaging/winget`).

### Seguridad y calidad
- Deshacer cambios real desde cada respaldo.
- Aviso cuando algo falla, con registro de errores para el diagnóstico.
- Pruebas automáticas (`npm test`) y compilación y publicación automática en GitHub.
- Ícono propio para el instalador, el portable y la ventana.
- Catálogo: Riot Client usa el paquete de WinGet de Latinoamérica y NVIDIA App se instala desde su sitio oficial (ya no está en WinGet).

## 2.0.0
- Lanzamiento inicial: drivers con detección real de hardware, catálogo oficial, emuladores, Microsoft Store, presets, auditoría de Windows, gestor de inicio, actualizador global, limpiador de bloatware, Red/DNS, Spotlight (Ctrl+K), respaldos y Kit USB.
