/* Comptabilité et suivi (22/11/2026), Lili seule : #compta?mois=AAAA-MM
   - ce qu'elle déclare à l'URSSAF ce mois-ci (chiffre encaissé HT) et les cotisations estimées ;
   - la TVA à mettre de côté (collectée sur ses encaissements, moins la TVA déductible qu'elle note) ;
   - son chiffre de l'année face au plafond de la micro-entreprise ;
   - les factures automatiques de fin de mois (un brouillon par client au forfait), émises et envoyées en un clic
     depuis sa boîte Gmail, PDF joint ; le suivi des factures (envoyée, en retard, relance, payée) ;
   - son compte pro Revolut Business relié en lecture seule : opérations, rapprochement avec les factures.
   Les taux sont des réglages (Réglages de la page) : rien n'est envoyé à l'URSSAF ni aux impôts, c'est un tableau de bord. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  // Micro-entreprise, activité libérale (SSI), 2026 : à vérifier chaque année (Réglages de la page)
  var DEFAUTS = { taux_cotisations: 25.6, taux_cfp: 0.2, versement_liberatoire: false, taux_vl: 2.2, plafond: 83600, regime_tva: "simplifie", deductible: {} };

  function reglage(cle) { return ((S.reglages.filter(function (r) { return r.cle === cle; })[0] || {}).valeur) || {}; }
  function cfg() { return Object.assign({}, DEFAUTS, reglage("compta")); }
  function euros(x) { return St.aides.euros(x); }
  function arrondi(x) { return Math.round((+x || 0) * 100) / 100; }
  function moisDe(d) { return String(d || "").slice(0, 7); }
  function nomMois(m, court) { var p = m.split("-"); var n = MOIS[+p[1] - 1]; return (court ? n : n.charAt(0).toUpperCase() + n.slice(1)) + " " + p[0]; }
  function decaler(m, n) { var p = m.split("-"), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function dernierJour(m) { var p = m.split("-"); return new Date(+p[0], +p[1], 0); }
  function moisCourant() { return St.iso(new Date()).slice(0, 7); }
  function espaceNom(f) { var e = f.espace_id && St.espace(f.espace_id); return e ? e.nom : "Sans client"; }
  function adresseFacturation(f) {
    var pr = f.espace_id && St.prive ? (St.prive(f.espace_id) || {}) : {};
    if (pr.email_facturation) return pr.email_facturation;
    var m = S.membres.filter(function (x) { return x.espace_id === f.espace_id && x.role === "client"; }).map(function (x) { return St.personne(x.personne_id); }).filter(function (p) { return p && p.email; })[0];
    return m ? m.email : "";
  }

  // ---------- Les chiffres d'un mois ----------
  function encaisseesDu(m) { return S.factures.filter(function (f) { return f.payee_le && moisDe(f.payee_le) === m && f.statut !== "annulee"; }); }
  function chiffres(m) {
    var c = cfg(), fs = encaisseesDu(m);
    var ht = arrondi(fs.reduce(function (s, f) { return s + (+f.total_ht || 0); }, 0)), tva = arrondi(fs.reduce(function (s, f) { return s + (+f.total_tva || 0); }, 0));
    var taux = (+c.taux_cotisations || 0) + (+c.taux_cfp || 0) + (c.versement_liberatoire ? (+c.taux_vl || 0) : 0);
    var cotisations = arrondi(ht * taux / 100), deductible = arrondi((c.deductible || {})[m] || 0);
    var annee = m.slice(0, 4), caAnnee = arrondi(S.factures.filter(function (f) { return f.payee_le && String(f.payee_le).slice(0, 4) === annee && f.statut !== "annulee"; })
      .reduce(function (s, f) { return s + (+f.total_ht || 0); }, 0));
    return { factures: fs, ht: ht, tva: tva, taux: taux, cotisations: cotisations, deductible: deductible, tvaNette: arrondi(Math.max(0, tva - deductible)), caAnnee: caAnnee, plafond: +c.plafond || 0, c: c };
  }

  // Pastille de la barre latérale : factures du mois prêtes à envoyer, ou factures en retard
  V.comptaAlerte = function () {
    var auj = St.iso(new Date());
    return S.factures.filter(function (f) { return (f.auto_mois && f.statut === "brouillon") || (f.statut === "emise" && f.echeance && f.echeance < auj); }).length;
  };

  // ======================================================================
  // La page
  // ======================================================================
  V.compta = function (r) {
    var q = r.query || {}, m = /^\d{4}-\d{2}$/.test(q.mois || "") ? q.mois : moisCourant(), k = chiffres(m);
    if (q.banque) { St.signaler(q.banque === "ok" ? "Compte Revolut relié : les opérations arrivent" : "Liaison Revolut impossible : " + q.banque, q.banque !== "ok"); history.replaceState(null, "", "#compta"); }
    var page = el("div", { class: "vue-compta pile" });
    var aller = function (n) { St.aller("compta?mois=" + decaler(m, n)); };
    page.appendChild(St.entete(null, "Comptabilité", "Ce qu'il faut déclarer, mettre de côté et envoyer. Un tableau de bord : rien ne part sans vous.", [
      el("span", { class: "compta-mois" }, [
        el("button", { type: "button", class: "btn-icone", "aria-label": "Mois précédent", onclick: function () { aller(-1); } }, [St.icone("retour")]),
        el("b", { text: nomMois(m) }),
        el("button", { type: "button", class: "btn-icone retourne", "aria-label": "Mois suivant", onclick: function () { aller(1); } }, [St.icone("retour")])]),
      el("button", { type: "button", class: "btn-texte", onclick: reglagesCompta }, [St.icone("reglages"), "Taux et régime"])]));

    // Les quatre chiffres
    var echeanceUrssaf = dernierJour(decaler(m, 1));
    var part = k.plafond ? Math.min(100, Math.round(k.caAnnee / k.plafond * 100)) : 0;
    page.appendChild(el("div", { class: "compta-cartes" }, [
      carteChiffre("URSSAF · à déclarer", euros(k.ht), "Chiffre encaissé HT en " + nomMois(m, true) + ". Cotisations estimées : " + euros(k.cotisations) + " (" + String(arrondi(k.taux)).replace(".", ",") + " %).",
        "Déclaration avant le " + St.fmt(echeanceUrssaf, { day: "numeric", month: "long" }), "https://autoentrepreneur.urssaf.fr", "terre"),
      carteChiffre("TVA à mettre de côté", euros(k.tvaNette), "Collectée sur vos encaissements : " + euros(k.tva) + (k.deductible ? " · déductible notée : " + euros(k.deductible) : "") + ".",
        regimeTva(k.c, m) === "mensuel" ? "Déclaration CA3 le mois suivant" : regimeTva(k.c, m) === "trimestriel" ? "Déclaration CA3 à la fin du trimestre" : "Acomptes en juillet et décembre, CA12 en mai", null, "encre",
        el("button", { type: "button", class: "btn-texte petit", onclick: function () { noterDeductible(m); } }, [St.icone("plume"), "Noter la TVA déductible"])),
      carteChiffre("À mettre de côté", euros(arrondi(k.cotisations + k.tvaNette)), "Cotisations URSSAF" + (k.c.versement_liberatoire ? " et impôt (versement libératoire)" : "") + " + TVA du mois.", null, null, "creme"),
      carteChiffre("Chiffre " + m.slice(0, 4), euros(k.caAnnee), k.plafond ? part + " % du plafond de la micro-entreprise (" + euros(k.plafond) + ")." : "", null, null, "",
        k.plafond ? el("div", { class: "jauge" + (part >= 90 ? " depasse" : "") }, [el("i", { style: { width: part + "%" } })]) : null)
    ]));

    page.appendChild(blocFacturesDuMois(m));
    page.appendChild(blocSuivi());
    page.appendChild(blocBanque(m));
    if (k.factures.length) page.appendChild(el("section", { class: "bloc" }, [el("header", {}, [el("h2", { text: "Encaissé en " + nomMois(m, true) }), el("span", { class: "compte", text: String(k.factures.length) })]),
      el("ul", { class: "liste-compta" }, k.factures.map(function (f) {
        return el("li", {}, [el("span", { class: "mono", text: St.fmt(f.payee_le + (String(f.payee_le).length === 10 ? "T12:00:00" : ""), { day: "numeric", month: "short" }) }),
          el("span", { text: "Facture " + (f.numero || "") + " · " + espaceNom(f) }), el("span", { class: "mono", text: euros(f.total_ht) + " HT" }), el("b", { class: "mono", text: euros(f.total_ttc) })]);
      }))]));
    return page;
  };
  // Le régime simplifié de TVA disparaît au 1er janvier 2027 (loi de finances 2025) : déclaration trimestrielle ensuite
  function regimeTva(c, m) { return c.regime_tva === "simplifie" && m >= "2027-01" ? "trimestriel" : c.regime_tva; }
  function carteChiffre(titre, valeur, phrase, echeance, lien, ton, extra) {
    return el("article", { class: "compta-carte " + (ton || "") }, [el("small", { class: "compta-etiquette", text: titre }), el("b", { class: "compta-valeur", text: valeur }),
      el("p", { text: phrase }), echeance ? el("p", { class: "compta-echeance" }, [St.icone("horloge"), echeance]) : null,
      lien ? el("a", { class: "btn-texte petit", href: lien, target: "_blank", rel: "noopener" }, [St.icone("fleche"), "Déclarer sur le site de l'URSSAF"]) : null, extra || null]);
  }

  // ---------- Factures automatiques de fin de mois ----------
  function blocFacturesDuMois(m) {
    var auto = S.factures.filter(function (f) { return f.auto_mois === m; });
    var aEnvoyer = auto.filter(function (f) { return f.statut === "brouillon" || (f.statut === "emise" && !f.envoyee_le); });
    var clientsAuto = S.prives.filter(function (p) { var e = St.espace(p.espace_id); return p.facture_auto && e && e.statut === "actif" && +p.forfait_mensuel_ht > 0; });
    var fin = dernierJour(m);
    return el("section", { class: "bloc" }, [
      el("header", {}, [el("h2", { text: "Factures de fin de mois" }), el("span", { class: "compte", text: auto.length + " / " + clientsAuto.length }),
        el("button", { type: "button", class: "btn-texte bloc-lien", onclick: function () { preparer(m); } }, [St.icone("plus"), "Préparer maintenant"])]),
      el("p", { class: "aide", text: clientsAuto.length ? "Le " + St.fmt(fin, { day: "numeric", month: "long" }) + " au matin, un brouillon est préparé pour chaque client au forfait (" + clientsAuto.map(function (p) { return St.espace(p.espace_id).nom; }).join(", ") + "). Vous relisez, puis un clic les émet et les envoie depuis votre boîte Gmail, PDF joint."
        : "Aucun client en facture automatique : dans la fiche d'un client (bouton « Fiche »), cochez « Facture automatique en fin de mois » et indiquez son forfait mensuel." }),
      auto.length ? el("ul", { class: "liste-compta" }, auto.map(function (f) {
        var a = adresseFacturation(f);
        return el("li", {}, [el("span", { text: espaceNom(f) }), el("small", { class: a ? "" : "alerte-texte", text: a || "pas d'adresse de facturation" }), el("b", { class: "mono", text: euros(f.total_ttc) }),
          el("span", { class: "etat-piece e-" + f.statut, text: f.envoyee_le ? "Envoyée" : f.statut === "brouillon" ? "À relire" : "Émise" }),
          el("span", { class: "actions-ligne" }, [f.statut === "brouillon" ? el("button", { type: "button", class: "btn-texte", text: "Relire", onclick: function () { St.aides.editerPiece("factures", f); } }) : null,
            el("button", { type: "button", class: "btn-texte", onclick: function () { St.ouvrirPdfPiece("factures", f); } }, [St.icone("imprimer"), "PDF"])])]);
      })) : null,
      aEnvoyer.length ? el("div", { class: "actions-ligne", style: { "justify-content": "flex-end", "margin-top": "12px" } }, [
        el("button", { type: "button", class: "btn-plein", onclick: function () { emettreEtEnvoyer(aEnvoyer); } }, [St.icone("envoyer"), "Émettre et envoyer " + (aEnvoyer.length > 1 ? "les " + aEnvoyer.length + " factures" : "la facture")])]) : null
    ]);
  }
  function preparer(m) {
    if (St.X.demo) {
      var n = 0, noms = MOIS[+m.slice(5) - 1];
      S.prives.forEach(function (p) {
        var e = St.espace(p.espace_id); if (!p.facture_auto || !e || e.statut !== "actif" || !(+p.forfait_mensuel_ht > 0)) return;
        if (S.factures.some(function (f) { return f.espace_id === e.id && f.auto_mois === m; })) return;
        var ht = +p.forfait_mensuel_ht; n++;
        St.creer("factures", { espace_id: e.id, objet: "Community management", periode: noms.charAt(0).toUpperCase() + noms.slice(1) + " " + m.slice(0, 4), statut: "brouillon", auto_mois: m,
          lignes: [{ libelle: p.facture_libelle || "Prestation social media & community manager", quantite: 1, prix_ht: ht, tva: 20 }], total_ht: ht, total_tva: arrondi(ht * .2), total_ttc: arrondi(ht * 1.2) });
      });
      St.signaler(n ? n + " facture" + (n > 1 ? "s" : "") + " préparée" + (n > 1 ? "s" : "") : "Rien à préparer : chaque client au forfait a déjà sa facture du mois"); St.dessiner(false); return;
    }
    var p = m.split("-");
    St.X.db.rpc("preparer_factures_du_mois", { p_jour: St.iso(new Date(+p[0], +p[1] - 1, 15)) }).then(function (r) {
      if (r.error) return St.signaler(r.error.message, true);
      St.signaler(r.data ? r.data + " facture" + (r.data > 1 ? "s" : "") + " préparée" + (r.data > 1 ? "s" : "") + " (brouillons)" : "Rien à préparer : chaque client au forfait a déjà sa facture du mois");
      St.charger(["factures"]).then(function () { St.dessiner(false); });
    });
  }
  function base64(blob) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1]); }; r.onerror = ko; r.readAsDataURL(blob); }); }
  function corpsMail(f, relance) {
    var ent = St.aides.entreprise(), E = St.aides.echapper, sg = St.signatures ? St.signatures() : null, sig = sg && sg.liste.filter(function (s) { return s.id === sg.nouveau; })[0];
    var n = f.numero ? " n° " + E(String(f.numero)) : "";
    var txt = relance
      ? "<p>Bonjour,</p><p>Sauf erreur de ma part, la facture" + n + " du " + St.fmt(f.date_facture + "T12:00:00", { day: "numeric", month: "long" }) + " (" + E(euros(f.total_ttc)) + ") n'a pas encore été réglée. Je vous la remets en pièce jointe.</p><p>Merci par avance,</p>"
      : "<p>Bonjour,</p><p>Veuillez trouver ci-joint la facture" + n + (f.periode ? " pour " + E(f.periode.toLowerCase()) : "") + ", d'un montant de " + E(euros(f.total_ttc)) + ".</p><p>Belle journée,</p>";
    return txt + (sig ? '<p><br></p><div class="signature-mail">-- <br>' + sig.html + "</div>" : "<p>" + E(ent.nom || "") + "</p>");
  }
  function objetMail(f, relance) { var ent = St.aides.entreprise(); return (relance ? "Relance : facture" : "Facture") + (f.numero ? " n° " + f.numero : "") + (f.periode ? " · " + f.periode : "") + (ent.nom ? " · " + ent.nom : ""); }
  // Envoie une facture (émise) depuis la boîte Gmail de Lili, PDF joint, puis note l'envoi
  function envoyer(f, relance) {
    var a = adresseFacturation(f); if (!a) return Promise.reject(new Error(espaceNom(f) + " : pas d'adresse de facturation (fiche du client)"));
    if (St.X.demo) return St.maj("factures", f.id, relance ? { relancee_le: new Date().toISOString() } : { envoyee_le: new Date().toISOString() });
    return St.pdfPiece("factures", f).then(base64).then(function (c) {
      return St.appel("messagerie", { action: "envoyer", mode: "nouveau", a: a, objet: objetMail(f, relance), html: corpsMail(f, relance), pieces: [{ nom: St.nomPdfPiece("factures", f), type: "application/pdf", contenu: c }] });
    }).then(function () { return St.maj("factures", f.id, relance ? { relancee_le: new Date().toISOString() } : { envoyee_le: new Date().toISOString() }); });
  }
  function emettreEtEnvoyer(liste) {
    var sans = liste.filter(function (f) { return !adresseFacturation(f); });
    St.fenetre({ titre: "Émettre et envoyer " + (liste.length > 1 ? liste.length + " factures" : "la facture") + " ?", classe: "large",
      sous: "Chaque facture reçoit son numéro (elle ne se modifie plus ensuite), puis part depuis votre boîte Gmail avec son PDF.",
      corps: [el("ul", { class: "liste-compta" }, liste.map(function (f) { var a = adresseFacturation(f); return el("li", {}, [el("span", { text: espaceNom(f) }), el("small", { class: a ? "" : "alerte-texte", text: a || "pas d'adresse : ignorée" }), el("b", { class: "mono", text: euros(f.total_ttc) })]); })),
        sans.length ? el("p", { class: "aide", text: "Ajoutez l'adresse de facturation dans la fiche du client pour l'inclure." }) : null],
      actions: [{ texte: "Annuler" }, { texte: "Émettre et envoyer", principal: true, action: function (fermer) {
        fermer();
        var ok = 0, erreurs = [], auj = new Date(), ech = St.iso(St.ajouterJours(auj, 30));
        liste.filter(function (f) { return adresseFacturation(f); }).reduce(function (suite, f) {
          return suite.then(function () {
            var emise = f.statut === "brouillon" ? St.maj("factures", f.id, { statut: "emise", date_facture: St.iso(auj), echeance: f.echeance || ech }).then(function (x) { if (x) Object.assign(f, x); }) : Promise.resolve();
            return emise.then(function () { return envoyer(f, false); }).then(function () { ok++; St.signaler("Facture " + (f.numero || "") + " envoyée à " + espaceNom(f)); }, function (e) { erreurs.push(espaceNom(f) + " : " + e.message); });
          });
        }, Promise.resolve()).then(function () {
          St.signaler(ok + " facture" + (ok > 1 ? "s" : "") + " envoyée" + (ok > 1 ? "s" : "") + (erreurs.length ? " · " + erreurs.join(" ; ") : ""), !!erreurs.length);
          St.dessiner(false);
        });
      } }] });
  }

  // ---------- Suivi : émises non payées ----------
  function blocSuivi() {
    var auj = St.iso(new Date());
    var fs = S.factures.filter(function (f) { return f.statut === "emise"; }).sort(function (a, b) { return String(a.echeance || "").localeCompare(String(b.echeance || "")); });
    var du = arrondi(fs.reduce(function (s, f) { return s + (+f.total_ttc || 0); }, 0));
    return el("section", { class: "bloc" }, [
      el("header", {}, [el("h2", { text: "À encaisser" }), el("span", { class: "compte", text: fs.length ? fs.length + " · " + euros(du) : "0" })]),
      fs.length ? el("div", { class: "table-defile" }, [el("table", { class: "table-chiffres pieces" }, [
        el("thead", {}, [el("tr", {}, [el("th", { text: "N°" }), el("th", { text: "Client" }), el("th", { text: "Échéance" }), el("th", { class: "n", text: "TTC" }), el("th", { text: "Suivi" }), el("th", { text: "" })])]),
        el("tbody", {}, fs.map(function (f) {
          var retard = f.echeance && f.echeance < auj ? Math.round((new Date(auj) - new Date(f.echeance)) / 86400000) : 0;
          var suivi = retard ? "En retard de " + retard + " j" : f.envoyee_le ? "Envoyée le " + St.fmt(f.envoyee_le, { day: "numeric", month: "short" }) : "Pas encore envoyée";
          if (f.relancee_le) suivi += " · relancée le " + St.fmt(f.relancee_le, { day: "numeric", month: "short" });
          return el("tr", { class: retard ? "en-retard" : "" }, [el("td", { class: "mono", text: String(f.numero || "—") }), el("td", { text: espaceNom(f) }),
            el("td", { class: "mono", text: f.echeance ? St.fmt(f.echeance + "T12:00:00", { day: "numeric", month: "short" }) : "—" }), el("td", { class: "n", text: euros(f.total_ttc) }),
            el("td", {}, [el("span", { class: "etat-piece" + (retard ? " e-retard" : " e-emise"), text: suivi })]),
            el("td", { class: "actions-ligne" }, [
              !f.envoyee_le ? el("button", { type: "button", class: "btn-texte", text: "Envoyer", onclick: function () { action(f, false); } }) : null,
              retard || f.envoyee_le ? el("button", { type: "button", class: "btn-texte", text: "Relancer", onclick: function () { action(f, true); } }) : null,
              el("button", { type: "button", class: "btn-texte", text: "Payée", onclick: function () { payee(f); } })])]);
        }))])]) : St.vide("Tout est encaissé.")
    ]);
  }
  function action(f, relance) {
    var a = adresseFacturation(f);
    St.aides.confirmer(relance ? "Relancer " + espaceNom(f) + " ?" : "Envoyer la facture " + (f.numero || "") + " ?", (a ? "À " + a + ", " : "") + "depuis votre boîte Gmail, PDF joint.", relance ? "Relancer" : "Envoyer", function () {
      envoyer(f, relance).then(function () { St.signaler(relance ? "Relance envoyée" : "Facture envoyée"); St.dessiner(false); }, function (e) { St.signaler(e.message, true); });
    });
  }
  function payee(f, jour, op) {
    var champs = { statut: "payee", payee_le: jour || St.iso(new Date()) };
    return St.maj("factures", f.id, champs).then(function () {
      if (op) return St.maj("banque_operations", op.id, { facture_id: f.id, categorie: "client" });
    }).then(function () { St.signaler("Facture " + (f.numero || "") + " payée"); St.dessiner(false); });
  }

  // ---------- Compte pro (Revolut Business) ----------
  function blocBanque(m) {
    var li = S.banqueLiaisons[0];
    if (!li || !li.nom) return el("section", { class: "bloc compta-banque" }, [
      el("header", {}, [el("h2", { text: "Compte pro" })]),
      el("p", { class: "phrase", text: "Reliez votre compte Revolut Business (lecture seule) : les virements de vos clients se rapprochent de vos factures, vos paiements URSSAF et TVA sont repérés." }),
      el("div", {}, [el("button", { type: "button", class: "btn-plein", onclick: relierRevolut }, [St.icone("lien"), "Relier Revolut Business"])])]);
    var ops = S.banqueOps.filter(function (o) { return moisDe(o.date) === m; });
    var entrees = arrondi(ops.filter(function (o) { return +o.montant > 0; }).reduce(function (s, o) { return s + (+o.montant); }, 0));
    var sorties = arrondi(ops.filter(function (o) { return +o.montant < 0; }).reduce(function (s, o) { return s - (+o.montant); }, 0));
    var aRegler = S.factures.filter(function (f) { return f.statut === "emise"; });
    var sugg = function (o) {
      if (o.facture_id || !(+o.montant > 0)) return null;
      return aRegler.filter(function (f) { return Math.abs((+f.total_ttc || 0) - (+o.montant)) < 0.01; })[0] || null;
    };
    var cat = function (o) {
      if (o.categorie) return o.categorie;
      var t = ((o.libelle || "") + " " + (o.contrepartie || "") + " " + (o.reference || "")).toLowerCase();
      return /urssaf/.test(t) ? "urssaf" : /dgfip|tresor public|impots|impôts|tva/.test(t) ? "impots" : +o.montant > 0 ? "client" : "depense";
    };
    var NOMS = { client: "Client", urssaf: "URSSAF", tva: "TVA", impots: "Impôts", depense: "Dépense", perso: "Perso", virement: "Virement interne", autre: "Autre" };
    return el("section", { class: "bloc compta-banque" }, [
      el("header", {}, [el("h2", { text: li.nom || "Compte pro" }), el("span", { class: "compte", text: li.derniere_synchro ? "à jour " + St.ilya(li.derniere_synchro) : "" }),
        el("button", { type: "button", class: "btn-texte bloc-lien", onclick: synchroniser }, [St.icone("rafraichir"), "Actualiser"]),
        St.X.demo ? null : el("button", { type: "button", class: "btn-icone petit", title: "Délier le compte", "aria-label": "Délier le compte", onclick: delier }, [St.icone("fermer")])]),
      li.derniere_erreur ? el("p", { class: "alerte-texte", text: "Dernière erreur : " + li.derniere_erreur }) : null,
      el("p", { class: "aide", text: "En " + nomMois(m, true) + " : " + euros(entrees) + " reçus, " + euros(sorties) + " dépensés." }),
      ops.length ? el("ul", { class: "liste-compta banque" }, ops.slice(0, 60).map(function (o) {
        var s = sugg(o), f = o.facture_id && S.factures.filter(function (x) { return x.id === o.facture_id; })[0], c = cat(o);
        return el("li", {}, [el("span", { class: "mono", text: St.fmt(o.date, { day: "numeric", month: "short" }) }),
          el("span", { class: "banque-libelle" }, [el("b", { text: o.contrepartie || o.libelle || "Opération" }), o.reference ? el("small", { text: o.reference }) : null]),
          el("select", { class: "petit", "aria-label": "Catégorie", onchange: function (ev) { St.maj("banque_operations", o.id, { categorie: ev.target.value }); } },
            Object.keys(NOMS).map(function (k) { return el("option", { value: k, selected: k === c, text: NOMS[k] }); })),
          el("b", { class: "mono " + (+o.montant > 0 ? "positif" : ""), text: (+o.montant > 0 ? "+" : "") + euros(o.montant) }),
          f ? el("small", { class: "etiquette-partage", text: "Facture " + (f.numero || "") }) : s ? el("button", { type: "button", class: "btn-texte petit", onclick: function () { payee(s, String(o.date).slice(0, 10), o); } }, [St.icone("valider"), "Facture " + (s.numero || "") + " · " + espaceNom(s)]) : el("span")]);
      })) : St.vide("Aucune opération ce mois-ci.")
    ]);
  }
  function synchroniser() {
    if (St.X.demo) return St.signaler("Démonstration : rien à actualiser");
    St.signaler("Lecture du compte…");
    St.appel("banque", { action: "synchro" }).then(function (r) { St.signaler((r.nouvelles || 0) + " nouvelle" + ((r.nouvelles || 0) > 1 ? "s" : "") + " opération" + ((r.nouvelles || 0) > 1 ? "s" : "")); return St.charger(["banque_operations", "banque_liaisons"]); })
      .then(function () { St.dessiner(false); }, function (e) { St.signaler(e.message, true); });
  }
  // Liaison : une clé API Revolut en lecture seule, créée par Lili dans la console API de Revolut, collée ici
  function relierRevolut() {
    if (St.X.demo) return St.signaler("Démonstration : la liaison se fait sur le vrai studio", true);
    var cle = el("input", { type: "password", autocomplete: "off", placeholder: "r_prod_…", "aria-label": "Clé API Revolut" });
    St.fenetre({ titre: "Relier Revolut Business", classe: "large", sous: "Lecture seule : le studio voit vos comptes et vos opérations, il ne peut faire aucun paiement.", corps: [
      el("ol", { class: "etapes-liaison" }, [
        el("li", {}, ["Sur ordinateur, ouvrez Revolut Business, puis la console API : ", el("a", { href: "https://business.revolut.com/settings/api", target: "_blank", rel: "noopener", text: "Paramètres › API" }), "."]),
        el("li", {}, ["Créez une clé API (nom : « Studio Lili ») et ne cochez que ", el("b", { text: "Accounts : Read" }), " et ", el("b", { text: "Transactions : Read" }), ". Surtout pas de droit de paiement."]),
        el("li", {}, ["Copiez la clé et collez-la ici :", cle]),
        el("li", {}, ["« Relier » vérifie la clé et lit vos opérations des quatre derniers mois. Ensuite, le compte se met à jour tout seul toutes les heures."])])],
      actions: [{ texte: "Annuler" }, { texte: "Relier", principal: true, action: function (fermer) {
        var v = cle.value.trim(); if (v.length < 20) { cle.focus(); return St.signaler("Collez la clé API donnée par Revolut", true); }
        St.signaler("Vérification de la clé…");
        St.appel("banque", { action: "relier", cle: v }).then(function (r) {
          fermer(); St.signaler("Compte relié : " + (r.nouvelles || 0) + " opérations lues");
          return St.charger(["banque_liaisons", "banque_operations"]).then(function () { St.dessiner(false); });
        }, function (e) { St.signaler(e.message, true); });
      } }] });
  }
  function delier() {
    St.aides.confirmer("Délier le compte Revolut ?", "Le studio oublie la clé ; les opérations déjà lues restent. Pensez aussi à supprimer la clé dans Revolut.", "Délier", function () {
      St.appel("banque", { action: "delier" }).then(function () { return St.charger(["banque_liaisons"]); }).then(function () { St.dessiner(false); }, function (e) { St.signaler(e.message, true); });
    });
  }

  // ---------- Réglages : taux, plafond, régime de TVA ; TVA déductible du mois ----------
  function reglagesCompta() {
    var c = cfg(), A = St.aides;
    var t = A.texte(c.taux_cotisations, { type: "number", attrs: { step: "0.1", min: 0 } }), cfp = A.texte(c.taux_cfp, { type: "number", attrs: { step: "0.01", min: 0 } });
    var vl = el("input", { type: "checkbox", checked: !!c.versement_liberatoire }), tvl = A.texte(c.taux_vl, { type: "number", attrs: { step: "0.1", min: 0 } });
    var plafond = A.texte(c.plafond, { type: "number", attrs: { step: "100", min: 0 } });
    var regime = A.choix([["simplifie", "Réel simplifié (acomptes en juillet et décembre ; supprimé en 2027)"], ["mensuel", "Déclaration mensuelle (CA3)"], ["trimestriel", "Déclaration trimestrielle (CA3)"]], c.regime_tva);
    St.fenetre({ titre: "Taux et régime", sous: "Micro-entreprise, activité libérale. Vérifiez ces taux chaque année sur le site de l'URSSAF.", corps: [
      el("div", { class: "deux-colonnes" }, [A.champ("Cotisations sociales (%)", t), A.champ("Formation professionnelle (%)", cfp)]),
      el("label", { class: "case-option" }, [vl, el("span", {}, [el("b", { text: "Versement libératoire de l'impôt" }), el("small", { text: "Si vous l'avez choisi : l'impôt sur le revenu est payé avec les cotisations." })])]),
      el("div", { class: "deux-colonnes" }, [A.champ("Taux du versement libératoire (%)", tvl), A.champ("Plafond de chiffre d'affaires (€)", plafond)]),
      A.champ("Régime de TVA", regime)],
      actions: [{ texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
        var v = Object.assign({}, reglage("compta"), { taux_cotisations: +t.value || 0, taux_cfp: +cfp.value || 0, versement_liberatoire: vl.checked, taux_vl: +tvl.value || 0, plafond: +plafond.value || 0, regime_tva: regime.value });
        St.enregistrer("reglages", { cle: "compta", valeur: v, modifie_le: new Date().toISOString() }).then(function () { fermer(); St.dessiner(false); });
      } }] });
  }
  function noterDeductible(m) {
    var c = cfg(), A = St.aides, champ = A.texte((c.deductible || {})[m] || "", { type: "number", attrs: { step: "0.01", min: 0 } });
    St.fenetre({ titre: "TVA déductible · " + nomMois(m), sous: "La TVA payée sur vos achats professionnels du mois (logiciels, matériel…), qui vient en moins de la TVA à reverser.", corps: [A.champ("TVA déductible (€)", champ)],
      actions: [{ texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
        var v = Object.assign({}, reglage("compta")); v.deductible = Object.assign({}, v.deductible || {}); v.deductible[m] = +champ.value || 0;
        St.enregistrer("reglages", { cle: "compta", valeur: v, modifie_le: new Date().toISOString() }).then(function () { fermer(); St.dessiner(false); });
      } }] });
  }
})(window.Studio);
