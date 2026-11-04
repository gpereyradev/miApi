# Trabajo en Inventra

Este repositorio y `gpereyradev/appInventario` forman una sola aplicación. Consulta
`SECURITY.md` antes de revisar autenticación, permisos, stock, exportaciones o despliegue.

## Revisión de seguridad

- Usa la skill `security-audit` de Cloudflare cuando la tarea incluya seguridad.
- Aplica revisión enfocada por defecto. Una auditoría completa requiere una solicitud
  explícita y el flujo completo de la skill, con verificación independiente.
- Revisa también las rutas JSON de compatibilidad `/productos`, además de `/api`.
- Conserva la autenticación por cookie HttpOnly, los roles del servidor y la revocación.
- Conserva transacciones, bloqueos, idempotencia y la reversión auditable del Kardex.
- Clasifica por separado fallos comprobados, candidatos pendientes y refuerzos.
- No ejecutes pruebas ofensivas ni generes datos de prueba en Render o Neon publicados.
- Ejecuta código objetivo solo con aislamiento OS, sin red externa, con ambiente
  permitido explícitamente, fuentes de solo lectura y recursos limitados. Si falta
  ese aislamiento, limita la revisión a fuentes y declara la validación pendiente.
- No leas ni incluyas `.env`, credenciales, tokens o datos privados en los resultados.

La referencia de la skill se encuentra en
https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit

