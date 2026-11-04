const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
describe(
  "Inventra integration: relational inventory and access control",
  { skip: !enabled },
  () => {
    let server,
      url,
      adminToken,
      warehouseToken,
      viewerToken,
      category,
      supplier,
      product,
      firstMovement;
    let models;
    const suffix = randomUUID().slice(0, 8);
    async function request(method, route, body, token = adminToken) {
      const res = await fetch(url + route, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      return {
        status: res.status,
        data,
        cookie: res.headers.get("set-cookie"),
      };
    }
    before(async () => {
      models = require("../models");
      await require("../scripts/migrate")();
      const user = await models.Usuario.create({
        nombre: "Pruebas automáticas",
        email: `qa-admin-${suffix}@example.com`,
        password: "Test-password-123",
        rol: "Administrador",
      });
      const { app } = require("../index");
      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      url = `http://127.0.0.1:${server.address().port}`;
      const login = await request(
        "POST",
        "/api/auth/login",
        { email: user.email, password: "Test-password-123" },
        null,
      );
      adminToken = login.data.token;
      assert.match(login.cookie, /HttpOnly/);
      assert.equal(login.status, 200);
    });
    after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (models) await models.sequelize.close();
    });
    it("rejects anonymous reads and public registration", async () => {
      assert.equal(
        (await request("GET", "/api/productos", undefined, null)).status,
        401,
      );
      assert.equal(
        (
          await request(
            "POST",
            "/api/auth/register",
            { rol: "Administrador" },
            null,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            "POST",
            "/api/auth/login",
            { email: `qa-admin-${suffix}@example.com`, password: "wrong" },
            null,
          )
        ).status,
        401,
      );
    });
    it("creates related categories and suppliers; rejects invalid product relationships", async () => {
      const c = await request("POST", "/api/categorias", {
        nombre: `QA-${suffix}`,
        descripcion: "Categoría de prueba",
      });
      assert.equal(c.status, 201);
      category = c.data;
      const s = await request("POST", "/api/proveedores", {
        razon_social: `QA Supplier ${suffix}`,
        email: `qa-${suffix}@example.com`,
      });
      assert.equal(s.status, 201);
      supplier = s.data;
      const invalid = await request("POST", "/api/productos", {
        nombre: "Invalid",
        sku: `QA-BAD-${suffix}`,
        precio: 5,
        costo: 2,
        categoria_id: 2147483647,
        proveedor_id: supplier.id,
      });
      assert.equal(invalid.status, 400);
      const p = await request("POST", "/api/productos", {
        nombre: "Producto de prueba",
        sku: `QA-${suffix}`,
        precio: 49.9,
        costo: 20,
        stock: 10,
        stock_minimo: 3,
        categoria_id: category.id,
        proveedor_id: supplier.id,
      });
      assert.equal(p.status, 201);
      product = p.data;
      assert.equal(product.stock, 10);
      const moves = await request("GET", "/api/movimientos");
      assert.equal(
        moves.data.filter((m) => m.producto_id === product.id).length,
        1,
      );
    });
    it("validates quantities and protects relationships and direct stock updates", async () => {
      for (const qty of [-1, 0, 1.5, true, "", "abc"])
        assert.equal(
          (
            await request("POST", "/api/movimientos", {
              producto_id: product.id,
              tipo_movimiento: "Entrada",
              cantidad: qty,
              observaciones: "Prueba",
              request_id: randomUUID(),
            })
          ).status,
          400,
        );
      assert.equal(
        (
          await request("PUT", `/api/productos/${product.id}`, {
            ...product,
            stock: 999,
          })
        ).status,
        400,
      );
      assert.equal(
        (await request("DELETE", `/api/categorias/${category.id}`)).status,
        409,
      );
      assert.equal(
        (await request("DELETE", `/api/productos/${product.id}`)).status,
        409,
      );
    });
    it("commits stock and ledger atomically and deduplicates retried operations", async () => {
      const body = {
        producto_id: product.id,
        tipo_movimiento: "Entrada",
        cantidad: 5,
        observaciones: "Recepción de prueba",
        request_id: randomUUID(),
      };
      const one = await request("POST", "/api/movimientos", body);
      assert.equal(one.status, 201);
      firstMovement = one.data;
      const retry = await request("POST", "/api/movimientos", body);
      assert.equal(retry.status, 201);
      assert.equal(retry.data.id, one.data.id);
      assert.equal((await models.Producto.findByPk(product.id)).stock, 15);
      const wrongRetry = await request("POST", "/api/movimientos", {
        ...body,
        cantidad: 7,
      });
      assert.equal(wrongRetry.status, 409);
      const bad = await request("POST", "/api/movimientos", {
        ...body,
        request_id: randomUUID(),
        tipo_movimiento: "Salida",
        cantidad: 99,
      });
      assert.equal(bad.status, 409);
      assert.equal((await models.Producto.findByPk(product.id)).stock, 15);
      assert.equal(
        await models.Movimiento.count({ where: { producto_id: product.id } }),
        2,
      );
    });
    it("records adjustment against a physical count and reverses without deleting history", async () => {
      const adjustment = await request("POST", "/api/movimientos", {
        producto_id: product.id,
        tipo_movimiento: "Ajuste",
        cantidad: 12,
        observaciones: "Conteo físico de prueba",
        request_id: randomUUID(),
      });
      assert.equal(adjustment.status, 201);
      assert.equal(adjustment.data.cantidad, -3);
      assert.equal(adjustment.data.stock_resultante, 12);
      const reverse = await request(
        "POST",
        `/api/movimientos/${firstMovement.id}/anular`,
        { observaciones: "Prueba de reversión" },
      );
      assert.equal(reverse.status, 201);
      assert.equal(reverse.data.revierte_id, firstMovement.id);
      assert.equal((await models.Producto.findByPk(product.id)).stock, 7);
      assert.equal(
        (
          await request("POST", `/api/movimientos/${firstMovement.id}/anular`, {
            observaciones: "Duplicada",
          })
        ).status,
        409,
      );
      assert.equal(
        (await models.Movimiento.findByPk(firstMovement.id)).anulado,
        true,
      );
    });
    it("enforces roles and revokes inactive users and logged-out sessions", async () => {
      for (const rol of ["Almacenero", "Supervisor"]) {
        const email = `qa-${rol.toLowerCase()}-${suffix}@example.com`;
        const r = await request("POST", "/api/usuarios", {
          nombre: rol,
          email,
          password: "Test-password-123",
          rol,
        });
        assert.equal(r.status, 201);
        const login = await request(
          "POST",
          "/api/auth/login",
          { email, password: "Test-password-123" },
          null,
        );
        if (rol === "Almacenero") warehouseToken = login.data.token;
        else viewerToken = login.data.token;
      }
      assert.equal(
        (await request("GET", "/api/productos", undefined, viewerToken)).status,
        200,
      );
      assert.equal(
        (await request("POST", "/api/productos", {}, viewerToken)).status,
        403,
      );
      assert.equal(
        (await request("GET", "/api/usuarios", undefined, warehouseToken))
          .status,
        403,
      );
      assert.equal(
        (await request("POST", "/api/usuarios", {}, warehouseToken)).status,
        403,
      );
      const users = (await request("GET", "/api/usuarios")).data;
      assert.ok(
        users.every((u) => !("password" in u) && !("token_version" in u)),
      );
      const warehouse = users.find(
        (u) => u.email === `qa-almacenero-${suffix}@example.com`,
      );
      assert.equal(
        (
          await request("PUT", `/api/usuarios/${warehouse.id}`, {
            ...warehouse,
            activo: false,
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("GET", "/api/productos", undefined, warehouseToken))
          .status,
        401,
      );
      assert.equal(
        (await request("POST", "/api/auth/logout", {}, viewerToken)).status,
        200,
      );
      assert.equal(
        (await request("GET", "/api/productos", undefined, viewerToken)).status,
        401,
      );
    });
    it("keeps stock and dashboard totals consistent with ledger", async () => {
      const rows = (await request("GET", "/api/productos")).data.filter(
        (p) => p.activo,
      );
      const stats = (await request("GET", "/api/dashboard")).data;
      assert.equal(stats.total_productos, rows.length);
      assert.equal(
        stats.total_unidades,
        rows.reduce((n, p) => n + p.stock, 0),
      );
      assert.equal(
        stats.valor_inventario,
        rows.reduce(
          (n, p) => n + Math.round(Number(p.costo) * 100) * p.stock,
          0,
        ) / 100,
      );
      const ledger = await models.Movimiento.findAll({
        where: { producto_id: product.id },
        order: [["id", "ASC"]],
      });
      assert.equal(
        ledger.reduce((n, m) => n + m.cantidad, 0),
        (await models.Producto.findByPk(product.id)).stock,
      );
      for (const m of ledger)
        assert.equal(m.stock_anterior + m.cantidad, m.stock_resultante);
    });
  },
);
