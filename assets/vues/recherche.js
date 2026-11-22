/* La recherche du studio : un champ en haut de chaque page (et ⌘K / Ctrl+K partout) qui trouve tout en un instant.
   Clients, publications (titre, légende), images et vidéos (nom, dossier, étiquettes), dossiers, commentaires,
   messages, notes, tâches, prospects, factures, devis, veille, partenaires, opérations et temps forts, comptes des
   réseaux, personnes invitées, pages du studio ; et, pour Lili, « chercher dans les mails » (Gmail).
   Tout se cherche dans ce que la personne connectée peut déjà lire : chez un client, seulement son espace partagé.
   Sans accents ni majuscules ; chaque mot tapé doit se trouver ; un titre qui commence par le mot passe devant. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S;

  var norm = function (s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  var court = function (s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  var texteDe = function (o) { return Object.keys(o || {}).map(function (k) { var v = o[k]; return typeof v === "string" && !/(_id|_path|chemin|^id)$/.test(k) && !/^https?:\/\/[^ ]+$/.test(v) && v.length < 2000 ? v : ""; }).join(" "); };
  var jour = function (d) { return d ? St.fmt(String(d).length === 10 ? d + "T12:00:00" : d, { day: "numeric", month: "short", year: "numeric" }) : ""; };

  // Les familles de résultats, dans l'ordre d'affichage
  var FAMILLES = [
    ["page", "Aller à"], ["client", "Clients"], ["publication", "Publications"], ["media", "Images et vidéos"], ["dossier", "Dossiers"],
    ["commentaire", "Commentaires"], ["message", "Messages"], ["tache", "Tâches"], ["note", "Notes internes"], ["prospect", "Prospects"],
    ["facture", "Factures"], ["devis", "Devis"], ["agenda", "Opérations et temps forts"], ["veille", "Veille"], ["partenaire", "Partenaires"],
    ["personne", "Personnes"], ["compte", "Comptes des réseaux"], ["mails", "Mails"]];
  var POIDS = { page: 14, client: 16, publication: 10, media: 9, dossier: 9, tache: 8, prospect: 8, facture: 8, devis: 8, personne: 7, compte: 7, agenda: 6, note: 6, message: 5, commentaire: 5, veille: 4, partenaire: 4 };

  // ---------- L'index : construit à chaque ouverture (quelques centaines d'éléments, instantané) ----------
  function index() {
    var lili = St.estLili(), mesEspaces = lili ? null : St.espacesClient().map(function (e) { return e.id; });
    var dansMonEspace = function (x) { return lili || (x && mesEspaces.indexOf(x.espace_id) >= 0 && (!x.visibilite || x.visibilite === "partage")); };
    var nomEspace = function (id) { var e = St.espace(id); return e ? e.nom : ""; };
    var slug = function (id) { var e = St.espace(id); return e ? e.slug : ""; };
    var L = [];
    var ajouter = function (o) { o.t = norm(o.titre); o.c = norm([o.titre, o.sous, o.texte].join(" ")); L.push(o); };

    // Pages du studio
    (lili ? [["Aujourd'hui", "#", "aujourdhui"], ["Calendrier", "#calendrier", "calendrier"], ["Publications", "#publications", "publications"],
      ["Médiathèque", "#mediatheque", "mediatheque"], ["Mails", "#mails", "mail"], ["Tâches", "#taches", "taches"], ["Prospects", "#prospects", "prospects"],
      ["Clients", "#clients", "personnes"], ["Clients archivés", "#clients?etat=archive", "archiver"], ["Réglages", "#reglages", "reglages"],
      ["Signatures de mail", "#reglages?onglet=signatures", "plume"], ["Réponses types", "#reglages?onglet=modeles", "mail"], ["Mails et vacances", "#reglages?onglet=mails", "soleil"],
      ["Entreprise et facturation", "#reglages?onglet=entreprise", "euro"], ["Sécurité", "#reglages?onglet=securite", "bouclier"], ["Apparence", "#reglages?onglet=apparence", "reglages"]]
      : [["Accueil", "#", "aujourdhui"], ["À valider", "#valider", "valider"], ["Calendrier", "#calendrier", "calendrier"], ["Publications", "#publications", "publications"],
        ["Médiathèque", "#mediatheque", "mediatheque"], ["Brief", "#brief", "brief"], ["Rapports", "#rapports", "rapports"], ["Messages", "#messages", "commentaire"], ["Mon compte", "#compte", "cadenas"]])
      .forEach(function (x) { ajouter({ type: "page", titre: x[0], sous: "Page du studio", icone: x[2], lien: x[1] }); });
    if (lili) {
      ajouter({ type: "page", titre: "Nouvelle publication", sous: "Action · touche N", icone: "plus", action: function () { St.nouvellePublication(); } });
      ajouter({ type: "page", titre: "Nouveau client", sous: "Action", icone: "plus", action: function () { if (St.nouveauClient) St.nouveauClient(); } });
    }

    // Clients
    (lili ? S.espaces : S.espaces.filter(function (e) { return mesEspaces.indexOf(e.id) >= 0; })).forEach(function (e) {
      var pr = lili ? St.prive(e.id) : {};
      ajouter({ type: "client", titre: e.nom, sous: [e.metier, e.statut === "archive" ? "archivé" : e.statut === "pause" ? "en pause" : "", (e.reseaux || []).map(function (r) { return (St.RESEAUX[r] || {}).nom; }).join(", ")].filter(Boolean).join(" · "),
        texte: [e.slug, pr.raison_sociale, pr.email_facturation, pr.siret].join(" "), espace: e, lien: lili ? "#" + e.slug : "#" });
    });

    // Publications (titre et légende)
    St.publicationsVisibles().filter(dansMonEspace).forEach(function (p) {
      ajouter({ type: "publication", titre: p.titre || "Publication sans titre", sous: [nomEspace(p.espace_id), St.STATUTS[p.statut] || p.statut, p.date_prevue ? jour(p.date_prevue) : "", (p.reseaux || []).map(function (r) { return (St.RESEAUX[r] || {}).nom; }).join(", ")].filter(Boolean).join(" · "),
        texte: [p.legende, p.format, p.notes].join(" "), extrait: p.legende, espace: St.espace(p.espace_id), lien: "#p/" + p.id, date: p.date_prevue || p.cree_le });
    });

    // Images, vidéos, documents ; et leurs dossiers
    var dossiers = {};
    S.medias.filter(function (m) { return !m.corbeille_le && dansMonEspace(m); }).forEach(function (m) {
      ajouter({ type: "media", titre: m.nom_fichier || "Fichier sans nom", sous: [nomEspace(m.espace_id), m.dossier || "Sans dossier", { image: "image", video: "vidéo", document: "document" }[m.type] || m.type, jour(m.cree_le)].filter(Boolean).join(" · "),
        texte: (m.etiquettes || []).join(" "), media: m, espace: St.espace(m.espace_id), action: function () { if (St.ouvrirMedia) St.ouvrirMedia(m); }, date: m.cree_le });
      if (m.dossier) { var k = m.espace_id + "|" + m.dossier; (dossiers[k] = dossiers[k] || { espace_id: m.espace_id, nom: m.dossier, n: 0 }).n++; }
    });
    Object.keys(dossiers).forEach(function (k) {
      var d = dossiers[k];
      ajouter({ type: "dossier", titre: d.nom, sous: [nomEspace(d.espace_id), d.n + " fichier" + (d.n > 1 ? "s" : "")].join(" · "), icone: "mediatheque", espace: St.espace(d.espace_id),
        lien: (lili ? "#" + slug(d.espace_id) + "/mediatheque" : "#mediatheque") + "?dossier=" + encodeURIComponent(d.nom) });
    });

    // Commentaires et messages
    S.commentaires.filter(function (c) { var p = St.publication(c.publication_id); return p && !p.corbeille_le && dansMonEspace(p) && (lili || c.visibilite === "partage"); }).forEach(function (c) {
      var p = St.publication(c.publication_id), a = St.personne(c.auteur_id) || {};
      ajouter({ type: "commentaire", titre: court(c.contenu, 90), sous: [a.nom, "sur « " + (p.titre || "publication") + " »", nomEspace(p.espace_id)].filter(Boolean).join(" · "), extrait: c.contenu, icone: "commentaire", espace: St.espace(p.espace_id), lien: "#p/" + p.id, date: c.cree_le });
    });
    S.messages.filter(dansMonEspace).forEach(function (m) {
      var a = St.personne(m.auteur_id) || {};
      ajouter({ type: "message", titre: court(m.contenu, 90), sous: [a.nom, nomEspace(m.espace_id), jour(m.cree_le)].filter(Boolean).join(" · "), extrait: m.contenu, icone: "commentaire", espace: St.espace(m.espace_id), lien: lili ? "#" + slug(m.espace_id) + "/messages" : "#messages", date: m.cree_le });
    });

    if (lili) {
      S.taches.forEach(function (t) {
        ajouter({ type: "tache", titre: t.titre, sous: [nomEspace(t.espace_id) || "Général", t.statut === "fait" ? "faite" : t.echeance ? "pour le " + jour(t.echeance) : ""].filter(Boolean).join(" · "), texte: t.notes, icone: "taches", espace: St.espace(t.espace_id), action: function () { St.aller("taches"); setTimeout(function () { if (St.editerTache) St.editerTache(t); }, 80); }, date: t.echeance });
      });
      S.notes.forEach(function (n) {
        ajouter({ type: "note", titre: court(n.contenu, 90), sous: nomEspace(n.espace_id), extrait: n.contenu, icone: "brief", espace: St.espace(n.espace_id), lien: n.publication_id ? "#p/" + n.publication_id : "#" + slug(n.espace_id) + "/notes", date: n.cree_le });
      });
      S.prospects.forEach(function (p) {
        ajouter({ type: "prospect", titre: p.nom, sous: [p.contact, p.etape, p.prochaine_action].filter(Boolean).join(" · "), texte: [p.email, p.telephone, p.source, p.notes].join(" "), icone: "prospects", action: function () { St.aller("prospects"); setTimeout(function () { if (St.editerProspect) St.editerProspect(p); }, 80); } });
      });
      S.factures.forEach(function (f) {
        ajouter({ type: "facture", titre: (f.numero ? "Facture n° " + f.numero : "Facture (brouillon)") + (f.objet ? " · " + f.objet : ""), sous: [nomEspace(f.espace_id), f.statut, f.total_ttc ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(f.total_ttc) + " TTC" : "", jour(f.date_facture)].filter(Boolean).join(" · "),
          texte: [f.periode, String(f.numero || "")].join(" "), icone: "euro", espace: St.espace(f.espace_id), lien: f.espace_id ? "#" + slug(f.espace_id) + "/facturation" : "#clients", date: f.date_facture });
      });
      S.devis.forEach(function (d) {
        ajouter({ type: "devis", titre: (d.numero ? "Devis " + d.numero : "Devis (brouillon)") + " · " + (d.objet || ""), sous: [nomEspace(d.espace_id), d.statut, d.total_ttc ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(d.total_ttc) + " TTC" : ""].filter(Boolean).join(" · "),
          icone: "euro", espace: St.espace(d.espace_id), lien: d.espace_id ? "#" + slug(d.espace_id) + "/facturation" : "#prospects", date: d.date_devis });
      });
      S.veille.forEach(function (v) { ajouter({ type: "veille", titre: court(v.compte || v.titre || v.note || "Repérage", 80), sous: nomEspace(v.espace_id), texte: texteDe(v), icone: "etoile", espace: St.espace(v.espace_id), lien: "#" + slug(v.espace_id) + "/veille" }); });
      S.partenaires.forEach(function (p) { ajouter({ type: "partenaire", titre: p.nom, sous: [nomEspace(p.espace_id), p.compte, p.statut].filter(Boolean).join(" · "), texte: texteDe(p), icone: "personnes", espace: St.espace(p.espace_id), lien: p.espace_id ? "#" + slug(p.espace_id) + "/partenariats" : "#clients" }); });
      S.comptes.forEach(function (c) { ajouter({ type: "compte", titre: c.nom_affiche + (c.identifiant ? " (@" + c.identifiant + ")" : ""), sous: [(St.RESEAUX[c.reseau] || {}).nom, nomEspace(c.espace_id)].filter(Boolean).join(" · "), icone: "etiquette", espace: St.espace(c.espace_id), lien: "#" + slug(c.espace_id) }); });
      S.membres.forEach(function (m) {
        var p = St.personne(m.personne_id); if (!p) return;
        ajouter({ type: "personne", titre: p.nom || p.email, sous: [m.role === "client" ? "client" : "invité", nomEspace(m.espace_id), p.email].filter(Boolean).join(" · "), icone: "personnes", espace: St.espace(m.espace_id), lien: "#" + slug(m.espace_id) + "/equipe" });
      });
    }
    // Opérations et temps forts (calendrier)
    S.operations.filter(dansMonEspace).forEach(function (o) {
      ajouter({ type: "agenda", titre: o.libelle, sous: [nomEspace(o.espace_id), o.debut ? "du " + jour(o.debut) + (o.fin ? " au " + jour(o.fin) : "") : ""].filter(Boolean).join(" · "), icone: "calendrier", espace: St.espace(o.espace_id), lien: "#calendrier" + (o.debut ? "?jour=" + o.debut : ""), date: o.debut });
    });
    S.tempsForts.filter(function (t) { return lili || !t.espace_id || dansMonEspace(t); }).forEach(function (t) {
      ajouter({ type: "agenda", titre: t.libelle, sous: [nomEspace(t.espace_id) || "Tous les clients", jour(t.debut)].filter(Boolean).join(" · "), icone: "calendrier", lien: "#calendrier?jour=" + t.debut, date: t.debut });
    });
    return L;
  }

  // ---------- Le classement ----------
  function chercher(L, q) {
    var mots = norm(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    var res = [];
    L.forEach(function (o) {
      for (var i = 0; i < mots.length; i++) if (o.c.indexOf(mots[i]) < 0) return;
      var s = POIDS[o.type] || 5;
      mots.forEach(function (m) {
        if (o.t.indexOf(m) === 0) s += 30;
        else if ((" " + o.t).indexOf(" " + m) >= 0) s += 20;
        else if (o.t.indexOf(m) >= 0) s += 10;
      });
      if (o.t === norm(q)) s += 40;
      if (o.espace && o.espace.statut === "archive") s -= 8;
      if (o.date) { var j = Math.abs((Date.now() - new Date(o.date)) / 864e5); s += Math.max(0, 6 - j / 30); }   // récent : un peu devant
      res.push({ o: o, s: s });
    });
    return res.sort(function (a, b) { return b.s - a.s; });
  }

  // Un morceau de texte avec les mots trouvés surlignés (construit en nœuds : jamais de HTML injecté)
  function surligne(texte, mots) {
    var frag = document.createDocumentFragment(), t = String(texte || ""), n = norm(t);
    var zones = [];
    mots.forEach(function (m) { var i = n.indexOf(m); while (i >= 0 && m) { zones.push([i, i + m.length]); i = n.indexOf(m, i + m.length); } });
    zones.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    zones.forEach(function (z) { if (z[0] < pos) return; frag.appendChild(document.createTextNode(t.slice(pos, z[0]))); frag.appendChild(el("mark", { text: t.slice(z[0], z[1]) })); pos = z[1]; });
    frag.appendChild(document.createTextNode(t.slice(pos)));
    return frag;
  }
  function extrait(texte, mots) {
    var t = String(texte || "").replace(/\s+/g, " "), n = norm(t), i = -1;
    mots.some(function (m) { i = n.indexOf(m); return i >= 0; });
    if (i < 0) return "";
    var d = Math.max(0, i - 50);
    return (d ? "…" : "") + t.slice(d, d + 150) + (d + 150 < t.length ? "…" : "");
  }

  // ---------- La fenêtre de recherche ----------
  var ouverte = null;
  St.rechercher = function (depart) {
    if (ouverte && ouverte.open) { ouverte.querySelector("input").focus(); return; }
    var L = index(), lili = St.estLili(), choix = [], curseur = 0, deplies = {};
    var champ = el("input", { type: "search", class: "rech-champ", placeholder: lili ? "Chercher un client, une publication, une image, un dossier, une facture…" : "Chercher une publication, une image, un message…",
      "aria-label": "Rechercher dans le studio", autocomplete: "off", spellcheck: "false", role: "combobox", "aria-expanded": "true", "aria-controls": "rech-resultats" });
    var liste = el("div", { class: "rech-resultats", id: "rech-resultats", role: "listbox" });
    var pied = el("div", { class: "rech-pied" }, [el("span", {}, [el("kbd", { text: "↑" }), el("kbd", { text: "↓" }), " choisir"]), el("span", {}, [el("kbd", { text: "Entrée" }), " ouvrir"]), el("span", {}, [el("kbd", { text: "Échap" }), " fermer"])]);
    var d = el("dialog", { class: "rech-fenetre", "aria-label": "Recherche" }, [
      el("div", { class: "rech-tete" }, [St.icone("recherche"), champ, el("button", { type: "button", class: "btn-texte petit rech-fermer", text: "Fermer", onclick: function () { d.close(); } })]),
      liste, pied]);

    function ouvrir(o) {
      if (o.garder) { o.action(); return; }
      d.close();
      if (o.action) o.action(); else if (o.lien) { if (location.hash === o.lien || (o.lien === "#" && !location.hash)) St.dessiner(false); else location.hash = o.lien; }
    }
    function vignette(o) {
      if (o.type === "media" && o.media && o.media.type !== "document") { var i = St.image(o.media, { classe: "rech-vignette", apercu: true }); return i; }
      if (o.espace && (o.type === "client")) return St.logoEspace(o.espace, "petit");
      return el("span", { class: "rech-icone" + (o.espace ? " teinte" : ""), style: o.espace ? { "--c": o.espace.couleur } : null }, [St.icone(o.icone || { publication: "publications", media: "mediatheque" }[o.type] || "recherche")]);
    }
    function peindre() {
      var q = champ.value.trim(), mots = norm(q).split(/\s+/).filter(Boolean);
      liste.textContent = ""; choix = [];
      var trouves;
      if (!q) {
        // Sans rien taper : les pages et les clients, pour aller vite
        trouves = L.filter(function (o) { return o.type === "page" || (o.type === "client" && o.espace.statut !== "archive"); }).map(function (o) { return { o: o }; });
      } else trouves = chercher(L, q);
      var parFamille = {};
      trouves.forEach(function (r) { (parFamille[r.o.type] = parFamille[r.o.type] || []).push(r.o); });
      // Les familles dans l'ordre de leur meilleur résultat (ce qui colle le mieux remonte), chacune limitée
      var ordre = q ? Object.keys(parFamille).sort(function (a, b) { return trouves.findIndex(function (r) { return r.o.type === a; }) - trouves.findIndex(function (r) { return r.o.type === b; }); })
        : FAMILLES.map(function (f) { return f[0]; }).filter(function (k) { return parFamille[k]; });
      ordre.forEach(function (k) {
        var nomF = (FAMILLES.filter(function (f) { return f[0] === k; })[0] || [k, k])[1], items = parFamille[k], max = deplies[k] ? 300 : q ? (k === "media" ? 8 : 6) : 30;
        liste.appendChild(el("p", { class: "rech-famille", text: nomF + (items.length > max ? " (" + items.length + ")" : "") }));
        var groupe = el("div", { class: k === "media" ? "rech-groupe rech-images" : "rech-groupe" });
        items.slice(0, max).forEach(function (o) {
          var n = choix.length, ex = q && o.extrait && o.t.indexOf(mots[0]) < 0 ? extrait(o.extrait, mots) : "";
          var b = el("button", { type: "button", class: "rech-ligne", role: "option", id: "rech-" + n, "aria-selected": "false", onclick: function () { ouvrir(o); }, onmousemove: function () { if (curseur !== n) { curseur = n; marquer(); } } }, [
            vignette(o),
            el("span", { class: "rech-texte" }, [el("b", {}, [surligne(o.titre, mots)]), o.sous ? el("small", {}, [surligne(o.sous, mots)]) : null, ex ? el("small", { class: "rech-extrait" }, [surligne(ex, mots)]) : null])]);
          choix.push({ o: o, b: b }); groupe.appendChild(b);
        });
        if (items.length > max) {
          // « Tout afficher » : déplie la famille sur place, sans perdre la recherche
          var nPlus = choix.length, plus = el("button", { type: "button", class: "rech-ligne rech-plus", role: "option", id: "rech-" + nPlus,
            onclick: function () { deplies[k] = true; var c = curseur; peindre(); curseur = Math.min(c, choix.length - 1); marquer(); champ.focus(); },
            onmousemove: function () { if (curseur !== nPlus) { curseur = nPlus; marquer(); } } }, [el("span", { class: "rech-icone" }, [St.icone("plus")]), el("span", { class: "rech-texte" }, [el("b", { text: "Afficher les " + items.length + " " + nomF.toLowerCase() })])]);
          choix.push({ o: { action: function () { plus.click(); }, garder: true }, b: plus }); groupe.appendChild(plus);
        }
        liste.appendChild(groupe);
      });
      if (q && lili) {
        // Toujours possible : chercher dans les mails Gmail de Lili
        var n = choix.length;
        liste.appendChild(el("p", { class: "rech-famille", text: "Mails" }));
        var b = el("button", { type: "button", class: "rech-ligne", role: "option", id: "rech-" + n, onclick: function () { ouvrir({ lien: "#mails?q=" + encodeURIComponent(q) }); }, onmousemove: function () { if (curseur !== n) { curseur = n; marquer(); } } },
          [el("span", { class: "rech-icone" }, [St.icone("mail")]), el("span", { class: "rech-texte" }, [el("b", { text: "Chercher « " + q + " » dans les mails" }), el("small", { text: "Toute la boîte Gmail" })])]);
        choix.push({ o: { lien: "#mails?q=" + encodeURIComponent(q) }, b: b }); liste.appendChild(el("div", { class: "rech-groupe" }, [b]));
      }
      if (!choix.length) liste.appendChild(el("p", { class: "rech-vide", text: "Rien trouvé pour « " + q + " ». Essayez un autre mot, ou un morceau du nom." }));
      curseur = 0; marquer();
    }
    function marquer() {
      choix.forEach(function (c, i) { c.b.setAttribute("aria-selected", i === curseur ? "true" : "false"); });
      if (choix[curseur]) { champ.setAttribute("aria-activedescendant", "rech-" + curseur); choix[curseur].b.scrollIntoView({ block: "nearest" }); }
    }
    var minuterie = null;
    champ.addEventListener("input", function () { deplies = {}; clearTimeout(minuterie); minuterie = setTimeout(peindre, 60); });
    champ.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); curseur = Math.min(choix.length - 1, curseur + 1); marquer(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); curseur = Math.max(0, curseur - 1); marquer(); }
      else if (ev.key === "Enter") { ev.preventDefault(); clearTimeout(minuterie); if (champ.value.trim() && !choix.length) peindre(); if (choix[curseur]) ouvrir(choix[curseur].o); }
    });
    d.addEventListener("click", function (ev) { if (ev.target === d) d.close(); });   // clic à côté : fermer
    d.addEventListener("close", function () { d.remove(); ouverte = null; });
    document.body.appendChild(d); ouverte = d;
    d.showModal();
    if (depart) champ.value = depart;
    peindre(); champ.focus();
  };

  // ⌘K / Ctrl+K partout (même dans un champ) ; F aussi, hors saisie
  document.addEventListener("keydown", function (ev) {
    if (!St.X.demarre) return;
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && (ev.key === "k" || ev.key === "K")) { ev.preventDefault(); St.rechercher(); return; }
    if (ev.key === "f" && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !St.enSaisie() && !document.querySelector("dialog[open]") && St.S.route.nom !== "mails") { ev.preventDefault(); St.rechercher(); }
  });
})(window.Studio);
