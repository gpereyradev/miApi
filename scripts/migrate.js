const {
  sequelize,
  Producto,
  Categoria,
  Proveedor,
  Usuario,
} = require("../models");
module.exports = async function migrate() {
  // Creates missing tables. Never force-sync or use alter:true against user data.
  await sequelize.sync();
  const qi = sequelize.getQueryInterface();
  for (const Model of [Usuario, Producto]) {
    const columns = await qi.describeTable(Model.getTableName());
    for (const [name, attr] of Object.entries(Model.rawAttributes)) {
      if (columns[name]) continue;
      // Legacy guide-10 products have no associations or SKU. Add nullable, backfill, then constrain.
      if (["categoria_id", "proveedor_id", "sku"].includes(name)) {
        await qi.addColumn(Model.getTableName(), name, {
          ...attr,
          allowNull: true,
        });
      } else await qi.addColumn(Model.getTableName(), name, attr);
    }
  }
  const legacy = await Producto.findAll({
    where: {
      [require("sequelize").Op.or]: [
        { categoria_id: null },
        { proveedor_id: null },
        { sku: null },
      ],
    },
  });
  if (legacy.length) {
    const [cat] = await Categoria.findOrCreate({
      where: { nombre: "Por clasificar" },
      defaults: {
        descripcion:
          "Productos del proyecto local pendientes de clasificación.",
      },
    });
    const [supplier] = await Proveedor.findOrCreate({
      where: { razon_social: "Por asignar" },
      defaults: { contacto: "Pendiente de asignación" },
    });
    for (const p of legacy)
      await p.update({
        categoria_id: p.categoria_id || cat.id,
        proveedor_id: p.proveedor_id || supplier.id,
        sku: p.sku || `LEG-${String(p.id).padStart(5, "0")}`,
      });
    // Legacy opening balances are audited on seed, after an administrator exists.
    for (const name of ["categoria_id", "proveedor_id", "sku"])
      await qi.changeColumn(
        Producto.getTableName(),
        name,
        Producto.rawAttributes[name],
      );
  }
  console.log("Esquema relacional verificado; datos existentes conservados.");
};
