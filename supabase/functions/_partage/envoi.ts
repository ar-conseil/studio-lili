// Envoyer un e-mail depuis la boîte Gmail de Lili (reliée au studio). Utilisé seulement sur un geste de Lili
// (invitation) ou pour les notifications regroupées qui suivent ses gestes. Sans boîte reliée : rien n'est envoyé.
// deno-lint-ignore-file no-explicit-any
import { jetonAcces } from "./google.ts";
import { echapper, gmail, mime } from "./gmail.ts";
import { SITE } from "./commun.ts";

export async function boiteDeLili(db: any) {
  const { data: lili } = await db.from("personnes").select("id, nom").eq("role", "proprietaire").order("cree_le").limit(1).maybeSingle();
  if (!lili) return null;
  const { data: boite } = await db.from("comptes_mail").select("*").eq("personne_id", lili.id).order("cree_le").limit(1).maybeSingle();
  return boite ? { lili, boite } : null;
}

export async function envoyerDepuisLili(db: any, a: string, objet: string, texte: string, html: string): Promise<boolean> {
  const b = await boiteDeLili(db);
  if (!b) return false;
  const g = gmail(b.boite, await jetonAcces(db, b.boite));
  await g.ecrire(mime({ nom: b.lili.nom || "Lili Rouzier", de: b.boite.email, a: [a], cc: [], objet, texte, html, pieces: [] }), null, true, null);
  return true;
}

// Gabarit commun : en-tête à la couleur de la marque, un bouton, un pied discret
export function gabarit(o: { couleur?: string; surtitre: string; titre: string; paragraphes: string[]; bouton: string; lien?: string; pied: string }) {
  const c = o.couleur || "#1E1A17";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F4EFE7;padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E7E0D5">
    <tr><td style="height:6px;background:${c}"></td></tr>
    <tr><td style="padding:28px 30px 8px">
      <p style="margin:0 0 6px;font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8B8178">${echapper(o.surtitre)}</p>
      <h1 style="margin:0 0 14px;font:500 28px/1.15 Georgia,'Times New Roman',serif;color:#1E1A17">${echapper(o.titre)}</h1>
      ${o.paragraphes.map((p) => `<p style="margin:0 0 10px;font:15px/1.55 Arial,sans-serif;color:#5F574F">${echapper(p)}</p>`).join("")}
    </td></tr>
    <tr><td style="padding:12px 30px 30px">
      <a href="${o.lien || SITE}" style="display:inline-block;background:${c};color:#FFFFFF;font:600 15px Arial,sans-serif;text-decoration:none;padding:13px 22px;border-radius:12px">${echapper(o.bouton)}</a>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font:12px/1.5 Arial,sans-serif;color:#8B8178">${echapper(o.pied)}</p>
  </td></tr></table></body></html>`;
}
