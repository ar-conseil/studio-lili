#!/usr/bin/env node
// Décrit la STRUCTURE d'un export Notion (Markdown & CSV) pour préparer le plan d'import (docs/import-notion.md).
//   node outils/notion-analyse.mjs [dossier-export] [fichier-sortie]
// Par défaut : lit ~/.lili/notion-export/ et écrit ~/.lili/notion-structure.md (jamais dans le dépôt : la sortie
// contient des noms de clients et des valeurs de propriétés).
// Ce qui est relevé : arborescence des pages, bases de données (CSV) avec leurs colonnes, le type deviné de chaque
// colonne, les valeurs des colonnes « à choix » (statuts, réseaux, formats…) avec leur nombre, les pages modèles,
// les médias. Aucune légende, note ou texte de page n'est recopié.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import { homedir } from "node:os";

const RACINE = process.argv[2] || join(homedir(), ".lili", "notion-export");
const SORTIE = process.argv[3] || join(homedir(), ".lili", "notion-structure.md");

// Notion ajoute un identifiant de 32 caractères hexadécimaux aux noms : « Calendrier 1a2b…f0.csv »
const sansId = (nom) => nom.replace(/\s+[0-9a-f]{32}(?=(_all)?(\.[a-z]+)?$)/i, "").replace(/_all(?=\.csv$)/, "");

// Lecteur CSV (guillemets, virgules et retours à la ligne dans les cellules, BOM éventuel)
function lireCsv(texte) {
  texte = texte.replace(/^﻿/, "");
  const lignes = []; let ligne = [], cell = "", guill = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guill) {
      if (c === '"' && texte[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') guill = false;
      else cell += c;
    } else if (c === '"') guill = true;
    else if (c === ",") { ligne.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(cell); lignes.push(ligne); ligne = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || ligne.length) { ligne.push(cell); lignes.push(ligne); }
  return lignes.filter((l) => l.some((x) => x !== ""));
}

// Type probable d'une colonne d'après ses valeurs non vides
const MOIS = "(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december)";
const RE_DATE = new RegExp(`^(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4}|${MOIS}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MOIS}\\s+\\d{4})`, "i");
function typeColonne(vals) {
  const v = vals.filter((x) => x.trim() !== "");
  if (!v.length) return "vide";
  const part = (re) => v.filter((x) => re.test(x.trim())).length / v.length;
  if (part(/^(yes|no|oui|non)$/i) === 1) return "case à cocher";
  if (part(RE_DATE) > 0.9) return /→|->/.test(v.join(" ")) ? "plage de dates" : "date";
  if (part(/^-?[\d\s]+([.,]\d+)?\s*(€|%)?$/) > 0.9) return "nombre";
  if (part(/^https?:\/\//) > 0.9) return "lien";
  if (part(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) > 0.9) return "e-mail";
  if (part(/\.(png|jpe?g|gif|webp|heic|mp4|mov|pdf)(\s|,|$)/i) > 0.5) return "fichiers";
  if (part(/\(https?:\/\/www\.notion\.so\/|\.md\)|%20[0-9a-f]{32}/i) > 0.5) return "relation";
  const multi = v.some((x) => x.includes(", ")), jetons = v.flatMap((x) => (multi ? x.split(/,\s*/) : [x]));
  const distinct = new Set(jetons), courts = jetons.every((x) => x.length <= 40);
  if (courts && distinct.size <= Math.max(25, v.length * 0.3) && distinct.size < jetons.length) return multi ? "choix multiple" : "choix";
  return v.some((x) => x.length > 80) ? "texte long" : "texte";
}

const pages = [], bases = [], medias = {}; let modeles = [];
function parcourir(dossier, profondeur) {
  for (const nom of readdirSync(dossier).sort()) {
    if (nom.startsWith(".")) continue;
    const chemin = join(dossier, nom), st = statSync(chemin), rel = relative(RACINE, chemin);
    if (st.isDirectory()) { parcourir(chemin, profondeur + 1); continue; }
    const ext = extname(nom).toLowerCase();
    if (ext === ".csv") {
      // Notion donne parfois deux fichiers par base : « X.csv » (vue) et « X_all.csv » (toutes les lignes) ; on garde _all
      if (!nom.includes("_all") && readdirSync(dossier).includes(nom.replace(/\.csv$/, "_all.csv"))) continue;
      const lignes = lireCsv(readFileSync(chemin, "utf8"));
      const [entete = [], ...rangs] = lignes;
      const colonnes = entete.map((c, i) => {
        const vals = rangs.map((r) => r[i] ?? "");
        const type = i === 0 ? "titre" : typeColonne(vals); // première colonne = titre de la ligne
        const remplies = vals.filter((x) => x.trim() !== "").length;
        let valeurs = null;
        if (type === "choix" || type === "choix multiple" || type === "case à cocher") {
          const compte = {};
          vals.flatMap((x) => (type === "choix multiple" ? x.split(/,\s*/) : [x])).filter((x) => x.trim())
            .forEach((x) => { compte[x.trim()] = (compte[x.trim()] || 0) + 1; });
          valeurs = Object.entries(compte).sort((a, b) => b[1] - a[1]);
        }
        return { nom: c, type, remplies, valeurs };
      });
      bases.push({ nom: sansId(nom).replace(/\.csv$/, ""), chemin: rel, profondeur, lignes: rangs.length, colonnes });
    } else if (ext === ".md") {
      const t = readFileSync(chemin, "utf8"), titre = sansId(basename(nom, ".md"));
      const titres = t.split("\n").filter((l) => /^#{1,3}\s/.test(l)).map((l) => l.replace(/\s+$/, ""));
      const proprietes = t.split("\n").slice(1, 40).filter((l) => /^[^#\s][^:]{1,40}:\s/.test(l)).map((l) => l.split(":")[0]);
      const p = { titre, chemin: rel, profondeur, taille: t.length, titres: titres.slice(0, 12), proprietes,
        cases: (t.match(/^\s*- \[[ x]\]/gm) || []).length, images: (t.match(/!\[[^\]]*\]\(/g) || []).length,
        liens: (t.match(/\]\((?!https?:)[^)]+\.md\)/g) || []).length };
      pages.push(p);
      if (/mod[eè]le|template|gabarit/i.test(rel)) modeles.push(p);
    } else {
      medias[ext || "(sans extension)"] = (medias[ext || "(sans extension)"] || 0) + 1;
    }
  }
}

try { statSync(RACINE); } catch { console.error("Export introuvable : " + RACINE); process.exit(1); }
parcourir(RACINE, 0);

const L = [];
L.push(`# Structure de l'export Notion`, "", `Lu le ${new Date().toLocaleString("fr-FR")} dans \`${RACINE}\`.`,
  `${pages.length} pages, ${bases.length} bases de données, médias : ${Object.entries(medias).map(([e, n]) => `${n} ${e}`).join(", ") || "aucun"}.`, "");
L.push("## Arborescence des pages", "");
for (const p of pages.sort((a, b) => a.chemin.localeCompare(b.chemin)).filter((p) => p.profondeur <= 3)) {
  L.push(`${"  ".repeat(p.profondeur)}- **${p.titre}** (${p.taille} car.${p.cases ? `, ${p.cases} cases` : ""}${p.images ? `, ${p.images} images` : ""}${p.liens ? `, ${p.liens} liens` : ""})`
    + (p.titres.length ? ` — ${p.titres.map((x) => x.replace(/^#+\s*/, "")).join(" · ")}` : ""));
}
const profondes = pages.filter((p) => p.profondeur > 3).length;
if (profondes) L.push("", `(${profondes} pages plus profondes : lignes de bases ou sous-pages, non listées une par une)`);
L.push("", "## Bases de données", "");
for (const b of bases) {
  L.push(`### ${b.nom}`, "", `\`${b.chemin}\` — ${b.lignes} lignes`, "", "| Colonne | Type deviné | Remplie | Valeurs (nombre) |", "|---|---|---|---|");
  for (const c of b.colonnes) {
    const v = c.valeurs ? c.valeurs.slice(0, 30).map(([x, n]) => `${x.replace(/\|/g, "/")} (${n})`).join(", ") + (c.valeurs.length > 30 ? ", …" : "") : "";
    L.push(`| ${c.nom.replace(/\|/g, "/")} | ${c.type} | ${c.remplies}/${b.lignes} | ${v} |`);
  }
  L.push("");
}
if (modeles.length) { L.push("## Pages modèles", ""); modeles.forEach((p) => L.push(`- ${p.titre} — ${p.titres.map((x) => x.replace(/^#+\s*/, "")).join(" · ")}`)); L.push(""); }
const props = {};
pages.forEach((p) => p.proprietes.forEach((x) => { props[x] = (props[x] || 0) + 1; }));
L.push("## Propriétés vues en tête des pages", "", Object.entries(props).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([x, n]) => `${x} (${n})`).join(", ") || "aucune", "");

writeFileSync(SORTIE, L.join("\n"), { mode: 0o600 });
console.log(`${pages.length} pages, ${bases.length} bases -> ${SORTIE}`);
