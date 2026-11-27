# Conocer la app

XHANNIZER0 está organizada para que encuentres cada herramienta en dos clics, con una barra lateral fija a la izquierda, una barra superior de estado y un buscador global.

<!-- captura: pantalla principal "Resumen del equipo" mostrando la barra lateral, el checklist post-formateo y el monitor en vivo -->

## La barra lateral

La barra izquierda agrupa todas las funciones en cuatro bloques:

- **Inicio:** [Resumen](#resumen-del-equipo) y [Piloto automático](../piloto-automatico.md).
- **Hardware:** [Drivers y BIOS](../drivers.md) y [Chequeo de PC](../chequeo-de-pc.md).
- **Programas:** [Catálogo](../catalogo.md), [Presets](../presets.md) y [Actualizaciones](../actualizaciones.md).
- **Sistema:** [Windows y Red](../auditoria-de-windows.md), [Carpetas y Discos](../carpetas-y-discos.md) y **Migración y Técnico** ([Migrar mi PC](../migrar-mi-pc.md), [Mantenimiento](../mantenimiento.md) y [Rendimiento e informe](../rendimiento-e-informe.md)).

En la parte inferior de la barra lateral encontrarás los botones **Ajustes** y **Acerca de**, el indicador **Respaldo obligatorio activo** y el nombre de tu equipo.

{% hint style="info" %}
En las secciones con varias pestañas internas (**Catálogo**, **Windows y Red** y **Migración y Técnico**) aparece una barra segmentada arriba del contenido para cambiar entre subsecciones sin salir del grupo.
{% endhint %}

## Barra superior de estado

En la esquina superior derecha tienes controles rápidos siempre visibles:

- **Actualización:** aparece solo cuando hay una nueva versión de XHANNIZER0 disponible.
- **Descargas:** abre el panel de **Auditoría de Descargas**, donde ves el origen oficial, la huella SHA-256, la firma digital y el progreso en tiempo real de cada instalación.
- **Sistema listo:** despliega el estado de WinGet, el escaneo de hardware, la cantidad de apps instaladas, las copias de seguridad guardadas y un botón para **Reescanear PC**.

## Resumen del equipo

Es la pantalla de inicio de XHANNIZER0 y muestra el estado general de tu PC en un vistazo:

1. **Ficha de hardware:** muestra si el equipo es de escritorio o portátil, la versión de Windows, el procesador, la gráfica, la memoria RAM y la placa madre. Con **Copiar specs** copias tus especificaciones al portapapeles en 1 clic.
2. **Checklist Post-Formateo:** barra de progreso de `0%` a `100%` que marca qué pasos ya completaste tras formatear.
3. **Monitor en vivo:** muestra el uso de **CPU**, **Memoria RAM**, **Disco del sistema** y la **temperatura de GPU NVIDIA** (cuando hay una gráfica NVIDIA instalada). Puedes pausarlo manualmente con el botón **Pausar**; además se pausa solo cuando cambias de pestaña o minimizas la app para ahorrar recursos.
4. **Tarjetas de estado y accesos rápidos:** resumen directo de drivers, chequeo de PC, programas y copias de seguridad, junto con accesos a las tareas más comunes.

## Atajos de teclado

Puedes moverte por toda la aplicación sin usar el mouse:

| Atajo | Qué hace |
| :--- | :--- |
| `Ctrl + K` | Abre la búsqueda rápida **Spotlight** para encontrar apps, emuladores, drivers, ajustes o secciones. |
| `Ctrl + 1` … `Ctrl + 9` | Salta directo entre las 9 secciones principales de la barra lateral (`1` Resumen, `2` Piloto automático, `3` Drivers, `4` Chequeo de PC, `5` Catálogo, `6` Presets, `7` Actualizaciones, `8` Auditoría de Windows, `9` Carpetas y Discos). |
| `Ctrl + ,` | Abre **Ajustes**. |
| `Esc` | Cierra la ventana modal, búsqueda o panel que esté abierto. |

## Barra flotante de instalación por lote

Cuando marcas programas o drivers en distintas secciones, aparece abajo una barra flotante con la cantidad de elementos seleccionados. Desde ahí puedes limpiar la selección o pulsar **Instalar selección** para instalar todo en orden de una sola vez.
