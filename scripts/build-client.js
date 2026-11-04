const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ref = fs
  .readFileSync(path.join(__dirname, "../frontend-ref.txt"), "utf8")
  .trim();
if (!/^[a-f0-9]{40}$/.test(ref))
  throw new Error("Se requiere el SHA completo del frontend.");
const target = path.join(__dirname, "../.client-build");
fs.rmSync(target, { recursive: true, force: true });
execFileSync(
  "git",
  ["clone", "https://github.com/gpereyradev/appInventario.git", target],
  { stdio: "inherit" },
);
execFileSync("git", ["checkout", ref], { cwd: target, stdio: "inherit" });
execFileSync("npm", ["ci", "--include=dev", "--no-audit", "--no-fund"], {
  cwd: target,
  stdio: "inherit",
});
execFileSync("npm", ["run", "build"], {
  cwd: target,
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: "/api" },
});
fs.rmSync(path.join(__dirname, "../public"), { recursive: true, force: true });
fs.cpSync(path.join(target, "dist"), path.join(__dirname, "../public"), {
  recursive: true,
});
