// Notifications du studio, regroupées : jamais un e-mail par action.
//  POST (tâche planifiée, en-tête x-cle-synchro)  -> traite la file « notifications » :
//     · téléphone et ordinateur (Web Push) : un seul message par personne et par passage ;
//     · e-mail aux clients : un seul e-mail par client, quand la plus ancienne nouveauté a au moins 10 minutes
//       (le temps de regrouper), envoyé depuis la boîte Gmail de Lili. Lili est prévenue par Web Push.
//  GET                                             -> clé publique VAPID (pour s'abonner depuis l'application)
//  POST { test: true } (session de Lili, avec code) -> notification d'essai sur ses appareils
// Les clients ne reçoivent que ce qui suit un geste de Lili qui s'adresse à eux (voir journal_notifier) : envoi pour
// validation, publication en ligne, commentaire ou message partagé.
// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";
import { appelant, base, cors, estLili, json, parCron, SITE } from "../_partage/commun.ts";
import { jetonAcces } from "../_partage/google.ts";
import { echapper, gmail, mime } from "../_partage/gmail.ts";

const ATTENTE_MAIL = 10 * 60000, FENETRE = 7 * 86400000;
const pub = () => Deno.env.get("VAPID_PUBLIQUE") ?? "", priv = () => Deno.env.get("VAPID_PRIVEE") ?? "";

async function pousser(db: any, personneId: string, titre: string, corps: string, url: string) {
  if (!pub() || !priv()) return 0;
  webpush.setVapidDetails(SITE, pub(), priv());
  const { data } = await db.from("push_abonnements").select("endpoint, abonnement").eq("personne_id", personneId);
  let n = 0;
  for (const x of data ?? []) {
    try { await webpush.sendNotification(x.abonnement, JSON.stringify({ titre, corps: corps.slice(0, 300), url, tag: "studio-" + personneId }), { TTL: 6 * 3600, urgency: "normal" }); n++; }
    catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_abonnements").delete().eq("endpoint", x.endpoint);   // appareil désabonné
      else console.error("notifier : push", code, (e as Error).message);
    }
  }
  return n;
}

// Une ligne lisible par nouveauté
function phrase(j: any, acteur: string, titre: string, pourClient: boolean) {
  const t = titre ? `« ${titre} »` : "une publication";
  switch (j.action) {
    case "publication.statut": {
      const v = j.details?.vers;
      if (v === "a-valider") return `${t} attend votre validation`;
      if (v === "publie") return `${t} est en ligne`;
      if (v === "valide") return `${acteur} a validé ${t}`;
      if (v === "modifs-demandees") return `${acteur} demande une modification sur ${t}`;
      return `${t} : ${v}`;
    }
    case "commentaire.ajoute": return `${acteur} a commenté ${t}${j.details?.extrait ? " : " + j.details.extrait : ""}`;
    case "message.envoye": return `${pourClient ? acteur : acteur} vous a écrit${j.details?.extrait ? " : " + j.details.extrait : ""}`;
    case "media.depose": return `${acteur} a déposé ${j.details?.nom ? "« " + j.details.nom + " »" : "un fichier"}`;
    case "publication.idee": return `${acteur} propose une idée : ${titre || ""}`;
    case "devis.envoye": return `Un devis vous attend${j.details?.objet ? " : " + j.details.objet : ""}, à signer en ligne`;
    case "devis.signe": return `${acteur} a signé le devis ${j.details?.numero || ""}${j.details?.objet ? " (" + j.details.objet + ")" : ""}`;
    default: return `${acteur} : nouveauté dans l'espace`;
  }
}

function emailHtml(o: { prenom: string; espace: any; lignes: { texte: string; lien: string }[]; titre: string; lili: string }) {
  const c = o.espace?.couleur || "#1E1A17";
  const items = o.lignes.map((l) => `<tr><td style="padding:10px 0;border-top:1px solid #E7E0D5;font:15px/1.45 Arial,sans-serif;color:#1E1A17">
    <a href="${l.lien}" style="color:#1E1A17;text-decoration:none">${echapper(l.texte)}</a></td></tr>`).join("");
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F4EFE7;padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E7E0D5">
    <tr><td style="height:6px;background:${c}"></td></tr>
    <tr><td style="padding:28px 30px 8px">
      <p style="margin:0 0 6px;font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8B8178">${echapper(o.espace?.nom || "")} · par ${echapper(o.lili)}</p>
      <h1 style="margin:0 0 14px;font:500 28px/1.15 Georgia,'Times New Roman',serif;color:#1E1A17">${echapper(o.titre)}</h1>
      <p style="margin:0 0 6px;font:15px/1.5 Arial,sans-serif;color:#5F574F">Bonjour ${echapper(o.prenom)},</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
    </td></tr>
    <tr><td style="padding:16px 30px 30px">
      <a href="${SITE}" style="display:inline-block;background:${c};color:#FFFFFF;font:600 15px Arial,sans-serif;text-decoration:none;padding:13px 22px;border-radius:12px">Ouvrir mon espace</a>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font:12px/1.5 Arial,sans-serif;color:#8B8178">Vous recevez ce message parce que ${echapper(o.lili)} vous a ouvert un espace.<br>Un regroupement par envoi, jamais un message par action.</p>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ cle: pub() || null });
  const db = base(), b = await req.json().catch(() => ({}));
  if (!parCron(req)) {
    const a = await appelant(db, req);
    if (!estLili(a) || !b.test) return json({ erreur: "non autorisé" }, 401);
    const n = await pousser(db, a!.id, "Studio Lili", "Les notifications arrivent bien sur cet appareil.", SITE);
    return json({ envoyees: n, cles: !!pub() });
  }

  const depuis = new Date(Date.now() - FENETRE).toISOString();
  const { data: file } = await db.from("notifications").select("id, personne_id, journal_id, mail_le, push_le, cree_le, essais")
    .gte("cree_le", depuis).or("mail_le.is.null,push_le.is.null").order("cree_le").limit(1000);
  if (!file?.length) return json({ traitees: 0 });
  const journalIds = [...new Set(file.map((n: any) => n.journal_id))];
  const { data: journal } = await db.from("journal").select("*").in("id", journalIds);
  const J = new Map((journal ?? []).map((j: any) => [j.id, j]));
  const personnesIds = [...new Set([...file.map((n: any) => n.personne_id), ...(journal ?? []).map((j: any) => j.acteur_id).filter(Boolean)])];
  const { data: personnes } = await db.from("personnes").select("id, nom, email, role").in("id", personnesIds);
  const P = new Map((personnes ?? []).map((p: any) => [p.id, p]));
  const pubIds = [...new Set((journal ?? []).filter((j: any) => j.objet_type === "publication").map((j: any) => j.objet_id))];
  const { data: pubs } = pubIds.length ? await db.from("publications").select("id, titre").in("id", pubIds) : { data: [] };
  const T = new Map((pubs ?? []).map((p: any) => [p.id, p.titre]));
  const { data: espaces } = await db.from("espaces").select("id, nom, couleur");
  const E = new Map((espaces ?? []).map((e: any) => [e.id, e]));
  const { data: membres } = await db.from("membres").select("espace_id, personne_id, notifier_mail");
  const { data: lili } = await db.from("personnes").select("id, nom").eq("role", "proprietaire").order("cree_le").limit(1).maybeSingle();
  const { data: boite } = lili ? await db.from("comptes_mail").select("*").eq("personne_id", lili.id).order("cree_le").limit(1).maybeSingle() : { data: null };
  let envoyeur: any = null;
  if (boite) { try { envoyeur = gmail(boite, await jetonAcces(db, boite)); } catch (e) { console.error("notifier : Gmail", (e as Error).message); } }

  // Vacances de Lili : rien ne lui est poussé ni écrit pendant ses dates ; tout l'attend dans la cloche du studio
  const { data: vac } = await db.from("reglages").select("valeur").eq("cle", "vacances").maybeSingle();
  const auj = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const enPause = !!(vac?.valeur?.actif && vac.valeur.pause && vac.valeur.debut <= auj && auj <= vac.valeur.fin);

  const parPersonne = new Map<string, any[]>();
  for (const n of file) { const l = parPersonne.get(n.personne_id) ?? []; l.push(n); parPersonne.set(n.personne_id, l); }
  const bilan = { push: 0, mails: 0, personnes: parPersonne.size };
  const maintenant = new Date().toISOString();

  for (const [pid, ns] of parPersonne) {
    const dest = P.get(pid) as any; if (!dest) continue;
    const pourClient = dest.role !== "proprietaire";
    if (!pourClient && enPause) { await db.from("notifications").update({ push_le: maintenant, mail_le: maintenant }).in("id", ns.map((n: any) => n.id)); continue; }
    const lignes = ns.map((n: any) => {
      const j: any = J.get(n.journal_id); if (!j) return null;
      const acteur = ((P.get(j.acteur_id) as any)?.nom || "Quelqu'un").split(" ")[0];
      const titre = (T.get(j.objet_id) as string) || j.details?.titre || "";
      const lien = j.objet_type === "publication" ? `${SITE}#p/${j.objet_id}` : j.objet_type === "devis" ? `${SITE}#devis` : SITE;
      return { n, j, texte: phrase(j, pourClient ? (acteur === "Lili" ? "Lili" : acteur) : acteur, titre, pourClient), lien };
    }).filter(Boolean) as any[];

    // Web Push : tout ce qui n'a pas encore été poussé, en un message
    const aPousser = lignes.filter((l) => !l.n.push_le);
    if (aPousser.length) {
      const e: any = E.get(aPousser[0].j.espace_id);
      const titre = aPousser.length === 1 ? (pourClient ? (e?.nom || "Votre espace") : (e?.nom || "Studio Lili")) : `${aPousser.length} nouveautés`;
      const corps = aPousser.length === 1 ? aPousser[0].texte : aPousser.slice(0, 4).map((l) => "· " + l.texte).join("\n");
      bilan.push += await pousser(db, pid, titre, corps, aPousser.length === 1 ? aPousser[0].lien : SITE);
      await db.from("notifications").update({ push_le: maintenant }).in("id", aPousser.map((l) => l.n.id));
    }

    // E-mail : clients seulement, regroupé, si la plus ancienne nouveauté a 10 minutes et que le client l'accepte
    const aEcrire = lignes.filter((l) => !l.n.mail_le);
    if (!aEcrire.length) continue;
    if (!pourClient) { await db.from("notifications").update({ mail_le: maintenant }).in("id", aEcrire.map((l) => l.n.id)); continue; }
    if (Date.now() - Date.parse(aEcrire[0].n.cree_le) < ATTENTE_MAIL || !envoyeur || !dest.email) continue;
    const acceptes = aEcrire.filter((l) => (membres ?? []).some((m: any) => m.personne_id === pid && m.espace_id === l.j.espace_id && m.notifier_mail));
    const refuses = aEcrire.filter((l) => !acceptes.includes(l));
    if (refuses.length) await db.from("notifications").update({ mail_le: maintenant }).in("id", refuses.map((l) => l.n.id));
    if (!acceptes.length) continue;
    const espace: any = E.get(acceptes[0].j.espace_id);
    const nbValider = acceptes.filter((l) => l.j.action === "publication.statut" && l.j.details?.vers === "a-valider").length;
    const objet = nbValider ? (nbValider > 1 ? `${nbValider} publications attendent votre validation` : "Une publication attend votre validation") : "Du nouveau dans votre espace";
    try {
      const raw = mime({ nom: lili?.nom || "Lili Rouzier", de: boite.email, a: [dest.email], cc: [], objet,
        texte: `Bonjour ${(dest.nom || "").split(" ")[0]},\n\n${acceptes.map((l) => "- " + l.texte).join("\n")}\n\nOuvrir mon espace : ${SITE}\n`,
        html: emailHtml({ prenom: (dest.nom || "").split(" ")[0], espace, lignes: acceptes, titre: objet, lili: lili?.nom || "Lili Rouzier" }), pieces: [] });
      await envoyeur.ecrire(raw, null, true, null);
      bilan.mails++;
      await db.from("notifications").update({ mail_le: maintenant }).in("id", acceptes.map((l) => l.n.id));
    } catch (e) {
      console.error("notifier : e-mail", (e as Error).message);
      for (const l of acceptes) await db.from("notifications").update({ essais: (l.n.essais || 0) + 1, ...(l.n.essais >= 4 ? { mail_le: maintenant } : {}) }).eq("id", l.n.id);
    }
  }
  return json(bilan);
});
