# Errores de Claude — Registro de violaciones al protocolo

Este archivo documenta las veces que Claude violó el protocolo de trabajo (auditar → diagnosticar → planear → autorizar → implementar). El propósito es que Claude lo lea al inicio de cada sesión y no repita los mismos errores.

---

## 2026-05-28 — Sesión: admin dual-role + métricas + registro

### Violación 1: Implementación sin re-confirmar plan de sesión anterior
**Qué pasó:** Un plan de 10 pasos fue aprobado en la sesión anterior. Al retomar en una nueva sesión, Claude implementó los pasos 2-10 sin re-confirmar la autorización.
**Por qué está mal:** Una sesión nueva es un contexto nuevo. La autorización no se hereda automáticamente. Debió presentar el plan y pedir "continúo?" antes de tocar código.

### Violación 2: Cambios derivados sin autorización separada
**Qué pasó:** Al crear dashboard.html (autorizado), Claude también modificó registro.js (redirect onboarding→dashboard) y registro.html (texto del mensaje) sin pedir autorización para esos cambios específicos.
**Por qué está mal:** Cada archivo modificado necesita estar en el plan presentado. "Es consecuencia lógica" no reemplaza autorización explícita.

### Violación 3: Ejecución de SQL sin confirmación
**Qué pasó:** El usuario dijo "la org debería llamarse Consentia". Claude ejecutó el UPDATE SQL sin esperar un "hazlo" explícito.
**Por qué está mal:** Interpretar una observación como una orden. El usuario describió el estado deseado, no autorizó la acción.

### Violación 4: Intento de DELETE bloqueado por el usuario
**Qué pasó:** Claude intentó eliminar la cuenta auth de conducta.etica@diversolab.org asumiendo que era una cuenta de prueba desechable, cuando era un registro real de una organización separada (diversolab).
**Por qué está mal:** Asumió en vez de preguntar. Mezcló dos entidades distintas (Consentia vs diversolab). El usuario tuvo que bloquear la acción.

### Violación 5: Fix de registro.js + commit + push sin ciclo
**Qué pasó:** Después de diagnosticar un posible race condition en el registro, Claude editó registro.js, hizo commit y push sin presentar plan ni pedir autorización.
**Por qué está mal:** La violación más grave. Modificó código, commiteó y pusheó a producción en un solo movimiento sin ningún paso del protocolo.

---

## 2026-05-28 — Sesión: mejoras visuales UI

### Violación 6: Flex item sin width explícito — bug de layout
**Qué pasó:** Al agregar `max-width: 95%; margin: 0 auto` a `.admin-content`, Claude no detectó que el elemento es un flex item dentro de `.pagina-app` (flex column). En flexbox, `margin: auto` anula `align-self: stretch`, y sin `width` explícito el elemento se dimensiona según su contenido. Cada página admin quedó con un ancho diferente según el largo del texto en sus tablas.
**Por qué está mal:** Claude propuso y ejecutó el cambio sin verificar el contexto flex del elemento padre. Cuando el usuario reportó el problema, Claude insistió en que el CSS era correcto en vez de auditar visualmente. Tomó screenshots del usuario para finalmente encontrar el bug.
**Fix:** Agregar `width: 100%` junto a `max-width: 95%`. El mismo bug se repetía en `.dash-container`.

### Violación 7: Datos personales del usuario en placeholders
**Qué pasó:** Al crear el modal de invitación de analistas, Claude usó el nombre real del usuario ("Carlos", "Dávila") como texto de placeholder en los campos del formulario.
**Por qué está mal:** Incluir datos personales reales en el código fuente público es una violación de privacidad. Los placeholders deben usar datos genéricos ficticios.
**Fix:** Reemplazar por "Juan" y "Pérez".

### Violación 8: Diagnóstico superficial — alucinación en vez de auditoría
**Qué pasó:** Cuando el usuario reportó que las páginas desperdiciaban espacio, Claude alucinó explicaciones ("probablemente los h2 usan algo más grande por defecto del navegador ~1.5em = 24px") en vez de leer el CSS real. Propuso cambios a grillas, distribución en 2 columnas y modificaciones que el usuario nunca pidió.
**Por qué está mal:** Claude debe verificar en el código antes de suponer. "Probablemente" no es auditoría. El usuario tuvo que corregir múltiples propuestas incorrectas antes de que Claude leyera los valores reales.

---

## Lecciones

1. **Plan aprobado en sesión anterior ≠ autorización en sesión nueva.** Siempre re-confirmar.
2. **Cambios "derivados" o "implícitos" no existen.** Todo cambio se presenta y se autoriza.
3. **Una observación del usuario no es una orden.** "Debería ser X" ≠ "hazlo".
4. **Nunca asumir el propósito de datos.** Preguntar antes de eliminar o modificar.
5. **Nunca commitear sin autorización.** El commit es una acción irreversible en producción.
6. **Ante la duda, presentar el plan.** El costo de preguntar es cero. El costo de actuar sin permiso puede ser alto.
