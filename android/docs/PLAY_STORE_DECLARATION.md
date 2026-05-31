# Consentia Gateway — Declaración de permiso `SEND_SMS` en Google Play

Documento de referencia para la **Permissions Declaration Form** de Google Play Console.
Categoría de uso permitido elegida: **Device automation** (automatización de dispositivo).

> **Resumen honesto:** `SEND_SMS` es un permiso restringido. Una app que no es la app de mensajes
> por defecto solo puede pedirlo declarando uno de los casos permitidos por Google. El que encaja con
> Consentia Gateway es **"Device automation"**. La aprobación es **discrecional de Google** — esta
> declaración construye el caso más fuerte y veraz posible, pero no garantiza la aprobación. Por eso
> SMS es canal de **respaldo** (WhatsApp + email son primario/fallback) y existe un **plan B**
> (app como manejador de SMS por defecto en teléfono dedicado) si la declaración es rechazada.

---

## 🇪🇸 Español

### 1. Qué es la app y por qué necesita `SEND_SMS`
Consentia Gateway es una herramienta **instalada por el propio dueño del dispositivo** (un negocio:
clínica, consultorio, ONG) en su teléfono. Su única función es **automatizar el envío de un código de
verificación (OTP) por SMS desde la línea del propio dueño**, cuando uno de sus firmantes solicita
verificar su identidad para firmar un consentimiento o documento.

El envío debe ocurrir **automáticamente y en segundos**, sin que nadie toque el teléfono, porque el
firmante está esperando el código en otro dispositivo. La única API de Android que envía SMS de forma
programática es `SmsManager`, que **requiere `SEND_SMS`**. Es funcionalidad central: sin el permiso, la
app no cumple su único propósito.

### 2. Por qué encaja en "Device automation"
Definición de Google: *"Apps que permiten al usuario automatizar acciones repetitivas en una o más áreas
del sistema operativo, según una o más condiciones (triggers) definidas por el usuario."*

- El **dueño del dispositivo** instala y vincula la app a su propia cuenta (acción deliberada y consentida).
- La app automatiza una acción del sistema (**enviar un SMS**) ante un **trigger** definido por el dueño:
  la solicitud de OTP de uno de sus firmantes, autenticada criptográficamente (HMAC-SHA256 + API key).
- Es una automatización del propio dueño sobre su propia línea, no un servicio que envíe en su nombre sin
  su control.

### 3. Naturaleza del tráfico (refuerza la legitimidad)
- **Iniciado por un usuario**, nunca aleatorio: cada SMS responde a una solicitud explícita de un firmante.
- **Transaccional, no comercial**: el mensaje es un código de verificación con leyenda "no lo compartas,
  válido por X minutos". No hay marketing ni envíos masivos.
- **1 a 1 y de bajo volumen**: del orden de unos pocos por hora; nunca difusión a listas.

### 4. Por qué no hay alternativa al permiso
- `Intent.ACTION_SENDTO` (sin permiso) **exige que un humano pulse "enviar" en cada mensaje** y abre una
  UI que **no puede lanzarse desde un servicio en segundo plano**. Imposible para un envío automático,
  desatendido y en segundos. **No es alternativa viable.**
- `SmsManager` es la **única** vía de envío automático, y requiere `SEND_SMS`.

### 5. Privacidad y manejo de datos
- La app **solo envía** SMS. **No lee, no almacena y no transmite** los SMS del usuario ni su registro de
  llamadas. No solicita `READ_SMS`, `RECEIVE_SMS` ni permisos de Call Log.
- Los secretos de vinculación (API key + HMAC) se guardan cifrados (`EncryptedSharedPreferences`,
  AES-256). `allowBackup="false"`.
- El número del firmante llega solo para el envío puntual; no se persiste en el dispositivo.
- Arquitectura zero-knowledge: el servidor no envía SMS, solo firma una petición que el teléfono del
  dueño ejecuta.

### 6. Texto sugerido para el formulario de declaración
> **Permiso solicitado:** `SEND_SMS`
> **¿La app es manejador de SMS por defecto?** No.
> **Caso de uso permitido:** Device automation.
> **Funcionalidad central:** El dueño del dispositivo instala la app para automatizar el envío de códigos
> de verificación (OTP) por SMS desde su propia línea, disparados por solicitudes autenticadas de sus
> usuarios finales que necesitan verificar su identidad. El envío debe ser automático e inmediato; un
> humano no puede intervenir por cada mensaje. `ACTION_SENDTO` no sirve porque requiere interacción manual
> y UI en primer plano. La app no lee ni almacena SMS; solo envía. Tráfico transaccional, 1 a 1, iniciado
> por el usuario, de bajo volumen, sin contenido comercial.

### 7. Riesgo residual y mitigación (lectura honesta)
- "SMS gateway" **no** es una categoría nombrada por Google; encajamos bajo "Device automation", que es
  una **interpretación razonable pero sujeta a criterio del revisor**. Puede ser aprobada o rechazada.
- **Mitigación de producto:** SMS es respaldo; WhatsApp Business (sin app, marca verificada) + email son
  el camino primario, así que un rechazo **no tumba el producto**.
- **Plan B técnico:** publicar la app como **manejador de SMS por defecto** en un **teléfono dedicado**
  al gateway — eso habilita `SEND_SMS` sin discrecionalidad, a cambio de pedir un equipo dedicado (es
  voluntad del cliente). Solo para clientes que quieran SMS y acepten dedicar un teléfono.
- **Contexto Android 15+:** `SEND_SMS` es "hard-restricted" para apps instaladas **fuera** de Play. Es
  decir, la distribución por Play Store es la ruta correcta y cada vez más necesaria; el sideloading
  empeora.

---

## 🇬🇧 English (submission-ready)

### 1. What the app is and why it needs `SEND_SMS`
Consentia Gateway is a tool **installed by the device owner themselves** (a business: clinic, medical
office, NGO) on their own phone. Its sole function is to **automate sending a one-time verification code
(OTP) via SMS from the owner's own phone line**, whenever one of their signers requests to verify their
identity in order to sign an informed-consent form or document.

The send must happen **automatically and within seconds**, with no one touching the phone, because the
signer is waiting for the code on a different device. The only Android API that sends SMS
programmatically is `SmsManager`, which **requires `SEND_SMS`**. This is core functionality: without the
permission, the app cannot fulfill its only purpose.

### 2. Why it fits "Device automation"
Google's definition: *"Apps that enable the user to automate repetitive actions across multiple areas of
the OS, based on one or more conditions (triggers) set by the user."*

- The **device owner** installs and pairs the app to their own account (a deliberate, consented action).
- The app automates an OS action (**sending an SMS**) in response to a **trigger** defined by the owner:
  an OTP request from one of their signers, cryptographically authenticated (HMAC-SHA256 + API key).
- It is the owner's own automation over their own phone line — not a service sending on their behalf
  outside their control.

### 3. Nature of the traffic (reinforces legitimacy)
- **User-initiated**, never random: every SMS answers an explicit request from a signer.
- **Transactional, not commercial**: the message is a verification code with a "do not share, valid for
  X minutes" notice. No marketing, no bulk sending.
- **One-to-one and low-volume**: on the order of a few per hour; never list broadcasts.

### 4. Why there is no alternative to the permission
- `Intent.ACTION_SENDTO` (permission-free) **requires a human to tap "send" for every message** and opens
  a UI that **cannot be launched from a background service**. Impossible for automatic, unattended,
  within-seconds delivery. **Not a viable alternative.**
- `SmsManager` is the **only** automatic sending path, and it requires `SEND_SMS`.

### 5. Privacy and data handling
- The app **only sends** SMS. It does **not read, store, or transmit** the user's SMS messages or call
  log. It does not request `READ_SMS`, `RECEIVE_SMS`, or any Call Log permission.
- Pairing secrets (API key + HMAC) are stored encrypted (`EncryptedSharedPreferences`, AES-256).
  `allowBackup="false"`.
- The signer's phone number arrives only for the one-off send; it is not persisted on the device.
- Zero-knowledge architecture: the server does not send SMS; it only signs a request that the owner's
  phone executes.

### 6. Suggested declaration-form text
> **Requested permission:** `SEND_SMS`
> **Is the app a default SMS handler?** No.
> **Permitted use case:** Device automation.
> **Core functionality:** The device owner installs the app to automate sending one-time verification
> codes (OTP) via SMS from their own phone line, triggered by authenticated requests from their end users
> who need to verify their identity. Sending must be automatic and immediate; a human cannot intervene
> per message. `ACTION_SENDTO` is unsuitable because it requires manual interaction and a foreground UI.
> The app does not read or store SMS; it only sends. Traffic is transactional, one-to-one, user-initiated,
> low-volume, with no commercial content.

### 7. Residual risk and mitigation (honest read)
- "SMS gateway" is **not** a category Google names explicitly; we qualify under "Device automation,"
  which is a **reasonable interpretation but subject to the reviewer's discretion**. It may be approved or
  rejected.
- **Product mitigation:** SMS is a fallback; WhatsApp Business (no app, verified brand) + email are the
  primary path, so a rejection **does not break the product**.
- **Technical plan B:** publish the app as the **default SMS handler** on a **dedicated phone** for the
  gateway — this enables `SEND_SMS` without discretion, at the cost of requiring a dedicated device (the
  client's choice). Only for clients who want SMS and accept dedicating a phone.
- **Android 15+ context:** `SEND_SMS` is "hard-restricted" for apps installed **outside** Play. Play
  Store distribution is therefore the correct and increasingly necessary route; sideloading is getting
  worse.

---

## Referencias
- [Use of SMS or Call Log permission groups — Play Console Help](https://support.google.com/googleplay/android-developer/answer/10208820)
- [Permissions used only in default handlers — Android Developers](https://developer.android.com/guide/topics/permissions/default-handlers)
- [Declare permissions for your app — Play Console Help](https://support.google.com/googleplay/android-developer/answer/9214102)
