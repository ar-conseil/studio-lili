/* La publication : aperçu fidèle par réseau à gauche (avec les commentaires épinglés sur le visuel), fiche à droite
   (Lili : tout se modifie et s'enregistre au fil de la saisie ; client : valider, demander une modification, commenter),
   fil de discussion et versions comparées en bas. Adresse : #p/<id>. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;
  var LIMITES = { instagram: 2200, facebook: 63206, linkedin: 3000, tiktok: 2200, pinterest: 500, google: 1500 };
  var etat = { id: null, reseau: null, index: 0, commenter: false, bulle: null };

  // Liens publication ↔ visuels (clé double : écriture directe)
  function lierMedias(p, ids) {
    var avant = S.pubMedias.filter(function (x) { return x.publication_id === p.id; });
    S.pubMedias = S.pubMedias.filter(function (x) { return x.publication_id !== p.id; });
    var lignes = ids.map(function (id, i) { return { publication_id: p.id, media_id: id, rang: i }; });
    S.pubMedias = S.pubMedias.concat(lignes);
    if (St.X.demo) return Promise.resolve();
    var db = St.X.db;
    return db.from("publication_medias").delete().eq("publication_id", p.id).then(function (r) {
      if (r.error) throw r.error;
      return lignes.length ? db.from("publication_medias").insert(lignes) : { error: null };
    }).then(function (r) { if (r.error) throw r.error; }).catch(function (e) {
      S.pubMedias = S.pubMedias.filter(function (x) { return x.publication_id !== p.id; }).concat(avant); St.signaler("Visuels non enregistrés : " + e.message, true);
    });
  }

  V.publication = function (r) {
    var p = St.publication(r.param), e = St.espace(p.espace_id) || {}, lili = St.estLili();
    if (etat.id !== p.id) { etat = { id: p.id, reseau: (p.reseaux || [])[0] || "instagram", index: 0, commenter: false, bulle: null }; }
    if ((p.reseaux || []).indexOf(etat.reseau) < 0) etat.reseau = (p.reseaux || [])[0] || "instagram";
    var page = el("div", { class: "vue-publication", style: { "--c": e.couleur } });
    var colApercu = el("div", { class: "pub-apercu" }), colFiche = el("div", { class: "pub-fiche" }), fil = el("section", { class: "pub-fil" });

    // ---------- Aperçu ----------
    function dessinerApercu() {
      colApercu.textContent = "";
      var bulles = St.commentairesDe(p.id).filter(function (c) { return !c.parent_id && (lili || c.visibilite === "partage"); });
      colApercu.appendChild(el("div", { class: "pub-apercu-outils" }, [
        (p.reseaux || []).length > 1 ? el("nav", { class: "onglets-reseaux", "aria-label": "Aperçu pour" }, p.reseaux.map(function (x) {
          return el("button", { type: "button", "aria-pressed": x === etat.reseau ? "true" : "false", onclick: function () { etat.reseau = x; dessinerApercu(); } }, [(St.RESEAUX[x] || {}).nom || x]);
        })) : el("span", { class: "aside", text: "Aperçu " + ((St.RESEAUX[etat.reseau] || {}).nom || "") }),
        St.mediasDe(p.id).length ? el("button", { type: "button", class: "btn-commenter" + (etat.commenter ? " actif" : ""), "aria-pressed": etat.commenter ? "true" : "false",
          onclick: function () { etat.commenter = !etat.commenter; dessinerApercu(); } }, [St.icone("commentaire"), etat.commenter ? "Cliquez sur l'image" : "Commenter le visuel"]) : null
      ]));
      var ap = St.apercu(p, etat.reseau, {
        index: etat.index, bulles: bulles, active: etat.bulle, plein: true,
        changer: function (i) { etat.index = i; dessinerApercu(); if (St.presence) St.presence(p.id, i + 1); },
        choisirBulle: function (c) { etat.bulle = c.id; dessinerApercu(); var t = document.getElementById("com-" + c.id); if (t) t.scrollIntoView({ behavior: "smooth", block: "center" }); },
        surClic: etat.commenter ? function (x, y, mediaId, zone) { epingler(x, y, mediaId, zone); } : null
      });
      colApercu.appendChild(el("div", { class: "pub-apercu-cadre" + (etat.commenter ? " en-commentaire" : "") }, [ap]));
      var vs = S.versions.filter(function (v) { return v.publication_id === p.id; });
      if (vs.length > 1) colApercu.appendChild(el("button", { type: "button", class: "btn-texte", onclick: function () { comparer(vs); } }, ["Comparer les versions (v" + (vs.length - 1) + " / v" + vs.length + ")"]));
    }
    // Bulle posée à l'endroit cliqué : un champ s'ouvre sur place
    function epingler(x, y, mediaId, zone) {
      var vieux = zone.querySelector(".bulle-saisie"); if (vieux) vieux.remove();
      var champ = el("textarea", { rows: 3, placeholder: "Votre remarque à cet endroit…", "aria-label": "Commentaire épinglé", oninput: function () { if (St.signalerFrappe) St.signalerFrappe(); } });
      var interne = lili ? el("label", { class: "case-interne" }, [el("input", { type: "checkbox" }), "Lili seule"]) : null;
      var boite = el("form", { class: "bulle-saisie", style: { left: Math.min(x * 100, 62) + "%", top: (y * 100) + "%" }, onclick: function (ev) { ev.stopPropagation(); }, onsubmit: function (ev) {
        ev.preventDefault(); var t = champ.value.trim(); if (!t) return;
        St.creer("commentaires", { publication_id: p.id, cible: "visuel", media_id: mediaId, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, contenu: t,
          visibilite: interne && interne.querySelector("input").checked ? "interne" : "partage", resolu: false, version: p.version_courante })
          .then(function (c) { etat.commenter = false; etat.bulle = c.id; dessinerApercu(); dessinerFil(); });
      } }, [el("span", { class: "bulle-saisie-pointe", text: "+" }), champ, el("div", { class: "rangee" }, [interne, el("button", { type: "button", class: "btn-texte", text: "Annuler", onclick: function () { boite.remove(); } }), el("button", { type: "submit", class: "btn-plein", text: "Épingler" })])]);
      zone.appendChild(boite); champ.focus();
      champ.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) boite.requestSubmit(); if (ev.key === "Escape") boite.remove(); });
    }

    // ---------- Fiche (Lili) ----------
    function enregistrer(champs, silencieux) {
      return St.maj("publications", p.id, champs).then(function () { if (!silencieux) dessinerApercu(); });
    }
    function champTexte(cle, o) {
      var c = el(o.multi ? "textarea" : "input", { type: o.multi ? null : "text", class: o.classe || "", rows: o.rows || null, placeholder: o.placeholder || "", value: o.multi ? null : (p[cle] || ""), "aria-label": o.label, maxlength: o.max || null });
      if (o.multi) c.value = p[cle] || "";
      var minut = null;
      c.dataset.auto = "1";   // enregistré tout seul : ne retient pas le temps réel
      c.addEventListener("input", function () { p[cle] = c.value; if (o.compteur) o.compteur(); clearTimeout(minut); minut = setTimeout(function () { enregistrer(o.vers ? o.vers(c.value) : (function () { var x = {}; x[cle] = c.value; return x; })(), false); }, 600); dessinerApercuLeger(); });
      return c;
    }
    var leger = null;
    function dessinerApercuLeger() { clearTimeout(leger); leger = setTimeout(dessinerApercu, 120); }
    function dessinerFiche() {
      colFiche.textContent = "";
      if (!lili) return dessinerFicheClient();
      var date = el("input", { type: "date", value: p.date_prevue ? St.iso(p.date_prevue) : "", "aria-label": "Jour" });
      var heure = el("input", { type: "time", step: 300, value: p.date_prevue ? St.hm(p.date_prevue) : "", "aria-label": "Heure" });
      function majDate() {
        if (!date.value) return enregistrer({ date_prevue: null });
        var h = heure.value || ((e.heures_defaut || {})[(p.reseaux || [])[0]] || St.HEURES[p.format === "story" ? "story" : (p.reseaux || [])[0]] || "12:30");
        heure.value = h; enregistrer({ date_prevue: new Date(date.value + "T" + h + ":00").toISOString() });
      }
      date.addEventListener("change", majDate); heure.addEventListener("change", majDate);
      var compteur = el("span", { class: "compteur" });
      function majCompteur() {
        var n = (p.legende || "").length + (p.hashtags || []).reduce(function (t, h) { return t + h.length + 2; }, 0);
        var lim = Math.min.apply(null, (p.reseaux || ["instagram"]).map(function (x) { return LIMITES[x] || 2200; }));
        compteur.textContent = n + " / " + lim; compteur.classList.toggle("depasse", n > lim);
      }
      var legende = champTexte("legende", { multi: true, rows: 7, label: "Légende", placeholder: "La légende, telle qu'elle sera publiée…", compteur: majCompteur });
      var tags = champTexte("hashtags_texte", { label: "Hashtags", placeholder: "#fleuriste #lille", vers: function (v) { var l = v.split(/[\s,]+/).map(function (x) { return x.replace(/^#/, ""); }).filter(Boolean); p.hashtags = l; majCompteur(); return { hashtags: l }; } });
      tags.value = (p.hashtags || []).map(function (h) { return "#" + h; }).join(" ");
      var mentions = champTexte("mentions_texte", { label: "Mentions", placeholder: "@partenaire", vers: function (v) { var l = v.split(/[\s,]+/).map(function (x) { return x.replace(/^@/, ""); }).filter(Boolean); p.mentions = l; return { mentions: l }; } });
      mentions.value = (p.mentions || []).map(function (h) { return "@" + h; }).join(" ");
      majCompteur();
      var titre = champTexte("titre", { label: "Titre interne", placeholder: "Titre (pour vous retrouver)", classe: "pub-titre", max: 140 });
      var reseaux = el("div", { class: "choix-multiples", role: "group", "aria-label": "Réseaux" }, Object.keys(St.RESEAUX).map(function (x) {
        var on = (p.reseaux || []).indexOf(x) >= 0;
        return el("button", { type: "button", class: "choix r-" + x, "aria-pressed": on ? "true" : "false", onclick: function () {
          var l = (p.reseaux || []).slice(); if (on) l = l.filter(function (y) { return y !== x; }); else l.push(x);
          if (!l.length) return; p.reseaux = l; enregistrer({ reseaux: l }).then(dessinerFiche);
        } }, [(St.RESEAUX[x] || {}).nom]);
      }));
      var formats = el("div", { class: "choix-multiples", role: "radiogroup", "aria-label": "Format" }, Object.keys(St.FORMATS).map(function (x) {
        return el("button", { type: "button", class: "choix", role: "radio", "aria-checked": p.format === x ? "true" : "false", onclick: function () { p.format = x; enregistrer({ format: x }).then(dessinerFiche); } }, [St.FORMATS[x]]);
      }));
      var etapes = p.statut === "en-creation" || (p.etapes || []).length ? el("div", { class: "etapes" }, Object.keys(St.ETAPES).map(function (x) {
        var on = (p.etapes || []).indexOf(x) >= 0;
        return el("label", { class: "case" }, [el("input", { type: "checkbox", checked: on, onchange: function (ev) {
          var l = (p.etapes || []).filter(function (y) { return y !== x; }); if (ev.target.checked) l.push(x); p.etapes = l; enregistrer({ etapes: l }, true);
        } }), "À faire : " + St.ETAPES[x].toLowerCase()]);
      })) : null;
      var ops = S.operations.filter(function (o) { return o.espace_id === p.espace_id; });
      var operation = ops.length ? el("select", { "aria-label": "Opération", onchange: function (ev) { enregistrer({ operation_id: ev.target.value || null }, true); } },
        [el("option", { value: "", text: "Aucune opération" })].concat(ops.map(function (o) { return el("option", { value: o.id, selected: o.id === p.operation_id, text: o.libelle }); }))) : null;
      var note = (S.notes || []).filter(function (n) { return n.publication_id === p.id; })[0];
      var noteChamp = el("textarea", { rows: 3, placeholder: "Note pour vous seule (jamais visible du client)", "aria-label": "Note interne" }); noteChamp.value = note ? note.contenu : "";
      var mn = null;
      noteChamp.dataset.auto = "1";
      noteChamp.addEventListener("input", function () { clearTimeout(mn); mn = setTimeout(function () {
        var t = noteChamp.value.trim();
        if (note) { if (t) St.maj("notes_internes", note.id, { contenu: t }); else St.supprimer("notes_internes", { id: note.id }).then(function () { note = null; }); }
        else if (t) St.creer("notes_internes", { espace_id: p.espace_id, publication_id: p.id, contenu: t }).then(function (n) { note = n; });
      }, 700); });

      colFiche.appendChild(el("div", { class: "pub-fiche-corps" }, [
        titre,
        actionsStatut(),
        groupe("Quand", el("div", { class: "rangee" }, [date, heure, p.date_prevue ? el("span", { class: "aside", text: St.quand(p.date_prevue) }) : null])),
        groupe("Réseaux", reseaux), groupe("Format", formats),
        groupe("Visuels", editeurVisuels()),
        groupe("Légende", el("div", {}, [legende, el("div", { class: "sous-champ" }, [compteur])])),
        groupe("Hashtags et mentions", el("div", { class: "pile-serree" }, [tags, mentions])),
        p.format === "reel" || p.format === "video" ? groupe("Voix off / script", champTexte("script", { multi: true, rows: 3, label: "Script", placeholder: "Ce qui est dit ou montré, plan par plan" })) : null,
        groupe("Lien", champTexte("lien", { label: "Lien", placeholder: "https://…" })),
        etapes ? groupe("Étapes de création", etapes) : null,
        operation ? groupe("Opération", operation) : null,
        groupe("Note interne", noteChamp, "interne"),
        el("div", { class: "pub-bas" }, [
          el("span", { class: "aside", text: p.visibilite === "partage" ? "Visible par le client" : "Invisible pour le client (" + St.STATUTS[p.statut].toLowerCase() + ")" }),
          el("button", { type: "button", class: "btn-texte danger", onclick: function () { mettreCorbeille(); } }, [St.icone("corbeille"), "Corbeille"])
        ])
      ]));
    }
    function groupe(titre, contenu, classe) { return el("section", { class: "groupe" + (classe ? " " + classe : "") }, [el("h3", { text: titre }), contenu]); }
    function changerStatut(s, message) {
      var avant = p.statut;
      return St.maj("publications", p.id, { statut: s }).then(function () { St.signaler(message || "Statut : " + St.STATUTS[s]); St.dessiner(false); })
        .catch(function () { p.statut = avant; });
    }
    function actionsStatut() {
      var suivant = { "idee": ["en-creation", "Commencer la création"], "en-creation": ["a-valider", "Envoyer au client"], "modifs-demandees": ["a-valider", "Renvoyer au client"],
        "valide": ["programme", "Marquer programmée"], "programme": ["publie", "Marquer publiée"] }[p.statut];
      var choix = el("select", { class: "choix-statut s-" + p.statut, "aria-label": "Statut", onchange: function (ev) { changerStatut(ev.target.value); } },
        St.ORDRE_STATUTS.map(function (s) { return el("option", { value: s, selected: s === p.statut, text: St.STATUTS[s] }); }));
      return el("div", { class: "pub-statut" }, [choix,
        suivant ? el("button", { type: "button", class: "btn-plein", onclick: function () {
          if (suivant[0] === "a-valider" && !St.mediasDe(p.id).length && !p.legende) { St.signaler("Ajoutez un visuel ou une légende avant d'envoyer.", true); return; }
          changerStatut(suivant[0], suivant[0] === "a-valider" ? "Envoyée au client pour validation" : null);
        } }, [suivant[1]]) : null,
        p.statut === "a-valider" ? el("span", { class: "aside", text: "Envoyée " + (p.envoye_le ? St.ilya(p.envoye_le) : "") + " · v" + p.version_courante }) : null]);
    }
    function mettreCorbeille() {
      St.fenetre({ titre: "Mettre à la corbeille ?", sous: "« " + (p.titre || "Sans titre") + " » disparaît du calendrier et du client. Elle reste 30 jours dans la corbeille.",
        actions: [{ texte: "Annuler" }, { texte: "Mettre à la corbeille", principal: true, action: function (f) {
          St.maj("publications", p.id, { corbeille_le: new Date().toISOString() }).then(function () { f(); St.signaler("Publication à la corbeille (30 jours)"); St.aller(e.slug ? e.slug + "/publications" : "publications"); });
        } }] });
    }

    // Visuels : ordre du carrousel (glisser ou flèches), ajout depuis la médiathèque ou depuis l'ordinateur / le téléphone
    function editeurVisuels() {
      var ms = St.mediasDe(p.id), zone = el("div", { class: "visuels" });
      var liste = el("ol", { class: "visuels-liste" }, ms.map(function (m, i) {
        var li = el("li", { draggable: "true", "data-id": m.id }, [St.image(m), el("span", { class: "visuels-rang", text: String(i + 1) }),
          el("span", { class: "visuels-outils" }, [
            i > 0 ? el("button", { type: "button", "aria-label": "Avancer", onclick: function () { deplacer(i, i - 1); } }, [St.icone("retour")]) : null,
            i < ms.length - 1 ? el("button", { type: "button", "aria-label": "Reculer", onclick: function () { deplacer(i, i + 1); } }, [St.icone("fleche")]) : null,
            el("button", { type: "button", "aria-label": "Retirer de la publication", onclick: function () { var ids = ms.map(function (x) { return x.id; }); ids.splice(i, 1); lierMedias(p, ids).then(maj); } }, [St.icone("fermer")])
          ])]);
        li.addEventListener("dragstart", function (ev) { ev.dataTransfer.setData("text/plain", String(i)); li.classList.add("glissee"); });
        li.addEventListener("dragend", function () { li.classList.remove("glissee"); });
        li.addEventListener("dragover", function (ev) { ev.preventDefault(); li.classList.add("survol"); });
        li.addEventListener("dragleave", function () { li.classList.remove("survol"); });
        li.addEventListener("drop", function (ev) { ev.preventDefault(); li.classList.remove("survol"); var de = +ev.dataTransfer.getData("text/plain"); if (!isNaN(de) && ev.dataTransfer.files.length === 0) deplacer(de, i); });
        return li;
      }));
      function deplacer(de, vers) { var ids = ms.map(function (x) { return x.id; }), x = ids.splice(de, 1)[0]; ids.splice(vers, 0, x); etat.index = vers; lierMedias(p, ids).then(maj); }
      function maj() { dessinerFiche(); dessinerApercu(); }
      var fichier = el("input", { type: "file", accept: "image/*,video/*", multiple: true, hidden: true, onchange: function (ev) { ajouterFichiers(ev.target.files); } });
      function ajouterFichiers(fichiers) {
        var l = Array.prototype.slice.call(fichiers || []); if (!l.length) return;
        zone.classList.add("envoi"); St.signaler("Envoi de " + l.length + " fichier" + (l.length > 1 ? "s" : "") + "…");
        Promise.all(l.map(function (f) { return St.televerser(f, p.espace_id, "Publications"); })).then(function (nouveaux) {
          return lierMedias(p, ms.map(function (x) { return x.id; }).concat(nouveaux.map(function (m) { return m.id; })));
        }).then(maj).catch(function (e) { zone.classList.remove("envoi"); St.signaler("Envoi impossible : " + e.message, true); });
      }
      zone.addEventListener("dragover", function (ev) { if (ev.dataTransfer.types.indexOf("Files") >= 0) { ev.preventDefault(); zone.classList.add("depot"); } });
      zone.addEventListener("dragleave", function () { zone.classList.remove("depot"); });
      zone.addEventListener("drop", function (ev) { if (ev.dataTransfer.files.length) { ev.preventDefault(); zone.classList.remove("depot"); ajouterFichiers(ev.dataTransfer.files); } });
      zone.appendChild(ms.length ? liste : el("p", { class: "visuels-vide", text: "Glissez ici photos et vidéos, ou choisissez-les." }));
      zone.appendChild(el("div", { class: "rangee" }, [
        el("button", { type: "button", class: "btn-texte", onclick: function () { fichier.click(); } }, [St.icone("deposer"), "Déposer des fichiers"]),
        el("button", { type: "button", class: "btn-texte", onclick: function () { choisirDansMediatheque(); } }, [St.icone("mediatheque"), "Depuis la médiathèque"]), fichier
      ]));
      function choisirDansMediatheque() {
        var choisis = ms.map(function (x) { return x.id; }).slice();
        var dispo = S.medias.filter(function (m) { return m.espace_id === p.espace_id && !m.corbeille_le; });
        var grille = el("div", { class: "choix-medias" }, dispo.map(function (m) {
          var b = el("button", { type: "button", class: "choix-media", "aria-pressed": choisis.indexOf(m.id) >= 0 ? "true" : "false", onclick: function () {
            var k = choisis.indexOf(m.id); if (k >= 0) choisis.splice(k, 1); else choisis.push(m.id); b.setAttribute("aria-pressed", k >= 0 ? "false" : "true");
          } }, [St.image(m), el("span", { class: "choix-media-coche" }, [St.icone("valider")])]);
          return b;
        }));
        St.fenetre({ titre: "Choisir dans la médiathèque", classe: "large", corps: [dispo.length ? grille : St.vide("La médiathèque de ce client est vide.")],
          actions: [{ texte: "Annuler" }, { texte: "Utiliser ces visuels", principal: true, action: function (f) { f(); lierMedias(p, choisis).then(maj); } }] });
      }
      return zone;
    }

    // ---------- Côté client ----------
    function dessinerFicheClient() {
      var attente = p.statut === "a-valider";
      colFiche.appendChild(el("div", { class: "pub-fiche-corps client" }, [
        el("p", { class: "surtitre", text: (St.FORMATS[p.format] || "") + " · " + (p.reseaux || []).map(function (x) { return (St.RESEAUX[x] || {}).nom; }).join(", ") }),
        el("h1", { class: "titre-pub", text: p.titre || "Sans titre" }),
        el("p", { class: "pub-quand", text: p.date_prevue ? "Prévue " + St.fmt(p.date_prevue, { weekday: "long", day: "numeric", month: "long" }) + " à " + St.hm(p.date_prevue) : "Pas encore datée" }),
        St.pastilleStatut(p.statut),
        attente ? el("div", { class: "pub-decision" }, [
          el("button", { type: "button", class: "btn-texte grand", onclick: function () { St.demanderModif(p); } }, ["Demander une modification"]),
          el("button", { type: "button", class: "btn-plein grand", onclick: function () { St.valider(p); } }, [St.icone("valider"), "Valider"])
        ]) : null,
        p.statut === "valide" ? el("p", { class: "aside", text: "Validée " + (p.valide_le ? St.ilya(p.valide_le) : "") + ". Lili s'occupe de la programmer." }) : null,
        p.legende ? el("div", { class: "legende-lecture" }, [el("h3", { text: "Légende" }), el("p", { text: p.legende }), (p.hashtags || []).length ? el("p", { class: "tags", text: p.hashtags.map(function (h) { return "#" + h; }).join(" ") }) : null]) : null
      ]));
    }

    // ---------- Fil de discussion ----------
    function dessinerFil() {
      fil.textContent = "";
      var tous = St.commentairesDe(p.id).filter(function (c) { return lili || c.visibilite === "partage"; });
      var racines = tous.filter(function (c) { return !c.parent_id; });
      fil.appendChild(el("h2", { text: "Échanges" }));
      fil.appendChild(el("p", { class: "frappe", id: "frappe-pub", hidden: true }));
      if (!racines.length) fil.appendChild(el("p", { class: "vide", text: lili ? "Pas encore d'échange. Épinglez une remarque sur le visuel ou écrivez ci-dessous." : "Une question, une remarque ? Écrivez-la ici ou cliquez sur « Commenter le visuel »." }));
      racines.forEach(function (c) {
        var reponses = tous.filter(function (x) { return x.parent_id === c.id; });
        fil.appendChild(el("article", { class: "com" + (c.resolu ? " resolu" : "") + (c.visibilite === "interne" ? " interne" : "") + (etat.bulle === c.id ? " actif" : ""), id: "com-" + c.id }, [
          message(c, true),
          el("div", { class: "com-reponses" }, reponses.map(function (x) { return message(x, false); })),
          el("div", { class: "com-actions" }, [
            el("button", { type: "button", class: "btn-texte", text: "Répondre", onclick: function (ev) { repondre(c, ev.target.closest(".com")); } }),
            // « Résolu » : Lili sur tout le fil, un client sur ses propres commentaires (la base refuse le reste)
            lili || (S.moi && c.auteur_id === S.moi.id) ? el("button", { type: "button", class: "btn-texte", text: c.resolu ? "Rouvrir" : "Résolu", onclick: function () {
              St.maj("commentaires", c.id, { resolu: !c.resolu }).then(function () { dessinerFil(); dessinerApercu(); }, function () { /* message déjà affiché */ });
            } }) : null
          ])
        ]));
      });
      var champ = el("textarea", { rows: 2, placeholder: lili ? "Écrire au client…" : "Écrire à Lili…", "aria-label": "Nouveau message" });
      var cible = el("select", { "aria-label": "Sujet" }, [el("option", { value: "general", text: "Sur la publication" }), el("option", { value: "legende", text: "Sur la légende" })]);
      var interne = lili ? el("label", { class: "case-interne" }, [el("input", { type: "checkbox" }), "Note pour moi seule"]) : null;
      fil.appendChild(el("form", { class: "com-saisie", onsubmit: function (ev) {
        ev.preventDefault(); var t = champ.value.trim(); if (!t) return;
        St.creer("commentaires", { publication_id: p.id, cible: cible.value, contenu: t, visibilite: interne && interne.querySelector("input").checked ? "interne" : "partage", resolu: false, version: p.version_courante })
          .then(function () { dessinerFil(); });
      } }, [champ, el("div", { class: "rangee" }, [cible, interne, el("span", { class: "espace" }), el("button", { type: "submit", class: "btn-plein", text: "Envoyer" })])]));
      champ.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) champ.form.requestSubmit(); });
      champ.addEventListener("input", function () { if (St.signalerFrappe) St.signalerFrappe(); });
    }
    function message(c, racine) {
      var a = St.personne(c.auteur_id) || {}, moi = a.role === "proprietaire";
      return el("div", { class: "com-msg" }, [
        el("span", { class: "com-avatar" + (moi ? " lili" : ""), text: St.initiales(a.nom) }),
        el("div", {}, [el("p", { class: "com-tete" }, [
          racine && c.numero ? el("button", { type: "button", class: "com-num", text: String(c.numero), "aria-label": "Voir la bulle " + c.numero, onclick: function () { etat.bulle = c.id; var m = St.mediasDe(p.id).map(function (x) { return x.id; }).indexOf(c.media_id); if (m >= 0) etat.index = m; dessinerApercu(); window.scrollTo({ top: 0, behavior: "smooth" }); } }) : null,
          el("b", { text: a.nom || "" }), el("small", { text: " · " + St.ilya(c.cree_le) + (c.version ? " · v" + c.version : "") + (c.cible === "legende" ? " · légende" : "") }),
          c.visibilite === "interne" ? el("span", { class: "etiquette-interne", text: "Lili seule" }) : null]),
          el("p", { class: "com-texte", text: c.contenu })])
      ]);
    }
    function repondre(c, bloc) {
      if (bloc.querySelector(".com-reponse")) return;
      var champ = el("textarea", { rows: 2, placeholder: "Votre réponse…", "aria-label": "Réponse", oninput: function () { if (St.signalerFrappe) St.signalerFrappe(); } });
      var f = el("form", { class: "com-reponse", onsubmit: function (ev) {
        ev.preventDefault(); var t = champ.value.trim(); if (!t) return;
        St.creer("commentaires", { publication_id: p.id, parent_id: c.id, cible: c.cible, contenu: t, visibilite: c.visibilite, resolu: false, version: p.version_courante }).then(dessinerFil);
      } }, [champ, el("div", { class: "rangee fin" }, [el("button", { type: "button", class: "btn-texte", text: "Annuler", onclick: function () { f.remove(); } }), el("button", { type: "submit", class: "btn-plein", text: "Répondre" })])]);
      bloc.appendChild(f); champ.focus();
    }

    // Versions côte à côte : ce que le client a vu avant et après
    function comparer(vs) {
      vs = vs.slice().sort(function (a, b) { return a.numero - b.numero; });
      var a = vs[vs.length - 2], b = vs[vs.length - 1];
      function colonne(v) {
        var m = St.media((v.medias || [])[0]);
        return el("div", { class: "version" }, [el("h3", { text: "Version " + v.numero }), el("small", { text: St.fmt(v.cree_le, { day: "numeric", month: "long" }) + " à " + St.hm(v.cree_le) }),
          m ? St.image(m, { apercu: false }) : el("div", { class: "image-vide" }), el("p", { text: v.legende || "" })]);
      }
      St.fenetre({ titre: "Comparer les versions", classe: "large", corps: [el("div", { class: "versions-cote" }, [colonne(a), colonne(b)])], actions: [{ texte: "Fermer" }] });
    }

    var e2 = St.espace(p.espace_id) || {};
    page.appendChild(el("header", { class: "pub-tete" }, [
      el("a", { class: "retour-client", href: lili ? "#" + e2.slug : "#", onclick: function (ev) { ev.preventDefault(); St.revenir(lili ? "#" + e2.slug : "#"); } }, [St.icone("retour"), St.logoEspace(e2, "petit"), el("span", { text: e2.nom })]),
      el("div", { class: "presence", id: "presence-pub", "aria-live": "polite" }),
      St.pastilleStatut(p.statut)
    ]));
    page.appendChild(el("div", { class: "pub-colonnes" }, [colApercu, colFiche]));
    page.appendChild(fil);
    dessinerApercu(); dessinerFiche(); dessinerFil();
    if (St.presence) St.presence(p.id, etat.index + 1);
    return page;
  };
})(window.Studio);
