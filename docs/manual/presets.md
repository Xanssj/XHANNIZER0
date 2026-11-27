# Presets post-formateo

Los **Presets** aplican paquetes completos de programas y ajustes de Windows adaptados al hardware real de tu PC (CPU, GPU, VRAM, RAM y si es escritorio o portátil). Todo lo que aparece listado en cada tarjeta se aplica de verdad y queda registrado para poder deshacerlo.

<!-- captura: pantalla de Presets mostrando las tarjetas de Gaming, Programación / Dev, Oficina / Trabajo y Estudios / Casa con su selector de niveles -->

## Qué nunca tocan los Presets

Por seguridad y estabilidad, XHANNIZER0 **nunca** modifica ni desactiva:

- **Windows Defender** (antivirus y seguridad de Windows).
- **Windows Update** (actualizaciones de seguridad).
- **Servicios de Audio** ni **servicios de Xbox**.
- **Anticheats** (Vanguard, EAC, BattlEye, Ricochet, etc.).
- El archivo de paginación (`pagefile`) ni parámetros de arranque (`bcdedit`) a ciegas.

## Perfiles y niveles disponibles

### Gaming (3 niveles)

Incluye apps recomendadas de gaming (Steam, Discord, Brave, Visual C++, HWiNFO64, MSI Afterburner, 7-Zip y NVIDIA App solo si tienes gráfica NVIDIA).

- **Básico / Seguro:**
  - Activa **Modo Juego** nativo de Windows.
  - Desactiva **Game DVR** (grabación en segundo plano).
  - Configura plan de energía **Alto Rendimiento** en escritorio o **Equilibrado** en portátiles.
  - Configura precisión del **mouse 1:1** (sin aceleración).
- **Medio / Optimizado** *(recomendado)*:
  - Todo lo de **Gaming Básico**.
  - Activa **HAGS** (programación acelerada por GPU) **solo si tu gráfica lo soporta**.
  - Activa optimizaciones para juegos en ventana.
  - Quita anuncios del menú Inicio, pantalla de bloqueo, Bing, Widgets y telemetría publicitaria.
  - Limita aplicaciones en segundo plano de Windows.
  - Crea un **Punto de Restauración real de Windows** antes de aplicar.
- **Full Competitivo (Experimental):**
  - Solo para PCs dedicados a jugar.
  - Todo lo de **Gaming Medio**.
  - En escritorio activa el plan **Máximo rendimiento** *(en portátiles mantiene Equilibrado para evitar sobrecalentamiento)*.
  - Reduce efectos visuales y transparencias de Windows (manteniendo fuentes nítidas).
  - Ajusta prioridades multimedia (**MMCSS**) para menor latencia.
  - Pasa a inicio **Manual** únicamente 4 servicios no críticos seguros (`DiagTrack`, `MapsBroker`, `RetailDemo` y `Fax`).
  - **Opción opcional para desactivar VBS / Integridad de memoria** (requiere marcarla explícitamente y confirmar el aviso).
  - Exige un **Punto de Restauración real de Windows obligatorio**.

{% hint style="danger" %}
**Nivel Experimental y Punto de Restauración obligatorio:** en **Gaming Full Competitivo (Experimental)**, XHANNIZER0 intenta crear un Punto de Restauración real de Windows antes de tocar nada. **Si Windows no permite crearlo, la aplicación bloquea y cancela el preset por seguridad.** Si te ocurre, activa *Protección del sistema* en Panel de control → Sistema → Protección del sistema (5–10 % de disco) y vuelve a intentarlo.
{% endhint %}

{% hint style="warning" %}
**Riesgo de desactivar VBS / Integridad de memoria:** es una casilla opcional dentro de *Full Competitivo*. Desactivar VBS puede dar algunos FPS extra en ciertos juegos, pero **reduce el aislamiento de núcleo de Windows** (menor protección frente a malware avanzado) y requiere reiniciar. Déjala desmarcada si usas el PC para trabajo, bancos o uso diario.
{% endhint %}

### Programación / Dev (2 niveles)

Incluye VS Code, Cursor, Git, Node.js LTS, Python 3, Windows Terminal, Postman, Obsidian, 7-Zip y Brave. En el nivel **Pro**, añade automáticamente **Docker Desktop** si tienes 16 GB de RAM o más, y **Ollama** si tienes una GPU dedicada con 8 GB de VRAM o más.

- **Estándar:** muestra extensiones de archivo, activa el historial del portapapeles (`Win + V`), ajusta el plan de energía según escritorio o portátil y crea la carpeta de proyectos `XhanniWorkspace` en tu usuario.
- **Pro:** añade **archivos ocultos visibles**, limpieza de distracciones (anuncios de Inicio, Bing, Widgets y telemetría publicitaria) y **Punto de Restauración real de Windows** antes de aplicar.

### Oficina / Trabajo (2 niveles)

Incluye Brave, NanaZip, 7-Zip, Everything, PowerToys, Notepad++, Notion y VLC.

- **Estable:** plan de energía **Equilibrado**, extensiones de archivo visibles e historial del portapapeles (`Win + V`).
- **Productividad limpia:** suma limpieza de distracciones (Inicio, pantalla de bloqueo, Bing, Widgets y telemetría publicitaria), carpeta de trabajo `XhanniWorkspace` y **Punto de Restauración real de Windows**.

### Estudios / Casa (Ligero / Silencioso)

Incluye Brave, Notion, Obsidian, VLC, 7-Zip y Everything.

- **Ligero / Silencioso:** plan **Equilibrado** para menos ruido y temperatura, extensiones visibles, `Win + V`, limpieza de anuncios y sugerencias, y creación de la carpeta `XhanniEstudios` (con subcarpetas para clases, apuntes, trabajos, lecturas PDF y exámenes).

## Mis perfiles guardados

Al final de la pantalla de **Presets** tienes la sección **Mis perfiles guardados**:

1. Marca tus programas favoritos en el [Catálogo](catalogo.md).
2. Escribe un nombre para tu perfil (por ejemplo, `PC Gamer` o `Oficina`).
3. Haz clic en **Guardar selección** para reutilizarlo en 1 clic cuando quieras.
