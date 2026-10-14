/** Registrasi loader resolver migrasi (dipakai via `node --import`). */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./migration-ts-resolver.mjs", pathToFileURL(`${import.meta.dirname}/`));
