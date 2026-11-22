/* Côté client : l'accueil de son espace (ce qui attend sa réponse d'abord) et la validation en deux gestes,
   publication après publication, en plein écran sur le téléphone (glisser ou flèches pour passer à la suivante). */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;

  function aValider() { return St.publicationsVisibles().filter(function (p) { return p.statut === "a-valider"; }).sort(function (a, b) { return String(a.date_prevue || "9").localeCompare(String(b.date_prevue || "9")); }); }

  // Valider : petite animation nette, puis la suivante
  var enCours = {};   // un double appui n'envoie qu'une validation
  St.valider = function (p, apres) {
    if (enCours[p.id]) return Promise.resolve();
    enCours[p.id] = true;
    return St.repondre(p.id, "valide").finally(function () { delete enCours[p.id]; }).then(function () {
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

  // ---------- Sommaire du client : trois unes (calendrier, photos, idée), puis « Votre espace » en table des matières ----------
  function sommaireClient(e, pubs) {
    var une = function (classe, titre, corps, pied, o) {
      var enfants = [el("span", { class: "som-sur" }, [el("span", { text: titre }), St.icone("fleche", "som-fleche")]), corps, pied ? el("small", { class: "som-pied", text: pied }) : null];
      return o.href ? el("a", { class: "som-une " + classe, href: o.href }, enfants) : el("button", { type: "button", class: "som-une " + classe, onclick: o.action }, enfants);
    };
    var p0 = pubs.filter(function (p) { return p.date_prevue && new Date(p.date_prevue) >= St.debutJour(new Date()); }).sort(function (x, y) { return x.date_prevue.localeCompare(y.date_prevue); })[0];
    var d0 = p0 && new Date(p0.date_prevue);
    var calendrier = une("som-calendrier", "Calendrier", p0 ? el("div", { class: "som-date" }, [el("b", { text: String(d0.getDate()) }),
      el("span", {}, [el("i", { text: St.fmt(d0, { weekday: "long" }) }), el("em", { text: St.fmt(d0, { month: "long" }) + " · " + St.hm(p0.date_prevue) })])])
      : el("div", { class: "som-date vide" }, [el("b", { text: "—" })]), p0 ? (p0.titre || "Sans titre") : "Rien de prévu pour l'instant", { href: "#calendrier" });
    var medias = S.medias.filter(function (m) { return (!e.id || m.espace_id === e.id) && !m.corbeille_le; });
    var derniers = medias.filter(function (m) { return m.type !== "video" || m.apercu_chemin; }).sort(function (x, y) { return String(y.cree_le).localeCompare(String(x.cree_le)); }).slice(0, 4);
    var photos = une("som-mediatheque", "Vos photos", el("div", { class: "som-mosaique n" + derniers.length }, derniers.length ? derniers.map(function (m) { return St.image(m, { classe: "som-img" }); })
      : [el("p", { class: "som-rien", text: "Vos photos arrivent ici" })]), "Déposer des photos, directement depuis votre téléphone", { href: "#mediatheque" });
    var idee = une("som-idee", "Une idée ?", el("p", { class: "som-invite" }, ["Une actualité, un produit, une envie", el("i", { text: "…" })]),
      "Proposez-la à " + (((window.MARQUE || {}).proprietaire || "Lili").split(" ")[0]) + " en deux lignes", { action: function () { St.proposerIdee(); } });
    idee.appendChild(el("span", { class: "som-plus", "aria-hidden": "true" }, [St.icone("plus")]));
    // Votre espace
    var R = St.resumes || {}, brief = R.brief ? R.brief(e) : "", devis = (S.devis || []).filter(function (d) { return d.espace_id === e.id && d.statut !== "brouillon"; });
    var aSigner = devis.filter(function (d) { return d.statut === "envoye"; }).length;
    var lignes = [
      ["#planning", "Planning", pubs.length + " publication" + (pubs.length > 1 ? "s" : "")],
      ["#brief", "Brief", /^Partagé · /.test(brief) ? brief.replace("Partagé · ", "") : "Bientôt disponible"],
      ["#rapports", "Rapports", R.rapports ? R.rapports(e).replace("Aucun chiffre", "Bientôt disponibles") : ""],
      ["#messages", "Messages", R.messages ? R.messages(e) : ""],
      devis.length ? ["#devis", "Devis", aSigner ? aSigner + " à signer" : devis.length + " devis", aSigner] : null,
      ["guide.html", "Comment ça marche", "Le guide en 2 minutes"]
    ].filter(Boolean);
    return el("nav", { class: "sommaire", "aria-label": "Votre espace" }, [
      el("div", { class: "som-unes trois" }, [calendrier, photos, idee]),
      el("div", { class: "som-dossier" }, [
        el("h2", {}, [el("span", { text: "Votre espace" }), el("small", { text: e.nom || "" })]),
        el("ol", {}, lignes.map(function (x, i) {
          return el("li", {}, [el("a", { href: x[0] }, [el("i", { class: "som-no", text: "0" + (i + 1) }), el("b", { text: x[1] }), el("span", { class: "som-points", "aria-hidden": "true" }),
            el("small", { class: x[3] ? "a-faire" : "", text: x[2] }), St.icone("fleche", "som-fleche")])]);
        }))
      ])
    ]);
  }

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
      sommaireClient(e, pubs),
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
    // Tri (gardé sur cet appareil) et genre : photos, vidéos, documents
    var triGarde = ""; try { triGarde = localStorage.getItem("studio.tri-medias") || ""; } catch (x) {}
    var tri = q.tri || triGarde || "recents", genre = q.type || "";
    var tousGenres = St.trierFichiers(S.medias.filter(function (m) { return !m.corbeille_le && (!eId || m.espace_id === eId) && (lili || m.visibilite === "partage"); }), tri);
    var tous = tousGenres.filter(function (m) { return !genre || m.type === genre; });
    var dossiers = Array.from(new Set(tous.map(function (m) { return m.dossier || "Sans dossier"; }))).sort(function (a, b) { return a.localeCompare(b, "fr"); });
    var dossier = q.dossier || "";
    var liste = tous.filter(function (m) { return !dossier || (m.dossier || "Sans dossier") === dossier; });
    var base = eForce ? "#" + eForce.slug + "/mediatheque" : "#mediatheque";
    var lien = function (o) {
      var x = Object.assign({ dossier: dossier, client: eForce ? "" : eId, tri: q.tri || "", type: genre }, o), s = [];
      if (x.dossier) s.push("dossier=" + encodeURIComponent(x.dossier)); if (x.client && lili && !eForce) s.push("client=" + x.client);
      if (x.type) s.push("type=" + x.type); if (x.tri) s.push("tri=" + x.tri);
      return base + (s.length ? "?" + s.join("&") : "");
    };

    var page = el("div", { class: "vue-mediatheque" });
    var fichier = el("input", { type: "file", accept: lili ? null : "image/*,video/*", multiple: true, hidden: true, onchange: function (ev) { deposer(ev.target.files); } });
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
    // Une médiathèque par client : dans la vue « Tous les clients », une carte par client (photos récentes, nombre)
    if (lili && !eId && !eForce) {
      var cartes = St.espacesActifs().map(function (e) {
        var ms = S.medias.filter(function (m) { return m.espace_id === e.id && !m.corbeille_le; });
        var imgs = ms.filter(function (m) { return m.type === "image"; }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).slice(0, 3);
        return el("a", { class: "med-client", href: "#" + e.slug + "/mediatheque", style: { "--c": e.couleur } }, [
          el("span", { class: "med-client-mos n" + imgs.length }, imgs.length ? imgs.map(function (m) { return St.image(m); }) : [St.icone("mediatheque")]),
          el("span", { class: "med-client-nom" }, [el("i", { class: "pastille-client" }), el("b", { text: e.nom })]),
          el("small", { text: ms.length ? ms.length + " fichier" + (ms.length > 1 ? "s" : "") : "Vide" })]);
      });
      page.appendChild(el("section", { class: "med-clients-bloc" }, [el("h2", { class: "med-titre", text: "Par client" }), el("div", { class: "med-clients" }, cartes)]));
      page.appendChild(el("h2", { class: "med-titre", text: "Tous les fichiers" }));
    }
    // Genre et tri
    var genres = [["", "Tout"], ["image", "Photos"], ["video", "Vidéos"], ["document", "Documents"]].filter(function (g) { return !g[0] || tousGenres.some(function (m) { return m.type === g[0]; }); });
    page.appendChild(el("div", { class: "med-outils" }, [
      genres.length > 2 ? el("nav", { class: "vues", "aria-label": "Genre" }, genres.map(function (g) { return el("a", { href: lien({ type: g[0], dossier: "" }), class: genre === g[0] ? "actif" : "", "aria-current": genre === g[0] ? "true" : null, text: g[1] }); })) : el("span"),
      el("label", { class: "tri" }, [el("span", { text: "Trier" }), el("select", { "aria-label": "Trier les fichiers", onchange: function (ev) { try { localStorage.setItem("studio.tri-medias", ev.target.value); } catch (x) {} St.aller(lien({ tri: ev.target.value }).slice(1)); } },
        [["recents", "Plus récents"], ["anciens", "Plus anciens"], ["nom", "Nom (A à Z)"], ["type", "Type"], ["taille", "Plus lourds"]].map(function (t) { return el("option", { value: t[0], selected: t[0] === tri, text: t[1] }); }))])]));
    page.appendChild(el("nav", { class: "puces-filtre", "aria-label": "Dossiers" }, [el("a", { href: lien({ dossier: "" }), class: "puce" + (!dossier ? " active" : "") }, ["Tout", el("span", { text: String(tous.length) })])]
      .concat(dossiers.map(function (d) { return el("a", { href: lien({ dossier: d }), class: "puce" + (d === dossier ? " active" : "") }, [d, el("span", { text: String(tous.filter(function (m) { return (m.dossier || "Sans dossier") === d; }).length) })]); }))));
    page.appendChild(liste.length ? el("div", { class: "grille-medias" }, liste.map(function (m) {
      var e = St.espace(m.espace_id) || {}, utilise = S.pubMedias.filter(function (x) { return x.media_id === m.id; }).length;
      return el("button", { type: "button", class: "media-tuile", style: { "--c": e.couleur }, onclick: function () { ouvrirMedia(m); } }, [
        St.vignette(m), m.type === "video" ? el("span", { class: "media-type", text: "Vidéo" }) : null,
        m.visibilite === "interne" ? el("span", { class: "etiquette-interne", text: "Lili seule" }) : null,
        el("span", { class: "media-legende" }, [!eId ? el("i", { class: "pastille-client", style: { "--c": e.couleur } }) : null, el("span", { text: m.dossier || "Sans dossier" }), utilise ? el("small", { text: " · " + utilise + " publi." }) : null])
      ]);
    })) : el("div", { class: "depot-vide", onclick: function () { fichier.click(); } }, [St.icone("deposer"), el("p", { text: "Aucun fichier ici pour l'instant." }), el("small", { text: "Glissez vos photos et vidéos, ou touchez pour les choisir." })]));
    return page;
  };
  St.ouvrirMedia = function (m) { return ouvrirMedia(m); };
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
    var corps = [el("div", { class: "media-grand" }, [St.vignette(m, { apercu: false })]), el("p", { class: "aside", text: infos })];
    var liens = [m.type === "document" ? el("button", { type: "button", class: "btn-texte", onclick: function () { St.ouvrirFichier(m); } }, [St.icone("oeil"), "Ouvrir"]) : null,
      lili && St.envoyerParMail ? el("button", { type: "button", class: "btn-texte", onclick: function () { var d = document.querySelector("dialog[open]"); if (d) d.close(); St.envoyerParMail(m); } }, [St.icone("mail"), "Envoyer par mail"]) : null].filter(Boolean);
    if (liens.length) corps.push(el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, liens));
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
