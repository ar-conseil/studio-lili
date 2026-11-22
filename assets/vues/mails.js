/* Mails : la messagerie de Lili (sa boîte Gmail), pensée pour rivaliser avec Gmail sans quitter le studio.
   Conversations, dossiers et libellés, un raccourci par client, recherche Gmail et filtres, sélection multiple,
   lecture en fil (HTML isolé, images distantes bloquées jusqu'au clic), rédaction mise en forme avec signature et
   réponses types, pièces jointes glissées, annulation d'envoi, envoi programmé, brouillons enregistrés tout seuls,
   « En vacances » (réponse automatique Gmail), raccourcis clavier façon Gmail (touche ? pour la liste).
   Fonction serveur « messagerie » ; rien n'est jamais effacé définitivement. Adresse : #mails  (?message=… au retour de Google) */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V, MARQUE = window.MARQUE || {};
  var M = { dossier: "INBOX", q: "", filtre: "", client: "", fils: [], suite: null, ouvert: null, fil: null, sel: {}, dossiers: [], boites: null,
    charge: false, erreur: "", images: false, curseur: -1, programmes: [], etendus: {}, minute: null };
  var POLICE = "font-family:Arial,sans-serif;font-size:14px;line-height:1.5";

  // ======================================================================
  // Réglages de la messagerie (Réglages > Signatures, Réponses types, Mails)
  // ======================================================================
  function reglage(cle) { return ((S.reglages.filter(function (r) { return r.cle === cle; })[0] || {}).valeur) || {}; }
  St.signatures = function () { var r = reglage("signatures"); return { liste: r.liste || [], nouveau: r.nouveau || null, reponse: r.reponse || null }; };
  St.modelesMail = function () { return reglage("modeles_mail").liste || []; };
  St.reglagesMails = function () { var r = reglage("mails"); return { annulation: r.annulation == null ? 8 : +r.annulation }; };
  St.vacancesActives = function () {
    var v = reglage("vacances"), auj = St.iso(new Date());
    return v.actif && v.fin >= auj ? v : null;
  };

  // ======================================================================
  // Éditeur mis en forme (rédaction des mails, signatures, réponses types)
  // ======================================================================
  St.editeurRiche = function (html, o) {
    o = o || {};
    var zone = el("div", { class: "editeur-zone", contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": o.label || "Texte", "data-vide": o.aide || "" });
    zone.innerHTML = html || "";
    var cmd = function (c, v) { zone.focus(); document.execCommand(c, false, v || null); };
    var bouton = function (ic, titre, f) { return el("button", { type: "button", class: "btn-icone petit", title: titre, "aria-label": titre, onmousedown: function (ev) { ev.preventDefault(); }, onclick: f }, [St.icone(ic)]); };
    var barre = el("div", { class: "editeur-barre", role: "toolbar", "aria-label": "Mise en forme" }, [
      bouton("gras", "Gras (Cmd+B)", function () { cmd("bold"); }), bouton("italique", "Italique (Cmd+I)", function () { cmd("italic"); }),
      bouton("souligne", "Souligné (Cmd+U)", function () { cmd("underline"); }), bouton("liste", "Liste à puces", function () { cmd("insertUnorderedList"); }),
      bouton("citation", "Citation", function () { cmd("formatBlock", "blockquote"); }),
      bouton("lien", "Lien", function () { var u = prompt("Adresse du lien (https://…)"); if (u && /^(https?:|mailto:)/.test(u.trim())) cmd("createLink", u.trim()); }),
      el("button", { type: "button", class: "btn-texte petit", title: "Effacer la mise en forme", onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { cmd("removeFormat"); } }, ["Aa"])
    ].concat(o.extra || []));
    zone.addEventListener("paste", function (ev) {   // coller du texte brut : pas de styles parasites venus d'ailleurs
      if (!ev.clipboardData) return; var t = ev.clipboardData.getData("text/plain"); if (!t) return;
      ev.preventDefault(); document.execCommand("insertText", false, t);
    });
    return { el: el("div", { class: "editeur" + (o.classe ? " " + o.classe : "") }, [barre, zone]), zone: zone,
      html: function () { return zone.innerHTML; }, vide: function () { return !zone.textContent.trim() && !zone.querySelector("img"); },
      inserer: function (h) { zone.focus(); document.execCommand("insertHTML", false, h); } };
  };

  // ======================================================================
  // Données : démonstration ou Gmail
  // ======================================================================
  function demoFils() {
    var h = function (n) { return new Date(Date.now() - n * 3600000).toISOString(); };
    var m = function (id, de, a, date, texte, lu) { return { id: id, de: de, a: a, cc: "", date: date, objet: "", texte: texte, html: "", extrait: texte.slice(0, 90), lu: lu !== false, pieces: [] }; };
    var lili = "Lili Rouzier <lili@demo.exemple>";
    return [
      { id: "f1", nb: 3, de: ["Inès Morel <ines@maison-ondine.exemple>", lili], objet: "Photos de l'atelier couronnes", date: h(1), lu: false, suivi: true, pieces: true, libelles: [],
        extrait: "Parfait, je vous envoie aussi celles du stand dès que possible !", messages: [
          m("m1", "Inès Morel <ines@maison-ondine.exemple>", lili, h(26), "Bonjour Lili,\n\nJe vous envoie les photos de l'atelier couronnes de samedi. Dites-moi si la lumière vous convient pour le carrousel.\n\nBelle journée,\nInès"),
          m("m2", lili, "Inès Morel <ines@maison-ondine.exemple>", h(20), "Merci Inès, elles sont superbes ! Je garde les 4 premières pour le carrousel de mardi.\n\nLili"),
          m("m3", "Inès Morel <ines@maison-ondine.exemple>", lili, h(1), "Parfait, je vous envoie aussi celles du stand dès que possible !\n\nInès", false)] },
      { id: "f2", nb: 1, de: ["Claire Dubois <claire@cafe-lumiere.exemple>"], objet: "Carte de Noël : les prix", date: h(5), lu: true, pieces: false, libelles: [],
        extrait: "Voici les prix définitifs pour la carte : chaï 4,50 €, chocolat viennois 5 €…", messages: [
          m("m4", "Claire Dubois <claire@cafe-lumiere.exemple>", lili, h(5), "Bonjour Lili,\n\nVoici les prix définitifs pour la carte : chaï 4,50 €, chocolat viennois 5 €, bûche 6,50 €.\n\nClaire")] },
      { id: "f3", nb: 2, de: ["Hugo Lemaire <hugo@atelier-sable.exemple>", lili], objet: "Article LinkedIn", date: h(26), lu: true, pieces: false, libelles: [],
        extrait: "Merci pour le premier jet, je relis ce soir et je reviens vers vous.", messages: [
          m("m5", lili, "Hugo Lemaire <hugo@atelier-sable.exemple>", h(30), "Bonjour Hugo, voici le premier jet de l'article. Bonne lecture !\n\nLili"),
          m("m6", "Hugo Lemaire <hugo@atelier-sable.exemple>", lili, h(26), "Merci pour le premier jet, je relis ce soir et je reviens vers vous.\n\nHugo")] },
      { id: "f4", nb: 1, de: ["Imprimerie Duval <contact@imprimerie.exemple>"], objet: "Devis flyers A5", date: h(50), lu: true, pieces: true, libelles: [],
        extrait: "Suite à votre demande, veuillez trouver notre devis en pièce jointe.", messages: [
          m("m7", "Imprimerie Duval <contact@imprimerie.exemple>", lili, h(50), "Bonjour,\n\nSuite à votre demande, veuillez trouver notre devis en pièce jointe.\n\nCordialement,\nImprimerie Duval")] },
      { id: "f5", nb: 1, de: ["Newsletter Créa <news@crea.exemple>"], objet: "Les tendances Instagram de décembre", date: h(70), lu: false, pieces: false, libelles: [],
        extrait: "Carrousels, reels courts, coulisses : ce qui marche ce mois-ci.", messages: [
          m("m8", "Newsletter Créa <news@crea.exemple>", lili, h(70), "Carrousels, reels courts, coulisses : ce qui marche ce mois-ci.", false)] }
    ];
  }
  function appel(corps) {
    if (St.X.demo) return Promise.resolve({});
    return St.X.db.functions.invoke("messagerie", { body: corps }).then(function (r) {
      if (r.error) { return (r.error.context && r.error.context.json ? r.error.context.json() : Promise.resolve({})).then(function (j) { throw new Error((j && j.erreur) || r.error.message); }); }
      return r.data;
    });
  }
  function adresse(de) { var m = /<([^>]+)>/.exec(de || ""); return (m ? m[1] : de || "").trim().toLowerCase(); }
  function nom(de) { return String(de || "").replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || adresse(de); }
  function moi(de) { var b = M.boites && M.boites[0]; return b && adresse(de) === String(b.email).toLowerCase() || (St.X.demo && /lili@demo/.test(de)); }
  // Client d'une adresse : une personne membre d'un espace, à la même adresse (ou, en démonstration, au même domaine)
  function clientDe(de) {
    var a = adresse(de), p = S.personnes.filter(function (x) { return x.email && x.email.toLowerCase() === a; })[0];
    if (p) { var m = S.membres.filter(function (x) { return x.personne_id === p.id; })[0]; if (m) return St.espace(m.espace_id); }
    if (St.X.demo) { var dom = a.split("@")[1] || ""; return St.espacesActifs().filter(function (e) { return dom.indexOf(e.slug) === 0; })[0] || null; }
    return null;
  }
  function clientDuFil(f) { for (var i = 0; i < (f.de || []).length; i++) { var e = clientDe(f.de[i]); if (e) return e; } return null; }
  function adressesClient(e) {
    return S.membres.filter(function (m) { return m.espace_id === e.id; }).map(function (m) { var p = St.personne(m.personne_id); return p && p.email; }).filter(Boolean);
  }
  function requete() {
    var q = M.q;
    if (M.client) { var e = St.espace(M.client), ad = e ? adressesClient(e) : []; if (ad.length) q = "{" + ad.map(function (x) { return "from:" + x + " to:" + x; }).join(" ") + "} " + q; }
    if (M.filtre === "non_lus") q += " is:unread"; if (M.filtre === "pieces") q += " has:attachment";
    if (M.filtre === "clients") { var toutes = St.espacesActifs().reduce(function (l, e) { return l.concat(adressesClient(e)); }, []); if (toutes.length) q += " {" + toutes.map(function (x) { return "from:" + x; }).join(" ") + "}"; }
    return q.trim();
  }
  function charger(plus) {
    if (St.X.demo) {
      if (!M.demo) { M.demo = demoFils(); M.boites = [{ email: "lili@demo.exemple", vacances_possible: true }]; }
      M.dossiers = [{ id: "INBOX", nom: "Boîte de réception", type: "reception", non_lus: M.demo.filter(function (f) { return !f.lu; }).length }, { id: "STARRED", nom: "Suivis", type: "etoile" },
        { id: "SENT", nom: "Envoyés", type: "envoyes" }, { id: "DRAFT", nom: "Brouillons", type: "brouillons" }, { id: "TRASH", nom: "Corbeille", type: "corbeille" },
        { id: "Label_1", nom: "Factures", type: "perso" }];
      var q = (M.q || "").toLowerCase();
      M.fils = M.demo.filter(function (f) {
        if (M.dossier === "STARRED" && !f.suivi) return false; if (M.dossier === "TRASH") return !!f.corbeille; if (f.corbeille) return false;
        if (M.dossier === "INBOX" && f.archive) return false; if (M.dossier === "SENT") return f.de.some(moi);
        if (M.dossier === "DRAFT" || M.dossier === "Label_1") return false;
        if (M.filtre === "non_lus" && f.lu) return false; if (M.filtre === "pieces" && !f.pieces) return false; if (M.filtre === "clients" && !clientDuFil(f)) return false;
        if (M.client && (clientDuFil(f) || {}).id !== M.client) return false;
        return !q || (f.objet + " " + f.extrait + " " + f.de.join(" ")).toLowerCase().indexOf(q) >= 0;
      });
      M.suite = null; return Promise.resolve();
    }
    M.charge = true; M.erreur = ""; M.chargeLe = Date.now(); M.hashCharge = location.hash;
    var p = M.boites ? Promise.resolve() : appel({ action: "etat" }).then(function (r) { M.boites = r.boites || []; });
    return p.then(function () {
      if (!M.boites.length) return;
      var q = requete(), dossier = M.dossier === "TOUS" || M.client || M.dossier === "PROGRAMMES" ? "" : M.dossier;
      if (M.dossier === "TOUS" && !q) q = "-in:trash -in:spam";
      return Promise.all([
        appel({ action: "dossiers" }).then(function (r) { M.dossiers = r.dossiers || []; var i = M.dossiers.filter(function (d) { return d.id === "INBOX"; })[0]; S.mailsNonLus = i ? i.non_lus : 0; }),
        M.dossier === "PROGRAMMES" ? null : appel({ action: "fils", dossier: dossier, q: q, suite: plus ? M.suite : "" }).then(function (r) { M.fils = (plus ? M.fils : []).concat(r.fils || []); M.suite = r.suite; }),
        St.X.db.from("mails_programmes").select("id, envoyer_le, statut, erreur, contenu").in("statut", ["prevu", "erreur"]).order("envoyer_le").then(function (r) {
          M.programmes = (r.data || []).map(function (x) { var c = x.contenu || {}; return { id: x.id, envoyer_le: x.envoyer_le, statut: x.statut, erreur: x.erreur, a: c.a, objet: c.objet, html: c.html, cc: c.cc }; });
        })
      ]);
    }).catch(function (e) { M.erreur = e.message; }).then(function () { M.charge = false; });
  }
  function redessiner() { var z = document.getElementById("vue-mails"); if (z) { var y = (z.querySelector(".mx-liste") || {}).scrollTop; z.replaceWith(V.mails(S.route, true)); var l = document.querySelector("#vue-mails .mx-liste"); if (l && y) l.scrollTop = y; } }
  function dateCourte(d) { return St.memeJour(d, new Date()) ? St.hm(d) : (new Date(d).getFullYear() === new Date().getFullYear() ? St.fmt(d, { day: "numeric", month: "short" }) : St.fmt(d, { day: "numeric", month: "short", year: "2-digit" })); }

  // ======================================================================
  // La page
  // ======================================================================
  V.mails = function (r, sansCharger) {
    var q = (r && r.query) || {};
    if (q.message) { St.signaler(q.message, /impossible|refusée|expiré/i.test(q.message)); history.replaceState(null, "", "#mails"); M.boites = null; M.dossiers = []; }
    var page = el("div", { class: "vue-mails", id: "vue-mails" });
    // Gmail n'est interrogé qu'en arrivant sur la page (ou après une minute), pas à chaque rafraîchissement du studio
    if (!sansCharger && !M.charge && (M.hashCharge !== location.hash || Date.now() - (M.chargeLe || 0) > 60000)) { charger().then(redessiner); }
    var vac = St.vacancesActives();
    page.appendChild(St.entete(null, "Mails", M.boites && M.boites[0] ? M.boites[0].email + (St.X.demo ? " (démonstration)" : "") : null,
      M.boites && M.boites.length ? [
        el("button", { type: "button", class: "bascule" + (vac ? " active" : ""), title: "Réponse automatique, bandeau chez les clients, pause des notifications", onclick: function () { St.vacances(); } },
          [St.icone("soleil"), vac ? "En vacances jusqu'au " + St.fmt(vac.fin + "T12:00:00", { day: "numeric", month: "short" }) : "En vacances"]),
        el("button", { type: "button", class: "btn-plein", title: "Nouveau message (touche C)", onclick: function () { ecrire({}); } }, [St.icone("plume"), "Nouveau message"])] : null));
    if (M.boites && !M.boites.length) {
      page.appendChild(el("div", { class: "relier-boite" }, [St.icone("mail", "grande-ic"), el("h2", { text: "Reliez votre boîte Gmail" }),
        el("p", { text: "Vos mails arrivent ici, à côté de vos clients : lire, répondre, archiver, programmer, sans quitter le studio. Google vous demandera l'accès à Gmail ; rien n'est jamais effacé définitivement." }),
        el("button", { type: "button", class: "btn-plein", onclick: relier }, ["Relier ma boîte Gmail"])]));
      return page;
    }
    if (!M.boites) { page.appendChild(el("p", { class: "aside", text: "Ouverture de la boîte…" })); return page; }
    if (M.boites[0] && M.boites[0].erreur) page.appendChild(el("p", { class: "alerte-texte" }, ["La connexion à Gmail a un souci : " + M.boites[0].erreur + " ", el("button", { type: "button", class: "btn-texte", text: "Relier à nouveau", onclick: relier })]));
    page.appendChild(el("div", { class: "mx-cadre" + (M.ouvert ? " lecture" : "") }, [colonneDossiers(), colonneListe(), colonneLecture()]));
    return page;
  };

  function colonneDossiers() {
    var nav = el("nav", { class: "mx-dossiers", "aria-label": "Dossiers" });
    var lien = function (id, nomD, ic, compte, actif) {
      return el("button", { type: "button", class: "mx-dossier", "aria-current": actif ? "true" : null, onclick: function () {
        M.dossier = id; M.client = ""; M.q = ""; M.filtre = ""; M.ouvert = null; M.fil = null; M.sel = {}; M.curseur = -1; charger().then(redessiner);
      } }, [St.icone(ic), el("span", { text: nomD }), compte ? el("b", { text: String(compte) }) : null]);
    };
    var d = function (id) { return M.dossiers.filter(function (x) { return x.id === id; })[0] || {}; };
    var cur = function (id) { return !M.client && !M.q && M.dossier === id; };
    nav.appendChild(lien("INBOX", "Réception", "mail", d("INBOX").non_lus, cur("INBOX")));
    nav.appendChild(lien("STARRED", "Suivis", "etoile", null, cur("STARRED")));
    nav.appendChild(lien("PROGRAMMES", "Programmés", "horloge", M.programmes.filter(function (p) { return p.statut === "prevu"; }).length || null, cur("PROGRAMMES")));
    nav.appendChild(lien("SENT", "Envoyés", "envoyer", null, cur("SENT")));
    nav.appendChild(lien("DRAFT", "Brouillons", "plume", null, cur("DRAFT")));
    nav.appendChild(lien("TOUS", "Tous les messages", "archiver", null, cur("TOUS")));
    nav.appendChild(lien("SPAM", "Indésirables", "fermer", null, cur("SPAM")));
    nav.appendChild(lien("TRASH", "Corbeille", "corbeille", null, cur("TRASH")));
    var clients = St.espacesActifs().filter(function (e) { return St.X.demo || adressesClient(e).length; });
    if (clients.length) {
      nav.appendChild(el("p", { class: "mx-titre", text: "Clients" }));
      clients.forEach(function (e) {
        nav.appendChild(el("button", { type: "button", class: "mx-dossier", "aria-current": M.client === e.id ? "true" : null, onclick: function () {
          M.client = e.id; M.dossier = "TOUS"; M.q = ""; M.filtre = ""; M.ouvert = null; M.fil = null; M.sel = {}; charger().then(redessiner);
        } }, [el("i", { class: "pastille-client", style: { "--c": e.couleur } }), el("span", { text: e.nom })]));
      });
    }
    var perso = M.dossiers.filter(function (x) { return x.type === "perso"; });
    nav.appendChild(el("p", { class: "mx-titre" }, ["Libellés", el("button", { type: "button", class: "btn-icone petit", title: "Nouveau libellé", "aria-label": "Nouveau libellé", onclick: nouveauLibelle }, [St.icone("plus")])]));
    perso.forEach(function (x) { nav.appendChild(lien(x.id, x.nom, "etiquette", x.non_lus || null, cur(x.id))); });
    return nav;
  }
  function nouveauLibelle(cb) {
    var n = el("input", { type: "text", placeholder: "Nom du libellé" });
    St.fenetre({ titre: "Nouveau libellé", corps: [n], actions: [{ texte: "Annuler" }, { texte: "Créer", principal: true, action: function (f) {
      if (!n.value.trim()) return;
      if (St.X.demo) { f(); M.dossiers.push({ id: "Label_" + Date.now(), nom: n.value.trim(), type: "perso" }); redessiner(); return; }
      appel({ action: "nouveau_libelle", nom: n.value.trim() }).then(function (r) { f(); M.dossiers.push({ id: r.libelle.id, nom: r.libelle.name, type: "perso" }); if (typeof cb === "function") cb(r.libelle.id); redessiner(); }, function (e) { St.signaler(e.message, true); });
    } }] });
  }

  // ---------- La liste des conversations ----------
  function colonneListe() {
    var ids = Object.keys(M.sel).filter(function (k) { return M.sel[k]; });
    var recherche = el("form", { class: "mx-recherche", role: "search", onsubmit: function (ev) { ev.preventDefault(); M.q = champ.value.trim(); M.ouvert = null; M.fil = null; M.sel = {}; M.curseur = -1; charger().then(redessiner); } },
      [St.icone("oeil"), el("input", { type: "search", id: "mx-cherche", placeholder: "Rechercher (touche /) : mots, de:inès, has:attachment, after:2026/11/01…", value: M.q, "aria-label": "Rechercher dans les mails" })]);
    var champ = recherche.querySelector("input");
    var filtres = el("div", { class: "mx-filtres" }, [["", "Tout"], ["non_lus", "Non lus"], ["pieces", "Pièces jointes"], ["clients", "Clients"]].map(function (f) {
      return el("button", { type: "button", class: "puce" + (M.filtre === f[0] ? " active" : ""), onclick: function () { M.filtre = f[0]; M.sel = {}; charger().then(redessiner); } }, [f[1]]);
    }));
    var tous = M.fils.length && ids.length === M.fils.length;
    var outils = el("div", { class: "mx-outils" }, [
      el("input", { type: "checkbox", class: "coche", "aria-label": "Tout sélectionner", checked: !!tous, onchange: function (ev) { M.sel = {}; if (ev.target.checked) M.fils.forEach(function (f) { M.sel[f.id] = true; }); redessiner(); } }),
      ids.length ? el("span", { class: "mx-groupe" }, [
        el("small", { text: ids.length + " sélectionnée" + (ids.length > 1 ? "s" : "") }),
        outil("archiver", "Archiver (E)", function () { ranger(ids, "archiver"); }), outil("corbeille", "Corbeille (#)", function () { ranger(ids, "corbeille"); }),
        outil("lu", "Marquer comme lu (Maj+I)", function () { ranger(ids, "lu"); }), outil("mail", "Marquer comme non lu (Maj+U)", function () { ranger(ids, "non_lu"); }),
        outil("etoile", "Suivre (S)", function () { ranger(ids, "suivi"); }), outil("etiquette", "Libellé", function () { libeller(ids); }),
        outil("fermer", "Indésirable", function () { ranger(ids, "indesirable"); })
      ]) : el("span", { class: "mx-groupe" }, [outil("rafraichir", "Actualiser", function () { charger().then(redessiner); }),
        el("small", { text: M.charge ? "Chargement…" : M.fils.length ? M.fils.length + (M.suite ? "+" : "") + " conversation" + (M.fils.length > 1 ? "s" : "") : "" })]),
      el("button", { type: "button", class: "btn-icone petit", title: "Raccourcis clavier (?)", "aria-label": "Raccourcis clavier", onclick: aideClavier }, ["?"])
    ]);
    var corps;
    if (M.dossier === "PROGRAMMES") corps = listeProgrammes();
    else if (M.erreur) corps = el("p", { class: "alerte-texte mx-vide", text: M.erreur });
    else if (!M.fils.length) corps = M.charge ? el("p", { class: "aside mx-vide", text: "Chargement…" }) : St.vide(M.q || M.filtre || M.client ? "Aucune conversation ne correspond." : M.dossier === "INBOX" ? "Boîte de réception vide. Bravo !" : "Rien ici.");
    else corps = el("ul", { class: "mx-liste", role: "listbox", "aria-label": "Conversations" }, M.fils.map(function (f, i) { return ligneFil(f, i); }));
    return el("div", { class: "mx-colonne" }, [recherche, filtres, outils, corps,
      M.suite && M.dossier !== "PROGRAMMES" ? el("button", { type: "button", class: "btn-texte mx-plus", text: "Plus de conversations", onclick: function () { charger(true).then(redessiner); } }) : null]);
  }
  function outil(ic, titre, f) { return el("button", { type: "button", class: "btn-icone petit", title: titre, "aria-label": titre, onclick: f }, [St.icone(ic)]); }
  function ligneFil(f, i) {
    var e = clientDuFil(f), autres = f.de.filter(function (x) { return !moi(x); });
    var qui = (autres.length ? autres : f.de).slice(-3).map(function (x) { return moi(x) ? "moi" : nom(x).split(" ")[0]; });
    if (autres.length !== f.de.length && autres.length) qui.push("moi");
    var li = el("li", { class: "mx-fil" + (f.lu ? "" : " non-lu") + (M.ouvert === f.id ? " ouvert" : "") + (M.sel[f.id] ? " choisi" : "") + (M.curseur === i ? " curseur" : ""), role: "option", "aria-selected": M.ouvert === f.id ? "true" : "false" }, [
      el("input", { type: "checkbox", class: "coche", "aria-label": "Sélectionner", checked: !!M.sel[f.id], onclick: function (ev) { ev.stopPropagation(); }, onchange: function (ev) { M.sel[f.id] = ev.target.checked; redessiner(); } }),
      el("button", { type: "button", class: "mx-etoile" + (f.suivi ? " oui" : ""), "aria-label": f.suivi ? "Ne plus suivre" : "Suivre", "aria-pressed": f.suivi ? "true" : "false", onclick: function (ev) { ev.stopPropagation(); ranger([f.id], f.suivi ? "non_suivi" : "suivi"); } }, [St.icone("etoile")]),
      el("button", { type: "button", class: "mx-ouvrir", onclick: function () { M.curseur = i; ouvrir(f); } }, [
        el("span", { class: "mx-qui" }, [e ? el("i", { class: "pastille-client", style: { "--c": e.couleur }, title: e.nom }) : null,
          el("span", { text: Array.from(new Set(qui)).join(", ") }), f.nb > 1 ? el("small", { text: String(f.nb) }) : null]),
        el("span", { class: "mx-date" }, [f.pieces ? St.icone("trombone") : null, dateCourte(f.date)]),
        el("span", { class: "mx-sujet" }, [el("b", { text: f.objet || "(sans objet)" }), el("span", { text: " – " + (f.extrait || "") })])
      ]),
      el("span", { class: "mx-survol" }, [outil("archiver", "Archiver", function (ev) { ev.stopPropagation(); ranger([f.id], "archiver"); }),
        outil("corbeille", "Corbeille", function (ev) { ev.stopPropagation(); ranger([f.id], "corbeille"); }),
        outil(f.lu ? "mail" : "lu", f.lu ? "Marquer non lu" : "Marquer lu", function (ev) { ev.stopPropagation(); ranger([f.id], f.lu ? "non_lu" : "lu"); })])
    ]);
    return li;
  }
  function listeProgrammes() {
    if (!M.programmes.length) return St.vide("Aucun envoi programmé. Dans un message : flèche à côté d'Envoyer, puis « Programmer l'envoi ».");
    return el("ul", { class: "mx-liste" }, M.programmes.map(function (p) {
      return el("li", { class: "mx-fil programme" }, [St.icone("horloge"),
        el("div", { class: "mx-ouvrir statique" }, [el("span", { class: "mx-qui", text: "À " + (Array.isArray(p.a) ? p.a.join(", ") : p.a || "") }),
          el("span", { class: "mx-date", text: p.statut === "erreur" ? "Échec" : St.fmt(p.envoyer_le, { weekday: "short", day: "numeric", month: "short" }) + " " + St.hm(p.envoyer_le) }),
          el("span", { class: "mx-sujet" }, [el("b", { text: p.objet || "(sans objet)" }), p.erreur ? el("span", { class: "alerte-texte", text: " – " + p.erreur }) : null])]),
        el("span", { class: "mx-survol visible" }, [el("button", { type: "button", class: "btn-texte petit", text: "Annuler l'envoi", onclick: function () {
          St.X.db.from("mails_programmes").update({ statut: "annule" }).eq("id", p.id).then(function (r) {
            if (r.error) return St.signaler(r.error.message, true);
            M.programmes = M.programmes.filter(function (x) { return x.id !== p.id; }); St.signaler("Envoi programmé annulé");
            ecrire({ a: Array.isArray(p.a) ? p.a.join(", ") : p.a, cc: p.cc, objet: p.objet, html: p.html, sansSignature: true }); redessiner();
          });
        } })])]);
    }));
  }

  // ---------- Lecture d'une conversation ----------
  function ouvrir(f) {
    M.ouvert = f.id; M.images = false; M.etendus = {};
    if (!f.lu) { f.lu = true; if (S.mailsNonLus) S.mailsNonLus--; }
    if (St.X.demo) { M.fil = { id: f.id, messages: f.messages.map(function (m) { return Object.assign({}, m, { objet: f.objet }); }), lien: "#" }; f.messages.forEach(function (m) { m.lu = true; }); redessiner(); return; }
    M.fil = { chargement: true, id: f.id, objet: f.objet }; redessiner();
    appel({ action: "fil", id: f.id }).then(function (l) { if (M.ouvert === f.id) { M.fil = l; redessiner(); } })
      .catch(function (e) { M.fil = null; St.signaler(e.message, true); redessiner(); });
  }
  function filCourant() { return M.fils.filter(function (f) { return f.id === M.ouvert; })[0] || null; }
  function colonneLecture() {
    var zone = el("section", { class: "mx-lecteur", "aria-label": "Lecture" });
    if (!M.fil) { zone.appendChild(el("div", { class: "mx-accueil" }, [St.icone("mail", "grande-ic"), el("p", { text: "Choisissez une conversation." }),
      el("small", { text: "J et K pour descendre et monter, Entrée pour ouvrir, C pour écrire, ? pour tous les raccourcis." })])); return zone; }
    if (M.fil.chargement) { zone.appendChild(el("p", { class: "aside", text: "Ouverture de « " + (M.fil.objet || "") + " »…" })); return zone; }
    var f = filCourant() || { id: M.fil.id, suivi: false }, ms = M.fil.messages || [], dernier = ms[ms.length - 1] || {};
    var objet = (ms[0] || {}).objet || f.objet || "(sans objet)";
    var e = null; ms.forEach(function (m) { if (!e && !moi(m.de)) e = clientDe(m.de); });
    zone.appendChild(el("div", { class: "mx-barre-lecture" }, [
      el("button", { type: "button", class: "btn-icone mobile-seul", "aria-label": "Revenir à la liste", onclick: function () { M.ouvert = null; M.fil = null; redessiner(); } }, [St.icone("retour")]),
      outil("archiver", "Archiver (E)", function () { ranger([f.id], "archiver"); }), outil("corbeille", "Corbeille (#)", function () { ranger([f.id], "corbeille"); }),
      outil("mail", "Marquer non lu (Maj+U)", function () { ranger([f.id], "non_lu"); }),
      el("button", { type: "button", class: "btn-icone petit mx-etoile" + (f.suivi ? " oui" : ""), title: "Suivre (S)", "aria-label": "Suivre", onclick: function () { ranger([f.id], f.suivi ? "non_suivi" : "suivi"); } }, [St.icone("etoile")]),
      outil("etiquette", "Libellé", function () { libeller([f.id]); }),
      outil("taches", "Créer une tâche", function () { tache(objet, e, M.fil.lien); }),
      el("span", { class: "espace" }),
      M.fil.lien && M.fil.lien !== "#" ? el("a", { class: "btn-texte petit", href: M.fil.lien, target: "_blank", rel: "noopener", text: "Ouvrir dans Gmail" }) : null
    ]));
    zone.appendChild(el("h2", { class: "mx-objet", text: objet }));
    if (e) zone.appendChild(carteClient(e));
    var dernierOuvert = ms.length - 1;
    ms.forEach(function (m, i) {
      var ouvert = i === dernierOuvert || !m.lu || M.etendus[m.id];
      zone.appendChild(ouvert ? messageComplet(m) : el("button", { type: "button", class: "mx-message replie", onclick: function () { M.etendus[m.id] = true; redessiner(); } }, [
        avatar(m.de), el("b", { text: moi(m.de) ? "Moi" : nom(m.de) }), el("span", { class: "mx-extrait", text: m.extrait || "" }), el("small", { text: dateCourte(m.date) })]));
    });
    zone.appendChild(el("div", { class: "mx-repondre" }, [
      el("button", { type: "button", class: "btn-texte", onclick: function () { ecrire({ mode: "repondre", origine: dernier }); } }, [St.icone("retour"), "Répondre"]),
      el("button", { type: "button", class: "btn-texte", onclick: function () { ecrire({ mode: "repondre_tous", origine: dernier }); } }, ["Répondre à tous"]),
      el("button", { type: "button", class: "btn-texte", onclick: function () { ecrire({ mode: "transferer", origine: dernier }); } }, [St.icone("fleche"), "Transférer"])
    ]));
    return zone;
  }
  function avatar(de) { var e = clientDe(de); return el("span", { class: "avatar", style: { "--c": moi(de) ? "var(--terre)" : e ? e.couleur : "#8B8178" }, text: St.initiales(moi(de) ? (MARQUE.proprietaire || "L R") : nom(de)) }); }
  function carteClient(e) {
    var pubs = St.publicationsVisibles().filter(function (p) { return p.espace_id === e.id; });
    var aV = pubs.filter(function (p) { return p.statut === "a-valider"; }).length, modifs = pubs.filter(function (p) { return p.statut === "modifs-demandees"; }).length;
    var prochaine = pubs.filter(function (p) { return p.date_prevue && new Date(p.date_prevue) >= new Date(); }).sort(function (a, b) { return a.date_prevue.localeCompare(b.date_prevue); })[0];
    return el("a", { class: "mx-carte-client", href: "#" + e.slug, style: { "--c": e.couleur } }, [St.logoEspace(e, "petit"), el("span", {}, [el("b", { text: e.nom }),
      el("small", { text: [aV ? aV + " à valider" : null, modifs ? modifs + " à reprendre" : null, prochaine ? "prochaine : " + (prochaine.titre || "publication") + ", " + St.quand(prochaine.date_prevue) : null].filter(Boolean).join(" · ") || "Rien en attente" })]),
      St.icone("fleche")]);
  }
  function messageComplet(m) {
    var corps;
    if (m.html) {
      var html = m.html.replace(/cid:([^"'\s)]+)/g, function (x, cid) { return (m.images || {})[cid] || x; });
      // Tout ce qui viendrait d'ailleurs (images, srcset, fonds, styles, polices) est bloqué par une règle de sécurité
      // du cadre lui-même, pas seulement les balises <img> : rien ne peut signaler à l'expéditeur que le mail est lu.
      var bloque = !M.images && /(src|srcset|background|poster)\s*=\s*["']?\s*(https?:)?\/\/|url\(\s*["']?\s*(https?:)?\/\/|@import/i.test(html);
      if (bloque) html = html.replace(/(<img[^>]+)src=(["']?)https?:/gi, "$1data-bloque=$2https:");
      var cadre = el("iframe", { class: "mx-html", sandbox: "allow-popups allow-popups-to-escape-sandbox", title: "Contenu du mail", referrerpolicy: "no-referrer" });
      var regle = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; media-src data: blob:; img-src data: blob:" + (M.images ? " https: http:" : "");
      cadre.srcdoc = '<meta http-equiv="Content-Security-Policy" content="' + regle + '"><base target="_blank"><meta name="referrer" content="no-referrer"><style>body{font:14px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#1E1A17;background:#fff;margin:4px 2px;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin:0 0 0 .8ex;border-left:2px solid #ddd;padding-left:1ex;color:#555}</style>' + html;
      cadre.addEventListener("load", function () { try { cadre.style.height = Math.min(6000, cadre.contentDocument.documentElement.scrollHeight + 12) + "px"; } catch (x) { cadre.style.height = "60vh"; } });
      corps = el("div", {}, [bloque ? el("p", { class: "aside" }, ["Images distantes bloquées (elles peuvent servir à pister la lecture). ", el("button", { type: "button", class: "btn-texte petit", text: "Les afficher", onclick: function () { M.images = true; redessiner(); } })]) : null, cadre]);
    } else corps = el("div", { class: "mx-texte", text: m.texte || "" });
    var e = moi(m.de) ? null : clientDe(m.de);
    return el("article", { class: "mx-message" }, [
      el("header", {}, [avatar(m.de), el("span", { class: "mx-exp" }, [el("b", { text: moi(m.de) ? "Moi" : nom(m.de) }), el("small", { text: " <" + adresse(m.de) + ">" }),
        e ? el("a", { class: "puce-client", href: "#" + e.slug, style: { "--c": e.couleur } }, [el("i", { class: "pastille-client" }), e.nom]) : null,
        el("br"), el("small", { text: "à " + (m.a || "") + (m.cc ? " · cc " + m.cc : "") })]),
        el("small", { class: "mx-date-long", text: St.fmt(m.date, { weekday: "short", day: "numeric", month: "short" }) + " · " + St.hm(m.date) }),
        el("span", { class: "mx-actions-message" }, [outil("retour", "Répondre", function () { ecrire({ mode: "repondre", origine: m }); }), outil("fleche", "Transférer", function () { ecrire({ mode: "transferer", origine: m }); })])]),
      corps,
      (m.pieces || []).length ? el("div", { class: "mx-pieces" }, m.pieces.map(function (p) {
        return el("button", { type: "button", class: "mx-piece", onclick: function () { telecharger(m, p); } }, [St.icone(/^image\//.test(p.type || "") ? "publications" : "trombone"),
          el("span", {}, [el("b", { text: p.nom }), el("small", { text: Math.max(1, Math.round((p.taille || 0) / 1024)) + " Ko" })])]);
      })) : null
    ]);
  }
  function telecharger(m, p) {
    if (St.X.demo) return St.signaler("Pièce jointe de démonstration.");
    St.signaler("Téléchargement de « " + p.nom + " »…");
    appel({ action: "piece", id: m.id, piece: p.id }).then(function (x) {
      var octets = atob(x.contenu), tab = new Uint8Array(octets.length); for (var i = 0; i < octets.length; i++) tab[i] = octets.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([tab], { type: x.type || "application/octet-stream" }));
      if (/^(image\/|application\/pdf)/.test(x.type || "")) window.open(url, "_blank");
      else { var a = el("a", { href: url, download: x.nom }); document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }).catch(function (e) { St.signaler(e.message, true); });
  }
  function tache(objet, e, lien) {
    St.creer("taches", { titre: "Répondre : " + objet, notes: lien && lien !== "#" ? "Mail : " + lien : null, espace_id: e ? e.id : null, echeance: St.iso(new Date()), priorite: "moyenne", statut: "a-faire" })
      .then(function () { St.signaler("Tâche créée pour aujourd'hui"); });
  }

  // ---------- Ranger, libeller ----------
  function ranger(ids, quoi) {
    var sort = ["archiver", "corbeille", "indesirable"].indexOf(quoi) >= 0 && M.dossier !== "TOUS" || (quoi === "reception" && M.dossier !== "INBOX");
    var noms = { archiver: "Archivée", corbeille: "Mise à la corbeille", indesirable: "Signalée comme indésirable", lu: "Marquée comme lue", non_lu: "Marquée comme non lue", suivi: "Suivie", non_suivi: "Plus suivie", reception: "Remise dans la boîte" };
    ids.forEach(function (id) {
      var f = M.fils.filter(function (x) { return x.id === id; })[0]; if (!f) return;
      if (quoi === "lu") f.lu = true; if (quoi === "non_lu") f.lu = false; if (quoi === "suivi") f.suivi = true; if (quoi === "non_suivi") f.suivi = false;
      if (St.X.demo) { if (quoi === "archiver") f.archive = true; if (quoi === "corbeille") f.corbeille = true; }
    });
    var avant = M.fils.slice();
    if (sort) { M.fils = M.fils.filter(function (f) { return ids.indexOf(f.id) < 0; }); if (ids.indexOf(M.ouvert) >= 0) { M.ouvert = null; M.fil = null; } }
    if (quoi === "non_lu" && ids.indexOf(M.ouvert) >= 0) { M.ouvert = null; M.fil = null; }
    M.sel = {}; redessiner();
    var n = ids.length > 1 ? ids.length + " conversations : " : "";
    St.signaler(n + (noms[quoi] || "C'est fait").toLowerCase().replace(/^./, function (c) { return n ? c : c.toUpperCase(); }) + (quoi === "corbeille" ? " (récupérable 30 jours)" : ""));
    if (St.X.demo) return;
    appel({ action: "ranger", ids: ids, quoi: quoi }).catch(function (e) { St.signaler(e.message, true); M.fils = avant; redessiner(); });
  }
  function libeller(ids) {
    var perso = M.dossiers.filter(function (x) { return x.type === "perso"; });
    var choix = el("div", { class: "cases" }, perso.map(function (x) { return el("label", { class: "case" }, [el("input", { type: "checkbox", value: x.id }), x.nom]); }));
    St.fenetre({ titre: "Libellés", sous: ids.length > 1 ? ids.length + " conversations" : null, corps: [perso.length ? choix : el("p", { class: "aside", text: "Aucun libellé : créez-en un." }),
      el("button", { type: "button", class: "btn-texte", onclick: function () { document.querySelector("dialog[open]").close(); nouveauLibelle(function () { libeller(ids); }); } }, [St.icone("plus"), "Nouveau libellé"])],
      actions: [{ texte: "Annuler" }, { texte: "Appliquer", principal: true, action: function (f) {
        var ajout = Array.from(choix.querySelectorAll("input:checked")).map(function (x) { return x.value; }); f();
        if (!ajout.length) return;
        if (St.X.demo) return St.signaler("Libellé appliqué (démonstration)");
        appel({ action: "libeller", ids: ids, ajout: ajout, retrait: [] }).then(function () { St.signaler("Libellé appliqué"); charger().then(redessiner); }, function (e) { St.signaler(e.message, true); });
      } }] });
  }
  function relier() {
    if (St.X.demo) return St.signaler("En démonstration, aucune boîte n'est reliée.");
    St.X.db.functions.invoke("connexion-google", { body: {} }).then(function (r) {
      if (r.error || !r.data || !r.data.url) return St.signaler("Impossible d'ouvrir Google : " + ((r.data && r.data.erreur) || (r.error && r.error.message) || ""), true);
      location.href = r.data.url;
    });
  }
  St.relierGmail = relier;

  // ======================================================================
  // Rédaction : fenêtre en bas à droite, mise en forme, signature, réponses types, pièces jointes glissées,
  // brouillon enregistré tout seul, annulation d'envoi, envoi programmé
  // ======================================================================
  var redaction = null;
  function ecrire(o) {
    if (redaction && !confirm("Un message est déjà en cours d'écriture. Le remplacer ?")) return;
    if (redaction) redaction.fermer(true);
    var l = o.origine, mode = o.mode || "nouveau", brouillonId = o.brouillon_id || null, pieces = [], modifie = false, minuterie = null;
    var re = function (s) { return /^(re|tr|fwd)\s*:/i.test(s || "") ? s : (mode === "transferer" ? "Tr : " : "Re : ") + (s || ""); };
    var aDefaut = mode === "repondre" || mode === "repondre_tous" ? (moi(l.de) ? l.a : adresse(l.de)) : (o.a || "");
    var ccDefaut = mode === "repondre_tous" ? [l.a, l.cc].filter(Boolean).join(",").split(",").map(adresse).filter(function (x) { return x && !moi(x) && x !== adresse(aDefaut); }).join(", ") : (o.cc || "");
    var a = champAdresses(aDefaut, "À"), cc = champAdresses(ccDefaut, "Cc"), cci = champAdresses("", "Cci");
    var ligneCc = el("div", { class: "mx-ligne", hidden: !ccDefaut }, [el("span", { text: "Cc" }), cc.el]), ligneCci = el("div", { class: "mx-ligne", hidden: true }, [el("span", { text: "Cci" }), cci.el]);
    var objet = el("input", { type: "text", class: "mx-objet-champ", placeholder: "Objet", value: l ? re(l.objet) : (o.objet || ""), "aria-label": "Objet" });
    var sigs = St.signatures(), sigId = mode === "nouveau" ? sigs.nouveau : sigs.reponse;
    var sig = sigs.liste.filter(function (s) { return s.id === sigId; })[0];
    var depart = (o.html || "") + (o.sansSignature || !sig ? "" : '<p><br></p><div class="signature-mail" data-signature="' + sig.id + '">-- <br>' + sig.html + "</div>");
    var choixSig = sigs.liste.length ? el("select", { class: "petit", "aria-label": "Signature", title: "Signature", onchange: function () {
      var z = ed.zone.querySelector(".signature-mail"), s = sigs.liste.filter(function (x) { return x.id === choixSig.value; })[0];
      if (z) z.remove(); if (s) ed.zone.insertAdjacentHTML("beforeend", '<div class="signature-mail" data-signature="' + s.id + '">-- <br>' + s.html + "</div>");
    } }, [el("option", { value: "", text: "Sans signature" })].concat(sigs.liste.map(function (s) { return el("option", { value: s.id, selected: sig && s.id === sig.id, text: s.nom }); }))) : null;
    var modeles = St.modelesMail();
    var choixModele = modeles.length ? el("select", { class: "petit", "aria-label": "Réponse type", title: "Insérer une réponse type", onchange: function () {
      var m = modeles.filter(function (x) { return x.id === choixModele.value; })[0]; choixModele.value = ""; if (!m) return;
      ed.inserer(m.html); if (m.objet && !objet.value.trim()) objet.value = m.objet;
    } }, [el("option", { value: "", text: "Réponses types…" })].concat(modeles.map(function (m) { return el("option", { value: m.id, text: m.nom }); }))) : null;
    var fichier = el("input", { type: "file", multiple: true, hidden: true, onchange: function () { ajouterFichiers(fichier.files); fichier.value = ""; } });
    var ed = St.editeurRiche(depart, { label: "Message", aide: mode === "transferer" ? "Un mot avant le message transféré…" : "Votre message",
      extra: [el("span", { class: "espace" }), el("button", { type: "button", class: "btn-icone petit", title: "Joindre un fichier", "aria-label": "Joindre un fichier", onclick: function () { fichier.click(); } }, [St.icone("trombone")]), choixModele, choixSig] });
    var listePieces = el("div", { class: "mx-pieces-jointes" });
    function dessinerPieces() {
      listePieces.textContent = "";
      pieces.forEach(function (p, i) { listePieces.appendChild(el("span", { class: "puce" }, [St.icone("trombone"), p.nom + " · " + Math.max(1, Math.round(p.taille / 1024)) + " Ko",
        el("button", { type: "button", class: "btn-icone petit", "aria-label": "Retirer " + p.nom, onclick: function () { pieces.splice(i, 1); dessinerPieces(); } }, [St.icone("fermer")])])); });
      if (mode === "transferer" && l && (l.pieces || []).length) listePieces.appendChild(el("small", { class: "aside", text: "Les pièces jointes d'origine sont transférées." }));
    }
    function ajouterFichiers(files) {
      Array.prototype.forEach.call(files || [], function (f) {
        if (pieces.reduce(function (s, p) { return s + p.taille; }, 0) + f.size > 20e6) return St.signaler("20 Mo au plus de pièces jointes", true);
        var r = new FileReader(); r.onload = function () { pieces.push({ nom: f.name, type: f.type, taille: f.size, contenu: String(r.result).split(",")[1] }); dessinerPieces(); modifie = true; }; r.readAsDataURL(f);
      });
    }
    dessinerPieces();
    var titre = el("b", { text: mode === "nouveau" ? "Nouveau message" : mode === "transferer" ? "Transférer" : "Répondre" + (l ? " à " + (moi(l.de) ? nom(l.a) : nom(l.de)) : "") });
    var fen = el("section", { class: "mx-redaction", role: "dialog", "aria-label": "Rédaction",
      ondragover: function (ev) { ev.preventDefault(); fen.classList.add("survol"); }, ondragleave: function () { fen.classList.remove("survol"); },
      ondrop: function (ev) { ev.preventDefault(); fen.classList.remove("survol"); ajouterFichiers(ev.dataTransfer.files); } }, [
      el("header", { onclick: function (ev) { if (ev.target.closest("button")) return; fen.classList.toggle("reduite"); } }, [titre, el("span", { class: "espace" }),
        el("button", { type: "button", class: "btn-icone petit", title: "Réduire", "aria-label": "Réduire", onclick: function () { fen.classList.toggle("reduite"); } }, ["–"]),
        el("button", { type: "button", class: "btn-icone petit", title: "Agrandir", "aria-label": "Agrandir", onclick: function () { fen.classList.toggle("grande"); } }, ["⤢"]),
        el("button", { type: "button", class: "btn-icone petit", title: "Fermer (le brouillon est gardé)", "aria-label": "Fermer", onclick: function () { fermer(); } }, [St.icone("fermer")])]),
      el("div", { class: "mx-champs" }, [
        el("div", { class: "mx-ligne" }, [el("span", { text: "À" }), a.el, el("button", { type: "button", class: "btn-texte petit", text: "Cc Cci", onclick: function () { ligneCc.hidden = false; ligneCci.hidden = false; } })]),
        ligneCc, ligneCci, el("div", { class: "mx-ligne" }, [objet])]),
      ed.el, listePieces, fichier,
      el("footer", {}, [
        el("span", { class: "mx-envoyer" }, [
          el("button", { type: "button", class: "btn-plein", title: "Envoyer (Cmd+Entrée)", onclick: function () { partir(); } }, [St.icone("envoyer"), "Envoyer"]),
          el("button", { type: "button", class: "btn-plein mx-plus-envoi", title: "Programmer l'envoi", "aria-label": "Programmer l'envoi", onclick: function () { programmer(); } }, [St.icone("horloge")])]),
        el("small", { class: "mx-etat", id: "mx-etat" }),
        el("span", { class: "espace" }),
        el("button", { type: "button", class: "btn-icone petit", title: "Supprimer le brouillon", "aria-label": "Supprimer le brouillon", onclick: function () {
          if (!ed.vide() && !confirm("Abandonner ce message ?")) return; jeter();
        } }, [St.icone("corbeille")])])
    ]);
    document.body.appendChild(fen);
    [a, cc, cci].forEach(function (x) { x.input.addEventListener("input", function () { modifie = true; }); });
    objet.addEventListener("input", function () { modifie = true; }); ed.zone.addEventListener("input", function () { modifie = true; });
    fen.addEventListener("keydown", function (ev) { if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); partir(); } if (ev.key === "Escape") { ev.stopPropagation(); fermer(); } });
    setTimeout(function () { (mode === "repondre" || mode === "repondre_tous" ? ed.zone : a.input).focus(); if (mode !== "nouveau") { var r = document.createRange(); r.setStart(ed.zone, 0); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } }, 30);
    var etat = function (t) { var z = fen.querySelector(".mx-etat"); if (z) z.textContent = t; };
    function contenu() { return { mode: mode, origine: l ? l.id : null, a: a.valeur(), cc: cc.valeur(), cci: cci.valeur(), objet: objet.value, html: ed.html(), pieces: pieces.map(function (p) { return { nom: p.nom, type: p.type, contenu: p.contenu }; }) }; }
    // Brouillon gardé dans Gmail, toutes les 20 secondes après une modification
    minuterie = setInterval(function () { if (modifie && !St.X.demo && (a.valeur() || objet.value || !ed.vide())) brouillon(); }, 20000);
    function brouillon() {
      modifie = false; etat("Enregistrement…");
      return appel(Object.assign({ action: "brouillon", brouillon_id: brouillonId }, contenu())).then(function (r) { brouillonId = r.brouillon_id || brouillonId; etat("Brouillon enregistré " + St.hm(new Date())); }, function () { etat("Brouillon non enregistré"); modifie = true; });
    }
    function fermer(silencieux) {
      clearInterval(minuterie); fen.remove(); redaction = null;
      if (!silencieux && modifie && !St.X.demo && (a.valeur() || objet.value || !ed.vide())) brouillon().then(function () { St.signaler("Brouillon gardé dans Gmail"); });
    }
    function jeter() { clearInterval(minuterie); fen.remove(); redaction = null; St.signaler(brouillonId ? "Message abandonné (le brouillon reste dans Gmail > Brouillons)" : "Message abandonné"); }
    function verifier() {
      if (!a.valeur() && !cc.valeur() && !cci.valeur()) { a.input.focus(); St.signaler("Ajoutez au moins un destinataire", true); return false; }
      if (!objet.value.trim() && !confirm("Envoyer sans objet ?")) { objet.focus(); return false; }
      if (/pi[eè]ce jointe|ci-joint|en pj\b/i.test(ed.zone.textContent) && !pieces.length && mode !== "transferer" && !confirm("Vous parlez d'une pièce jointe, mais il n'y en a pas. Envoyer quand même ?")) return false;
      return true;
    }
    // Envoyer, avec quelques secondes pour se raviser (réglable dans Réglages > Mails)
    function partir() {
      if (!verifier()) return;
      var c = contenu(), delai = St.reglagesMails().annulation, annule = false;
      clearInterval(minuterie); fen.hidden = true;
      var envoi = function () {
        if (annule) return;
        fen.remove(); redaction = null;
        if (St.X.demo) return St.signaler("En démonstration, rien n'est envoyé.");
        appel(Object.assign({ action: "envoyer", brouillon_id: brouillonId }, c)).then(function () { St.signaler("Message envoyé"); if (M.dossier === "SENT" || M.ouvert) charger().then(function () { if (M.ouvert) { var f = filCourant(); if (f) ouvrir(f); } else redessiner(); }); },
          function (e) { St.signaler("Non envoyé : " + e.message, true); fen.hidden = false; document.body.appendChild(fen); redaction = api; });
      };
      if (!delai) return envoi();
      var t = setTimeout(envoi, delai * 1000);
      toastAnnuler("Envoi dans " + delai + " s", function () { annule = true; clearTimeout(t); fen.hidden = false; St.signaler("Envoi annulé : le message est rouvert"); }, delai);
    }
    function programmer() {
      if (!verifier()) return;
      var demain = new Date(); demain.setDate(demain.getDate() + 1); demain.setHours(8, 0, 0, 0);
      var lundi = St.lundi(St.ajouterJours(new Date(), 7)); lundi.setHours(8, 0, 0, 0);
      var apresMidi = new Date(); apresMidi.setHours(14, 0, 0, 0); if (apresMidi < new Date()) apresMidi = null;
      var jour = el("input", { type: "date", value: St.iso(demain), "aria-label": "Jour" }), heure = el("input", { type: "time", value: "08:00", "aria-label": "Heure" });
      var vite = [apresMidi && ["Cet après-midi, 14 h", apresMidi], ["Demain, 8 h", demain], ["Lundi, 8 h", lundi]].filter(Boolean);
      var go = function (quand, fermerF) {
        if (quand < new Date()) return St.signaler("Choisissez un moment à venir", true);
        fermerF();
        if (St.X.demo) { clearInterval(minuterie); fen.remove(); redaction = null; return St.signaler("Démonstration : envoi programmé pour " + St.fmt(quand, { weekday: "long", day: "numeric", month: "long" }) + " " + St.hm(quand)); }
        appel(Object.assign({ action: "programmer", envoyer_le: quand.toISOString(), brouillon_id: brouillonId }, contenu())).then(function () {
          clearInterval(minuterie); fen.remove(); redaction = null;
          St.signaler("Envoi programmé : " + St.fmt(quand, { weekday: "long", day: "numeric", month: "long" }) + " à " + St.hm(quand)); charger().then(redessiner);
        }, function (e) { St.signaler(e.message, true); });
      };
      St.fenetre({ titre: "Programmer l'envoi", sous: "Le message partira tout seul depuis votre boîte, même ordinateur éteint.", corps: [
        el("div", { class: "pile-serree" }, vite.map(function (v) { return el("button", { type: "button", class: "choix-envoi", onclick: function () { go(v[1], function () { document.querySelector("dialog[open]").close(); }); } }, [el("b", { text: v[0] }), el("small", { text: St.fmt(v[1], { weekday: "long", day: "numeric", month: "long" }) })]); })),
        el("div", { class: "deux-colonnes" }, [jour, heure])],
        actions: [{ texte: "Annuler" }, { texte: "Programmer", principal: true, action: function (f) { var d = new Date(jour.value + "T" + (heure.value || "08:00") + ":00"); go(d, f); } }] });
    }
    var api = { fermer: fermer };
    redaction = api;
  }
  // Champ d'adresses avec propositions : clients (membres des espaces) et correspondants récents
  function champAdresses(valeur, libelle) {
    var input = el("input", { type: "text", value: valeur || "", "aria-label": libelle, autocomplete: "off", spellcheck: "false" });
    var menu = el("ul", { class: "mx-propositions", hidden: true, role: "listbox" });
    var contacts = function () {
      var vus = {}, l = [];
      S.personnes.forEach(function (p) { if (p.email && p.role !== "proprietaire" && !vus[p.email.toLowerCase()]) { vus[p.email.toLowerCase()] = 1; var m = S.membres.filter(function (x) { return x.personne_id === p.id; })[0]; l.push({ nom: p.nom, email: p.email, e: m && St.espace(m.espace_id) }); } });
      M.fils.forEach(function (f) { f.de.forEach(function (d) { var ad = adresse(d); if (ad && !moi(d) && !vus[ad]) { vus[ad] = 1; l.push({ nom: nom(d), email: ad }); } }); });
      return l;
    };
    var choisir = function (c) { var parts = input.value.split(","); parts[parts.length - 1] = " " + c.email; input.value = parts.join(",").replace(/^\s+/, "") + ", "; menu.hidden = true; input.focus(); };
    input.addEventListener("input", function () {
      var t = input.value.split(",").pop().trim().toLowerCase(); menu.textContent = "";
      if (t.length < 2) { menu.hidden = true; return; }
      var r = contacts().filter(function (c) { return (c.nom + " " + c.email).toLowerCase().indexOf(t) >= 0; }).slice(0, 6);
      r.forEach(function (c) { menu.appendChild(el("li", { role: "option", onmousedown: function (ev) { ev.preventDefault(); choisir(c); } }, [el("b", { text: c.nom || c.email }), el("small", { text: c.email + (c.e ? " · " + c.e.nom : "") })])); });
      menu.hidden = !r.length;
    });
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !menu.hidden && menu.firstChild) { ev.preventDefault(); menu.firstChild.dispatchEvent(new MouseEvent("mousedown")); } });
    input.addEventListener("blur", function () { setTimeout(function () { menu.hidden = true; }, 150); });
    return { el: el("div", { class: "mx-adresses" }, [input, menu]), input: input, valeur: function () { return input.value.split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean).join(", "); } };
  }
  function toastAnnuler(texte, annuler, secondes) {
    var t = el("div", { class: "toast vu mx-toast", role: "status" }, [el("span", { text: texte }), el("button", { type: "button", class: "btn-texte", text: "Annuler", onclick: function () { t.remove(); annuler(); } })]);
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, secondes * 1000);
  }

  // ======================================================================
  // Raccourcis clavier façon Gmail (page Mails seulement)
  // ======================================================================
  var RACCOURCIS = [["C", "Nouveau message"], ["/", "Rechercher"], ["J / K", "Conversation suivante / précédente"], ["Entrée ou O", "Ouvrir"], ["U", "Revenir à la liste"],
    ["E", "Archiver"], ["#", "Corbeille"], ["R", "Répondre"], ["A", "Répondre à tous"], ["F", "Transférer"], ["S", "Suivre"], ["X", "Sélectionner"],
    ["Maj+I / Maj+U", "Marquer lu / non lu"], ["Cmd+Entrée", "Envoyer (dans un message)"], ["?", "Cette aide"]];
  function aideClavier() {
    St.fenetre({ titre: "Raccourcis clavier", classe: "large", corps: [el("div", { class: "table-defile" }, [el("table", { class: "table-chiffres" }, [el("tbody", {}, RACCOURCIS.map(function (r) { return el("tr", {}, [el("td", {}, [el("kbd", { text: r[0] })]), el("td", { text: r[1] })]); }))])])], actions: [{ texte: "Fermer" }] });
  }
  V.toucheMails = function (ev) {
    if (redaction && document.querySelector(".mx-redaction:not([hidden])") && document.activeElement && document.activeElement.closest(".mx-redaction")) return false;
    var k = ev.key, f = M.fils[M.curseur], courant = filCourant() || f;
    var dernier = M.fil && M.fil.messages && M.fil.messages[M.fil.messages.length - 1];
    if (k === "c" || k === "C" && !ev.shiftKey) { ecrire({}); return true; }
    if (k === "/") { var c = document.getElementById("mx-cherche"); if (c) c.focus(); return true; }
    if (k === "?") { aideClavier(); return true; }
    if (k === "j" || k === "k") { M.curseur = Math.max(0, Math.min(M.fils.length - 1, M.curseur + (k === "j" ? 1 : -1))); if (M.ouvert && M.fils[M.curseur]) ouvrir(M.fils[M.curseur]); else redessiner(); var li = document.querySelector(".mx-fil.curseur"); if (li) li.scrollIntoView({ block: "nearest" }); return true; }
    if ((k === "o" || k === "Enter") && f) { ouvrir(f); return true; }
    if (k === "u" && M.ouvert) { M.ouvert = null; M.fil = null; redessiner(); return true; }
    if (k === "e" && courant) { ranger([courant.id], "archiver"); return true; }
    if (k === "#" && courant) { ranger([courant.id], "corbeille"); return true; }
    if (k === "s" && courant) { ranger([courant.id], courant.suivi ? "non_suivi" : "suivi"); return true; }
    if (k === "x" && f) { M.sel[f.id] = !M.sel[f.id]; redessiner(); return true; }
    if (k === "I" && ev.shiftKey && courant) { ranger([courant.id], "lu"); return true; }
    if (k === "U" && ev.shiftKey && courant) { ranger([courant.id], "non_lu"); return true; }
    if (dernier && (k === "r" || k === "a" || k === "f")) { ecrire({ mode: k === "r" ? "repondre" : k === "a" ? "repondre_tous" : "transferer", origine: dernier }); return true; }
    return false;
  };
  // Nouveaux mails : la liste se met à jour toute seule chaque minute quand la page est ouverte
  setInterval(function () {
    if (!St.X.demarre || St.X.demo || S.route.nom !== "mails" || M.charge || document.hidden || St.enSaisie() || redaction || Object.keys(M.sel).some(function (k) { return M.sel[k]; })) return;
    var avant = (M.fils[0] || {}).id;
    charger().then(function () { if ((M.fils[0] || {}).id !== avant) redessiner(); });
  }, 60000);
  St.ecrireMail = ecrire;
})(window.Studio);
