# Consentia — Documento de Producto

**Versión:** 3.0
**Fecha:** Mayo 2026
**Autor:** CARDAVIL
**Estado:** En desarrollo
**Arquitectura:** Multi-tenant (200+ clientes) · Single sign (1 firmante por solicitud)

---

## Qué es

Plataforma donde empresas (clínicas, consultorios, ONGs) gestionan consentimientos informados y firmas electrónicas con verificación de identidad, evidencia criptográfica, y copia para ambas partes.

**Dos modos, mutuamente excluyentes por solicitud:**
1. **Consentimiento:** documento embebido desde Drive + consentimientos preconfigurados (checkbox "Leí y acepto"). Para compliance, protección de datos, autorizaciones.
2. **Documento (firma electrónica):** editor visual donde el cliente arrastra campos (firma, fecha, iniciales, checkbox, texto libre) sobre un PDF de Drive. Para contratos, actas, formatos propios.

Mezclar ambos modos en una solicitud diluye la naturaleza jurídica de cada uno.

**Multi-tenant:** 200+ empresas usan la misma plataforma. Cada una solo ve lo suyo.

**Single sign:** cada solicitud es para UNA persona. Un firmante, una sesión, un PDF. Si la empresa tiene 10 pacientes hoy, hace 10 solicitudes.

**Zero-knowledge:** los documentos del cliente viven en su Drive. Los datos del firmante pasan por la plataforma pero no se quedan. Solo se guardan hashes y metadatos operativos.

**El producto profesa lo que vende:** el propio registro del cliente usa OTP. La experiencia de registrarse es la demo del servicio.

## Diferenciadores

- Dos modos: consentimiento granular + firma electrónica visual
- Consentimiento con folio y hash SHA-256 por cada punto
- Editor visual drag & drop para firma electrónica con plantillas reutilizables
- Documentos siempre en el Drive del cliente, nunca en la plataforma
- OTP desde el canal del cliente (email; SMS o WhatsApp en Fase 3)
- Copia idéntica del PDF para ambas partes
- Historial automático en Google Sheet en la carpeta del cliente
- Soporte para firma con representante legal (menores, adultos con discapacidad, interdicción, curador)
- Precio accesible para PYMEs colombianas

## Qué NO es

No es firma digital avanzada (con certificado). No sirve para escrituras públicas ni trámites ante la DIAN que exijan firma digital.

## Responsabilidad

La plataforma es la herramienta. El cliente es responsable de:
- El contenido de sus documentos y consentimientos
- La clasificación de obligatoriedad
- Verificar la relación representante-representado
- El cumplimiento normativo de su proceso
- La custodia de sus PDFs

La plataforma es responsable de:
- Que funcione, esté disponible y sea segura
- Que los hashes y folios sean íntegros
- No almacenar datos sensibles innecesariamente
- Que los registros de consentimiento sean inmutables

## Pricing (COP)

| Plan | $/mes | Qué incluye | Plantillas firma |
|---|---|---|---|
| Trial | $0 (30 días) | 10 solicitudes, 2 documentos, email OTP | 0 |
| Basic | $99.000 | 50/mes, 10 docs, email OTP | TBD |
| Pro | $199.000 | 200/mes, docs ilimitados, SMS+WhatsApp OTP, branding | TBD |
| Enterprise | A medida | Ilimitado, soporte, SLA | Ilimitadas |

Sin plantillas disponibles, el cliente configura campos cada vez.

## Mercado

Consultorios, clínicas, IPS (50,000+ en Colombia), centros de estética, laboratorios, centros de psicología, ONGs, fundaciones, centros educativos.

## Roadmap

Las 3 fases son MVP. Todas deben estar completas antes del primer cliente.

### Fase 1 — Consentimiento

1. Schema + migraciones (tablas, RLS, funciones)
2. Edge Functions: otp-service, consent-service, drive-service, pdf-generator
3. Frontend: login, registro, onboarding, dashboard, consentimiento-solicitar, firmar
4. Landing page (iterar UI + data pipeline desde el inicio)
5. Drive/OneDrive integration (OAuth, file picker, preview)
6. Google Sheets historial (particionado por año)
7. PDF con pdf-lib (constancia con evidencia + hashes)

OTP factor 2: email-only en esta fase.

### Fase 2 — Editor visual de firma electrónica

1. Frontend: documento-editor (drag & drop campos sobre PDF renderizado)
2. Frontend: documento-solicitar (formulario solicitar firma)
3. firmar.html se extiende (detecta session_type=firma, renderiza campos)
4. Edge Function: signing-service (sesiones de firma, procesar campos)
5. Plantillas reutilizables (limitadas por plan, TBD)
6. PDF con pdf-lib: documento original + campos aplicados + evidencia

Tipos de campo: firma, fecha, iniciales, checkbox, texto libre.

### Fase 3 — App HTTP para 2FA (SMS + WhatsApp)

1. App Android SMS gateway (NanoHTTPD, SmsManager, foreground service)
2. WhatsApp Business API (cada cliente usa su propia cuenta)
3. Firmante elige canal: SMS o WhatsApp
4. Onboarding extendido: config SMS gateway + config WhatsApp Business
5. Términos de servicio
6. Facturación
7. Play Store

### Post-MVP

- API REST para integraciones externas (los clientes usan dashboard durante el MVP)

## Legal para operar

1. Términos de servicio (con encargado del tratamiento y disclaimer)
2. Política de privacidad
3. Aviso legal en portal del firmante
4. Registro RNBD ante SIC
5. Registro mercantil + RUT + facturación electrónica
6. Consulta jurídica recomendada: $1.5M — $3M COP una vez
