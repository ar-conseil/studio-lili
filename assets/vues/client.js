/* Côté client : l'accueil de son espace (ce qui attend sa réponse d'abord) et la validation en deux gestes,
   publication après publication, en plein écran sur le téléphone (glisser ou flèches pour passer à la suivante). */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;

  function aValider() { return St.publicationsVisibles().filter(function (p) { return p.statut === "a-valider"; }).sort(function (a, b) { return String(a.date_prevue || "9").localeCompare(String(b.date_prevue || "9")); }); }

  // Valider : petite animation nette, puis la suivante
  St.valider = function (p, apres) {
    return St.repondre(p.id, "valide").then(function () {
      var ok = el("div", { class: "validation-ok", "aria-hidden": "true" }, [el("span", {}, [St.icone("valider")])]);
      document.body.appendChild(ok); if (navigator.vibrate) navigator.vibrate(12);
      setTimeout(function () { ok.remove(); }, 900);
      St.signaler("« " + (p.titre || "Publication") + " » validée. Merci !");
      if (apres) apres(); else St.dessiner(false);
    });
  };
  St.demanderModif = function (p, apres) {
    var champ = el("textarea", { rows: 4, placeholder: "Ce qu'il faut changer : le visuel, une phrase de la légende, la date…", "aria-label": "Modification demandée" });
    St.fenetre({ titre: "Demander une modification", sous: "Lili reçoit votre message tout de suite. Vous pouvez aussi épingler une remarque sur le visuel.", classe: "feuille", corps: [champ],
      actions: [{ texte: "Annuler" }, { texte: "Envoyer à Lili", principal: true, action: function (f) {
        var t = champ.value.trim(); if (!t) { champ.focus(); return; }
        St.repondre(p.id, "modifs-demandees", t).then(function () { f(); St.signaler("Demande envoyée à Lili"); if (apres) apres(); else St.dessiner(false); });
      } }] });
  };

  // ---------- Accueil du client ----------
  V.accueilClient = function () {
    var e = St.espacesClient()[0] || {}, attente = aValider(), h = new Date().getHours();
    var pubs = St.publicationsVisibles(), prenom = ((S.moi && S.moi.nom) || "").split(" ")[0];
    var aVenir = pubs.filter(function (p) { return p.date_prevue && new Date(p.date_prevue) >= St.debutJour(new Date()) && ["valide", "programme"].indexOf(p.statut) >= 0; })
      .sort(function (a, b) { return a.date_prevue.localeCompare(b.date_prevue); }).slice(0, 6);
    var recentes = pubs.filter(function (p) { return p.statut === "publie"; }).sort(function (a, b) { return String(b.date_prevue).localeCompare(String(a.date_prevue)); }).slice(0, 3);
    var couv = St.urlEspace(e, "couverture_path");
    return el("div", { class: "vue-accueil-client", style: { "--c": e.couleur } }, [
      el("div", { class: "couverture basse" }, [couv ? el("img", { src: couv, alt: "" }) : null]),
      el("header", { class: "entete-client" }, [St.logoEspace(e, "grand"), el("div", {}, [el("p", { class: "surtitre", text: e.nom + " · par " + ((window.MARQUE || {}).proprietaire || "") }),
        el("h1", { class: "titre-page", text: (h < 5 || h >= 18 ? "Bonsoir" : "Bonjour") + (prenom ? " " + prenom : "") })])]),
      attente.length ? el("a", { class: "appel-valider", href: "#valider" }, [
        el("div", { class: "appel-visuels" }, attente.slice(0, 3).map(function (p) { var m = St.mediasDe(p.id)[0]; return m ? St.image(m) : el("span", { class: "image-vide" }); })),
        el("div", {}, [el("b", { text: attente.length + (attente.length > 1 ? " publications attendent" : " publication attend") + " votre réponse" }),
          el("small", { text: "Quelques secondes chacune : valider, ou dire ce qu'il faut changer." })]),
        el("span", { class: "btn-plein" }, ["Commencer", St.icone("fleche")])
      ]) : el("div", { class: "appel-valider calme" }, [el("div", {}, [el("b", { text: "Tout est à jour" }), el("small", { text: "Rien n'attend votre réponse. Lili vous préviendra pour la suite." })])]),
      aVenir.length ? el("section", { class: "a-venir" }, [el("h2", { text: "Bientôt en ligne" }), el("div", { class: "grille-cartes" }, aVenir.map(function (p) { return St.cartePublication(p, { sansClient: true }); }))]) : null,
      el("section", { class: "raccourcis-client" }, [
        el("a", { class: "tuile", href: "#mediatheque" }, [St.icone("deposer", "tuile-ic"), el("span", {}, [el("b", { text: "Déposer des photos" }), el("small", { text: "Directement depuis votre téléphone" })]), St.icone("fleche", "tuile-fleche")]),
        el("button", { type: "button", class: "tuile", onclick: function () { St.proposerIdee(); } }, [St.icone("plus", "tuile-ic"), el("span", {}, [el("b", { text: "Proposer une idée" }), el("small", { text: "Une actualité, un produit, une envie" })]), St.icone("fleche", "tuile-fleche")]),
        el("a", { class: "tuile", href: "#calendrier" }, [St.icone("calendrier", "tuile-ic"), el("span", {}, [el("b", { text: "Calendrier" }), el("small", { text: "Tout ce qui est prévu" })]), St.icone("fleche", "tuile-fleche")])
      ]),
      recentes.length ? el("section", { class: "a-venir" }, [el("h2", { text: "Récemment publiées" }), el("div", { class: "grille-cartes" }, recentes.map(function (p) { return St.cartePublication(p, { sansClient: true }); }))]) : null
    ]);
  };

  // ---------- Valider, une publication après l'autre ----------
  var pos = 0;
  V.valider = function () {
    var liste = aValider(), page = el("div", { class: "vue-valider" });
    if (!liste.length) {
      page.appendChild(el("div", { class: "valider-fini" }, [el("span", { class: "valider-fini-ic" }, [St.icone("valider")]), el("h1", { class: "titre-page", text: "C'est tout pour l'instant" }),
        el("p", { class: "phrase", text: "Merci ! Lili a vos réponses et s'occupe de la suite." }), el("a", { class: "btn-plein", href: "#", text: "Revenir à l'accueil" })]));
      return page;
    }
    pos = Math.min(pos, liste.length - 1);
    var p = liste[pos], idx = 0;
    var cadre = el("div", { class: "valider-cadre" });
    function dessinerCarte() {
      cadre.textContent = "";
      var bulles = St.commentairesDe(p.id).filter(function (c) { return !c.parent_id && c.visibilite === "partage"; });
      cadre.appendChild(St.apercu(p, null, { index: idx, bulles: bulles, changer: function (i) { idx = i; dessinerCarte(); } }));
    }
    dessinerCarte();
    // Glisser horizontalement : publication suivante ou précédente (les flèches du clavier aussi)
    var x0 = null;
    cadre.addEventListener("touchstart", function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
    cadre.addEventListener("touchend", function (ev) {
      if (x0 == null) return; var dx = ev.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 70 && St.mediasDe(p.id).length <= 1) { pos = (pos + (dx < 0 ? 1 : -1) + liste.length) % liste.length; St.dessiner(false); }
    });
    var com = St.commentairesDe(p.id).filter(function (c) { return c.visibilite === "partage" && !c.resolu; }).length;
    page.appendChild(el("header", { class: "valider-tete" }, [
      el("a", { class: "btn-icone", href: "#", "aria-label": "Fermer" }, [St.icone("fermer")]),
      el("span", { class: "valider-pos", text: (pos + 1) + " sur " + liste.length }),
      el("span", { class: "valider-points" }, liste.map(function (x, i) { return el("i", { class: i === pos ? "on" : "" }); }))
    ]));
    page.appendChild(el("div", { class: "valider-info" }, [el("b", { text: p.titre || "Sans titre" }),
      el("small", { text: (p.date_prevue ? St.fmt(p.date_prevue, { weekday: "long", day: "numeric", month: "long" }) + " · " + St.hm(p.date_prevue) + " · " : "") + (p.reseaux || []).map(function (r) { return (St.RESEAUX[r] || {}).nom; }).join(", ") })]));
    page.appendChild(cadre);
    page.appendChild(el("a", { class: "valider-detail", href: "#p/" + p.id }, [St.icone("commentaire"), com ? com + " remarque" + (com > 1 ? "s" : "") + " · commenter" : "Commenter ou voir le détail"]));
    var suivante = function () { if (pos >= aValider().length) pos = 0; St.dessiner(false); };
    page.appendChild(el("footer", { class: "valider-boutons" }, [
      el("button", { type: "button", class: "btn-texte grand", onclick: function () { St.demanderModif(p, suivante); } }, ["Demander une modification"]),
      el("button", { type: "button", class: "btn-plein grand", onclick: function () { St.valider(p, suivante); } }, [St.icone("valider"), "Valider"])
    ]));
    return page;
  };
  var avant = V.touche;
  V.touche = function (ev) {
    if (S.route.nom === "valider") {
      var n = aValider().length; if (!n) return false;
      if (ev.key === "ArrowRight") { pos = (pos + 1) % n; St.dessiner(false); return true; }
      if (ev.key === "ArrowLeft") { pos = (pos - 1 + n) % n; St.dessiner(false); return true; }
    }
    return avant ? avant(ev) : false;
  };

  // ======================================================================
  // Médiathèque : dossiers, étiquettes, dépôt par glisser-déposer ou depuis la pellicule du téléphone
  // ======================================================================
  V.mediatheque = function (r, eForce) {
    var q = r.query || {}, lili = St.estLili();
    var eId = eForce ? eForce.id : !lili ? (St.espacesClient()[0] || {}).id : q.client || "";
    var tous = S.medias.filter(function (m) { return !m.corbeille_le && (!eId || m.espace_id === eId) && (lili || m.visibilite === "partage"); })
      .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    var dossiers = Array.from(new Set(tous.map(function (m) { return m.dossier || "Sans dossier"; }))).sort();
    var dossier = q.dossier || "";
    var liste = tous.filter(function (m) { return !dossier || (m.dossier || "Sans dossier") === dossier; });
    var base = eForce ? "#" + eForce.slug + "/mediatheque" : "#mediatheque";
    var lien = function (o) { var x = Object.assign({ dossier: dossier, client: eForce ? "" : eId }, o); var s = []; if (x.dossier) s.push("dossier=" + encodeURIComponent(x.dossier)); if (x.client && lili && !eForce) s.push("client=" + x.client); return base + (s.length ? "?" + s.join("&") : ""); };

    var page = el("div", { class: "vue-mediatheque" });
    var fichier = el("input", { type: "file", accept: "image/*,video/*", multiple: true, hidden: true, onchange: function (ev) { deposer(ev.target.files); } });
    var cibleDepot = eId || (lili ? null : (St.espacesClient()[0] || {}).id);
    function deposer(fichiers) {
      var l = Array.prototype.slice.call(fichiers || []); if (!l.length) return;
      if (!cibleDepot) { St.signaler("Choisissez d'abord un client.", true); return; }
      page.classList.add("envoi"); St.signaler("Envoi de " + l.length + " fichier" + (l.length > 1 ? "s" : "") + "…");
      Promise.all(l.map(function (f) { return St.televerser(f, cibleDepot, dossier && dossier !== "Sans dossier" ? dossier : (lili ? null : "Déposé par le client")); }))
        .then(function () { St.signaler(l.length > 1 ? l.length + " fichiers déposés" : "Fichier déposé"); St.dessiner(false); })
        .catch(function (e) { page.classList.remove("envoi"); St.signaler("Envoi impossible : " + e.message, true); });
    }
    page.addEventListener("dragover", function (ev) { if (ev.dataTransfer.types.indexOf("Files") >= 0) { ev.preventDefault(); page.classList.add("depot"); } });
    page.addEventListener("dragleave", function (ev) { if (!page.contains(ev.relatedTarget)) page.classList.remove("depot"); });
    page.addEventListener("drop", function (ev) { if (ev.dataTransfer.files.length) { ev.preventDefault(); page.classList.remove("depot"); deposer(ev.dataTransfer.files); } });

    var actions = [lili && !eForce ? el("select", { class: "choix-client", "aria-label": "Client", onchange: function (ev) { St.aller(lien({ client: ev.target.value, dossier: "" }).slice(1)); } },
      [el("option", { value: "", text: "Tous les clients" })].concat(St.espacesActifs().map(function (e) { return el("option", { value: e.id, selected: e.id === eId, text: e.nom }); }))) : null,
      el("button", { type: "button", class: "btn-plein", onclick: function () { fichier.click(); } }, [St.icone("deposer"), lili ? "Déposer" : "Déposer des photos"]), fichier];
    if (!eForce) page.appendChild(St.entete(null, "Médiathèque", lili ? "Glissez des fichiers n'importe où sur la page." : "Vos photos et vidéos, et celles que prépare Lili. Glissez-en ici ou choisissez-les sur votre téléphone.", actions));
    else page.appendChild(el("div", { class: "barre-outils" }, actions));
    page.appendChild(el("nav", { class: "puces-filtre", "aria-label": "Dossiers" }, [el("a", { href: lien({ dossier: "" }), class: "puce" + (!dossier ? " active" : "") }, ["Tout", el("span", { text: String(tous.length) })])]
      .concat(dossiers.map(function (d) { return el("a", { href: lien({ dossier: d }), class: "puce" + (d === dossier ? " active" : "") }, [d, el("span", { text: String(tous.filter(function (m) { return (m.dossier || "Sans dossier") === d; }).length) })]); }))));
    page.appendChild(liste.length ? el("div", { class: "grille-medias" }, liste.map(function (m) {
      var e = St.espace(m.espace_id) || {}, utilise = S.pubMedias.filter(function (x) { return x.media_id === m.id; }).length;
      return el("button", { type: "button", class: "media-tuile", style: { "--c": e.couleur }, onclick: function () { ouvrirMedia(m); } }, [
        St.image(m), m.type === "video" ? el("span", { class: "media-type", text: "Vidéo" }) : null,
        m.visibilite === "interne" ? el("span", { class: "etiquette-interne", text: "Lili seule" }) : null,
        el("span", { class: "media-legende" }, [!eId ? el("i", { class: "pastille-client", style: { "--c": e.couleur } }) : null, el("span", { text: m.dossier || "Sans dossier" }), utilise ? el("small", { text: " · " + utilise + " publi." }) : null])
      ]);
    })) : el("div", { class: "depot-vide", onclick: function () { fichier.click(); } }, [St.icone("deposer"), el("p", { text: "Aucun fichier ici pour l'instant." }), el("small", { text: "Glissez vos photos et vidéos, ou touchez pour les choisir." })]));
    return page;
  };
  function ouvrirMedia(m) {
    var lili = St.estLili(), e = St.espace(m.espace_id) || {}, auteur = St.personne(m.depose_par) || {};
    var dossier = el("input", { type: "text", value: m.dossier || "", placeholder: "Dossier", "aria-label": "Dossier", list: "liste-dossiers" });
    var etiquettes = el("input", { type: "text", value: (m.etiquettes || []).join(", "), placeholder: "Étiquettes, séparées par des virgules", "aria-label": "Étiquettes" });
    var peutModifier = lili || m.depose_par === S.moi.id;
    var pubs = S.pubMedias.filter(function (x) { return x.media_id === m.id; }).map(function (x) { return St.publication(x.publication_id); }).filter(Boolean);
    // Ce qui parle à tout le monde : le vrai nom du fichier (pas un identifiant), qui l'a déposé si on le sait, et quand
    var nomLisible = m.nom_fichier && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(m.nom_fichier) && !/^[0-9a-f]{20,}\./i.test(m.nom_fichier) ? m.nom_fichier : "";
    var datePub = pubs.map(function (p) { return p.date_prevue; }).filter(Boolean).sort().pop();
    var quand = m.notion_id && datePub ? "publication du " + St.fmt(datePub, { day: "numeric", month: "long", year: "numeric" }) : "ajouté " + St.ilya(m.cree_le);
    var infos = [nomLisible, auteur.nom ? "déposé par " + auteur.nom : null, quand, lili ? e.nom : null].filter(Boolean).join(" · ");
    var corps = [el("div", { class: "media-grand" }, [St.image(m, { apercu: false })]), el("p", { class: "aside", text: infos })];
    if (peutModifier) corps.push(el("div", { class: "pile-serree" }, [dossier, etiquettes]));
    if (pubs.length) corps.push(el("p", { class: "aside" }, ["Utilisé dans : "].concat(pubs.map(function (p, i) { return el("a", { href: "#p/" + p.id, text: (i ? ", " : "") + (p.titre || "Sans titre") }); }))));
    var actions = [{ texte: "Fermer" }];
    if (peutModifier) {
      actions.unshift({ texte: "Corbeille", danger: true, action: function (f) {
        St.maj("medias", m.id, { corbeille_le: new Date().toISOString() }).then(function () { f(); St.signaler("Fichier à la corbeille (30 jours)"); St.dessiner(false); });
      } });
      actions.push({ texte: "Enregistrer", principal: true, action: function (f) {
        St.maj("medias", m.id, { dossier: dossier.value.trim() || null, etiquettes: etiquettes.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean) }).then(function () { f(); St.dessiner(false); });
      } });
    }
    if (lili) actions.splice(1, 0, { texte: m.visibilite === "interne" ? "Partager avec le client" : "Réserver à Lili", action: function (f) {
      St.maj("medias", m.id, { visibilite: m.visibilite === "interne" ? "partage" : "interne" }).then(function () { f(); St.dessiner(false); });
    } });
    St.fenetre({ titre: (pubs[0] && pubs[0].titre) || nomLisible.replace(/\.[a-z0-9]+$/i, "") || m.dossier || "Fichier", sous: m.dossier ? "Dossier " + m.dossier : null, classe: "large media-fenetre", corps: corps, actions: actions });
  }
})(window.Studio);
