// Inviter une personne dans l'espace d'un client (Lili seule, avec son code à 6 chiffres) :
//  POST { email, nom, espace_id, role: "client" | "invite", fonction? }
//   -> compte créé s'il n'existe pas (rôle posé côté serveur), membre de l'espace, lien de connexion valable 24 h ;
//      envoyé depuis la boîte Gmail de Lili si elle est reliée (c'est le clic de Lili qui l'envoie), sinon rendu
//      pour qu'elle le transmette elle-même.  -> { envoye: true } | { lien }
//  POST { retirer: true, espace_id, personne_id } -> retire la personne de l'espace (son compte reste)
// deno-lint-ignore-file no-explicit-any
import { appelant, base, cors, estLili, json, SITE } from "../_partage/commun.ts";
import { envoyerDepuisLili, gabarit } from "../_partage/envoi.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base();
  const a = await appelant(db, req);
  if (!estLili(a)) return json({ erreur: "réservé à Lili, avec son code à 6 chiffres" }, 403);
  const b = await req.json().catch(() => ({}));
  const { data: espace } = await db.from("espaces").select("id, nom, couleur").eq("id", b.espace_id).maybeSingle();
  if (!espace) return json({ erreur: "espace inconnu" }, 404);

  if (b.retirer) {
    const { error } = await db.from("membres").delete().eq("espace_id", espace.id).eq("personne_id", b.personne_id);
    return error ? json({ erreur: error.message }, 400) : json({ ok: true });
  }

  const email = String(b.email ?? "").trim().toLowerCase(), nom = String(b.nom ?? "").trim().slice(0, 120);
  const role = b.role === "invite" ? "invite" : "client";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ erreur: "adresse e-mail invalide" }, 400);
  try {
    const { data: deja } = await db.from("personnes").select("id, role, nom").eq("email", email).maybeSingle();
    if (deja?.role === "proprietaire") return json({ erreur: "c'est l'adresse de Lili" }, 400);
    // Lien de connexion : invitation pour un nouveau compte, lien magique pour un compte existant
    const { data: lien, error } = await db.auth.admin.generateLink({ type: deja ? "magiclink" : "invite", email,
      options: { redirectTo: SITE, data: deja ? undefined : { nom } } });
    if (error) throw error;
    const id = deja?.id ?? lien.user.id;
    if (!deja) {
      await db.auth.admin.updateUserById(id, { app_metadata: { role } });   // rôle posé par le serveur, jamais par l'intéressé
      await db.from("personnes").update({ role, nom: nom || email.split("@")[0] }).eq("id", id);
    } else if (nom && !deja.nom) await db.from("personnes").update({ nom }).eq("id", id);
    const { error: e2 } = await db.from("membres").upsert({ espace_id: espace.id, personne_id: id, role, fonction: b.fonction || null }, { onConflict: "espace_id,personne_id" });
    if (e2) throw e2;
    const prenom = (nom || "").split(" ")[0];
    const titre = role === "client" ? `Votre espace ${espace.nom} vous attend` : `Un espace partagé avec vous`;
    const envoye = await envoyerDepuisLili(db, email, titre,
      `Bonjour${prenom ? " " + prenom : ""},\n\nLili Rouzier vous ouvre votre espace ${espace.nom} : calendrier, publications à valider, médiathèque et messages.\n\nPour entrer (lien valable 24 h, une seule fois) : ${lien.properties.action_link}\n\nÀ l'arrivée, vous choisirez votre mot de passe.\n`,
      gabarit({ couleur: espace.couleur, surtitre: `${espace.nom} · par Lili Rouzier`, titre,
        paragraphes: [`Bonjour${prenom ? " " + prenom : ""},`, `Lili Rouzier vous ouvre votre espace : le calendrier, les publications à valider en deux gestes, la médiathèque pour déposer vos photos, et les messages.`,
          deja ? "Le bouton ci-dessous vous connecte directement (valable 24 h, une seule fois)." : "À l'arrivée, vous choisirez votre mot de passe (le lien est valable 24 h, une seule fois)."],
        bouton: "Entrer dans mon espace", lien: lien.properties.action_link, pied: "Vous recevez ce message parce que Lili Rouzier vous a invité. Si vous ne l'attendiez pas, ignorez-le." }))
      .catch((e) => { console.error("inviter : e-mail", (e as Error).message); return false; });
    return json(envoye ? { envoye: true, personne_id: id } : { lien: lien.properties.action_link, personne_id: id });
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : String(e) }, 400);
  }
});
