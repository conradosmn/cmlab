// Copia para public/ os arquivos que as ferramentas do Laboratório carregam no
// navegador: fontes (OFL, via @fontsource) e o motor de sólidos manifold-3d.
// Uso: node scripts/copy-lab-assets.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const nm = path.join(root, "node_modules");

export const LAB_FONTS = [
  ["luckiest-guy", "400"],
  ["lilita-one", "400"],
  ["chewy", "400"],
  ["bangers", "400"],
  ["bubblegum-sans", "400"],
  ["titan-one", "400"],
  ["bungee", "400"],
  ["righteous", "400"],
  ["alfa-slab-one", "400"],
  ["permanent-marker", "400"],
  ["fredoka", "700"],
  ["pacifico", "400"],
];

const fontDir = path.join(root, "public", "fonts", "lab");
fs.mkdirSync(fontDir, { recursive: true });
const licenses = [];
for (const [pkg, weight] of LAB_FONTS) {
  const src = path.join(nm, "@fontsource", pkg, "files", `${pkg}-latin-${weight}-normal.woff`);
  fs.copyFileSync(src, path.join(fontDir, `${pkg}.woff`));
  const lic = path.join(nm, "@fontsource", pkg, "LICENSE");
  if (fs.existsSync(lic)) licenses.push(`==== ${pkg} ====\n${fs.readFileSync(lic, "utf-8")}`);
}
fs.writeFileSync(path.join(fontDir, "LICENSES.txt"), licenses.join("\n\n"));

const labDir = path.join(root, "public", "lab");
fs.mkdirSync(labDir, { recursive: true });
fs.copyFileSync(path.join(nm, "manifold-3d", "manifold.wasm"), path.join(labDir, "manifold.wasm"));

console.log(`${LAB_FONTS.length} fontes e manifold.wasm copiados.`);
