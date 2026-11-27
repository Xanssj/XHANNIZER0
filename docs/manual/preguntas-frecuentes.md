# Preguntas frecuentes

## Windows muestra «Windows protegió su PC» al instalar. ¿Es un virus?

No. Ese aviso de **SmartScreen** aparece porque XHANNIZER0 es una aplicación gratuita de código abierto y todavía no cuenta con un certificado comercial de firma de código. Puedes revisar todo el código fuente en GitHub o compilarla tú mismo. Para instalarla, haz clic en **Más información → Ejecutar de todas formas**. Consulta [Instalar XHANNIZER0](primeros-pasos/instalar.md).

## ¿Por qué me pide permisos de administrador (UAC)?

Muchas tareas —como crear puntos de restauración, aplicar ajustes de sistema, reparar Windows o limpiar temporales de `C:\Windows`— requieren permisos elevados. Si haces clic en el banner superior **Activar Admin** ([Modo administrador](primeros-pasos/modo-administrador.md)), solo confirmas una vez y evitas ventanas UAC repetidas. Si cancelas el aviso UAC, la app sigue abierta normalmente en modo estándar.

## ¿Puedo deshacer lo que cambió XHANNIZER0?

Sí. Antes de cambiar ajustes del sistema, XHANNIZER0 crea una copia de seguridad verificada. Ve a **Carpetas y Discos → Historial de Copias de Seguridad** y haz clic en **Deshacer cambios**. Más detalles en [Deshacer cambios y respaldos](deshacer-y-respaldos.md).

## ¿Por qué no aparece Resizable BAR o HAGS en mi PC?

XHANNIZER0 analiza tu tarjeta gráfica, procesador y placa madre mediante su motor de compatibilidad y **solo sugiere funciones que tu hardware realmente soporta**. Si tu GPU o plataforma no admite Resizable BAR o HAGS, la app omite esa recomendación para evitar avisos falsos.

## ¿Por qué mi monitor de 60 Hz aparece como «óptimo» en Auditoría de Windows?

Si tu pantalla es físicamente de 60 Hz y está funcionando a 60 Hz, ya está al máximo real de su panel. XHANNIZER0 solo te avisa cuando detecta un monitor de alta frecuencia (por ejemplo 144 Hz, 165 Hz o 240 Hz) que quedó limitado a 60 Hz tras formatear.

## Un driver ya está al día y no veo botón para actualizarlo. ¿Es normal?

Sí. Cuando un driver ya está en la última versión, XHANNIZER0 oculta el botón de actualización para evitar reinstalaciones innecesarias. Si quieres volver a comprobarlo más tarde, usa **Reescanear hardware** arriba a la derecha.

## El preset «Full Competitivo (Experimental)» me bloqueó la aplicación. ¿Qué hago?

Por seguridad, el nivel **Experimental** exige crear un **Punto de Restauración real de Windows** antes de aplicar cambios. Si Windows tiene desactivada la *Protección del sistema*, el preset se cancela automáticamente. Para activarla:

1. Abre **Panel de control → Sistema → Protección del sistema**.
2. Selecciona el disco `C:` y haz clic en **Configurar**.
3. Marca **Activar protección del sistema**, asigna entre **5 % y 10 %** de espacio y guarda.
4. Vuelve a XHANNIZER0 e inténtalo de nuevo.

## ¿Qué pasa si omito una app en «Actualizaciones» y pulso «Actualizar todo»?

Tu decisión se respeta siempre. Cuando tienes aplicaciones marcadas como **Omitido**, el botón **Actualizar todo** actualiza únicamente las aplicaciones activas una por una y nunca toca las omitidas.

## La app se siente pesada en un PC antiguo o sin gráfica dedicada

Abre **Ajustes** (`Ctrl + ,`) y revisa **Modo ligero (bajo consumo)**. En **Automático** se activa solo en equipos modestos, pero también puedes forzarlo en **Activado** para desactivar blur, sombras y animaciones 3D.

## ¿Dónde pido ayuda si encuentro un error?

Ve a **Acerca de → Reportar un problema**. Se generará un archivo de diagnóstico `.zip` en tu PC y se abrirá el **[Discord oficial de xhanni](https://discord.gg/QKmUekvX2X)** para abrir un ticket.
