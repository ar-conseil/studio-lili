#!/usr/bin/env node
// Pose l'IBAN affiché sur les factures de Lili (Réglages > entreprise), tapé par la personne qui lance le script.
//   node outils/iban.mjs
// L'IBAN n'est ni affiché, ni écrit dans le dépôt : il va seulement dans la base (table reglages, lisible par Lili seule).
// Lili peut aussi le saisir elle-même dans le studio : Réglages > « IBAN affiché sur les factures ».
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(join(homedir(), ".lili/supabase.env"), "utf8").split("\n").filter((l) => l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
const rl = createInterface({ input: process.stdin, output: process.stdout });
const brut = (await rl.question("IBAN de Lili : ")).replace(/\s+/g, "").toUpperCase();
rl.close();
// Contrôle de l'IBAN (clé ISO 13616, modulo 97)
const r = (brut.slice(4) + brut.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
let reste = 0; for (const ch of r) reste = (reste * 10 + +ch) % 97;
if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(brut) || reste !== 1) { console.log("Cet IBAN n'est pas valide : rien n'est enregistré."); process.exit(1); }
const iban = brut.replace(/(.{4})/g, "$1 ").trim();

const cles = await (await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })).json();
const admin = createClient(`https://${env.SUPABASE_PROJECT_REF}.supabase.co`, cles.find((k) => k.name === "service_role").api_key, { auth: { persistSession: false } });
const { data } = await admin.from("reglages").select("valeur").eq("cle", "entreprise").maybeSingle();
const { error } = await admin.from("reglages").upsert({ cle: "entreprise", valeur: { ...(data?.valeur || {}), iban_affiche: iban }, modifie_le: new Date().toISOString() }, { onConflict: "cle" });
console.log(error ? "Erreur : " + error.message : `IBAN enregistré (se termine par ${brut.slice(-4)}) : il apparaîtra sur les factures et devis.`);
