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
});
