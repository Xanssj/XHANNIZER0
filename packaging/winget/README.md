# Publicar XHANNIZER0 en WinGet

Con esto cualquiera podrá instalar la app con `winget install XhanniStudios.XHANNIZER0`.

Hazlo **después** de que la versión esté publicada en GitHub Releases. Los manifiestos apuntan al instalador de esa versión.

1. Compila o descarga `XHANNIZER0-2.1.0-x64-nsis.exe` de la versión publicada y saca su huella:

   ```powershell
   (Get-FileHash .\dist\XHANNIZER0-2.1.0-x64-nsis.exe -Algorithm SHA256).Hash
   ```

2. Pega la huella en `InstallerSha256` y la fecha real en `ReleaseDate` (`2.1.0/XhanniStudios.XHANNIZER0.installer.yaml`).
3. Revisa los manifiestos con WinGet:

   ```powershell
   winget validate --manifest .\packaging\winget\2.1.0
   winget install --manifest .\packaging\winget\2.1.0
   ```

   La segunda línea instala la app de verdad desde los manifiestos. Hazlo en una máquina virtual o en el Sandbox de Windows.
4. Envía los manifiestos a [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) en la carpeta `manifests/x/XhanniStudios/XHANNIZER0/2.1.0/`. Lo más simple es usar [wingetcreate](https://github.com/microsoft/winget-create):

   ```powershell
   winget install Microsoft.WingetCreate
   wingetcreate submit .\packaging\winget\2.1.0
   ```

Para las versiones siguientes: `wingetcreate update XhanniStudios.XHANNIZER0 --version X.Y.Z --urls <url del instalador> --submit`.

**Nota:** mientras el instalador no tenga firma de código, los revisores de WinGet pueden pedir más verificaciones y SmartScreen seguirá mostrando su aviso.
