# Cómo contribuir a XHANNIZER0

Esta guía vale para todos: personas, agentes de IA (OpenCode, Antigravity, Claude) y el equipo de Xhanni Studios. Si eres una IA trabajando en este repo, **sigue estas reglas al pie de la letra**.

## Flujo de trabajo (obligatorio)

`main` está protegida: **nadie sube cambios directo a `main`**. Todo entra por un Pull Request (PR) aprobado.

1. Actualiza tu copia: `git checkout main` y `git pull`.
2. Crea una rama por tarea: `git checkout -b <tu-usuario>/<tema-corto>` (ej. `niaandrees/boton-limpieza`).
3. Haz cambios chicos y enfocados en un solo tema. Nada de mezclar varias cosas en un PR.
4. Antes de cada commit:
   - `npm test`: todo en verde;
   - `node --check` sobre cada `.js` que tocaste.
5. Mensajes de commit en inglés con [Conventional Commits](https://www.conventionalcommits.org/): `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`.
6. Sube tu rama (`git push -u origin <rama>`) y abre un PR hacia `main` (`gh pr create` o desde GitHub). **Completa la plantilla entera:** el PR es el registro de auditoría de qué cambió y por qué.
7. El dueño (Xanssj) revisa y aprueba. Las pruebas automáticas ("test") tienen que pasar. Recién ahí se une a `main`.
8. Si te piden cambios, súbelos a la misma rama: el PR se actualiza solo.

## Lo que NO se hace sin permiso del dueño

- Subir la versión (`package.json`), crear tags o publicar releases.
- Cambiar la licencia (GPLv3), la marca (`TRADEMARK.md`), `PRIVACY.md` o `SECURITY.md`.
- Tocar `.github/workflows/` (CI y publicación).
- Agregar dependencias nuevas de npm.
- Borrar funciones que ya usan los usuarios.

## Reglas de seguridad de la app (no negociables)

1. **Sin telemetría ni cuentas:** no se envía ningún dato fuera de lo que documenta `PRIVACY.md`.
2. **100 % reversible:** todo cambio en Windows necesita un respaldo previo (`src/backend/safetyBackup.js`) y su registro para deshacer (`src/backend/actionLog.js`).
3. **Electron aislado:** `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` y CSP estricta. No se relaja nunca.
4. **PowerShell seguro:** solo con parámetros codificados mediante `src/backend/powershell.js`. **Prohibido** pegar textos de afuera dentro de un comando.
5. **Protección del sistema:** nada destructivo en `C:\Windows`, `Program Files` ni en la raíz de los discos. Los servicios de Windows Update se reactivan siempre en `try/finally`.
6. **Descargas confiables:** HTTPS, SHA-256 y firma Authenticode. Nunca se ejecuta un binario sin firma.
7. **Nunca subas secretos:** claves, tokens, contraseñas, archivos `.env` ni datos personales.

## Mapa del código

| Área | Archivos |
| :--- | :--- |
| Proceso principal e IPC | `main.js`, `preload.js` |
| Lógica de Windows | `src/backend/*.js` |
| Interfaz | `src/renderer/**` (textos en `src/renderer/js/i18n.js` en español y en `src/renderer/js/i18n-en.js` en inglés: **siempre los dos**) |
| Catálogo de programas | `catalog-overrides.json`, `src/backend/catalog.js` |
| Pruebas | `tests/**` |
| Manual (GitBook) | `docs/manual/**` |

## Si eres una IA

- Lee este archivo completo antes de empezar y cúmplelo.
- Trabaja solo en tu rama. Nunca hagas `git push` a `main` ni `git push --force`.
- Antes de abrir el PR, muéstrale al humano qué cambiaste y el resultado de `npm test`.
- No inventes resultados: si una prueba falla, dilo y muestra el error.
- Si una tarea choca con estas reglas, detente y pregunta.
