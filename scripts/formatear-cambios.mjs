// Formatea con Prettier solo los archivos que cambiaron respecto a master.
// Así no se reformatea todo el proyecto de golpe y no chocamos con las ramas de los demás.
//
//   npm run format          formatea tus archivos cambiados
//   npm run format:check    solo revisa (lo usa GitHub en los pull requests)
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const revisar = process.argv.includes("--check");
const base = process.env.RAMA_BASE || "origin/master";
const extensiones = /\.(ts|tsx|js|mjs|cjs|jsx|json|css)$/;

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

let archivos = [];
try {
  const comparados = git(`diff --name-only --diff-filter=ACMR ${base}...HEAD`);
  const sinGuardar = git("diff --name-only --diff-filter=ACMR HEAD");
  const nuevos = git("ls-files --others --exclude-standard");
  archivos = [...comparados.split("\n"), ...sinGuardar.split("\n"), ...nuevos.split("\n")];
} catch {
  console.error(
    `No se pudo comparar contra ${base}. Corre "git fetch origin" y vuelve a intentar.`,
  );
  process.exit(1);
}

archivos = [...new Set(archivos)].filter((a) => a && extensiones.test(a) && existsSync(a));

if (archivos.length === 0) {
  console.log("No hay archivos cambiados para revisar.");
  process.exit(0);
}

console.log(`Archivos a ${revisar ? "revisar" : "formatear"}: ${archivos.length}`);
const lista = archivos.map((a) => `"${a}"`).join(" ");
try {
  execSync(`npx prettier ${revisar ? "--check" : "--write"} --ignore-unknown ${lista}`, {
    stdio: "inherit",
  });
} catch {
  console.error('\nHay archivos sin formato. Corre "npm run format" y sube el cambio.');
  process.exit(1);
}
