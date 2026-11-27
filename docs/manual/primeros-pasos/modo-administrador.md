# Modo administrador

XHANNIZER0 funciona en modo estándar para revisar tu hardware, ver programas o consultar el estado del equipo. Sin embargo, muchas tareas de Windows —como aplicar ajustes del sistema, crear puntos de restauración, reparar Windows o limpiar temporales del sistema— requieren permisos de administrador.

## Activar permisos de administrador en 1 clic

Cuando abres XHANNIZER0 sin permisos elevados, verás un banner en la parte superior de la ventana:

> **Modo estándar — Permisos de Administrador desactivados**
> Haz clic para activar permisos de Administrador en 1 clic y evitar avisos UAC repetidos.

<!-- captura: banner superior "Modo estándar — Permisos de Administrador desactivados" con el botón "Activar Admin" -->

Para elevar la aplicación:

1. Haz clic en el banner o en el botón **Activar Admin**.
2. Windows abrirá la ventana de Control de cuentas de usuario (**UAC**).
3. Presiona **Sí** para confirmar.

XHANNIZER0 se reiniciará automáticamente con permisos de administrador y el banner desaparecerá por completo.

## ¿Qué cambia cuando usas Modo administrador?

- **Sin ventanas UAC repetidas:** al ejecutar varios pasos seguidos (por ejemplo, en el [Piloto automático](../piloto-automatico.md), en [Presets](../presets.md) o en [Mantenimiento](../mantenimiento.md)), Windows no te pedirá confirmar una ventana UAC en cada acción.
- **Actualizaciones de la app más fluidas:** si actualizas XHANNIZER0 estando en modo administrador, el instalador hereda esos permisos.

{% hint style="info" %}
**La seguridad no se desactiva.** Aunque ejecutes XHANNIZER0 como administrador, todas las confirmaciones internas y la copia de seguridad obligatoria siguen activas antes de modificar drivers, carpetas o ajustes del sistema.
{% endhint %}

## ¿Qué pasa si cancelas el aviso UAC?

Si haces clic en **No** en la ventana de Windows (UAC):

- La aplicación **no se cierra** ni pierde lo que estabas haciendo.
- Seguirás trabajando en modo estándar y podrás intentar elevarla más tarde cuando lo necesites.

## Siguiente paso

Aprende a moverte rápido por las pantallas principales en [Conocer la app](conocer-la-app.md).
