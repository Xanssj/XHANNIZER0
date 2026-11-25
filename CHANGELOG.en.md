# Changes

English notes for the "What's new" window. The full history is in CHANGELOG.md (Spanish).

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
