# Inventra · Backend del sistema de inventario

Proyecto de Guillermo Pereyra para el Laboratorio 9 de Fullstack Developer Software, SENATI. El backend y [appInventario](https://github.com/gpereyradev/appInventario) son dos repositorios del mismo sistema.

## Alcance

- Express 5, Sequelize 6, React 19 y Vite 8.
- MySQL local (HeidiSQL) y PostgreSQL con TLS para despliegue en Neon.
- Categorías y proveedores relacionados obligatoriamente con productos.
- Productos con SKU, costo, precio, unidad, stock mínimo y estado activo.
- Kardex inmutable: entrada, salida y ajuste por conteo físico.
- Transacciones y bloqueo de fila para mantener stock y movimiento consistentes.
- Idempotencia: reenviar una operación con el mismo `request_id` no duplica el stock.
- Anulación auditable mediante movimiento inverso; nunca borra el historial.
- Login con bcrypt, JWT de 8 horas y cookie HttpOnly; roles y revocación de sesiones.
- Alertas, valorización, exportación CSV e impresión desde el frontend.

## Ejecutar con MySQL local (Git Bash)

Requiere Node.js 22+ y MySQL 8+. En HeidiSQL crea una base vacía `inventra` con `utf8mb4`; Sequelize creará sus tablas.

```bash
git clone https://github.com/gpereyradev/miApi.git
cd miApi
npm ci
cp .env.example .env
```

Edita `.env` con tu usuario/contraseña de MySQL, una clave JWT aleatoria de al menos 32 caracteres y los datos de tu primer administrador. No publiques ese archivo.

```bash
npm start
```

API: http://localhost:3006. Comprobación: http://localhost:3006/health. En otra terminal inicia el frontend según su README. Para PostgreSQL, configura `DATABASE_URL` y omite los parámetros `DB_*`. Las conexiones remotas usan validación de certificado TLS; únicamente localhost puede usar una conexión sin TLS.

`SEED_DEMO=true` carga 15 productos tecnológicos, 6 categorías, 3 proveedores de ejemplo y 105 movimientos. Es una muestra para practicar, no una importación de tu PC. Solo se carga cuando no hay productos. `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD` crean la cuenta si todavía no existe; no restablecen la contraseña en cada reinicio. Puedes cambiarla desde Configuración.

## Conservación de los datos del proyecto anterior

`scripts/migrate.js` crea las tablas faltantes sin `force` ni `alter:true`. Si ya existen los productos de las guías 10/11, añade sus campos faltantes, un SKU `LEG-*` y las relaciones «Por clasificar» / «Por asignar». El stock inicial heredado queda documentado al disponer de un administrador. Haz una copia de tu base antes de ejecutar cambios de esquema en tu equipo. La versión publicada usa su propia base nueva; este entorno no puede leer automáticamente una base alojada en tu PC.

## API

Todos los endpoints salvo login y salud requieren sesión. Postman también puede enviar `Authorization: Bearer {{token}}`, usando el token devuelto por login. El navegador no guarda el token en localStorage.

| Método              | Ruta                          | Función                           | Permiso                                                    |
| ------------------- | ----------------------------- | --------------------------------- | ---------------------------------------------------------- |
| GET                 | `/health`                     | Estado y motor de base de datos   | Público                                                    |
| POST                | `/api/auth/login`             | Iniciar sesión                    | Público                                                    |
| POST                | `/api/auth/logout`            | Revocar las sesiones de la cuenta | Autenticado                                                |
| GET                 | `/api/auth/me`                | Perfil de la sesión               | Autenticado                                                |
| PUT                 | `/api/auth/profile`           | Nombre y contraseña propia        | Autenticado                                                |
| GET                 | `/api/dashboard`              | Resumen, alertas y actividad      | Autenticado                                                |
| GET/POST/PUT/DELETE | `/api/productos[/:id]`        | Catálogo                          | Lectura: todos; escritura: admin/almacenero; borrar: admin |
| GET/POST/PUT/DELETE | `/api/categorias[/:id]`       | Categorías                        | Lectura: todos; escritura: admin                           |
| GET/POST/PUT/DELETE | `/api/proveedores[/:id]`      | Proveedores                       | Lectura: todos; escritura: admin                           |
| GET/POST/PUT        | `/api/usuarios[/:id]`         | Cuentas y roles                   | Administrador                                              |
| GET/POST            | `/api/movimientos`            | Kardex / nuevo movimiento         | Lectura: todos; escritura: admin/almacenero                |
| POST                | `/api/movimientos/:id/anular` | Movimiento de reversión           | Administrador                                              |

Los alias `/productos` de las guías anteriores conservan la API para clientes JSON. En una navegación HTML, `/productos` abre la interfaz React. `/api/auth/register` ahora requiere un administrador: no permite crear cuentas privilegiadas desde Internet.

### Registrar un movimiento

```json
{
  "producto_id": 1,
  "tipo_movimiento": "Entrada",
  "cantidad": 5,
  "observaciones": "Recepción según guía de remisión",
  "referencia": "GR-001",
  "request_id": "uuid-unico-generado-por-el-cliente"
}
```

Entrada y Salida reciben cantidades positivas; la API conserva la cantidad neta con signo. En un Ajuste, `cantidad` es el stock real contado (puede ser cero). La API calcula la diferencia. No se puede editar `stock` directamente mediante PUT. Las anulaciones se rechazan si dejarían stock negativo. No se puede borrar un producto con movimientos: se desactiva.

## Despliegue: una sola dirección

Render ejecuta `npm ci && npm run build:client` y después `npm start`. El script clona el repositorio del frontend, fija el SHA de `frontend-ref.txt`, compila React y copia `dist` a `public`. Express sirve ambas partes con el mismo origen y resuelve las rutas de React Router al recargar.

Variables de producción: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `SEED_DEMO`, `NODE_ENV=production`, `PORT` (Render lo proporciona). El servicio usa el plan gratuito. Las credenciales se configuran en Render, no en GitHub. No se aloja la base de datos en el disco efímero de Render.

Al actualizar el frontend, cambia `frontend-ref.txt` por el SHA completo publicado en `appInventario` y sube el cambio al backend. Ese commit activa el despliegue de la aplicación integrada. No hay necesidad de fusionar o eliminar ninguno de tus repositorios.

## Pruebas

```bash
TEST_DATABASE_URL='postgresql://...base-aislada-de-pruebas...' npm test
```

No uses producción para esa suite: genera registros de prueba identificados con prefijos QA. Sin `TEST_DATABASE_URL`, se omite explícitamente. La suite verifica autenticación, bloqueo del registro público, relaciones, validación, historial, stock insuficiente, idempotencia, ajustes, anulaciones, roles, desactivación y consistencia de totales. No borra ni reinicia tablas existentes. El esquema relacional y los ejemplos para Postman están en `docs/`.

## Diferencia con la guía

Se mantiene MySQL para ejecutar localmente y mostrar HeidiSQL, como pide la guía. El despliegue autorizado usa PostgreSQL en Neon; un despliegue remoto no sustituye la captura específica de MySQL/HeidiSQL solicitada por el instructor. La colección de Postman permite realizar esa comprobación local o contra la versión publicada.
