// Compte pro de Lili (Revolut Business), en LECTURE SEULE : opérations recopiées dans banque_operations.
// Lili crée une clé API dans la console API de Revolut, avec seulement « Accounts : Read » et « Transactions : Read »
// (aucun paiement possible), et la colle dans Comptabilité. La clé reste côté serveur (colonne jamais accordée au
// navigateur). Méthode recommandée par Revolut (l'ancienne connexion par certificat et jetons est dépréciée).
//  POST { action: "relier", cle }   (Lili avec son code) -> vérifie la clé, l'enregistre, lit les opérations
//  POST { action: "synchro" }       (Lili, ou pg_cron avec la clé de synchro) -> { nouvelles }
//  POST { action: "delier" }        (Lili) -> oublie la clé (les opérations déjà lues restent)
import { appelant, base, cors, estLili, json, parCron } from "../_partage/commun.ts";

const API = "https://b2b.revolut.com/api/1.0";

async function lire(cle: string, chemin: string) {
  const r = await fetch(`${API}${chemin}`, { headers: { Authorization: `Bearer ${cle}`, Accept: "application/json" } });
  if (r.status === 401 || r.status === 403) throw new Error("Revolut refuse la clé (vérifiez qu'elle a « Accounts : Read » et « Transactions : Read »)");
  if (!r.ok) throw new Error(`Revolut ${chemin.split("?")[0]} : ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}
// Recopie les opérations (120 jours la première fois, puis depuis la dernière lecture moins 7 jours), par pages de 1000
async function synchro(db: any, li: any) {
  try {
    const comptes: any[] = await lire(li.cle_api, "/accounts");
    const noms: Record<string, string> = {};
    for (const c of comptes) noms[c.id] = `${c.name || "Compte"} (${c.currency})`;
    const depuis = new Date(li.derniere_synchro ? new Date(li.derniere_synchro).getTime() - 7 * 86400000 : Date.now() - 120 * 86400000).toISOString();
    let txs: any[] = [], jusqua: string | null = null;
    for (let page = 0; page < 10; page++) {
      const lot: any[] = await lire(li.cle_api, `/transactions?from=${encodeURIComponent(depuis)}&count=1000${jusqua ? `&to=${encodeURIComponent(jusqua)}` : ""}`);
      txs = txs.concat(lot);
      if (lot.length < 1000) break;
      jusqua = lot[lot.length - 1].created_at;
    }
    const lignes: any[] = [];
    for (const t of txs) {
      if (["declined", "failed", "reverted"].includes(t.state)) continue;
      (t.legs ?? []).forEach((l: any, i: number) => {
        lignes.push({ id: `${t.id}:${l.leg_id ?? i}`, liaison_id: li.id, compte: noms[l.account_id] ?? null, date: t.completed_at ?? t.created_at,
          montant: l.amount, devise: l.currency ?? "EUR", libelle: l.description ?? null,
          contrepartie: t.merchant?.name ?? l.counterparty?.name ?? l.description ?? null,
          reference: t.reference ?? null, type: t.type ?? null, etat: t.state ?? null, solde_apres: l.balance ?? null });
      });
    }
    const { count: avant } = await db.from("banque_operations").select("id", { count: "exact", head: true });
    for (let i = 0; i < lignes.length; i += 500) {
      const { error } = await db.from("banque_operations").upsert(lignes.slice(i, i + 500), { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    const { count: apres } = await db.from("banque_operations").select("id", { count: "exact", head: true });
    const eur = comptes.filter((c) => c.currency === "EUR" && c.state !== "inactive");
    const solde = eur.reduce((s, c) => s + (+c.balance || 0), 0);
    await db.from("banque_liaisons").update({ derniere_synchro: new Date().toISOString(), derniere_erreur: null,
      nom: `Revolut Business · solde ${solde.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` }).eq("id", li.id);
    return (apres ?? 0) - (avant ?? 0);
  } catch (e) {
    await db.from("banque_liaisons").update({ derniere_erreur: (e as Error).message.slice(0, 300) }).eq("id", li.id);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erreur: "méthode" }, 405);
  const db = base();
  const { data: li } = await db.from("banque_liaisons").select("*").eq("fournisseur", "revolut").order("cree_le").limit(1).maybeSingle();
  const b = await req.json().catch(() => ({}));
  if (parCron(req)) {
    if (!li?.cle_api) return json({ ok: true, rien: true });
    try { return json({ ok: true, nouvelles: await synchro(db, li) }); } catch (e) { return json({ erreur: (e as Error).message }, 502); }
  }
  const a = await appelant(db, req);
  if (!estLili(a)) return json({ erreur: "réservé à Lili, avec son code à 6 chiffres" }, 403);
  try {
    switch (b.action) {
      case "relier": {
        const cle = String(b.cle ?? "").trim();
        if (!/^[\w.-]{20,300}$/.test(cle)) return json({ erreur: "clé API invalide" }, 400);
        await lire(cle, "/accounts");   // la clé fonctionne avant d'être gardée
        let id = li?.id;
        if (li) await db.from("banque_liaisons").update({ cle_api: cle, derniere_erreur: null }).eq("id", li.id);
        else id = (await db.from("banque_liaisons").insert({ fournisseur: "revolut", cle_api: cle }).select("id").single()).data?.id;
        const { data: li2 } = await db.from("banque_liaisons").select("*").eq("id", id).single();
        return json({ ok: true, nouvelles: await synchro(db, li2) });
      }
      case "synchro":
        if (!li?.cle_api) return json({ erreur: "compte pas encore relié" }, 400);
        return json({ ok: true, nouvelles: await synchro(db, li) });
      case "delier":
        if (li) await db.from("banque_liaisons").update({ cle_api: null, nom: null, derniere_erreur: null }).eq("id", li.id);
        return json({ ok: true });
    }
    return json({ erreur: "action inconnue" }, 400);
  } catch (e) {
    return json({ erreur: (e as Error).message }, 502);
  }
});
