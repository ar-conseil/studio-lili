// Crochet d'envoi des e-mails de connexion de Supabase Auth (« Send Email Hook ») : mot de passe oublié, lien de
// connexion, changement d'adresse. Supabase n'envoie plus rien lui-même (son service intégré n'écrit qu'aux membres de
// l'organisation) : il confie chaque e-mail à cette fonction, qui l'envoie depuis la boîte Gmail de Lili, à ses couleurs.
// Ce sont des e-mails demandés par la personne elle-même (elle a cliqué « Mot de passe oublié » ou « Recevoir un lien »).
// Appel signé par Supabase (Standard Webhooks, secret SEND_EMAIL_HOOK_SECRET) ; tout autre appel est refusé.
// Sans boîte Gmail reliée : erreur « sending unavailable », que l'écran d'entrée traduit (« demandez un lien à Lili »).
// deno-lint-ignore-file no-explicit-any
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { base, json, SITE } from "../_partage/commun.ts";
import { envoyerDepuisLili, gabarit } from "../_partage/envoi.ts";

const SECRET = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
const URL_BASE = Deno.env.get("SUPABASE_URL") ?? "";
const erreur = (http_code: number, message: string) => json({ error: { http_code, message } }, http_code);

const TEXTES: Record<string, { objet: string; titre: string; phrase: string; bouton: string }> = {
  recovery: { objet: "Choisir un nouveau mot de passe", titre: "Nouveau mot de passe", bouton: "Choisir mon mot de passe",
    phrase: "Vous avez demandé à changer votre mot de passe. Le bouton ci-dessous vous y mène (valable une heure, une seule fois)." },
  magiclink: { objet: "Votre lien de connexion", titre: "Votre lien de connexion", bouton: "Entrer dans mon espace",
    phrase: "Voici le lien demandé pour entrer dans votre espace, sans mot de passe (valable une heure, une seule fois)." },
  email_change: { objet: "Confirmer votre nouvelle adresse", titre: "Confirmer votre adresse", bouton: "Confirmer",
    phrase: "Confirmez cette adresse e-mail pour votre espace." },
  invite: { objet: "Votre espace vous attend", titre: "Votre espace vous attend", bouton: "Entrer dans mon espace",
    phrase: "Lili Rouzier vous ouvre votre espace. À l'arrivée, vous choisirez votre mot de passe (lien valable 24 h, une seule fois)." },
  signup: { objet: "Confirmer votre adresse", titre: "Confirmer votre adresse", bouton: "Confirmer",
    phrase: "Confirmez votre adresse e-mail pour entrer dans votre espace." },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return erreur(405, "method not allowed");
  if (!SECRET) return erreur(500, "Email sending unavailable: hook secret missing");
  const corps = await req.text();
  let donnees: any;
  try { donnees = new Webhook(SECRET).verify(corps, Object.fromEntries(req.headers)); }
  catch { return erreur(401, "invalid signature"); }

  const email = String(donnees?.user?.email ?? "").trim();
  const d = donnees?.email_data ?? {};
  const type = String(d.email_action_type ?? "");
  if (!email || !d.token_hash) return erreur(400, "incomplete payload");
  const t = TEXTES[type] ?? TEXTES.magiclink;
  const retour = d.redirect_to || SITE;
  const lien = `${URL_BASE}/auth/v1/verify?token=${encodeURIComponent(d.token_hash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(retour)}`;
  const db = base();
  try {
    const envoye = await envoyerDepuisLili(db, email, t.objet,
      `Bonjour,\n\n${t.phrase}\n\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne change.\n\nLili Rouzier, community manager`,
      gabarit({ surtitre: "Votre espace · Lili Rouzier", titre: t.titre, paragraphes: ["Bonjour,", t.phrase], bouton: t.bouton, lien,
        pied: "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne change." }));
    if (!envoye) return erreur(500, "Email sending unavailable: Lili's mailbox is not linked yet");
  } catch (e) {
    console.error("envoi-auth :", (e as Error).message);
    return erreur(500, "Email sending failed");
  }
  return json({});
});
