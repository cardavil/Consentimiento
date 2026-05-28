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

## 2026-05-28 — Sesión: compactar tipografía y dashboard admin

### Violación 9: h2 y h3 quedaron idénticos — romper jerarquía sin auditar
**Qué pasó:** Al cambiar h1 de text-3xl a text-2xl y h2 de text-2xl a text-xl, Claude no verificó que h3 ya usaba text-xl. Resultado: h2 y h3 quedaron con el mismo tamaño (20px) y margin, perdiendo toda distinción visual.
**Por qué está mal:** Cada cambio en cascada debe auditarse. Cambiar h2 sin verificar h3 es modificar sin auditar el impacto completo.

### Violación 10: Formato de plan inconsistente — 4 rechazos consecutivos
**Qué pasó:** El usuario pidió un plan y Claude lo presentó en 4 formatos distintos: primero excesivamente detallado con tablas enormes, luego demasiado minimalista sin tabla, luego con tabla pero sin contexto, luego con tabla pero "monstruoso". El usuario tuvo que rechazar 4 veces antes de obtener un formato aceptable.
**Por qué está mal:** Claude debe mantener un formato consistente para los planes: contexto breve + tabla antes/después + archivos a modificar. No cambiar el formato radicalmente en cada intento.

### Violación 11: No entender el problema del usuario — insistir con solución equivocada
**Qué pasó:** El usuario señaló que los nombres de página se repiten 3 veces (tab navegador, header, nav tab). Claude propuso repetidamente quitar el nombre del header. El usuario dijo "NO", "ese no es el problema", "el titulo es el problema, se logico". Claude no logró entender qué quería el usuario y tuvo que pedir que lo explicara.
**Por qué está mal:** Claude se fijó en una solución (quitar del header) en vez de escuchar al usuario. Cuando el usuario dice "no es el problema", hay que detenerse y preguntar, no insistir con la misma propuesta.

### Violación 12: Alucinar estado de la UI sin verificar
**Qué pasó:** Claude describió cómo se veía la página de Indicadores sin verificar el estado real. El usuario dijo "alucinas! indicadores no se ve asi". Claude tuvo que leer el HTML para confirmar el estado actual.
**Por qué está mal:** Antes de describir cómo se ve algo, leer el código. No reconstruir de memoria lo que debería ser.

---

## Lecciones

1. **Plan aprobado en sesión anterior ≠ autorización en sesión nueva.** Siempre re-confirmar.
2. **Cambios "derivados" o "implícitos" no existen.** Todo cambio se presenta y se autoriza.
3. **Una observación del usuario no es una orden.** "Debería ser X" ≠ "hazlo".
4. **Nunca asumir el propósito de datos.** Preguntar antes de eliminar o modificar.
5. **Nunca commitear sin autorización.** El commit es una acción irreversible en producción.
6. **Ante la duda, presentar el plan.** El costo de preguntar es cero. El costo de actuar sin permiso puede ser alto.
7. **Auditar el impacto completo de cada cambio en cascada.** Si cambias h2, verifica h3.
8. **Formato de plan consistente.** Contexto breve + tabla antes/después + archivos. No cambiar formato entre intentos.
9. **Cuando el usuario dice "no es el problema", detenerse y escuchar.** No insistir con la misma solución.
10. **Nunca describir UI de memoria.** Leer el código antes de afirmar cómo se ve algo.
