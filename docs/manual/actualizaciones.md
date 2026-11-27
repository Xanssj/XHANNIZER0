# Actualizaciones

El **Actualizador Global** detecta programas desactualizados en tu PC usando **WinGet** oficial y te permite actualizarlos de a uno o todos juntos sin abrir instaladores manuales.

<!-- captura: pantalla de Actualizaciones mostrando la lista de programas con botones Actualizar y Omitir, y el botón "Actualizar todo" -->

## Cómo buscar y actualizar programas

1. Ve a **Programas → Actualizaciones** en la barra lateral.
2. Haz clic en **Buscar actualizaciones**.
3. Espera unos segundos mientras WinGet consulta qué programas instalados tienen una versión más reciente.
4. Puedes actualizar una app concreta con el botón **Actualizar** de su tarjeta, o actualizar todas las pendientes con **Actualizar todo**.

{% hint style="info" %}
Algunas aplicaciones necesitan estar cerradas para actualizarse, o pedirán permisos de administrador si no activaste el [Modo administrador](primeros-pasos/modo-administrador.md).
{% endhint %}

## Omitir y Restaurar programas

Si hay un programa que **no** quieres actualizar (por ejemplo, porque necesitas quedarte en una versión concreta para un proyecto o plugin):

1. Haz clic en **Omitir** en la tarjeta de ese programa.
2. La tarjeta quedará marcada como **Omitido**, su botón **Actualizar** se ocultará y dejará de contarse en el indicador numérico de la barra lateral.
3. Esta decisión **se guarda en tu PC** y se recuerda aunque cierres y vuelvas a abrir XHANNIZER0.
4. Si más adelante cambias de opinión, haz clic en **Restaurar** en la misma tarjeta.

## «Actualizar todo» respeta lo omitido

Cuando haces clic en **Actualizar todo**:

- Si **no** tienes ningún programa omitido, XHANNIZER0 actualiza todas las aplicaciones pendientes en lote.
- Si **sí** tienes uno o más programas marcados como **Omitido**, XHANNIZER0 **no** ejecuta una actualización global ciega: actualiza una por una **únicamente las aplicaciones activas (no omitidas)**, garantizando que nunca se toque ninguna app que decidiste omitir.
- Si todos los programas de la lista están omitidos, te muestra un aviso y no ejecuta WinGet.

{% hint style="info" %}
¿Quieres que tus aplicaciones se actualicen solas una vez por semana? Configura la tarea semanal desde [Mantenimiento y limpieza](mantenimiento.md#actualización-automática-de-apps).
{% endhint %}
