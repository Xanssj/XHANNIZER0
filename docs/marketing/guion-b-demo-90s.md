# Guión B — Demo corta de 90 s (YouTube / README de GitHub)

- **Producto:** XHANNIZER0 `{{VERSION}}` (Xhanni Studios · GNU GPLv3 · 100 % gratis)
- **Formato:** 16:9, 1920×1080, 60 fps, cursor limpio sin aceleraciones bruscas.
- **Objetivo:** Mostrar la fluidez real de `{{VERSION}}` y sus 4 pilares clave (`Piloto automático`, `Chequeo de PC + BIOS`, `Comparador DNS` y `Deshacer cambios`).
- **Estado:** Listo para grabar tras cerrar el hotfix `{{VERSION}}`. **No publicar sin aprobación.**

| Tiempo | Pantalla exacta de XHANNIZER0 | Texto en pantalla (discreto, esquina inferior) | Locución (VO) |
| :--- | :--- | :--- | :--- |
| **0:00–0:10** *(Intro)* | Abrir XHANNIZER0 `{{VERSION}}` en **`Inicio → Resumen`** (mostrar **`Resumen del equipo`**, botón **`Copiar specs`**, **`Checklist Post-Formateo`** y **`Monitor en vivo`** actualizando CPU/RAM/Disco/GPU). Pulsar **`Ctrl + K`** 1 s para mostrar Spotlight y cerrarlo con **`Esc`**. | `XHANNIZER0 {{VERSION}} · GNU GPLv3 · Sin telemetría` | «XHANNIZER0 es una aplicación gratuita y de código abierto de Xhanni Studios para dejar Windows 10 u 11 listo después de formatear o armar tu PC, sin anuncios, sin cuentas y sin telemetría. En Resumen ves tu hardware real, un checklist post-formateo y un monitor en vivo que se pausa solo en segundo plano.» |
| **0:10–0:30** *(Piloto automático)* | Navegar a **`Inicio → Piloto automático`**. Mostrar el banner de seguridad (aviso UAC + respaldo previo), recorrer los pasos (`Respaldo verificado`, punto de restauración, drivers, runtimes, apps, ajustes, limpieza, chequeo final) y señalar **`Apps que se instalarán`** + **`Cargar código`** (`XHZ1-…`). Mostrar clic en **`Iniciar piloto automático`** y la barra de progreso (o flujo con aviso **`Reiniciar y continuar`**). | `Piloto automático · Flujo guiado con reanudación tras reinicio` | «Si acabas de instalar Windows, **Piloto automático** ordena todo en un solo flujo: crea primero un respaldo verificado y un punto de restauración, instala drivers oficiales por Hardware ID, runtimes y tus programas desde WinGet o un código de perfil `XHZ1`, aplica ajustes reversibles y limpia cachés. Si un driver pide reiniciar, XHANNIZER0 se vuelve a abrir solo, sigue donde quedó y avisa con notificaciones nativas de Windows.» |
| **0:30–0:52** *(Chequeo de PC + BIOS)* | Clic en **`Hardware → Chequeo de PC`** → pulsar **`Analizar mi PC`**. Mostrar las 3 tarjetas superiores (**`Problemas para revisar`**, **`Todo correcto`**, **`Dispositivos con problemas`**), recorrer detecciones reales (RAM sin XMP/EXPO, monitor en 60 Hz o conectado a la placa madre, salud de batería en portátiles, BSOD / `Kernel-Power 41` de los últimos 30 días, Resizable BAR, Secure Boot) y bajar hasta **`Asistente de BIOS`** mostrando la ruta exacta por marca y **`Reiniciar a la BIOS`**. | `Chequeo de PC · Diagnóstico de solo lectura + Asistente de BIOS` | «En **Chequeo de PC** la app lee el estado real del equipo sin modificar nada. Detecta fallos clásicos que Windows no avisa: memoria sin XMP o EXPO, monitor limitado a 60 Hz o conectado a la placa madre, desgaste de batería en portátiles e historial de pantallazos azules o apagados `Kernel-Power 41` de los últimos treinta días. Abajo, el **Asistente de BIOS** te muestra la ruta exacta del menú para tu placa —ASUS, MSI, Gigabyte o ASRock— y te permite reiniciar directo a la BIOS.» |
| **0:52–1:08** *(Comparador DNS)* | Ir a **`Sistema → Windows y Red`** → sub-pestaña **`Bloatware y Red`**. Mostrar tarjetas **`Adaptador activo`** y **`DNS actual`**, hacer clic en **`Medir mejor DNS`**, esperar los 3 pings paralelos en **`Comparativa de latencia DNS`** (Cloudflare, Google, Quad9, AdGuard, OpenDNS) y aplicar el ganador en 1 clic (señalando también **`Restaurar Automático`**). | `Windows y Red · Comparador DNS en vivo (ICMP directo)` | «En **Windows y Red**, además de ajustes reversibles de Windows 11, inicio y bloatware seguro, el comparador de DNS mide en paralelo la latencia real desde tu conexión contra Cloudflare, Google, Quad9, AdGuard y OpenDNS, destaca el más rápido y te deja aplicarlo —o volver a automático— con un clic.» |
| **1:08–1:22** *(Botón Deshacer + Auditoría)* | Clic arriba a la derecha en la píldora **`Sistema listo`** → **`Ver respaldos`** (lleva a **`Carpetas y Discos → Historial de Copias de Seguridad`**). Mostrar ruta local `XhanniBackups\XHANNIZER0`, pulsar **`Deshacer cambios`** en un respaldo reciente y abrir brevemente el botón **`Descargas`** arriba a la derecha para enseñar el panel de auditoría (origen HTTPS, SHA-256 y firma Authenticode). | `Respaldo previo obligatorio · Botón Deshacer en orden inverso` | «Ningún cambio de registro, DNS, inicio o carpeta se aplica sin respaldo verificado en tu propio disco. Si algo no te convence, abres el historial de copias de seguridad y haces clic en **Deshacer cambios** para revertirlo en orden inverso. Y en el panel de **Descargas** puedes auditar origen, huella SHA-256 y firma digital de cada instalador.» |
| **1:22–1:30** *(Cierre oficial y transparencia)* | Pantalla final limpia con logo oficial de **XHANNIZER0**, versión `{{VERSION}}` y enlaces oficiales: `github.com/Xanssj/XHANNIZER0/releases`, `xhannistudios.org` y `discord.gg/QKmUekvX2X`. | `Descarga oficial: github.com/Xanssj/XHANNIZER0 · xhannistudios.org` *(SmartScreen aparece sin cert. comercial — código 100 % auditable)* | «XHANNIZER0 es gratis, está disponible en español e inglés y su código es abierto bajo GNU GPLv3. Descárgalo solo desde GitHub Releases o `xhannistudios.org`. Si ves el aviso de SmartScreen, es porque no usamos certificado pago: puedes revisar todo el código o compilarlo tú mismo.» |

## Descripción sugerida para YouTube

```text
XHANNIZER0 {{VERSION}} — Utilidad gratuita y open-source (GNU GPLv3) de Xhanni Studios para dejar Windows 10/11 listo después de formatear o armar tu PC.
Sin cuentas, sin anuncios, sin telemetría y 100 % reversible.

Descarga oficial: https://github.com/Xanssj/XHANNIZER0/releases/latest
Web oficial: https://xhannistudios.org
Discord / Soporte: https://discord.gg/QKmUekvX2X

Capítulos:
0:00 Resumen, checklist y monitor en vivo
0:10 Piloto automático y perfiles XHZ1
0:30 Chequeo de PC y Asistente de BIOS
0:52 Comparador DNS en vivo
1:08 Respaldos obligatorios, Deshacer y auditoría SHA-256
1:22 Descarga oficial y transparencia sobre SmartScreen

Nota sobre SmartScreen: al ser software gratuito sin certificado comercial EV, Windows puede mostrar «Windows protegió su PC». Puedes verificar el código fuente completo en GitHub o compilar el instalador tú mismo.
```
