# Auditoría de Windows

La **Auditoría de Windows** analiza tu configuración actual y te muestra qué ajustes recomendados de rendimiento, pantalla, precisión y privacidad faltan por activar. Todos los cambios exigen respaldo previo y son **100 % reversibles**.

<!-- captura: pantalla de Auditoría de Windows mostrando los contadores de recomendaciones pendientes, configuraciones óptimas y tarjetas de ajustes -->

## Cómo usarla

1. Ve a **Sistema → Windows y Red** en la barra lateral (abre por defecto en **Auditoría Windows**).
2. Revisa los contadores superiores: **Recomendaciones pendientes**, **Configuraciones óptimas** y **Apps al inicio (Usuario)**.
3. Puedes aplicar cada ajuste de forma individual o presionar **Aplicar recomendadas** para activar todos los pendientes recomendados en un paso.
4. Si hiciste cambios fuera de la app, haz clic en **Reanalizar Windows** para actualizar el estado.

## Ajustes recomendados principales

- **Modo Juego de Windows (Game Mode):** prioriza recursos para juegos y evita interrupciones en segundo plano.
- **Programación de GPU acelerada por hardware (HAGS):**
  - **Solo aparece si tu tarjeta gráfica soporta HAGS** (o si el modelo no es concluyente); no se muestra en GPUs antiguas sin soporte.
  - La referencia a **Frame Generation** solo se muestra cuando tienes una gráfica **NVIDIA RTX 40 o RTX 50**, que son las que realmente la soportan.
  - Requiere reiniciar Windows. En flujos específicos con OBS o VR puede causar tirones en algunos equipos; siempre puedes revertirlo.
- **Frecuencia de actualización del monitor (Hz):**
  - Detecta monitores de alta frecuencia (144 Hz, 165 Hz, 240 Hz) que quedaron limitados a 60 Hz tras formatear y te ofrece el botón **Abrir pantalla** para cambiarlos directo en Configuración de Windows.
  - Si tu monitor es de **60 Hz reales** y está funcionando a 60 Hz, XHANNIZER0 lo cuenta como **óptimo** y no te muestra una alerta falsa.
- **Desactivar aceleración del mouse (1:1 Raw):** quita *Mejorar la precisión del puntero* para un movimiento consistente.
- **Mostrar extensiones de archivo:** hace visibles las extensiones en el Explorador para evitar confundir archivos maliciosos (`.pdf.exe`) y trabajar mejor.
- **Historial del portapapeles (`Win + V`):** guarda varios textos y enlaces copiados.
- **Desactivar ID de publicidad de Windows:** evita el identificador de seguimiento para anuncios personalizados.
- **Plan de energía óptimo:** usa **Equilibrado** en portátiles (para cuidar batería y temperatura) y **Alto rendimiento** en escritorio.
- **Modo oscuro nativo de Windows:** unifica el tema oscuro en todo el sistema.

## Ajustes opcionales y limpieza de Windows 11

Debajo de los recomendados encontrarás ajustes opcionales (no suman como «pendientes»):

- **Explorador y energía avanzada:** mostrar archivos y carpetas ocultos, desbloquear **Máximo rendimiento** (solo recomendado en escritorio) y desactivar **hibernación** (`hiberfil.sys`, libera 6–16 GB).
- **Windows 11:** quitar anuncios y recomendaciones del menú Inicio, quitar anuncios de la pantalla de bloqueo, quitar búsquedas de Bing del menú Inicio, desactivar Widgets, desactivar Recall (en equipos compatibles), desactivar experiencias personalizadas y encuestas, activar el menú contextual clásico de clic derecho y alinear la barra de tareas a la izquierda.

{% hint style="warning" %}
**Cuidado en portátiles:** desactivar la hibernación o usar *Máximo rendimiento* en una laptop no es recomendable porque reduce la autonomía, aumenta la temperatura y puede hacerte perder trabajo si se agota la batería. XHANNIZER0 te muestra una confirmación explícita antes de aplicarlos.
{% endhint %}
