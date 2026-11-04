# Validación de Inventra

Fecha de comprobación: 3 de noviembre de 2026 (Lima).

## Resultado

- Frontend: `npm run lint` y `npm run build` completados.
- Integración: 7 grupos aprobados en una base aislada de PostgreSQL embebido PGlite, configurada con una conexión. Se verificaron relaciones, autenticación, validación, registro de stock, rollback por stock insuficiente, idempotencia, ajustes, anulaciones, permisos, revocación y totales.
- Postman/Newman: 11 solicitudes y 11 aserciones aprobadas en otra base aislada, incluidas login y entrada de prueba. La colección no contiene credenciales.
- Navegador: 19 comprobaciones de rutas, búsqueda, menú móvil y ausencia de desbordamientos de página a 1440, 768, 390 y 375 px. Sin errores de JavaScript.
- Diseño: comprobaciones de geometría, tipografía y contraste del resumen sin hallazgos a 1440, 768 y 390 px. El inspector se ejecutó mediante su mismo analizador de DOM en el navegador de prueba, ya que su lanzador CDP no pudo conectarse en este entorno.
- Producción: Render en estado `live`; salud PostgreSQL, login de administrador, cookie Secure/HttpOnly/SameSite, seis rutas GET autenticadas y cuatro rutas React verificadas mediante lecturas.

## Integridad de la base publicada

| Consulta                                           | Resultado |
| -------------------------------------------------- | --------: |
| Productos activos                                  |        15 |
| Categorías                                         |         6 |
| Proveedores                                        |         3 |
| Usuarios                                           |         1 |
| Movimientos                                        |       105 |
| Productos cuyo stock difiere de la suma del Kardex |         0 |
| Movimientos con saldo inconsistente o negativo     |         0 |

No se ejecutaron escrituras de prueba en la base publicada. Una prueba que habría creado registros persistentes fue rechazada por la revisión automática; se continuó con una alternativa de solo lectura. La concurrencia real con varias conexiones en producción no se declara probada.

## Evidencia local de la guía

Se mantiene compatibilidad con MySQL, pero no se ejecutó HeidiSQL en el equipo del estudiante. El despliegue usa PostgreSQL autorizado. La captura específica de MySQL/HeidiSQL debe obtenerse ejecutando la variante local de la guía; no se fabricó esa evidencia.
