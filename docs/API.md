# API REST

Para integraciones externas. **Post-MVP.** Los clientes usan el dashboard durante el MVP. La API se construye cuando haya demanda de integraciones.

---

## Solicitar consentimiento

```
POST /api/v1/consent/request
```

**Request:**
```json
{
  "signer_type": "natural" | "natural_represented" | "juridica",
  "signer": {
    "nombre": "",
    "apellido": "",
    "tipoDoc": "",
    "numero": "",
    "email": "",
    "telefono": ""
  },
  "representative": { },
  "documents": ["drive_file_id"],
  "consents": [
    { "id": "uuid", "required": true }
  ],
  "expiresInHours": 72,
  "context": "Programa X"
}
```

- `representative` solo si signer_type = "natural_represented"
- `documents` son IDs de archivos del Drive del cliente
- `consents[].required` puede sobrescribir la obligatoriedad por defecto

**Response:**
```json
{
  "sessionId": "uuid",
  "signingUrl": "https://...",
  "expiresAt": "2026-05-20T12:00:00Z",
  "status": "pending"
}
```

---

## Consultar estado

```
GET /api/v1/consent/status/{sessionId}
```

**Response:**
```json
{
  "status": "completed",
  "completedAt": "2026-05-18T14:30:00Z",
  "pdfHash": "sha256...",
  "consents": {
    "C1": { "accepted": true, "folio": "CT-C1-2026-0001", "hash": "sha256..." },
    "C2": { "accepted": false, "folio": null, "hash": null }
  }
}
```

---

## Endpoints planificados — Modo firma (Post-MVP)

Estructura tentativa. Se definirá cuando se implemente la API.

```
POST /api/v1/signing/request
```
Similar a consent/request pero con session_type: "signature". Incluye template_id (opcional) o array de campos inline. Mismos modos de firmante.

```
GET /api/v1/signing/status/{sessionId}
```
Similar a consent/status.

```
GET /api/v1/templates
POST /api/v1/templates
```
CRUD de plantillas de firma.
