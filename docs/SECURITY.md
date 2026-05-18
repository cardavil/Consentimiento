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
- org_oauth: access_token, refresh_token
- org_sms_config: api_key, hmac_secret

**Manejo de la llave:**
- La llave simétrica vive como Supabase Secret (`ENCRYPTION_KEY`)
- La Edge Function la pasa como parámetro a las funciones SQL
- La llave nunca se almacena en la BD ni en pg_settings
- Funciones helper: `encrypt_secret(plaintext, key)` y `decrypt_secret(ciphertext, key)`, ambas SECURITY DEFINER

---

## Patrón service_role

Operaciones sensibles pasan exclusivamente por Edge Functions con service_role (que bypasea RLS). El frontend con anon key NO puede:

- Insertar organizaciones (registro)
- Insertar/leer/actualizar OTPs
- Crear sesiones de firma
- Generar folios
- Escribir en audit_log

Esto previene que un atacante con la anon key (pública en el frontend) pueda insertar datos falsos o consultar información sensible.

---

## SMS Gateway — 5 capas de seguridad

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

---

## Cadena de evidencia por cada firma

1. Token generado
2. Email enviado
3. Enlace abierto — factor 1 (IP, user agent, hora)
4. Documentos vistos
5. Consentimientos marcados
6. OTP SMS enviado
7. OTP verificado — factor 2 (IP, hora)
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
| Un cliente ve datos de otro | RLS con organization_id |
| Interceptan el OTP | HMAC + anti-replay + HTTPS |
| Hackean la plataforma | No hay documentos ni datos personales que robar |
| El firmante dice "yo no firmé" | Evidencia forense: IP, user agent, timestamps, hashes |
| Consentimiento sin representante válido | Formulario obliga datos del representante legal y su calidad |
| Atacante usa anon key para insertar datos | INSERT bloqueado en tablas críticas, solo service_role |
| Atacante consulta OTPs con anon key | otp_tokens sin policies RLS, solo service_role |
| Tokens OAuth expuestos en BD | Encriptados con pgcrypto (pgp_sym_encrypt) |

---

## Marco legal colombiano

| Norma | Qué dice |
|---|---|
| Ley 527/1999 | Firma electrónica válida si es confiable e identifica a la persona |
| Decreto 2364/2012 | Firma electrónica simple = misma validez que manuscrita |
| Ley 1581/2012 | Protección de datos. La plataforma es encargado del tratamiento, no responsable |
| Ley 1098/2006 | Menores de edad requieren firma del representante legal |
| Decreto 1377/2013 | Consentimiento previo, expreso, informado, verificable con fecha y hora |
