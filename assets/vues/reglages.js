/* Réglages de Lili, en onglets comme Evoalys : Entreprise (fiche et complétude), Signatures de mail, Réponses types,
   Mails et vacances, Devis et signature, Assistant IA, Sécurité, Apparence. Et la fenêtre « En vacances ».
   L'onglet Signatures commence par « Ma signature » façon Evoalys (assets/vues/signature.js).
   Adresse : #reglages?onglet=entreprise|signatures|modeles|mails|devis|ia|securite|apparence
   Tout est rangé dans la table « reglages » (Lili seule, jamais lisible par un client). */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V, MARQUE = window.MARQUE || {}, A = St.aides;
  var maintenant = function () { return new Date().toISOString(); };
  function reglage(cle) { return ((S.reglages.filter(function (r) { return r.cle === cle; })[0] || {}).valeur) || {}; }
  function sauver(cle, valeur, message) {
    return St.enregistrer("reglages", { cle: cle, valeur: valeur, modifie_le: maintenant() }).then(function () { if (message !== false) St.signaler(message || "Réglages enregistrés"); });
  }
  var ONGLETS = [["entreprise", "Entreprise"], ["signatures", "Signatures de mail"], ["modeles", "Réponses types"], ["mails", "Mails et vacances"], ["reseaux", "Réseaux sociaux"],
    ["devis", "Devis et signature"], ["ia", "Assistant IA"], ["securite", "Sécurité"], ["apparence", "Apparence"]];

  V.reglages = function (r) {
    var o = (r.query && r.query.onglet) || "entreprise"; if (!ONGLETS.some(function (x) { return x[0] === o; })) o = "entreprise";
    var corps = { entreprise: ongletEntreprise, signatures: ongletSignatures, modeles: ongletModeles, mails: ongletMails, devis: ongletDevis, ia: ongletIa, securite: ongletSecurite, apparence: ongletApparence,
      reseaux: function () { return St.ongletReseaux ? St.ongletReseaux(r.query) : el("p", { text: "Chargement…" }); } }[o]();
    return el("div", { class: "vue-reglages" }, [
      St.entete("Réglages", reglage("entreprise").nom || MARQUE.proprietaire || "Mon studio"),
      el("nav", { class: "onglets-reglages", "aria-label": "Rubriques des réglages" }, ONGLETS.map(function (x) {
        return el("a", { href: "#reglages?onglet=" + x[0], class: x[0] === o ? "actif" : null, "aria-current": x[0] === o ? "page" : null, text: x[1] });
      })),
      corps
    ]);
  };
  function carte(ic, titre, sous, contenu, numero) {
    return el("section", { class: "bloc carte-reglage" }, [el("header", { class: "carte-reglage-tete" }, [numero ? el("span", { class: "numero", text: String(numero) }) : el("span", { class: "pastille-ic" }, [St.icone(ic)]),
      el("div", {}, [el("h2", { text: titre }), sous ? el("p", { class: "phrase", text: sous }) : null])]), el("div", { class: "carte-reglage-corps" }, contenu)]);
  }

  // ---------- Entreprise : la fiche qui remplit l'en-tête des factures et devis ----------
  var SECTIONS = [["Identité", [["nom", "Nom commercial", "Lili Rouzier"], ["activite", "Activité", "Community manager"], ["nom_legal", "Nom légal (en tête des factures)", "Entreprise individuelle ROUZIER ALISON"]]],
    ["Coordonnées", [["adresse", "Adresse", "", 2], ["email", "E-mail de facturation", ""], ["telephone", "Téléphone", ""], ["site", "Site ou Instagram", "https://…"]]],
    ["Immatriculation", [["siret", "SIRET", ""], ["tva_intra", "TVA intracommunautaire", "FR…"], ["naf", "Code NAF", "7021Z"]]],
    ["Paiement", [["iban_affiche", "IBAN affiché sur les factures", "FR76 …"], ["conditions", "Règlement", "À réception", 2]]]];
  function ongletEntreprise() {
    var ent = reglage("entreprise"), saisies = {};
    var tous = SECTIONS.reduce(function (l, s) { return l.concat(s[1]); }, []);
    var cartes = SECTIONS.map(function (s, i) {
      return carte(null, s[0], null, [el("div", { class: "grille-champs" }, s[1].map(function (c) {
        saisies[c[0]] = A.texte(ent[c[0]], { lignes: c[3], aide: c[2] }); return A.champ(c[1], saisies[c[0]]);
      }))], i + 1);
    });
    var rempli = function (k) { return !!String(ent[k] || "").trim(); };
    var nb = tous.filter(function (c) { return rempli(c[0]); }).length;
    var fiche = el("aside", { class: "bloc fiche-progres" }, [el("h2", { text: "Fiche de l'entreprise" }), el("p", { class: "phrase", text: nb + " champs remplis sur " + tous.length + "." }),
      el("div", { class: "jauge" }, [el("i", { style: { width: Math.round(nb / tous.length * 100) + "%" } })]),
      el("ol", { class: "etapes-fiche" }, SECTIONS.map(function (s) {
        var n = s[1].filter(function (c) { return rempli(c[0]); }).length, ok = n === s[1].length;
        return el("li", { class: ok ? "ok" : "" }, [el("span", { class: "rond" }, [ok ? St.icone("valider") : String(n)]), el("span", {}, [el("b", { text: s[0] }), el("small", { text: ok ? "complet" : n + " sur " + s[1].length })])]);
      })),
      el("button", { type: "button", class: "btn-plein grand", onclick: function () {
        var v = Object.assign({}, ent); Object.keys(saisies).forEach(function (k) { v[k] = saisies[k].value.trim(); });
        sauver("entreprise", v, "Fiche enregistrée : l'en-tête des factures et devis est à jour").then(function () { St.dessiner(false); });
      } }, [St.icone("valider"), "Enregistrer la fiche"]),
      el("p", { class: "aide", text: "Ces informations remplissent toutes seules l'en-tête des factures et des devis. Les mentions légales du site se règlent dans assets/marque.js." })]);
    return el("div", { class: "reglages-deux" }, [el("div", { class: "pile" }, cartes), fiche]);
  }

  // ---------- Signatures de mail ----------
  function coordonneesHtml() {
    var e = reglage("entreprise"), logo = new URL("assets/marque/icone-180.png", location.href).href;
    return '<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#1E1A17"><tr>' +
      '<td style="padding-right:12px;vertical-align:top"><img src="' + logo + '" width="48" height="48" alt="" style="border-radius:10px;display:block"></td>' +
      '<td style="vertical-align:top;border-left:2px solid #A9553A;padding-left:12px"><b style="font-family:Georgia,serif;font-size:15px">' + A.echapper(e.nom || MARQUE.proprietaire || "") + '</b><br>' +
      '<span style="color:#5F574F">' + A.echapper(e.activite || MARQUE.metier || "") + '</span><br>' +
      [e.telephone, e.email].filter(Boolean).map(A.echapper).join(" · ") + (e.site ? '<br><a href="' + A.echapper(e.site) + '" style="color:#A9553A">' + A.echapper(e.site.replace(/^https?:\/\/(www\.)?/, "")) + "</a>" : "") +
      "</td></tr></table>";
  }
  function ongletSignatures() {
    var sg = St.signatures();
    var enreg = function (liste, nouveau, reponse) { return sauver("signatures", { liste: liste, nouveau: nouveau, reponse: reponse }).then(function () { St.dessiner(false); }); };
    var choixDefaut = function (cle, libelle) {
      return A.champ(libelle, A.choix([["", "Sans signature"]].concat(sg.liste.map(function (s) { return [s.id, s.nom]; })), sg[cle] || "", { nom: libelle, attrs: { onchange: function (ev) {
        var v = { nouveau: sg.nouveau, reponse: sg.reponse }; v[cle] = ev.target.value || null; enreg(sg.liste, v.nouveau, v.reponse);
      } } }));
    };
    var liste = sg.liste.length ? el("div", { class: "grille-signatures" }, sg.liste.map(function (s) {
      return el("article", { class: "bloc signature-carte" }, [el("header", {}, [el("b", { text: s.nom }),
        s.id === sg.nouveau ? el("span", { class: "etiquette", text: "Nouveaux messages" }) : null, s.id === sg.reponse ? el("span", { class: "etiquette", text: "Réponses" }) : null]),
        el("div", { class: "signature-apercu", html: s.html }),
        el("div", { class: "actions-ligne" }, [el("button", { type: "button", class: "btn-texte", text: "Modifier", onclick: function () { editerSignature(s); } }),
          el("button", { type: "button", class: "btn-texte danger", text: "Supprimer", onclick: function () { A.confirmer("Supprimer « " + s.nom + " » ?", "Les mails déjà envoyés ne changent pas.", "Supprimer", function () {
            enreg(sg.liste.filter(function (x) { return x.id !== s.id; }), sg.nouveau === s.id ? null : sg.nouveau, sg.reponse === s.id ? null : sg.reponse);
          }); } })])]);
    })) : St.vide("Aucune signature pour l'instant.");
    return el("div", { class: "pile" }, [St.carteSignature ? St.carteSignature(carte) : null,
      carte("plume", "Signatures de mail", "Ajoutées toutes seules au bas des messages écrits depuis le studio. Une pour les nouveaux messages, une plus courte pour les réponses si vous voulez.", [
        el("div", { class: "barre-outils" }, [el("button", { type: "button", class: "btn-plein", onclick: function () { editerSignature(); } }, [St.icone("plus"), "Nouvelle signature"])]),
        liste,
        sg.liste.length ? el("div", { class: "deux-colonnes" }, [choixDefaut("nouveau", "Pour les nouveaux messages"), choixDefaut("reponse", "Pour les réponses et transferts")]) : null])]);
  }
  function editerSignature(s) {
    s = s || {}; var sg = St.signatures();
    var nomS = A.texte(s.nom || (sg.liste.length ? "" : "Signature complète"), { aide: "Signature complète, Courte…" });
    var ed = St.editeurRiche(s.html || "", { label: "Signature", aide: "Votre signature…", classe: "editeur-signature",
      extra: [el("span", { class: "espace" }), el("button", { type: "button", class: "btn-texte petit", onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () { ed.inserer(coordonneesHtml()); } }, ["Insérer mes coordonnées et le logo"])] });
    St.fenetre({ titre: s.id ? "Modifier la signature" : "Nouvelle signature", classe: "large", corps: [A.champ("Nom de la signature", nomS), ed.el,
      el("p", { class: "aide", text: "Astuce : « Insérer mes coordonnées et le logo » reprend la fiche de l'entreprise (onglet Entreprise)." })],
      actions: [{ texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
        if (!nomS.value.trim()) { nomS.focus(); return; }
        var liste = sg.liste.slice(), id = s.id || "s" + Date.now().toString(36), x = { id: id, nom: nomS.value.trim(), html: ed.html() };
        var i = liste.findIndex(function (y) { return y.id === id; }); if (i >= 0) liste[i] = x; else liste.push(x);
        sauver("signatures", { liste: liste, nouveau: sg.nouveau || id, reponse: sg.reponse || (liste.length === 1 ? id : sg.reponse) }).then(function () { fermer(); St.dessiner(false); });
      } }] });
  }

  // ---------- Réponses types ----------
  function ongletModeles() {
    var ms = St.modelesMail();
    var enreg = function (liste) { return sauver("modeles_mail", { liste: liste }).then(function () { St.dessiner(false); }); };
    var editer = function (m) {
      m = m || {};
      var n = A.texte(m.nom, { aide: "Relance validation, Envoi du planning…" }), obj = A.texte(m.objet, { aide: "Facultatif" });
      var ed = St.editeurRiche(m.html || "", { label: "Texte", aide: "Bonjour,…" });
      St.fenetre({ titre: m.id ? "Modifier la réponse type" : "Nouvelle réponse type", classe: "large", corps: [el("div", { class: "deux-colonnes" }, [A.champ("Nom", n), A.champ("Objet proposé", obj)]), ed.el],
        actions: [{ texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
          if (!n.value.trim()) { n.focus(); return; }
          var liste = ms.slice(), id = m.id || "m" + Date.now().toString(36), x = { id: id, nom: n.value.trim(), objet: obj.value.trim(), html: ed.html() };
          var i = liste.findIndex(function (y) { return y.id === id; }); if (i >= 0) liste[i] = x; else liste.push(x);
          enreg(liste).then(fermer);
        } }] });
    };
    var exemples = [
      { nom: "Relance de validation", objet: "Vos publications attendent votre feu vert", html: "<p>Bonjour,</p><p>Petit rappel : quelques publications attendent votre validation dans votre espace. Deux gestes suffisent : <b>Valider</b>, ou dire ce qu'il faut changer.</p><p>Merci !</p>" },
      { nom: "Envoi du planning du mois", objet: "Votre planning du mois", html: "<p>Bonjour,</p><p>Le planning du mois est prêt dans votre espace, rubrique Calendrier. Dites-moi si une date ou un sujet ne vous convient pas.</p><p>Belle journée,</p>" },
      { nom: "Demande de photos", objet: "Des photos pour la semaine prochaine ?", html: "<p>Bonjour,</p><p>Pour les publications de la semaine prochaine, pourriez-vous déposer quelques photos dans votre médiathèque (bouton « Déposer des photos ») ?</p><p>Merci beaucoup,</p>" }];
    return carte("plume", "Réponses types", "Les messages que vous écrivez souvent : insérés en un clic dans la rédaction (menu « Réponses types… »).", [
      el("div", { class: "barre-outils" }, [!ms.length ? el("button", { type: "button", class: "btn-texte", onclick: function () {
        enreg(exemples.map(function (x, i) { return Object.assign({ id: "m" + Date.now().toString(36) + i }, x); }));
      } }, ["Ajouter 3 exemples"]) : null, el("button", { type: "button", class: "btn-plein", onclick: function () { editer(); } }, [St.icone("plus"), "Nouvelle réponse type"])]),
      ms.length ? el("ul", { class: "liste-modeles" }, ms.map(function (m) {
        return el("li", {}, [el("div", {}, [el("b", { text: m.nom }), m.objet ? el("small", { text: " · " + m.objet }) : null,
          el("p", { text: (m.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) })]),
          el("div", { class: "actions-ligne" }, [el("button", { type: "button", class: "btn-texte", text: "Modifier", onclick: function () { editer(m); } }),
            el("button", { type: "button", class: "btn-texte danger", text: "Supprimer", onclick: function () { A.confirmer("Supprimer « " + m.nom + " » ?", "", "Supprimer", function () { enreg(ms.filter(function (x) { return x.id !== m.id; })); }); } })])]);
      })) : St.vide("Aucune réponse type.")]);
  }

  // ---------- Mails et vacances ----------
  function ongletMails() {
    var rm = St.reglagesMails(), vac = St.vacancesActives(), boite = (S.boitesMail || [])[0];
    var delai = A.choix([[0, "Pas de délai"], [5, "5 secondes"], [8, "8 secondes"], [15, "15 secondes"], [30, "30 secondes"]], rm.annulation, { nom: "Délai d'annulation", attrs: { onchange: function (ev) {
      sauver("mails", Object.assign({}, reglage("mails"), { annulation: +ev.target.value }));
    } } });
    return el("div", { class: "pile" }, [
      carte("mail", "Boîte Gmail", null, [boite ? el("p", {}, ["Reliée : ", el("b", { text: boite.email }), boite.derniere_erreur ? el("span", { class: "alerte-texte", text: " · souci : " + boite.derniere_erreur }) : null])
        : el("p", { class: "phrase", text: St.X.demo ? "Démonstration : lili@demo.exemple" : "Aucune boîte reliée." }),
        el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [el("a", { class: "btn-texte", href: "#mails", text: "Ouvrir les mails" }),
          el("button", { type: "button", class: "btn-texte", text: boite ? "Relier à nouveau" : "Relier ma boîte Gmail", onclick: function () { if (St.relierGmail) St.relierGmail(); } })]),
        el("p", { class: "aide", text: "Relier à nouveau sert aussi à donner à Google l'accord pour la réponse automatique de vacances." })]),
      carte("horloge", "Annuler un envoi", "Après « Envoyer », le message attend quelques secondes : le temps de cliquer « Annuler ».", [A.champ("Délai", delai)]),
      carte("soleil", "En vacances", vac ? "Activé du " + St.fmt(vac.debut + "T12:00:00", { day: "numeric", month: "long" }) + " au " + St.fmt(vac.fin + "T12:00:00", { day: "numeric", month: "long" }) + "." : "Réponse automatique Gmail, bandeau dans l'espace des clients et pause de vos notifications, sur les dates choisies.", [
        el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [el("button", { type: "button", class: "btn-plein", onclick: function () { St.vacances(); } }, [St.icone("soleil"), vac ? "Modifier mes vacances" : "Préparer mes vacances"]),
          vac ? el("button", { type: "button", class: "btn-texte", text: "Je suis de retour", onclick: function () { V.finVacances(); } }) : null])])]);
  }

  // ---------- Devis et signature électronique ----------
  function ongletDevis() {
    var d = reglage("devis");
    var validite = A.texte(d.validite || 30, { type: "number", attrs: { min: 1, max: 365 } });
    return carte("euro", "Devis et signature électronique", "Un devis envoyé à un client apparaît dans son espace (rubrique Devis) : il le lit, coche « Bon pour accord », trace sa signature du doigt ou à la souris, et c'est signé.", [
      el("div", { class: "deux-colonnes" }, [A.champ("Validité par défaut (jours)", validite), el("span")]),
      el("p", { class: "aide", text: "Preuve gardée pour chaque signature : nom, signature tracée, date et heure, adresse IP, navigateur, et l'empreinte SHA-256 du devis (toute modification ultérieure se verrait). Elle figure sur le PDF du devis. Signature électronique simple, adaptée aux devis de prestations." }),
      el("div", {}, [el("button", { type: "button", class: "btn-plein", onclick: function () { sauver("devis", { validite: Math.max(1, +validite.value || 30) }); } }, ["Enregistrer"])])]);
  }

  // ---------- Assistant IA ----------
  function ongletIa() {
    var zone = el("div", { class: "chiffres" }, [el("div", { class: "chiffre" }, [el("span", { text: "Ce mois" }), el("b", { text: "…" }), el("small", { text: "demandes à l'assistant" })])]);
    var debut = St.iso(new Date()).slice(0, 8) + "01";
    if (!St.X.demo) Promise.all([
      St.X.db.from("assistant_journal").select("id", { count: "exact", head: true }).gte("cree_le", debut),
      St.X.db.from("briefs_jour").select("jour", { count: "exact", head: true }).eq("par_ia", true).gte("jour", debut)
    ]).then(function (r) {
      zone.textContent = "";
      [["Ce mois", r[0].count || 0, "demandes à l'assistant"], ["Ce mois", r[1].count || 0, "briefs du jour rédigés par l'IA"], ["Plafond", "15 $", "par mois, puis pause jusqu'au mois suivant"]].forEach(function (c) {
        zone.appendChild(el("div", { class: "chiffre" }, [el("span", { text: c[0] }), el("b", { text: String(c[1]) }), el("small", { text: c[2] })]));
      });
    });
    else { zone.textContent = ""; [["Ce mois", 12, "demandes à l'assistant"], ["Ce mois", 21, "briefs du jour par l'IA"], ["Plafond", "15 $", "par mois"]].forEach(function (c) { zone.appendChild(el("div", { class: "chiffre" }, [el("span", { text: c[0] }), el("b", { text: String(c[1]) }), el("small", { text: c[2] })])); }); }
    return el("div", { class: "pile" }, [carte("etincelle", "Assistant IA", (MARQUE.assistant || "L'assistant") + " (Claude, d'Anthropic) lit vos briefs, publications et rapports, et crée des brouillons invisibles des clients. Il ne valide, ne programme et n'envoie jamais rien.", [zone,
      el("p", { class: "aide", text: "Le brief du jour est préparé chaque matin à 6 h. Le plafond de dépenses se règle dans la console Anthropic (espace de travail « Studio Lili »)." })])]);
  }

  // ---------- Appareil de confiance (cet appareil seulement) ----------
  // Après un code juste, la case « Faire confiance à cet appareil 30 jours » évite de le retaper ici ; « Oublier »
  // le redemande dès maintenant. Une session inutilisée 30 jours expire de toute façon côté serveur.
  function ligneConfiance() {
    var zone = el("div", { class: "pile-serree" });
    function peindre() {
      zone.textContent = "";
      var c = St.X.confiance, jusqua = c && c.jusqua();
      if (!jusqua) { zone.appendChild(el("p", { class: "aide", text: "Cet appareil n'est pas de confiance : le code est redemandé après 30 minutes d'absence. Cochez « Faire confiance à cet appareil 30 jours » à votre prochain code pour ne plus le retaper ici." })); return; }
      zone.appendChild(el("p", { class: "phrase" }, [St.icone("valider"), " Cet appareil est de confiance jusqu'au " + St.fmt(new Date(jusqua).toISOString(), { day: "numeric", month: "long" }) + " : le code n'y est pas redemandé d'ici là."]));
      zone.appendChild(el("div", {}, [el("button", { type: "button", class: "btn-texte", text: "Oublier cet appareil", onclick: function () {
        c.oublier(); St.signaler("Appareil oublié : le code sera redemandé après 30 minutes d'absence"); peindre();
      } })]));
    }
    peindre();
    return zone;
  }

  // ---------- Sécurité ----------
  function ongletSecurite() {
    var mdp = el("input", { type: "password", autocomplete: "new-password", minlength: 10, placeholder: "10 caractères au moins", "aria-label": "Nouveau mot de passe" });
    var code = el("p", { class: "phrase", text: "…" }), appareils = el("ul", { class: "equipe" }), derniere = el("p", { class: "aide" });
    if (!St.X.demo) {
      St.X.db.auth.mfa.listFactors().then(function (r) {
        var f = ((r.data && r.data.totp) || []).filter(function (x) { return x.status === "verified"; });
        code.textContent = f.length ? "Activé : application d'authentification reliée le " + St.fmt(f[0].created_at, { day: "numeric", month: "long", year: "numeric" }) + "." : "Pas encore activé.";
      });
      St.X.db.auth.getUser().then(function (r) { var u = r.data && r.data.user; if (u && u.last_sign_in_at) derniere.textContent = "Dernière connexion : " + St.fmt(u.last_sign_in_at, { weekday: "long", day: "numeric", month: "long" }) + " à " + St.hm(u.last_sign_in_at) + "."; });
      St.X.db.from("push_abonnements").select("endpoint, appareil, cree_le").then(function (r) {
        appareils.textContent = "";
        (r.data || []).forEach(function (x) {
          appareils.appendChild(el("li", {}, [St.icone("cloche"), el("span", { class: "equipe-texte" }, [el("b", { text: x.appareil || "Appareil" }), el("small", { text: "depuis le " + St.fmt(x.cree_le, { day: "numeric", month: "long" }) })]),
            el("button", { type: "button", class: "btn-texte", text: "Retirer", onclick: function () { St.X.db.from("push_abonnements").delete().eq("endpoint", x.endpoint).then(function () { St.signaler("Appareil retiré des notifications"); St.dessiner(false); }); } })]));
        });
        if (!(r.data || []).length) appareils.appendChild(el("li", {}, [el("span", { class: "aide", text: "Aucun appareil ne reçoit les notifications (la cloche > « Recevoir les notifications sur cet appareil »)." })]));
      });
    } else code.textContent = "Démonstration : le code à 6 chiffres est demandé à l'entrée.";
    return el("div", { class: "pile" }, [carteVigie(),
      carte("cadenas", "Code à 6 chiffres", null, [code, ligneConfiance(), el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [el("button", { type: "button", class: "btn-texte", text: "Verrouiller maintenant", onclick: function () { if (St.X.verrouiller) St.X.verrouiller(); } })])]),
      carte("cadenas", "Mot de passe", "Changez-le quand vous voulez. Les autres appareils restent connectés : pour les fermer, « Déconnecter tous mes autres appareils » ci-dessous.", [el("div", { class: "champ-mdp" }, [mdp]),
        el("div", {}, [el("button", { type: "button", class: "btn-plein", onclick: function () {
          if (mdp.value.length < 10) { mdp.focus(); return St.signaler("10 caractères au moins", true); }
          if (St.X.demo) { mdp.value = ""; return St.signaler("Démonstration : rien n'est changé"); }
          St.X.db.auth.updateUser({ password: mdp.value }).then(function (r) { mdp.value = ""; St.signaler(r.error ? "Non changé : " + r.error.message : "Mot de passe changé", !!r.error); });
        } }, ["Changer le mot de passe"])])]),
      carte("sortir", "Appareils connectés", null, [derniere, el("button", { type: "button", class: "btn-texte", text: "Déconnecter tous mes autres appareils", onclick: function () {
        A.confirmer("Déconnecter les autres appareils ?", "Celui-ci reste connecté ; les autres devront se reconnecter avec mot de passe et code.", "Déconnecter", function () {
          if (St.X.demo) return St.signaler("Démonstration : rien n'est changé");
          St.X.db.auth.signOut({ scope: "others" }).then(function (r) { St.signaler(r.error ? r.error.message : "Les autres appareils sont déconnectés", !!r.error); });
        });
      } })]),
      carte("cloche", "Appareils qui reçoivent les notifications", null, [appareils])]);
  }

  // ---------- La vigie : l'agent de sécurité qui fait sa ronde toutes les 10 minutes ----------
  function carteVigie() {
    var v = reglage("vigie"), alertes = S.alertesSecurite || [], nonVues = alertes.filter(function (a) { return !a.vu_le && a.niveau !== "info"; });
    var etatV = !v.derniere_ronde ? ["attente", "Première ronde dans quelques minutes."] : (Date.now() - Date.parse(v.derniere_ronde) > 40 * 60000) ? ["muette", "La vigie ne s'est pas manifestée depuis " + St.ilya(v.derniere_ronde) + " : prévenez Antonin."]
      : v.statut === "critique" ? ["critique", "Alerte critique à la dernière ronde (" + St.ilya(v.derniere_ronde) + ")."] : v.statut === "alerte" ? ["alerte", "Point d'attention à la dernière ronde (" + St.ilya(v.derniere_ronde) + ")."] : ["ok", "Tout est en ordre. Dernière ronde " + St.ilya(v.derniere_ronde) + "."];
    var ronde = el("button", { type: "button", class: "btn-texte", text: "Lancer une ronde maintenant", onclick: function () {
      if (St.X.demo) return St.signaler("Démonstration : la vigie veille en ligne seulement");
      ronde.disabled = true; ronde.textContent = "Ronde en cours…";
      St.appel("vigie", { ronde: true }).then(function (x) { St.signaler(x.statut === "ok" ? "Ronde terminée : tout est en ordre" : "Ronde terminée : " + x.constats + " point" + (x.constats > 1 ? "s" : "") + " à regarder", x.statut !== "ok"); return St.charger(); })
        .then(function () { St.dessiner(false); }, function (e) { St.signaler(e.message, true); ronde.disabled = false; ronde.textContent = "Lancer une ronde maintenant"; });
    } });
    var NIV = { info: "Info", alerte: "Alerte", critique: "Critique" };
    var journal = alertes.length ? el("ul", { class: "journal-securite" }, alertes.slice(0, 30).map(function (a) {
      return el("li", { class: "n-" + a.niveau + (a.vu_le ? " vue" : "") }, [el("span", { class: "niveau", text: NIV[a.niveau] || a.niveau }),
        el("span", { class: "texte" }, [el("b", { text: a.titre }), el("small", { text: St.fmt(a.cree_le, { weekday: "short", day: "numeric", month: "short" }) + " à " + St.hm(a.cree_le) + (a.details && a.details.conseil ? " · " + a.details.conseil : "") })]),
        !a.vu_le ? el("button", { type: "button", class: "btn-texte petit", text: "Vu", onclick: function () { St.maj("securite_alertes", a.id, { vu_le: maintenant() }).then(function () { St.dessiner(false); }); } }) : null]);
    })) : el("p", { class: "aide", text: "Aucune alerte : la vigie n'a rien trouvé d'anormal." });
    return carte("bouclier", "La vigie veille, jour et nuit", "Toutes les 10 minutes : tentatives de connexion et robots à l'entrée, connexions à votre compte depuis une adresse inconnue, protections de la base et du site, suppressions en masse. En cas d'alerte, vous êtes prévenue sur vos appareils et par e-mail, même en vacances.", [
      el("div", { class: "etat-vigie e-" + etatV[0] }, [el("span", { class: "voyant" }), el("b", { text: etatV[1] }), nonVues.length ? el("span", { class: "etiquette", text: nonVues.length + " à regarder" }) : null]),
      el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [ronde]),
      el("h3", { class: "titre-fiche", text: "Journal de sécurité" }), journal,
      el("p", { class: "aide", text: "Protections à l'entrée : piège à robots, refus des navigateurs pilotés par un automate (agents d'IA compris), attente qui s'allonge après plusieurs mots de passe faux, mots de passe déjà fuités refusés, code à 6 chiffres exigé par la base elle-même." })]);
  }

  // ---------- Apparence ----------
  function ongletApparence() {
    var actuel = document.documentElement.getAttribute("data-theme") || "auto";
    var choisir = function (t) {
      try { if (t === "auto") localStorage.removeItem("studio-theme"); else localStorage.setItem("studio-theme", t); } catch (x) { /* stockage indisponible */ }
      if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
      St.dessiner(false);
    };
    return carte("soleil", "Apparence", "Sur cet appareil.", [el("div", { class: "choix-theme" }, [["auto", "Comme l'appareil"], ["light", "Clair"], ["dark", "Sombre"]].map(function (t) {
      return el("button", { type: "button", class: "theme-carte t-" + t[0] + (actuel === t[0] ? " actif" : ""), "aria-pressed": actuel === t[0] ? "true" : "false", onclick: function () { choisir(t[0]); } }, [el("span", { class: "theme-apercu" }), el("b", { text: t[1] })]);
    }))]);
  }

  // ======================================================================
  // Mon compte (clients et invités) : nom, mot de passe, double authentification facultative
  // ======================================================================
  V.compte = function () {
    var moi = S.moi || {}, zone2fa = el("div", { class: "pile-serree" }, [el("p", { class: "aide", text: "…" })]);
    var mdp = el("input", { type: "password", autocomplete: "new-password", minlength: 10, placeholder: "10 caractères au moins", "aria-label": "Nouveau mot de passe" });
    var dessiner2fa = function () {
      zone2fa.textContent = "";
      if (St.X.demo) { zone2fa.appendChild(el("p", { class: "aide", text: "Démonstration : en ligne, vous activez ici un code à 6 chiffres, demandé à chaque connexion." })); return; }
      St.X.db.auth.mfa.listFactors().then(function (r) {
        var tous = (r.data && r.data.totp) || [], actif = tous.filter(function (f) { return f.status === "verified"; })[0];
        if (actif) {
          zone2fa.appendChild(el("p", { class: "phrase" }, [St.icone("valider"), " Activée depuis le " + St.fmt(actif.created_at, { day: "numeric", month: "long", year: "numeric" }) + " : votre code vous est demandé à chaque connexion. Sans lui, personne n'entre dans votre espace, même avec votre mot de passe."]));
          zone2fa.appendChild(ligneConfiance());
          zone2fa.appendChild(el("div", {}, [el("button", { type: "button", class: "btn-texte danger", text: "Désactiver la double authentification", onclick: function () {
            A.confirmer("Désactiver la double authentification ?", "Votre mot de passe suffira de nouveau pour entrer.", "Désactiver", function () {
              St.X.db.auth.mfa.unenroll({ factorId: actif.id }).then(function (x) { St.signaler(x.error ? x.error.message : "Double authentification désactivée", !!x.error); dessiner2fa(); });
            });
          } })]));
          return;
        }
        zone2fa.appendChild(el("p", { class: "phrase", text: "Facultative et recommandée : en plus du mot de passe, un code à 6 chiffres affiché par une application de votre téléphone (celle de l'iPhone dans Réglages > Mots de passe, Google Authenticator, 1Password…)." }));
        zone2fa.appendChild(el("div", {}, [el("button", { type: "button", class: "btn-plein", onclick: function () {
          Promise.all(tous.filter(function (f) { return f.status !== "verified"; }).map(function (f) { return St.X.db.auth.mfa.unenroll({ factorId: f.id }); }))
            .then(function () { return St.X.db.auth.mfa.enroll({ factorType: "totp", friendlyName: "Studio " + Date.now() }); })
            .then(function (e) {
              if (e.error) return St.signaler(e.error.message, true);
              var champ = el("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, class: "code-signature", placeholder: "6 chiffres", "aria-label": "Code à 6 chiffres" });
              var qr = el("div", { class: "qr-compte", html: e.data.totp.qr_code ? '<img alt="QR code à scanner" src="' + e.data.totp.qr_code + '">' : "" });
              St.fenetre({ titre: "Activer la double authentification", sous: "1. Scannez ce code avec l'application d'authentification de votre téléphone. 2. Tapez les 6 chiffres qu'elle affiche.", corps: [qr,
                el("details", { class: "secret" }, [el("summary", { text: "Saisir la clé à la main" }), el("code", { text: e.data.totp.secret })]), A.champ("Code à 6 chiffres", champ)],
                actions: [{ texte: "Annuler" }, { texte: "Activer", principal: true, action: function (fermer) {
                  St.X.db.auth.mfa.challengeAndVerify({ factorId: e.data.id, code: champ.value.replace(/\D/g, "") }).then(function (v) {
                    if (v.error) { champ.value = ""; champ.focus(); return St.signaler("Code incorrect : prenez le plus récent (il change toutes les 30 secondes).", true); }
                    fermer(); St.signaler("Double authentification activée. Gardez votre téléphone à portée à chaque connexion."); dessiner2fa();
                  });
                } }] });
            });
        } }, [St.icone("cadenas"), "Activer la double authentification"])]));
      });
    };
    dessiner2fa();
    return el("div", { class: "rubrique-etroite" }, [St.entete(null, "Mon compte", (moi.nom || "") + (moi.email ? " · " + moi.email : "")),
      carte("cadenas", "Double authentification", null, [zone2fa]),
      carte("cadenas", "Mot de passe", null, [el("div", { class: "champ-mdp" }, [mdp]), el("div", {}, [el("button", { type: "button", class: "btn-plein", onclick: function () {
        if (mdp.value.length < 10) { mdp.focus(); return St.signaler("10 caractères au moins", true); }
        if (St.X.demo) { mdp.value = ""; return St.signaler("Démonstration : rien n'est changé"); }
        St.X.db.auth.updateUser({ password: mdp.value }).then(function (x) { mdp.value = ""; St.signaler(x.error ? "Non changé : " + (/pwned|leaked|weak/i.test(x.error.message) ? "ce mot de passe circule déjà sur internet, choisissez-en un autre" : x.error.message) : "Mot de passe changé", !!x.error); });
      } }, ["Changer le mot de passe"])])]),
      carte("sortir", "Appareils", null, [el("button", { type: "button", class: "btn-texte", text: "Déconnecter mes autres appareils", onclick: function () {
        if (St.X.demo) return St.signaler("Démonstration : rien n'est changé");
        St.X.db.auth.signOut({ scope: "others" }).then(function (x) { St.signaler(x.error ? x.error.message : "Vos autres appareils sont déconnectés", !!x.error); });
      } })])]);
  };

  // ======================================================================
  // En vacances : réponse automatique Gmail, bandeau chez les clients, pause des notifications
  // ======================================================================
  V.vacancesActives = St.vacancesActives;
  function appelMessagerie(corps) { return St.appel("messagerie", corps); }
  St.vacances = function () {
    var v = reglage("vacances"), actif = St.vacancesActives(), auj = St.iso(new Date());
    var sigHtml = St.signatureCarteHtml ? St.signatureCarteHtml() : null;
    var e = reglage("entreprise"), prenom = (e.nom || MARQUE.proprietaire || "Lili").split(" ")[0];
    var debut = el("input", { type: "date", value: actif ? v.debut : auj, "aria-label": "Du" }), fin = el("input", { type: "date", value: actif ? v.fin : St.iso(St.ajouterJours(new Date(), 7)), "aria-label": "Au" });
    var objet = A.texte(actif ? v.objet : "", { aide: "Absente jusqu'au …" });
    var message = A.texte(actif ? v.message : "", { lignes: 6 });
    var retourLe = function () { return fin.value ? St.fmt(St.ajouterJours(new Date(fin.value + "T12:00:00"), 1), { weekday: "long", day: "numeric", month: "long" }) : "…"; };
    var proposer = function () {
      if (actif && (objet.value || message.value)) return;
      objet.value = "Absente jusqu'au " + (fin.value ? St.fmt(fin.value + "T12:00:00", { day: "numeric", month: "long" }) : "…");
      message.value = "Bonjour,\n\nJe suis en congés jusqu'au " + (fin.value ? St.fmt(fin.value + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) : "…") +
        " et je lirai votre message à mon retour, le " + retourLe() + ".\n\nVos publications programmées continuent de paraître normalement.\n\nBelle journée," + (sigHtml ? "" : "\n" + (e.nom || MARQUE.proprietaire || prenom));
    };
    fin.addEventListener("change", function () { if (!actif) { objet.value = ""; message.value = ""; proposer(); } });
    proposer();
    var cGmail = el("input", { type: "checkbox", checked: actif ? v.gmail !== false : true }), cBandeau = el("input", { type: "checkbox", checked: actif ? v.bandeau !== false : true }), cPause = el("input", { type: "checkbox", checked: actif ? v.pause !== false : true });
    var cSig = el("input", { type: "checkbox", checked: !!sigHtml && (actif ? v.signature !== false : true), disabled: !sigHtml });
    var avert = el("p", { class: "aide" });
    if (!St.X.demo) appelMessagerie({ action: "etat" }).then(function (r) { var b = (r.boites || [])[0]; if (b && !b.vacances_possible) avert.textContent = "Pour la réponse automatique, Google doit d'abord donner son accord : Réglages > Mails et vacances > « Relier à nouveau »."; if (!b) avert.textContent = "Aucune boîte Gmail reliée : pas de réponse automatique."; }).catch(function () {});
    var envoyer = function (actifV, fermer) {
      if (actifV && (!debut.value || !fin.value || fin.value < debut.value)) return St.signaler("Vérifiez les dates", true);
      var corps = { action: "vacances", actif: actifV, debut: debut.value, fin: fin.value, objet: objet.value.trim(), message: A.echapper(message.value.trim()), signature: cSig.checked && sigHtml ? sigHtml : "", gmail: cGmail.checked, bandeau: cBandeau.checked, pause: cPause.checked };
      var fini = function (r) {
        fermer();
        St.signaler(actifV ? (r && r.gmail === false ? "Vacances activées (bandeau et pause) ; réponse automatique non activée : " + (r.gmail_erreur === "droit" ? "reliez à nouveau Gmail pour l'autoriser" : r.gmail_erreur) : "Bonnes vacances ! Tout est en place jusqu'au " + St.fmt(fin.value + "T12:00:00", { day: "numeric", month: "long" }) + ".")
          : "Bon retour ! Réponse automatique coupée, notifications rétablies.", r && r.gmail === false && actifV);
        St.charger().then(function () { St.dessiner(false); });
      };
      if (St.X.demo) {
        var valeur = actifV ? { actif: true, debut: corps.debut, fin: corps.fin, objet: corps.objet, message: corps.message, signature: !!corps.signature, bandeau: corps.bandeau, pause: corps.pause, gmail: cGmail.checked } : Object.assign({}, v, { actif: false });
        St.enregistrer("reglages", { cle: "vacances", valeur: valeur });
        S.tempsForts = S.tempsForts.filter(function (t) { return !(t.type === "absence" && !t.espace_id && t.libelle === "Lili en congés"); });
        if (actifV && corps.bandeau) S.tempsForts.push({ id: "vac", espace_id: null, libelle: "Lili en congés", debut: corps.debut, fin: corps.fin, type: "absence", visibilite: "partage" });
        fermer(); St.signaler(actifV ? "Démonstration : vacances activées (rien n'est envoyé)" : "Démonstration : bon retour !"); St.dessiner(false); return;
      }
      appelMessagerie(corps).then(fini, function (x) { St.signaler(x.message, true); });
    };
    St.fenetre({ titre: actif ? "Mes vacances" : "En vacances", classe: "large", sous: "Tout se coupe tout seul après la date de retour.", corps: [
      el("div", { class: "deux-colonnes" }, [A.champ("Du", debut), A.champ("Au (dernier jour d'absence)", fin)]),
      el("label", { class: "case-option" }, [cGmail, el("span", {}, [el("b", { text: "Réponse automatique Gmail" }), el("small", { text: "Toute personne qui vous écrit la reçoit, une fois par expéditeur, pendant ces dates." })])]),
      A.champ("Objet de la réponse", objet), A.champ("Message", message),
      el("label", { class: "case-option" }, [cSig, el("span", {}, [el("b", { text: "Ajouter ma signature" }), el("small", { text: sigHtml ? "Votre carte (photo, coordonnées, logo) sous le message, comme dans vos mails." : "Préparez d'abord votre signature : Réglages › Signatures de mail › Ma signature, puis « Enregistrer »." })])]),
      el("label", { class: "case-option" }, [cBandeau, el("span", {}, [el("b", { text: "Bandeau dans l'espace des clients" }), el("small", { text: "« " + prenom + " est en congés jusqu'au … » en haut de leur espace, et l'absence dans le calendrier." })])]),
      el("label", { class: "case-option" }, [cPause, el("span", {}, [el("b", { text: "Pause de mes notifications" }), el("small", { text: "Ni push ni e-mail pour vous pendant ces dates ; tout vous attend dans la cloche au retour." })])]),
      avert],
      actions: [actif ? { texte: "Je suis de retour", danger: true, action: function (f) { envoyer(false, f); } } : null, { texte: "Annuler" },
        { texte: actif ? "Mettre à jour" : "Activer mes vacances", principal: true, action: function (f) { envoyer(true, f); } }].filter(Boolean) });
  };
  V.finVacances = function () {
    A.confirmer("Vous êtes de retour ?", "La réponse automatique se coupe, le bandeau disparaît chez les clients et vos notifications reprennent.", "Je suis de retour", function () {
      if (St.X.demo) { St.enregistrer("reglages", { cle: "vacances", valeur: Object.assign({}, reglage("vacances"), { actif: false }) }); S.tempsForts = S.tempsForts.filter(function (t) { return t.id !== "vac"; }); St.signaler("Démonstration : bon retour !"); St.dessiner(false); return; }
      appelMessagerie({ action: "vacances", actif: false }).then(function () { St.signaler("Bon retour ! Tout est rétabli."); St.charger().then(function () { St.dessiner(false); }); }, function (x) { St.signaler(x.message, true); });
    });
  };
})(window.Studio);
