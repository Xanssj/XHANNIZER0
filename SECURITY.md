# Seguridad

XHANNIZER0 instala software y cambia ajustes de Windows, así que nos tomamos en serio cualquier fallo de seguridad.

## Cómo reportar un problema de seguridad

**No lo publiques en un issue de GitHub.** Abre un ticket privado en el [Discord oficial de xhanni](https://discord.gg/QKmUekvX2X) e incluye:

- La versión de XHANNIZER0 (aparece en **Acerca de y soporte**).
- Qué encontraste y cómo reproducirlo.
- Qué podría hacer alguien que lo aproveche.

Te respondemos lo antes posible y te avisamos cuando publiquemos la corrección. Si quieres, te mencionamos en las notas de la versión.

## Versiones con soporte

Solo la última versión publicada en [GitHub Releases](https://github.com/Xanssj/XHANNIZER0/releases) recibe correcciones. El auto-actualizador de la app te avisa cuando hay una nueva.

## Cómo se protege la app

- Ventana aislada de Electron (`contextIsolation`, `sandbox`, sin `nodeIntegration`) y política de contenido estricta.
- Cada acción que cambia el sistema exige un respaldo verificado en disco y queda en un diario para poder deshacerla.
- Los instaladores descargados se verifican con SHA-256 y firma Authenticode; los que no están firmados se bloquean.
- Los datos que llegan a PowerShell viajan codificados, nunca como texto interpolado.
- Las correcciones remotas del catálogo solo aceptan IDs de WinGet válidos y descargas por HTTPS del mismo dominio original.
