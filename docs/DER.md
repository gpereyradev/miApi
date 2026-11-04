# Diagrama entidad–relación · Inventra

```mermaid
erDiagram
  Categoria ||--o{ Productos : clasifica
  Proveedors ||--o{ Productos : suministra
  Productos ||--o{ Movimientos : registra
  Usuarios ||--o{ Movimientos : realiza
  Movimientos o|--o| Movimientos : revierte
  Categoria {
    int id PK
    string nombre UK
    text descripcion
  }
  Proveedors {
    int id PK
    string razon_social UK
    string contacto
    string telefono
    string email
    string ruc
    string direccion
  }
  Usuarios {
    int id PK
    string nombre
    string email UK
    string password "Hash bcrypt"
    string rol
    boolean activo
    int token_version
  }
  Productos {
    int id PK
    string sku UK
    string nombre
    text descripcion
    decimal precio
    decimal costo
    int stock
    int stock_minimo
    string unidad
    boolean activo
    int categoria_id FK
    int proveedor_id FK
  }
  Movimientos {
    int id PK
    int producto_id FK
    int usuario_id FK
    string tipo_movimiento
    int cantidad "Diferencia con signo"
    int stock_anterior
    int stock_resultante
    datetime fecha_hora
    string observaciones
    string referencia
    string request_id UK
    boolean anulado
    int revierte_id FK,UK
  }
```

Sequelize agrega `createdAt` y `updatedAt` a las cinco tablas. `revierte_id` es opcional y único: un movimiento puede tener una sola reversión. Las FK de categoría, proveedor, producto y usuario usan restricción de borrado para conservar la integridad. Los nombres físicos `Categoria` y `Proveedors` corresponden a la inflexión automática de Sequelize. La interfaz usa las etiquetas en español «Categorías» y «Proveedores».

Invariantes del Kardex: `stock_anterior + cantidad = stock_resultante`; `stock_resultante >= 0`; la suma de todas las cantidades del producto coincide con su stock. Una anulación conserva el original y añade su inverso, por lo que ambos permanecen en el cálculo.
