// La messagerie de Lili (sa boîte Gmail) dans le studio. Session de Lili avec son code à 6 chiffres uniquement.
//  { action: "etat" }                                      -> boîtes reliées (et droit « réponse automatique »)
//  { action: "dossiers" }                                  -> réception, suivis, envoyés, brouillons, corbeille, libellés
//  { action: "fils", dossier?, q?, suite? }                -> conversations du dossier (recherche Gmail avec q)
//  { action: "fil", id }                                   -> tous les messages d'une conversation (la marque lue)
//  { action: "lister" | "lire", … }                        -> mails un par un (ancienne vue, gardée)
//  { action: "piece", id, piece }                          -> une pièce jointe (base64)
//  { action: "ranger", ids[], quoi }                       -> sur des conversations : lu | non_lu | suivi | non_suivi | important |
//                                                             non_important | archiver | corbeille | reception | indesirable
//  { action: "libeller", ids[], ajout[], retrait[] } · { action: "nouveau_libelle", nom }
//  { action: "envoyer" | "brouillon", mode, origine?, a, cc?, cci?, objet, html?, texte?, pieces?, brouillon_id? }
//       mode : nouveau | repondre | repondre_tous | transferer. Envoi seulement sur clic de Lili ; jamais d'effacement définitif.
//  { action: "programmer", envoyer_le, …comme envoyer }   -> envoi différé (table mails_programmes)
//  { action: "vacances_lire" } · { action: "vacances", actif, debut, fin, objet, message, bandeau, pause }
//  Tâche planifiée (x-cle-synchro) : { action: "programmes" } -> envoie les mails programmés arrivés à l'heure
// deno-lint-ignore-file no-explicit-any
import { appelant, base, cors, estLili, json, parCron } from "../_partage/commun.ts";
import { jetonAcces, type CompteMail } from "../_partage/google.ts";
import { citer, deB64, echapper, gmail, htmlEnTexte, mime, nettoyerHtml, type PieceJointe } from "../_partage/gmail.ts";

const adresses = (t: unknown) => (Array.isArray(t) ? t.join(",") : String(t ?? "")).split(/[,;]/).map((x) => x.trim()).filter((x) => /@/.test(x));
const QUOI = ["lu", "non_lu", "suivi", "non_suivi", "important", "non_important", "archiver", "corbeille", "reception", "indesirable"];

// Prépare et envoie (ou range en brouillon) un message ; sert à l'envoi direct et à l'envoi programmé
async function composer(g: any, c: CompteMail, nomExp: string, b: any, envoyer: boolean) {
  const mode = ["repondre", "repondre_tous", "transferer"].includes(b.mode) ? b.mode : "nouveau";
  const aa = adresses(b.a), cc = adresses(b.cc), cci = adresses(b.cci);
  if (envoyer && !aa.length && !cc.length && !cci.length) throw new Error("destinataire manquant");
  const pieces: PieceJointe[] = (Array.isArray(b.pieces) ? b.pieces : []).slice(0, 20).map((p: any) => ({ nom: String(p.nom ?? "piece"), type: String(p.type ?? ""), octets: deB64(String(p.contenu ?? "")) }));
  if (pieces.reduce((s, p) => s + p.octets.length, 0) > 20_000_000) throw new Error("pièces jointes trop lourdes (20 Mo au plus)");
  const brut = b.html ? nettoyerHtml(b.html) : "";
  const texte = (b.texte ? String(b.texte) : htmlEnTexte(brut)).replace(/\s+$/, "").slice(0, 100000);
  let html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${brut || echapper(texte).replace(/\n/g, "<br>")}</div>`;
  // Signature manuscrite : noire en mode clair, blanche en mode sombre chez les messageries qui le permettent
  // (Mail d'Apple, Outlook pour Mac) ; ailleurs (Gmail) la version noire bordée de blanc reste affichée.
  if (/class="sig-sombre"/.test(brut)) html = `<!doctype html><html><head><style>@media (prefers-color-scheme: dark) { .sig-clair { display: none !important; } .sig-sombre { display: block !important; max-height: none !important; overflow: visible !important; } }</style></head><body>${html}`;
  const o = b.origine && mode !== "nouveau" ? await g.origine(String(b.origine)) : null, ci = o ? citer(o, mode) : null;
  const raw = mime({ nom: nomExp, de: c.email, a: aa, cc, cci, objet: String(b.objet ?? "").trim().slice(0, 300),
    texte: texte + (ci?.t ?? ""), html: html + (ci?.h ?? "") + (html.startsWith("<!doctype") ? "</body></html>" : ""), pieces: [...pieces, ...(mode === "transferer" && o ? o.pieces : [])],
    enReponse: o && mode !== "transferer" ? { messageId: o.messageId, references: o.references } : null });
  return g.ecrire(raw, o && mode !== "transferer" ? o.fil : null, envoyer, b.brouillon_id ? String(b.brouillon_id) : null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base();
  const b = await req.json().catch(() => ({}));

  // Envois programmés : la tâche planifiée passe chaque minute
  if (parCron(req)) {
    const { data: dus } = await db.from("mails_programmes").select("*").eq("statut", "prevu").lte("envoyer_le", new Date().toISOString()).order("envoyer_le").limit(20);
    let n = 0;
    for (const m of dus ?? []) {
      try {
        const { data: c } = await db.from("comptes_mail").select("*").eq("personne_id", m.personne_id).order("cree_le").limit(1).maybeSingle();
        if (!c) throw new Error("aucune boîte reliée");
        const { data: p } = await db.from("personnes").select("nom").eq("id", m.personne_id).maybeSingle();
        await composer(gmail(c, await jetonAcces(db, c)), c, p?.nom || "Lili Rouzier", m.contenu, true);
        await db.from("mails_programmes").update({ statut: "envoye", envoye_le: new Date().toISOString(), contenu: { ...m.contenu, pieces: [] } }).eq("id", m.id);
        n++;
      } catch (e) {
        await db.from("mails_programmes").update({ statut: "erreur", erreur: (e as Error).message.slice(0, 300) }).eq("id", m.id);
      }
    }
    return json({ envoyes: n });
  }

  const a = await appelant(db, req);
  if (!estLili(a)) return json({ erreur: "réservé à Lili, avec son code à 6 chiffres" }, 403);
  try {
    const { data: comptes } = await db.from("comptes_mail").select("*").eq("personne_id", a!.id).order("cree_le");
    if (b.action === "etat") return json({ boites: (comptes ?? []).map((c: any) => ({ email: c.email, erreur: c.derniere_erreur, vacances_possible: /gmail\.settings\.basic/.test(c.droits ?? "") })) });
    const c = (comptes ?? []).find((x: any) => !b.boite || x.email === b.boite) as CompteMail | undefined;
    if (!c) return json({ erreur: "aucune boîte reliée" }, 404);
    const g = gmail(c, await jetonAcces(db, c));
    const id = String(b.id ?? "");
    const ids: string[] = (Array.isArray(b.ids) ? b.ids : id ? [id] : []).map(String).slice(0, 100);
    const nomExp = a!.personne?.nom || "Lili Rouzier";
    switch (b.action) {
      case "dossiers": return json({ dossiers: await g.dossiers() });
      case "fils": return json(await g.fils(String(b.dossier ?? ""), String(b.q ?? "").trim().slice(0, 300), String(b.suite ?? "")));
      case "fil": return json(await g.lireFil(id));
      case "lister": return json(await g.lister(String(b.dossier ?? ""), String(b.q ?? "").trim().slice(0, 200), String(b.suite ?? "")));
      case "lire": return json(await g.lire(id));
      case "piece": return json(await g.piece(id, String(b.piece)));
      case "ranger":
        if (!QUOI.includes(b.quoi)) return json({ erreur: "action inconnue" }, 400);
        for (let i = 0; i < ids.length; i += 10) await Promise.all(ids.slice(i, i + 10).map((x) => g.rangerFil(x, b.quoi)));
        return json({ ok: true, n: ids.length });
      case "libeller":
        for (const x of ids) await g.libellerFil(x, (b.ajout ?? []).map(String), (b.retrait ?? []).map(String));
        return json({ ok: true });
      case "nouveau_libelle": return json({ libelle: await g.creerLibelle(String(b.nom ?? "").trim().slice(0, 80)) });
      case "envoyer": case "brouillon": {
        const r = await composer(g, c, nomExp, b, b.action === "envoyer");
        return json(b.action === "envoyer" ? { ok: true } : { ok: true, brouillon_id: r });
      }
      case "programmer": {
        const quand = Date.parse(String(b.envoyer_le ?? ""));
        if (!quand || quand < Date.now() - 60000) return json({ erreur: "date d'envoi invalide" }, 400);
        if (!adresses(b.a).length && !adresses(b.cc).length) return json({ erreur: "destinataire manquant" }, 400);
        const contenu = { mode: b.mode, origine: b.origine ?? null, a: b.a, cc: b.cc ?? "", cci: b.cci ?? "", objet: b.objet ?? "", html: b.html ? nettoyerHtml(b.html) : "", texte: b.texte ?? "",
          pieces: (Array.isArray(b.pieces) ? b.pieces : []).slice(0, 10) };
        if (JSON.stringify(contenu.pieces).length > 14_000_000) return json({ erreur: "pièces jointes trop lourdes pour un envoi programmé (10 Mo)" }, 400);
        const { data, error } = await db.from("mails_programmes").insert({ personne_id: a!.id, envoyer_le: new Date(quand).toISOString(), contenu, statut: "prevu" }).select("id").single();
        if (error) throw new Error(error.message);
        if (b.brouillon_id) await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${b.brouillon_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${await jetonAcces(db, c)}` } }).catch(() => null);
        return json({ ok: true, id: data.id });
      }
      case "vacances_lire": {
        const v = await g.lireVacances().catch((e: Error) => ({ erreur: e.message }));
        const { data: r } = await db.from("reglages").select("valeur").eq("cle", "vacances").maybeSingle();
        return json({ gmail: v, studio: r?.valeur ?? null });
      }
      case "vacances": {
        const actif = !!b.actif, avecGmail = actif && b.gmail !== false;
        const debut = String(b.debut ?? "").slice(0, 10), fin = String(b.fin ?? "").slice(0, 10);
        if (actif && (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin) || fin < debut)) return json({ erreur: "dates de vacances invalides" }, 400);
        const { data: avant } = await db.from("reglages").select("valeur").eq("cle", "vacances").maybeSingle();
        const ancien = avant?.valeur ?? {};
        // Signature (carte HTML de « Ma signature ») ajoutée sous le message, nettoyée comme tout HTML envoyé
        const sig = typeof b.signature === "string" && b.signature.length < 30000 ? nettoyerHtml(b.signature) : "";
        // 1. Réponse automatique Gmail (du début au lendemain de la fin, heure de Paris)
        let gmailOk = true, gmailErreur = "";
        try {
          await g.ecrireVacances(avecGmail ? {
            enableAutoReply: true, responseSubject: String(b.objet ?? "Absence").slice(0, 200), responseBodyHtml: nettoyerHtml(String(b.message ?? "")).replace(/\n/g, "<br>") + (sig ? "<br><br>" + sig : ""),
            restrictToContacts: false, restrictToDomain: false,
            startTime: String(Date.parse(debut + "T00:00:00+01:00")), endTime: String(Date.parse(fin + "T23:59:59+01:00")),
          } : { enableAutoReply: false });
        } catch (e) { gmailOk = false; gmailErreur = (e as Error).message; }
        // 2. Bandeau dans l'espace des clients : une absence « pour tous » dans les temps forts
        if (ancien.temps_fort_id) await db.from("temps_forts").delete().eq("id", ancien.temps_fort_id);
        let tf: string | null = null;
        if (actif && b.bandeau !== false) {
          const { data } = await db.from("temps_forts").insert({ espace_id: null, libelle: "Lili en congés", debut, fin, type: "absence", visibilite: "partage" }).select("id").single();
          tf = data?.id ?? null;
        }
        const valeur = actif ? { actif: true, debut, fin, objet: b.objet ?? "", message: b.message ?? "", signature: !!sig, bandeau: b.bandeau !== false, pause: b.pause !== false, gmail: avecGmail && gmailOk, temps_fort_id: tf }
          : { ...ancien, actif: false, temps_fort_id: null, gmail: false };
        await db.from("reglages").upsert({ cle: "vacances", valeur, modifie_le: new Date().toISOString() }, { onConflict: "cle" });
        return json({ ok: true, gmail: avecGmail ? gmailOk : null, gmail_erreur: gmailErreur ? (/insufficient|scope|403/i.test(gmailErreur) ? "droit" : gmailErreur) : null, valeur });
      }
    }
    return json({ erreur: "action inconnue" }, 400);
  } catch (e) {
    return json({ erreur: e instanceof Error ? e.message : String(e) }, 502);
  }
});
