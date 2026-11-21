#!/usr/bin/env node
// Recette en ligne, côté client : prépare l'espace « client démo » (marque fictive) et son compte, se connecte COMME ce
// client sur la vraie base (lien magique généré par le serveur : aucun mot de passe), et vérifie ce qu'il peut voir et
// faire, et surtout ce qu'il ne peut pas : les autres clients, l'interne, la facturation, les fichiers des autres.
//   node outils/recette.mjs            prépare (si besoin), vérifie, remet l'espace démo dans son état de départ
//   node outils/recette.mjs --lien     de plus, écrit dans ~/.lili/recette-lien.txt un lien de connexion (24 h) pour
//                                      parcourir le site comme le client démo
// Lit ~/.lili/supabase.env ; la clé service_role est demandée à l'API d'administration et ne quitte pas la mémoire.
// Les vraies données ne sont que lues (un seul chemin de fichier d'un autre espace, pour tenter de l'ouvrir) ; rien
// n'en est affiché ni écrit. L'espace démo est « archivé » : il n'apparaît pas dans le studio de Lili (adresse #client-demo).
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(join(homedir(), ".lili/supabase.env"), "utf8").split("\n").filter((l) => l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
const URL_BASE = `https://${env.SUPABASE_PROJECT_REF}.supabase.co`;
const ANON = /cle:\s*"([^"]+)"/.exec(readFileSync(new URL("../assets/config.js", import.meta.url), "utf8"))[1];
const cles = await (await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })).json();
const SERVICE = cles.find((k) => k.name === "service_role")?.api_key;
if (!SERVICE) throw new Error("clé service_role introuvable");
const admin = createClient(URL_BASE, SERVICE, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// 1. L'espace « client démo » : une marque fictive, présentée comme telle
// ---------------------------------------------------------------------------
const ESPACE = "c1e00000-0000-4000-a000-00000000de30", EMAIL = "client-demo@studio-lili.invalid";
const PUBS = {
  aValider: "c1e00000-0000-4000-a000-0000000000a1", valide: "c1e00000-0000-4000-a000-0000000000a2",
  idee: "c1e00000-0000-4000-a000-0000000000a3", enCreation: "c1e00000-0000-4000-a000-0000000000a4",
};
const ok = (r, quoi) => { if (r.error) throw new Error(`${quoi} : ${r.error.message}`); return r.data; };
const { data: lili } = await admin.from("personnes").select("id").eq("role", "proprietaire").limit(1).maybeSingle();
if (!lili) throw new Error("compte de Lili introuvable");
ok(await admin.from("espaces").upsert({ id: ESPACE, slug: "client-demo", nom: "Atelier Exemple (démonstration)", statut: "archive", couleur: "#5B6B4E",
  reseaux: ["instagram", "facebook"], ordre: 99 }), "espace démo");
ok(await admin.from("espaces_prive").upsert({ espace_id: ESPACE, raison_sociale: "Atelier Exemple (fictif)", forfait_mensuel_ht: 400, heures_forfait: 8,
  note_interne: "Espace de démonstration pour la recette : marque fictive." }), "partie privée");
const jour = (n, h = 12) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 30, 0, 0); return d.toISOString(); };
ok(await admin.from("publications").upsert([
  { id: PUBS.aValider, espace_id: ESPACE, titre: "Démonstration : vase de la semaine", legende: "Un vase tourné à la main (texte de démonstration).", reseaux: ["instagram"], format: "post", statut: "a-valider", visibilite: "partage", date_prevue: jour(3), auteur_id: lili.id, envoye_le: new Date().toISOString() },
  { id: PUBS.valide, espace_id: ESPACE, titre: "Démonstration : coulisses de l'atelier", legende: "Texte de démonstration.", reseaux: ["instagram"], format: "carrousel", statut: "valide", visibilite: "partage", date_prevue: jour(6), auteur_id: lili.id },
  { id: PUBS.idee, espace_id: ESPACE, titre: "Démonstration : idée interne de Lili", legende: "", reseaux: ["instagram"], format: "reel", statut: "idee", visibilite: "interne", auteur_id: lili.id },
  { id: PUBS.enCreation, espace_id: ESPACE, titre: "Démonstration : en création", legende: "", reseaux: ["facebook"], format: "post", statut: "en-creation", visibilite: "interne", date_prevue: jour(9), auteur_id: lili.id },
]), "publications démo");
await admin.from("notes_internes").delete().eq("espace_id", ESPACE);
ok(await admin.from("notes_internes").insert({ espace_id: ESPACE, contenu: "Note interne de démonstration : jamais visible du client." }), "note interne");
ok(await admin.from("briefs").upsert({ espace_id: ESPACE, cible: "Amateurs de céramique (démonstration)", ton: "Simple et chaleureux", piliers: ["Pièces de la semaine", "Coulisses"], visibilite: "partage" }), "brief");

// Le compte du client démo : rôle « client » posé par le serveur
let { data: deja } = await admin.from("personnes").select("id").eq("email", EMAIL).maybeSingle();
let clientId = deja?.id;
if (!clientId) {
  const u = ok(await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, app_metadata: { role: "client" }, user_metadata: { nom: "Client démo" } }), "compte démo");
  clientId = u.user.id;
}
ok(await admin.from("personnes").update({ nom: "Client démo", role: "client" }).eq("id", clientId), "personne démo");
ok(await admin.from("membres").upsert({ espace_id: ESPACE, personne_id: clientId, role: "client", fonction: "Compte de démonstration", notifier_mail: false }, { onConflict: "espace_id,personne_id" }), "membre démo");

// ---------------------------------------------------------------------------
// 2. Connexion comme le client démo (lien magique vérifié par le script, sans mot de passe)
// ---------------------------------------------------------------------------
const lien = ok(await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL }), "lien");
const client = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
ok(await client.auth.verifyOtp({ token_hash: lien.properties.hashed_token, type: "magiclink" }), "connexion du client démo");

// Un fichier et une publication d'un AUTRE espace (lus par le serveur, jamais affichés)
const { data: autreMedia } = await admin.from("medias").select("chemin, espace_id").neq("espace_id", ESPACE).limit(1).maybeSingle();
const { data: autrePub } = await admin.from("publications").select("id, espace_id").neq("espace_id", ESPACE).eq("visibilite", "partage").limit(1).maybeSingle();

let echecs = 0, n = 0;
const verifier = (cond, texte) => { n++; if (cond) console.log("   ok  " + texte); else { echecs++; console.log("   ÉCHEC  " + texte); } };
const lire = async (table, filtre) => { let q = client.from(table).select("*"); if (filtre) q = filtre(q); const r = await q; return r.error ? { erreur: r.error.message, lignes: [] } : { lignes: r.data }; };

console.log("Ce que voit le client démo");
const esp = await lire("espaces");
verifier(esp.lignes.length === 1 && esp.lignes[0].id === ESPACE, "il ne voit que son espace (aucun vrai client)");
const pubs = await lire("publications");
verifier(pubs.lignes.every((p) => p.espace_id === ESPACE), "aucune publication d'un autre espace");
verifier(pubs.lignes.some((p) => p.id === PUBS.aValider) && pubs.lignes.some((p) => p.id === PUBS.valide), "il voit les publications partagées");
verifier(!pubs.lignes.some((p) => p.id === PUBS.idee || p.id === PUBS.enCreation), "il ne voit ni les idées ni l'« en création » internes");
for (const t of ["notes_internes", "espaces_prive", "taches", "temps", "factures", "devis", "prospects", "reglages", "briefs_jour", "assistant_journal", "comptes_mail"]) {
  const r = await lire(t);
  verifier(r.lignes.length === 0, `rien dans « ${t} »`);
}
const membres = await lire("membres");
verifier(membres.lignes.every((m) => m.espace_id === ESPACE), "il ne voit que les membres de son espace");
const personnes = await lire("personnes");
verifier(personnes.lignes.length <= 3, "il ne voit pas les personnes des autres clients");
const medias = await lire("medias");
verifier(medias.lignes.every((m) => m.espace_id === ESPACE), "aucun média d'un autre espace");
const brief = await lire("briefs");
verifier(brief.lignes.length === 1 && brief.lignes[0].espace_id === ESPACE, "il lit le brief partagé de son espace, et lui seul");
if (autreMedia) {
  const s = await client.storage.from("medias").createSignedUrl(autreMedia.chemin, 60);
  verifier(!!s.error || !s.data?.signedUrl, "il ne peut pas ouvrir un fichier d'un autre client");
}
const liste = await client.storage.from("medias").list(autreMedia ? autreMedia.espace_id : "x");
verifier((liste.data || []).length === 0, "il ne peut pas lister les fichiers d'un autre client");

console.log("Ce que fait le client démo");
const rep = await client.rpc("repondre_publication", { p_id: PUBS.aValider, p_decision: "modifs-demandees", p_message: "Démonstration : un peu plus de lumière ?" });
verifier(!rep.error, "il demande une modification sur sa publication");
const rep2 = await client.rpc("repondre_publication", { p_id: PUBS.aValider, p_decision: "valide" });
verifier(!!rep2.error, "il ne peut pas valider une publication qui n'est plus « à valider »");
if (autrePub) {
  const r = await client.rpc("repondre_publication", { p_id: autrePub.id, p_decision: "valide" });
  verifier(!!r.error, "il ne peut pas répondre à la publication d'un autre client");
  const c = await client.from("commentaires").insert({ publication_id: autrePub.id, contenu: "intrus", cible: "general" });
  verifier(!!c.error, "il ne peut pas commenter chez un autre client");
}
const upd = await client.from("publications").update({ statut: "publie" }).eq("id", PUBS.valide).select();
verifier(!!upd.error || (upd.data || []).length === 0, "il ne peut pas changer un statut directement");
const com = await client.from("commentaires").insert({ publication_id: PUBS.valide, auteur_id: clientId, contenu: "Démonstration : parfait pour moi.", cible: "general", visibilite: "partage" }).select();
verifier(!com.error, "il commente sa publication");
const png = readFileSync(new URL("../assets/marque/icone-192.png", import.meta.url));
const chemin = `${ESPACE}/recette-${Date.now()}.png`;
const dep = await client.storage.from("medias").upload(chemin, png, { contentType: "image/png" });
verifier(!dep.error, "il dépose un fichier dans son espace");
const dep2 = autreMedia ? await client.storage.from("medias").upload(`${autreMedia.espace_id}/intrus-${Date.now()}.png`, png, { contentType: "image/png" }) : { error: true };
verifier(!!dep2.error, "il ne peut pas déposer chez un autre client");
const msg = await client.from("messages").insert({ espace_id: ESPACE, auteur_id: clientId, contenu: "Démonstration : bonjour Lili.", pieces: [] }).select();
verifier(!msg.error, "il écrit un message à Lili");
const jeton = (await client.auth.getSession()).data.session.access_token;
for (const f of ["inviter", "assistant", "messagerie", "brief-du-jour"]) {
  const r = await fetch(`${URL_BASE}/functions/v1/${f}`, { method: "POST", headers: { Authorization: `Bearer ${jeton}`, apikey: ANON, "Content-Type": "application/json" }, body: "{}" });
  verifier(r.status === 401 || r.status === 403, `la fonction « ${f} » lui est fermée`);
}

// ---------------------------------------------------------------------------
// 3. Retour à l'état de départ (et pas de notification de recette pour Lili)
// ---------------------------------------------------------------------------
await client.auth.signOut();
await admin.storage.from("medias").remove([chemin]);
await admin.from("commentaires").delete().in("publication_id", Object.values(PUBS));
await admin.from("messages").delete().eq("espace_id", ESPACE);
await admin.from("publications").update({ statut: "a-valider" }).eq("id", PUBS.aValider);
await admin.from("versions").delete().in("publication_id", Object.values(PUBS)).gt("numero", 1);
const { data: journal } = await admin.from("journal").select("id").eq("espace_id", ESPACE);   // espace fictif : tout son journal est de la recette
if (journal?.length) { await admin.from("notifications").delete().in("journal_id", journal.map((j) => j.id)); await admin.from("journal").delete().in("id", journal.map((j) => j.id)); }
await admin.from("medias").delete().eq("espace_id", ESPACE).like("chemin", "%/recette-%");

if (process.argv.includes("--lien")) {
  const l = ok(await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL, options: { redirectTo: "https://ar-conseil.github.io/studio-lili/" } }), "lien de parcours");
  writeFileSync(join(homedir(), ".lili/recette-lien.txt"), l.properties.action_link + "\n", { mode: 0o600 });
  console.log("Lien de parcours (24 h, une fois) écrit dans ~/.lili/recette-lien.txt");
}
console.log(echecs ? `${echecs} écart(s) sur ${n} vérifications.` : `Les ${n} vérifications passent.`);
process.exit(echecs ? 1 : 0);
