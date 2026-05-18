# API REST

Para integraciones externas. Fase 3 del roadmap.

---

## Solicitar consentimiento

```
POST /api/v1/consent/request
```

**Request:**
```json
{
  "mode": "natural_personal" | "natural_tutor" | "juridica",
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

- `representative` solo si mode = "natural_tutor"
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
    "C1": { "accepted": true, "folio": "FC-C1-2026-0001", "hash": "sha256..." },
    "C2": { "accepted": false, "folio": null, "hash": null }
  }
}
```
