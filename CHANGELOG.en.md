# Changes

English notes for the "What's new" window. The full history is in CHANGELOG.md (Spanish).

## 2.3.1 — 2026-11-27

### Security
- **Tighter Electron isolation**: navigation restricted strictly to `src/renderer/index.html`, `dragover`/`drop` navigation blocked, `xh:open-app` restricted to executables verified by the main process, external WinGet packages restricted to opened migrations with native confirmation, Chromium permission requests denied by default, and hardened PDF report window.
- **Junction-safe elevated UAC cleanup**: elevated cleanup on `C:\Windows\Temp` and `SoftwareDistribution\Download` skips reparse points/junctions (`!ReparsePoint`), wraps `StateFlags0742` in `try/finally`, and preserves active XHANNIZER0 temp folders.
- **Fail-closed dialogs & safer BIOS USB prep**: destructive confirmations always cancel if the window is closed; BIOS USB formatting locks concurrency upfront, validates physical disk identity (`UniqueId` and size), and enforces strict HTTPS with a download size cap.
- **Safer downloads & updates**: `downloadFile` enforces a max size limit, rejects non-HTTPS redirects, and waits for stream close before removing partial files; `powershell.exe` is invoked via its absolute System32 path; the auto-updater only installs on explicit user click (no silent install on quit).

### Stability, catalog & CI
- **Autopilot, restore & PC Check**: Autopilot persists `settingIds` and preserves its original `backupId` across reboots while awaiting live driver checks; `createRestorePoint` restores the registry key inside `finally`; `restore` handles `(default)` values and UAC cancellations; `pcCheck` maps PCIe properties by `KeyName` and avoids `RAM at Infinity MHz`; fixed Overview double-counting, broadened `isAppBusy()`, and wrapped async buttons in `try/finally`.
- **Catalog, emulators & CI**: GitHub Actions releases now build into a `--draft` release and publish only after verifying `latest.yml` and the `.exe` installer; installer bundles `LICENSE` and `THIRD-PARTY-NOTICES.md` (GNU GPLv3); fixed hanging Promises on oversized responses in `emulators.js`/`main.js` and 64-bit asset picking; catalog validation now runs on `pull_request` too.
- **Legal text & privacy**: updated `i18n.js` license strings to **GNU GPLv3** and documented catalog favicons (`www.google.com/s2/favicons`) in `PRIVACY.md`.

### Interface
- **Cleaner PC Check**: removed redundant GPU temperature (already shown in Overview's live monitor) and the positive "Virtualization available" item while keeping the BIOS-disabled warning.
- **Cleaner title bar**: moved language and theme switching exclusively to **Settings** (and first-run setup), removing duplicate header buttons.
- **Noise-free up-to-date Drivers**: hid the "Check for update" button on up-to-date drivers, guarded the click handler against opening the install modal unnecessarily, and added a single "All your drivers are up to date." notice after scanning.

## 2.3.0 — 2026-11-26

### New
- **Overview dashboard & grouped sidebar**: navigation reorganized into 4 clean groups (`Home`, `Hardware`, `Programs`, `System`) with macOS segmented sub-tabs, 1-click PC specs copy, and a dedicated **Settings** view (`Ctrl + ,`).
- **Live hardware monitor** in Overview: real-time CPU, RAM, system drive free space, and NVIDIA GPU temperature (auto-pauses when switching tabs or minimizing).
- **Live DNS benchmark**: measures real parallel latency across Cloudflare, Google, Quad9, AdGuard, and OpenDNS, highlights the fastest server, and applies it in 1 click.
- **Expanded PC Check**: now also detects monitors stuck at 60 Hz, laptop battery health/wear, and Blue Screens (BSOD) or unexpected `Kernel-Power 41` shutdowns over the last 30 days.
- **Built-in WinGet uninstaller** on installed catalog cards with native confirmation.
- **Saved local profiles** inside Presets to save, load, and share custom selections without loose files.
- **New reversible Windows settings**: show hidden files, unlock Ultimate Performance plan, and disable hibernation (`hiberfil.sys`) with clear laptop warnings.
- **Native Windows notifications** when long tasks finish while the app is minimized (toggleable in Settings).
- **Command Palette (`Ctrl + K`)** and quick keyboard shortcuts (`Ctrl + 1..9`).

### Fluidity & design
- **60–240 Hz fluid motion system**: spring-physics sidebar hover pill, sliding segmented indicators, frame-rate-independent 3D card tilt, 1 px cursor-reactive glass edge highlight, and click ripples.
- **Native Windows 11 DWM window animations**: switched to `titleBarStyle: 'hidden'` + `thickFrame: true` for smooth GPU-accelerated open, minimize, restore, maximize, and close animations.
- Fixed Light Mode toast notification contrast.

### Security & PC safety
- **Guaranteed Windows Update service recovery**: repair and cache cleanup scripts wrap service stop/start in `try/finally` blocks so services never stay stopped.
- **Protected system folder guard**: disk, folder, and migration actions block critical OS paths (`C:\Windows`, `Program Files`, drive roots).
- **Explicit safety confirmations** before sensitive changes (hibernation, Ultimate Performance on laptops, HAGS, Explorer restart, and Autopilot reboot).
- Full security & IPC audit (85/85 channels verified) and expanded unit test suite (29 tests).

## 2.2.5 — 2026-11-25

### Changed
- **Windows-order window controls**: the circular window buttons now follow Windows order — Minimize (left), Maximize (middle), and Close (right).
- Updated the packager (`electron-builder` 26) for cleaner, more secure builds.

## 2.2.4 — 2026-11-25

### Security & quality
- **Security hardening**: stricter validation on HTTPS downloads, Authenticode signature checks before auto-launching emulator installers, full PowerShell parameter isolation, and tighter local path checks.
- **More reliable Windows 11 USB tool**: supports official Microsoft HTTPS download subdomains with a request timeout (keeping mandatory Microsoft signature verification).
- **WinGet installs**: added a safety timeout so a stuck external installer can no longer freeze the queue.

### Fixed
- The right-click context menu (Cut, Copy, Paste, Select all) is now translated into English as well.
- Updated official Discord invite link.
- GitHub Releases now ship only the official Windows installer (`-x64-nsis.exe`) with automatic updates.

## 2.2.3 — 2026-11-25

### New
- **Full English**: choosing EN translates the whole app, including what shows up later (driver cards, PC check, notices, results), Windows dialogs (confirmations, save and open), the PDF report and the release notes.
- **Detects any PC's hardware**: laptops, brand-name PCs (Dell, HP, Lenovo, Acer, ASUS, MSI, Surface and more) and virtual machines. It now also shows Wi-Fi, Bluetooth, cameras, fingerprint readers, several audio and network devices, and every internal disk.
- **Brand-name PCs and laptops**: drivers and BIOS point to the manufacturer's support site and official app (Dell SupportAssist, HP Support Assistant, Lenovo Vantage…), and the BIOS Assistant shows the right key to get in.
- New integrated GPUs recognized: Intel Arc integrated, Radeon 780M/890M and Qualcomm Adreno.

### Changed
- On laptops the recommended power plan is Balanced (protects battery and temperature), and PC Check no longer flags what the manufacturer locks (RAM speed, a single stick, video output).

### Fixed
- The sidebar no longer scrolls under the window buttons: the logo and footer stay put, only the menu scrolls, with no visible gray bar.

## 2.2.2 — 2026-11-25

### New
- **Welcome assistant** the first time you open the app: language, PC details (detected automatically or typed in: Windows, CPU, GPU and RAM) and what you use the PC for. When done it opens the recommended preset for that use.
- **Update window**: when the new version finishes downloading, the app blurs and an "Update ready" window appears. Accepting shows "Updating…", installs and reopens by itself.
- **What's new** after updating: the app shows what changed in the new version.
- **Initial setup** button in "About" to open the assistant again.
