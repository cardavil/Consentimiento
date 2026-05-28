# Consentia Gateway (Android SMS gateway — Fase 3)

App nativa que recibe peticiones HTTPS de Consentia y envía los OTP por SMS desde la
SIM del cliente. Corre como **foreground service** con auto-inicio en boot.

## Arquitectura

```
otp-service (Edge Function)
  └─ POST {to,message,timestamp,nonce,signature}  ──►  Cloudflare Tunnel  ──►  HttpServer (NanoHTTPD :8080)
                                                                                  └─ 5 capas de seguridad ─► SmsManager
```

- `MainActivity` — vincular (escanear QR), activar/desactivar, estado.
- `GatewayService` — foreground service que mantiene vivo el servidor HTTP.
- `BootReceiver` — reinicia el gateway tras reiniciar el teléfono.
- `HttpServer` (NanoHTTPD) — `POST /send`, valida las 5 capas y envía el SMS.
- `security/Security.kt` — API key (constant-time), timestamp ±30s, nonce anti-replay, HMAC-SHA256, rate limit.
- `SmsSender` — `SmsManager` nativo (multipart).
- `PairingStore` — `EncryptedSharedPreferences` (api_key + hmac_secret).

## Contrato HTTP (debe coincidir con `_shared/channels/sms.ts`)

`POST /send` · header `x-api-key: <api_key>` · body JSON:
```json
{ "to": "+57300...", "message": "Tu codigo Consentia: 12345678", "timestamp": 1717000000, "nonce": "uuid", "signature": "hmac_sha256_hex" }
```
Cadena firmada (HMAC-SHA256, hex): `to|message|timestamp|nonce`.

## Puesta en marcha

1. **Compilar:** abrir `android/` en Android Studio (o `./gradlew assembleRelease`). Min SDK 26.
2. **Exponer el servidor:** en el teléfono (o vía adb reverse en pruebas) levantar Cloudflare Tunnel:
   `cloudflared tunnel --url http://localhost:8080` → entrega una URL pública.
3. **Onboarding (web):** en *Conectar nube → SMS por app Android*, poner la URL del tunnel + `/send`,
   generar API key + HMAC, guardar. Se muestra el JSON de vinculación.
4. **Vincular la app:** generar un QR a partir de ese JSON y escanearlo en *Escanear QR de vinculación*.
5. **Activar gateway** y conceder permisos de SMS/notificaciones.

## Limitaciones conocidas
- El onboarding muestra el JSON de vinculación como texto; falta renderizar el QR (pendiente).
  Mientras tanto, generar el QR del JSON con cualquier herramienta o agregar entrada manual a la app.
- Empaquetado/firma para Play Store: operativo, fuera de este repositorio.
