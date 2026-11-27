# Instalar XHANNIZER0

Instalar XHANNIZER0 toma menos de un minuto. Sigue estos pasos para descargar la versión oficial y completar la configuración inicial.

## 1. Descargar el instalador

1. Abre la página oficial de [GitHub Releases de XHANNIZER0](https://github.com/Xanssj/XHANNIZER0/releases/latest).
2. Descarga el archivo instalador `XHANNIZER0-2.4.0-x64-nsis.exe`.
3. Haz doble clic sobre el archivo descargado para iniciar la instalación.

## 2. Si aparece «Windows protegió su PC» (SmartScreen)

Al ejecutar el instalador por primera vez, es normal que Windows muestre una pantalla azul de **Microsoft Defender SmartScreen**.

{% hint style="warning" %}
Este aviso aparece porque el proyecto es gratuito y de código abierto y todavía no cuenta con un certificado comercial de firma de código. Puedes revisar el código fuente completo en GitHub antes de instalarlo.
{% endhint %}

Para continuar:

1. Haz clic en **Más información**.
2. Presiona **Ejecutar de todas formas**.
3. Completa el instalador y abre **XHANNIZER0**.

<!-- captura: ventana de Windows SmartScreen mostrando "Más información" y el botón "Ejecutar de todas formas" -->

## 3. Completar el asistente de bienvenida

La primera vez que abres XHANNIZER0 aparece un asistente de 3 pasos para adaptar la app a tu equipo:

1. **Bienvenida e idioma:** elige entre **Español** o **English** y presiona **Empezar**.
2. **Tu PC:** selecciona **Detectar automáticamente** (recomendado) para leer tu procesador, tarjeta de video, RAM y versión de Windows, o elige **Escribirlo yo** si prefieres cargarlo manualmente. Los drivers siempre se buscan con la detección real del hardware para evitar instalaciones equivocadas.
3. **¿Para qué usas el PC?:** elige tu uso principal (**Juegos**, **Trabajo u oficina**, **Estudios**, **Programación** o **Uso general**) y presiona **Terminar**.

<!-- captura: asistente de bienvenida de XHANNIZER0 mostrando los pasos de idioma, datos del PC y uso principal -->

{% hint style="info" %}
Si quieres repetir este asistente más adelante, entra en [Ajustes y Acerca de](../ajustes-y-acerca.md) y presiona **Configuración inicial**.
{% endhint %}

## 4. Actualización automática de la app

XHANNIZER0 busca nuevas versiones oficiales en GitHub al abrirse.

- Cuando hay una versión nueva disponible, aparece el botón **Actualización** en la esquina superior derecha.
- Al descargarla, verás una ventana con dos opciones: **Reiniciar y actualizar** o **Más tarde**.
- La actualización **nunca se instala sola al cerrar la app**: solo se aplica cuando tú haces clic en **Reiniciar y actualizar**.
- También puedes comprobar actualizaciones manualmente en cualquier momento desde **Acerca de → Buscar actualización**.

## Siguiente paso

Antes de aplicar cambios en Windows o instalar varios drivers, te conviene activar el [Modo administrador](modo-administrador.md).
