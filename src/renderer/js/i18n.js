'use strict';

// Traducción al inglés de toda la interfaz. Los textos originales se guardan por nodo y se cambian
// en el lugar, así que volver a español restaura exactamente el original.
(function () {
  const EN = {
    'Descargas': 'Downloads',
    'Sistema listo': 'System ready',
    'Estado de XHANNIZER0': 'XHANNIZER0 status',
    'Verificando…': 'Checking…',
    'Escaneo de hardware': 'Hardware scan',
    'Listo': 'Ready',
    'Apps instaladas': 'Installed apps',
    'Escaneando…': 'Scanning…',
    'Copias de seguridad': 'Backups',
    '0 guardadas': '0 saved',
    'Cola de instalación': 'Install queue',
    'Inactiva': 'Idle',
    'Ver respaldos': 'View backups',
    'Reescanear PC': 'Rescan PC',
    'Buscar rápido…': 'Quick search…',
    'Post-formateo': 'Post-format',
    'Piloto automático': 'Autopilot',
    'Chequeo de PC': 'PC Check',
    'Herramientas': 'Tools',
    'Navegadores': 'Browsers',
    'Compresores': 'Archivers & Utils',
    'Programadores': 'Developers',
    'Emuladores': 'Emulators',
    'Auditoría Windows': 'Windows Audit',
    'Inicio Windows': 'Windows Startup',
    'Actualizaciones': 'Updates',
    'Limpieza y Red': 'Cleaner & Net',
    'Carpetas y Discos': 'Folders & Disks',
    'Migrar mi PC': 'Migrate my PC',
    'Mantenimiento': 'Maintenance',
    'Rendimiento e informe': 'Performance & report',
    'Acerca de y soporte': 'About & support',
    'XHANNIZER0 no incluye ni descarga BIOS, firmware ni juegos. Algunos emuladores los necesitan: úsalos solo con copias de consolas y juegos que te pertenezcan.':
      'XHANNIZER0 does not include or download BIOS files, firmware or games. Some emulators need them: only use copies of consoles and games you own.',
    'Buscar actualización': 'Check for updates',
    'Una app gratuita de': 'A free app by',
    ', un estudio pequeño de software en Chile. Hacemos herramientas simples, rápidas y bonitas, y detrás de cada una hay alguien que responde.':
      ', a small software studio from Chile. We make simple, fast and good-looking tools, and behind each one there is a person who answers.',
    '¿Algo no funciona?': 'Something not working?',
    'Guarda un diagnóstico (.zip) y abre el Discord oficial para crear un ticket. Te responde quien hizo la app. El archivo incluye el nombre del equipo: revísalo antes de compartirlo.':
      'Save a diagnostic (.zip) and open the official Discord to create a ticket. The person who made the app answers. The file includes the computer name: review it before sharing.',
    'Reportar un problema': 'Report a problem',
    'Comunidad y novedades': 'Community & news',
    'Soporte, ideas y anuncios de nuevas versiones en el Discord de xhanni.': 'Support, ideas and release announcements on the xhanni Discord.',
    'Abrir Discord': 'Open Discord',
    'Privacidad': 'Privacy',
    'Sin cuentas, sin publicidad y sin telemetría. Todo lo que guarda la app queda en tu PC.': 'No accounts, no ads and no telemetry. Everything the app stores stays on your PC.',
    'Leer la política': 'Read the policy',
    'Abrir datos de la app': 'Open app data',
    'Código abierto': 'Open source',
    'Licencia GNU GPLv3. Revisa el código, propone ideas o mira qué cambió en cada versión.': 'GNU GPLv3 license. Read the code, suggest ideas or see what changed in each version.',
    'Novedades': "What's new",
    '¿Necesitas algo a medida?': 'Need something custom?',
    'xhanni también hace Allmighty, el bot que administra tu Discord, además de bots, sitios web y proyectos de ciberseguridad a medida.': 'xhanni also makes Allmighty, the bot that runs your Discord server, plus custom bots, websites and cybersecurity projects.',
    'Conocer al equipo': 'Meet the team',
    'XHANNIZER0 se entrega sin garantías (licencia GNU GPLv3): úsala bajo tu responsabilidad y mantén tus respaldos. Las marcas mencionadas pertenecen a sus dueños.':
      'XHANNIZER0 comes with no warranty (GNU GPLv3 license): use it at your own risk and keep your backups. Trademarks belong to their owners.',
    'Exportar': 'Export',
    'Importar': 'Import',
    'Respaldo obligatorio activo': 'Mandatory backup on',
    'Detectando PC…': 'Detecting PC…',
    'Deja tu PC recién formateado listo con un solo botón: respaldo, drivers, runtimes, tus apps, ajustes de Windows, limpieza y chequeo final. Si hace falta reiniciar, XHANNIZER0 se vuelve a abrir solo y sigue donde quedó.':
      'Get a freshly formatted PC ready with one button: backup, drivers, runtimes, your apps, Windows settings, cleanup and a final check. If a restart is needed, XHANNIZER0 reopens by itself and picks up where it left off.',
    'Detener': 'Stop',
    'Iniciar piloto automático': 'Start autopilot',
    'Windows te pedirá permiso de administrador (UAC) en algunos pasos: el punto de restauración, los ajustes del sistema y la limpieza. Todo lo que cambie el sistema queda en un respaldo que puedes deshacer.':
      'Windows will ask for administrator permission (UAC) in some steps: the restore point, system settings and cleanup. Every system change is saved in a backup you can undo.',
    'Apps que se instalarán': 'Apps to install',
    'Usa tu selección actual del catálogo o pega un código de perfil (XHZ1-…).': 'Uses your current catalog selection, or paste a profile code (XHZ1-…).',
    'Cargar código': 'Load code',
    'Preparando…': 'Preparing…',
    'Hace falta reiniciar para terminar de instalar los drivers': 'A restart is needed to finish installing the drivers',
    'Al reiniciar, XHANNIZER0 se abrirá solo y seguirá con el resto de los pasos.': 'After restarting, XHANNIZER0 opens by itself and continues with the remaining steps.',
    'Seguir sin reiniciar': 'Continue without restarting',
    'Reiniciar y continuar': 'Restart and continue',
    'Detección directa de hardware y comparación con canales oficiales del fabricante, sin bloatware ni instaladores ocultos.':
      'Direct hardware detection compared against official vendor channels, with no bloatware or hidden installers.',
    'Reescanear hardware': 'Rescan hardware',
    'Seleccionar recomendados': 'Select recommended',
    'Checklist Post-Formateo': 'Post-format checklist',
    '0% listo': '0% done',
    'Procesador': 'Processor',
    'Consultando WMI / CIM': 'Querying WMI / CIM',
    'Memoria y Sistema': 'Memory & system',
    'Actualizaciones oficiales': 'Official updates',
    'Comparado con fabricantes': 'Compared with vendors',
    'Avisos de estabilidad': 'Stability notices',
    'GPU, Placa Madre y Audio': 'GPU, motherboard and audio',
    'Todos': 'All',
    'Con aviso': 'With notice',
    'Con actualización': 'With update',
    'Buscando componentes…': 'Looking for components…',
    'Utilidades técnicas esenciales para validar temperaturas, frecuencias, GPU y mantener Windows limpio.': 'Essential tech utilities to check temperatures, clocks and GPU, and keep Windows clean.',
    'Seleccionar todas': 'Select all',
    'Todas': 'All',
    'Archivos': 'Archives',
    'Video': 'Video',
    'Audio': 'Audio',
    'Tipo de programa': 'App type',
    'Instaladas': 'Installed',
    'Por instalar': 'Not installed',
    'Launchers y Gaming': 'Launchers & gaming',
    'Tus plataformas de juegos listas para instalar en lote o abrir directamente si ya están presentes.': 'Your game platforms, ready to batch install or open directly if already present.',
    'Seleccionar faltantes': 'Select missing',
    'Instalados': 'Installed',
    'Instalación directa o múltiple desde fuentes oficiales. Brave destaca por velocidad y privacidad sin extras.': 'Single or batch install from official sources. Brave stands out for speed and privacy with no extras.',
    'Compresores y Utilidades': 'Archivers & utilities',
    'Imprescindibles tras una instalación limpia de Windows: archivadores, runtimes oficiales y herramientas ligeras.': 'Must-haves after a clean Windows install: archivers, official runtimes and lightweight tools.',
    'Espacio dedicado para desarrollo: editores, IA para programar (en la nube y local en GPU), codeo en vivo, APIs, organización y runtimes.':
      'A space for development: editors, AI coding (cloud and local on GPU), live coding, APIs, organization and runtimes.',
    'IA para programar': 'AI coding',
    'IDEs y Editores': 'IDEs & editors',
    'Codeo en vivo / APIs': 'Live coding / APIs',
    'Organización': 'Organization',
    'Emuladores open-source descargados directamente desde sus repositorios oficiales de GitHub, siempre en su versión más reciente para Windows.':
      'Open-source emulators downloaded straight from their official GitHub repositories, always the latest Windows build.',
    'Verificar versiones en GitHub': 'Check versions on GitHub',
    'Multi-sistema': 'Multi-system',
    'Busca e instala Spotify, WhatsApp, Netflix o cualquier aplicación oficial disponible en Microsoft Store sin abrir mil ventanas.':
      'Find and install Spotify, WhatsApp, Netflix or any official Microsoft Store app without opening a thousand windows.',
    'Ver destacados': 'Show featured',
    'Buscar en Store': 'Search Store',
    'Mostrando aplicaciones populares de Microsoft Store.': 'Showing popular Microsoft Store apps.',
    'Presets Post-Formateo': 'Post-format presets',
    'Perfiles inteligentes que analizan tu CPU, GPU, VRAM y RAM reales para instalar y optimizar tu equipo sin cometer errores de compatibilidad.':
      'Smart profiles that read your real CPU, GPU, VRAM and RAM to install and tune your PC without compatibility mistakes.',
    'Hardware analizado:': 'Analyzed hardware:',
    'Detectando componentes del PC…': 'Detecting PC components…',
    'Auditoría de Windows': 'Windows audit',
    'Analiza tu sistema actual y detecta configuraciones recomendadas de rendimiento, precisión, privacidad y pantalla que aún no tienes activadas.':
      'Scans your system and finds recommended performance, precision, privacy and display settings you have not turned on yet.',
    'Reanalizar Windows': 'Rescan Windows',
    'Aplicar recomendadas': 'Apply recommended',
    'Recomendaciones pendientes': 'Pending recommendations',
    'Ajustes sugeridos sin activar': 'Suggested settings not applied',
    'Configuraciones óptimas': 'Optimal settings',
    'Ya activas en tu Windows': 'Already on in your Windows',
    'Apps al inicio (Usuario)': 'Startup apps (user)',
    'Entradas en HKCU\\\\Run': 'Entries in HKCU\\\\Run',
    'Gestor de Inicio de Windows': 'Windows Startup Manager',
    'Controla qué programas arrancan con tu PC. Desactivar apps innecesarias acelera el inicio tras formatear (100% reversible).':
      'Control which programs start with Windows. Disabling unnecessary apps speeds up boot time (100% reversible).',
    'Actualizar lista': 'Refresh list',
    'Actualizador Global': 'Global updater',
    'Detecta cualquier aplicación desactualizada en tu PC vía WinGet oficial y actualízala sin abrir instaladores manuales.': 'Finds any outdated app on your PC through official WinGet and updates it without manual installers.',
    'Buscar actualizaciones': 'Check for updates',
    'Actualizar todo': 'Update all',
    'Presiona «Buscar actualizaciones» para analizar todas las apps de tu PC.': 'Press “Check for updates” to scan every app on your PC.',
    'Optimiza tus DNS con 1 clic y elimina bloatware preinstalado de Windows de forma segura y reversible.': 'Optimize your DNS in one click and safely, reversibly remove preinstalled Windows bloatware.',
    'Actualizar diagnóstico': 'Refresh diagnostics',
    'Adaptador activo': 'Active adapter',
    'Analizando…': 'Analyzing…',
    'DNS actual': 'Current DNS',
    'Consultando red': 'Querying network',
    'Latencia DNS rápida': 'Fast DNS latency',
    'Latencia alternativa': 'Alternative latency',
    'Usar Cloudflare (1.1.1.1)': 'Use Cloudflare (1.1.1.1)',
    'Usar Google (8.8.8.8)': 'Use Google (8.8.8.8)',
    'Restaurar Automático': 'Restore automatic',
    'Vaciar caché DNS': 'Flush DNS cache',
    'Limpiador de Bloatware de Windows': 'Windows bloatware cleaner',
    'Solo apps preinstaladas reversibles desde Microsoft Store. Nunca toca componentes críticos del sistema.': 'Only preinstalled apps that can be reinstalled from Microsoft Store. Never touches critical system components.',
    'Eliminar bloatware detectado': 'Remove detected bloatware',
    'Configuración y ordenamiento limpio de unidades y carpetas tras formatear el equipo.': 'Clean setup and organization of drives and folders after formatting.',
    'Actualizar discos': 'Refresh disks',
    'Abrir carpeta de respaldos': 'Open backups folder',
    'Protección obligatoria activa:': 'Mandatory protection on:',
    'cualquier acción que edite carpetas, reordene discos o instale drivers solicitará confirmar y crear una': 'any action that edits folders, reorganizes disks or installs drivers asks you to confirm and create a',
    'copia de seguridad previa': 'backup first',
    'antes de avanzar.': 'before continuing.',
    'Historial de Copias de Seguridad': 'Backup history',
    'Respaldos verificados almacenados en': 'Verified backups stored in',
    'Crear Kit USB Post-Formateo': 'Create post-format USB kit',
    'Detecta los errores típicos al armar o formatear un PC que Windows no avisa: RAM sin XMP/EXPO, monitor en la placa madre, Resizable BAR, Secure Boot, SSD limitado y dispositivos sin driver.':
      'Finds the usual PC build and format mistakes Windows never mentions: RAM without XMP/EXPO, monitor on the motherboard, Resizable BAR, Secure Boot, a throttled SSD and devices without drivers.',
    'Analizar mi PC': 'Check my PC',
    'Problemas para revisar': 'Issues to review',
    'Ajustes de BIOS o montaje': 'BIOS or build settings',
    'Todo correcto': 'All good',
    'Comprobaciones superadas': 'Checks passed',
    'Dispositivos con problemas': 'Devices with problems',
    'Sin driver o con error': 'No driver or with errors',
    'Presiona «Analizar mi PC». Solo lee información, no cambia nada.': 'Press “Check my PC”. It only reads information and changes nothing.',
    'Dispositivos sin driver o con errores': 'Devices without drivers or with errors',
    'Busca en Windows Update el driver oficial (WHQL) que coincide exactamente con el Hardware ID del dispositivo.': 'Searches Windows Update for the official (WHQL) driver that exactly matches the device Hardware ID.',
    'Asistente de BIOS': 'BIOS assistant',
    // Asistente de bienvenida, actualización y novedades
    'Bienvenido a XHANNIZER0': 'Welcome to XHANNIZER0',
    'Deja Windows listo después de formatear: drivers oficiales, tus programas, ajustes y limpieza en un solo lugar.': 'Get Windows ready after a clean install: official drivers, your apps, settings and cleanup in one place.',
    'Todo sale de fuentes oficiales y verificadas.': 'Everything comes from official, verified sources.',
    'Antes de cambiar algo se crea un respaldo que puedes deshacer.': 'Before changing anything, a backup you can undo is created.',
    'Sin cuentas, sin publicidad y sin telemetría.': 'No accounts, no ads and no telemetry.',
    'Idioma': 'Language',
    'Empezar': 'Get started',
    'Tu PC': 'Your PC',
    'XHANNIZER0 puede detectarlo solo, o puedes escribirlo tú si ya lo sabes.': 'XHANNIZER0 can detect it, or you can type it in if you already know it.',
    'Detectar automáticamente': 'Detect automatically',
    'Lee el procesador, la tarjeta de video, la RAM y Windows de tu PC.': 'Reads your processor, graphics card, RAM and Windows version.',
    'Recomendado': 'Recommended',
    'Escribirlo yo': 'Type it myself',
    'Para cuando conoces tus piezas o la detección no las reconoce bien.': 'For when you know your parts or detection gets them wrong.',
    'Procesador (CPU)': 'Processor (CPU)',
    'Tarjeta de video (GPU)': 'Graphics card (GPU)',
    'Memoria RAM': 'RAM',
    'No sé': "I don't know",
    'Los drivers siempre se buscan con la detección real del hardware, para no instalar uno equivocado.': 'Drivers are always matched to the real detected hardware, so a wrong one is never installed.',
    'Atrás': 'Back',
    'Continuar': 'Continue',
    '¿Para qué usas el PC?': 'What do you use your PC for?',
    'Te recomendamos los programas que más se usan para eso. Puedes cambiarlo cuando quieras.': "We'll recommend the apps most used for that. You can change it anytime.",
    'Juegos': 'Gaming',
    'Launchers, Discord y lo necesario para jugar.': 'Launchers, Discord and what you need to play.',
    'Trabajo u oficina': 'Work or office',
    'Ofimática, PDF y productividad.': 'Office suite, PDF and productivity.',
    'Estudios': 'School',
    'Clases, documentos y videollamadas.': 'Classes, documents and video calls.',
    'Programación': 'Programming',
    'Editores, Git y entornos de desarrollo.': 'Editors, Git and dev environments.',
    'Uso general': 'General use',
    'Navegar, música y videos.': 'Browsing, music and videos.',
    'Terminar': 'Finish',
    'Actualización lista': 'Update ready',
    'Más tarde': 'Later',
    'Reiniciar y actualizar': 'Restart and update',
    'Entendido': 'Got it',
    'Configuración inicial': 'Initial setup',
    'La ruta exacta del menú para tu placa madre, solo de lo que el chequeo marcó para revisar.': 'The exact menu path for your motherboard, only for what the check flagged.',
    'Ver todas las guías': 'Show all guides',
    'Reiniciar a la BIOS': 'Restart to BIOS',
    'Antes de formatear, guarda tus programas, ajustes y carpetas en un USB. Después, restáuralos en el PC nuevo con un clic. Nunca se sobrescriben archivos que ya existan.':
      'Before formatting, save your programs, settings and folders to a USB drive. Then restore them on the new PC in one click. Existing files are never overwritten.',
    '1. Exportar (en el PC viejo)': '1. Export (on the old PC)',
    'Se guarda la lista de programas instalados (WinGet), los ajustes de Windows que ya tienes aplicados y las carpetas que marques.': 'Saves the list of installed programs (WinGet), the Windows settings you already applied and the folders you tick.',
    'Agregar otra carpeta': 'Add another folder',
    'Exportar a USB o carpeta': 'Export to USB or folder',
    '2. Restaurar (en el PC nuevo)': '2. Restore (on the new PC)',
    'Abre el archivo': 'Open the',
    'de tu USB y elige qué restaurar.': 'file on your USB drive and choose what to restore.',
    'Abrir migración': 'Open migration',
    'Restaurar selección': 'Restore selection',
    '3. Compartir perfil con código': '3. Share a profile as a code',
    'Convierte tu selección de apps y los ajustes que ya aplicaste en un código de texto (XHZ1-…). Quien lo pegue aquí recibe las mismas apps y ajustes, sin archivos ni cuentas.':
      'Turns your app selection and applied settings into a text code (XHZ1-…). Whoever pastes it here gets the same apps and settings, with no files or accounts.',
    'Generar y copiar código': 'Generate and copy code',
    'Importar código': 'Import code',
    'Repara Windows, programa actualizaciones automáticas de tus apps y revisa todo lo que XHANNIZER0 hizo en tu PC.': 'Repair Windows, schedule automatic app updates and review everything XHANNIZER0 did on your PC.',
    'Crear punto de restauración': 'Create restore point',
    'Exportar diagnóstico (.zip)': 'Export diagnostics (.zip)',
    'Limpieza post-formateo': 'Post-format cleanup',
    'Windows.old, temporales, caché de Windows Update y de la GPU. Lo que borres aquí no va a la papelera.': 'Windows.old, temp files, Windows Update and GPU caches. What you delete here does not go to the Recycle Bin.',
    'Analizar espacio': 'Scan space',
    'Limpiar selección': 'Clean selection',
    'Actualización automática de apps': 'Automatic app updates',
    'Una vez por semana Windows ejecuta': 'Once a week Windows runs',
    'en segundo plano. No necesita permisos de administrador y puedes desactivarlo cuando quieras.': 'in the background. It needs no administrator rights and you can turn it off anytime.',
    'Consultando…': 'Checking…',
    'Día': 'Day',
    'Domingo': 'Sunday',
    'Lunes': 'Monday',
    'Martes': 'Tuesday',
    'Miércoles': 'Wednesday',
    'Jueves': 'Thursday',
    'Viernes': 'Friday',
    'Sábado': 'Saturday',
    'Hora': 'Time',
    'Activar': 'Turn on',
    'Desactivar': 'Turn off',
    'Historial de acciones': 'Action history',
    'Todo lo que XHANNIZER0 cambió o instaló en este PC, del más reciente al más antiguo.': 'Everything XHANNIZER0 changed or installed on this PC, newest first.',
    'Actualizar': 'Refresh',
    'Mide tu PC antes y después de optimizarlo, prueba que la RAM aguante con XMP/EXPO y genera un informe en PDF para entregar al cliente.':
      'Measure your PC before and after tuning it, test that the RAM holds up with XMP/EXPO, and create a PDF report for the customer.',
    'Antes y después': 'Before and after',
    'Mide «Antes» recién formateado o antes de optimizar; después usa XHANNIZER0 y mide «Después». Para comparar bien, mide cada vez unos minutos después de encender el PC.':
      'Measure “Before” right after formatting or before tuning; then use XHANNIZER0 and measure “After”. For a fair comparison, measure a few minutes after turning the PC on each time.',
    'Medir «Antes»': 'Measure “Before”',
    'Medir «Después»': 'Measure “After”',
    'Todavía no hay mediciones.': 'No measurements yet.',
    'Guardar como imagen': 'Save as image',
    'Prueba de estabilidad': 'Stability test',
    'Llena parte de la RAM con patrones y los verifica desde todos los núcleos; al final revisa si Windows registró errores de hardware (WHEA). Úsala después de activar XMP/EXPO. Es una prueba rápida: no reemplaza a MemTest86.':
      'Fills part of the RAM with patterns and verifies them from every core, then checks whether Windows logged hardware errors (WHEA). Use it after turning on XMP/EXPO. It is a quick test, not a MemTest86 replacement.',
    'Duración': 'Duration',
    'Iniciar prueba': 'Start test',
    'Modo técnico: informe para el cliente': 'Technician mode: customer report',
    'Un PDF con el equipo, el chequeo, el antes y después, el trabajo realizado y los programas instalados, listo para firmar. Usa XHANNIZER0 Portable desde tu USB y genera el informe al terminar.':
      'A PDF with the PC, the check, before and after, the work done and installed programs, ready to sign. Run XHANNIZER0 Portable from your USB drive and create the report when you finish.',
    'Cliente': 'Customer',
    'Técnico': 'Technician',
    'Negocio': 'Business',
    'Trabajo incluido': 'Work included',
    'Últimas 24 horas': 'Last 24 hours',
    'Últimos 7 días': 'Last 7 days',
    'Todo el historial': 'Full history',
    'Observaciones': 'Notes',
    'Generar informe PDF': 'Create PDF report',
    'Seleccionados': 'Selected',
    '0 elementos': '0 items',
    'Limpiar': 'Clear',
    'Instalar selección': 'Install selection',
    'Copia de seguridad requerida': 'Backup required',
    'Antes de instalar drivers o modificar/reordenar carpetas y discos, XHANNIZER0 exige generar una copia de seguridad por seguridad.': 'Before installing drivers or changing folders and disks, XHANNIZER0 requires a backup for safety.',
    'Acción solicitada': 'Requested action',
    'Crear copia de seguridad antes de avanzar (Obligatorio)': 'Create a backup before continuing (required)',
    'Se guardará un respaldo verificado de drivers / estructura de carpetas en tu carpeta segura': 'A verified backup of drivers / folder structure will be saved in your safe folder',
    'antes de ejecutar el cambio.': 'before making the change.',
    'También crear un punto de restauración de Windows': 'Also create a Windows restore point',
    '(pide permiso de administrador)': '(asks for administrator permission)',
    'Preparando respaldo…': 'Preparing backup…',
    'Cancelar': 'Cancel',
    'Hacer copia de seguridad y continuar': 'Back up and continue',
    'Auditoría de Descargas': 'Download audit',
    'Procedencia verificada y progreso en vivo': 'Verified source and live progress',
    'Cerrar': 'Close',
    'Sin descargas recientes': 'No recent downloads',
    'Cuando instales apps, drivers o emuladores verás aquí su canal oficial, URL/ID exacto y progreso en tiempo real.': 'When you install apps, drivers or emulators you will see their official channel, exact URL/ID and live progress here.',
    'Limpiar historial': 'Clear history',
    '¿Estás seguro de realizar esta instalación?': 'Are you sure you want to install this?',
    'Elige si deseas instalar el controlador directamente desde XHANNIZER0 o mediante la aplicación oficial del fabricante.': 'Choose whether to install the driver directly from XHANNIZER0 or through the vendor’s official app.',
    'Componente seleccionado': 'Selected component',
    '1. Instalar a través de XHANNIZER0': '1. Install through XHANNIZER0',
    'Descarga e instalación automática dentro de la app sin abrir el navegador.': 'Automatic download and install inside the app, without opening the browser.',
    'Automático': 'Automatic',
    '2. Actualizar con la app oficial del fabricante': '2. Update with the vendor’s official app',
    'Abre la aplicación oficial detectada en tu equipo.': 'Opens the official app found on your PC.',
    'Detectada': 'Detected',
    // Atributos (placeholder, title, aria-label)
    'Controles de ventana': 'Window controls',
    'Minimizar': 'Minimize',
    'Ampliar': 'Zoom',
    'Cambiar idioma (ES / EN)': 'Switch language (ES / EN)',
    'Cambiar modo oscuro / claro': 'Toggle dark / light mode',
    'Cambiar tema': 'Change theme',
    'Auditoría de descargas y procedencia': 'Download and source audit',
    'Estado del sistema y respaldos': 'System and backup status',
    'Navegación principal': 'Main navigation',
    'Buscar en toda la app (Ctrl + K)': 'Search the whole app (Ctrl + K)',
    'Guardar perfil en JSON': 'Save profile as JSON',
    'Cargar perfil desde JSON': 'Load profile from JSON',
    'Código de perfil (opcional)': 'Profile code (optional)',
    'Filtrar herramientas…': 'Filter tools…',
    'Filtrar herramientas': 'Filter tools',
    'Filtrar launchers…': 'Filter launchers…',
    'Filtrar launchers': 'Filter launchers',
    'Filtrar utilidades…': 'Filter utilities…',
    'Filtrar utilidades': 'Filter utilities',
    'Filtrar apps dev…': 'Filter dev apps…',
    'Filtrar apps para programadores': 'Filter developer apps',
    'Filtrar emuladores…': 'Filter emulators…',
    'Filtrar emuladores': 'Filter emulators',
    'Buscar en Microsoft Store (ej. Spotify, WhatsApp, Netflix, Telegram, iCloud…)': 'Search Microsoft Store (e.g. Spotify, WhatsApp, Netflix, Telegram, iCloud…)',
    'Buscar en Microsoft Store': 'Search Microsoft Store',
    'Aquí aparece tu código.': 'Your code appears here.',
    'Pega un código XHZ1-…': 'Paste an XHZ1-… code',
    'Opcional': 'Optional',
    'Ej.: se cambió la pasta térmica, se recomienda ampliar a 32 GB de RAM…': 'E.g. thermal paste replaced, upgrading to 32 GB of RAM is recommended…',
    'Instalación por lote': 'Batch install',
    'Búsqueda global Spotlight': 'Spotlight global search',
    'Buscar apps, emuladores, drivers o ajustes de Windows…': 'Search apps, emulators, drivers or Windows settings…',
  };


  // ---------- Motor dinámico
  // Traduce todo lo que aparece en pantalla, también lo que la app pinta después (tarjetas,
  // avisos, resultados). Guarda el texto original en español de cada nodo, así que volver a
  // español lo restaura tal cual.
  const dict = window.XhI18nDict || null;
  const normKey = (s) => String(s).replace(/\s+/g, ' ').trim();
  const lookup = (s) => {
    const k = normKey(s);
    if (!k) return null;
    if (EN[k] !== undefined) return EN[k];
    return dict ? dict.translate(k) : null;
  };

  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT']);
  const origText = new WeakMap();
  const lastText = new WeakMap();
  const origAttr = new WeakMap();
  let lang = 'es';
  const origTitle = document.title;

  const skipped = (el) => !el || SKIP.has(el.tagName) || Boolean(el.closest('[data-no-i18n]'));

  function processText(node) {
    if (skipped(node.parentElement)) return;
    const cur = node.nodeValue;
    const ours = lastText.has(node) && lastText.get(node) === cur;
    if (!ours) origText.set(node, cur); // texto nuevo de la app (siempre en español)
    const es = origText.get(node);
    if (es == null) return;
    let next = es;
    if (lang === 'en') {
      const tr = lookup(es);
      if (tr != null) next = es.match(/^\s*/)[0] + tr + es.match(/\s*$/)[0];
    }
    lastText.set(node, next);
    if (next !== cur) node.nodeValue = next;
  }

  function processAttr(el, attr) {
    if (!el || el.closest('[data-no-i18n]')) return;
    const cur = el.getAttribute(attr);
    let rec = origAttr.get(el);
    if (!rec) { rec = {}; origAttr.set(el, rec); }
    const r = rec[attr];
    if (cur == null) { delete rec[attr]; return; }
    if (!r || r.last !== cur) rec[attr] = { es: cur, last: cur };
    const es = rec[attr].es;
    let next = es;
    if (lang === 'en') {
      const tr = lookup(es);
      if (tr != null) next = tr;
    }
    rec[attr].last = next;
    if (next !== cur) el.setAttribute(attr, next);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { processText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      ATTRS.forEach((a) => { if (root.hasAttribute(a)) processAttr(root, a); });
      if (skipped(root)) return;
    }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = tw.nextNode();
    while (n) {
      if (n.nodeType === Node.TEXT_NODE) processText(n);
      else ATTRS.forEach((a) => { if (n.hasAttribute(a)) processAttr(n, a); });
      n = tw.nextNode();
    }
  }

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') processText(r.target);
      else if (r.type === 'attributes') processAttr(r.target, r.attributeName);
      else r.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
  });
  walk(document.body); // guarda los originales de la página fija

  function apply(next) {
    lang = next === 'en' ? 'en' : 'es';
    walk(document.body);
    document.title = lang === 'en' ? (lookup(origTitle) || origTitle) : origTitle;
    try { window.xhApi?.setLang?.(lang); } catch { /* sin puente: modo navegador */ }
  }

  // Para textos que la app arma en código (toasts, confirmaciones)
  const t = (s) => (lang === 'en' ? (lookup(s) ?? s) : s);

  window.XhI18n = { apply, t, EN, lookup, get lang() { return lang; } };
})();
