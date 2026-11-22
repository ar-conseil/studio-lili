/* Calendrier éditorial : mois, semaine, jour ou liste ; tous les clients ou un seul ; publications glissées d'un jour à l'autre
   (souris, ou appui long au doigt) ; en fond : jours fériés, temps forts commerciaux, opérations et absences du client.
   Adresse : #calendrier?vue=mois|semaine|jour|liste&jour=AAAA-MM-JJ&client=<id>  (ou #<client>/calendrier) ; ← → période, T aujourd'hui. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;

  // ---------- Jours fériés et temps forts commerciaux (calculés pour n'importe quelle année) ----------
  function paques(a) {
    var b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3),
      i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451),
      mois = Math.floor((i + m - 7 * n + 114) / 31), jour = ((i + m - 7 * n + 114) % 31) + 1;
    return new Date(a, mois - 1, jour);
  }
  function nieme(a, mois, jourSemaine, rang) { // rang 1..4, ou -1 pour le dernier
    if (rang > 0) { var d = new Date(a, mois, 1); while (d.getDay() !== jourSemaine) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + 7 * (rang - 1)); return d; }
    var f = new Date(a, mois + 1, 0); while (f.getDay() !== jourSemaine) f.setDate(f.getDate() - 1); return f;
  }
  var cacheAnnee = {};
  function reperesAnnee(a) {
    if (cacheAnnee[a]) return cacheAnnee[a];
    var P = paques(a), j = function (m, d) { return new Date(a, m, d); }, plus = function (d, n) { return St.ajouterJours(d, n); };
    var feries = [[j(0, 1), "Jour de l'an"], [plus(P, 1), "Lundi de Pâques"], [j(4, 1), "Fête du travail"], [j(4, 8), "Victoire 1945"], [plus(P, 39), "Ascension"],
      [plus(P, 50), "Lundi de Pentecôte"], [j(6, 14), "Fête nationale"], [j(7, 15), "Assomption"], [j(10, 1), "Toussaint"], [j(10, 11), "Armistice"], [j(11, 25), "Noël"]];
    var meres = nieme(a, 4, 0, -1); if (St.memeJour(meres, plus(P, 49))) meres = plus(meres, 7);
    var soldesHiver = nieme(a, 0, 3, 2), soldesEte = nieme(a, 5, 3, -1), blackFriday = plus(nieme(a, 10, 4, 4), 1);
    var forts = [[j(0, 6), "Épiphanie"], [j(1, 2), "Chandeleur"], [j(1, 14), "Saint-Valentin"], [nieme(a, 2, 0, 1), "Fête des grands-mères"], [j(2, 8), "Journée des droits des femmes"],
      [P, "Pâques"], [meres, "Fête des mères"], [nieme(a, 5, 0, 3), "Fête des pères"], [j(5, 21), "Fête de la musique"], [nieme(a, 8, 1, 1), "Rentrée"],
      [j(9, 31), "Halloween"], [blackFriday, "Black Friday"], [plus(blackFriday, 3), "Cyber Monday"], [j(11, 24), "Réveillon de Noël"], [j(11, 31), "Saint-Sylvestre"]];
    var periodes = [[soldesHiver, plus(soldesHiver, 27), "Soldes d'hiver"], [soldesEte, plus(soldesEte, 27), "Soldes d'été"], [j(11, 1), j(11, 24), "Avent"]];
    var r = { feries: {}, forts: {}, periodes: periodes };
    feries.forEach(function (x) { r.feries[St.iso(x[0])] = x[1]; });
    forts.forEach(function (x) { var k = St.iso(x[0]); r.forts[k] = (r.forts[k] ? r.forts[k] + " · " : "") + x[1]; });
    return (cacheAnnee[a] = r);
  }
  function reperesJour(d, espaceId) {
    var k = St.iso(d), r = reperesAnnee(d.getFullYear()), res = { ferie: r.feries[k], forts: [], bandes: [] };
    if (r.forts[k]) res.forts.push(r.forts[k]);
    r.periodes.forEach(function (p) { if (d >= St.debutJour(p[0]) && d <= p[1]) res.bandes.push({ libelle: p[2], type: "commercial" }); });
    S.tempsForts.forEach(function (t) {
      if (espaceId && t.espace_id && t.espace_id !== espaceId) return;
      if (k >= t.debut && k <= (t.fin || t.debut)) res.bandes.push({ libelle: t.libelle + (t.espace_id && !espaceId ? " · " + ((St.espace(t.espace_id) || {}).nom || "") : ""), type: t.type, c: t.espace_id && (St.espace(t.espace_id) || {}).couleur });
    });
    S.operations.forEach(function (o) {
      if (espaceId && o.espace_id !== espaceId) return;
      if (o.debut && k >= o.debut && k <= (o.fin || o.debut)) res.bandes.push({ libelle: o.libelle, type: "operation", c: o.couleur || (St.espace(o.espace_id) || {}).couleur });
    });
    return res;
  }

  // ---------- Glisser une publication d'un jour à l'autre ----------
  function activerGlisser(carte, p) {
    if (!St.estLili()) return;
    carte.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      var x0 = ev.clientX, y0 = ev.clientY, tactile = ev.pointerType !== "mouse", g = null, minuterie = null;
      function demarrer(x, y) {
        var r = carte.getBoundingClientRect();
        g = St.X.glisse = { dx: x - r.left, dy: y - r.top, cible: null, fantome: carte.cloneNode(true) };
        g.fantome.classList.add("fantome"); g.fantome.style.width = r.width + "px"; document.body.appendChild(g.fantome);
        carte.classList.add("glissee"); document.documentElement.classList.add("en-glisse");
        if (tactile && navigator.vibrate) navigator.vibrate(8);
        placer(x, y);
      }
      function placer(x, y) {
        g.fantome.style.transform = "translate3d(" + (x - g.dx) + "px," + (y - g.dy) + "px,0) rotate(2deg)";
        var sous = document.elementFromPoint(x, y), jour = sous && sous.closest("[data-jour]");
        if (jour !== g.cible) { if (g.cible) g.cible.classList.remove("survol"); g.cible = jour; if (jour) jour.classList.add("survol"); }
        if (y < 60) window.scrollBy(0, -12); else if (y > innerHeight - 60) window.scrollBy(0, 12);
      }
      function bouger(e) {
        if (g) { e.preventDefault(); placer(e.clientX, e.clientY); return; }
        var d = Math.hypot(e.clientX - x0, e.clientY - y0);
        if (tactile) { if (d > 10) fin(); } else if (d > 5) demarrer(e.clientX, e.clientY);
      }
      function lacher() {
        var cible = g && g.cible, avait = !!g; fin();
        if (!avait) return;
        St.X.finGlisse = Date.now();
        if (!cible) return;
        var nouveau = new Date(cible.dataset.jour + "T12:00:00"), ancien = p.date_prevue ? new Date(p.date_prevue) : null;
        if (ancien) nouveau.setHours(ancien.getHours(), ancien.getMinutes(), 0, 0);
        else { var h = St.HEURES[(p.reseaux || [])[0]] || "12:30"; nouveau.setHours(+h.slice(0, 2), +h.slice(3), 0, 0); }
        if (ancien && St.memeJour(ancien, nouveau)) return;
        St.maj("publications", p.id, { date_prevue: nouveau.toISOString() }).then(function () { St.signaler("« " + (p.titre || "Sans titre") + " » déplacée au " + St.fmt(nouveau, { weekday: "long", day: "numeric", month: "long" })); St.dessiner(false); });
        St.dessiner(false);
      }
      function fin() {
        clearTimeout(minuterie);
        document.removeEventListener("pointermove", bouger); document.removeEventListener("pointerup", lacher); document.removeEventListener("pointercancel", fin);
        if (g) { g.fantome.remove(); carte.classList.remove("glissee"); document.documentElement.classList.remove("en-glisse"); if (g.cible) g.cible.classList.remove("survol"); }
        g = St.X.glisse = null;
      }
      if (tactile) minuterie = setTimeout(function () { demarrer(x0, y0); }, 280);
      document.addEventListener("pointermove", bouger, { passive: false });
      document.addEventListener("pointerup", lacher); document.addEventListener("pointercancel", fin);
    });
    carte.addEventListener("click", function (ev) { if (St.X.finGlisse && Date.now() - St.X.finGlisse < 300) ev.preventDefault(); });
  }
  document.addEventListener("touchmove", function (e) { if (St.X.glisse) e.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", function (e) { if (St.X.glisse) e.preventDefault(); });

  function puceCal(p, avecClient) {
    var e = St.espace(p.espace_id) || {}, m = St.mediasDe(p.id)[0];
    var a = el("a", { class: "puce-cal s-" + p.statut, href: "#p/" + p.id, style: { "--c": e.couleur }, title: (e.nom ? e.nom + " · " : "") + (p.titre || "Sans titre") + " · " + St.STATUTS[p.statut], draggable: "false" }, [
      m ? St.image(m, { classe: "puce-cal-img" }) : el("span", { class: "puce-cal-img vide" }),
      el("span", { class: "puce-cal-texte" }, [el("b", { text: (p.date_prevue ? St.hm(p.date_prevue) + " " : "") + (p.titre || "Sans titre") }),
        el("small", {}, [St.pastillesReseaux(p.reseaux), avecClient ? " " + (e.nom || "") : " " + (St.FORMATS[p.format] || "")])]),
      el("i", { class: "puce-cal-statut", "aria-hidden": "true" })
    ]);
    activerGlisser(a, p);
    return a;
  }

  // ---------- La page ----------
  var etat = { ref: null }, lienJour = null;
  V.calendrier = function (r, eForce) {
    var q = r.query || {}, etroit = matchMedia("(max-width: 760px)").matches;
    var vue = q.vue || (etroit ? "liste" : "mois"), ref = q.jour ? new Date(q.jour + "T12:00:00") : new Date();
    var eId = eForce ? eForce.id : (!St.estLili() ? (St.espacesClient()[0] || {}).id : q.client || "");
    var base = eForce ? eForce.slug + "/calendrier" : "calendrier";
    var lien = function (o) { var x = Object.assign({ vue: vue, jour: St.iso(ref), client: eForce ? "" : eId }, o); return base + "?vue=" + x.vue + "&jour=" + x.jour + (x.client && St.estLili() && !eForce ? "&client=" + x.client : ""); };
    var pubs = St.publicationsVisibles().filter(function (p) { return p.date_prevue && (!eId || p.espace_id === eId); });
    var parJour = {}; pubs.forEach(function (p) { var k = St.iso(p.date_prevue); (parJour[k] = parJour[k] || []).push(p); });
    Object.keys(parJour).forEach(function (k) { parJour[k].sort(function (a, b) { return a.date_prevue.localeCompare(b.date_prevue); }); });
    var sansDate = St.publicationsVisibles().filter(function (p) { return !p.date_prevue && (!eId || p.espace_id === eId) && p.statut !== "publie"; });

    lienJour = function (k) { return lien({ vue: "jour", jour: k }); };
    var titre, corps, precedent, suivant;
    if (vue === "mois") {
      var d1 = new Date(ref.getFullYear(), ref.getMonth(), 1), debut = St.lundi(d1);
      titre = St.fmt(d1, { month: "long", year: "numeric" });
      precedent = new Date(ref.getFullYear(), ref.getMonth() - 1, 1); suivant = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      var cases = [];
      for (var i = 0; i < 42; i++) {
        var j = St.ajouterJours(debut, i); if (i === 35 && j.getMonth() !== ref.getMonth()) break;
        cases.push(caseJour(j, parJour[St.iso(j)] || [], j.getMonth() !== ref.getMonth(), eId, 4));
      }
      corps = el("div", { class: "cal-mois" }, [el("div", { class: "cal-entete" }, ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map(function (x) { return el("span", { text: x }); }))].concat([el("div", { class: "cal-grille" }, cases)]));
    } else if (vue === "semaine") {
      var l = St.lundi(ref); titre = "Semaine du " + St.fmt(l, { day: "numeric", month: "long" });
      precedent = St.ajouterJours(ref, -7); suivant = St.ajouterJours(ref, 7);
      corps = el("div", { class: "cal-semaine" }, Array.from({ length: 7 }, function (_, k) { var j = St.ajouterJours(l, k); return caseJour(j, parJour[St.iso(j)] || [], false, eId, 99, true); }));
    } else if (vue === "jour") {
      // Une journée, heure par heure : rendez-vous et publications à leur heure, ligne de l'heure qu'il est
      var jr = St.debutJour(ref), kj = St.iso(jr), repJ = reperesJour(jr, eId), estAuj = St.memeJour(jr, new Date());
      titre = St.fmt(jr, { weekday: "long", day: "numeric", month: "long" }); titre = titre.charAt(0).toUpperCase() + titre.slice(1);
      precedent = St.ajouterJours(jr, -1); suivant = St.ajouterJours(jr, 1);
      var psJ = parJour[kj] || [], rdvs = St.estLili() ? St.rdvDu(jr).filter(function (x) { return !eId || x.espace_id === eId; }) : [];
      var heures = psJ.map(function (p) { return new Date(p.date_prevue).getHours(); }).concat(rdvs.map(function (x) { return new Date(x.debut).getHours(); }));
      var hMin = Math.min.apply(null, [8].concat(heures)), hMax = Math.max.apply(null, [19].concat(heures)), mnt = new Date();
      var rangees = [];
      for (var hh = hMin; hh <= hMax; hh++) (function (h) {
        var pubsH = psJ.filter(function (p) { return new Date(p.date_prevue).getHours() === h; }), rdvH = rdvs.filter(function (x) { return new Date(x.debut).getHours() === h; });
        var plein = pubsH.length || rdvH.length, ici = estAuj && mnt.getHours() === h;
        rangees.push(el("div", { class: "cj-heure" + (plein ? " plein" : "") + (ici ? " maintenant" : "") }, [
          el("span", { class: "cj-h", text: (h < 10 ? "0" : "") + h + ":00" }),
          el("div", { class: "cj-contenu" }, [
            ici ? el("i", { class: "cj-ligne", style: { top: Math.round(mnt.getMinutes() / 60 * 100) + "%" }, "aria-label": "Maintenant, " + St.hm(mnt) }) : null,
            rdvH.length ? el("div", { class: "cj-rdvs" }, rdvH.map(function (x) {
              var ex = St.espace(x.espace_id);
              return el("button", { type: "button", class: "cj-rdv", style: ex ? { "--c": ex.couleur } : null, onclick: function () { St.editerRdv(x); } }, [
                el("b", { text: St.libelleRdv(x) }), el("span", { text: x.titre }), el("small", { text: [ex && ex.nom, x.lieu].filter(Boolean).join(" · ") })]);
            })) : null,
            pubsH.length ? el("div", { class: "cj-pubs" }, pubsH.map(function (p) {
              var ep = St.espace(p.espace_id) || {}, m = St.mediasDe(p.id)[0];
              return el("a", { class: "cj-pub", href: "#p/" + p.id, style: { "--c": ep.couleur } }, [
                m ? St.image(m, { classe: "cj-pub-img" }) : el("span", { class: "cj-pub-img vide" }, [St.icone("publications")]),
                el("span", { class: "cj-pub-texte" }, [el("small", {}, [el("b", { text: St.hm(p.date_prevue) }), !eId && ep.nom ? " · " + ep.nom : ""]),
                  el("b", { text: p.titre || "Sans titre" }), el("small", {}, [St.pastillesReseaux(p.reseaux), " " + (St.FORMATS[p.format] || "")])]),
                el("span", { class: "pl-tag pl-statut s-" + p.statut }, [el("i"), St.STATUTS[p.statut] || p.statut])]);
            })) : null
          ])
        ]));
      })(hh);
      var compte = [psJ.length ? psJ.length + " publication" + (psJ.length > 1 ? "s" : "") : null, rdvs.length ? rdvs.length + " rendez-vous" : null].filter(Boolean).join(" · ") || "Journée libre";
      corps = el("div", { class: "cal-jour-vue", "data-jour": kj }, [
        el("aside", { class: "cj-tete" + (estAuj ? " aujourdhui" : "") }, [
          el("span", { class: "cj-semaine", text: St.fmt(jr, { weekday: "long" }) }),
          el("b", { class: "cj-num", text: String(jr.getDate()) }),
          el("span", { class: "cj-mois", text: St.fmt(jr, { month: "long", year: "numeric" }) }),
          el("p", { class: "cj-compte", text: compte }),
          repJ.ferie ? el("span", { class: "ferie", text: repJ.ferie }) : null,
          repJ.forts.length ? el("span", { class: "temps-fort", text: repJ.forts.join(" · ") }) : null,
          repJ.bandes.length ? el("div", { class: "cal-bandes" }, repJ.bandes.map(function (b) { return el("span", { class: "bande b-" + b.type, style: b.c ? { "--c": b.c } : null, text: b.libelle, title: b.libelle }); })) : null,
          St.estLili() ? el("div", { class: "cj-actions" }, [
            el("button", { type: "button", class: "btn-plein petit", onclick: function () { St.nouvellePublication(eId || null, jr); } }, [St.icone("plus"), "Publication"]),
            el("button", { type: "button", class: "btn-texte", onclick: function () { St.editerRdv({ espace_id: eId || null }, jr); } }, [St.icone("plus"), "Rendez-vous"])]) : null
        ]),
        el("div", { class: "cj-heures" }, rangees)
      ]);
    } else {
      var d0 = St.debutJour(ref); titre = "À partir du " + St.fmt(d0, { day: "numeric", month: "long" });
      precedent = St.ajouterJours(ref, -14); suivant = St.ajouterJours(ref, 14);
      var jours = [];
      for (var n = 0; n < 45; n++) { var jj = St.ajouterJours(d0, n), ps = parJour[St.iso(jj)] || [], rep = reperesJour(jj, eId); var rv = rdvJour(jj, eId); if (ps.length || rv.length || rep.ferie || rep.forts.length || n === 0) jours.push([jj, ps, rep, rv]); }
      corps = el("div", { class: "cal-liste" }, jours.map(function (x) {
        var aujour = St.memeJour(x[0], new Date());
        return el("section", { class: "cal-liste-jour" + (aujour ? " aujourdhui" : ""), "data-jour": St.iso(x[0]) }, [
          el("header", {}, [el("b", { text: aujour ? "Aujourd'hui" : St.fmt(x[0], { weekday: "long", day: "numeric", month: "long" }) }),
            x[2].ferie ? el("span", { class: "ferie", text: x[2].ferie }) : null, x[2].forts.length ? el("span", { class: "temps-fort", text: x[2].forts.join(" · ") }) : null,
            St.estLili() ? el("button", { type: "button", class: "btn-ajout-jour", "aria-label": "Nouvelle publication ce jour", onclick: function () { St.nouvellePublication(eId || null, x[0]); } }, [St.icone("plus")]) : null]),
          x[3] && x[3].length ? el("div", { class: "cal-rdv-liste" }, x[3]) : null,
          x[1].length ? el("div", { class: "grille-cartes compacte" }, x[1].map(function (p) { var c = St.cartePublication(p, { compacte: true, sansClient: !!eId }); activerGlisser(c, p); return c; })) : (x[3] && x[3].length ? null : el("p", { class: "vide", text: "Rien de prévu." }))
        ]);
      }));
    }
    etat.ref = ref; etat.lien = lien; etat.precedent = precedent; etat.suivant = suivant;

    var outils = el("div", { class: "cal-outils" }, [
      el("div", { class: "cal-nav" }, [
        el("a", { class: "btn-icone", href: "#" + lien({ jour: St.iso(precedent) }), "aria-label": "Période précédente (←)" }, [St.icone("retour")]),
        el("a", { class: "btn-texte", href: "#" + lien({ jour: St.iso(new Date()) }), text: "Aujourd'hui" }),
        el("a", { class: "btn-icone", href: "#" + lien({ jour: St.iso(suivant) }), "aria-label": "Période suivante (→)" }, [St.icone("fleche")]),
        el("h2", { class: "cal-titre", text: titre })
      ]),
      el("div", { class: "cal-choix" }, [
        St.estLili() ? el("button", { type: "button", class: "btn-texte", onclick: function () { St.editerRdv({ espace_id: eId || null }, ref); } }, [St.icone("plus"), "Rendez-vous"]) : null,
        St.estLili() && !eForce ? el("select", { class: "choix-client", "aria-label": "Client", onchange: function (ev) { St.aller(lien({ client: ev.target.value })); } },
          [el("option", { value: "", text: "Tous les clients" })].concat(St.espacesActifs().map(function (e) { return el("option", { value: e.id, selected: e.id === eId, text: e.nom }); }))) : null,
        el("nav", { class: "vues", "aria-label": "Affichage" }, [["mois", "Mois"], ["semaine", "Semaine"], ["jour", "Jour"], ["liste", "Liste"]].map(function (x) {
          return el("a", { href: "#" + lien({ vue: x[0] }), "aria-current": x[0] === vue ? "true" : null, text: x[1] });
        }))
      ])
    ]);
    var legende = el("p", { class: "cal-legende" }, St.ORDRE_STATUTS.map(function (s) { return el("span", { class: "s-" + s }, [el("i"), St.STATUTS[s]]); }));
    return el("div", { class: "vue-calendrier" }, [
      eForce ? null : St.entete(null, "Calendrier", St.estLili() ? "Glissez une publication pour la changer de jour." : null),
      outils, legende, corps,
      sansDate.length && St.estLili() ? el("section", { class: "sans-date" }, [el("h2", { text: "Sans date" }), el("p", { class: "aside", text: "Glissez-les sur un jour pour les programmer." }),
        el("div", { class: "sans-date-liste" }, sansDate.map(function (p) { return puceCal(p, !eId); }))]) : null
    ]);
  };
  // Rendez-vous de Lili dans une case du calendrier (filtrés par client si un client est choisi)
  function rdvJour(j, eId) {
    if (!St.estLili()) return [];
    return St.rdvDu(j).filter(function (r) { return !eId || r.espace_id === eId; }).map(function (r) {
      var e = St.espace(r.espace_id);
      return el("button", { type: "button", class: "cal-rdv", style: e ? { "--c": e.couleur } : null, title: [r.titre, St.libelleRdv(r), r.lieu, e && e.nom].filter(Boolean).join(" · "),
        onclick: function () { St.editerRdv(r); } }, [el("b", { text: St.libelleRdv(r).split("–")[0] }), " " + r.titre]);
    });
  }
  function caseJour(j, ps, horsMois, eId, max, grand) {
    var rep = reperesJour(j, eId), aujour = St.memeJour(j, new Date()), k = St.iso(j), week = j.getDay() === 0 || j.getDay() === 6;
    var visibles = ps.slice(0, max), reste = ps.length - visibles.length;
    return el("div", { class: "cal-jour" + (horsMois ? " hors" : "") + (aujour ? " aujourdhui" : "") + (rep.ferie ? " ferie" : "") + (week ? " weekend" : ""), "data-jour": k }, [
      el("header", {}, [el("a", { class: "cal-num", href: "#" + (lienJour ? lienJour(k) : "calendrier?vue=jour&jour=" + k), title: "Voir la journée", draggable: "false", text: grand ? St.fmt(j, { weekday: "short", day: "numeric" }) : String(j.getDate()) }),
        rep.ferie ? el("span", { class: "ferie", text: rep.ferie, title: rep.ferie }) : rep.forts.length ? el("span", { class: "temps-fort", text: rep.forts[0], title: rep.forts.join(" · ") }) : null,
        St.estLili() ? el("button", { type: "button", class: "btn-ajout-jour", "aria-label": "Nouvelle publication le " + St.fmt(j, { day: "numeric", month: "long" }), onclick: function () { St.nouvellePublication(eId || null, j); } }, [St.icone("plus")]) : null]),
      rep.bandes.length ? el("div", { class: "cal-bandes" }, rep.bandes.slice(0, 2).map(function (b) { return el("span", { class: "bande b-" + b.type, style: b.c ? { "--c": b.c } : null, text: b.libelle, title: b.libelle }); })) : null,
      el("div", { class: "cal-pubs" }, rdvJour(j, eId).concat(visibles.map(function (p) { return puceCal(p, !eId); })).concat(reste > 0 ? [el("a", { class: "cal-plus", href: "#" + (lienJour ? lienJour(k) : "calendrier?vue=jour&jour=" + k), text: "+ " + reste })] : []))
    ]);
  }
  // ← → et T dans le calendrier
  var avant = V.touche;
  V.touche = function (ev) {
    var r = S.route, dansCal = r.nom === "calendrier" || (r.nom === "client" && r.rubrique === "calendrier");
    if (dansCal && etat.lien) {
      if (ev.key === "ArrowLeft") { St.aller(etat.lien({ jour: St.iso(etat.precedent) })); return true; }
      if (ev.key === "ArrowRight") { St.aller(etat.lien({ jour: St.iso(etat.suivant) })); return true; }
      if (ev.key === "t" || ev.key === "T") { St.aller(etat.lien({ jour: St.iso(new Date()) })); return true; }
    }
    return avant ? avant(ev) : false;
  };
})(window.Studio);
