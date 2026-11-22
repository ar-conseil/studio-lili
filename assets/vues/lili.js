/* Pages de Lili : Aujourd'hui, page d'un client (présentation et rubriques), liste des publications. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;

  function phraseDuJour(duJour, aValider, modifs) {
    var m = [];
    m.push(duJour.length ? duJour.length + " publication" + (duJour.length > 1 ? "s" : "") + " aujourd'hui" : "Aucune publication aujourd'hui");
    if (aValider.length) m.push(aValider.length + " en attente d'un client");
    if (modifs.length) m.push(modifs.length + " à reprendre");
    return m.join(", ") + ".";
  }

  // ---------- Aujourd'hui ----------
  V.aujourdhui = function () {
    var archives = S.espaces.filter(function (e) { return e.statut === "archive"; }).map(function (e) { return e.id; });
    var pubs = St.publicationsVisibles().filter(function (p) { return archives.indexOf(p.espace_id) < 0; }), maintenant = new Date(), h = maintenant.getHours();   // un espace archivé ne remonte plus
    var duJour = pubs.filter(function (p) { return p.date_prevue && St.memeJour(p.date_prevue, maintenant); }).sort(function (a, b) { return a.date_prevue.localeCompare(b.date_prevue); });
    var aValider = pubs.filter(function (p) { return p.statut === "a-valider"; }).sort(function (a, b) { return String(a.envoye_le).localeCompare(String(b.envoye_le)); });
    var modifs = pubs.filter(function (p) { return p.statut === "modifs-demandees"; });
    // En retard : ce qui était en cours (pas les vieilles idées) et dont la date est passée depuis moins de 30 jours
    var il30 = St.ajouterJours(St.debutJour(maintenant), -30);
    var enRetard = pubs.filter(function (p) { var d = p.date_prevue && new Date(p.date_prevue); return d && d < St.debutJour(maintenant) && d >= il30 && ["en-creation", "a-valider", "modifs-demandees", "valide"].indexOf(p.statut) >= 0; });
    var hier = Date.now() - 36 * 3600000;
    var comms = S.commentaires.filter(function (c) { var a = St.personne(c.auteur_id); return a && a.role !== "proprietaire" && new Date(c.cree_le) > hier; })
      .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    var taches = S.taches.filter(function (t) { return t.statut !== "fait"; }).sort(function (a, b) { return String(a.echeance || "9").localeCompare(String(b.echeance || "9")); });
    var prenom = ((S.moi && S.moi.nom) || "").split(" ")[0];

    var semaine = el("section", { class: "semaine", "aria-label": "Les sept prochains jours" }, Array.from({ length: 7 }, function (_, i) {
      var j = St.ajouterJours(St.debutJour(maintenant), i), ps = pubs.filter(function (p) { return p.date_prevue && St.memeJour(p.date_prevue, j); });
      return el("a", { class: "semaine-jour" + (i === 0 ? " aujourdhui" : ""), href: "#calendrier?vue=semaine&jour=" + St.iso(j) }, [
        el("span", { class: "semaine-nom", text: i === 0 ? "Aujourd'hui" : St.fmt(j, { weekday: "short", day: "numeric" }) }),
        el("span", { class: "semaine-points" }, ps.map(function (p) { var e = St.espace(p.espace_id) || {}; return el("i", { class: "s-" + p.statut, style: { "--c": e.couleur }, title: (e.nom || "") + " · " + (p.titre || "") }); })),
        el("span", { class: "semaine-nb", text: ps.length ? ps.length + " publi." : "" })
      ]);
    }));

    var colGauche = el("div", { class: "pile" }, [
      St.blocBriefDuJour ? St.blocBriefDuJour() : null,
      St.bloc("Publications du jour", duJour.length, duJour.length ? el("div", { class: "liste-pubs" }, duJour.map(function (p) { return St.lignePublication(p); }))
        : St.vide("Rien n'est prévu aujourd'hui.", el("button", { type: "button", class: "btn-texte", text: "Prévoir une publication", onclick: function () { St.nouvellePublication(null, new Date()); } }))),
      modifs.length ? St.bloc("Modifications demandées", modifs.length, el("div", { class: "liste-pubs" }, modifs.map(function (p) {
        var dernier = St.commentairesDe(p.id).filter(function (c) { return c.visibilite === "partage"; }).pop();
        return St.lignePublication(p, el("span", { class: "extrait", text: dernier ? "« " + dernier.contenu.slice(0, 60) + (dernier.contenu.length > 60 ? "…" : "") + " »" : "" }));
      })), { classe: "alerte" }) : null,
      enRetard.length ? St.bloc("En retard", enRetard.length, el("div", { class: "liste-pubs" }, enRetard.map(function (p) {
        return St.lignePublication(p, el("span", { class: "retard", text: St.quand(p.date_prevue) }));
      }))) : null
    ]);
    // Agenda : les rendez-vous d'aujourd'hui et des 7 prochains jours
    var dans7 = St.ajouterJours(St.debutJour(maintenant), 8);
    var rdvs = (S.rdv || []).filter(function (r) { return new Date(r.fin || r.debut) >= maintenant && new Date(r.debut) < dans7; }).sort(function (a, b) { return String(a.debut).localeCompare(String(b.debut)); });
    var blocAgenda = St.bloc("Agenda", rdvs.length, rdvs.length ? el("ul", { class: "agenda" }, rdvs.slice(0, 6).map(function (r) {
      var e = r.espace_id && St.espace(r.espace_id);
      return el("li", {}, [el("button", { type: "button", onclick: function () { St.editerRdv(r); } }, [
        el("span", { class: "agenda-quand" }, [el("b", { text: St.memeJour(r.debut, maintenant) ? "Aujourd'hui" : St.fmt(r.debut, { weekday: "short", day: "numeric" }) }), el("small", { text: St.libelleRdv(r) })]),
        el("span", { class: "agenda-quoi" }, [el("b", { text: r.titre }), el("small", { text: [e && e.nom, r.lieu].filter(Boolean).join(" · ") })])])]);
    })) : el("p", { class: "vide" }, ["Aucun rendez-vous cette semaine. ", el("button", { type: "button", class: "btn-texte petit", text: "En ajouter un", onclick: function () { St.editerRdv(); } })]));
    var colDroite = el("div", { class: "pile" }, [
      blocAgenda,
      St.bloc("En attente des clients", aValider.length, aValider.length ? el("ul", { class: "attente" }, aValider.map(function (p) {
        var e = St.espace(p.espace_id) || {};
        return el("li", {}, [el("a", { href: "#p/" + p.id }, [St.logoEspace(e, "petit"), el("span", {}, [el("b", { text: p.titre || "Sans titre" }), el("small", { text: e.nom + " · envoyé " + (p.envoye_le ? St.ilya(p.envoye_le) : "") })])])]);
      })) : St.vide("Aucune publication n'attend de réponse.")),
      St.bloc("Commentaires depuis hier", comms.length, comms.length ? el("ul", { class: "commentaires-recents" }, comms.slice(0, 6).map(function (c) {
        var p = St.publication(c.publication_id) || {}, a = St.personne(c.auteur_id) || {}, e = St.espace(p.espace_id) || {}, m = St.mediasDe(p.id)[0];
        return el("li", {}, [el("a", { href: "#p/" + p.id }, [m ? St.image(m) : St.logoEspace(e, "petit"), el("span", {}, [el("q", { text: c.contenu }), el("small", {}, [el("b", { text: a.nom || "" }), " · " + e.nom + " · " + St.ilya(c.cree_le)])])])]);
      })) : St.vide("Pas de nouveau commentaire.")),
      St.bloc("À faire", taches.length, taches.length ? el("ul", { class: "taches" }, taches.slice(0, 8).map(function (t) {
        var e = t.espace_id && St.espace(t.espace_id), retard = t.echeance && t.echeance < St.iso(maintenant);
        return el("li", { class: retard ? "retard" : "" }, [
          el("input", { type: "checkbox", class: "coche", "aria-label": "Terminer : " + t.titre, onchange: function () { St.maj("taches", t.id, { statut: "fait", fait_le: new Date().toISOString() }).then(function () { St.dessiner(false); }); } }),
          el("span", {}, [t.titre, e ? el("small", { text: " · " + e.nom }) : null]),
          el("small", { class: "echeance", text: t.echeance ? St.quand(t.echeance + "T12:00:00") : "" })
        ]);
      })) : St.vide("Tout est fait."))
    ]);

    var nbArch = S.espaces.filter(function (e) { return e.statut === "archive"; }).length;
    var cartes = el("section", { class: "clients-cartes" }, [el("div", { class: "titre-ligne" }, [el("h2", { text: "Mes clients" }),
      el("a", { class: "btn-texte", href: "#clients" }, [St.icone("personnes"), "Tous les clients" + (nbArch ? " (" + nbArch + " archivé" + (nbArch > 1 ? "s" : "") + ")" : "")])]),
      el("div", { class: "cartes" }, St.espacesActifs().map(function (e) {
      var av = St.avance(e.id), couv = St.urlEspace(e, "couverture_path"), aV = pubs.filter(function (p) { return p.espace_id === e.id && p.statut === "a-valider"; }).length;
      return el("a", { class: "carte-client", href: "#" + e.slug, style: { "--c": e.couleur } }, [
        el("div", { class: "carte-client-couv" }, [couv ? el("img", { src: couv, alt: "", loading: "lazy" }) : null]),
        el("div", { class: "carte-client-texte" }, [St.logoEspace(e), el("b", { text: e.nom }), el("small", { text: [e.metier, (e.reseaux || []).map(function (r) { return (St.RESEAUX[r] || {}).nom; }).join(", ")].filter(Boolean).join(" · ") }),
          el("span", { class: "avance a-" + av.niveau, text: av.texte }), aV ? el("span", { class: "a-valider-nb", text: aV + " à valider" }) : null])
      ]);
    }).concat([el("button", { type: "button", class: "carte-client carte-nouveau", onclick: function () { St.nouveauClient(); } }, [St.icone("plus"), el("b", { text: "Nouveau client" }), el("small", { text: "Créer l'espace d'une marque" })])]))]);

    return el("div", { class: "vue-aujourdhui" }, [
      St.entete(St.fmt(maintenant, { weekday: "long", day: "numeric", month: "long" }), (h < 5 || h >= 18 ? "Bonsoir" : "Bonjour") + (prenom ? " " + prenom : ""), phraseDuJour(duJour, aValider, modifs)),
      semaine,
      el("div", { class: "grille-aujourdhui" }, [colGauche, colDroite]),
      cartes
    ]);
  };

  // ---------- Sommaire d'un client : quatre « unes » vivantes, puis le dossier en table des matières ----------
  var COULEURS_STATUT = { "idee": "#8A78B5", "en-creation": "#B98A52", "a-valider": "#A9553A", "modifs-demandees": "#C4513F", "valide": "#3F8A66", "programme": "#3F78AE", "publie": "#A8A29A" };
  function sommaire(e, pubs, prochaines) {
    var base = "#" + e.slug + "/", rubs = St.rubriquesClient();
    var a = function (id) { return rubs.some(function (x) { return x.id === id; }); };
    var une = function (id, titre, corps, pied) {
      return el("a", { class: "som-une som-" + id, href: base + id }, [
        el("span", { class: "som-sur" }, [el("span", { text: titre }), St.icone("fleche", "som-fleche")]), corps, pied ? el("small", { class: "som-pied", text: pied }) : null]);
    };
    // Calendrier : la prochaine date, en grand
    var p0 = prochaines[0], d0 = p0 && new Date(p0.date_prevue);
    var calendrier = une("calendrier", "Calendrier", p0 ? el("div", { class: "som-date" }, [
      el("b", { text: String(d0.getDate()) }),
      el("span", {}, [el("i", { text: St.fmt(d0, { weekday: "long" }) }), el("em", { text: St.fmt(d0, { month: "long" }) + " · " + St.hm(p0.date_prevue) })])
    ]) : el("div", { class: "som-date vide" }, [el("b", { text: "—" })]), p0 ? (p0.titre || "Sans titre") : "Rien de prévu pour l'instant");
    // Publications : le total et la répartition par statut
    var actives = pubs.filter(function (p) { return !p.corbeille_le; });
    var parts = St.ORDRE_STATUTS.map(function (st) { return [st, actives.filter(function (p) { return p.statut === st; }).length]; }).filter(function (x) { return x[1]; });
    var enCours = parts.filter(function (x) { return x[0] !== "publie"; });
    var publications = une("publications", "Publications", el("div", { class: "som-pubs" }, [
      el("b", { class: "som-nombre", text: String(actives.length) }),
      el("div", { class: "som-barre", role: "img", "aria-label": parts.map(function (x) { return x[1] + " " + St.STATUTS[x[0]]; }).join(", ") }, parts.map(function (x) { return el("i", { style: { "flex-grow": String(x[1]), background: COULEURS_STATUT[x[0]] } }); })),
      el("ul", { class: "som-legende" }, (enCours.length ? enCours : parts).slice(0, 4).map(function (x) { return el("li", {}, [el("i", { style: { background: COULEURS_STATUT[x[0]] } }), el("b", { text: String(x[1]) }), " " + St.STATUTS[x[0]].toLowerCase()]); }))
    ]));
    // Planning : les prochaines lignes, comme le client les voit
    var lignes = prochaines.filter(function (p) { return p.visibilite === "partage"; }).slice(0, 3);
    var planning = a("planning") ? une("planning", "Planning", el("div", { class: "som-lignes" }, lignes.length ? lignes.map(function (p) {
      return el("span", {}, [el("i", { style: { background: COULEURS_STATUT[p.statut] } }), el("b", { text: p.titre || "Sans titre" }), el("em", { text: St.fmt(p.date_prevue, { day: "numeric", month: "short" }) })]);
    }) : [el("p", { class: "som-rien", text: "Rien de partagé à venir" })]), "Ce que voit le client") : null;
    // Médiathèque : les derniers visuels
    var medias = S.medias.filter(function (m) { return m.espace_id === e.id && !m.corbeille_le; });
    var derniers = medias.filter(function (m) { return m.type !== "video" || m.apercu_chemin; }).sort(function (x, y) { return String(y.cree_le).localeCompare(String(x.cree_le)); }).slice(0, 4);
    var mediatheque = une("mediatheque", "Médiathèque", el("div", { class: "som-mosaique n" + derniers.length }, derniers.length ? derniers.map(function (m) { return St.image(m, { classe: "som-img" }); })
      : [el("p", { class: "som-rien", text: "Aucun fichier" })]), medias.length + " fichier" + (medias.length > 1 ? "s" : ""));
    // Le dossier : table des matières numérotée
    var dossier = rubs.filter(function (x) { return ["calendrier", "publications", "planning", "mediatheque"].indexOf(x.id) < 0; });
    var AFAIRE = { "À rédiger": 1, "Inviter le client": 1 }, INTERNES = { facturation: 1, notes: 1 };
    return el("nav", { class: "sommaire", "aria-label": "Rubriques de " + e.nom }, [
      el("div", { class: "som-unes" }, [calendrier, publications, planning, mediatheque].filter(Boolean)),
      el("div", { class: "som-dossier" }, [
        el("h2", {}, [el("span", { text: "Le dossier" }), el("small", { text: e.nom })]),
        el("ol", {}, dossier.map(function (x, i) {
          var resume = St.resumes && St.resumes[x.id] ? St.resumes[x.id](e) : "";
          return el("li", {}, [el("a", { href: base + x.id }, [
            el("i", { class: "som-no", text: (i < 9 ? "0" : "") + (i + 1) }),
            el("b", {}, [x.nom.replace(/ \(.*\)$/, ""), INTERNES[x.id] ? St.icone("cadenas", "som-cadenas") : null]),
            el("span", { class: "som-points", "aria-hidden": "true" }),
            el("small", { class: AFAIRE[resume] ? "a-faire" : "", text: resume }),
            St.icone("fleche", "som-fleche")])]);
        }))
      ])
    ]);
  }

  // ---------- Page d'un client : présentation (#slug) et rubriques (#slug/calendrier …) ----------
  V.client = function (r, e) {
    if (r.rubrique) {
      var rub = St.rubriquesClient().filter(function (x) { return x.id === r.rubrique; })[0];
      if (!rub) { St.aller(e.slug); return el("div"); }
      var corps = rub.id === "calendrier" ? V.calendrier(r, e) : rub.id === "publications" ? V.publications(r, e) : rub.id === "mediatheque" ? V.mediatheque(r, e) : V["rub_" + rub.id](r, e);
      return el("div", { class: "vue-rubrique", style: { "--c": e.couleur } }, [
        el("header", { class: "entete-rubrique" }, [
          el("a", { class: "retour-client", href: "#" + e.slug, title: "Retour à la présentation (Échap)" }, [St.icone("retour"), St.logoEspace(e, "petit"), el("span", { text: e.nom })]),
          el("nav", { class: "mini-menu", "aria-label": "Rubriques" }, St.rubriquesClient().map(function (x) {
            return el("a", { href: "#" + e.slug + "/" + x.id, "aria-current": x.id === rub.id ? "page" : null }, [St.icone(x.icone), x.nom]);
          }))
        ]),
        corps
      ]);
    }
    var pubs = St.publicationsVisibles().filter(function (p) { return p.espace_id === e.id; }), av = St.avance(e.id), pr = St.prive(e.id);
    var debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    var finMois = new Date(debutMois); finMois.setMonth(finMois.getMonth() + 1);
    var duMois = pubs.filter(function (p) { return p.date_prevue && new Date(p.date_prevue) >= debutMois && new Date(p.date_prevue) < finMois; });
    var couv = St.urlEspace(e, "couverture_path"), membres = S.membres.filter(function (m) { return m.espace_id === e.id; });
    var chiffres = [
      ["Ce mois", duMois.length, "publication" + (duMois.length > 1 ? "s" : "") + " prévues"],
      ["À valider", pubs.filter(function (p) { return p.statut === "a-valider"; }).length, "chez le client"],
      ["À reprendre", pubs.filter(function (p) { return p.statut === "modifs-demandees"; }).length, "modifications demandées"],
      ["Avance", av.jours == null ? "—" : av.jours + " j", av.jusque ? "jusqu'au " + St.fmt(av.jusque, { day: "numeric", month: "long" }) : "rien de programmé", "a-" + av.niveau]
    ];
    if (pr.forfait_mensuel_ht) chiffres.push(["Forfait", new Intl.NumberFormat("fr-FR").format(pr.forfait_mensuel_ht) + " €", "HT par mois"]);
    var prochaines = pubs.filter(function (p) { return p.date_prevue && new Date(p.date_prevue) >= St.debutJour(new Date()); }).sort(function (a, b) { return a.date_prevue.localeCompare(b.date_prevue); }).slice(0, 4);
    return el("div", { class: "vue-client", style: { "--c": e.couleur } }, [
      el("div", { class: "couverture" }, [couv ? el("img", { src: couv, alt: "" }) : null]),
      el("header", { class: "entete-client" }, [St.logoEspace(e, "grand"), el("div", {}, [el("p", { class: "surtitre", text: [e.metier, (e.reseaux || []).map(function (x) { return (St.RESEAUX[x] || {}).nom; }).join(" · ")].filter(Boolean).join(" · ") }), el("h1", { class: "titre-page", text: e.nom }),
        el("p", { class: "phrase", text: membres.length ? "Avec " + membres.map(function (m) { var p = St.personne(m.personne_id) || {}; return p.nom + (m.fonction ? " (" + m.fonction.toLowerCase() + ")" : ""); }).join(", ") : "Aucun membre invité pour l'instant." }, membres.length ? [] : [" ", el("a", { href: "#" + e.slug + "/equipe", text: "Inviter le client" })])]),
        el("div", { class: "entete-actions" }, [el("button", { type: "button", class: "btn-texte", onclick: function () { St.editerEspace(e); } }, [St.icone("reglages"), "Fiche"]),
          el("button", { type: "button", class: "btn-plein", onclick: function () { St.nouvellePublication(e.id); } }, [St.icone("plus"), "Nouvelle publication"])])]),
      el("div", { class: "chiffres" }, chiffres.map(function (c) { return el("div", { class: "chiffre " + (c[3] || "") }, [el("span", { text: c[0] }), el("b", { text: String(c[1]) }), el("small", { text: c[2] })]); })),
      sommaire(e, pubs, prochaines),
      prochaines.length ? el("section", { class: "a-venir" }, [el("h2", { text: "À venir" }), el("div", { class: "grille-cartes" }, prochaines.map(function (p) { return St.cartePublication(p, { sansClient: true }); }))]) : null
    ]);
  };

  // ---------- Publications : toutes, ou celles d'un client ----------
  V.publications = function (r, eForce) {
    var filtre = (r.query && r.query.statut) || "actives", eId = eForce ? eForce.id : (r.query && r.query.client) || "";
    var pubs = St.publicationsVisibles().filter(function (p) { return !eId || p.espace_id === eId; });
    var compte = function (f) { return pubs.filter(f).length; };
    var groupes = St.estLili()
      ? [["actives", "En cours", function (p) { return p.statut !== "publie"; }], ["idee", "Idées"], ["en-creation", "En création"], ["a-valider", "À valider"], ["modifs-demandees", "À reprendre"], ["valide", "Validées"], ["programme", "Programmées"], ["publie", "Publiées"]]
      : [["actives", "En cours", function (p) { return p.statut !== "publie"; }], ["a-valider", "À valider"], ["valide", "Validées"], ["programme", "Programmées"], ["publie", "Publiées"], ["idee", "Mes idées"]];
    var g = groupes.filter(function (x) { return x[0] === filtre; })[0] || groupes[0], test = g[2] || function (p) { return p.statut === g[0]; };
    var liste = pubs.filter(test).sort(function (a, b) { return String(a.date_prevue || "9999").localeCompare(String(b.date_prevue || "9999")); });
    var base = eForce ? "#" + eForce.slug + "/publications" : "#publications";
    var chips = el("nav", { class: "puces-filtre", "aria-label": "Filtrer par statut" }, groupes.map(function (x) {
      var n = compte(x[2] || function (p) { return p.statut === x[0]; });
      return el("a", { href: base + "?statut=" + x[0] + (eId && !eForce ? "&client=" + eId : ""), class: "puce" + (x[0] === g[0] ? " active" : ""), "aria-current": x[0] === g[0] ? "true" : null }, [x[1], el("span", { text: String(n) })]);
    }));
    var choixClient = !eForce && St.estLili() ? el("select", { class: "choix-client", "aria-label": "Client", onchange: function (ev) { St.aller("publications?statut=" + g[0] + (ev.target.value ? "&client=" + ev.target.value : "")); } },
      [el("option", { value: "", text: "Tous les clients" })].concat(St.espacesActifs().map(function (e) { return el("option", { value: e.id, selected: e.id === eId, text: e.nom }); }))) : null;
    var actions = [choixClient, St.estLili() ? el("button", { type: "button", class: "btn-plein", onclick: function () { St.nouvellePublication(eId || null); } }, [St.icone("plus"), "Nouvelle"]) : null,
      !St.estLili() ? el("button", { type: "button", class: "btn-texte", onclick: function () { proposerIdee(); } }, [St.icone("plus"), "Proposer une idée"]) : null];
    return el("div", { class: "vue-publications" }, [
      eForce ? null : St.entete(null, "Publications", null, actions),
      eForce ? el("div", { class: "barre-outils" }, actions) : null,
      chips,
      liste.length ? el("div", { class: "grille-cartes" }, liste.map(function (p) { return St.cartePublication(p, { sansClient: !!eForce || !St.estLili() }); }))
        : St.vide(g[0] === "a-valider" ? "Aucune publication n'attend de validation." : "Aucune publication ici.")
    ]);
  };
  // Un client propose une idée : publication « idée » à son nom, visible de lui et de Lili
  function proposerIdee() {
    var e = St.espacesClient()[0]; if (!e) return;
    var titre = el("input", { type: "text", placeholder: "Votre idée en une phrase", maxlength: 140 }), detail = el("textarea", { rows: 4, placeholder: "Quelques mots de plus (facultatif)" });
    St.fenetre({ titre: "Proposer une idée", sous: "Lili la reçoit et vous dira comment la mettre en forme.", corps: [titre, detail], actions: [{ texte: "Annuler" }, { texte: "Envoyer l'idée", principal: true, action: function (fermer) {
      if (!titre.value.trim()) { titre.focus(); return; }
      St.creer("publications", { espace_id: e.id, titre: titre.value.trim(), legende: detail.value.trim(), statut: "idee", visibilite: "partage", auteur_id: S.moi.id, reseaux: (e.reseaux || []).slice(0, 1), format: "post", hashtags: [], mentions: [], etapes: [], etiquettes: [] })
        .then(function () { fermer(); St.signaler("Idée envoyée à Lili"); St.dessiner(false); });
    } }] });
  }
  St.proposerIdee = proposerIdee;
})(window.Studio);
