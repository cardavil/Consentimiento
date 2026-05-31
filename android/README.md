# Consentia Gateway (Android SMS gateway — Fase 3)

App nativa que recibe peticiones HTTPS de Consentia y envía los OTP por SMS desde la
SIM del cliente. Corre como **foreground service** con auto-inicio en boot.

## Arquitectura

```
otp-service (Edge Function)
  └─ POST {to,message,timestamp,nonce,signature}  ──►  Cloudflare Tunnel  ──►  HttpServer (NanoHTTPD :8080)
                                                                                  └─ 5 capas de seguridad ─► SmsManager
```

- `LoginActivity` — **launcher**; login email+OTP contra GoTrue (mismo backend que la web). Exige que
  el usuario sea un inscrito (`tenant_id` en `app_metadata`). Sin sesión válida no se llega a la config.
- `MainActivity` — vincular (escanear QR), activar/desactivar, estado, cerrar sesión.
- `GatewayService` — foreground service que mantiene vivo el servidor HTTP.
- `BootReceiver` — reinicia el gateway tras reiniciar el teléfono.
- `HttpServer` (NanoHTTPD) — `POST /send`, valida las 5 capas y envía el SMS.
- `security/Security.kt` — API key (constant-time), timestamp ±30s, nonce anti-replay, HMAC-SHA256, rate limit.
- `SmsSender` — `SmsManager` nativo (multipart).
- `PairingStore` — `EncryptedSharedPreferences` (api_key + hmac_secret + sesión: access/refresh token, email, tenant_id).

## Contrato HTTP (debe coincidir con `_shared/channels/sms.ts`)

`POST /send` · header `x-api-key: <api_key>` · body JSON:
```json
{ "to": "+57300...", "message": "Tu codigo Consentia: 12345678", "timestamp": 1717000000, "nonce": "uuid", "signature": "hmac_sha256_hex" }
```
Cadena firmada (HMAC-SHA256, hex): `to|message|timestamp|nonce`.

## Puesta en marcha

1. **Compilar:** abrir `android/` en Android Studio (o `./gradlew assembleRelease`). Min SDK 26.
   `SUPABASE_URL`/`SUPABASE_ANON_KEY` se inyectan vía `buildConfigField` (de `frontend/js/config.js`).
2. **Iniciar sesión:** abrir la app → login email+OTP. Usa un correo de inscrito (con `tenant_id`);
   recibe el código por correo y verifica. La sesión persiste entre aperturas; "Cerrar sesión" la borra.
3. **Exponer el servidor:** en el teléfono (o vía adb reverse en pruebas) levantar Cloudflare Tunnel:
   `cloudflared tunnel --url http://localhost:8080` → entrega una URL pública.
4. **Onboarding (web):** en *Canales 2FA → SMS por app Android*, poner la URL del tunnel + `/send`,
   *Generar API key + HMAC*, guardar. Se renderiza un **QR** con `{api_key, hmac_secret}` (y el JSON como fallback).
5. **Vincular la app:** *Escanear QR de vinculación* y apuntar al QR de la web.
6. **Activar gateway** y conceder permisos de SMS/notificaciones.

## Limitaciones conocidas
- Refresh de token: si la sesión expira, hay que volver a iniciar sesión (refresh con
  `grant_type=refresh_token` queda como mejora opcional).
- Empaquetado/firma para Play Store: operativo, fuera de este repositorio.
