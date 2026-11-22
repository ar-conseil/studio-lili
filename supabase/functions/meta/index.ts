// Publication directe sur Instagram et Facebook (API officielle de Meta).
//  POST { action: "connecter" }                         (Lili avec son code) -> { url } de la page d'accord Facebook
//  GET  ?code=…&state=…                                  retour de Facebook : jeton longue durée, comptes trouvés, retour aux Réglages
//  POST { action: "actualiser" }                         (Lili) relit ses Pages et comptes Instagram
//  POST { action: "programmer", publication_id, reseaux, quand: "maintenant"|"prevu", medias: [chemins] }   (Lili)
//  POST { action: "annuler", publication_id, reseau }     (Lili)
//  POST { action: "file" }                               (pg_cron, clé de synchro) publie ce que Lili a programmé et qui est arrivé à l'heure
// Rien ne part sans un geste de Lili : une diffusion n'existe que si elle l'a créée.
// Secrets : META_APP_ID, META_APP_SECRET (et META_CONFIG_ID si l'application utilise « Facebook Login for Business »).
import { appelant, base, cors, estLili, json, parCron, SITE } from "../_partage/commun.ts";
import { lireEtat, signerEtat } from "../_partage/google.ts";

const V = Deno.env.get("META_GRAPH_VERSION") ?? "v27.0";
const GRAPH = `https://graph.facebook.com/${V}`;
const RETOUR = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta`;
const PERMISSIONS = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "business_management",
  "instagram_basic", "instagram_content_publish", "instagram_manage_insights", "read_insights", "publish_video", "ads_read"];
const retourSite = (m: string) => Response.redirect(`${SITE}#reglages?onglet=reseaux&meta=${encodeURIComponent(m)}`, 302);
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function graph(chemin: string, o: { method?: string; params?: Record<string, string>; jeton?: string } = {}) {
  const p = new URLSearchParams(o.params ?? {});
  if (o.jeton) p.set("access_token", o.jeton);
  const post = (o.method ?? "GET") === "POST";
  const r = await fetch(`${GRAPH}${chemin}${post ? "" : `?${p}`}`, post ? { method: "POST", body: p } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error ?? {};
    throw new Error(e.error_user_msg || e.message || `Meta a refusé (${r.status})`);
  }
  return j;
}

// Relit les Pages de Lili et leurs comptes Instagram professionnels ; garde les associations déjà faites
async function actualiser(db: any, li: any) {
  const pages: any[] = [];
  let suite = `/me/accounts`;
  let params: Record<string, string> = { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}", limit: "100" };
  for (let i = 0; i < 10 && suite; i++) {
    const j = await graph(suite, { params, jeton: li.jeton });
    pages.push(...(j.data ?? []));
    const n = j.paging?.next ? new URL(j.paging.next) : null;
    suite = n ? n.pathname.replace(`/${V}`, "") : ""; params = n ? Object.fromEntries(n.searchParams) : {};
    if (n) delete params.access_token;
  }
  const lignes: any[] = [];
  for (const p of pages) {
    lignes.push({ liaison_id: li.id, reseau: "facebook", meta_id: p.id, page_id: p.id, nom: p.name, identifiant: null, photo_url: p.picture?.data?.url ?? null, jeton_page: p.access_token, modifie_le: new Date().toISOString() });
    const ig = p.instagram_business_account;
    if (ig) lignes.push({ liaison_id: li.id, reseau: "instagram", meta_id: ig.id, page_id: p.id, nom: ig.name || ig.username, identifiant: ig.username, photo_url: ig.profile_picture_url ?? null, jeton_page: p.access_token, modifie_le: new Date().toISOString() });
  }
  if (lignes.length) {
    const { error } = await db.from("meta_comptes").upsert(lignes, { onConflict: "reseau,meta_id" });
    if (error) throw new Error(error.message);
  }
  return lignes.length;
}

// ---------- Publier ----------
function legendeDe(p: any) {
  const tags = (p.hashtags ?? []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return [String(p.legende ?? "").trim(), tags].filter(Boolean).join("\n\n").slice(0, 2200);
}
async function urlsSignees(db: any, chemins: string[]) {
  if (!chemins.length) return [];
  const { data, error } = await db.storage.from("medias").createSignedUrls(chemins, 3600);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x: any) => x.signedUrl);
}
async function attendreConteneur(id: string, jeton: string, essais: number) {
  for (let i = 0; i < essais; i++) {
    const j = await graph(`/${id}`, { params: { fields: "status_code,status" }, jeton });
    if (j.status_code === "FINISHED") return true;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") throw new Error(`Instagram n'a pas pu préparer le média (${j.status || j.status_code})`);
    await attendre(3000);
  }
  return false;   // encore en préparation (vidéo) : on reprendra au prochain passage
}
async function publierInstagram(db: any, d: any, p: any, c: any) {
  const jeton = c.jeton_page, ig = c.meta_id, legende = legendeDe(p);
  const urls = await urlsSignees(db, (d.medias ?? []).map((m: any) => m.chemin));
  const types = (d.medias ?? []).map((m: any) => m.type);
  let conteneur = d.conteneur as string | null;
  if (!conteneur) {
    if (!urls.length) throw new Error("Instagram demande au moins un visuel");
    if (p.format === "story") {
      conteneur = (await graph(`/${ig}/media`, { method: "POST", jeton, params: { media_type: "STORIES", [types[0] === "video" ? "video_url" : "image_url"]: urls[0] } })).id;
    } else if (types[0] === "video" && urls.length === 1) {
      conteneur = (await graph(`/${ig}/media`, { method: "POST", jeton, params: { media_type: "REELS", video_url: urls[0], caption: legende, share_to_feed: "true" } })).id;
    } else if (urls.length === 1) {
      conteneur = (await graph(`/${ig}/media`, { method: "POST", jeton, params: { image_url: urls[0], caption: legende } })).id;
    } else {
      const enfants: string[] = [];
      for (let i = 0; i < Math.min(urls.length, 20); i++) {
        const params: Record<string, string> = types[i] === "video" ? { media_type: "VIDEO", video_url: urls[i], is_carousel_item: "true" } : { image_url: urls[i], is_carousel_item: "true" };
        const id = (await graph(`/${ig}/media`, { method: "POST", jeton, params })).id;
        if (types[i] === "video") await attendreConteneur(id, jeton, 40);
        enfants.push(id);
      }
      conteneur = (await graph(`/${ig}/media`, { method: "POST", jeton, params: { media_type: "CAROUSEL", children: enfants.join(","), caption: legende } })).id;
    }
    await db.from("diffusions").update({ conteneur }).eq("id", d.id);
  }
  const pret = await attendreConteneur(conteneur!, jeton, types.includes("video") ? 15 : 10);
  if (!pret) return { enCours: true };
  const pub = await graph(`/${ig}/media_publish`, { method: "POST", jeton, params: { creation_id: conteneur! } });
  const info = await graph(`/${pub.id}`, { params: { fields: "permalink" }, jeton }).catch(() => ({}));
  return { id: pub.id, lien: info.permalink ?? null };
}
async function publierFacebook(db: any, d: any, p: any, c: any) {
  const jeton = c.jeton_page, page = c.meta_id, message = legendeDe(p);
  const urls = await urlsSignees(db, (d.medias ?? []).map((m: any) => m.chemin));
  const types = (d.medias ?? []).map((m: any) => m.type);
  let id: string;
  if (types[0] === "video") {
    id = (await graph(`/${page}/videos`, { method: "POST", jeton, params: { file_url: urls[0], description: message } })).id;
  } else if (urls.length === 1) {
    const r = await graph(`/${page}/photos`, { method: "POST", jeton, params: { url: urls[0], caption: message } });
    id = r.post_id || r.id;
  } else if (urls.length > 1) {
    const photos: string[] = [];
    for (const u of urls.slice(0, 10)) photos.push((await graph(`/${page}/photos`, { method: "POST", jeton, params: { url: u, published: "false" } })).id);
    const params: Record<string, string> = { message };
    photos.forEach((ph, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: ph }); });
    id = (await graph(`/${page}/feed`, { method: "POST", jeton, params })).id;
  } else {
    const params: Record<string, string> = { message };
    if (p.lien) params.link = p.lien;
    id = (await graph(`/${page}/feed`, { method: "POST", jeton, params })).id;
  }
  const info = await graph(`/${id}`, { params: { fields: "permalink_url" }, jeton }).catch(() => ({}));
  return { id, lien: info.permalink_url ?? `https://www.facebook.com/${id}` };
}
async function executer(db: any, d: any) {
  const { data: p } = await db.from("publications").select("id, espace_id, titre, legende, hashtags, lien, format, statut, corbeille_le").eq("id", d.publication_id).single();
  if (!p || p.corbeille_le) { await db.from("diffusions").update({ etat: "annulee", erreur: "publication à la corbeille" }).eq("id", d.id); return; }
  const { data: c } = await db.from("meta_comptes").select("*").eq("id", d.compte_id).maybeSingle();
  if (!c?.jeton_page) { await db.from("diffusions").update({ etat: "erreur", erreur: "compte non relié : Réglages › Réseaux sociaux" }).eq("id", d.id); return; }
  await db.from("diffusions").update({ etat: "en-cours", tentatives: (d.tentatives ?? 0) + 1 }).eq("id", d.id);
  try {
    const r: any = d.reseau === "instagram" ? await publierInstagram(db, d, p, c) : await publierFacebook(db, d, p, c);
    if (r.enCours) { await db.from("diffusions").update({ etat: "en-cours" }).eq("id", d.id); return; }   // vidéo en préparation : prochain passage
    await db.from("diffusions").update({ etat: "publiee", meta_media_id: r.id, lien: r.lien, erreur: null, publiee_le: new Date().toISOString() }).eq("id", d.id);
    // Toutes les diffusions demandées sont en ligne : la publication passe « publiée » (le client voit le lien)
    const { data: reste } = await db.from("diffusions").select("id").eq("publication_id", p.id).in("etat", ["programmee", "en-cours", "erreur"]);
    if (!reste?.length) {
      const { data: toutes } = await db.from("diffusions").select("reseau, lien").eq("publication_id", p.id).eq("etat", "publiee");
      const lien = (toutes ?? []).find((x: any) => x.reseau === "instagram")?.lien ?? (toutes ?? [])[0]?.lien ?? null;
      await db.from("publications").update({ statut: "publie", lien_en_ligne: lien }).eq("id", p.id);
    }
  } catch (e) {
    const msg = (e as Error).message.slice(0, 400);
    // Une erreur passagère est retentée (3 fois au plus) ; ensuite Lili voit l'erreur et choisit
    const definitif = /permission|autoris|token|jeton|expired|invalid|session|\(#?190\)|#10\b|#200\b/i.test(msg);
    if (definitif) await db.from("meta_liaison").update({ derniere_erreur: msg }).not("id", "is", null);
    await db.from("diffusions").update({ etat: (d.tentatives ?? 0) + 1 < 3 && !definitif ? "programmee" : "erreur", erreur: msg,
      prevue_le: new Date(Date.now() + 10 * 60_000).toISOString(), conteneur: null }).eq("id", d.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = base();

  // Retour de Facebook après l'accord de Lili
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    if (q.get("error")) return retourSite(q.get("error_description") || "accord refusé");
    const etat = await lireEtat(q.get("state") ?? ""), code = q.get("code");
    if (!etat || !code) return retourSite("lien expiré : recommencez");
    try {
      const court = await graph("/oauth/access_token", { params: { client_id: Deno.env.get("META_APP_ID")!, client_secret: Deno.env.get("META_APP_SECRET")!, redirect_uri: RETOUR, code } });
      const long = await graph("/oauth/access_token", { params: { grant_type: "fb_exchange_token", client_id: Deno.env.get("META_APP_ID")!, client_secret: Deno.env.get("META_APP_SECRET")!, fb_exchange_token: court.access_token } });
      const moi = await graph("/me", { params: { fields: "id,name" }, jeton: long.access_token });
      const expire = long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null;
      const { data: avant } = await db.from("meta_liaison").select("id").eq("personne_id", etat.p).maybeSingle();
      const ligne = { personne_id: etat.p, meta_user_id: moi.id, nom: moi.name, jeton: long.access_token, expire_le: expire, derniere_erreur: null, modifie_le: new Date().toISOString() };
      const { data: li, error } = avant ? await db.from("meta_liaison").update(ligne).eq("id", avant.id).select("*").single() : await db.from("meta_liaison").insert(ligne).select("*").single();
      if (error) throw new Error(error.message);
      const n = await actualiser(db, li);
      return retourSite(n ? "ok" : "aucun compte trouvé : vérifiez vos accès aux Pages");
    } catch (e) {
      return retourSite((e as Error).message);
    }
  }

  const b = await req.json().catch(() => ({}));
  if (parCron(req)) {
    const { data: file } = await db.from("diffusions").select("*").in("etat", ["programmee", "en-cours"]).lte("prevue_le", new Date().toISOString()).order("prevue_le").limit(10);
    for (const d of file ?? []) await executer(db, d);
    return json({ ok: true, traitees: (file ?? []).length });
  }
  const a = await appelant(db, req);
  if (!estLili(a)) return json({ erreur: "réservé à Lili, avec son code à 6 chiffres" }, 403);
  try {
    switch (b.action) {
      case "connecter": {
        if (!Deno.env.get("META_APP_ID")) return json({ erreur: "l'application Meta n'est pas encore déclarée (étapes dans Réglages › Réseaux sociaux)" }, 400);
        const p = new URLSearchParams({ client_id: Deno.env.get("META_APP_ID")!, redirect_uri: RETOUR, state: await signerEtat(a!.id), response_type: "code" });
        if (Deno.env.get("META_CONFIG_ID")) p.set("config_id", Deno.env.get("META_CONFIG_ID")!); else p.set("scope", PERMISSIONS.join(","));
        return json({ url: `https://www.facebook.com/${V}/dialog/oauth?${p}` });
      }
      case "actualiser": {
        const { data: li } = await db.from("meta_liaison").select("*").order("cree_le").limit(1).maybeSingle();
        if (!li?.jeton) return json({ erreur: "compte Facebook pas encore relié" }, 400);
        try { return json({ ok: true, comptes: await actualiser(db, li) }); }
        catch (e) { await db.from("meta_liaison").update({ derniere_erreur: (e as Error).message }).eq("id", li.id); throw e; }
      }
      case "programmer": {
        const reseaux: string[] = (Array.isArray(b.reseaux) ? b.reseaux : []).filter((r: string) => r === "instagram" || r === "facebook");
        const { data: p } = await db.from("publications").select("id, espace_id, date_prevue").eq("id", b.publication_id).single();
        if (!p || !reseaux.length) return json({ erreur: "publication ou réseau manquant" }, 400);
        const medias = (Array.isArray(b.medias) ? b.medias : []).filter((m: any) => typeof m?.chemin === "string" && m.chemin.startsWith(`${p.espace_id}/`)).slice(0, 20);
        const quand = b.quand === "maintenant" || !p.date_prevue || new Date(p.date_prevue) < new Date() ? new Date().toISOString() : p.date_prevue;
        const resultats: Record<string, string> = {};
        for (const r of reseaux) {
          const { data: c } = await db.from("meta_comptes").select("id").eq("espace_id", p.espace_id).eq("reseau", r).limit(1).maybeSingle();
          if (!c) { resultats[r] = "aucun compte " + r + " associé à ce client"; continue; }
          const { error } = await db.from("diffusions").upsert({ publication_id: p.id, reseau: r, compte_id: c.id, etat: "programmee", prevue_le: quand, medias, conteneur: null, erreur: null, tentatives: 0, cree_par: a!.id },
            { onConflict: "publication_id,reseau" });
          resultats[r] = error ? error.message : "programmee";
        }
        // Statut « programmée » côté studio ; publication tout de suite si demandé
        await db.from("publications").update({ statut: "programme" }).eq("id", p.id).in("statut", ["valide", "a-valider", "modifs-demandees", "en-creation", "idee"]);
        if (b.quand === "maintenant") {
          const { data: ds } = await db.from("diffusions").select("*").eq("publication_id", p.id).eq("etat", "programmee");
          for (const d of ds ?? []) await executer(db, d);
        }
        const { data: etat } = await db.from("diffusions").select("reseau, etat, lien, erreur, prevue_le").eq("publication_id", p.id);
        return json({ ok: true, resultats, diffusions: etat });
      }
      case "annuler": {
        await db.from("diffusions").update({ etat: "annulee" }).eq("publication_id", b.publication_id).eq("reseau", b.reseau).in("etat", ["programmee", "erreur"]);
        return json({ ok: true });
      }
    }
    return json({ erreur: "action inconnue" }, 400);
  } catch (e) {
    return json({ erreur: (e as Error).message }, 502);
  }
});
