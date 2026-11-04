require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("node:path");
const fs = require("node:fs");
const { Op } = require("sequelize");
const {
  sequelize,
  Producto,
  Categoria,
  Proveedor,
  Usuario,
  Movimiento,
} = require("./models");
const auth = require("./middleware/authMiddleware");
const V = require("./services/validation");
const { registerMovement, reverseMovement } = require("./services/movements");
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
const origins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
).split(",");
app.use(
  cors({
    origin: (origin, done) => done(null, !origin || origins.includes(origin)),
    credentials: true,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    !origins.includes(req.headers.origin) &&
    req.headers.origin !== `https://${req.get("host")}` &&
    req.headers.origin !== `http://${req.get("host")}`
  )
    return next(new V.HttpError(403, "Origen no permitido."));
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta en un minuto." },
  }),
);
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
const publicUser = (u) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  rol: u.rol,
  activo: u.activo,
  createdAt: u.createdAt,
});
const issueToken = (u) =>
  jwt.sign({ id: u.id, v: u.token_version }, process.env.JWT_SECRET, {
    expiresIn: "8h",
    algorithm: "HS256",
  });
const writable = auth(["Administrador", "Almacenero"]);
const admin = auth(["Administrador"]);
app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: "ok",
      service: "Inventra API",
      database: sequelize.getDialect(),
    });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    skipSuccessfulRequests: true,
    message: { error: "Demasiados intentos. Espera 15 minutos." },
  }),
  async (req, res) => {
    const email = V.email(req.body.email);
    const password =
      typeof req.body.password === "string" &&
      Buffer.byteLength(req.body.password) <= 72
        ? req.body.password
        : "";
    const user = await Usuario.unscoped().findOne({ where: { email } });
    if (!user?.activo || !(await bcrypt.compare(password, user.password)))
      V.fail("Correo o contraseña incorrectos.", 401);
    const token = issueToken(user);
    res.cookie("inventra_session", token, {
      ...cookieOptions,
      maxAge: 8 * 3600000,
    });
    res.json({ usuario: publicUser(user), token });
  },
);
app.post("/api/auth/logout", auth(), async (req, res) => {
  await req.usuario.increment("token_version");
  res
    .clearCookie("inventra_session", cookieOptions)
    .json({ message: "Sesión cerrada." });
});
app.get("/api/auth/me", auth(), (req, res) =>
  res.json(publicUser(req.usuario)),
);
app.put("/api/auth/profile", auth(), async (req, res) => {
  const updates = { nombre: V.text(req.body.nombre, "Nombre", 100) };
  if (req.body.password) {
    if (
      !(await bcrypt.compare(
        String(req.body.current_password || ""),
        req.usuario.password,
      ))
    )
      V.fail("La contraseña actual no coincide.", 400);
    updates.password = V.password(req.body.password);
    updates.token_version = req.usuario.token_version + 1;
  }
  await req.usuario.update(updates);
  if (updates.password)
    res.cookie("inventra_session", issueToken(req.usuario), {
      ...cookieOptions,
      maxAge: 8 * 3600000,
    });
  res.json(publicUser(req.usuario));
});
function productBody(b) {
  return {
    nombre: V.text(b.nombre, "Nombre", 150),
    sku: V.text(b.sku, "SKU", 50).toUpperCase(),
    descripcion: V.text(b.descripcion, "Descripción", 2000, false),
    precio: V.number(b.precio, "Precio", { max: 9999999999.99 }),
    costo: V.number(b.costo ?? 0, "Costo", { max: 9999999999.99 }),
    stock_minimo: V.number(b.stock_minimo ?? 5, "Stock mínimo", {
      integer: true,
    }),
    categoria_id: V.id(b.categoria_id),
    proveedor_id: V.id(b.proveedor_id),
    unidad: V.text(b.unidad || "Unidad", "Unidad", 30),
    activo: b.activo === undefined ? true : V.boolean(b.activo, "Activo"),
  };
}
async function checkRelations(b, transaction) {
  if (!(await Categoria.findByPk(b.categoria_id, { transaction })))
    V.fail("Selecciona una categoría existente.");
  if (!(await Proveedor.findByPk(b.proveedor_id, { transaction })))
    V.fail("Selecciona un proveedor existente.");
}
const productIncludes = [
  { model: Categoria, as: "categoria" },
  { model: Proveedor, as: "proveedor" },
];
app.get(
  ["/api/productos", "/productos"],
  (req, res, next) =>
    req.path === "/productos" && req.get("accept")?.includes("text/html")
      ? next("route")
      : next(),
  auth(),
  async (req, res) =>
    res.json(
      await Producto.findAll({
        include: productIncludes,
        order: [["id", "DESC"]],
      }),
    ),
);
app.post(["/api/productos", "/productos"], writable, async (req, res) => {
  const body = productBody(req.body);
  const opening = V.number(req.body.stock ?? 0, "Stock inicial", {
    integer: true,
  });
  const result = await sequelize.transaction(async (transaction) => {
    await checkRelations(body, transaction);
    const product = await Producto.create(body, { transaction });
    if (opening) {
      await Movimiento.create(
        {
          producto_id: product.id,
          usuario_id: req.usuario.id,
          tipo_movimiento: "Entrada",
          cantidad: opening,
          stock_anterior: 0,
          stock_resultante: opening,
          observaciones: "Stock inicial del producto",
          request_id: `opening-${product.id}`,
        },
        { transaction },
      );
      await product.update({ stock: opening }, { transaction });
    }
    return product;
  });
  res.status(201).json(result);
});
app.put(
  ["/api/productos/:id", "/productos/:id"],
  writable,
  async (req, res) => {
    if ("stock" in req.body)
      V.fail("El stock se modifica registrando un movimiento en Kardex.");
    const body = productBody(req.body);
    const result = await sequelize.transaction(async (transaction) => {
      const product = await Producto.findByPk(V.id(req.params.id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product) V.fail("Producto no encontrado.", 404);
      await checkRelations(body, transaction);
      return product.update(body, { transaction });
    });
    res.json(result);
  },
);
app.delete(
  ["/api/productos/:id", "/productos/:id"],
  admin,
  async (req, res) => {
    await sequelize.transaction(async (transaction) => {
      const product = await Producto.findByPk(V.id(req.params.id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product) V.fail("Producto no encontrado.", 404);
      if (
        await Movimiento.count({
          where: { producto_id: product.id },
          transaction,
        })
      )
        V.fail(
          "El producto tiene historial. Desactívalo desde Editar para conservar el Kardex.",
          409,
        );
      await product.destroy({ transaction });
    });
    res.json({ message: "Producto eliminado." });
  },
);
for (const [route, Model, field] of [
  ["categorias", Categoria, "nombre"],
  ["proveedores", Proveedor, "razon_social"],
]) {
  const parse = (b) =>
    route === "categorias"
      ? {
          nombre: V.text(b.nombre, "Nombre", 100),
          descripcion: V.text(b.descripcion, "Descripción", 2000, false),
        }
      : {
          razon_social: V.text(b.razon_social, "Razón social", 150),
          contacto: V.text(b.contacto, "Contacto", 100, false),
          telefono: V.text(b.telefono, "Teléfono", 30, false),
          email: b.email ? V.email(b.email) : null,
          ruc: b.ruc
            ? /^\d{11}$/.test(b.ruc)
              ? b.ruc
              : V.fail("El RUC debe tener 11 dígitos.")
            : null,
          direccion: V.text(b.direccion, "Dirección", 250, false),
        };
  app.get(`/api/${route}`, auth(), async (req, res) => {
    const rows = await Model.findAll({ order: [[field, "ASC"]] });
    const products = await Producto.findAll({
      attributes: [route === "categorias" ? "categoria_id" : "proveedor_id"],
    });
    res.json(
      rows.map((r) => ({
        ...r.toJSON(),
        total_productos: products.filter(
          (p) =>
            p[route === "categorias" ? "categoria_id" : "proveedor_id"] ===
            r.id,
        ).length,
      })),
    );
  });
  app.post(`/api/${route}`, admin, async (req, res) =>
    res.status(201).json(await Model.create(parse(req.body))),
  );
  app.put(`/api/${route}/:id`, admin, async (req, res) => {
    const row = await Model.findByPk(V.id(req.params.id));
    if (!row) V.fail("Registro no encontrado.", 404);
    res.json(await row.update(parse(req.body)));
  });
  app.delete(`/api/${route}/:id`, admin, async (req, res) => {
    const row = await Model.findByPk(V.id(req.params.id));
    if (!row) V.fail("Registro no encontrado.", 404);
    if (
      await Producto.count({
        where: {
          [route === "categorias" ? "categoria_id" : "proveedor_id"]: row.id,
        },
      })
    )
      V.fail(
        "Este registro tiene productos asociados. Reasígnalos antes de eliminarlo.",
        409,
      );
    await row.destroy();
    res.json({ message: "Registro eliminado." });
  });
}
app.get("/api/usuarios", admin, async (req, res) =>
  res.json(await Usuario.findAll({ order: [["id", "ASC"]] })),
);
app.post(["/api/usuarios", "/api/auth/register"], admin, async (req, res) =>
  res
    .status(201)
    .json(
      publicUser(
        await Usuario.create({
          nombre: V.text(req.body.nombre, "Nombre", 100),
          email: V.email(req.body.email),
          password: V.password(req.body.password),
          rol: V.role(req.body.rol),
          activo: true,
        }),
      ),
    ),
);
app.put("/api/usuarios/:id", admin, async (req, res) => {
  const result = await sequelize.transaction(async (transaction) => {
    // Serialize user management to protect the last active administrator.
    const all = await Usuario.unscoped().findAll({
      transaction,
      lock: transaction.LOCK.UPDATE,
      order: [["id", "ASC"]],
    });
    const user = all.find((u) => u.id === V.id(req.params.id));
    if (!user) V.fail("Usuario no encontrado.", 404);
    const updates = {
      nombre: V.text(req.body.nombre, "Nombre", 100),
      email: V.email(req.body.email),
      rol: V.role(req.body.rol),
      activo: V.boolean(req.body.activo, "Estado"),
    };
    if (
      user.id === req.usuario.id &&
      (!updates.activo || updates.rol !== "Administrador")
    )
      V.fail(
        "No puedes desactivar tu cuenta ni quitarte el rol de administrador.",
      );
    if (
      user.rol === "Administrador" &&
      user.activo &&
      (!updates.activo || updates.rol !== "Administrador") &&
      all.filter((u) => u.rol === "Administrador" && u.activo).length < 2
    )
      V.fail("Debe quedar al menos un administrador activo.");
    if (req.body.password) updates.password = V.password(req.body.password);
    if (
      updates.password ||
      updates.rol !== user.rol ||
      updates.activo !== user.activo
    )
      updates.token_version = user.token_version + 1;
    await user.update(updates, { transaction });
    return publicUser(user);
  });
  res.json(result);
});
const movementIncludes = [
  {
    model: Producto,
    as: "producto",
    attributes: ["id", "nombre", "sku", "unidad"],
  },
  { model: Usuario, as: "usuario", attributes: ["id", "nombre", "rol"] },
];
app.get("/api/movimientos", auth(), async (req, res) =>
  res.json(
    await Movimiento.findAll({
      include: movementIncludes,
      order: [
        ["fecha_hora", "DESC"],
        ["id", "DESC"],
      ],
    }),
  ),
);
app.post("/api/movimientos", writable, async (req, res) =>
  res.status(201).json(await registerMovement(req.body, req.usuario)),
);
app.post("/api/movimientos/:id/anular", admin, async (req, res) =>
  res
    .status(201)
    .json(await reverseMovement(req.params.id, req.body, req.usuario)),
);
app.get("/api/dashboard", auth(), async (req, res) => {
  const [products, categories, suppliers, movements] = await Promise.all([
    Producto.findAll({ where: { activo: true }, include: productIncludes }),
    Categoria.count(),
    Proveedor.count(),
    Movimiento.findAll({
      include: movementIncludes,
      order: [
        ["fecha_hora", "DESC"],
        ["id", "DESC"],
      ],
    }),
  ]);
  const low = products
    .filter((p) => p.stock <= p.stock_minimo)
    .sort((a, b) => a.stock - b.stock);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  });
  const activity = days.map((fecha) => {
    const items = movements.filter(
      (m) =>
        m.fecha_hora.toLocaleDateString("en-CA", {
          timeZone: "America/Lima",
        }) === fecha,
    );
    return {
      fecha,
      entradas: items
        .filter((m) => m.cantidad > 0)
        .reduce((n, m) => n + m.cantidad, 0),
      salidas: items
        .filter((m) => m.cantidad < 0)
        .reduce((n, m) => n - m.cantidad, 0),
    };
  });
  const byCategory = new Map();
  products.forEach((p) => {
    const name = p.categoria.nombre;
    const v = byCategory.get(name) || {
      nombre: name,
      productos: 0,
      unidades: 0,
      valor_centimos: 0,
    };
    v.productos++;
    v.unidades += p.stock;
    v.valor_centimos += Math.round(Number(p.costo) * 100) * p.stock;
    byCategory.set(name, v);
  });
  res.json({
    total_productos: products.length,
    total_categorias: categories,
    total_proveedores: suppliers,
    total_unidades: products.reduce((n, p) => n + p.stock, 0),
    valor_inventario:
      products.reduce(
        (n, p) => n + Math.round(Number(p.costo) * 100) * p.stock,
        0,
      ) / 100,
    bajo_stock: low,
    agotados: products.filter((p) => !p.stock).length,
    movimientos_recientes: movements.slice(0, 5),
    actividad: activity,
    por_categoria: [...byCategory.values()]
      .sort((a, b) => b.unidades - a.unidades)
      .map((v) => ({ ...v, valor: v.valor_centimos / 100 })),
    total_movimientos: movements.length,
  });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint no encontrado." }),
);
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir, { maxAge: "1h", index: false }));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(publicDir, "index.html")),
  );
} else
  app.get("/", (req, res) =>
    res.json({
      service: "Inventra API",
      frontend: "http://localhost:5173",
      health: "/health",
    }),
  );
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.status)
    return res.status(error.status).json({ error: error.message });
  if (error.name === "SequelizeUniqueConstraintError")
    return res
      .status(409)
      .json({
        error:
          "Ya existe un registro con ese SKU, nombre, correo o identificador.",
      });
  if (error.name === "SequelizeForeignKeyConstraintError")
    return res
      .status(409)
      .json({
        error:
          "El registro tiene relaciones asociadas. Revisa sus dependencias.",
      });
  if (error.name === "SequelizeValidationError")
    return res
      .status(400)
      .json({ error: "Revisa los datos ingresados: hay valores inválidos." });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "JSON inválido." });
  console.error("Request error:", error.name);
  res
    .status(500)
    .json({ error: "No se pudo completar la operación. Intenta nuevamente." });
});
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("Configura JWT_SECRET con al menos 32 caracteres.");
  await require("./scripts/migrate")();
  await require("./scripts/seed")();
  const port = Number(process.env.PORT || 3006);
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(
      `Inventra: servidor activo en el puerto ${port}. Base de datos ${sequelize.getDialect()} conectada.`,
    ),
  );
  const shutdown = () => {
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 25000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return server;
}
if (require.main === module)
  start().catch((e) => {
    console.error("No se pudo iniciar Inventra:", e.message);
    process.exit(1);
  });
module.exports = { app, start };
