# FirmaConsent — Documento de Producto

**Versión:** 2.3
**Fecha:** Mayo 2026
**Autor:** CARDAVIL
**Estado:** En desarrollo
**Arquitectura:** Multi-tenant (200+ clientes) · Single sign (1 firmante por solicitud)

---

## Qué es

Plataforma donde empresas (clínicas, consultorios, ONGs) envían consentimientos informados a sus clientes/pacientes con verificación de identidad por email + SMS, evidencia criptográfica, y copia para ambas partes.

**Multi-tenant:** 200+ empresas usan la misma plataforma. Cada una solo ve lo suyo.

**Single sign:** cada solicitud de consentimiento es para UNA persona. Un firmante, una sesión, un PDF. Si la empresa tiene 10 pacientes hoy, hace 10 solicitudes.

**Zero-knowledge:** los documentos del cliente viven en su Drive. Los datos del firmante pasan por la plataforma pero no se quedan. Solo se guardan hashes y metadatos operativos.

**El producto profesa lo que vende:** el propio registro del cliente usa SMS OTP. La experiencia de registrarse es la demo del servicio.

## Diferenciadores

- Consentimiento granular con folio y hash SHA-256 por cada punto
- Documentos siempre en el Drive del cliente, nunca en la plataforma
- SMS OTP desde el número del consultorio/empresa del cliente
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

| Plan | $/mes | Qué incluye |
|---|---|---|
| Trial | $0 (30 días) | 10 consentimientos, 2 documentos |
| Basic | $99.000 | 50/mes, 10 docs, email OTP |
| Pro | $199.000 | 200/mes, docs ilimitados, SMS OTP, API, branding |
| Enterprise | A medida | Ilimitado, soporte, SLA |

## Mercado

Consultorios, clínicas, IPS (50,000+ en Colombia), centros de estética, laboratorios, centros de psicología, ONGs, fundaciones, centros educativos.

## Roadmap

**Fase 1 (2-3 sem):** Schema + Edge Functions OTP y consent + frontend registro/firma + SMS OTP.

**Fase 2 (2-3 sem):** Login + onboarding + dashboard (documentos, consentimientos, solicitar consentimiento con 3 modos).

**Fase 3 (2-3 sem):** Drive picker + OneDrive + Sheets historial + PDF con pdf-lib + API REST.

**Fase 4 (2-3 sem):** Landing + términos + facturación + Play Store + primeros 5 clientes.

## Legal para operar

1. Términos de servicio (con encargado del tratamiento y disclaimer)
2. Política de privacidad
3. Aviso legal en portal del firmante
4. Registro RNBD ante SIC
5. Registro mercantil + RUT + facturación electrónica
6. Consulta jurídica recomendada: $1.5M — $3M COP una vez
