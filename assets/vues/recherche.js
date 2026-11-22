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
    ["rdv", "Rendez-vous"], ["commentaire", "Commentaires"], ["message", "Messages"], ["tache", "Tâches"], ["note", "Notes internes"], ["prospect", "Prospects"],
    ["facture", "Factures"], ["devis", "Devis"], ["agenda", "Opérations et temps forts"], ["veille", "Veille"], ["partenaire", "Partenaires"],
    ["personne", "Personnes"], ["compte", "Comptes des réseaux"], ["mails", "Mails"]];
  var POIDS = { rdv: 9, page: 14, client: 16, publication: 10, media: 9, dossier: 9, tache: 8, prospect: 8, facture: 8, devis: 8, personne: 7, compte: 7, agenda: 6, note: 6, message: 5, commentaire: 5, veille: 4, partenaire: 4 };

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
      ajouter({ type: "page", titre: "Nouveau rendez-vous", sous: "Action", icone: "calendrier", action: function () { St.editerRdv(); } });
      ajouter({ type: "page", titre: "Nouvelle tâche", sous: "Action", icone: "taches", action: function () { St.aller("taches"); setTimeout(function () { if (St.editerTache) St.editerTache(); }, 80); } });
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
      (S.rdv || []).forEach(function (r) {
        ajouter({ type: "rdv", titre: r.titre, sous: [St.fmt(r.debut, { weekday: "long", day: "numeric", month: "long" }) + ", " + St.libelleRdv(r), nomEspace(r.espace_id), r.lieu].filter(Boolean).join(" · "),
          texte: r.notes, icone: "calendrier", espace: St.espace(r.espace_id), date: r.debut,
          action: function () { St.aller("calendrier?vue=semaine&jour=" + St.iso(r.debut)); setTimeout(function () { St.editerRdv(r); }, 80); } });
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
  // ---------- L'assistant, dans la même fenêtre ----------
  // Une demande (« ajoute une tâche… », « quels rendez-vous demain ? », « trois idées pour… ») part à l'assistant ;
  // sinon c'est une recherche. La conversation reste d'une ouverture à l'autre, jusqu'à « Nouvelle conversation ».
  var conversation = [];
  var VERBES = /^(ajoute|ajouter|cree|creer|mets|mettre|note|noter|rappelle|rappeler|programme|planifie|prevois|propose|proposer|ecris|ecrire|redige|rediger|reecris|reformule|raccourcis|fais|faire|donne|resume|trouve|prepare|aide|peux|pourrais|quelle|quelles|quel|quels|quoi|quand|combien|comment|pourquoi|qu|est-ce|j'ai|ai-je|rdv|rendez|tache|idee|idees|bilan|liste)\b/;
  function ressembleDemande(q) { var n = norm(q).trim(); return /\?\s*$/.test(n) || VERBES.test(n) || n.split(/\s+/).length >= 6; }
  var ICONES_CREES = { brouillon: "publications", tache: "taches", rdv: "calendrier", note: "brief" };
  var NOMS_CREES = { brouillon: "Brouillon", tache: "Tâche", rdv: "Rendez-vous", note: "Note" };

  var ouverte = null;
  St.rechercher = function (depart, enAssistant) {
    if (ouverte && ouverte.open) { ouverte.querySelector("input").focus(); return; }
    var L = index(), lili = St.estLili(), choix = [], curseur = 0, deplies = {}, mode = "recherche", attente = false;
    var nomA = (window.MARQUE && MARQUE.assistant) || "l'assistant", NomA = nomA.charAt(0).toUpperCase() + nomA.slice(1);
    var r0 = S.route, eCtx = r0.nom === "client" ? St.espaceSlug(r0.param) : r0.nom === "p" && St.publication(r0.param) ? St.espace(St.publication(r0.param).espace_id) : null;
    var champ = el("input", { type: "search", class: "rech-champ", placeholder: lili ? "Chercher un client, une publication, une image, un dossier, une facture…" : "Chercher une publication, une image, un message…",
      "aria-label": "Rechercher dans le studio", autocomplete: "off", spellcheck: "false", role: "combobox", "aria-expanded": "true", "aria-controls": "rech-resultats" });
    var liste = el("div", { class: "rech-resultats", id: "rech-resultats", role: "listbox" });
    var pied = el("div", { class: "rech-pied" });
    var pastille = el("button", { type: "button", class: "rech-mode", hidden: true, title: "Revenir à la recherche (Maj + Tab)", onclick: function () { passerRecherche(); } }, [St.icone("etincelle"), NomA]);
    var icoTete = el("span", { class: "rech-ico-tete" }, [St.icone("recherche")]);
    var Reco = window.SpeechRecognition || window.webkitSpeechRecognition, reco = null;
    var micro = lili && Reco ? el("button", { type: "button", class: "btn-icone rech-micro", "aria-label": "Dicter", title: "Dicter (la demande part à " + nomA + ")", onclick: function () {
      if (reco) { reco.stop(); return; }
      if (mode !== "assistant") passerAssistant(false);
      reco = new Reco(); reco.lang = "fr-FR"; reco.interimResults = true; var avant = champ.value ? champ.value + " " : "";
      reco.onresult = function (ev) { champ.value = avant + Array.from(ev.results).map(function (x) { return x[0].transcript; }).join(""); };
      reco.onend = function () { reco = null; micro.classList.remove("actif"); champ.focus(); };
      reco.onerror = function () { St.signaler("Le micro n'est pas disponible", true); };
      micro.classList.add("actif"); reco.start();
    } }, [St.icone("micro")]) : null;
    var d = el("dialog", { class: "rech-fenetre", "aria-label": "Recherche et assistant" }, [
      el("div", { class: "rech-tete" }, [icoTete, pastille, champ, micro, el("button", { type: "button", class: "btn-texte petit rech-fermer", text: "Fermer", onclick: function () { d.close(); } })]),
      liste, pied]);
    function peindrePied() {
      pied.textContent = "";
      var k = function (x) { return el("kbd", { text: x }); };
      if (mode === "assistant") pied.append(el("span", {}, [k("Entrée"), " envoyer"]), el("span", {}, [k("Maj"), k("Tab"), " recherche"]),
        conversation.length ? el("button", { type: "button", class: "btn-texte petit", text: "Nouvelle conversation", onclick: function () { conversation = []; peindre(); champ.focus(); } }) : null,
        el("span", { class: "rech-pied-note", text: "Il crée des éléments internes ; rien ne part chez un client sans vous." }));
      else pied.append(el("span", {}, [k("↑"), k("↓"), " choisir"]), el("span", {}, [k("Entrée"), " ouvrir"]), lili ? el("span", {}, [k("Tab"), " demander à " + nomA]) : null, el("span", {}, [k("Échap"), " fermer"]));
    }
    function passerAssistant(envoyerTout) {
      mode = "assistant"; d.classList.add("en-assistant"); pastille.hidden = false; icoTete.hidden = true;
      champ.type = "text"; champ.placeholder = "Demander à " + nomA + " : une tâche, un rendez-vous, des idées, une légende…"; champ.setAttribute("aria-label", "Votre demande à " + nomA);
      champ.removeAttribute("role"); champ.removeAttribute("aria-activedescendant");
      peindre(); champ.focus();
      if (envoyerTout && champ.value.trim()) envoyer();
    }
    function passerRecherche() {
      mode = "recherche"; d.classList.remove("en-assistant"); pastille.hidden = true; icoTete.hidden = false;
      champ.type = "search"; champ.placeholder = lili ? "Chercher, ou demander à " + nomA + "…" : "Chercher une publication, une image, un message…"; champ.setAttribute("role", "combobox"); champ.setAttribute("aria-label", "Rechercher dans le studio");
      peindre(); champ.focus();
    }
    function envoyer() {
      var texteD = champ.value.trim(); if (!texteD || attente) return;
      champ.value = ""; conversation.push({ qui: "moi", texte: texteD }); attente = true; peindre();
      var fin = function (m) { attente = false; conversation.push(m); if (d.open) { peindre(); champ.focus(); } };
      if (St.X.demo) { setTimeout(function () { fin({ qui: "assistant", texte: "En démonstration, " + nomA + " ne répond pas : il travaille sur les vraies données du studio. En ligne, il ajoute vos tâches et vos rendez-vous, lit votre agenda, prépare des idées et des légendes en brouillons, et répond sur vos clients." }); }, 400); return; }
      St.appel("assistant", { texte: texteD, client: eCtx ? eCtx.slug : null, nom_assistant: (window.MARQUE && MARQUE.assistant) || null,
        historique: conversation.slice(0, -1).filter(function (m) { return !m.erreur; }).slice(-8).map(function (m) { return { qui: m.qui, texte: m.texte }; }) })
        .then(function (res) {
          fin({ qui: "assistant", texte: res.texte, crees: res.crees || (res.brouillons || []).map(function (b) { return { type: "brouillon", id: b.id, titre: b.titre, lien: "#p/" + b.id }; }) });
          if ((res.crees || res.brouillons || []).length) St.charger().then(function () { if (!St.enSaisie() || d.open) St.dessiner(false); });
        }, function (x) { fin({ qui: "assistant", texte: x.message, erreur: true }); });
    }
    function peindreAssistant() {
      liste.textContent = ""; choix = [];
      if (!conversation.length) {
        var exemples = [
          eCtx ? "Ajoute une tâche : préparer le planning de décembre pour " + eCtx.nom : "Ajoute une tâche : préparer le reporting de novembre pour vendredi",
          "Ajoute un rendez-vous " + (eCtx ? "avec " + eCtx.nom + " " : "") + "jeudi à 10 h, en visio",
          "Qu'est-ce que j'ai cette semaine ?",
          eCtx ? "Trois idées de posts pour " + eCtx.nom + " la semaine prochaine" : "Qu'est-ce qui attend une validation depuis plus de trois jours ?"];
        liste.appendChild(el("p", { class: "rech-famille", text: NomA + " peut tout faire avec vous" }));
        liste.appendChild(el("div", { class: "rech-groupe" }, exemples.map(function (s) {
          return el("button", { type: "button", class: "rech-ligne", onclick: function () { champ.value = s; champ.focus(); } }, [el("span", { class: "rech-icone" }, [St.icone("etincelle")]), el("span", { class: "rech-texte" }, [el("b", { text: s })])]);
        })));
      }
      conversation.forEach(function (m) {
        liste.appendChild(el("div", { class: "rech-message" + (m.qui === "moi" ? " moi" : "") + (m.erreur ? " erreur" : "") }, [
          el("small", { text: m.qui === "moi" ? "Vous" : NomA }), el("p", { text: m.texte }),
          (m.crees || []).length ? el("div", { class: "rech-crees" }, m.crees.map(function (c) {
            return el("button", { type: "button", class: "rech-cree", onclick: function () { if (c.type === "rdv") { var rv = (S.rdv || []).filter(function (x) { return x.id === c.id; })[0]; d.close(); if (rv) { St.aller(c.lien.slice(1)); setTimeout(function () { St.editerRdv(rv); }, 80); } else location.hash = c.lien; } else ouvrir({ lien: c.lien }); } },
              [St.icone(ICONES_CREES[c.type] || "plus"), el("span", {}, [el("b", { text: (NOMS_CREES[c.type] || "Créé") + " : " }), c.titre])]);
          })) : null]));
      });
      if (attente) liste.appendChild(el("div", { class: "rech-message attente" }, [el("small", { text: NomA }), el("p", { text: "Je m'en occupe…" })]));
      liste.scrollTop = liste.scrollHeight;
      peindrePied();
    }

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
      if (mode === "assistant") return peindreAssistant();
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
          var b = el("button", { type: "button", class: "rech-ligne", role: "option", id: "rech-" + n, "aria-selected": "false", onclick: function () { ouvrir(o); } }, [
            vignette(o),
            el("span", { class: "rech-texte" }, [el("b", {}, [surligne(o.titre, mots)]), o.sous ? el("small", {}, [surligne(o.sous, mots)]) : null, ex ? el("small", { class: "rech-extrait" }, [surligne(ex, mots)]) : null])]);
          choix.push({ o: o, b: b }); groupe.appendChild(b);
        });
        if (items.length > max) {
          // « Tout afficher » : déplie la famille sur place, sans perdre la recherche
          var nPlus = choix.length, plus = el("button", { type: "button", class: "rech-ligne rech-plus", role: "option", id: "rech-" + nPlus,
            onclick: function () { deplies[k] = true; var c = curseur; peindre(); curseur = Math.min(c, choix.length - 1); marquer(); champ.focus(); } }, [el("span", { class: "rech-icone" }, [St.icone("plus")]), el("span", { class: "rech-texte" }, [el("b", { text: "Afficher les " + items.length + " " + nomF.toLowerCase() })])]);
          choix.push({ o: { action: function () { plus.click(); }, garder: true }, b: plus }); groupe.appendChild(plus);
        }
        liste.appendChild(groupe);
      });
      if (q && lili) {
        // Demander à l'assistant : en tête si cela ressemble à une demande, sinon après les résultats
        var nA = choix.length, demande = el("button", { type: "button", class: "rech-ligne rech-demande", role: "option", id: "rech-" + nA, onclick: function () { passerAssistant(true); } },
          [el("span", { class: "rech-icone ia" }, [St.icone("etincelle")]), el("span", { class: "rech-texte" }, [el("b", { text: "Demander à " + nomA + " : « " + q + " »" }), el("small", { text: "Il peut aussi ajouter une tâche, un rendez-vous, une note, des idées…" })])]);
        var titreA = el("p", { class: "rech-famille", text: NomA }), groupeA = el("div", { class: "rech-groupe" }, [demande]);
        if (ressembleDemande(q) || !choix.length) {
          liste.insertBefore(groupeA, liste.firstChild); liste.insertBefore(titreA, groupeA);
          choix.unshift({ o: { garder: true, action: function () { passerAssistant(true); } }, b: demande });
        } else { liste.appendChild(titreA); liste.appendChild(groupeA); choix.push({ o: { garder: true, action: function () { passerAssistant(true); } }, b: demande }); }
        // Toujours possible : chercher dans les mails Gmail de Lili
        var n = choix.length;
        liste.appendChild(el("p", { class: "rech-famille", text: "Mails" }));
        var b = el("button", { type: "button", class: "rech-ligne", role: "option", id: "rech-" + n, onclick: function () { ouvrir({ lien: "#mails?q=" + encodeURIComponent(q) }); } },
          [el("span", { class: "rech-icone" }, [St.icone("mail")]), el("span", { class: "rech-texte" }, [el("b", { text: "Chercher « " + q + " » dans les mails" }), el("small", { text: "Toute la boîte Gmail" })])]);
        choix.push({ o: { lien: "#mails?q=" + encodeURIComponent(q) }, b: b }); liste.appendChild(el("div", { class: "rech-groupe" }, [b]));
      }
      if (!choix.length) liste.appendChild(el("p", { class: "rech-vide", text: "Rien trouvé pour « " + q + " ». Essayez un autre mot, ou un morceau du nom." }));
      choix.forEach(function (c, i) { c.b.id = "rech-" + i; });   // identifiants dans l'ordre affiché (lecteurs d'écran)
      curseur = 0; marquer(); peindrePied();
    }
    function marquer() {
      choix.forEach(function (c, i) { c.b.setAttribute("aria-selected", i === curseur ? "true" : "false"); });
      if (choix[curseur]) { champ.setAttribute("aria-activedescendant", "rech-" + curseur); choix[curseur].b.scrollIntoView({ block: "nearest" }); }
    }
    // Survol : la ligne sous la souris devient la ligne choisie
    liste.addEventListener("mousemove", function (ev) {
      var b = ev.target.closest && ev.target.closest(".rech-ligne"); if (!b) return;
      var i = choix.findIndex(function (c) { return c.b === b; }); if (i >= 0 && i !== curseur) { curseur = i; marquer(); }
    });
    var minuterie = null;
    champ.addEventListener("input", function () { if (mode === "assistant") return; deplies = {}; clearTimeout(minuterie); minuterie = setTimeout(peindre, 60); });
    champ.addEventListener("keydown", function (ev) {
      if (mode === "assistant") {
        if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); envoyer(); }
        else if (ev.key === "Tab" && ev.shiftKey) { ev.preventDefault(); passerRecherche(); }
        return;
      }
      if (lili && ev.key === "Tab" && !ev.shiftKey) { ev.preventDefault(); passerAssistant(false); return; }
      if (lili && ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); passerAssistant(true); return; }
      if (ev.key === "ArrowDown") { ev.preventDefault(); curseur = Math.min(choix.length - 1, curseur + 1); marquer(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); curseur = Math.max(0, curseur - 1); marquer(); }
      else if (ev.key === "Enter") { ev.preventDefault(); clearTimeout(minuterie); if (champ.value.trim() && !choix.length) peindre(); if (choix[curseur]) ouvrir(choix[curseur].o); }
    });
    d.addEventListener("click", function (ev) { if (ev.target === d) d.close(); });   // clic à côté : fermer
    d.addEventListener("close", function () { if (reco) reco.stop(); d.remove(); ouverte = null; });
    document.body.appendChild(d); ouverte = d;
    d.showModal();
    if (depart) champ.value = depart;
    if (enAssistant && lili) passerAssistant(false); else passerRecherche();
  };
  // L'assistant (touche /) : la même fenêtre, directement en mode assistant
  St.V.assistant = function () { St.rechercher("", true); };

  // ⌘K / Ctrl+K partout (même dans un champ) ; F aussi, hors saisie
  document.addEventListener("keydown", function (ev) {
    if (!St.X.demarre) return;
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && (ev.key === "k" || ev.key === "K")) { ev.preventDefault(); St.rechercher(); return; }
    if (ev.key === "f" && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !St.enSaisie() && !document.querySelector("dialog[open]") && St.S.route.nom !== "mails") { ev.preventDefault(); St.rechercher(); }
  });
})(window.Studio);
