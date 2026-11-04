const jwt = require("jsonwebtoken");
const { Usuario } = require("../models");
const { HttpError } = require("../services/validation");
module.exports =
  (roles = []) =>
  async (req, res, next) => {
    try {
      const cookie = req.headers.cookie
        ?.split("; ")
        .find((c) => c.startsWith("inventra_session="))
        ?.slice(17);
      const token =
        req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] || cookie;
      if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET, {
          algorithms: ["HS256"],
        });
      } catch {
        throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
      }
      const usuario = await Usuario.unscoped().findByPk(payload.id);
      if (!usuario?.activo || usuario.token_version !== payload.v)
        throw new HttpError(401, "Sesión no disponible. Vuelve a ingresar.");
      if (roles.length && !roles.includes(usuario.rol))
        throw new HttpError(
          403,
          "Tu rol no tiene permiso para realizar esta acción.",
        );
      req.usuario = usuario;
      next();
    } catch (e) {
      next(e);
    }
  };
