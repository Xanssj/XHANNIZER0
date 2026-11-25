# Cambios

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
