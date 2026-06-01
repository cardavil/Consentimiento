# Seguridad

## Arquitectura zero-knowledge

La plataforma NO almacena:
- Documentos del cliente (viven en su Drive)
- Datos personales del firmante (pasan por signing_sessions_temp y se borran)
- Contenido de consentimientos (viven en consent_items del cliente)
- Códigos OTP en claro (solo code_hash)

Solo se guardan: hashes SHA-256, folios, metadatos operativos.

---

## Encriptación at-rest (pgcrypto)

Tokens OAuth y secrets del SMS gateway se encriptan en la BD con pgp_sym_encrypt/pgp_sym_decrypt (pgcrypto). pgcrypto es estándar PostgreSQL, ya cargado en el schema, sin dependencia de features específicos de Supabase.

**Columnas encriptadas (BYTEA):**
- tenant_oauth: access_token, refresh_token
- tenant_sms_config: api_key, hmac_secret

**Manejo de la llave:**
- La llave simétrica vive como Supabase Secret (`ENCRYPTION_KEY`)
- La Edge Function la pasa como parámetro a las funciones SQL
- La llave nunca se almacena en la BD ni en pg_settings
- Funciones helper: `encrypt_secret(plaintext, key)` y `decrypt_secret(ciphertext, key)`, ambas SECURITY DEFINER

---

## Patrón service_role

Operaciones sensibles pasan exclusivamente por Edge Functions con service_role (que bypasea RLS). El frontend con publishable key NO puede:

- Insertar inscritos (registro)
- Insertar/leer/actualizar OTPs
- Crear sesiones de firma
- Generar folios
- Escribir en audit_log

Esto previene que un atacante con la publishable key (pública en el frontend) pueda insertar datos falsos o consultar información sensible.

---

## Autenticación de las Edge Functions

El gateway de Supabase (`verify_jwt`) es una capa previa al código, pero **la autenticación real vive en el código de cada handler**. Por eso el `verify_jwt` se configura por función según quién la llama:

**Funciones de cara al firmante** — `otp-service`, `consent-service`, `signing-service` → `verify_jwt:false`. El firmante no tiene cuenta ni sesión (modelo DocuSign: recibe un enlace). El gateway no puede validarlo y la publishable key no es un JWT, así que la auth se hace en el código:
- **Acciones del firmante:** token de sesión de **256 bits** (`signing_sessions_results.access_token` = `encode(gen_random_bytes(32),'hex')`, impredecible) en el header `x-access-token`, más expiración (`token_expires_at`), chequeo de `status` y verificación por OTP.
- **Acciones del inscrito** (crear sesión/plantilla, registro): `require_tenant` (`_shared/auth.ts`) valida el JWT de sesión vía `auth.getUser`.

**Funciones solo emisor/admin** — `drive-service`, `config-service`, `admin-service` → `verify_jwt:true` (siempre llegan con una sesión JWT del inscrito/admin) + auth in-code → defensa en profundidad.

El valor de `verify_jwt` por función se fija en `supabase/config.toml`, así el deploy es determinista (un `supabase functions deploy` sin flags respeta cada valor). Esto sigue la guía oficial de Supabase: el flag `verify_jwt` es incompatible con las nuevas JWT Signing Keys; recomiendan apagarlo y validar en el código.

---

## Migración de API keys (sb_publishable / sb_secret)

Supabase está deprecando las llaves JWT legacy (`anon` / `service_role`, formato `eyJ…`) a favor de llaves opacas `sb_`:

- **Frontend / Android:** ya usan `sb_publishable_*` (header `apikey`).
- **Backend:** `create_admin_client` (`_shared/supabase.ts`) lee `SB_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY` → hoy usa el `service_role` legacy mientras `SB_SECRET_KEY` no esté seteada.
- El prefijo `SUPABASE_` está **reservado**: la nueva secret se expone manualmente como **`SB_SECRET_KEY`** (prefijo `SB_`). Las llaves nuevas **aún no son default** en Edge Functions.
- **No deshabilitar las JWT legacy** hasta crear la `sb_secret`, setearla como `SB_SECRET_KEY`, redesplegar y probar — de lo contrario se rompe el `SUPABASE_SERVICE_ROLE_KEY` auto-inyectado.

---

## Canales de verificación factor 2

El firmante verifica su identidad con un OTP de 8 dígitos enviado por uno de estos canales:

### Email OTP (Fase 1+)

Disponible desde Fase 1. El OTP del **firmante** (factor 2 de la firma) se envía al email del firmante (o del representante en modo natural_represented) via Gmail API / Microsoft Graph del cliente. Mismo principio zero-knowledge: la plataforma no envía emails propios para el firmante.

**OTP de autenticación del cliente** (login/registro de la inscrito): es un canal distinto, sale por el **SMTP propio configurado en Supabase Auth** (email de la plataforma, no del cliente). No aplica zero-knowledge porque es el propio titular de la cuenta quien se autentica. Nunca se usa el SMTP por defecto de Supabase (límite 2/hora).

Largo del OTP: 8 dígitos.

### SMS Gateway — 5 capas de seguridad (Fase 3)

App Android en el teléfono del cliente. Recibe peticiones HTTPS, envía SMS desde la SIM del cliente. Corre en segundo plano (foreground service con auto-inicio).

| Capa | Mecanismo |
|---|---|
| 1 | API Key (comparación constant-time) |
| 2 | Timestamp ±30 segundos |
| 3 | Nonce único (anti-replay) |
| 4 | Firma HMAC-SHA256 del payload |
| 5 | Rate limiting configurable |

**Especificaciones de la app:**
- NanoHTTPD como servidor HTTP
- SmsManager nativo para envío
- Foreground service con auto-inicio
- Vinculación por QR (API key + HMAC secret + URL encriptados)
- Android 8.0+, SIM activa, WiFi
- Comunicación via Cloudflare Tunnel

### WhatsApp Business API (Fase 3)

Cada cliente usa su propia cuenta de WhatsApp Business (nunca una cuenta central de Consentia). El cliente paga su propio canal.

- OTP enviado como template message de WhatsApp al teléfono del firmante
- Access token del cliente encriptado at-rest con pgcrypto (mismo patrón que OAuth tokens)
- HTTPS a Meta API
- Solo template messages (no free-form, previene abuso)
- Rate limits gobernados por Meta per-account (responsabilidad del cliente)
- Zero-knowledge preservado: Consentia almacena config encriptada, mensajes van de WABA del cliente a WhatsApp del firmante

---

## Cadena de evidencia por cada firma

1. Token generado
2. Email enviado
3. Enlace abierto — factor 1 (IP, user agent, hora)
4. Documentos vistos
5. Consentimientos marcados
6. OTP enviado (email en Fase 1-2; email/SMS/WhatsApp en Fase 3 — canal registrado en otp_channel)
7. OTP verificado — factor 2 (IP, hora, canal)
8. PDF generado (hash SHA-256)
9. PDF subido a Drive del cliente
10. Google Sheet actualizado (Historial-{año})
11. Copia enviada al firmante

---

## Amenazas y protección

| Amenaza | Protección |
|---|---|
| Alguien se hace pasar por el firmante | Verificación dual: email + SMS |
| Alteran el PDF después de firmar | Hash SHA-256 + ambas partes tienen copia |
| Cambian un consentimiento | Hash individual + folio + tabla inmutable |
| Un cliente ve datos de otro | RLS con tenant_id |
| Interceptan el OTP | HMAC + anti-replay + HTTPS |
| Hackean la plataforma | No hay documentos ni datos personales que robar |
| El firmante dice "yo no firmé" | Evidencia forense: IP, user agent, timestamps, hashes |
| Consentimiento sin representante válido | Formulario obliga datos del representante legal y su calidad |
| Atacante usa publishable key para insertar datos | INSERT bloqueado en tablas críticas, solo service_role |
| Atacante consulta OTPs con publishable key | otp_tokens sin policies RLS, solo service_role |
| Endpoint del firmante público (verify_jwt:false) | Token de sesión de 256 bits impredecible + expiración + OTP; el OTP se rechaza antes de escribir si la sesión no existe |
| Atacante pide OTP para un firmante ajeno | El email/teléfono destino se deriva de la sesión (no del body); sin `x-access-token` válido no se emite ni escribe nada |
| Acción de inscrito sin sesión válida | `require_tenant` rechaza en código (no depende del gateway) |
| Tokens OAuth expuestos en BD | Encriptados con pgcrypto (pgp_sym_encrypt) |
| WhatsApp account del cliente comprometida | Cada cliente gestiona su propia cuenta; revocación de token independiente |
| Meta API caída o rate limited | Fallback a email OTP; firmante puede cambiar canal |
| Suplantación de número WhatsApp | Template messages verificados por Meta; phone_number_id vinculado a WABA verificado |
| Plantilla de firma manipulada después de creación | Fields almacenados en BD; PDF se genera server-side con pdf-lib; hash del PDF final |

---

## Marco legal colombiano

| Norma | Qué dice |
|---|---|
| Ley 527/1999 | Firma electrónica válida si es confiable e identifica a la persona |
| Decreto 2364/2012 | Firma electrónica simple = misma validez que manuscrita |
| Ley 1581/2012 | Protección de datos. La plataforma es encargado del tratamiento, no responsable |
| Ley 1098/2006 | Menores de edad requieren firma del representante legal |
| Decreto 1377/2013 | Consentimiento previo, expreso, informado, verificable con fecha y hora |
