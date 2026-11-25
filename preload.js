'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xhApi', {
  // Controles de ventana (semáforo estilo macOS) y tema
  windowAction: (action) => ipcRenderer.send('xh:window', action),
  setTheme: (theme) => ipcRenderer.send('xh:set-theme', theme),
  onWindowState: (cb) => {
    const handler = (_event, state) => cb(state);
    ipcRenderer.on('xh:window', handler);
    return () => ipcRenderer.removeListener('xh:window', handler);
  },

  // Hardware y Drivers
  scanHardware: () => ipcRenderer.invoke('xh:scan-hardware'),

  // Catálogo e instalaciones
  getCatalog: () => ipcRenderer.invoke('xh:get-catalog'),
  installBatch: (payload) => ipcRenderer.invoke('xh:install-batch', payload),
  onInstallProgress: (cb) => {
    const handler = (_event, update) => cb(update);
    ipcRenderer.on('xh:install-progress', handler);
    return () => ipcRenderer.removeListener('xh:install-progress', handler);
  },

  // Seguridad: Copia de seguridad obligatoria y Discos/Carpetas
  createBackup: (options) => ipcRenderer.invoke('xh:create-backup', options),
  onBackupProgress: (cb) => {
    const handler = (_event, progress) => cb(progress);
    ipcRenderer.on('xh:backup-progress', handler);
    return () => ipcRenderer.removeListener('xh:backup-progress', handler);
  },
  listBackups: () => ipcRenderer.invoke('xh:list-backups'),
  scanDisks: () => ipcRenderer.invoke('xh:scan-disks'),
  runDiskAction: (payload) => ipcRenderer.invoke('xh:run-disk-action', payload),

  // Utilidades nativas del sistema
  openApp: (exePath) => ipcRenderer.invoke('xh:open-app', exePath),
  openExternal: (url) => ipcRenderer.invoke('xh:open-external', url),
  openPath: (localPath) => ipcRenderer.invoke('xh:open-path', localPath),
  pickFolder: () => ipcRenderer.invoke('xh:pick-folder'),

  // Microsoft Store
  storeFeatured: () => ipcRenderer.invoke('xh:store-featured'),
  storeSearch: (query) => ipcRenderer.invoke('xh:store-search', query),
  storeOpen: (storeId) => ipcRenderer.invoke('xh:store-open', storeId),

  // Presets Experimentales
  getPresets: (system) => ipcRenderer.invoke('xh:get-presets', system),
  applyPresetOpt: (payload) => ipcRenderer.invoke('xh:apply-preset-opt', payload),

  // Emuladores (GitHub Releases)
  getEmulators: () => ipcRenderer.invoke('xh:get-emulators'),
  checkEmulatorRelease: (repo) => ipcRenderer.invoke('xh:check-emulator-release', repo),

  // Auditoría de Configuraciones de Windows
  scanWindowsAudit: (system) => ipcRenderer.invoke('xh:scan-windows-audit', system),
  applyWindowsSetting: (payload) => ipcRenderer.invoke('xh:apply-windows-setting', payload),

  // Gestor de Inicio de Windows (Startup Manager)
  listStartup: () => ipcRenderer.invoke('xh:list-startup'),
  toggleStartup: (payload) => ipcRenderer.invoke('xh:toggle-startup', payload),

  // Exportar / Importar Perfil (.json)
  exportProfile: (data) => ipcRenderer.invoke('xh:export-profile', data),
  importProfile: () => ipcRenderer.invoke('xh:import-profile'),

  // Debloater, Actualizador Global y Red/DNS
  scanBloatware: () => ipcRenderer.invoke('xh:scan-bloatware'),
  removeBloatware: (payload) => ipcRenderer.invoke('xh:remove-bloatware', payload),
  scanUpgrades: () => ipcRenderer.invoke('xh:scan-upgrades'),
  runUpgrade: (payload) => ipcRenderer.invoke('xh:run-upgrade', payload),
  scanNetwork: () => ipcRenderer.invoke('xh:scan-network'),
  applyNetwork: (payload) => ipcRenderer.invoke('xh:apply-network', payload),

  // Auto-actualizador, Gestión de Respaldos y Kit USB
  checkAppUpdate: () => ipcRenderer.invoke('xh:check-app-update'),
  deleteBackup: (backupId) => ipcRenderer.invoke('xh:delete-backup', backupId),
  restoreBackup: (backupId) => ipcRenderer.invoke('xh:restore-backup', backupId),
  createUsbKit: (payload) => ipcRenderer.invoke('xh:create-usb-kit', payload),

  // Chequeo de PC armado y drivers de dispositivos con problemas
  pcCheck: () => ipcRenderer.invoke('xh:pc-check'),
  installDeviceDriver: (payload) => ipcRenderer.invoke('xh:install-device-driver', payload),

  // Windows 11
  restartExplorer: () => ipcRenderer.invoke('xh:restart-explorer'),

  // Migrar mi PC
  migrationFolders: () => ipcRenderer.invoke('xh:migration-folders'),
  migrationMeasure: (folderPath) => ipcRenderer.invoke('xh:migration-measure', folderPath),
  migrationExport: (payload) => ipcRenderer.invoke('xh:migration-export', payload),
  migrationOpen: () => ipcRenderer.invoke('xh:migration-open'),
  migrationRestoreFolders: (payload) => ipcRenderer.invoke('xh:migration-restore-folders', payload),
  onMigrationProgress: (cb) => {
    const handler = (_event, progress) => cb(progress);
    ipcRenderer.on('xh:migration-progress', handler);
    return () => ipcRenderer.removeListener('xh:migration-progress', handler);
  },

  // Mantenimiento
  runRepair: (kind) => ipcRenderer.invoke('xh:run-repair', kind),
  getScheduledUpdate: () => ipcRenderer.invoke('xh:get-scheduled-update'),
  setScheduledUpdate: (payload) => ipcRenderer.invoke('xh:set-scheduled-update', payload),
  getActionLog: () => ipcRenderer.invoke('xh:get-action-log'),
  exportDiagnostics: () => ipcRenderer.invoke('xh:export-diagnostics'),
  appInfo: () => ipcRenderer.invoke('xh:app-info'),
  openDataFolder: () => ipcRenderer.invoke('xh:open-data-folder'),
  createRestorePoint: () => ipcRenderer.invoke('xh:create-restore-point'),

  // Errores inesperados
  reportError: (payload) => ipcRenderer.invoke('xh:report-error', payload),
  onAppError: (cb) => {
    const handler = (_event, info) => cb(info);
    ipcRenderer.on('xh:app-error', handler);
    return () => ipcRenderer.removeListener('xh:app-error', handler);
  },

  // Asistente de BIOS
  biosGuide: (payload) => ipcRenderer.invoke('xh:bios-guide', payload),
  rebootToBios: () => ipcRenderer.invoke('xh:reboot-to-bios'),
  prepareBiosUsb: () => ipcRenderer.invoke('xh:bios-usb'),
  onBiosUsbProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('xh:bios-usb-progress', handler);
    return () => ipcRenderer.removeListener('xh:bios-usb-progress', handler);
  },

  // Limpieza post-formateo
  cleanupScan: () => ipcRenderer.invoke('xh:cleanup-scan'),
  cleanupRun: (payload) => ipcRenderer.invoke('xh:cleanup-run', payload),
  onCleanupProgress: (cb) => {
    const handler = (_event, p) => cb(p);
    ipcRenderer.on('xh:cleanup-progress', handler);
    return () => ipcRenderer.removeListener('xh:cleanup-progress', handler);
  },

  // Antes y después + prueba de estabilidad
  benchmarkGet: () => ipcRenderer.invoke('xh:benchmark-get'),
  benchmarkTake: (payload) => ipcRenderer.invoke('xh:benchmark-take', payload),
  benchmarkShare: (rect) => ipcRenderer.invoke('xh:benchmark-share', rect),
  stabilityRun: (payload) => ipcRenderer.invoke('xh:stability-run', payload),
  stabilityStop: () => ipcRenderer.invoke('xh:stability-stop'),
  onStabilityProgress: (cb) => {
    const handler = (_event, p) => cb(p);
    ipcRenderer.on('xh:stability-progress', handler);
    return () => ipcRenderer.removeListener('xh:stability-progress', handler);
  },

  // Perfiles con código e informe técnico
  profileCodeEncode: (payload) => ipcRenderer.invoke('xh:profile-code-encode', payload),
  profileCodeDecode: (code) => ipcRenderer.invoke('xh:profile-code-decode', code),
  reportPdf: (payload) => ipcRenderer.invoke('xh:report-pdf', payload),

  // Piloto automático
  autopilotGet: () => ipcRenderer.invoke('xh:autopilot-get'),
  autopilotSave: (data) => ipcRenderer.invoke('xh:autopilot-save', data),
  autopilotReboot: () => ipcRenderer.invoke('xh:autopilot-reboot'),
  autopilotCancelReboot: () => ipcRenderer.invoke('xh:autopilot-cancel-reboot'),
});
