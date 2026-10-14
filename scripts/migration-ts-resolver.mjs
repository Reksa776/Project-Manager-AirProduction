/**
 * Loader resolusi untuk menjalankan skrip TypeScript migrasi lewat Node
 * (CLI snapshot). Hanya menyelesaikan alias `@/` → `src/` dan impor tanpa
 * ekstensi; tidak ada transformasi lain.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTS = ["", ".ts", ".mts", ".mjs", ".js"];
const INDEX_EXTS = [".ts", ".mts", ".mjs", ".js"];

function firstExistingFile(base) {
  for (const ext of EXTS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

function firstExistingIndex(base) {
  for (const ext of INDEX_EXTS) {
    const candidate = path.join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  let target;
  if (specifier.startsWith("@/")) {
    target = path.join(projectRoot, "src", specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (!target) return nextResolve(specifier, context);

  const resolved = firstExistingFile(target) ?? firstExistingIndex(target);
  if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
