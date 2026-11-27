# Inicio, bloatware y red

Dentro de **Sistema → Windows y Red**, las pestañas **Inicio Windows** y **Bloatware y Red** te permiten acelerar el arranque, quitar apps preinstaladas innecesarias y elegir el servidor DNS más rápido para tu conexión.

<!-- captura: pestañas Inicio Windows y Limpieza y Red (comparador de DNS y lista de bloatware) -->

## Inicio de Windows

La pestaña **Inicio Windows** muestra los programas que arrancan automáticamente cuando enciendes el PC.

1. Revisa la lista de programas habilitados al inicio.
2. Desactiva los que no necesites tener abiertos desde el primer segundo (por ejemplo, launchers o utilidades que puedes abrir manualmente).
3. Haz clic en **Actualizar lista** si instalaste algo nuevo.

{% hint style="info" %}
Desactivar un programa del inicio **no lo desinstala**: solo evita que se abra solo al encender el PC. Es 100 % reversible.
{% endhint %}

## Bloatware de Windows

En **Bloatware y Red**, la sección **Limpiador de Bloatware de Windows** detecta únicamente aplicaciones preinstaladas seguras y reversibles desde Microsoft Store (como Clipchamp, Microsoft Noticias, Clima, Solitaire, Centro de opiniones, Obtener ayuda, Sugerencias, Copilot App, Microsoft 365 Hub, Cortana, Skype o Power Automate Desktop).

1. Revisa qué apps aparecen detectadas en tu equipo.
2. Elimina las que no uses de forma individual o presiona **Eliminar bloatware detectado**.
3. Confirma la copia de seguridad previa.

{% hint style="info" %}
XHANNIZER0 **nunca** elimina componentes críticos de Windows, Microsoft Store, antivirus ni servicios del sistema. Si más adelante quieres volver a instalar alguna de estas apps, puedes bajarla gratis desde Microsoft Store.
{% endhint %}

## Red y comparador de DNS

En la parte superior de **Bloatware y Red** verás tu adaptador de red activo, la velocidad de enlace, el DNS actual y la latencia a Cloudflare y Google.

### Cómo medir y aplicar el mejor DNS

1. Haz clic en **Medir mejor DNS**. XHANNIZER0 realiza 3 pings paralelos en vivo a los principales servidores públicos:
   - **Cloudflare** (`1.1.1.1`) — muy rápido y enfocado en privacidad.
   - **Google DNS** (`8.8.8.8`) — alta disponibilidad global.
   - **Quad9** (`9.9.9.9`) — bloquea dominios maliciosos y phishing.
   - **AdGuard DNS** (`94.140.14.14`) — bloquea anuncios y rastreadores por DNS.
   - **OpenDNS** (`208.67.222.222`) — estable con protección de Cisco.
2. Revisa cuál tuvo menor latencia en tu conexión y haz clic en su botón para aplicarlo en 1 clic.
3. Si alguna vez quieres volver al DNS de tu proveedor de internet, haz clic en **Restaurar Automático**.
4. También tienes **Vaciar caché DNS** para limpiar registros de red antiguos sin cambiar tu configuración.
