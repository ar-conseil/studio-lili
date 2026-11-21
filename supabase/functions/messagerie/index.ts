// La messagerie de Lili (sa boîte Gmail) dans le studio. Session de Lili avec son code à 6 chiffres uniquement.
//  { action: "etat" }                                      -> boîtes reliées
//  { action: "dossiers" }                                  -> réception, suivis, envoyés, brouillons, corbeille, libellés
//  { action: "lister", dossier?, q?, suite? }              -> mails du dossier (recherche Gmail avec q)
//  { action: "lire", id }                                  -> en-têtes, texte, HTML, pièces jointes (images intégrées comprises)
//  { action: "piece", id, piece }                          -> une pièce jointe (base64)
//  { action: "ranger", id, quoi }                          -> lu | non_lu | suivi | non_suivi | archiver | corbeille | reception
//  { action: "envoyer" | "brouillon", mode, origine?, a, cc?, cci?, objet, texte, pieces?, brouillon_id? }
//       mode : nouveau | repondre | repondre_tous | transferer. Envoi seulement sur clic de Lili ; jamais d'effacement définitif.
// deno-lint-ignore-file no-explicit-any
import { appelant, base, cors, estLili, json } from "../_partage/commun.ts";
import { jetonAcces, type CompteMail } from "../_partage/google.ts";
import { citer, deB64, echapper, gmail, mime, type PieceJointe } from "../_partage/gmail.ts";

const adresses = (t: unknown) => String(t ?? "").split(/[,;]/).map((x) => x.trim()).filter((x) => /@/.test(x));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base();
  const a = await appelant(db, req);
  if (!estLili(a)) return json({ erreur: "réservé à Lili, avec son code à 6 chiffres" }, 403);
  const b = await req.json().catch(() => ({}));
  try {
    const { data: comptes } = await db.from("comptes_mail").select("*").eq("personne_id", a!.id).order("cree_le");
    if (b.action === "etat") return json({ boites: (comptes ?? []).map((c: any) => ({ email: c.email, erreur: c.derniere_erreur })) });
    const c = (comptes ?? []).find((x: any) => !b.boite || x.email === b.boite) as CompteMail | undefined;
    if (!c) return json({ erreur: "aucune boîte reliée" }, 404);
    const g = gmail(c, await jetonAcces(db, c));
    const id = String(b.id ?? "");
    switch (b.action) {
      case "dossiers": return json({ dossiers: await g.dossiers() });
      case "lister": return json(await g.lister(String(b.dossier ?? ""), String(b.q ?? "").trim().slice(0, 200), String(b.suite ?? "")));
      case "lire": return json(await g.lire(id));
      case "piece": return json(await g.piece(id, String(b.piece)));
      case "ranger":
        if (!["lu", "non_lu", "suivi", "non_suivi", "archiver", "corbeille", "reception"].includes(b.quoi)) return json({ erreur: "action inconnue" }, 400);
        await g.ranger(id, b.quoi); return json({ ok: true });
      case "envoyer": case "brouillon": {
        const envoyer = b.action === "envoyer", mode = ["repondre", "repondre_tous", "transferer"].includes(b.mode) ? b.mode : "nouveau";
        const aa = adresses(b.a), cc = adresses(b.cc), cci = adresses(b.cci);
        if (envoyer && !aa.length && !cc.length && !cci.length) return json({ erreur: "destinataire manquant" }, 400);
        const pieces: PieceJointe[] = (Array.isArray(b.pieces) ? b.pieces : []).slice(0, 20).map((p: any) => ({ nom: String(p.nom ?? "piece"), type: String(p.type ?? ""), octets: deB64(String(p.contenu ?? "")) }));
        if (pieces.reduce((s, p) => s + p.octets.length, 0) > 20_000_000) return json({ erreur: "pièces jointes trop lourdes (20 Mo au plus)" }, 400);
        const texte = String(b.texte ?? "").replace(/\s+$/, "").slice(0, 100000);
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${echapper(texte).replace(/\n/g, "<br>")}</div>`;
        const o = b.origine && mode !== "nouveau" ? await g.origine(String(b.origine)) : null, ci = o ? citer(o, mode) : null;
        const raw = mime({ nom: a!.personne?.nom || "Lili Rouzier", de: c.email, a: aa, cc, cci, objet: String(b.objet ?? "").trim().slice(0, 300),
          texte: texte + (ci?.t ?? ""), html: html + (ci?.h ?? ""), pieces: [...pieces, ...(mode === "transferer" && o ? o.pieces : [])],
          enReponse: o && mode !== "transferer" ? { messageId: o.messageId, references: o.references } : null });
        const r = await g.ecrire(raw, o && mode !== "transferer" ? o.fil : null, envoyer, b.brouillon_id ? String(b.brouillon_id) : null);
        return json(envoyer ? { ok: true } : { ok: true, brouillon_id: r });
      }
    }
    return json({ erreur: "action inconnue" }, 400);
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : String(e) }, 502);
  }
});
