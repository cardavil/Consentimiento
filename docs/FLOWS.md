# Flujos

## 1. Registro del cliente

**Paso 1 — Tipo:** persona natural o jurídica.

**Paso 2 — Datos:**
- Natural: nombre, apellido, tipo doc, número, email, teléfono
- Jurídica: razón social, NIT, email empresa, teléfono empresa, nombre firmante, apellido, cargo, tipo doc, número

**Paso 3 — Consentimiento de servicio:** acepta términos de la plataforma + verificación OTP por SMS al teléfono que dio. Se registra y queda logueado.

---

## 2. Login

Email → OTP por email → verifica → dashboard.

---

## 3. Onboarding (primera vez)

1. **SMS Gateway:** descarga app Android (QR) → escanea QR de configuración (API key + HMAC secret + URL encriptados) → test SMS de prueba.
2. **Nube:** conecta Google Drive o OneDrive vía OAuth → selecciona carpeta → se crea el Google Sheet de historial automáticamente. Todo en la nube, sin opción local.

---

## 4. Dashboard

**Card: Documentos** — muestra los archivos que el cliente tiene en su Drive conectado. Solo lectura, solo visualización. El cliente crea y edita sus documentos en Drive directamente, no en la plataforma. Cuando solicite un consentimiento, selecciona cuáles embeber de esta lista.

**Card: Consentimientos** — lista de consentimientos que el cliente ha configurado. Cada uno tiene título, texto, y si es obligatorio o voluntario por defecto. Puede crear nuevos, editar, activar/desactivar.

**Botón: Solicitar consentimiento** — abre el formulario.

---

## 5. Solicitar consentimiento (single sign)

Tres modos:

### Modo 1: Persona natural (natural_personal)
Nombre, apellido, tipo doc (CC/CE/PA/PEP/PPT), número, email, teléfono.

### Modo 2: Con representante (natural_tutor)

Persona que firma a través de un representante legal. Aplica a:
- Menores de edad (Ley 1098/2006 + Art. 12 Ley 1581/2012)
- Adultos con discapacidad cognitiva
- Personas en interdicción
- Adultos mayores con curador

**Datos del representado:**
- Nombre, apellido
- Tipo doc: CC/CE/PA/PEP/PPT/TI/RC
- Número
- Fecha de nacimiento (obligatoria si TI o RC, opcional en los demás)

**Datos del representante legal:**
- Nombre, apellido
- Tipo doc: CC / CE / PA
- Número
- Calidad (madre, padre, tutor legal, representante legal, curador)
- Email (a donde llega el enlace)
- Teléfono (a donde llega el SMS OTP)

El OTP va al representante, nunca al representado. Verificar la relación representante-representado es responsabilidad del cliente, no de la plataforma.

En el PDF: "Firmado por [representante], en calidad de [calidad] de [nombre representado]."

### Modo 3: Persona jurídica (juridica)
Razón social, NIT, email contacto, teléfono, nombre firmante, apellido, tipo doc (CC/CE/PA/PEP/PPT), número, cargo.

### Luego (todos los modos)

**Seleccionar documentos a embeber** — el cliente ve sus archivos de Drive y elige cuáles incluir.

**Seleccionar consentimientos** — lista con dos columnas de checkboxes:
- **Incluir:** cuáles aplican para esta solicitud
- **Obligatorio:** obligatoriedad para esta solicitud (voluntarios pueden cambiarse a obligatorios si el caso lo requiere)

**Expiración del enlace** (horas/días).

Enviar → el firmante recibe email con enlace.

---

## 6. Experiencia del firmante

1. Abre enlace del email → verificación factor 1 (acceso al email). Se registra IP, user agent, timestamp.
2. Ve sus datos (pre-llenados, read-only).
3. Lee documentos embebidos (iframe desde Drive del cliente, nunca pasan por la plataforma).
4. Marca consentimientos (checkbox "Leí y acepto", nunca prellenado). Los obligatorios impiden continuar.
5. Recibe OTP por SMS desde el número del cliente → ingresa 6 dígitos → verificación factor 2.
6. Ve confirmación: tabla con código, decisión, folio, hash por cada consentimiento.

---

## 7. Después de firmar

1. Se genera PDF (pdf-lib): documentos + datos firmante + evidencia + cada consentimiento con folio y hash + hash global
2. Se sube al Drive del cliente
3. Se agrega fila al Google Sheet de historial (fecha, firmante, documento, consentimientos, folio, hash, link PDF)
4. Se envía copia al firmante por email (desde la cuenta del cliente)
5. Se registra en audit_log
6. Se limpian datos personales de memoria (signing_sessions_temp se borra)
7. signing_sessions_results queda solo con hashes y folios
