# Convenciones de Código

Cada capa tiene una sola responsabilidad:

```
tokens.css          → Define el vocabulario visual (variables)
     ↓
componentes.css     → Construye componentes reutilizables con esos tokens
     ↓
pages/*.html        → Estructura DOM pura, usa clases de componentes.css
     ↓                 (1 HTML = 1 vista de usuario)
js/compartidos      → Lógica reutilizable (auth, fetch, utils, modales)
     ↓
js/de-página        → Lógica específica de cada vista
                       (1 JS = 1 página = 1 vista de usuario)
```

---

## CSS: tokens.css + componentes.css

### tokens.css

Variables del design system. Cero colores hardcodeados en ningún archivo; todo se referencia por token.

Categorías definidas, **valores pendientes de decidir:**

| Categoría | Ejemplo de nomenclatura |
|---|---|
| Colores | --color-{nombre} |
| Variantes | --color-{nombre}-{opacidad} (no hex nuevo) |
| Semánticos | --color-exito, --color-alerta, --color-progreso |
| Tipografía | --font-titulos, --font-cuerpo, --font-datos |
| Tamaños | --text-xs a --text-3xl |
| Espaciado | --spacing-xs a --spacing-2xl |
| Bordes/sombras | --radius-sm/md/lg, --shadow-sm/md |

### componentes.css

Clases reutilizables para botones, inputs, cards, badges, tablas, toggles, chips, modales.

- Toda clase reutilizable va aquí, nunca inline en páginas.
- `[hidden] { display: none !important; }` garantiza que `el.hidden = true/false` en JS siempre funcione, incluso sobre display: flex/grid.
- Estados semánticos (exito, alerta, progreso) usan tokens, no colores directos.

---

## Pages (pages/*.html)

Cada archivo HTML corresponde a una vista/pantalla concreta:

| Archivo | Vista del usuario | Quién la ve |
|---|---|---|
| login.html | Inicio de sesión OTP email | Clientes |
| registro.html | Registro con SMS OTP | Clientes nuevos |
| onboarding.html | Configurar SMS gateway + nube | Clientes primera vez |
| dashboard.html | Panel del cliente | Clientes activos |
| solicitar.html | Formulario solicitar consentimiento (3 modos) | Clientes activos |
| firma.html | Firma electrónica (link desde email) | Firmantes |

### Reglas HTML

- Solo estructura y DOM. Cero lógica, cero `<script>` inline con código.
- Cada página carga sus JS con `<script src="../js/...">` al final del body.
- Cada página incluye Google Fonts via `<link>`, marca-barra (colores del design system), y skip link de accesibilidad.
- Inputs con `<label for="id">`, `aria-required`, `aria-describedby` para errores.
- Formularios con `novalidate` — la validación es en JS, no nativa del browser.

---

## JS: compartidos

Usados por 2+ páginas.

| Archivo | Responsabilidad |
|---|---|
| config.js | URL de Supabase, anon key (datos públicos, nunca secrets) |
| supabase-client.js | Init Supabase, auth helpers, wrappers de fetch |
| utils.js | Toasts, validación, formato, helpers UI |
| otp-ui.js | Lógica OTP parametrizada (inputs, timer, paste, reenvío) |
| modales.js | Abrir/cerrar/vincular modales |

## JS: de página

1 archivo = 1 página = 1 vista de usuario.

| Archivo | Página |
|---|---|
| login.js | login.html |
| registro.js | registro.html |
| onboarding.js | onboarding.html |
| dashboard.js | dashboard.html |
| solicitar.js | solicitar.html |
| firma.js | firma.html |

### Orden de carga

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../js/config.js"></script>
<script src="../js/supabase-client.js"></script>
<script src="../js/utils.js"></script>
<!-- compartidos específicos si aplica -->
<script src="../js/[pagina].js"></script>
```

### Convenciones JS

**Naming:** inglés con snake_case (`get_session`, `on_click_submit`, `show_error`).

**Obligatorio:**
- `check_session()` antes de queries a Supabase. Excepto firmante que usa access_token.
- No queries directas desde funciones de UI — siempre por helpers en supabase-client.js.
- `show_error()` siempre en catch. Nunca catch vacío, nunca solo console.log.
- Botones async: disable + texto "Saving..."/"Sending..." + rehabilitar en `finally`.
- Debounce 300ms en búsquedas.
- Max 50 líneas por función. Si crece, dividir.
- `const` por defecto, `let` solo si se reasigna, `var` prohibido.

---

## Edge Functions (supabase/functions/)

| Función | Responsabilidad |
|---|---|
| otp-service | Enviar y verificar OTP (email y SMS) |
| consent-service | Crear sesiones de firma, procesar consentimientos |
| drive-service | Listar archivos, subir PDF, actualizar Sheet |
| pdf-generator | Generar PDF con pdf-lib |

### Convenciones Edge Functions

- TypeScript/Deno. Imports con URLs o import maps.
- Toda función usa `service_role` para operaciones en BD (bypasea RLS).
- `ENCRYPTION_KEY` se lee de `Deno.env.get('ENCRYPTION_KEY')` y se pasa como parámetro a encrypt_secret/decrypt_secret.
- Validar input al inicio. Retornar 400 con mensaje claro si falla.
- Response: `{ ok: true, data }` o `{ ok: false, error: "mensaje" }`.
- Log con contexto: `console.error({ fn, error, input })`.
- No almacenar datos del firmante fuera de signing_sessions_temp.

---

## No aplica (del proyecto anterior)

| Archivo | Por qué no aplica |
|---|---|
| gas-client.js | GAS eliminado. Todo es Supabase Edge Functions. |
| labels.js | No hay labels compartidos. |
| consentimientos.js | Dinámicos por org (consent_items en BD), no hardcoded C1-C7. |
| mi-expediente.html | No existe en FirmaConsent. |
| accesos.html | No existe en FirmaConsent. |
