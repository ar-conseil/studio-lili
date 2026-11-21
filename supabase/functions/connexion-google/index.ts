// Relier la boîte Gmail de Lili au studio.
//  POST (session de Lili avec son code)  -> { url } de la page d'autorisation Google
//  GET  ?code=…&state=… (retour de Google) -> enregistre la boîte (jetons côté serveur) puis revient sur la page Mails
import { appelant, base, cors, estLili, json, SITE } from "../_partage/commun.ts";
import { echangerCode, lireEtat, signerEtat, urlAutorisation } from "../_partage/google.ts";

const retour = (message: string) => Response.redirect(`${SITE}#mails?message=${encodeURIComponent(message)}`, 302);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base();
  if (req.method === "POST") {
    const a = await appelant(db, req);
    if (!estLili(a)) return json({ erreur: "réservé à Lili, avec son code à 6 chiffres" }, 403);
    if (!Deno.env.get("GOOGLE_CLIENT_ID")) return json({ erreur: "l'accès Google n'est pas encore configuré" }, 400);
    return json({ url: urlAutorisation(await signerEtat(a!.id), a!.personne?.email ?? undefined) });
  }
  const p = new URL(req.url).searchParams;
  if (p.get("error")) return retour(p.get("error") === "access_denied" ? "Connexion annulée." : `Connexion refusée : ${p.get("error_description") || p.get("error")}`);
  const etat = await lireEtat(p.get("state") ?? ""), code = p.get("code");
  if (!etat || !code) return retour("Lien de connexion expiré : recommencez.");
  try {
    const j = await echangerCode(code);
    if (!/gmail\.modify/.test(j.droits ?? "")) return retour("Google n'a pas donné l'accès aux mails : recommencez en cochant l'accès à Gmail.");
    const { data: existant } = await db.from("comptes_mail").select("refresh_token").eq("email", j.email).maybeSingle();
    const { error } = await db.from("comptes_mail").upsert({ personne_id: etat.p, fournisseur: "google", email: j.email,
      refresh_token: j.refresh_token ?? existant?.refresh_token ?? null, jeton_acces: j.jeton_acces, jeton_expire_le: j.jeton_expire_le,
      droits: j.droits, derniere_erreur: null }, { onConflict: "email" });
    if (error) throw new Error(error.message);
    return retour(`Boîte ${j.email} reliée au studio.`);
  } catch (e) {
    return retour(`Connexion impossible : ${e instanceof Error ? e.message : String(e)}`);
  }
});
