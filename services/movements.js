const { sequelize, Producto, Movimiento } = require("../models");
const V = require("./validation");
async function registerMovement(body, actor) {
  const producto_id = V.id(body.producto_id);
  const tipo = body.tipo_movimiento;
  if (!["Entrada", "Salida", "Ajuste"].includes(tipo))
    V.fail("Tipo de movimiento inválido.");
  const qty = V.number(body.cantidad, "Cantidad", {
    integer: true,
    min: tipo === "Ajuste" ? 0 : 1,
  });
  const observaciones = V.text(
    body.observaciones,
    "Motivo del movimiento",
    500,
  );
  const request_id = V.text(body.request_id, "Identificador de operación", 80);
  const referencia = V.text(body.referencia, "Referencia", 100, false);
  return sequelize.transaction(async (transaction) => {
    const product = await Producto.findByPk(producto_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product || !product.activo)
      V.fail("El producto no está disponible.", 404);
    const existing = await Movimiento.findOne({
      where: { request_id },
      transaction,
    });
    if (existing) {
      if (
        existing.producto_id !== producto_id ||
        existing.usuario_id !== actor.id ||
        existing.tipo_movimiento !== tipo ||
        (tipo === "Ajuste"
          ? existing.stock_resultante !== qty
          : Math.abs(existing.cantidad) !== qty) ||
        existing.observaciones !== observaciones ||
        existing.referencia !== referencia
      )
        V.fail("La operación ya existe con otros datos.", 409);
      return existing;
    }
    const delta =
      tipo === "Ajuste" ? qty - product.stock : tipo === "Salida" ? -qty : qty;
    if (!delta) V.fail("El stock ya coincide con el conteo ingresado.");
    const after = product.stock + delta;
    if (after < 0)
      V.fail(`Stock insuficiente: solo hay ${product.stock} unidades.`, 409);
    if (after > 1000000000) V.fail("El stock resultante excede el límite.");
    const movement = await Movimiento.create(
      {
        producto_id,
        usuario_id: actor.id,
        tipo_movimiento: tipo,
        cantidad: delta,
        stock_anterior: product.stock,
        stock_resultante: after,
        observaciones,
        referencia,
        request_id,
      },
      { transaction },
    );
    await product.update({ stock: after }, { transaction });
    return movement;
  });
}
async function reverseMovement(movementId, body, actor) {
  return sequelize.transaction(async (transaction) => {
    // Always lock product before movement; same ordering as registration.
    const initial = await Movimiento.findByPk(V.id(movementId), {
      transaction,
    });
    if (!initial) V.fail("Movimiento no encontrado.", 404);
    const product = await Producto.findByPk(initial.producto_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const movement = await Movimiento.findByPk(initial.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (movement.anulado || movement.revierte_id)
      V.fail("Este movimiento ya fue anulado o es una reversión.", 409);
    const after = product.stock - movement.cantidad;
    if (after < 0 || after > 1000000000)
      V.fail("La reversión dejaría el stock fuera del rango permitido.", 409);
    const reversal = await Movimiento.create(
      {
        producto_id: product.id,
        usuario_id: actor.id,
        tipo_movimiento: "Ajuste",
        cantidad: -movement.cantidad,
        stock_anterior: product.stock,
        stock_resultante: after,
        observaciones: V.text(body.observaciones, "Motivo de anulación", 400),
        referencia: `Anulación de MOV-${movement.id}`,
        request_id: `reverse-${movement.id}`,
        revierte_id: movement.id,
      },
      { transaction },
    );
    await movement.update({ anulado: true }, { transaction });
    await product.update({ stock: after }, { transaction });
    return reversal;
  });
}
module.exports = { registerMovement, reverseMovement };
