#!/usr/bin/env node
// Tests des droits sur le Mac, sans projet en ligne : un vrai Postgres (PGlite) avec une imitation de Supabase,
// les migrations du dépôt, puis supabase/tests/droits.sql. Lancer : npm test (après npm install, une fois).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(racine, f), "utf8");
const db = new PGlite();
const etape = async (nom, sql) => {
  try { await db.exec(sql); console.log("   ok  " + nom); }
  catch (e) { console.error("   ERREUR dans " + nom + " : " + e.message); process.exit(1); }
};

console.log("Imitation de Supabase");
await etape("supabase-local.sql", lire("supabase/tests/supabase-local.sql"));
console.log("Migrations");
for (const m of readdirSync(join(racine, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort())
  await etape(m, lire("supabase/migrations/" + m));
console.log("Tests des droits");
await etape("droits.sql", lire("supabase/tests/droits.sql"));
console.log("Tous les tests des droits passent.");
