// Gmail (API REST) : dossiers, liste, lecture, pièces jointes, rangement, envoi et brouillons.
// Repris de la messagerie du cockpit d'Antonin. Rien n'est jamais effacé définitivement (corbeille, récupérable).
// deno-lint-ignore-file no-explicit-any
import type { CompteMail } from "./google.ts";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const IMAGE_MAX = 400_000;
const entites = (t: string) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const b64 = (o: Uint8Array) => { let s = ""; for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000)); return btoa(s); };
export const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const b64url = (o: Uint8Array) => b64(o).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const lignes76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n").trim();
export const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// En-tête encodé (accents, émojis) : RFC 2047
export const enteteUtf8 = (t: string) => /^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64(new TextEncoder().encode(t))}?=`;

async function appel(jeton: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Gmail ${r.status} : ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : {};
}

export type PieceJointe = { nom: string; type: string; octets: Uint8Array };
export function mime(o: { nom: string; de: string; a: string[]; cc: string[]; cci?: string[]; objet: string; texte: string; html: string | null; pieces: PieceJointe[];
  enReponse?: { messageId: string; references: string } | null }) {
  const id = crypto.randomUUID(), alt = "alt-" + id, mix = "mix-" + id;
  const enc = (t: string) => lignes76(b64(new TextEncoder().encode(t)));
  const corps = o.html
    ? [`Content-Type: multipart/alternative; boundary="${alt}"`, "", `--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
      enc(o.texte), `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", enc(o.html), `--${alt}--`]
    : ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", enc(o.texte)];
  const tete = [`From: ${enteteUtf8(o.nom)} <${o.de}>`, `To: ${o.a.join(", ")}`, ...(o.cc.length ? [`Cc: ${o.cc.join(", ")}`] : []),
    ...(o.cci && o.cci.length ? [`Bcc: ${o.cci.join(", ")}`] : []),
    `Subject: ${enteteUtf8(o.objet)}`, `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`, `Message-ID: <${id}@${o.de.split("@")[1]}>`,
    ...(o.enReponse?.messageId ? [`In-Reply-To: ${o.enReponse.messageId}`, `References: ${[o.enReponse.references, o.enReponse.messageId].filter(Boolean).join(" ")}`] : []),
    "MIME-Version: 1.0"];
  if (!o.pieces.length) return [...tete, ...corps, ""].join("\r\n");
  return [...tete, `Content-Type: multipart/mixed; boundary="${mix}"`, "", `--${mix}`, ...corps, "",
    ...o.pieces.flatMap((p) => [`--${mix}`, `Content-Type: ${p.type || "application/octet-stream"}; name="${enteteUtf8(p.nom)}"`,
      `Content-Disposition: attachment; filename="${enteteUtf8(p.nom)}"`, "Content-Transfer-Encoding: base64", "", lignes76(b64(p.octets))]),
    `--${mix}--`, ""].join("\r\n");
}
// HTML écrit par Lili dans l'éditeur du studio : on ne garde que la mise en forme (ni script, ni style actif, ni attribut on…)
export function nettoyerHtml(h: string) {
  return String(h ?? "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, '$1="#"')
    .slice(0, 400000);
}
export const htmlEnTexte = (h: string) => String(h ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
  .replace(/<li[^>]*>/gi, "- ").replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();

export function citer(o: { de: string; date: string; texte: string; html: string; objet: string; a: string }, mode: string) {
  const quand = o.date ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" }).format(new Date(o.date)) : "";
  if (mode === "transferer") {
    const t = `\n\n---------- Message transféré ----------\nDe : ${o.de}\nDate : ${quand}\nObjet : ${o.objet}\nÀ : ${o.a}\n\n${o.texte}`;
    const h = `<br><div style="border-top:1px solid #ccc;padding-top:8px;color:#555">---------- Message transféré ----------<br>De : ${echapper(o.de)}<br>Date : ${quand}<br>Objet : ${echapper(o.objet)}<br>À : ${echapper(o.a)}</div><br>${o.html || echapper(o.texte).replace(/\n/g, "<br>")}`;
    return { t, h };
  }
  const t = `\n\nLe ${quand}, ${o.de} a écrit :\n${o.texte.split("\n").map((l) => "> " + l).join("\n")}`;
  const h = `<br><div style="color:#555">Le ${quand}, ${echapper(o.de)} a écrit :</div><blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex">${o.html || echapper(o.texte).replace(/\n/g, "<br>")}</blockquote>`;
  return { t, h };
}

export function gmail(c: CompteMail, jeton: string) {
  const g = (chemin: string, init?: RequestInit) => appel(jeton, API + chemin, init);
  const SYSTEME: Record<string, [string, string]> = { INBOX: ["reception", "Boîte de réception"], STARRED: ["etoile", "Suivis"], SENT: ["envoyes", "Envoyés"],
    DRAFT: ["brouillons", "Brouillons"], SPAM: ["indesirables", "Indésirables"], TRASH: ["corbeille", "Corbeille"] };
  const parties = (p: any, acc: any, chemin = "0") => {
    if (!p) return acc;
    const h = (k: string) => (p.headers ?? []).find((x: any) => x.name.toLowerCase() === k)?.value ?? "";
    const cid = h("content-id").replace(/^<|>$/g, "") || null;
    if (p.filename || p.body?.attachmentId && !/^text\//.test(p.mimeType)) {
      acc.pieces.push({ id: p.partId || chemin, piece: p.body?.attachmentId ?? null, nom: p.filename || `image-${acc.pieces.length + 1}`, type: p.mimeType, taille: p.body?.size ?? 0, cid, donnees: p.body?.data ?? null });
    } else if (p.mimeType === "text/plain" && p.body?.data && !acc.texte) acc.texte = new TextDecoder().decode(deB64(p.body.data));
    else if (p.mimeType === "text/html" && p.body?.data && !acc.html) acc.html = new TextDecoder().decode(deB64(p.body.data));
    (p.parts ?? []).forEach((x: any, i: number) => parties(x, acc, `${chemin}.${i}`));
    return acc;
  };
  const lireBrut = async (id: string) => {
    const d = await g(`/messages/${id}?format=full`);
    const h = (k: string) => (d.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === k)?.value ?? "";
    return { d, h, p: parties(d.payload, { texte: "", html: "", pieces: [] }) };
  };
  return {
    async dossiers() {
      const l = (await g("/labels")).labels ?? [];
      const voulus = l.filter((x: any) => SYSTEME[x.id] || x.type === "user");
      const infos = await Promise.all(voulus.map((x: any) => g(`/labels/${x.id}`).catch(() => x)));
      return infos.map((x: any) => ({ id: x.id, nom: SYSTEME[x.id]?.[1] ?? x.name, type: SYSTEME[x.id]?.[0] ?? "perso",
        non_lus: x.id === "DRAFT" || x.id === "SENT" ? 0 : x.messagesUnread ?? 0 }))
        .sort((a: any, b: any) => (Object.keys(SYSTEME).indexOf(a.id) + 1 || 99) - (Object.keys(SYSTEME).indexOf(b.id) + 1 || 99) || a.nom.localeCompare(b.nom, "fr"));
    },
    async lister(dossier: string, q: string, suite: string, n = 30) {
      const etiquette = dossier || "INBOX";
      const l = await g(`/messages?maxResults=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}${q && !dossier ? "" : `&labelIds=${encodeURIComponent(etiquette)}`}${suite ? `&pageToken=${encodeURIComponent(suite)}` : ""}`);
      const ids = (l.messages ?? []).map((m: any) => m.id) as string[];
      const mails: any[] = [];
      for (let i = 0; i < ids.length; i += 10) mails.push(...await Promise.all(ids.slice(i, i + 10).map(async (id) => {
        const d = await g(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`);
        const h = (k: string) => (d.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === k)?.value ?? "";
        const lab: string[] = d.labelIds ?? [];
        return { id, dossier: etiquette, de: h("from"), a: h("to"), objet: h("subject"), date: new Date(+d.internalDate).toISOString(),
          extrait: entites(d.snippet ?? ""), lu: !lab.includes("UNREAD"), suivi: lab.includes("STARRED"), brouillon: lab.includes("DRAFT"), pieces: /mixed/.test(d.payload?.mimeType ?? "") };
      })));
      return { mails, suite: l.nextPageToken ?? null };
    },
    async lire(id: string) {
      const { d, h, p } = await lireBrut(id);
      const images: Record<string, string> = {};
      for (const x of p.pieces.filter((x: any) => x.cid && x.taille < IMAGE_MAX && /^image\//.test(x.type))) {
        const data = x.donnees ?? (await g(`/messages/${id}/attachments/${x.piece}`).catch(() => ({}))).data;
        if (data) images[x.cid] = `data:${x.type};base64,${data.replace(/-/g, "+").replace(/_/g, "/")}`;
      }
      const lab: string[] = d.labelIds ?? [];
      if (lab.includes("UNREAD")) await g(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) }).catch(() => null);
      return { id, de: h("from"), a: h("to"), cc: h("cc"), date: new Date(+d.internalDate).toISOString(), objet: h("subject"), texte: p.texte, html: p.html,
        fil: d.threadId, brouillon: lab.includes("DRAFT"), suivi: lab.includes("STARRED"), images,
        lien: `https://mail.google.com/mail/u/${encodeURIComponent(c.email)}/#all/${d.threadId}`,
        pieces: p.pieces.filter((x: any) => !(x.cid && images[x.cid] && p.html.includes("cid:" + x.cid))).map((x: any) => ({ id: x.id, nom: x.nom, type: x.type, taille: x.taille })) };
    },
    async piece(id: string, piece: string) {
      const { p } = await lireBrut(id);
      const x = p.pieces.find((y: any) => y.id === piece);
      if (!x) throw new Error("pièce jointe introuvable");
      const data = x.donnees ?? (await g(`/messages/${id}/attachments/${x.piece}`)).data;
      return { nom: x.nom, type: x.type, contenu: data.replace(/-/g, "+").replace(/_/g, "/") };
    },
    async ranger(id: string, quoi: string) {
      const mod = (ajout: string[], retrait: string[]) => g(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: ajout, removeLabelIds: retrait }) });
      if (quoi === "corbeille") return g(`/messages/${id}/trash`, { method: "POST" });
      if (quoi === "reception") { const d = await g(`/messages/${id}?format=minimal`); if ((d.labelIds ?? []).includes("TRASH")) await g(`/messages/${id}/untrash`, { method: "POST" }); return mod(["INBOX"], ["SPAM"]); }
      return quoi === "lu" ? mod([], ["UNREAD"]) : quoi === "non_lu" ? mod(["UNREAD"], []) : quoi === "suivi" ? mod(["STARRED"], [])
        : quoi === "non_suivi" ? mod([], ["STARRED"]) : mod([], ["INBOX"]);
    },
    // Conversations (fils), comme Gmail : une ligne par fil, avec ses participants et son nombre de messages
    async fils(dossier: string, q: string, suite: string, n = 40) {
      const etiquette = dossier || "INBOX";
      const l = await g(`/threads?maxResults=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}${q && !dossier ? "" : `&labelIds=${encodeURIComponent(etiquette)}`}${suite ? `&pageToken=${encodeURIComponent(suite)}` : ""}`);
      const ids = (l.threads ?? []).map((t: any) => t.id) as string[];
      const fils: any[] = [];
      for (let i = 0; i < ids.length; i += 10) fils.push(...await Promise.all(ids.slice(i, i + 10).map(async (id) => {
        const t = await g(`/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`);
        const ms = t.messages ?? [], dernier = ms[ms.length - 1] ?? {};
        const h = (m: any, k: string) => (m.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === k)?.value ?? "";
        const labels = new Set<string>(ms.flatMap((m: any) => m.labelIds ?? []));
        const de = [...new Set(ms.map((m: any) => h(m, "from")))];
        return { id, nb: ms.length, de, a: h(dernier, "to"), objet: h(ms[0] ?? {}, "subject") || h(dernier, "subject"), date: new Date(+(dernier.internalDate ?? 0)).toISOString(),
          extrait: entites(dernier.snippet ?? t.snippet ?? ""), lu: !ms.some((m: any) => (m.labelIds ?? []).includes("UNREAD")), suivi: labels.has("STARRED"),
          important: labels.has("IMPORTANT"), libelles: [...labels].filter((x) => /^Label_/.test(x)), brouillon: labels.has("DRAFT"),
          pieces: ms.some((m: any) => /mixed/.test(m.payload?.mimeType ?? "")), dernier: dernier.id };
      })));
      return { fils, suite: l.nextPageToken ?? null, estimation: l.resultSizeEstimate ?? null };
    },
    async lireFil(id: string) {
      const t = await g(`/threads/${id}?format=full`);
      const messages = [];
      for (const d of t.messages ?? []) {
        const h = (k: string) => (d.payload?.headers ?? []).find((x: any) => x.name.toLowerCase() === k)?.value ?? "";
        const p = parties(d.payload, { texte: "", html: "", pieces: [] });
        const images: Record<string, string> = {};
        for (const x of p.pieces.filter((x: any) => x.cid && x.taille < IMAGE_MAX && /^image\//.test(x.type))) {
          const data = x.donnees ?? (await g(`/messages/${d.id}/attachments/${x.piece}`).catch(() => ({}))).data;
          if (data) images[x.cid] = `data:${x.type};base64,${data.replace(/-/g, "+").replace(/_/g, "/")}`;
        }
        const lab: string[] = d.labelIds ?? [];
        messages.push({ id: d.id, de: h("from"), a: h("to"), cc: h("cc"), date: new Date(+d.internalDate).toISOString(), objet: h("subject"), texte: p.texte, html: p.html,
          extrait: entites(d.snippet ?? ""), lu: !lab.includes("UNREAD"), brouillon: lab.includes("DRAFT"), suivi: lab.includes("STARRED"), images,
          pieces: p.pieces.filter((x: any) => !(x.cid && images[x.cid] && p.html.includes("cid:" + x.cid))).map((x: any) => ({ id: x.id, nom: x.nom, type: x.type, taille: x.taille })) });
      }
      if (messages.some((m) => !m.lu)) await g(`/threads/${id}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) }).catch(() => null);
      return { id, messages, lien: `https://mail.google.com/mail/u/${encodeURIComponent(c.email)}/#all/${id}` };
    },
    async rangerFil(id: string, quoi: string) {
      const mod = (ajout: string[], retrait: string[]) => g(`/threads/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: ajout, removeLabelIds: retrait }) });
      if (quoi === "corbeille") return g(`/threads/${id}/trash`, { method: "POST" });
      if (quoi === "reception") { await g(`/threads/${id}/untrash`, { method: "POST" }).catch(() => null); return mod(["INBOX"], ["SPAM"]); }
      if (quoi === "indesirable") return mod(["SPAM"], ["INBOX"]);
      return quoi === "lu" ? mod([], ["UNREAD"]) : quoi === "non_lu" ? mod(["UNREAD"], []) : quoi === "suivi" ? mod(["STARRED"], [])
        : quoi === "non_suivi" ? mod([], ["STARRED"]) : quoi === "important" ? mod(["IMPORTANT"], []) : quoi === "non_important" ? mod([], ["IMPORTANT"]) : mod([], ["INBOX"]);
    },
    libellerFil: (id: string, ajout: string[], retrait: string[]) => g(`/threads/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: ajout, removeLabelIds: retrait }) }),
    creerLibelle: (nom: string) => g("/labels", { method: "POST", body: JSON.stringify({ name: nom, labelListVisibility: "labelShow", messageListVisibility: "show" }) }),
    // Réponse automatique de vacances (réglage Gmail : droit gmail.settings.basic)
    lireVacances: () => g("/settings/vacation"),
    ecrireVacances: (v: any) => g("/settings/vacation", { method: "PUT", body: JSON.stringify(v) }),
    async origine(id: string) {
      const { d, h, p } = await lireBrut(id);
      const pieces: PieceJointe[] = [];
      for (const x of p.pieces.filter((y: any) => !y.cid || y.nom.includes("."))) {
        const data = x.donnees ?? (await g(`/messages/${id}/attachments/${x.piece}`)).data;
        pieces.push({ nom: x.nom, type: x.type, octets: deB64(data) });
      }
      return { de: h("from"), a: h("to"), cc: h("cc"), date: new Date(+d.internalDate).toISOString(), objet: h("subject"), texte: p.texte || "", html: p.html || "",
        messageId: h("message-id"), references: h("references"), fil: d.threadId, pieces };
    },
    async ecrire(raw: string, fil: string | null, envoyer: boolean, brouillonId: string | null) {
      const message = { raw: b64url(new TextEncoder().encode(raw)), ...(fil ? { threadId: fil } : {}) };
      if (envoyer) {
        await g("/messages/send", { method: "POST", body: JSON.stringify(message) });
        if (brouillonId) await g(`/drafts/${brouillonId}`, { method: "DELETE" }).catch(() => null);
        return null;
      }
      const r = brouillonId ? await g(`/drafts/${brouillonId}`, { method: "PUT", body: JSON.stringify({ message }) })
        : await g("/drafts", { method: "POST", body: JSON.stringify({ message }) });
      return r.id as string;
    },
  };
}
