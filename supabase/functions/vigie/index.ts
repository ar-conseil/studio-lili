// La vigie : l'agent de sécurité du studio, qui fait sa ronde toutes les 10 minutes, jour et nuit (pg_cron).
//  POST (x-cle-synchro) -> ronde complète ; POST { ronde: true } (Lili, avec son code) -> ronde à la demande
// Ce qu'elle surveille :
//  · la porte d'entrée : rafales d'échecs de mot de passe ou de code (par adresse IP, par compte), robots pris au piège ;
//  · les connexions de Lili : alerte si une adresse IP jamais vue en 60 jours se connecte à son compte ;
//  · les protections : chaque table protégée (RLS), rien d'ouvert aux visiteurs, stockage privé, inscriptions fermées,
//    fonctions sensibles fermées sans connexion ;
//  · l'activité : suppressions en masse (publications, médias à la corbeille).
// Chaque alerte est rangée (journal de sécurité, Réglages > Sécurité), sans doublon sur 6 heures ; les alertes et les
// alertes critiques sont envoyées à Lili (notification sur ses appareils et e-mail), même pendant ses vacances.
// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";
import { appelant, base, cors, estLili, json, parCron, SITE } from "../_partage/commun.ts";
import { envoyerDepuisLili, gabarit } from "../_partage/envoi.ts";

const URL_BASE = Deno.env.get("SUPABASE_URL") ?? "", ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const il = (min: number) => new Date(Date.now() - min * 60000).toISOString();
type Alerte = { cle: string; niveau: "info" | "alerte" | "critique"; titre: string; details?: any };

async function pousser(db: any, personne: string, titre: string, corps: string) {
  const pub = Deno.env.get("VAPID_PUBLIQUE"), priv = Deno.env.get("VAPID_PRIVEE");
  if (!pub || !priv) return;
  webpush.setVapidDetails(SITE, pub, priv);
  const { data } = await db.from("push_abonnements").select("abonnement").eq("personne_id", personne);
  for (const x of data ?? []) await webpush.sendNotification(x.abonnement, JSON.stringify({ titre, corps, url: SITE + "#reglages?onglet=securite", tag: "vigie" }), { TTL: 6 * 3600, urgency: "high" }).catch(() => null);
}

async function ronde(db: any) {
  const alertes: Alerte[] = [];
  // 1. La porte d'entrée (15 dernières minutes)
  const { data: ev } = await db.from("securite_evenements").select("type, compte, compte_empreinte, ip").gte("cree_le", il(15));
  const E = ev ?? [];
  const compter = (l: any[], k: string) => l.reduce((m: Map<string, number>, x: any) => (x[k] ? m.set(x[k], (m.get(x[k]) ?? 0) + 1) : m), new Map());
  for (const [ip, n] of compter(E.filter((x: any) => x.type === "echec_connexion"), "ip")) if (n >= 8)
    alertes.push({ cle: "rafale-ip-" + ip, niveau: n >= 25 ? "critique" : "alerte", titre: `${n} mots de passe faux en 15 minutes depuis l'adresse ${ip}`, details: { ip, tentatives: n } });
  const parCompte = compter(E.filter((x: any) => x.type === "echec_connexion"), "compte_empreinte");
  for (const [emp, n] of parCompte) if (n >= 5) {
    const compte = E.find((x: any) => x.compte_empreinte === emp)?.compte ?? "un compte";
    alertes.push({ cle: "rafale-compte-" + emp, niveau: "alerte", titre: `${n} mots de passe faux en 15 minutes sur le compte ${compte}`, details: { compte, tentatives: n } });
  }
  const codes = E.filter((x: any) => x.type === "echec_code").length;
  if (codes >= 5) alertes.push({ cle: "codes", niveau: "alerte", titre: `${codes} codes à 6 chiffres faux en 15 minutes`, details: { tentatives: codes } });
  const robots = E.filter((x: any) => ["piege", "automate", "trop_rapide"].includes(x.type));
  if (robots.length) alertes.push({ cle: "robots", niveau: robots.length >= 10 ? "alerte" : "info", titre: `${robots.length} tentative${robots.length > 1 ? "s" : ""} de robot bloquée${robots.length > 1 ? "s" : ""} à l'entrée`,
    details: { adresses: [...new Set(robots.map((x: any) => x.ip).filter(Boolean))].slice(0, 10) } });

  // 2. Connexions au compte de Lili depuis une adresse inconnue
  const { data: lili } = await db.from("personnes").select("id, email").eq("role", "proprietaire").order("cree_le").limit(1).maybeSingle();
  const { data: cx } = await db.rpc("vigie_connexions", { depuis: new Date(Date.now() - 60 * 86400000).toISOString() });
  if (lili?.email && Array.isArray(cx)) {
    const siens = cx.filter((x: any) => x.action === "login" && String(x.compte ?? "").toLowerCase() === lili.email.toLowerCase() && x.ip);
    const recentes = siens.filter((x: any) => x.cree_le >= il(15)), anciennes = new Set(siens.filter((x: any) => x.cree_le < il(15)).map((x: any) => x.ip));
    for (const x of recentes) if (anciennes.size && !anciennes.has(x.ip))
      alertes.push({ cle: "nouvelle-ip-" + x.ip, niveau: "alerte", titre: `Connexion au compte de Lili depuis une adresse jamais vue (${x.ip})`, details: { ip: x.ip, quand: x.cree_le, conseil: "Si ce n'est pas vous : changez le mot de passe et déconnectez les autres appareils (Réglages > Sécurité)." } });
  }

  // 3. Les protections de la base et du site
  const { data: c } = await db.rpc("vigie_controles");
  if (c?.sans_rls?.length) alertes.push({ cle: "sans-rls", niveau: "critique", titre: `Table sans protection : ${c.sans_rls.join(", ")}`, details: c });
  if (c?.ouvert_anon?.length) alertes.push({ cle: "ouvert-anon", niveau: "critique", titre: `Règle ouverte aux visiteurs : ${c.ouvert_anon.join(", ")}`, details: c });
  if (c?.stockage_public?.length) alertes.push({ cle: "stockage-public", niveau: "critique", titre: `Stockage public : ${c.stockage_public.join(", ")}`, details: c });
  try {
    const r = await (await fetch(`${URL_BASE}/auth/v1/settings`, { headers: { apikey: ANON } })).json();
    if (r.disable_signup === false) alertes.push({ cle: "inscriptions", niveau: "critique", titre: "Les inscriptions sont ouvertes à tous", details: {} });
  } catch { /* réglages illisibles : on retente à la prochaine ronde */ }
  for (const f of ["messagerie", "inviter", "assistant", "signer-devis"]) {
    const r = await fetch(`${URL_BASE}/functions/v1/${f}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    if (r && r.status < 400) alertes.push({ cle: "fonction-ouverte-" + f, niveau: "critique", titre: `La fonction « ${f} » répond sans connexion`, details: { statut: r.status } });
  }

  // 4. Activité anormale de la dernière heure
  const { count: pubs } = await db.from("publications").select("id", { count: "exact", head: true }).gte("corbeille_le", il(60));
  if ((pubs ?? 0) >= 15) alertes.push({ cle: "corbeille-publications", niveau: "alerte", titre: `${pubs} publications mises à la corbeille en une heure`, details: { nombre: pubs } });
  const { count: meds } = await db.from("medias").select("id", { count: "exact", head: true }).gte("corbeille_le", il(60));
  if ((meds ?? 0) >= 30) alertes.push({ cle: "corbeille-medias", niveau: "alerte", titre: `${meds} fichiers mis à la corbeille en une heure`, details: { nombre: meds } });

  // Ranger (sans doublon sur 6 heures) et prévenir Lili
  const { data: deja } = await db.from("securite_alertes").select("cle").gte("cree_le", il(360));
  const vues = new Set((deja ?? []).map((x: any) => x.cle));
  const nouvelles = alertes.filter((x) => !vues.has(x.cle));
  if (nouvelles.length) await db.from("securite_alertes").insert(nouvelles.map((x) => ({ cle: x.cle, niveau: x.niveau, titre: x.titre, details: x.details ?? {} })));
  const graves = nouvelles.filter((x) => x.niveau !== "info");
  if (graves.length && lili) {
    const titre = graves.some((x) => x.niveau === "critique") ? "Vigie : alerte critique" : "Vigie : alerte de sécurité";
    await pousser(db, lili.id, titre, graves.map((x) => x.titre).join(" · ").slice(0, 280));
    await envoyerDepuisLili(db, lili.email, titre, `${graves.map((x) => "- " + x.titre).join("\n")}\n\nJournal de sécurité : ${SITE}#reglages?onglet=securite\n`,
      gabarit({ couleur: "#A9553A", surtitre: "Studio Lili · vigie", titre, paragraphes: graves.map((x) => x.titre).concat(["Le détail est dans le journal de sécurité du studio."]),
        bouton: "Ouvrir le journal de sécurité", lien: SITE + "#reglages?onglet=securite", pied: "Message de la vigie du studio, qui veille jour et nuit." })).catch(() => false);
  }
  const statut = alertes.some((x) => x.niveau === "critique") ? "critique" : alertes.some((x) => x.niveau === "alerte") ? "alerte" : "ok";
  await db.from("reglages").upsert({ cle: "vigie", valeur: { derniere_ronde: new Date().toISOString(), statut, constats: alertes.length }, modifie_le: new Date().toISOString() }, { onConflict: "cle" });
  // Ménage : traces de la porte gardées 90 jours
  await db.from("securite_evenements").delete().lt("cree_le", new Date(Date.now() - 90 * 86400000).toISOString());
  return { statut, constats: alertes.length, nouvelles: nouvelles.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base();
  if (!parCron(req) && !estLili(await appelant(db, req))) return json({ erreur: "non autorisé" }, 401);
  try { return json(await ronde(db)); } catch (e) { return json({ erreur: (e as Error).message }, 500); }
});
