class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new HttpError(status, message);
};
function text(value, label, max = 150, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== "string") fail(`${label}: ingresa un texto válido.`);
  const result = value.trim();
  if ((!result && required) || result.length > max)
    fail(
      `${label}: ${required ? "campo obligatorio, " : ""}máximo ${max} caracteres.`,
    );
  return result || null;
}
function number(
  value,
  label,
  { min = 0, max = 1000000000, integer = false } = {},
) {
  if (
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  )
    fail(`${label}: ingresa un número.`);
  const result = Number(value);
  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max ||
    (integer && !Number.isInteger(result))
  )
    fail(`${label}: valor fuera del rango permitido.`);
  if (!integer && Math.abs(result * 100 - Math.round(result * 100)) > 0.00001)
    fail(`${label}: usa como máximo dos decimales.`);
  return result;
}
const id = (value) =>
  number(value, "ID", { integer: true, min: 1, max: 2147483647 });
const email = (value) => {
  const result = text(value, "Correo", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    fail("Ingresa un correo válido.");
  return result;
};
const password = (value) => {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    Buffer.byteLength(value) > 72
  )
    fail(
      "La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.",
    );
  return value;
};
const role = (value) => {
  if (!["Administrador", "Almacenero", "Supervisor"].includes(value))
    fail("Rol inválido.");
  return value;
};
const boolean = (value, label) => {
  if (typeof value !== "boolean") fail(`${label}: usa verdadero o falso.`);
  return value;
};
module.exports = {
  HttpError,
  fail,
  text,
  number,
  id,
  email,
  password,
  role,
  boolean,
};
