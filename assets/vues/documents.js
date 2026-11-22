/* Documents (22/11/2026) : la rubrique « Documents » de chaque client (#<slug>/documents : fichiers, devis, factures),
   la fenêtre « Joindre depuis le studio » de la rédaction d'un mail, et la lecture des octets d'un fichier du studio
   (médiathèque ou PDF d'une facture). Lili seule : les devis et factures restent dans leurs tables privées. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;

  function ext(m) { return String((m && (m.nom_fichier || m.chemin)) || "").split(".").pop().toLowerCase().slice(0, 5); }
  function taille(o) { return !o ? "" : o < 1e6 ? Math.max(1, Math.round(o / 1024)) + " Ko" : (o / 1e6).toFixed(1).replace(".", ",") + " Mo"; }
  function nomMedia(m) {
    var n = m.nom_fichier && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(m.nom_fichier) ? m.nom_fichier : "";
    return n || (m.dossier || (m.type === "video" ? "Vidéo" : m.type === "document" ? "Document" : "Photo")) + "." + (ext(m) || "jpg");
  }
  St.nomMedia = nomMedia;
  St.tailleFichier = taille;

  // Vignette : la photo ou la vidéo, ou une carte « document » avec son extension
  St.vignette = function (m, o) {
    if (m && m.type === "document") return el("div", { class: "doc-vignette " + ((o && o.classe) || "") }, [St.icone("brief"), el("b", { text: (ext(m) || "doc").toUpperCase() }),
      o && o.sansNom ? null : el("small", { text: nomMedia(m) })]);
    return St.image(m, o);
  };

  // Un PDF d'une page, sans bibliothèque : sert aux pièces jointes de la démonstration
  St.pdfDemo = function (titre, lignes) {
    var a = function (s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, " ").replace(/([()\\])/g, "\\$1"); };
    var flux = "BT /F1 20 Tf 60 770 Td (" + a(titre) + ") Tj /F1 11 Tf 0 -34 Td" + (lignes || []).map(function (l) { return " (" + a(l) + ") Tj 0 -16 Td"; }).join("") + " ET";
    var objets = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Length " + flux.length + " >>\nstream\n" + flux + "\nendstream"];
    var pdf = "%PDF-1.4\n", pos = [];
    objets.forEach(function (o, i) { pos.push(pdf.length); pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
    var xref = pdf.length;
    pdf += "xref\n0 " + (objets.length + 1) + "\n0000000000 65535 f \n" + pos.map(function (p) { return String(p).padStart(10, "0") + " 00000 n \n"; }).join("") +
      "trailer\n<< /Size " + (objets.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    return new Blob([pdf], { type: "application/pdf" });
  };

  // Octets d'un fichier du studio : { media } (médiathèque) ou { bucket, chemin } (PDF d'une facture, d'un devis)
  St.fichierBlob = function (src) {
    if (src.media) {
      var m = src.media, u = S.urls[m.chemin] || m.url;
      if (m._blob) return Promise.resolve(m._blob);
      if (!u) return Promise.reject(new Error("fichier introuvable"));
      return fetch(u).then(function (r) { if (!r.ok) throw new Error("fichier illisible (" + r.status + ")"); return r.blob(); });
    }
    if (src.piece) return St.pdfPiece(src.piece.table, src.piece.f);
    if (St.X.demo) return Promise.resolve(St.pdfDemo(src.nom || "Document", ["Document de demonstration.", "Rien n'est envoye."]));
    return St.X.db.storage.from(src.bucket).download(src.chemin).then(function (r) { if (r.error) throw r.error; return r.data; });
  };
  St.fichierFile = function (src, nom) {
    return St.fichierBlob(src).then(function (b) { return new File([b], nom, { type: b.type || "application/octet-stream" }); });
  };
  // Ouvrir un document dans un nouvel onglet (PDF, image) ou le télécharger
  St.ouvrirFichier = function (m) {
    var nom = nomMedia(m), w = /^(pdf|jpe?g|png|webp|gif|mp4|mov)$/.test(ext(m)) ? window.open("", "_blank") : null;
    St.fichierBlob({ media: m }).then(function (b) {
      var url = URL.createObjectURL(b);
      if (w) w.location = url; else { var a = el("a", { href: url, download: nom }); document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    }).catch(function (e) { if (w) w.close(); St.signaler(e.message, true); });
  };
  // Envoyer un fichier du studio par mail (ouvre la rédaction avec la pièce jointe)
  St.envoyerParMail = function (m) {
    if (!St.ecrireMail) return;
    var e = St.espace(m.espace_id);
    St.signaler("Préparation de la pièce jointe…");
    St.fichierFile({ media: m }, nomMedia(m)).then(function (f) {
      St.ecrireMail({ objet: nomMedia(m).replace(/\.[a-z0-9]+$/i, ""), fichiers: [f], a: e ? adresseClient(e) : "" });
    }).catch(function (x) { St.signaler(x.message, true); });
  };
  // Une facture ou un devis par mail : le PDF joint, l'adresse de facturation du client proposée
  St.envoyerPieceParMail = function (table, f) {
    if (!St.ecrireMail) return;
    var e = f.espace_id && St.espace(f.espace_id), pr = e && St.prive ? (St.prive(e.id) || {}) : {}, ent = St.aides.entreprise();
    var fact = table === "factures", titre = (fact ? "Facture" : "Devis") + (f.numero ? " n° " + f.numero : "");
    St.signaler("Préparation du PDF…");
    var src = f.pdf_path ? { bucket: "livrables", chemin: f.pdf_path } : { piece: { table: table, f: f } };
    St.fichierFile(src, St.nomPdfPiece(table, f)).then(function (fichier) {
      St.ecrireMail({ a: pr.email_facturation || (e ? adresseClient(e) : ""), objet: titre + (ent.nom ? " · " + ent.nom : "") + (f.periode ? " · " + f.periode : ""), fichiers: [fichier],
        html: "<p>Bonjour,</p><p>Veuillez trouver ci-joint " + (fact ? "la facture" : "le devis") + (f.numero ? " n° " + St.aides.echapper(String(f.numero)) : "") + (f.objet ? " (" + St.aides.echapper(f.objet) + ")" : "") + ".</p><p>Belle journée,</p>" });
    }).catch(function (x) { St.signaler("PDF impossible : " + x.message, true); });
  };
  function adresseClient(e) {
    var p = S.membres.filter(function (m) { return m.espace_id === e.id && m.role === "client"; }).map(function (m) { return St.personne(m.personne_id); }).filter(function (p) { return p && p.email; })[0];
    return p ? p.email : "";
  }

  // ======================================================================
  // « Joindre depuis le studio » : photos, vidéos, documents et PDF des factures et devis d'un client
  // ======================================================================
  St.choisirDocuments = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var eId = o.espace || "", type = "", q = "", sel = {};
      var client = el("select", { "aria-label": "Client", onchange: function () { eId = client.value; sel = {}; dessiner(); } },
        [el("option", { value: "", text: "Tous les clients" })].concat(St.espacesActifs().map(function (e) { return el("option", { value: e.id, selected: e.id === eId, text: e.nom }); })));
      var cherche = el("input", { type: "search", placeholder: "Rechercher un fichier", "aria-label": "Rechercher un fichier", oninput: function () { q = cherche.value.trim().toLowerCase(); dessiner(); } });
      var puces = el("div", { class: "puces-filtre" }), zone = el("div", { class: "doc-choix" }), compte = el("p", { class: "aide", text: "Aucun fichier choisi." });
      function elements() {
        var l = S.medias.filter(function (m) { return !m.corbeille_le && (!eId || m.espace_id === eId); }).map(function (m) {
          return { cle: "m" + m.id, nom: nomMedia(m), genre: m.type, taille: m.taille, date: m.cree_le, espace: m.espace_id, media: m, src: { media: m } };
        });
        [["factures", "Facture"], ["devis", "Devis"]].forEach(function (t) {
          S[t[0]].filter(function (f) { return (!eId || f.espace_id === eId) && f.statut !== "brouillon"; }).forEach(function (f) {
            var nom = f.pdf_path || !St.nomPdfPiece ? t[1] + (f.numero ? " " + f.numero : "") + (f.objet ? " - " + f.objet : "") + ".pdf" : St.nomPdfPiece(t[0], f);
            l.push({ cle: t[0] + f.id, nom: nom, genre: "piece", taille: null, date: f.date_facture || f.date_devis || f.cree_le, espace: f.espace_id,
              src: f.pdf_path ? { bucket: "livrables", chemin: f.pdf_path, nom: nom } : St.pdfPiece ? { piece: { table: t[0], f: f }, nom: nom } : null });
          });
        });
        return l.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      }
      function dessiner() {
        var tous = elements(), genres = [["", "Tout"], ["image", "Photos"], ["video", "Vidéos"], ["document", "Documents"], ["piece", "Devis et factures"]];
        puces.textContent = "";
        genres.forEach(function (g) {
          var n = tous.filter(function (x) { return !g[0] || x.genre === g[0]; }).length; if (g[0] && !n) return;
          puces.appendChild(el("button", { type: "button", class: "puce" + (type === g[0] ? " active" : ""), onclick: function () { type = g[0]; dessiner(); } }, [g[1], el("span", { text: String(n) })]));
        });
        var l = tous.filter(function (x) { return (!type || x.genre === type) && (!q || x.nom.toLowerCase().indexOf(q) >= 0 || (x.media && String(x.media.dossier || "").toLowerCase().indexOf(q) >= 0)); }).slice(0, 120);
        zone.textContent = "";
        if (!l.length) zone.appendChild(el("p", { class: "aide", text: "Rien à joindre ici." }));
        l.forEach(function (x) {
          var e = St.espace(x.espace) || {};
          var b = el("button", { type: "button", class: "doc-choix-el" + (sel[x.cle] ? " choisi" : "") + (x.src ? "" : " indispo"), "aria-pressed": sel[x.cle] ? "true" : "false",
            title: x.src ? x.nom : "Pas encore de PDF : ouvrez-la dans Facturation, puis « PDF » et « Enregistrer en PDF »", onclick: function () {
              if (!x.src) return St.signaler("Pas de PDF enregistré pour cette pièce : « PDF » dans Facturation, puis enregistrez-la et glissez-la dans le mail.", true);
              if (sel[x.cle]) delete sel[x.cle]; else sel[x.cle] = x; dessiner();
            } }, [
            x.media ? St.vignette(x.media, { sansNom: true }) : el("div", { class: "doc-vignette" }, [St.icone("euro"), el("b", { text: "PDF" })]),
            el("span", { class: "doc-choix-nom" }, [el("b", { text: x.nom }), el("small", { text: [!eId ? e.nom : null, taille(x.taille), x.media && x.media.dossier].filter(Boolean).join(" · ") })]),
            el("i", { class: "doc-coche", "aria-hidden": "true" }, [St.icone("valider")])]);
          zone.appendChild(b);
        });
        var n = Object.keys(sel).length;
        compte.textContent = n ? n + " fichier" + (n > 1 ? "s" : "") + " choisi" + (n > 1 ? "s" : "") + "." : "Aucun fichier choisi.";
      }
      dessiner();
      St.fenetre({ titre: "Joindre depuis le studio", classe: "large", sous: "Photos, vidéos, documents des clients, et PDF des factures et devis.",
        corps: [el("div", { class: "deux-colonnes" }, [client, cherche]), puces, zone, compte],
        actions: [{ texte: "Annuler" }, { texte: "Joindre", principal: true, action: function (fermer) {
          var l = Object.keys(sel).map(function (k) { return sel[k]; }); if (!l.length) return St.signaler("Choisissez au moins un fichier", true);
          fermer(); St.signaler("Préparation de " + l.length + " pièce" + (l.length > 1 ? "s" : "") + " jointe" + (l.length > 1 ? "s" : "") + "…");
          Promise.all(l.map(function (x) { return St.fichierFile(x.src, x.nom); })).then(resolve, function (e) { St.signaler("Fichier illisible : " + e.message, true); });
        } }] });
    });
  };

  // ======================================================================
  // Rubrique « Documents » d'un client : fichiers (contrats, chartes, PDF reçus…), devis, factures
  // ======================================================================
  var TRIS = [["recents", "Plus récents"], ["anciens", "Plus anciens"], ["nom", "Nom (A à Z)"], ["taille", "Plus lourds"]];
  St.trierFichiers = function (l, tri, nom) {
    nom = nom || nomMedia;
    var f = {
      recents: function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); },
      anciens: function (a, b) { return String(a.cree_le).localeCompare(String(b.cree_le)); },
      nom: function (a, b) { return nom(a).localeCompare(nom(b), "fr", { sensitivity: "base", numeric: true }); },
      taille: function (a, b) { return (b.taille || 0) - (a.taille || 0); },
      type: function (a, b) { return String(a.type).localeCompare(String(b.type)) || String(b.cree_le).localeCompare(String(a.cree_le)); }
    }[tri] || null;
    return f ? l.slice().sort(f) : l;
  };
  V.rub_documents = function (r, e) {
    var q = r.query || {}, tri = q.tri || "recents", vue = q.voir || "";
    var A = St.aides, base = "#" + e.slug + "/documents";
    var lien = function (o) { var x = Object.assign({ tri: tri, voir: vue }, o), s = []; if (x.voir) s.push("voir=" + x.voir); if (x.tri && x.tri !== "recents") s.push("tri=" + x.tri); return base + (s.length ? "?" + s.join("&") : ""); };
    var fichiers = St.trierFichiers(S.medias.filter(function (m) { return m.espace_id === e.id && !m.corbeille_le && m.type === "document"; }), tri);
    var fs = S.factures.filter(function (f) { return f.espace_id === e.id; }).sort(function (a, b) { return (b.numero || 1e9) - (a.numero || 1e9) || String(b.cree_le).localeCompare(String(a.cree_le)); });
    var ds = S.devis.filter(function (d) { return d.espace_id === e.id; }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    var page = el("div", { class: "pile vue-documents" });
    var entree = el("input", { type: "file", multiple: true, hidden: true, onchange: function () { deposer(entree.files); entree.value = ""; } });
    function deposer(liste) {
      var l = Array.prototype.slice.call(liste || []); if (!l.length) return;
      St.signaler("Envoi de " + l.length + " document" + (l.length > 1 ? "s" : "") + "…");
      Promise.all(l.map(function (f) { return St.televerser(f, e.id, "Documents", { visibilite: "interne" }); }))
        .then(function () { St.signaler(l.length > 1 ? l.length + " documents ajoutés (Lili seule)" : "Document ajouté (Lili seule)"); St.dessiner(false); })
        .catch(function (x) { St.signaler("Envoi impossible : " + x.message, true); });
    }
    page.addEventListener("dragover", function (ev) { if (ev.dataTransfer.types.indexOf("Files") >= 0) { ev.preventDefault(); page.classList.add("depot"); } });
    page.addEventListener("dragleave", function (ev) { if (!page.contains(ev.relatedTarget)) page.classList.remove("depot"); });
    page.addEventListener("drop", function (ev) { if (ev.dataTransfer.files.length) { ev.preventDefault(); page.classList.remove("depot"); deposer(ev.dataTransfer.files); } });
    var vues = [["", "Tout", fichiers.length + fs.length + ds.length], ["fichiers", "Fichiers", fichiers.length], ["devis", "Devis", ds.length], ["factures", "Factures", fs.length]];
    page.appendChild(el("div", { class: "barre-outils" }, [
      el("nav", { class: "puces-filtre", "aria-label": "Documents" }, vues.map(function (v) { return el("a", { href: lien({ voir: v[0] }), class: "puce" + (vue === v[0] ? " active" : "") }, [v[1], el("span", { text: String(v[2]) })]); })),
      el("span", { class: "espace" }),
      el("label", { class: "tri" }, [el("span", { text: "Trier" }), el("select", { "aria-label": "Trier les fichiers", onchange: function (ev) { St.aller(lien({ tri: ev.target.value }).slice(1)); } },
        TRIS.map(function (t) { return el("option", { value: t[0], selected: t[0] === tri, text: t[1] }); }))]),
      el("button", { type: "button", class: "btn-plein", onclick: function () { entree.click(); } }, [St.icone("deposer"), "Déposer un document"]), entree]));
    if (!vue || vue === "fichiers") page.appendChild(el("section", { class: "bloc" }, [
      el("header", {}, [el("h2", { text: "Fichiers" }), el("span", { class: "compte", text: String(fichiers.length) })]),
      fichiers.length ? el("ul", { class: "liste-docs" }, fichiers.map(function (m) {
        return el("li", {}, [
          el("button", { type: "button", class: "doc-ligne", onclick: function () { St.ouvrirFichier(m); }, title: "Ouvrir" }, [el("span", { class: "doc-ext", text: (ext(m) || "doc").toUpperCase() }),
            el("span", { class: "doc-ligne-nom" }, [el("b", { text: nomMedia(m) }), el("small", { text: [m.dossier, taille(m.taille), St.fmt(m.cree_le, { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ") })])]),
          m.visibilite === "interne" ? el("span", { class: "etiquette-interne", text: "Lili seule" }) : el("span", { class: "etiquette-partage", text: "Visible du client" }),
          el("span", { class: "actions-ligne" }, [
            el("button", { type: "button", class: "btn-icone petit", title: "Envoyer par mail", "aria-label": "Envoyer par mail", onclick: function () { St.envoyerParMail(m); } }, [St.icone("mail")]),
            el("button", { type: "button", class: "btn-icone petit", title: "Dossier, partage, corbeille", "aria-label": "Modifier", onclick: function () { St.ouvrirMedia(m); } }, [St.icone("plume")])])]);
      })) : el("div", { class: "depot-vide", onclick: function () { entree.click(); } }, [St.icone("deposer"), el("p", { text: "Contrats, chartes, PDF reçus par mail…" }),
        el("small", { text: "Glissez-les ici ou touchez pour les choisir. Ils restent réservés à Lili, sauf si vous les partagez." })])]));
    if (!vue || vue === "devis") page.appendChild(el("section", { class: "bloc" }, [el("header", {}, [el("h2", { text: "Devis" }), el("span", { class: "compte", text: String(ds.length) }),
      el("button", { type: "button", class: "btn-texte bloc-lien", onclick: function () { A.editerPiece("devis", { espace_id: e.id }); } }, [St.icone("plus"), "Nouveau devis"])]),
      ds.length ? A.tablePieces("devis", ds) : St.vide("Aucun devis.")]));
    if (!vue || vue === "factures") page.appendChild(el("section", { class: "bloc" }, [el("header", {}, [el("h2", { text: "Factures" }), el("span", { class: "compte", text: String(fs.length) }),
      el("button", { type: "button", class: "btn-texte bloc-lien", onclick: function () { A.editerPiece("factures", { espace_id: e.id }); } }, [St.icone("plus"), "Nouvelle facture"])]),
      fs.length ? A.tablePieces("factures", fs) : St.vide("Aucune facture pour " + e.nom + ".")]));
    return page;
  };
  if (St.resumes) St.resumes.documents = function (e) {
    var n = S.medias.filter(function (m) { return m.espace_id === e.id && !m.corbeille_le && m.type === "document"; }).length, f = S.factures.filter(function (x) { return x.espace_id === e.id; }).length;
    return [n ? n + " fichier" + (n > 1 ? "s" : "") : null, f ? f + " facture" + (f > 1 ? "s" : "") : null].filter(Boolean).join(" · ") || "Aucun document";
  };
})(window.Studio);
