# Flujos

## 1. Registro del cliente

**Paso 1 — Tipo:** persona natural o jurídica.

**Paso 2 — Datos:**
- Natural: nombre, apellido, tipo doc, número, email, teléfono
- Jurídica: razón social, NIT, email empresa, teléfono empresa, nombre firmante, apellido, cargo, tipo doc, número

**Paso 3 — Consentimiento de servicio:** acepta términos de la plataforma + verificación OTP por email (Fase 1-2) o SMS/WhatsApp (Fase 3) al teléfono que dio. Se registra y queda logueado.

---

## 2. Login

Email → OTP por email (SMTP propio de Supabase Auth) → verifica → dashboard (o panel admin si tiene platform_role).

---

## 3. Onboarding (primera vez)

1. **Nube:** conecta Google Drive o OneDrive vía OAuth → selecciona carpeta → se crea el Google Sheet de historial automáticamente. Todo en la nube, sin opción local.
2. **SMS Gateway (Fase 3):** descarga app Android (QR) → escanea QR de configuración (API key + HMAC secret + URL encriptados) → test SMS de prueba.
3. **WhatsApp Business (Fase 3):** configura phone_number_id, waba_id, access_token desde su cuenta de Meta Business → test mensaje de prueba.

---

## 4. Dashboard

**Card: Documentos** — muestra los archivos que el cliente tiene en su Drive conectado. Solo lectura, solo visualización. El cliente crea y edita sus documentos en Drive directamente, no en la plataforma. Cuando solicite un consentimiento o firma, selecciona cuáles usar de esta lista.

**Card: Consentimientos** — lista de consentimientos que el cliente ha configurado. Cada uno tiene título, texto, y si es obligatorio o voluntario por defecto. Puede crear nuevos, editar, activar/desactivar.

**Card: Plantillas de firma (Fase 2)** — lista de plantillas reutilizables del editor visual. Muestra conteo vs límite del plan. Crear, editar, activar/desactivar.

**Botón: Solicitar consentimiento** — abre el formulario de consentimiento (consentimiento-solicitar.html).

**Botón: Solicitar firma (Fase 2)** — abre el formulario de firma electrónica (documento-solicitar.html).

---

## 5. Solicitar consentimiento — modo consentimiento (single sign)

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

## 6. Experiencia del firmante — modo consentimiento

1. Abre enlace del email → verificación factor 1 (acceso al email). Se registra IP, user agent, timestamp.
2. Ve sus datos (pre-llenados, read-only).
3. Lee documentos embebidos (iframe desde Drive del cliente, nunca pasan por la plataforma).
4. Marca consentimientos (checkbox "Leí y acepto", nunca prellenado). Los obligatorios impiden continuar.
5. Recibe OTP por email del cliente (Gmail/Graph, zero-knowledge) en Fase 1-2, o elige SMS/WhatsApp (Fase 3) → ingresa 8 dígitos → verificación factor 2.
6. Ve confirmación: tabla con código, decisión, folio, hash por cada consentimiento.

---

## 7. Después de firmar — modo consentimiento

1. Se genera PDF (pdf-lib): documentos + datos firmante + evidencia + cada consentimiento con folio y hash + hash global
2. Se sube al Drive del cliente
3. Se agrega fila al Google Sheet de historial (fecha, firmante, documento, consentimientos, folio, hash, link PDF)
4. Se envía copia al firmante por email (desde la cuenta del cliente)
5. Se registra en audit_log
6. Se limpian datos personales de memoria (signing_sessions_temp se borra)
7. signing_sessions_results queda solo con hashes y folios

---

## 8. Crear/editar plantilla de firma (Fase 2)

1. Cliente abre "Plantillas de firma" en el dashboard.
2. Clic en "Nueva plantilla" (si está bajo el límite del plan).
3. Selecciona PDF de Drive como documento base.
4. Se abre el editor visual (documento-editor.html) con el PDF renderizado.
5. Arrastra campos sobre las páginas: firma, fecha, iniciales, checkbox, texto libre.
6. Configura cada campo: etiqueta, obligatorio sí/no, posición, tamaño.
7. Nombra la plantilla → guardar. Se almacena en `signing_templates`.
8. Plantilla disponible para futuras solicitudes de firma.

---

## 9. Solicitar firma — modo documento (Fase 2)

Mismos tres modos de firmante que consentimiento:

### Modo 1: Persona natural (natural_personal)
Nombre, apellido, tipo doc, número, email, teléfono.

### Modo 2: Con representante (natural_tutor)
Datos del representado + datos del representante legal (idéntico al flujo de consentimiento).

### Modo 3: Persona jurídica (juridica)
Razón social, NIT, email, teléfono, nombre firmante, apellido, tipo doc, número, cargo.

### Luego (todos los modos)

**Seleccionar documento de Drive** — el cliente elige el PDF a firmar.

**Configurar campos:**
- **Opción A:** seleccionar plantilla existente (si tiene slots disponibles y existe una plantilla compatible).
- **Opción B:** configurar campos manualmente (drag & drop en el editor).
- **Opción C:** guardar la configuración actual como nueva plantilla (si está bajo el límite del plan).

**Expiración del enlace** (horas/días).

Enviar → el firmante recibe email con enlace.

---

## 10. Experiencia del firmante — modo documento (Fase 2)

1. Abre enlace del email → verificación factor 1 (acceso al email). Se registra IP, user agent, timestamp.
2. Ve sus datos (pre-llenados, read-only).
3. Ve el PDF renderizado con los campos posicionados por el cliente:
   - **Firma:** abre pad de firma (dibujar o escribir).
   - **Fecha:** auto-poblada con fecha actual.
   - **Iniciales:** caja de texto corta.
   - **Checkbox:** marcar/desmarcar.
   - **Texto libre:** campo de input.
4. Todos los campos obligatorios deben estar completos para continuar.
5. Recibe OTP por email del cliente (Gmail/Graph, zero-knowledge) en Fase 1-2, o elige SMS/WhatsApp (Fase 3) → ingresa 8 dígitos → verificación factor 2.
6. Ve confirmación: resumen del documento firmado con hash.

---

## 11. Después de firmar — modo documento (Fase 2)

1. Se genera PDF (pdf-lib): documento original + campos aplicados (flattened) + evidencia + hash global
2. Se sube al Drive del cliente
3. Se agrega fila al Google Sheet de historial
4. Se envía copia al firmante por email (desde la cuenta del cliente)
5. Se registra en audit_log
6. Se limpian datos personales de memoria (signing_sessions_temp se borra)
7. signing_sessions_results queda solo con hashes y folios
