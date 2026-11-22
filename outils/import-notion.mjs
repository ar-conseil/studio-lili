#!/usr/bin/env node
// Import du Notion de Lili (« Mon espace CM ») dans le studio, d'après docs/import-notion.md (validé le 21/11/2026).
//   node outils/import-notion.mjs            aperçu : lit tout, n'écrit rien, résume (détail dans ~/.lili/import-apercu.json)
//   node outils/import-notion.mjs --ecrire   écrit en base et envoie les visuels, logos et factures PDF dans Storage
// Rejouable : chaque ligne garde son identifiant Notion (notion_id) ; un fichier garde le même chemin.
// Lit : ~/.lili/notion-export (export Markdown & CSV), ~/.lili/logos-clients, ~/.lili/supabase.env.
// La clé service_role est demandée à l'API d'administration au lancement et ne quitte jamais la mémoire.
// Aucune donnée client n'est écrite dans le dépôt : la correspondance des clients est dans ~/.lili/import-espaces.json.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, extname, basename, relative } from "node:path";
import { homedir, tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ECRIRE = process.argv.includes("--ecrire");
const LILI = join(homedir(), ".lili"), EXPORT = join(LILI, "notion-export"), LOGOS = join(LILI, "logos-clients");
const AUJ = new Date(); AUJ.setHours(0, 0, 0, 0);
const empreinte = (t) => createHash("sha1").update(t).digest("hex").slice(0, 16);
const uuidDe = (t) => { const h = createHash("sha1").update("studio-lili:" + t).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const norme = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().toUpperCase();

// Correspondance Notion -> espaces (marques, raisons sociales, comptes, couleurs, logos) : fichier PRIVÉ, validé par Antonin
// le 21/11/2026, jamais dans le dépôt : ~/.lili/import-espaces.json (une entrée par espace : slug, nom, metier, couleur,
// reseaux, logo, notion [noms vus dans Notion], facture [noms vus sur les factures], client [nom de la base Clients], comptes).
const ESPACES = JSON.parse(readFileSync(join(LILI, "import-espaces.json"), "utf8"));
// Notes écartées après l'import (copies d'une même note, notes qui répétaient la légende) : jamais recréées
const NOTES_IGNOREES = new Set(existsSync(join(LILI, "import-notes-ignorees.json")) ? JSON.parse(readFileSync(join(LILI, "import-notes-ignorees.json"), "utf8")) : []);
ESPACES.forEach((e, i) => { e.id = uuidDe("espace:" + e.slug); e.ordre = i + 1; });
const parNomNotion = (t) => { const n = norme(t); return ESPACES.find((e) => e.notion.some((x) => n === norme(x) || n.startsWith(norme(x) + " "))) || null; };
const parFacture = (t) => ESPACES.find((e) => e.facture.some((x) => norme(t) === norme(x))) || null;

// ---------- Lecture de l'export ----------
function lireCsv(f) {
  let t = readFileSync(f, "utf8").replace(/^﻿/, ""); const L = []; let l = [], c = "", q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { l.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; l.push(c); L.push(l); l = []; c = ""; } else c += ch; }
  if (c !== "" || l.length) { l.push(c); L.push(l); }
  const [h, ...rs] = L.filter((x) => x.some((y) => y !== ""));
  return rs.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] ?? "").trim()])));
}
const tous = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? tous(p) : [p]; });
const FICHIERS = tous(EXPORT);
const MOIS = { janvier: 0, fevrier: 1, février: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, août: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, décembre: 11 };
function jour(t) { const m = /(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i.exec(t || ""); if (!m || MOIS[m[2].toLowerCase()] == null) return null; return new Date(+m[3], MOIS[m[2].toLowerCase()], +m[1]); }
function plage(t) { const [a, b] = String(t || "").split("→"); return { debut: jour(a), fin: b ? jour(b) : null }; }
const iso = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;
const HEURES = { story: [9, 0], linkedin: [8, 30], defaut: [12, 30] };
function aLHeure(d, reseau, format) { if (!d) return null; const h = format === "story" ? HEURES.story : reseau === "linkedin" ? HEURES.linkedin : HEURES.defaut;
  const x = new Date(d); x.setHours(h[0], h[1], 0, 0); return x.toISOString(); }
const montant = (t) => { const x = String(t || "").replace(/[^\d,.-]/g, "").replace(",", "."); return x ? Math.round(parseFloat(x) * 100) / 100 : null; };
const oui = (t) => /^(yes|oui|true)$/i.test(t || "");

// Fichier joint d'une colonne Notion (« Dossier/Fichier%20x.png, Autre.png ») -> chemins réels
// Les chemins sont relatifs à la page qui contient la base : le dossier de la base, ou un ou deux crans au-dessus.
function fichiersJoints(dossierCsv, valeur) {
  if (!valeur) return [];
  const bases = [dossierCsv, dirname(dossierCsv), dirname(dirname(dossierCsv))];
  return valeur.split(", ").map((x) => x.trim()).filter(Boolean).map((m) => {
    let u = m; try { u = decodeURIComponent(m); } catch { /* tel quel */ }
    return bases.map((b) => join(b, u)).find((p) => existsSync(p) && statSync(p).isFile()) || null;
  }).filter(Boolean);
}
// Corps d'une fiche Notion (ce qui n'est pas une propriété), pour la note interne
function corpsFiche(dossierCsv, titre) {
  const dossier = dossierCsv;
  const f = FICHIERS.find((p) => dirname(p) === dossier && p.endsWith(".md") && norme(basename(p).replace(/ [0-9a-f]{32}\.md$/, "")) === norme(titre).slice(0, norme(basename(p).replace(/ [0-9a-f]{32}\.md$/, "")).length) && norme(titre));
  if (!f) return "";
  const l = readFileSync(f, "utf8").split("\n").slice(1);
  return l.filter((x) => x.trim() && !/^[^:#\n]{1,40}:\s/.test(x)).join("\n").trim();
}

// ---------- Publications ----------
const FORMATS = [[/REEL/, "reel"], [/CARR?OUSS?EL/, "carrousel"], [/STORY/, "story"], [/COUVERTURE/, "couverture"], [/ARTICLE/, "article"], [/POST|TIRAGE/, "post"]];
function statutDe(r, date, legende, visuels) {
  const t = norme([r["STATUT"], r["CATÉGORIE"], r["FORMAT"], r["FORMAT "]].join(" ")), fait = oui(r["Done !"] || r["Done!"] || r["Done"]);
  const etapes = [];
  if (/A REDIGER/.test(t)) etapes.push("rediger"); if (/A TOURNER/.test(t)) etapes.push("tourner"); if (/A MONTER/.test(t)) etapes.push("monter"); if (/VISUEL A CREER/.test(t)) etapes.push("visuel");
  if (/POSTE\b/.test(t) || (fait && date && date < AUJ)) return { statut: "publie", etapes: [] };
  if (/(^| )PROGRAMME( |$)/.test(t) || (fait && date && date >= AUJ) || (fait && !date)) return { statut: "programme", etapes: [] };
  if (/A PROGRAMMER|A POSTER/.test(t)) return { statut: "valide", etapes: [] };
  if (etapes.length) return { statut: "en-creation", etapes };
  if (date && (legende || visuels)) return { statut: "en-creation", etapes: [] };
  return { statut: "idee", etapes: [] };
}
const plan = { espaces: [], prives: [], comptes: [], operations: [], tempsForts: [], publications: [], medias: [], liens: [], notes: [], taches: [], factures: [], alertes: [] };
const pubsParCle = new Map(), mediasParChemin = new Map();
function media(e, chemin, dossier) {
  const ext = extname(chemin).toLowerCase().replace(".", "") || "bin", rel = relative(EXPORT, chemin);
  const type = /^(jpe?g|png|webp|gif|heic)$/.test(ext) ? "image" : /^(mp4|mov|m4v|webm)$/.test(ext) ? "video" : "document";
  const ext2 = ext === "heic" ? "jpg" : ext;
  const dest = `${e.id}/notion-${empreinte(rel)}.${ext2}`;
  if (!mediasParChemin.has(dest)) mediasParChemin.set(dest, { id: uuidDe("media:" + rel), espace_id: e.id, chemin: dest, type, nom_fichier: basename(chemin).replace(/ [0-9a-f]{32}/, ""),
    taille: statSync(chemin).size, dossier: dossier || "Archives", etiquettes: [], visibilite: "partage", notion_id: rel, source: chemin, heic: ext === "heic" });
  return mediasParChemin.get(dest);
}
const calendriers = FICHIERS.filter((p) => /CALENDRIER[^/]*_all\.csv$/.test(p));
for (const f of calendriers) {
  const dossierClient = relative(join(EXPORT, "Privé et partagé", "Mon espace CM", "Édito & infos"), f).split("/")[0];
  const e = parNomNotion(dossierClient.replace(/ [0-9a-f]{32}$/, ""));
  if (!e) { plan.alertes.push("Calendrier sans espace : " + f); continue; }
  const reseauCal = /FACEBOOK/.test(f) ? "facebook" : /INSTAGRAM/.test(f) ? "instagram" : null;
  for (const r of lireCsv(f)) {
    const titre = r["PUBLICATIONS ✏️"] || "";
    const { debut, fin } = plage(r["DATES 📆"]);
    let legende = r["LÉGENDE"] || r["LEGENDE"] || r["Texte"] || "", lienEnLigne = null;
    if (/^https?:\/\/\S+$/.test(legende)) { lienEnLigne = legende; legende = ""; }
    const visuels = fichiersJoints(dirname(f), r["VISUEL 📸"] || r["Fichiers et médias"]);
    if (!titre && !legende && !visuels.length) continue;
    const fmtTexte = norme(r["FORMAT"] || r["FORMAT "]), format = (FORMATS.find((x) => x[0].test(fmtTexte)) || [null, "post"])[1];
    const etiquettes = [];
    if (/TIRAGE/.test(fmtTexte)) etiquettes.push("jeu concours");
    // Réseau de la publication : colonne RÉSEAU, sinon le calendrier (Instagram ou Facebook), sinon le réseau par défaut de l'espace
    let reseaux = r["RÉSEAU"] ? [/LINKEDIN/i.test(r["RÉSEAU"]) ? "linkedin" : /FACEBOOK/i.test(r["RÉSEAU"]) ? "facebook" : "instagram"] : reseauCal ? [reseauCal] : e.reseaux.slice(0, 1);
    let compte = null;
    // Calendrier à plusieurs comptes : la colonne CLIENT dit lequel (règles dans import-espaces.json, « colonneClient » :
    // [{ motif, compte, reseau, etiquettes: [[motif, texte]] }], la première règle dont le motif apparaît l'emporte, motif vide = par défaut)
    if (e.colonneClient) {
      const c = norme(r["CLIENT"]), regle = e.colonneClient.find((x) => !x.motif || c.includes(x.motif));
      if (regle) {
        compte = regle.compte;
        if (regle.reseau && (regle.forcer || !r["RÉSEAU"])) reseaux = [regle.reseau];
        (regle.etiquettes || []).forEach(([m, t]) => { if (c.includes(m)) etiquettes.push(t); });
      }
    }
    const { statut, etapes } = statutDe(r, debut, legende, visuels.length);
    const auteurClient = r["Created by"] && !/lili/i.test(r["Created by"]) ? r["Created by"] : null;
    if (auteurClient) etiquettes.push("proposé par " + auteurClient.split(" ")[0]);
    const notes = [r["NOTES"], r["BROUILLONS"], corpsFiche(join(dirname(f), basename(f).replace(/_all\.csv$/, "").replace(/ [0-9a-f]{32}$/, "")), titre)].filter(Boolean).join("\n\n").trim();
    const cle = `${e.slug}|${norme(titre)}|${iso(debut)}`;
    if (pubsParCle.has(cle) && titre) {   // même publication dans le calendrier Instagram et dans le calendrier Facebook
      const p = pubsParCle.get(cle); reseaux.forEach((x) => { if (!p.reseaux.includes(x)) p.reseaux.push(x); });
      visuels.forEach((v) => p._visuels.push(media(e, v, "Archives"))); continue;
    }
    const p = { id: uuidDe("pub:" + cle + (titre ? "" : Math.random())), espace_id: e.id, titre: titre || "Sans titre", reseaux, format, statut, etapes, etiquettes,
      date_prevue: aLHeure(debut, reseaux[0], format), fin: fin ? aLHeure(fin, reseaux[0], format) : null, legende, hashtags: [], mentions: [],
      lien: r["cont@ct"] || null, script: r["VOIX OFF"] || null, lien_en_ligne: lienEnLigne, notion_id: "pub:" + cle,
      _compte: compte, _operation: r["ACTUALITÉ 📢"] || null, _visuels: visuels.map((v) => media(e, v, "Archives")), _note: notes };
    if (!titre) p.notion_id += ":" + empreinte(legende + visuels.join());
    pubsParCle.set(cle + (titre ? "" : p.notion_id), p);
  }
}
plan.publications = [...pubsParCle.values()];

// ---------- Opérations (colonne ACTUALITÉ) ----------
const MOIS_COURTS = { JAN: 0, JANV: 0, FEV: 1, FEVR: 1, MARS: 2, AVR: 3, AVRIL: 3, MAI: 4, JUIN: 5, JUIL: 6, AOUT: 7, SEPT: 8, OCT: 9, NOV: 10, DEC: 11 };
const opsParCle = new Map();
for (const p of plan.publications.filter((x) => x._operation)) {
  const libelle = p._operation.replace(/[^\p{L}\p{N}\s'&+:.-]/gu, "").replace(/\s+/g, " ").trim();
  const cle = p.espace_id + "|" + norme(libelle);
  const joli = (t) => { let x = t.toLowerCase(); x = x.charAt(0).toUpperCase() + x.slice(1);
    return x.replace(/\bnoel\b/gi, "Noël").replace(/\boe\b/gi, "OE").replace(/\brcl\b/gi, "RCL").replace(/black friday/i, "Black Friday").replace(/de lavent/i, "de l'Avent")
      .replace(/e-gaming/i, "E-gaming").replace(/louvre lens/i, "Louvre-Lens").replace(/valentina/i, "Valentina").replace(/nyno/i, "Nyno").replace(/\b(nov|dec|avril)\b/gi, (m) => m.toLowerCase()); };
  if (!opsParCle.has(cle)) opsParCle.set(cle, { id: uuidDe("op:" + cle), espace_id: p.espace_id, libelle: joli(libelle),
    notion_id: "op:" + cle, dates: [], brut: libelle, visibilite: "partage" });
  const o = opsParCle.get(cle); if (p.date_prevue) o.dates.push(new Date(p.date_prevue)); p.operation_id = o.id;
}
for (const o of opsParCle.values()) {
  const n = o.brut.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(), annee = o.dates.length ? o.dates.sort((a, b) => a - b)[Math.floor(o.dates.length / 2)].getFullYear() : AUJ.getFullYear();
  const m = [...n.matchAll(/(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+(JANV?|FEVR?|MARS|AVRIL|AVR|MAI|JUIN|JUIL|AOUT|SEPT|OCT|NOV|DEC)\b/g)];
  if (m.length) {
    const d1 = new Date(annee, MOIS_COURTS[m[0][3]], +m[0][1]), dern = m[m.length - 1];
    const d2 = dern[2] ? new Date(annee, MOIS_COURTS[dern[3]], +dern[2]) : m.length > 1 ? new Date(annee, MOIS_COURTS[dern[3]], +dern[1]) : d1;
    o.debut = iso(d1); o.fin = iso(d2 < d1 ? new Date(annee + 1, d2.getMonth(), d2.getDate()) : d2);
  } else if (o.dates.length) { o.debut = iso(o.dates[0]); o.fin = iso(o.dates[o.dates.length - 1]); }
  delete o.dates; delete o.brut; plan.operations.push(o);
}

// ---------- Absences, état de programmation, facturation des clients ----------
for (const f of FICHIERS.filter((p) => /ABSENCES ET VACANCES[^/]*_all\.csv$/.test(p))) {
  const e = parNomNotion(relative(join(EXPORT, "Privé et partagé", "Mon espace CM", "Édito & infos"), f).split("/")[0].replace(/ [0-9a-f]{32}$/, ""));
  if (!e) { plan.alertes.push("Absences sans espace : " + f); continue; }
  for (const r of lireCsv(f)) { const { debut, fin } = plage(r["Date"]); if (!debut) continue;
    plan.tempsForts.push({ id: uuidDe("tf:" + r["Absences/Vacances"] + iso(debut)), espace_id: e.id, libelle: `${r["Type"] || "Absence"} · ${r["Absences/Vacances"]}`, debut: iso(debut), fin: iso(fin || debut),
      type: "absence", visibilite: "partage", notion_id: "tf:" + r["Absences/Vacances"] + iso(debut) }); }
}
const notesEspace = {};
for (const f of FICHIERS.filter((p) => /État de programmation[^/]*_all\.csv$/.test(p))) for (const r of lireCsv(f)) {
  const e = parNomNotion(r["Client"]); if (!e) { plan.alertes.push("État de programmation sans espace : " + r["Client"]); continue; }
  if (r["Notes"]) (notesEspace[e.slug] = notesEspace[e.slug] || []).push(`${r["Client"]} : ${r["Notes"]}`);
}
const clientsFact = (() => { const f = FICHIERS.find((p) => /👥 Clients[^/]*_all\.csv$/.test(p)); return f ? lireCsv(f) : []; })();
for (const e of ESPACES) {
  const c = clientsFact.find((x) => e.client && norme(x["Nom"]) === norme(e.client));
  plan.prives.push({ espace_id: e.id, raison_sociale: c ? c["Nom"] : null, adresse: c?.["Adresse"] || null, email_facturation: c?.["Email"] || null, siret: c?.["SIRET"] || null,
    forfait_mensuel_ht: c ? montant(c["Tarif mensuel HT"]) : null, type_contrat: c?.["Type de contrat"] || null,
    note_interne: [c?.["Notes"], ...(notesEspace[e.slug] || []), e.note || null].filter(Boolean).join("\n") || null,
    notion_id: c ? "client:" + norme(c["Nom"]) : null });
  plan.espaces.push({ id: e.id, slug: e.slug, nom: e.nom, statut: "actif", couleur: e.couleur, reseaux: e.reseaux, ordre: e.ordre, notion_id: "espace:" + e.slug, _logo: e.logo });
  e.comptes.forEach(([reseau, nom, identifiant], i) => plan.comptes.push({ id: uuidDe(`compte:${e.slug}:${reseau}:${identifiant || nom}`), espace_id: e.id, reseau, nom_affiche: nom, identifiant, rang: i }));
}
for (const c of clientsFact) if (!ESPACES.some((e) => e.client && norme(e.client) === norme(c["Nom"]))) plan.alertes.push("Client facturé sans espace : " + c["Nom"]);

// ---------- Tâches : base « Deadlines » et listes à cocher ----------
const espaceDuTexte = (t) => { const n = norme(t); return ESPACES.find((e) => [e.nom, ...e.notion].some((x) => n.includes(norme(x).split(" ")[0]) && norme(x).split(" ")[0].length > 3)) || null; };
for (const f of FICHIERS.filter((p) => /Deadlines[^/]*_all\.csv$/.test(p))) for (const r of lireCsv(f)) {
  if (!r["Tâche"]) continue;
  const e = r["Client"] ? parNomNotion(r["Client"]) : espaceDuTexte(r["Tâche"]);
  const fait = /termin/i.test(r["Statut"]) || oui(r["Case à cocher"]);
  plan.taches.push({ id: uuidDe("tache:" + r["Tâche"] + r["Date d'échéance"]), titre: r["Tâche"], espace_id: e ? e.id : null, statut: fait ? "fait" : "a-faire",
    echeance: iso(jour(r["Date d'échéance"])), priorite: "moyenne", categorie: r["Catégorie"] || null, notion_id: "tache:" + empreinte(r["Tâche"] + r["Date d'échéance"]) });
}
const vues = new Set();
for (const f of FICHIERS.filter((p) => /\/(Mon espace CM|NOTES & TO DO) [0-9a-f]{32}\.md$/.test(p))) {
  let categorie = "Autre";
  for (const ligne of readFileSync(f, "utf8").split("\n")) {
    const h = /^###\s+(.+)/.exec(ligne); if (h) { categorie = /CR[ÉE]ATION/i.test(h[1]) ? "Créations" : /PROGRAMMATION/i.test(h[1]) ? "Programmation" : "Autre"; continue; }
    const m = /^\s*- \[( |x)\]\s+(.+)$/.exec(ligne); if (!m) continue;
    const titre = m[2].trim(); if (vues.has(norme(titre))) continue; vues.add(norme(titre));
    const e = espaceDuTexte(titre);
    plan.taches.push({ id: uuidDe("liste:" + norme(titre)), titre, espace_id: e ? e.id : null, statut: m[1] === "x" ? "fait" : "a-faire", echeance: null, priorite: "moyenne", categorie, notion_id: "liste:" + empreinte(norme(titre)) });
  }
}

// ---------- Factures ----------
const fFact = FICHIERS.find((p) => /🧾 Factures[^/]*_all\.csv$/.test(p));
for (const r of fFact ? lireCsv(fFact) : []) {
  const e = parFacture(r["Client"]), num = parseInt(r["N. Facture"], 10); if (!num) continue;
  const ht = montant(r["Montant HT"]), ttc = montant(r["Montant TTC"]), tva = ttc != null && ht != null ? Math.round((ttc - ht) * 100) / 100 : montant(r["TVA Collectée (20%)"]);
  const d = jour(r["Date Facture"]), pdf = fichiersJoints(dirname(fFact), r["Facture PDF"])[0] || null;
  const periode = r["Période"] ? `${r["Période"]} ${d ? d.getFullYear() : ""}`.trim() : null;
  plan.factures.push({ id: uuidDe("facture:" + num), espace_id: e ? e.id : null, numero: num, objet: "Community management" + (e ? "" : " · " + r["Client"]), periode,
    lignes: [{ libelle: "Community management" + (periode ? " · " + periode : ""), quantite: 1, prix_ht: ht, tva: 20 }], total_ht: ht, total_tva: tva, total_ttc: ttc,
    statut: /acquitt/i.test(r["Statut"]) ? "payee" : "emise", date_facture: iso(d), payee_le: iso(jour(r["Payée le"])), viree: oui(r["Viré"]),
    pdf_path: pdf ? `${e ? e.id : "sans-espace"}/factures/${num}.pdf` : null, notion_id: "facture:" + num, _pdf: pdf });
}

// ---------- Médias, notes, liens ----------
plan.medias = [...mediasParChemin.values()];
for (const p of plan.publications) {
  p._visuels.forEach((m, i) => { if (!plan.liens.some((l) => l.publication_id === p.id && l.media_id === m.id)) plan.liens.push({ publication_id: p.id, media_id: m.id, rang: i }); });
  const idNote = uuidDe("note:" + p.id);
  if (p._note && !NOTES_IGNOREES.has(idNote)) plan.notes.push({ id: idNote, espace_id: p.espace_id, publication_id: p.id, contenu: "Depuis Notion :\n" + p._note });
}

// ---------- Résumé ----------
const compte = (l, k) => l.reduce((o, x) => ((o[x[k]] = (o[x[k]] || 0) + 1), o), {});
const nomEsp = (id) => (ESPACES.find((e) => e.id === id) || {}).nom || "sans espace";
console.log(`Espaces : ${plan.espaces.length} · comptes : ${plan.comptes.length} · opérations : ${plan.operations.length} · absences : ${plan.tempsForts.length}`);
console.log(`Publications : ${plan.publications.length}`, Object.fromEntries(Object.entries(compte(plan.publications, "espace_id")).map(([k, v]) => [nomEsp(k), v])));
console.log("Statuts :", compte(plan.publications, "statut"), "· formats :", compte(plan.publications, "format"));
console.log(`Sans date : ${plan.publications.filter((p) => !p.date_prevue).length} · réseaux fusionnés (Instagram + Facebook) : ${plan.publications.filter((p) => p.reseaux.length > 1).length}`);
console.log(`Visuels : ${plan.medias.length} (${(plan.medias.reduce((t, m) => t + m.taille, 0) / 1048576).toFixed(0)} Mo), liens : ${plan.liens.length} · notes internes : ${plan.notes.length}`);
console.log(`Tâches : ${plan.taches.length}`, compte(plan.taches, "statut"), `· factures : ${plan.factures.length} (n° ${Math.min(...plan.factures.map((f) => f.numero))} à ${Math.max(...plan.factures.map((f) => f.numero))}, PDF : ${plan.factures.filter((f) => f._pdf).length})`);
console.log("Opérations :", plan.operations.map((o) => `${nomEsp(o.espace_id)} · ${o.libelle} (${o.debut} → ${o.fin})`).join(" | "));
if (plan.alertes.length) console.log("À noter :\n  " + plan.alertes.join("\n  "));
writeFileSync(join(LILI, "import-apercu.json"), JSON.stringify(plan, (k, v) => k === "source" || k === "_pdf" ? undefined : v, 2), { mode: 0o600 });
if (!ECRIRE) { console.log("Aperçu seulement (rien n'est écrit). Détail : ~/.lili/import-apercu.json. Pour importer : --ecrire"); process.exit(0); }

// ======================================================================
// Écriture
// ======================================================================
const env = Object.fromEntries(readFileSync(join(LILI, "supabase.env"), "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const cles = await (await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } })).json();
const service = cles.find((k) => k.name === "service_role")?.api_key;
if (!service) throw new Error("clé service_role introuvable");
const db = createClient(`https://${env.SUPABASE_PROJECT_REF}.supabase.co`, service, { auth: { persistSession: false } });
const verif = (r, quoi) => { if (r.error) throw new Error(quoi + " : " + r.error.message); return r.data; };
const sans = (o, ...k) => Object.fromEntries(Object.entries(o).filter(([x]) => !x.startsWith("_") && !k.includes(x)));
const { data: lili } = await db.from("personnes").select("id").eq("role", "proprietaire").limit(1).maybeSingle();
const tmp = mkdtempSync(join(tmpdir(), "studio-import-"));
const envoyer = async (bucket, chemin, octets, type) => verif(await db.storage.from(bucket).upload(chemin, octets, { contentType: type, upsert: true }), "envoi " + chemin);
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf", svg: "image/svg+xml" };
try {
  console.log("Écriture…");
  verif(await db.from("espaces").upsert(plan.espaces.map((e) => sans(e)), { onConflict: "slug" }), "espaces");
  for (const e of plan.espaces.filter((x) => x._logo)) {
    const src = join(LOGOS, e._logo); if (!existsSync(src)) continue;
    const chemin = `${e.id}/marque/logo${extname(src)}`;
    await envoyer("medias", chemin, readFileSync(src), TYPES[extname(src).slice(1)] || "image/png");
    verif(await db.from("espaces").update({ logo_path: chemin }).eq("id", e.id), "logo");
  }
  verif(await db.from("espaces_prive").upsert(plan.prives, { onConflict: "espace_id" }), "espaces_prive");
  verif(await db.from("comptes").upsert(plan.comptes, { onConflict: "id" }), "comptes");
  verif(await db.from("operations").upsert(plan.operations, { onConflict: "id" }), "opérations");
  verif(await db.from("temps_forts").upsert(plan.tempsForts, { onConflict: "id" }), "absences");
  console.log("   espaces, logos, comptes, opérations, absences : ok");
  let n = 0;
  for (const m of plan.medias) {
    let octets = readFileSync(m.source), type = TYPES[extname(m.chemin).slice(1)] || "application/octet-stream";
    if (m.heic) { const s = join(tmp, "x.jpg"); execFileSync("sips", ["-s", "format", "jpeg", m.source, "--out", s], { stdio: "ignore" }); octets = readFileSync(s); type = "image/jpeg"; }
    await envoyer("medias", m.chemin, octets, type);
    if (m.type === "image") {   // vignette légère (640 px) pour le chargement progressif
      const s = join(tmp, "apercu.jpg");
      try { execFileSync("sips", ["-Z", "640", "-s", "format", "jpeg", "-s", "formatOptions", "75", m.heic ? join(tmp, "x.jpg") : m.source, "--out", s], { stdio: "ignore" });
        m.apercu_chemin = m.chemin.replace(/\.[a-z0-9]+$/, "-apercu.jpg"); await envoyer("medias", m.apercu_chemin, readFileSync(s), "image/jpeg"); } catch { /* sans vignette */ }
    }
    if (++n % 20 === 0) console.log(`   visuels : ${n}/${plan.medias.length}`);
  }
  verif(await db.from("medias").upsert(plan.medias.map((m) => sans(m, "source", "heic")), { onConflict: "chemin" }), "médias");
  const comptes = plan.comptes;
  const pubs = plan.publications.map((p) => ({ ...sans(p), auteur_id: lili?.id ?? null, compte_id: p._compte ? (comptes.find((c) => c.espace_id === p.espace_id && c.identifiant === p._compte) || {}).id ?? null : null }));
  for (let i = 0; i < pubs.length; i += 100) verif(await db.from("publications").upsert(pubs.slice(i, i + 100), { onConflict: "notion_id" }), "publications");
  const ids = pubs.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 100) verif(await db.from("publication_medias").delete().in("publication_id", ids.slice(i, i + 100)), "liens (ménage)");
  for (let i = 0; i < plan.liens.length; i += 200) verif(await db.from("publication_medias").insert(plan.liens.slice(i, i + 200)), "liens");
  verif(await db.from("notes_internes").upsert(plan.notes, { onConflict: "id" }), "notes");
  verif(await db.from("taches").upsert(plan.taches, { onConflict: "notion_id" }), "tâches");
  console.log(`   ${pubs.length} publications, ${plan.medias.length} visuels, ${plan.notes.length} notes, ${plan.taches.length} tâches : ok`);
  for (const f of plan.factures.filter((x) => x._pdf)) await envoyer("livrables", f.pdf_path, readFileSync(f._pdf), "application/pdf");
  verif(await db.from("factures").upsert(plan.factures.map((f) => sans(f)), { onConflict: "notion_id" }), "factures");
  console.log(`   ${plan.factures.length} factures et leurs PDF : ok`);
  // Couverture de chaque espace : son plus beau visuel publié (le plus récent)
  for (const e of plan.espaces) {
    const p = plan.publications.filter((x) => x.espace_id === e.id && x._visuels.some((m) => m.type === "image")).sort((a, b) => String(b.date_prevue).localeCompare(String(a.date_prevue)))[0];
    const m = p && p._visuels.find((x) => x.type === "image");
    if (m) verif(await db.from("espaces").update({ couverture_path: m.chemin }).eq("id", e.id), "couverture");
  }
  // Le dépôt des fichiers importés a créé des lignes « fichier déposé » sans auteur : ce n'est pas de l'activité réelle
  verif(await db.from("journal").delete().is("acteur_id", null).eq("action", "media.depose"), "journal");
  console.log("Import terminé.");
} finally { rmSync(tmp, { recursive: true, force: true }); }
