<div align="center">

# XHANNIZER0

**Utilidad post-formateo gratuita, limpia y minimalista para Windows — por Xhanni Studios**

![Estado](https://img.shields.io/badge/Estado-Pr%C3%B3ximamente%20%2F%20Beta-0071E3?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/Windows-11%20%2F%2010%20x64-1C1C1E?style=for-the-badge)
![Filosofía](https://img.shields.io/badge/Bloatware-0%25%20Limpio-30D158?style=for-the-badge)
![Licencia](https://img.shields.io/badge/Licencia-MIT-6E6E73?style=for-the-badge)

</div>

---

## Próximamente · Lanzamiento Oficial en Desarrollo

**XHANNIZER0** nace para resolver un problema clásico después de formatear o armar un PC desde cero: dejar Windows listo en minutos **sin anuncios, sin instaladores ocultos y sin el ruido visual de programas tipo Driver Booster**.

Diseñado bajo una estética **Apple Glass** sobre el material acrílico nativo de Windows 11 (Modo Oscuro / Claro e idioma ES / EN), con física de animaciones fluidas, transparencia total en cada descarga y respaldo obligatorio antes de tocar el sistema.

---

## Qué incluye XHANNIZER0

- **Drivers Inteligentes con Detección Real de Hardware**
  - Detecta CPU, **GPU Dedicada (dGPU)** con VRAM real de 64 bits, **GPU Integrada del CPU (iGPU)**, placa madre, audio principal, red y almacenamiento interno.
  - Avisos claros de estabilidad (GPU, placa madre y audio) con opción de **Versión segura (WHQL)** u **Última oficial**.
  - Detecta apps oficiales instaladas (`NVIDIA App`, `AMD Adrenalin`, `MSI Center`, etc.) y permite elegir entre instalar vía **XHANNIZER0** o desde la app del fabricante.
- **Catálogo Limpio (+115 programas oficiales)**
  - **Herramientas**: HWiNFO64, CPU-Z, GPU-Z, HWMonitor, FurMark 2, OCCT, Fan Control, DDU, NVCleanstall, CrystalDiskInfo/Mark, WizTree, Geek Uninstaller, PowerToys, Rufus y más.
  - **Launchers / Gaming**: Steam, Epic Games, EA App, Riot Client, NVIDIA App, Battle.net, Ubisoft Connect, Rockstar, GOG, Xbox App, Discord, Modrinth, CurseForge, Heroic, Playnite, Moonlight.
  - **Navegadores**: **Brave (Recomendado)**, Chrome, Firefox, Opera, Opera GX, Zen Browser, Vivaldi, Floorp, LibreWolf, Waterfox, Tor, Edge.
  - **Compresores y Utilidades**: 7-Zip, NanaZip, WinRAR, PeaZip, Bandizip, Visual C++ AIO, VLC, OBS Studio, ShareX, Everything, LocalSend, SumatraPDF, Bitwarden, KeePassXC, Blender y más.
  - **Programadores (Apartado dedicado)**: VS Code, Cursor, Windsurf, Claude Desktop, Ollama, LM Studio, Jan, Zed, Neovim, JetBrains Toolbox, Git, Node.js, Bun, Python, Go, Rust, Docker Desktop, Postman, Bruno, DBeaver, Notion, Obsidian, Figma.
  - **Emuladores (GitHub Releases)**: 18 emuladores open-source descargados directamente desde sus repositorios oficiales de GitHub.
  - **Microsoft Store**: búsqueda e instalación directa (Spotify, WhatsApp, Netflix, Apple Music, Telegram, etc.).
- **Presets Post-Formateo (Experimental)**
  - Perfiles adaptados a tu hardware real (**Gaming**, **Programadores / Developers**, **Uso Escolar**, **Uso de Oficina**).
- **Auditoría, Seguridad y Control Total**
  - **Respaldo inteligente obligatorio** antes de instalar drivers o modificar carpetas/discos/sistema.
  - **Auditoría de Descargas en vivo**: muestra el origen exacto (`WinGet`, `Microsoft Store`, `GitHub Releases`, `Windows Update WHQL`), hash **SHA-256** y verificación de **firma digital Authenticode**.
  - **Auditoría de Windows**, **Gestor de Inicio (Startup Manager)**, **Actualizador Global (`winget upgrade`)**, **Limpiador de Bloatware seguro**, **Red / DNS 1-Clic**, **Checklist Post-Formateo** y **Exportar / Importar Perfil (`.json`)**.

---

## Hoja de Ruta (Roadmap)

- [x] Arquitectura Electron + diseño Apple Glass (Dark/Light + ES/EN)
- [x] Escáner real de hardware (iGPU/dGPU, VRAM 64-bit, apps instaladas en Windows)
- [x] Catálogo oficial, Emuladores GitHub, Microsoft Store y Presets hardware-aware
- [x] Auditoría de descargas con SHA-256 / Authenticode y respaldo inteligente
- [x] Auditoría Windows, Startup Manager, Debloater seguro, Actualizador Global y Red/DNS
- [ ] Compilación pública firmada (`.exe` Instalador NSIS y versión Portátil)
- [ ] Auto-actualizador integrado vía GitHub Releases

---

## Vista previa para desarrolladores

```powershell
git clone https://github.com/Xanssj/XHANNIZER0.git
cd XHANNIZER0
npm install
npm start
```

### Generar ejecutable `.exe` (NSIS / Portátil)

```powershell
npm run dist:nsis
npm run dist:portable
```

---

<div align="center">
  <sub>Desarrollado con foco en claridad, velocidad y cero bloatware por <strong>Xhanni Studios</strong>.</sub>
</div>
