const {
  sequelize,
  Usuario,
  Categoria,
  Proveedor,
  Producto,
  Movimiento,
} = require("../models");
module.exports = async function seed() {
  let admin = await Usuario.unscoped().findOne({
    where: { email: (process.env.ADMIN_EMAIL || "").toLowerCase() },
  });
  if (!admin && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    admin = await Usuario.create({
      nombre: process.env.ADMIN_NAME || "Guillermo Pereyra",
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      password: process.env.ADMIN_PASSWORD,
      rol: "Administrador",
    });
  if (!admin)
    admin = await Usuario.findOne({
      where: { rol: "Administrador", activo: true },
    });
  if (!admin)
    throw new Error(
      "Configura ADMIN_EMAIL y ADMIN_PASSWORD para crear el primer administrador.",
    );
  // Opening balances for products inherited from the local guides.
  for (const product of await Producto.findAll()) {
    if (
      product.stock > 0 &&
      !(await Movimiento.count({ where: { producto_id: product.id } }))
    )
      await Movimiento.create({
        producto_id: product.id,
        usuario_id: admin.id,
        tipo_movimiento: "Entrada",
        cantidad: product.stock,
        stock_anterior: 0,
        stock_resultante: product.stock,
        observaciones: "Saldo inicial migrado del proyecto local",
        request_id: `legacy-opening-${product.id}`,
      });
  }
  if (process.env.SEED_DEMO !== "true" || (await Producto.count())) return;
  await sequelize.transaction(async (transaction) => {
    const categoryNames = [
      "Periféricos",
      "Computadoras",
      "Monitores",
      "Almacenamiento",
      "Redes",
      "Accesorios",
    ];
    const descriptions = [
      "Teclados, mouse y audio para el trabajo diario.",
      "Equipos de escritorio y portátiles.",
      "Pantallas y soluciones de visualización.",
      "Discos, memorias y almacenamiento portátil.",
      "Conectividad y equipos de red.",
      "Complementos, cables y suministros.",
    ];
    const categories = [];
    for (let i = 0; i < categoryNames.length; i++) {
      const [c] = await Categoria.findOrCreate({
        where: { nombre: categoryNames[i] },
        defaults: { descripcion: descriptions[i] },
        transaction,
      });
      categories.push(c);
    }
    const suppliers = [];
    for (const s of [
      {
        razon_social: "Andes Tecnología",
        contacto: "Área comercial",
        telefono: "01 555 0101",
        email: "ventas@andes.example",
        direccion: "Lima, Perú",
      },
      {
        razon_social: "Norte Digital",
        contacto: "Distribución",
        telefono: "01 555 0102",
        email: "pedidos@norte.example",
        direccion: "Los Olivos, Lima",
      },
      {
        razon_social: "Conecta Distribuciones",
        contacto: "Atención a empresas",
        telefono: "01 555 0103",
        email: "contacto@conecta.example",
        direccion: "Comas, Lima",
      },
    ]) {
      const [p] = await Proveedor.findOrCreate({
        where: { razon_social: s.razon_social },
        defaults: s,
        transaction,
      });
      suppliers.push(p);
    }
    const samples = [
      ["TEC-001", "Mouse inalámbrico Logitech M170", 59.9, 38, 42, 10, 0, 0],
      ["TEC-002", "Teclado mecánico Redragon K552", 189, 130, 8, 10, 0, 0],
      ["TEC-003", "Audífonos HyperX Cloud Stinger", 169, 112, 18, 5, 0, 1],
      ["TEC-004", "Laptop ASUS Vivobook 15", 2499, 1990, 6, 3, 1, 0],
      ["TEC-005", "Mini PC Lenovo ThinkCentre", 1850, 1430, 4, 3, 1, 1],
      ["TEC-006", "Monitor LG IPS 24 pulgadas", 549, 410, 12, 5, 2, 1],
      ["TEC-007", "Monitor Samsung 27 pulgadas", 749, 570, 3, 5, 2, 0],
      ["TEC-008", "SSD Kingston NV2 1 TB", 269, 195, 24, 8, 3, 0],
      ["TEC-009", "Memoria USB SanDisk 64 GB", 29.9, 16, 65, 15, 3, 2],
      ["TEC-010", "Disco externo Seagate 2 TB", 329, 250, 0, 5, 3, 1],
      ["TEC-011", "Router TP-Link Archer C6", 179, 120, 16, 5, 4, 2],
      ["TEC-012", "Switch TP-Link 8 puertos", 89, 58, 11, 4, 4, 2],
      ["TEC-013", "Cable HDMI 2.0 de 2 metros", 24.9, 10, 35, 10, 5, 2],
      ["TEC-014", "Hub USB-C 6 en 1", 119, 74, 5, 8, 5, 1],
      ["TEC-015", "Soporte ajustable para laptop", 79, 46, 22, 6, 5, 0],
    ];
    for (let i = 0; i < samples.length; i++) {
      const [sku, nombre, precio, costo, target, stock_minimo, c, s] =
        samples[i];
      const product = await Producto.create(
        {
          sku,
          nombre,
          precio,
          costo,
          stock: target,
          stock_minimo,
          categoria_id: categories[c].id,
          proveedor_id: suppliers[s].id,
          descripcion:
            "Producto de ejemplo para practicar la gestión del inventario.",
          unidad: "Unidad",
        },
        { transaction },
      );
      let stock = 0;
      for (let day = 6; day >= 0; day--) {
        const qty = day === 6 ? target + 6 : -1;
        const after = stock + qty;
        const date = new Date();
        date.setDate(date.getDate() - day);
        date.setHours(12 + (i % 6), i * 3, 0, 0);
        await Movimiento.create(
          {
            producto_id: product.id,
            usuario_id: admin.id,
            tipo_movimiento: qty > 0 ? "Entrada" : "Salida",
            cantidad: qty,
            stock_anterior: stock,
            stock_resultante: after,
            fecha_hora: date,
            observaciones:
              qty > 0
                ? "Carga inicial de demostración"
                : "Salida de demostración",
            referencia: "DEMO",
            request_id: `demo-${product.id}-${day}`,
          },
          { transaction },
        );
        stock = after;
      }
    }
  });
  console.log("Catálogo de demostración preparado.");
};
