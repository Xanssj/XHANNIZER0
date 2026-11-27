# Deshacer cambios y respaldos

XHANNIZER0 está diseñada para ser **100 % reversible**: antes de modificar ajustes de Windows, presets, DNS, programas al inicio, carpetas o drivers, exige crear una copia de seguridad verificada en tu disco y guarda un diario exacto de cada cambio aplicado.

<!-- captura: sección Historial de Copias de Seguridad en Carpetas y Discos mostrando el botón "Deshacer cambios" -->

## Dónde se guardan los respaldos

Todas las copias de seguridad se almacenan localmente en tu PC, en la carpeta:

```text
%USERPROFILE%\XhanniBackups\XHANNIZER0
```

Puedes abrir esa carpeta directamente desde **Carpetas y Discos → Abrir carpeta de respaldos**, desde **Ajustes → Abrir respaldos** o desde el menú superior **Sistema listo → Ver respaldos**.

## Cómo deshacer cambios paso a paso

Si aplicaste un ajuste, un preset, un cambio de DNS o una reorganización y quieres volver al estado anterior:

1. Ve a **Sistema → Carpetas y Discos** en la barra lateral.
2. Baja hasta **Historial de Copias de Seguridad**.
3. Busca el respaldo correspondiente a la acción que realizaste.
4. Haz clic en el botón **Deshacer cambios** (muestra entre paréntesis cuántos cambios pendientes de revertir contiene ese respaldo).
5. Confirma la acción. XHANNIZER0 restaurará los valores anteriores en orden inverso.

En cada tarjeta del historial también puedes:

- **Abrir:** abrir la carpeta de ese respaldo en el Explorador de Windows.
- **Eliminar:** borrar un respaldo antiguo si ya no lo necesitas.

{% hint style="info" %}
**Red de seguridad adicional:** en la ventana de copia de seguridad obligatoria también puedes marcar la casilla **También crear un punto de restauración de Windows**. Además, los [Presets](presets.md) avanzados y el [Piloto automático](piloto-automatico.md) crean un Punto de Restauración real de Windows de forma automática.
{% endhint %}

## Qué sí y qué no puede deshacer el botón «Deshacer cambios»

- **Se revierte automáticamente:** ajustes del registro de Windows (Auditoría y Presets), planes de energía, servicios pasados a Manual en *Gaming Full Competitivo*, DNS, programas de inicio desactivados y cambios registrados de carpetas.
- **No se deshace desde el diario:** archivos eliminados permanentemente en **Limpieza post-formateo** (como `Windows.old` o temporales, porque no van a la Papelera) ni programas desinstalados (aunque puedes reinstalarlos desde el [Catálogo](catalogo.md) o Microsoft Store).
