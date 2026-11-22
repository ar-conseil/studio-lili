// Signature électronique d'un devis par le client, dans son espace, comme dans Evoalys : un code à 6 chiffres reçu par
// e-mail, à saisir pour signer, en plus de la signature tracée.
//  POST { action: "code", devis_id }                                  -> envoie le code à l'adresse du client (10 min, 5 essais)
//  POST { action: "signer", devis_id, code, nom, signature, accord }  -> { ok, signe_le, empreinte }
// Preuve gardée (table devis_signatures) : nom saisi, signature tracée, adresse vérifiée par le code et heure de
// vérification, date et heure de signature, adresse IP, navigateur, empreinte SHA-256 du contenu du devis.
// Le code part de la boîte Gmail de Lili, à la demande du client lui-même (son clic « Recevoir mon code »).
// deno-lint-ignore-file no-explicit-any
import { appelant, base, cors, json } from "../_partage/commun.ts";
import { envoyerDepuisLili, gabarit } from "../_partage/envoi.ts";

const auj = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
const sha = async (t: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((x) => x.toString(16).padStart(2, "0")).join("");
const euros = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(+n || 0);
const masque = (e: string) => e.replace(/^(.)(.*)(.@)/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base(), a = await appelant(db, req);
  if (!a) return json({ erreur: "connectez-vous pour signer" }, 401);
  const b = await req.json().catch(() => ({}));
  const { data: d } = await db.from("devis").select("*").eq("id", String(b.devis_id ?? "")).maybeSingle();
  if (!d || !d.espace_id) return json({ erreur: "devis introuvable" }, 404);
  const { data: m } = await db.from("membres").select("role").eq("espace_id", d.espace_id).eq("personne_id", a.id).maybeSingle();
  if (m?.role !== "client") return json({ erreur: "ce devis n'est pas dans votre espace" }, 403);
  if (d.statut !== "envoye") return json({ erreur: d.statut === "accepte" ? "ce devis est déjà signé" : "ce devis n'est pas à signer" }, 409);
  if (d.valable_jusque && d.valable_jusque < auj()) return json({ erreur: "ce devis a expiré : demandez-en un nouveau à Lili" }, 409);
  // Un client qui a activé son code à 6 chiffres doit l'avoir saisi pour signer (comme pour lire son espace)
  if (a.aal !== "aal2") {
    const { data: f } = await db.auth.admin.mfa.listFactors({ userId: a.id }).catch(() => ({ data: null }));
    if ((f?.factors ?? []).some((x: any) => x.status === "verified")) return json({ erreur: "saisissez d'abord votre code à 6 chiffres" }, 403);
  }
  const email = String(a.personne?.email ?? "").trim().toLowerCase();
  if (!email) return json({ erreur: "votre compte n'a pas d'adresse e-mail" }, 400);

  // 1. Le code : 6 chiffres, envoyé par e-mail, gardé seulement sous forme d'empreinte
  if (b.action === "code") {
    const { data: deja } = await db.from("devis_codes").select("cree_le, envois, envois_depuis").eq("devis_id", d.id).eq("personne_id", a.id).maybeSingle();
    if (deja && Date.now() - Date.parse(deja.cree_le) < 45000) return json({ erreur: "un code vient de partir : attendez une minute avant d'en demander un autre" }, 429);
    // Au plus 5 codes par heure pour un même devis
    const dansLHeure = deja && Date.now() - Date.parse(deja.envois_depuis) < 3600000;
    if (dansLHeure && deja.envois >= 5) return json({ erreur: "trop de codes demandés : réessayez dans une heure" }, 429);
    const envois = dansLHeure ? deja.envois + 1 : 1, envoisDepuis = dansLHeure ? deja.envois_depuis : new Date().toISOString();
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const { data: e } = await db.from("espaces").select("nom, couleur").eq("id", d.espace_id).maybeSingle();
    const envoye = await envoyerDepuisLili(db, email, `Votre code de signature : ${code}`,
      `Bonjour,\n\nVotre code pour signer le devis ${d.numero ?? ""} « ${d.objet ?? ""} » (${euros(d.total_ttc)} TTC) : ${code}\n\nIl est valable 10 minutes. Si vous n'avez rien demandé, ignorez ce message : rien n'est signé sans ce code.\n`,
      gabarit({ couleur: e?.couleur, surtitre: `${e?.nom ?? ""} · signature du devis ${d.numero ?? ""}`, titre: code,
        paragraphes: ["Bonjour,", `Voici votre code pour signer le devis « ${d.objet ?? ""} » (${euros(d.total_ttc)} TTC). Saisissez-le dans votre espace pour finaliser la signature.`, "Il est valable 10 minutes."],
        bouton: "Revenir à mon espace", lien: undefined, pied: "Si vous n'avez rien demandé, ignorez ce message : rien n'est signé sans ce code." }))
      .catch((x) => { console.error("signer-devis : e-mail", (x as Error).message); return false; });
    if (!envoye) return json({ erreur: "le code n'a pas pu partir par e-mail : prévenez Lili (rubrique Messages)" }, 503);
    await db.from("devis_codes").upsert({ devis_id: d.id, personne_id: a.id, code_hash: await sha(d.id + ":" + code), email, expire_le: new Date(Date.now() + 10 * 60000).toISOString(), essais: 0, cree_le: new Date().toISOString(), envois, envois_depuis: envoisDepuis },
      { onConflict: "devis_id,personne_id" });
    return json({ ok: true, email: masque(email) });
  }

  // 2. La signature : code juste, puis preuve
  const { data: c } = await db.from("devis_codes").select("*").eq("devis_id", d.id).eq("personne_id", a.id).maybeSingle();
  if (!c) return json({ erreur: "demandez d'abord votre code par e-mail" }, 400);
  if (Date.parse(c.expire_le) < Date.now()) return json({ erreur: "ce code a expiré : demandez-en un nouveau" }, 400);
  // L'essai est compté avant la comparaison, en une seule opération dans la base : des requêtes simultanées ne passent pas
  const { data: essai } = await db.rpc("devis_prendre_essai", { p_devis: d.id, p_personne: a.id });
  if (essai == null) return json({ erreur: "trop d'essais : demandez un nouveau code" }, 429);
  if (await sha(d.id + ":" + String(b.code ?? "").replace(/\D/g, "")) !== c.code_hash) {
    const reste = 5 - Number(essai);
    return json({ erreur: reste > 0 ? `code incorrect (${reste} essai${reste > 1 ? "s" : ""} restant${reste > 1 ? "s" : ""})` : "code incorrect : demandez un nouveau code" }, 400);
  }
  const verifieLe = new Date().toISOString();
  const nom = String(b.nom ?? "").trim().slice(0, 120), signature = String(b.signature ?? "");
  if (!b.accord) return json({ erreur: "cochez « Bon pour accord »" }, 400);
  if (nom.length < 3) return json({ erreur: "indiquez votre nom" }, 400);
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length > 400_000) return json({ erreur: "signature illisible : tracez-la à nouveau" }, 400);

  const contenu = JSON.stringify({ numero: d.numero, objet: d.objet, lignes: d.lignes, total_ht: d.total_ht, total_tva: d.total_tva, total_ttc: d.total_ttc, valable_jusque: d.valable_jusque });
  const empreinte = await sha(contenu);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
  const signe_le = new Date().toISOString();
  const { error } = await db.from("devis_signatures").insert({ devis_id: d.id, personne_id: a.id, nom_signataire: nom, signature, empreinte, ip,
    agent: (req.headers.get("user-agent") ?? "").slice(0, 300), signe_le, email_verifie: c.email, code_verifie_le: verifieLe });
  if (error) return json({ erreur: /duplicate/i.test(error.message) ? "ce devis est déjà signé" : error.message }, 409);
  await db.from("devis_codes").delete().eq("devis_id", d.id).eq("personne_id", a.id);
  await db.from("devis").update({ statut: "accepte" }).eq("id", d.id);
  await db.from("journal").insert({ espace_id: d.espace_id, acteur_id: a.id, action: "devis.signe", objet_type: "devis", objet_id: d.id,
    details: { numero: d.numero, objet: d.objet, nom }, visibilite: "partage" });
  return json({ ok: true, signe_le, empreinte, email_verifie: c.email });
});
