// Connexion OAuth à Google pour la boîte Gmail de Lili (repris du cockpit d'Antonin, Gmail seulement).
// Droits demandés : gmail.modify (lire, ranger, mettre à la corbeille, envoyer ; jamais d'effacement définitif).
// Les jetons restent côté serveur (table comptes_mail, colonnes non lisibles par le navigateur).

const env = (k: string) => Deno.env.get(k) ?? "";
export const urlRetour = () => `${env("SUPABASE_URL")}/functions/v1/connexion-google`;
// gmail.settings.basic : la réponse automatique de vacances, réglée depuis le studio
const SCOPES = "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic";
export type CompteMail = { id: string; personne_id: string; email: string; refresh_token: string | null; jeton_acces: string | null; jeton_expire_le: string | null; droits: string | null };

const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
// Clé de l'état signé : la clé de synchro du studio, sans valeur de secours (une clé devinable laisserait forger l'état)
const cle = () => {
  const k = env("CLE_SYNCHRO");
  if (!k || k.length < 16) throw new Error("clé de synchro absente : relancez le déploiement");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(k), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
};

// État signé (15 min) : il dit, au retour de Google, pour qui la boîte est reliée
export async function signerEtat(personne: string): Promise<string> {
  const charge = b64(new TextEncoder().encode(JSON.stringify({ p: personne, exp: Date.now() + 15 * 60000, n: crypto.randomUUID() })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await cle(), new TextEncoder().encode(charge)));
  return `${charge}.${b64(sig)}`;
}
export async function lireEtat(etat: string): Promise<{ p: string } | null> {
  const [charge, sig] = etat.split(".");
  if (!charge || !sig) return null;
  if (!(await crypto.subtle.verify("HMAC", await cle(), deB64(sig), new TextEncoder().encode(charge)))) return null;
  const j = JSON.parse(new TextDecoder().decode(deB64(charge)));
  return j.exp > Date.now() ? { p: j.p } : null;
}
export function urlAutorisation(etat: string, indice?: string): string {
  const p: Record<string, string> = { client_id: env("GOOGLE_CLIENT_ID"), redirect_uri: urlRetour(), response_type: "code", scope: SCOPES,
    access_type: "offline", prompt: "consent select_account", include_granted_scopes: "true", state: etat };
  if (indice) p.login_hint = indice;
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(p)}`;
}
async function demanderJeton(champs: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...champs }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google : ${j.error_description || j.error || r.status}`);
  return j as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string; scope?: string };
}
export async function echangerCode(code: string) {
  const j = await demanderJeton({ grant_type: "authorization_code", code, redirect_uri: urlRetour() });
  const email = j.id_token ? (JSON.parse(new TextDecoder().decode(deB64(j.id_token.split(".")[1]))).email ?? "") : "";
  return { email: String(email).toLowerCase(), refresh_token: j.refresh_token ?? null, jeton_acces: j.access_token, droits: j.scope ?? null,
    jeton_expire_le: new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() };
}
// Jeton d'accès valide (renouvelé et enregistré si besoin)
// deno-lint-ignore no-explicit-any
export async function jetonAcces(db: any, c: CompteMail): Promise<string> {
  if (c.jeton_acces && c.jeton_expire_le && Date.parse(c.jeton_expire_le) > Date.now()) return c.jeton_acces;
  if (!c.refresh_token) throw new Error("connexion Gmail expirée : reliez à nouveau la boîte");
  try {
    const j = await demanderJeton({ grant_type: "refresh_token", refresh_token: c.refresh_token });
    c.jeton_acces = j.access_token;
    c.jeton_expire_le = new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString();
    await db.from("comptes_mail").update({ jeton_acces: c.jeton_acces, jeton_expire_le: c.jeton_expire_le, derniere_erreur: null }).eq("id", c.id);
    return c.jeton_acces;
  } catch (e) {
    await db.from("comptes_mail").update({ derniere_erreur: (e as Error).message.slice(0, 300) }).eq("id", c.id);
    throw e;
  }
}
