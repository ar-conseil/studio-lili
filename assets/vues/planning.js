/* Le planning « façon Notion » : la base des publications d'un client, avec les vues que les habitués de Notion
   connaissent (Tableau, Kanban, Calendrier, Galerie), groupée par mois, filtrable, et chaque ligne qui s'ouvre sur le
   côté comme une page Notion. En plus de Notion : valider ou demander une modification en un geste, commenter, voir
   les visuels et la légende tels qu'ils partiront.
   Adresses : #planning?vue=tableau|kanban|calendrier|galerie&mois=AAAA-MM&statut=…&q=…  (client, et Lili sur tous les clients)
              #<slug>/planning  (Lili : ce que voit le client). Ouverture sur le côté : &ouvrir=<id de publication>. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;
  var VUES = [["tableau", "Tableau", "liste"], ["kanban", "Kanban", "colonnes"], ["calendrier", "Calendrier", "calendrier"], ["galerie", "Galerie", "mediatheque"]];
  var lire = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var ecrire = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  var NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var moisDe = function (p) { return p.date_prevue ? St.iso(p.date_prevue).slice(0, 7) : "sans-date"; };
  var nomMois = function (k) { if (k === "sans-date") return "Sans date"; var a = +k.slice(0, 4), m = +k.slice(5, 7) - 1; return NOMS_MOIS[m].charAt(0).toUpperCase() + NOMS_MOIS[m].slice(1) + " " + a; };
  var etiquette = function (texte, classe) { return el("span", { class: "pl-tag " + (classe || ""), text: texte }); };
  var tagStatut = function (s) { return el("span", { class: "pl-tag pl-statut s-" + s }, [el("i"), St.STATUTS[s] || s]); };
  var tagsReseaux = function (p) { return (p.reseaux || []).map(function (r) { return etiquette((St.RESEAUX[r] || {}).nom || r, "pl-r-" + r); }); };
  var dateCourte = function (p) { return p.date_prevue ? St.fmt(p.date_prevue, { weekday: "short", day: "numeric", month: "short" }) + " · " + St.hm(p.date_prevue) : "—"; };
  var vignette = function (p, classe) { var m = St.mediasDe(p.id)[0]; return m ? St.image(m, { classe: classe || "pl-vignette" }) : el("span", { class: (classe || "pl-vignette") + " vide" }, [St.icone("publications")]); };

  V.planning = function (r, eForce) {
    var q = r.query || {}, lili = St.estLili();
    var e = eForce || (!lili ? St.espacesClient()[0] : (q.client ? St.espace(q.client) : null));
    var cle = "planning-vue", vue = q.vue || lire(cle) || "tableau";
    if (!VUES.some(function (x) { return x[0] === vue; })) vue = "tableau";
    ecrire(cle, vue);
    var base = eForce ? "#" + eForce.slug + "/planning" : "#planning";
    var lien = function (o) {
      var x = Object.assign({ vue: vue, statut: q.statut || "", mois: q.mois || "", q: q.q || "", client: !eForce && lili && e ? e.id : "" }, o), s = [];
      ["vue", "statut", "mois", "q", "client", "ouvrir"].forEach(function (k) { if (x[k]) s.push(k + "=" + encodeURIComponent(x[k])); });
      return base + (s.length ? "?" + s.join("&") : "");
    };
    var toutes = St.publicationsVisibles().filter(function (p) { return !e || p.espace_id === e.id; });
    // Lili dans la rubrique « Planning (vue client) » : exactement ce que voit le client (rien d'interne)
    if (lili && eForce) toutes = toutes.filter(function (p) { return p.visibilite === "partage"; });
    var recherche = norm(q.q || "");
    var pubs = toutes.filter(function (p) {
      return (!q.statut || p.statut === q.statut) && (!recherche || norm([p.titre, p.legende, p.format].join(" ")).indexOf(recherche) >= 0);
    }).sort(function (a, b) { return String(a.date_prevue || "9999").localeCompare(String(b.date_prevue || "9999")); });
    var aValider = toutes.filter(function (p) { return p.statut === "a-valider"; });

    // ---------- En-tête façon page Notion ----------
    var titre = e ? "Planning " + e.nom : "Planning de tous les clients";
    var entete = el("header", { class: "pl-entete" }, [
      e ? St.logoEspace(e, "grand") : el("span", { class: "pl-ico-page" }, [St.icone("calendrier")]),
      el("h1", { class: "pl-titre", text: titre }),
      el("p", { class: "pl-desc", text: lili && !eForce ? "Toutes les publications, comme dans une base Notion. Cliquez une ligne pour l'ouvrir sur le côté."
        : "Votre calendrier de publications, comme dans Notion : changez de vue, filtrez, et cliquez une ligne pour l'ouvrir sur le côté." })]);
    // Encadré « à valider » (comme un bloc callout de Notion)
    var callout = !lili && aValider.length ? el("div", { class: "pl-callout" }, [el("span", { class: "pl-callout-ico" }, [St.icone("valider")]),
      el("div", {}, [el("b", { text: aValider.length + (aValider.length > 1 ? " publications attendent" : " publication attend") + " votre réponse." }),
        el("span", { text: " Ouvrez-la ici, ou passez-les en revue une par une." })]),
      el("a", { class: "btn-plein petit", href: "#valider" }, ["Tout passer en revue", St.icone("fleche")])]) : null;

    // ---------- Onglets de vues et barre d'outils ----------
    var champ = el("input", { type: "search", class: "pl-recherche", placeholder: "Rechercher", value: q.q || "", "aria-label": "Rechercher dans le planning" });
    var minut = null;
    champ.addEventListener("input", function () { clearTimeout(minut); minut = setTimeout(function () { history.replaceState(null, "", lien({ q: champ.value.trim() })); St.S.route.query.q = champ.value.trim(); var pos = champ.selectionStart; St.dessiner(false); var c = document.querySelector(".pl-recherche"); if (c) { c.focus(); try { c.setSelectionRange(pos, pos); } catch (x) {} } }, 250); });
    var statutsPossibles = St.ORDRE_STATUTS.filter(function (s) { return toutes.some(function (p) { return p.statut === s; }); });
    var filtre = el("select", { class: "pl-filtre", "aria-label": "Filtrer par statut", onchange: function (ev) { St.aller(lien({ statut: ev.target.value }).slice(1)); } },
      [el("option", { value: "", text: "Tous les statuts" })].concat(statutsPossibles.map(function (s) { return el("option", { value: s, selected: q.statut === s, text: St.STATUTS[s] }); })));
    var choixClient = lili && !eForce ? el("select", { class: "pl-filtre", "aria-label": "Client", onchange: function (ev) { St.aller(lien({ client: ev.target.value }).slice(1)); } },
      [el("option", { value: "", text: "Tous les clients" })].concat(St.espacesActifs().map(function (x) { return el("option", { value: x.id, selected: e && x.id === e.id, text: x.nom }); }))) : null;
    var nouveau = lili ? el("button", { type: "button", class: "btn-plein petit", onclick: function () { St.nouvellePublication(e ? e.id : null); } }, [St.icone("plus"), "Nouvelle"])
      : el("button", { type: "button", class: "btn-plein petit", onclick: function () { if (St.proposerIdee) St.proposerIdee(); } }, [St.icone("plus"), "Proposer une idée"]);
    var barre = el("div", { class: "pl-barre" }, [
      el("nav", { class: "pl-vues", "aria-label": "Vues" }, VUES.map(function (x) { return el("a", { href: lien({ vue: x[0], mois: x[0] === "calendrier" ? q.mois : "" }), class: x[0] === vue ? "actif" : "", "aria-current": x[0] === vue ? "page" : null }, [St.icone(x[2]), x[1]]); })),
      el("div", { class: "pl-outils" }, [champ, choixClient, filtre, nouveau])]);

    // ---------- Les vues ----------
    var ouvrir = function (p) { return function (ev) { if (ev && (ev.metaKey || ev.ctrlKey)) return; if (ev) ev.preventDefault(); St.ouvrirCote(p); }; };
    var corps;
    // Affiche les n premiers éléments, puis un bouton « Afficher n de plus » (213 publications ne s'empilent pas d'un coup).
    var parPaquets = function (liste, n, rendu, classe) {
      var boite = el("div", { class: classe });
      var montrer = function (debut) {
        var bouton = boite.querySelector(".pl-plus"); if (bouton) bouton.remove();
        liste.slice(debut, debut + n).forEach(function (x) { boite.appendChild(rendu(x)); });
        var reste = liste.length - debut - n;
        if (reste > 0) boite.appendChild(el("button", { type: "button", class: "pl-plus", text: "Afficher " + Math.min(reste, n) + " de plus (" + reste + " restantes)", onclick: function () { montrer(debut + n); } }));
      };
      montrer(0); return boite;
    };
    var maintenant = Date.now();
    var aVenir = function (p) { return !p.date_prevue || new Date(p.date_prevue).getTime() >= maintenant - 864e5; };
    if (vue === "kanban") {
      // Seules les colonnes qui ont quelque chose, plus « À valider » (là où le client agit) ; chez le client,
      // jamais « En création ». Les colonnes terminées montrent le plus récent d'abord.
      var colonnes = (lili ? St.ORDRE_STATUTS : ["idee", "a-valider", "modifs-demandees", "valide", "programme", "publie"]).filter(function (s) {
        if (q.statut) return s === q.statut;
        return s === "a-valider" || pubs.some(function (p) { return p.statut === s; });
      });
      var carte = function (p) {
        return el("a", { href: "#p/" + p.id, class: "pl-carte", onclick: ouvrir(p) }, [St.mediasDe(p.id)[0] ? vignette(p, "pl-carte-img") : null, el("b", { text: p.titre || "Sans titre" }),
          el("small", { text: dateCourte(p) }), el("span", { class: "pl-tags" }, tagsReseaux(p))].filter(Boolean));
      };
      corps = el("div", { class: "pl-kanban", style: "--n:" + colonnes.length }, colonnes.map(function (s) {
        var ps = pubs.filter(function (p) { return p.statut === s; });
        if (s === "publie" || s === "valide" || s === "programme") ps = ps.slice().sort(function (a, b) { return String(b.date_prevue || "").localeCompare(String(a.date_prevue || "")); });
        if (s === "valide" || s === "programme") ps = ps.filter(aVenir).reverse().concat(ps.filter(function (p) { return !aVenir(p); }));
        var cartes = ps.length ? parPaquets(ps, 20, carte, "pl-cartes") : el("div", { class: "pl-cartes" }, [el("p", { class: "pl-vide", text: s === "a-valider" ? "Rien à valider pour l'instant" : "Rien ici" })]);
        return el("section", { class: "pl-colonne" }, [el("header", {}, [tagStatut(s), el("small", { text: String(ps.length) })]), cartes]);
      }));
    } else if (vue === "galerie") {
      // Les publications à venir d'abord (dans l'ordre), puis les publiées de la plus récente à la plus ancienne.
      // Sans visuel : une carte de texte (début de la légende) au lieu d'une case vide.
      var fiche = function (p) {
        var m = St.mediasDe(p.id)[0];
        var haut = m ? St.image(m, { classe: "pl-fiche-img" }) : el("div", { class: "pl-fiche-img pl-fiche-txt" }, [el("p", { text: String(p.legende || p.titre || "").slice(0, 220) || "Visuel à venir" })]);
        return el("a", { href: "#p/" + p.id, class: "pl-fiche", onclick: ouvrir(p) }, [haut,
          el("div", { class: "pl-fiche-texte" }, [el("b", { text: p.titre || "Sans titre" }), el("small", { text: dateCourte(p) }), el("span", { class: "pl-tags" }, [tagStatut(p.statut)].concat(tagsReseaux(p)))])]);
      };
      var futures = pubs.filter(aVenir), passees = pubs.filter(function (p) { return !aVenir(p); }).reverse();
      corps = el("div", {}, [
        futures.length ? el("h3", { class: "pl-galerie-titre", text: "À venir (" + futures.length + ")" }) : null,
        futures.length ? parPaquets(futures, 24, fiche, "pl-galerie") : null,
        passees.length ? el("h3", { class: "pl-galerie-titre", text: "Déjà passées (" + passees.length + ")" }) : null,
        passees.length ? parPaquets(passees, 12, fiche, "pl-galerie") : null].filter(Boolean));
      if (!pubs.length) corps = St.vide("Aucune publication ne correspond.");
    } else if (vue === "calendrier") {
      var ref = q.mois ? new Date(q.mois + "-01T12:00:00") : new Date(); ref.setDate(1);
      var depart = St.lundi(ref), moisK = St.iso(ref).slice(0, 7), cases = [];
      for (var i = 0; i < 42; i++) {
        var j = St.ajouterJours(depart, i); if (i >= 35 && j.getMonth() !== ref.getMonth()) break;
        var duJour = pubs.filter(function (p) { return p.date_prevue && St.memeJour(p.date_prevue, j); });
        cases.push(el("div", { class: "pl-jour" + (j.getMonth() !== ref.getMonth() ? " hors" : "") + (St.memeJour(j, new Date()) ? " aujourdhui" : "") }, [
          el("span", { class: "pl-num", text: String(j.getDate()) })].concat(duJour.map(function (p) {
            return el("a", { href: "#p/" + p.id, class: "pl-evt s-" + p.statut, onclick: ouvrir(p), title: (p.titre || "") + " · " + (St.STATUTS[p.statut] || "") }, [el("i"), p.titre || "Sans titre"]);
          }))));
      }
      var moisPrec = new Date(ref.getFullYear(), ref.getMonth() - 1, 1), moisSuiv = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      corps = el("div", { class: "pl-cal" }, [
        el("div", { class: "pl-cal-nav" }, [el("b", { text: nomMois(moisK) }),
          el("a", { class: "btn-icone", href: lien({ mois: St.iso(moisPrec).slice(0, 7) }), "aria-label": "Mois précédent" }, [St.icone("retour")]),
          el("a", { class: "btn-texte petit", href: lien({ mois: "" }), text: "Aujourd'hui" }),
          el("a", { class: "btn-icone", href: lien({ mois: St.iso(moisSuiv).slice(0, 7) }), "aria-label": "Mois suivant" }, [St.icone("fleche")])]),
        el("div", { class: "pl-cal-tete" }, ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map(function (x) { return el("span", { text: x }); })),
        el("div", { class: "pl-cal-grille" }, cases)]);
    } else {
      // Tableau, groupé par mois (le mois en cours d'abord ouvert), comme un groupe Notion
      var groupes = {};
      pubs.forEach(function (p) { (groupes[moisDe(p)] = groupes[moisDe(p)] || []).push(p); });
      var cles = Object.keys(groupes).sort(function (a, b) { return a === "sans-date" ? 1 : b === "sans-date" ? -1 : a.localeCompare(b); });
      var moisCourant = St.iso(new Date()).slice(0, 7);
      corps = el("div", { class: "pl-tableau", role: "table", "aria-label": titre }, [
        el("div", { class: "pl-ligne pl-tete", role: "row" }, [["Nom", "pl-c-nom"], ["Date", "pl-c-date"], ["Statut", "pl-c-statut"], ["Réseaux", "pl-c-res"], ["Format", "pl-c-format"], ["Légende", "pl-c-leg"]]
          .map(function (x) { return el("span", { class: x[1], role: "columnheader", text: x[0] }); }))].concat(cles.map(function (k) {
          var ferme = k < moisCourant && k !== "sans-date" && !q.statut && !recherche;   // les mois passés repliés par défaut
          var det = el("details", { class: "pl-groupe", open: !ferme }, [el("summary", {}, [el("b", { text: nomMois(k) }), el("small", { text: String(groupes[k].length) })])].concat(groupes[k].map(function (p) {
            var cs = St.commentairesDe(p.id).filter(function (c) { return lili || c.visibilite === "partage"; }).length;
            return el("a", { href: "#p/" + p.id, class: "pl-ligne", role: "row", onclick: ouvrir(p) }, [
              el("span", { class: "pl-c-nom", role: "cell" }, [vignette(p), el("b", { text: p.titre || "Sans titre" }), cs ? el("small", { class: "pl-coms", title: cs + " commentaire" + (cs > 1 ? "s" : "") }, [St.icone("commentaire"), String(cs)]) : null, el("span", { class: "pl-ouvrir", text: "Ouvrir" })]),
              el("span", { class: "pl-c-date", role: "cell", text: dateCourte(p) }),
              el("span", { class: "pl-c-statut", role: "cell" }, [tagStatut(p.statut)]),
              el("span", { class: "pl-c-res", role: "cell" }, tagsReseaux(p)),
              el("span", { class: "pl-c-format", role: "cell" }, [p.format ? etiquette(St.FORMATS[p.format] || p.format, "pl-format") : null]),
              el("span", { class: "pl-c-leg", role: "cell", text: String(p.legende || "").replace(/\s+/g, " ").slice(0, 140) })]);
          })));
          return det;
        })).concat(pubs.length ? [] : [el("p", { class: "pl-vide", text: "Aucune publication ne correspond." })]));
    }
    var page = el("div", { class: "vue-planning" }, [entete, callout, barre, corps]);
    if (q.ouvrir) { var po = St.publication(q.ouvrir); if (po) setTimeout(function () { St.ouvrirCote(po); }, 0); }
    return page;
  };
  // Lili : la rubrique « Planning » d'un client = exactement ce que voit le client
  V.rub_planning = function (r, e) { return V.planning(r, e); };

  // ---------- La page ouverte sur le côté (comme « Ouvrir en aperçu latéral » de Notion) ----------
  var cote = null;
  St.ouvrirCote = function (p) {
    if (cote) cote.remove();
    var lili = St.estLili(), e = St.espace(p.espace_id) || {}, medias = St.mediasDe(p.id), n = 0;
    var fermer = function () { if (!cote) return; cote.classList.remove("ouvert"); var c = cote; cote = null; setTimeout(function () { c.remove(); }, 200); document.removeEventListener("keydown", echap, true); };
    var echap = function (ev) { if (ev.key === "Escape" && !document.querySelector("dialog[open]")) { ev.preventDefault(); ev.stopPropagation(); fermer(); } };
    var image = el("div", { class: "pl-cote-visuel" });
    var peindreImage = function () {
      image.textContent = ""; if (!medias.length) { image.appendChild(el("div", { class: "pl-cote-sansvisuel", text: "Pas encore de visuel" })); return; }
      image.appendChild(St.image(medias[n], { classe: "pl-cote-img", apercu: false, vite: true }));
      if (medias.length > 1) image.appendChild(el("div", { class: "pl-cote-points" }, medias.map(function (_, i) { return el("button", { type: "button", class: i === n ? "actif" : "", "aria-label": "Visuel " + (i + 1), onclick: function () { n = i; peindreImage(); } }); })));
    };
    peindreImage();
    var proprietes = el("dl", { class: "pl-props" }, [
      ["Date", dateCourte(p)], ["Statut", tagStatut(p.statut)], ["Réseaux", el("span", { class: "pl-tags" }, tagsReseaux(p))],
      ["Format", p.format ? etiquette(St.FORMATS[p.format] || p.format, "pl-format") : "—"], lili ? ["Client", e.nom || "—"] : null
    ].filter(Boolean).reduce(function (a, x) { a.push(el("dt", { text: x[0] }), el("dd", {}, [x[1]])); return a; }, []));
    // Répondre (client) : valider ou demander une modification, sans quitter le planning
    var reponse = null;
    if (!lili && p.statut === "a-valider") {
      var motif = el("textarea", { rows: 3, placeholder: "Qu'aimeriez-vous changer ?", "aria-label": "Votre demande de modification" });
      var zoneModif = el("div", { class: "pl-modif", hidden: true }, [motif, el("div", { class: "pl-actions" }, [
        el("button", { type: "button", class: "btn-texte", text: "Annuler", onclick: function () { zoneModif.hidden = true; boutons.hidden = false; } }),
        el("button", { type: "button", class: "btn-plein", text: "Envoyer à Lili", onclick: function () { var t = motif.value.trim(); if (!t) { motif.focus(); return; } St.repondre(p.id, "modifs-demandees", t).then(function () { St.signaler("Demande envoyée à " + ((window.MARQUE || {}).proprietaire || "Lili").split(" ")[0]); fermer(); St.dessiner(false); }); } })])]);
      var boutons = el("div", { class: "pl-actions" }, [
        el("button", { type: "button", class: "btn-plein", onclick: function () { (St.valider ? St.valider(p, function () {}) : St.repondre(p.id, "valide")).then(function () { fermer(); St.dessiner(false); }); } }, [St.icone("valider"), "Valider"]),
        el("button", { type: "button", class: "btn-texte", text: "Demander une modification", onclick: function () { boutons.hidden = true; zoneModif.hidden = false; motif.focus(); } })]);
      reponse = el("section", { class: "pl-reponse" }, [el("p", { text: "Cette publication attend votre réponse." }), boutons, zoneModif]);
    }
    // Commentaires (ceux que le client peut lire), et en écrire un
    var fil = el("div", { class: "pl-fil" });
    var peindreFil = function () {
      fil.textContent = "";
      var cs = St.commentairesDe(p.id).filter(function (c) { return (lili || c.visibilite === "partage") && !c.parent_id; });
      cs.forEach(function (c) {
        var a = St.personne(c.auteur_id) || {};
        fil.appendChild(el("div", { class: "pl-com" + (c.visibilite === "interne" ? " interne" : "") }, [el("small", {}, [el("b", { text: a.nom || "" }), " · " + St.ilya(c.cree_le) + (c.visibilite === "interne" ? " · Lili seule" : "")]), el("p", { text: c.contenu })]));
      });
      if (!cs.length) fil.appendChild(el("p", { class: "pl-vide", text: "Pas encore de commentaire." }));
    };
    peindreFil();
    var saisie = el("textarea", { rows: 2, placeholder: "Ajouter un commentaire…", "aria-label": "Ajouter un commentaire" });
    var envoyerCom = function () {
      var t = saisie.value.trim(); if (!t) return;
      St.creer("commentaires", { publication_id: p.id, cible: "general", contenu: t, visibilite: "partage", resolu: false, version: p.version_courante }).then(function () { saisie.value = ""; peindreFil(); }, function () {});
    };
    saisie.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); envoyerCom(); } });
    cote = el("aside", { class: "pl-cote", role: "dialog", "aria-label": p.titre || "Publication" }, [
      el("div", { class: "pl-cote-barre" }, [
        el("button", { type: "button", class: "btn-icone", "aria-label": "Fermer", title: "Fermer (Échap)", onclick: fermer }, [St.icone("fermer")]),
        el("a", { class: "btn-texte petit", href: "#p/" + p.id, onclick: function () { fermer(); } }, [St.icone("agrandir"), "Ouvrir en pleine page"])]),
      el("div", { class: "pl-cote-corps" }, [
        el("h2", { class: "pl-cote-titre", text: p.titre || "Sans titre" }), proprietes, reponse, image,
        el("h3", { text: "Légende" }), el("p", { class: "pl-legende", text: p.legende || "Légende à venir." }),
        el("h3", { text: "Commentaires" }), fil,
        el("div", { class: "pl-com-saisie" }, [saisie, el("button", { type: "button", class: "btn-plein petit", text: "Envoyer", onclick: envoyerCom })])])]);
    document.body.appendChild(cote);
    requestAnimationFrame(function () { cote.classList.add("ouvert"); });
    document.addEventListener("keydown", echap, true);
    var fermerSiNav = function () { fermer(); window.removeEventListener("hashchange", fermerSiNav); };
    window.addEventListener("hashchange", fermerSiNav);
  };
})(window.Studio);
