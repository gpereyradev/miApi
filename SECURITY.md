# Seguridad de Inventra

Inventra administra un almacén compartido mediante tres roles. Este repositorio
contiene la API y `appInventario` contiene su interfaz. La revisión usa la metodología
de [security-audit de Cloudflare](https://github.com/cloudflare/security-audit-skill),
versión de origen `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`.

## Controles que se deben conservar

- JWT firmado con HS256, vencimiento y comprobación de usuario activo y token_version.
- Cookie HttpOnly y Secure en producción; permisos aplicados en la API.
- Validación de las entradas, restricciones relacionales y exclusión del hash de los perfiles.
- Stock y movimiento dentro de una transacción, con bloqueo del producto.
- Reintentos comparados mediante request_id y correcciones por movimiento inverso.
- Unicidad de revierte_id para impedir dos reversiones de un mismo movimiento.
- React como renderer de los datos y protección de fórmulas en los CSV del frontend.
- Secretos en configuración del servidor; los archivos .env no se publican.

## Adaptación del 4 de noviembre de 2026

Se realizó una revisión enfocada por fuentes de sesiones, roles, rutas heredadas,
Kardex, exportaciones y despliegue. Dos revisiones separadas examinaron autenticación
y stock/frontend; una tercera comprobó el candidato de identificadores internos.
Esto no es una auditoría completa, una prueba de penetración ni una certificación.

En las fuentes revisadas no se estableció un bypass de autenticación o de roles ni
una ruta de XSS. Esta observación no equivale a ausencia de vulnerabilidades.

Se identificaron dos trabajos concretos:

1. **Paridad de rutas heredadas.** `/api` recibe no-store, comprobación de Origin y
   limitación general. Los alias JSON `/productos` mantienen permisos, pero no pasan
   por esos controles comunes. Se recomienda igualarlos conservando el GET HTML que
   abre React. Es un refuerzo; no se demostró explotación CSRF.
2. **Claves internas del Kardex.** Los clientes pueden proporcionar request_id y los
   identificadores de apertura y reversión se derivan de IDs predecibles. La unicidad
   global puede causar interferencia entre ambos usos. El efecto de rechazo y rollback
   requiere reproducción aislada con Sequelize y una base desechable. Es un candidato
   pendiente, sin severidad asignada. La propuesta añade aleatoriedad a las claves
   internas y conserva el contrato de idempotencia de los clientes.

Los cambios de ejecución y sus regresiones deben revisarse en una propuesta aparte.
No se incorporan a producción sin completar la validación correspondiente.

## Límite de validación de esta revisión

El entorno denegó namespaces y chroot, y no dispone de Landlock. No se ejecutó código
objetivo ni se hicieron pruebas de ataque contra la aplicación publicada. No se
acreditan los efectos dinámicos anteriores ni el comportamiento real del proxy de Render.

La siguiente validación debe usar una copia de fuentes sin archivos .env ni secretos,
dependencias ya disponibles, entorno permitido explícitamente y aislamiento OS con
red externa deshabilitada, límites de CPU, memoria, procesos, disco y tiempo. Las pruebas
de base usarán una base desechable y cuentas ficticias. No se debe usar DATABASE_URL
de producción como TEST_DATABASE_URL.

Casos pendientes: rechazo de Origin en alias y API; cabecera no-store; conservación de
roles; navegación HTML; reintentos sin duplicado; reversión cuando existe una clave
antigua homónima; rechazo de doble reversión; consistencia y rollback de los saldos.

## Alcance futuro

Para solicitar una auditoría completa, indica los dos repositorios, el commit, los
subsistemas y el directorio externo de resultados. La skill organiza reconocimiento,
cobertura, búsqueda, validación independiente y reportes estructurados. No atribuyas
una exposición real a configuraciones externas que no se hayan comprobado.

