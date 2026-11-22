// La garde de la porte d'entrée : l'écran de connexion lui signale les échecs (mot de passe, code à 6 chiffres) et les
// robots pris au piège. Elle note l'adresse IP et le navigateur ; la vigie analyse ces traces à chaque ronde.
//  POST { type: "echec_connexion" | "echec_code" | "piege" | "automate" | "trop_rapide", email? }  (sans connexion)
// L'adresse e-mail n'est jamais gardée en clair : une version masquée (l•••@gmail.com) et son empreinte SHA-256.
// Protégée contre l'inondation : au plus 60 traces par minute et par adresse IP.
// deno-lint-ignore-file no-explicit-any
import { base, cors, json } from "../_partage/commun.ts";

const TYPES = ["echec_connexion", "echec_code", "piege", "automate", "trop_rapide"];
const masque = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(5, Math.max(1, b.length))) + c);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erreur: "non" }, 405);
  const b = await req.json().catch(() => ({}));
  if (!TYPES.includes(b.type)) return json({ erreur: "type inconnu" }, 400);
  const db = base();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
  if (ip) {
    const { count } = await db.from("securite_evenements").select("id", { count: "exact", head: true }).eq("ip", ip).gte("cree_le", new Date(Date.now() - 60000).toISOString());
    if ((count ?? 0) >= 60) return json({ ok: true });   // inondation : on n'écrit plus, la vigie a déjà de quoi alerter
  }
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const empreinte = email ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email)))].map((x) => x.toString(16).padStart(2, "0")).join("") : null;
  await db.from("securite_evenements").insert({ type: b.type, compte: email && /@/.test(email) ? masque(email) : null, compte_empreinte: empreinte, ip,
    agent: (req.headers.get("user-agent") ?? "").slice(0, 250) });
  return json({ ok: true });
});
