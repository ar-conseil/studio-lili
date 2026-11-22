// Outils communs aux fonctions serveur du studio : réponses, base en service, identité de l'appelant.
// Les fonctions sont déployées sans vérification automatique du jeton (--no-verify-jwt) : chacune vérifie elle-même
// l'appelant (session Supabase de Lili avec son code à 6 chiffres, ou clé de synchro des tâches planifiées).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const SITE = Deno.env.get("SITE_URL") ?? "https://ar-conseil.github.io/studio-lili/";
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cle-synchro",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { ...cors, "Content-Type": "application/json" } });
export const base = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
export type Appelant = { id: string; role: string; aal: string; personne: any } | null;
// Personne connectée (jeton vérifié par Supabase), son rôle et son niveau d'authentification (aal2 = code saisi)
// deno-lint-ignore no-explicit-any
export async function appelant(db: any, req: Request): Promise<Appelant> {
  const jeton = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jeton) return null;
  const { data } = await db.auth.getUser(jeton);
  if (!data?.user) return null;
  let aal = "aal1";
  try { aal = JSON.parse(atob(jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal ?? "aal1"; } catch { /* jeton illisible : aal1 */ }
  const { data: p } = await db.from("personnes").select("*").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, role: p?.role ?? "client", aal, personne: p };
}
// Lili, avec son code saisi : seule à lire ses mails ou relier sa boîte
export const estLili = (a: Appelant) => !!a && a.role === "proprietaire" && a.aal === "aal2";
// Tâche planifiée (pg_cron) : clé de synchro partagée avec la base (coffre « vault »)
export const parCron = (req: Request) => {
  const c = Deno.env.get("CLE_SYNCHRO") ?? "";
  return !!c && req.headers.get("x-cle-synchro") === c;
};
// Adresse IP de l'appelant : d'abord l'en-tête posé par l'infrastructure (Cloudflare, impossible à imiter), puis
// x-real-ip ; x-forwarded-for en dernier recours seulement (sa première valeur peut être écrite par le navigateur).
export const ipAppelant = (req: Request) =>
  req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean).pop() || null;
