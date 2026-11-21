/* Étape 7 : les rubriques de chaque client (équipe et invitations, brief, messages, rapports, veille, partenariats,
   temps et facturation, notes internes), les pages Tâches, Prospects et Réglages, l'assistant (touche /) et le brief du jour.
   Côté client, seuls le brief, les rapports et les messages sont ouverts (#brief, #rapports, #messages), et seulement
   ce que Lili a partagé : en ligne, les règles de la base filtrent ; en démonstration, la même règle est imitée ici. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V, MARQUE = window.MARQUE || {};
  var euros = function (n) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(+n || 0); };
  var nombre = function (n) { return n == null || n === "" ? "—" : new Intl.NumberFormat("fr-FR").format(n); };
  var maintenant = function () { return new Date().toISOString(); };
  function champ(libelle, saisie, aide) { return el("label", { class: "champ" }, [el("span", { text: libelle }), saisie, aide ? el("small", { text: aide }) : null]); }
  function texte(valeur, o) { o = o || {}; return el(o.lignes ? "textarea" : "input", Object.assign({ type: o.lignes ? null : (o.type || "text"), rows: o.lignes || null, value: o.lignes ? null : (valeur == null ? "" : valeur), placeholder: o.aide || null }, o.attrs || {}), o.lignes && valeur ? [String(valeur)] : []); }
  function choix(options, valeur, o) {
    return el("select", Object.assign({ "aria-label": (o && o.nom) || null }, (o && o.attrs) || {}), options.map(function (x) { return el("option", { value: x[0], selected: String(x[0]) === String(valeur == null ? "" : valeur), text: x[1] }); }));
  }
  function confirmer(titre, sous, bouton, action, danger) {
    St.fenetre({ titre: titre, sous: sous, actions: [{ texte: "Annuler" }, { texte: bouton, principal: true, action: function (fermer) { fermer(); action(); } }], classe: danger ? "danger" : "" });
  }
  // Ce que voit la personne : Lili tout ; un client (en démonstration) seulement ce qui est partagé dans son espace
  function du(liste, e) {
    return liste.filter(function (x) { return x.espace_id === e.id && (St.estLili() || !St.X.demo || x.visibilite === "partage" || x.visibilite == null); });
  }
  function enteteClient(titre, phrase) { return St.estLili() ? null : St.entete(null, titre, phrase); }
  function basculePartage(table, lignes, apres) {
    var partage = lignes.length && lignes.every(function (l) { return l.visibilite === "partage"; });
    return el("button", { type: "button", class: "bascule" + (partage ? " active" : ""), "aria-pressed": partage ? "true" : "false",
      title: partage ? "Le client le voit. Cliquer pour le rendre interne." : "Seule Lili le voit. Cliquer pour le partager avec le client.",
      onclick: function () {
        Promise.all(lignes.map(function (l) { return St.maj(table, l.id, { visibilite: partage ? "interne" : "partage" }); }))
          .then(function () { St.signaler(partage ? "Redevenu interne" : "Partagé avec le client"); (apres || St.dessiner)(false); });
      } }, [St.icone(partage ? "oeil" : "cadenas"), partage ? "Partagé avec le client" : "Interne"]);
  }
  function echapper(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Une page imprimable (rapport, facture, devis) : nouvelle fenêtre, puis « Enregistrer en PDF » dans la boîte d'impression
  function imprimer(titre, corps) {
    var w = window.open("", "_blank"); if (!w) { St.signaler("La fenêtre d'impression a été bloquée par le navigateur", true); return; }
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + echapper(titre) + '</title>' +
      '<link rel="stylesheet" href="' + new URL("assets/polices/polices.css", location.href).href + '">' +
      '<style>@page{size:A4;margin:16mm}body{font:13px/1.5 Geist,system-ui,sans-serif;color:#1E1A17;margin:0}h1,h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;margin:0}' +
      'h1{font-size:30px}h2{font-size:18px;margin:22px 0 8px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #E7E0D5;vertical-align:top}' +
      'th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8B8178;font-weight:600}.n{text-align:right;font-family:"Geist Mono",monospace;white-space:nowrap}' +
      '.deux{display:flex;justify-content:space-between;gap:30px;margin:18px 0}.petit{color:#5F574F;font-size:12px}.filet{height:3px;background:#A9553A;width:46px;margin:10px 0 18px}' +
      '.totaux{margin-left:auto;width:280px}.totaux td{border:0;padding:4px 6px}.totaux tr:last-child td{font-weight:600;border-top:1px solid #1E1A17;padding-top:8px}' +
      'q{font-family:"Bodoni Moda",Georgia,serif;font-style:italic;font-size:15px}.brouillon{position:fixed;top:40%;left:0;right:0;text-align:center;font:600 60px Geist;color:rgba(169,85,58,.12);transform:rotate(-18deg)}' +
      '</style></head><body>' + corps + '<script>document.fonts.ready.then(function(){setTimeout(function(){print()},150)})<\/script></body></html>');
    w.document.close();
  }
  function entreprise() { return ((S.reglages.filter(function (r) { return r.cle === "entreprise"; })[0] || {}).valeur) || {}; }

  // ======================================================================
  // Équipe de l'espace : les personnes invitées (clients, photographe…) et l'invitation par lien
  // ======================================================================
  V.rub_equipe = function (r, e) {
    var ms = S.membres.filter(function (m) { return m.espace_id === e.id; });
    var liste = ms.length ? el("ul", { class: "equipe" }, ms.map(function (m) {
      var p = St.personne(m.personne_id) || {};
      return el("li", {}, [
        el("span", { class: "avatar", style: { "--c": e.couleur }, text: St.initiales(p.nom || p.email) }),
        el("span", { class: "equipe-texte" }, [el("b", { text: p.nom || p.email || "Sans nom" }), el("small", { text: [p.email, m.fonction].filter(Boolean).join(" · ") })]),
        el("span", { class: "etiquette", text: m.role === "invite" ? "Invité" : "Client" }),
        el("button", { type: "button", class: "btn-texte", title: "Renvoyer un lien de connexion", onclick: function () { envoyerInvitation(e, { email: p.email, nom: p.nom, role: m.role, fonction: m.fonction }); } }, ["Renvoyer un lien"]),
        el("button", { type: "button", class: "btn-icone", "aria-label": "Retirer " + (p.nom || "") + " de l'espace", onclick: function () {
          confirmer("Retirer " + (p.nom || "cette personne") + " ?", "Son compte reste, mais elle ne voit plus l'espace " + e.nom + ".", "Retirer", function () {
            (St.X.demo ? St.supprimer("membres", { espace_id: e.id, personne_id: m.personne_id }) : St.appel("inviter", { retirer: true, espace_id: e.id, personne_id: m.personne_id }).then(St.charger))
              .then(function () { St.signaler("Retiré de l'espace"); St.dessiner(false); }, function (x) { St.signaler(x.message, true); });
          });
        } }, [St.icone("fermer")])
      ]);
    })) : St.vide("Personne n'est encore invité dans cet espace.");
    return el("div", { class: "rubrique-etroite" }, [
      el("div", { class: "barre-outils" }, [el("p", { class: "phrase", text: "Chaque personne invitée reçoit un lien pour choisir son mot de passe. Un client voit son espace et ce que vous partagez ; un invité, seulement ce qui lui est partagé." }),
        el("button", { type: "button", class: "btn-plein", onclick: function () { inviter(e); } }, [St.icone("plus"), "Inviter"])]),
      liste
    ]);
  };
  function inviter(e) {
    var nom = texte("", { aide: "Prénom et nom" }), email = texte("", { type: "email", aide: "adresse@exemple.fr" }), fonction = texte("", { aide: "Responsable marketing, photographe…" });
    var role = choix([["client", "Client : voit son espace et ce qui est partagé"], ["invite", "Invité : seulement ce qui lui est partagé"]], "client", { nom: "Rôle" });
    St.fenetre({ titre: "Inviter dans " + e.nom, sous: "Un lien de connexion part depuis votre boîte Gmail si elle est reliée ; sinon, vous le copiez et l'envoyez vous-même.",
      corps: [champ("Nom", nom), champ("E-mail", email), champ("Fonction", fonction), champ("Rôle", role)],
      actions: [{ texte: "Annuler" }, { texte: "Inviter", principal: true, action: function (fermer) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { email.focus(); return; }
        fermer(); envoyerInvitation(e, { email: email.value.trim(), nom: nom.value.trim(), role: role.value, fonction: fonction.value.trim() });
      } }] });
  }
  function envoyerInvitation(e, o) {
    if (St.X.demo) {
      var deja = S.personnes.filter(function (p) { return p.email === o.email; })[0], id = deja ? deja.id : St.uuid();
      if (!deja) S.personnes.push({ id: id, nom: o.nom || o.email.split("@")[0], email: o.email, role: o.role });
      if (!S.membres.some(function (m) { return m.espace_id === e.id && m.personne_id === id; })) S.membres.push({ espace_id: e.id, personne_id: id, role: o.role, fonction: o.fonction || null });
      St.signaler("Démonstration : invitation simulée, rien n'est envoyé"); St.dessiner(false); return;
    }
    St.signaler("Invitation en cours…");
    St.appel("inviter", { espace_id: e.id, email: o.email, nom: o.nom, role: o.role, fonction: o.fonction }).then(function (res) {
      return St.charger().then(function () {
        St.dessiner(false);
        if (res.envoye) St.signaler("Invitation envoyée à " + o.email);
        else montrerLien(res.lien, o.email);
      });
    }).catch(function (x) { St.signaler("Invitation impossible : " + x.message, true); });
  }
  function montrerLien(lien, email) {
    var champLien = el("input", { type: "text", readonly: true, value: lien, onfocus: function (ev) { ev.target.select(); } });
    St.fenetre({ titre: "Lien d'invitation", sous: "La boîte Gmail n'est pas encore reliée (page Mails) : envoyez ce lien à " + email + " vous-même. Il est valable 24 heures et ne sert qu'une fois.",
      corps: [champLien], actions: [{ texte: "Fermer" }, { texte: "Copier le lien", principal: true, action: function (fermer) {
        navigator.clipboard.writeText(lien).then(function () { St.signaler("Lien copié"); fermer(); }, function () { champLien.select(); });
      } }] });
  }

  // ======================================================================
  // Brief et ligne éditoriale : Lili le tient, le client le lit (une fois partagé)
  // ======================================================================
  var CHAMPS_BRIEF = [["cible", "Cible", "Qui la marque veut toucher : âge, lieu, habitudes"], ["ton", "Ton", "Comment la marque parle : chaleureux, expert, drôle…"],
    ["objectifs", "Objectifs", "Ce que l'on cherche ce trimestre : notoriété, réservations, recrutement…"]];
  function briefDe(e) { return S.briefs.filter(function (b) { return b.espace_id === e.id; })[0] || null; }
  function liste(v) { return Array.isArray(v) ? v.map(function (x) { return typeof x === "string" ? x : (x && (x.nom || x.libelle)) || ""; }).filter(Boolean) : []; }
  V.rub_brief = function (r, e) {
    var b = briefDe(e);
    if (!St.estLili()) {
      if (!b || (St.X.demo && b.visibilite !== "partage")) return el("div", {}, [enteteClient("Brief et ligne éditoriale"), St.vide("Lili n'a pas encore partagé le brief de " + e.nom + ".")]);
      var sec = function (t, contenu) { return contenu ? el("section", { class: "bloc brief-lu" }, [el("h2", { text: t }), contenu]) : null; };
      var puces = function (l, cls) { return l.length ? el("ul", { class: "puces-mots " + (cls || "") }, l.map(function (x) { return el("li", { text: x }); })) : null; };
      return el("div", { class: "rubrique-etroite" }, [enteteClient("Brief et ligne éditoriale", "Ce qui guide chaque publication de " + e.nom + "."),
        el("div", { class: "pile" }, [sec("Cible", b.cible && el("p", { text: b.cible })), sec("Ton", b.ton && el("p", { text: b.ton })),
          sec("Piliers éditoriaux", puces(liste(b.piliers))), sec("Mots à utiliser", puces(b.mots_oui || [], "oui")), sec("Mots à éviter", puces(b.mots_non || [], "non")),
          sec("Objectifs", b.objectifs && el("p", { text: b.objectifs }))])]);
    }
    var sauver = function (champs) { return St.enregistrer("briefs", Object.assign({ espace_id: e.id, modifie_le: maintenant() }, champs)).then(function () { St.signaler("Brief enregistré"); }); };
    var zones = CHAMPS_BRIEF.map(function (c) {
      var t = texte(b && b[c[0]], { lignes: 3, aide: c[2] }); t.addEventListener("change", function () { var o = {}; o[c[0]] = t.value.trim() || null; sauver(o); });
      return champ(c[1], t);
    });
    var enListe = function (nom, libelle, aide, json) {
      var v = b ? (json ? liste(b[nom]) : b[nom] || []) : [], t = texte(v.join("\n"), { lignes: 3, aide: aide });
      t.addEventListener("change", function () { var o = {}; o[nom] = t.value.split(/\n|;/).map(function (x) { return x.trim(); }).filter(Boolean); sauver(o); });
      return champ(libelle, t, "Un par ligne");
    };
    var partage = b && b.visibilite === "partage";
    return el("div", { class: "rubrique-etroite" }, [
      el("div", { class: "barre-outils" }, [el("p", { class: "phrase", text: b && b.modifie_le ? "Modifié " + St.ilya(b.modifie_le) + ". L'assistant s'appuie sur ce brief pour écrire." : "L'assistant s'appuie sur ce brief pour proposer des idées et des légendes." }),
        el("button", { type: "button", class: "bascule" + (partage ? " active" : ""), "aria-pressed": partage ? "true" : "false", onclick: function () {
          sauver({ visibilite: partage ? "interne" : "partage" }).then(function () { St.dessiner(false); });
        } }, [St.icone(partage ? "oeil" : "cadenas"), partage ? "Partagé avec le client" : "Interne"])]),
      el("div", { class: "bloc formulaire" }, zones.concat([
        enListe("piliers", "Piliers éditoriaux", "Coulisses de l'atelier\nConseils d'entretien", true),
        el("div", { class: "deux-colonnes" }, [enListe("mots_oui", "Mots à utiliser", "artisanal\nde saison"), enListe("mots_non", "Mots à éviter", "pas cher\npromo")]),
        enListe("concurrents", "Concurrents et inspirations", "@compte_voisin", true)
      ]))
    ]);
  };

  // ======================================================================
  // Messages : la conversation de l'espace (Lili et les clients)
  // ======================================================================
  V.rub_messages = function (r, e) {
    var ms = S.messages.filter(function (m) { return m.espace_id === e.id; }).sort(function (a, b) { return String(a.cree_le).localeCompare(String(b.cree_le)); });
    var fil = el("div", { class: "fil-messages", role: "log", "aria-label": "Messages" }, ms.length ? ms.map(function (m) {
      var a = St.personne(m.auteur_id) || {}, moi = S.moi && m.auteur_id === S.moi.id;
      return el("div", { class: "message" + (moi ? " moi" : "") }, [
        el("span", { class: "avatar", style: { "--c": a.role === "proprietaire" ? "var(--terre)" : e.couleur }, text: St.initiales(a.nom) }),
        el("div", {}, [el("small", { text: (moi ? "Vous" : a.nom || "") + " · " + St.ilya(m.cree_le) }), el("p", { text: m.contenu })])
      ]);
    }) : [St.vide(St.estLili() ? "Aucun message avec " + e.nom + " pour l'instant." : "Écrivez ici à Lili : une question, une idée, une info pour la semaine.")]);
    var saisie = el("textarea", { rows: 2, placeholder: St.estLili() ? "Écrire à " + e.nom + "…" : "Écrire à Lili…", "aria-label": "Message" });
    var envoyer = function () {
      var t = saisie.value.trim(); if (!t) return;
      saisie.value = "";
      St.creer("messages", { espace_id: e.id, auteur_id: S.moi.id, contenu: t, pieces: [] }).then(function () { St.dessiner(false); var f = document.querySelector(".fil-messages"); if (f) f.scrollTop = f.scrollHeight; });
    };
    saisie.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); envoyer(); } });
    setTimeout(function () { fil.scrollTop = fil.scrollHeight; }, 0);
    return el("div", { class: "rubrique-etroite" }, [enteteClient("Messages", "La conversation avec Lili."), el("div", { class: "bloc messagerie" }, [fil,
      el("div", { class: "saisie-message" }, [saisie, el("button", { type: "button", class: "btn-plein", onclick: envoyer, text: "Envoyer" })]),
      St.estLili() ? el("small", { class: "aide", text: "Le client est prévenu par un e-mail groupé, envoyé depuis votre boîte Gmail une fois reliée." }) : null])]);
  };

  // ======================================================================
  // Rapports : chiffres du mois par réseau, évolution, commentaire ; partagés quand Lili les publie
  // ======================================================================
  var NOMS_MOIS = function (m) { return St.fmt(m + "T12:00:00", { month: "long", year: "numeric" }); };
  function courbe(valeurs, couleur) {
    var v = valeurs.filter(function (x) { return x != null; }); if (v.length < 2) return null;
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v), l = 160, h = 40, pas = l / (valeurs.length - 1);
    var pts = valeurs.map(function (x, i) { return x == null ? null : [i * pas, h - 4 - (max === min ? (h - 8) / 2 : (x - min) / (max - min) * (h - 8))]; }).filter(Boolean);
    var s = '<svg viewBox="-3 0 ' + (l + 6) + ' ' + h + '" width="' + l + '" height="' + h + '" role="img" aria-label="Évolution"><polyline fill="none" stroke="' + couleur + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' +
      pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/><circle r="3" fill="' + couleur + '" cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '"/></svg>';
    return el("span", { class: "courbe", html: s });
  }
  function ecart(a, b, pct) {
    if (a == null || b == null) return null;
    var d = a - b; if (!d) return el("small", { class: "ecart", text: "=" });
    return el("small", { class: "ecart " + (d > 0 ? "plus" : "moins"), text: (d > 0 ? "+" : "−") + (pct ? Math.abs(d).toFixed(1).replace(".", ",") + " pt" : nombre(Math.abs(d))) });
  }
  var MESURES = [["abonnes", "Abonnés"], ["portee", "Portée"], ["impressions", "Impressions"], ["interactions", "Interactions"], ["engagement", "Engagement (%)"]];
  V.rub_rapports = function (r, e) {
    var rs = du(S.rapports, e), mois = Array.from(new Set(rs.map(function (x) { return x.mois; }))).sort().reverse();
    var reseaux = Array.from(new Set(rs.map(function (x) { return x.reseau; })));
    var val = function (m, res, k) { var x = rs.filter(function (y) { return y.mois === m && y.reseau === res; })[0]; return x ? x[k] : null; };
    var tendances = reseaux.length ? el("div", { class: "tendances" }, reseaux.map(function (res) {
      var serie = mois.filter(function (m) { return val(m, res, "abonnes") != null; }).slice(0, 12).reverse().map(function (m) { return val(m, res, "abonnes"); });
      var dernier = serie[serie.length - 1], avant = serie[serie.length - 2];
      return el("div", { class: "bloc tendance" }, [el("span", { class: "surtitre", text: "Abonnés " + ((St.RESEAUX[res] || {}).nom || res) }), el("b", { text: nombre(dernier) }),
        ecart(dernier, avant), courbe(serie, St.foncee(e.couleur) || "#1E1A17")]);
    })) : null;
    var cartes = mois.map(function (m, i) {
      var lignes = rs.filter(function (x) { return x.mois === m; }), prec = mois[i + 1], com = (lignes.filter(function (x) { return x.commentaire; })[0] || {}).commentaire;
      return el("section", { class: "bloc rapport" }, [
        el("header", {}, [el("h2", { text: NOMS_MOIS(m) }), St.estLili() ? basculePartage("rapports", lignes) : null,
          el("button", { type: "button", class: "btn-texte", onclick: function () { imprimerRapport(e, m, lignes, prec ? rs.filter(function (x) { return x.mois === prec; }) : []); } }, [St.icone("imprimer"), "PDF"]),
          St.estLili() ? el("button", { type: "button", class: "btn-texte", onclick: function () { saisirMois(e, m); } }, ["Modifier"]) : null]),
        el("div", { class: "table-defile" }, [el("table", { class: "table-chiffres" }, [
          el("thead", {}, [el("tr", {}, [el("th", { text: "Réseau" })].concat(MESURES.map(function (k) { return el("th", { class: "n", text: k[1] }); })))]),
          el("tbody", {}, lignes.map(function (x) {
            return el("tr", {}, [el("td", { text: (St.RESEAUX[x.reseau] || {}).nom || x.reseau })].concat(MESURES.map(function (k) {
              var v = x[k[0]];
              return el("td", { class: "n" }, [k[0] === "engagement" ? (v == null ? "—" : String(v).replace(".", ",") + " %") : nombre(v), prec ? ecart(v, val(prec, x.reseau, k[0]), k[0] === "engagement") : null]);
            })));
          }))
        ])]),
        com ? el("q", { class: "commentaire-rapport", text: com }) : null
      ]);
    });
    return el("div", {}, [enteteClient("Rapports", "Les chiffres de " + e.nom + ", mois par mois."),
      St.estLili() ? el("div", { class: "barre-outils" }, [el("p", { class: "phrase", text: "Saisissez les chiffres en début de mois ; partagez le rapport quand il est prêt." }),
        el("button", { type: "button", class: "btn-plein", onclick: function () { saisirMois(e); } }, [St.icone("plus"), "Saisir un mois"])]) : null,
      tendances, cartes.length ? el("div", { class: "pile" }, cartes) : St.vide(St.estLili() ? "Aucun chiffre saisi pour " + e.nom + "." : "Lili n'a pas encore partagé de rapport.")]);
  };
  function saisirMois(e, moisChoisi) {
    var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    var options = Array.from({ length: 18 }, function (_, i) { var x = new Date(d); x.setMonth(d.getMonth() - i + 1); return [St.iso(x), NOMS_MOIS(St.iso(x))]; });
    var mois = choix(options, moisChoisi || St.iso(d), { nom: "Mois" }), reseaux = (e.reseaux && e.reseaux.length ? e.reseaux : ["instagram"]);
    var existants = function () { return S.rapports.filter(function (x) { return x.espace_id === e.id && x.mois === mois.value; }); };
    var grille = el("div", { class: "grille-saisie" }), com = texte("", { lignes: 3, aide: "Ce qui a marché, ce que l'on change le mois prochain" });
    var remplir = function () {
      grille.textContent = "";
      grille.appendChild(el("span")); MESURES.forEach(function (k) { grille.appendChild(el("small", { text: k[1] })); });
      reseaux.forEach(function (res) {
        var x = existants().filter(function (y) { return y.reseau === res; })[0] || {};
        grille.appendChild(el("b", { text: (St.RESEAUX[res] || {}).nom || res }));
        MESURES.forEach(function (k) { grille.appendChild(el("input", { type: "number", min: 0, step: k[0] === "engagement" ? "0.1" : "1", inputmode: "decimal", "data-res": res, "data-k": k[0], value: x[k[0]] == null ? "" : x[k[0]], "aria-label": k[1] + " " + res })); });
      });
      com.value = (existants().filter(function (y) { return y.commentaire; })[0] || {}).commentaire || "";
    };
    mois.addEventListener("change", remplir); remplir();
    St.fenetre({ titre: "Chiffres du mois", sous: e.nom + " · relevés dans les statistiques de chaque réseau", classe: "large", corps: [champ("Mois", mois), el("div", { class: "table-defile" }, [grille]), champ("Commentaire de Lili", com)],
      actions: [{ texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
        var travaux = reseaux.map(function (res, i) {
          var champs = { commentaire: i === 0 ? (com.value.trim() || null) : null };
          grille.querySelectorAll('input[data-res="' + res + '"]').forEach(function (inp) { champs[inp.dataset.k] = inp.value === "" ? null : +inp.value; });
          if (MESURES.every(function (k) { return champs[k[0]] == null; }) && !champs.commentaire) return null;
          var x = existants().filter(function (y) { return y.reseau === res; })[0];
          return x ? St.maj("rapports", x.id, champs) : St.creer("rapports", Object.assign({ espace_id: e.id, mois: mois.value, reseau: res, visibilite: "interne", meilleures: [], source: "saisie" }, champs));
        }).filter(Boolean);
        Promise.all(travaux).then(function () { fermer(); St.signaler("Chiffres enregistrés (interne tant que vous ne partagez pas)"); St.dessiner(false); });
      } }] });
  }
  function imprimerRapport(e, m, lignes, prec) {
    var v = function (res, k) { var x = prec.filter(function (y) { return y.reseau === res; })[0]; return x ? x[k] : null; };
    var com = (lignes.filter(function (x) { return x.commentaire; })[0] || {}).commentaire;
    imprimer("Rapport " + e.nom + " " + NOMS_MOIS(m),
      '<p class="petit">' + echapper(e.nom) + ' · ' + echapper(MARQUE.proprietaire || "") + '</p><h1>Rapport de ' + echapper(NOMS_MOIS(m)) + '</h1><div class="filet"></div>' +
      '<table><thead><tr><th>Réseau</th>' + MESURES.map(function (k) { return '<th class="n">' + k[1] + '</th>'; }).join("") + '</tr></thead><tbody>' +
      lignes.map(function (x) {
        return '<tr><td>' + echapper((St.RESEAUX[x.reseau] || {}).nom || x.reseau) + '</td>' + MESURES.map(function (k) {
          var a = x[k[0]], b = v(x.reseau, k[0]), d = a != null && b != null ? a - b : null;
          return '<td class="n">' + (a == null ? "—" : k[0] === "engagement" ? String(a).replace(".", ",") + " %" : nombre(a)) + (d ? '<br><span class="petit">' + (d > 0 ? "+" : "−") + (k[0] === "engagement" ? Math.abs(d).toFixed(1).replace(".", ",") + " pt" : nombre(Math.abs(d))) + '</span>' : "") + '</td>';
        }).join("") + '</tr>';
      }).join("") + '</tbody></table>' + (com ? '<h2>Le mot de Lili</h2><q>' + echapper(com) + '</q>' : ""));
  }

  // ======================================================================
  // Veille : comptes et publications repérés, transformables en idée de publication
  // ======================================================================
  V.rub_veille = function (r, e) {
    var vs = S.veille.filter(function (x) { return x.espace_id === e.id; }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    var compte = texte("", { aide: "@compte ou nom" }), lien = texte("", { type: "url", aide: "https://…" }), note = texte("", { lignes: 2, aide: "Ce qui est intéressant, l'idée à reprendre" });
    var ajout = el("form", { class: "bloc formulaire ajout-veille", onsubmit: function (ev) {
      ev.preventDefault(); if (!compte.value.trim() && !lien.value.trim()) { compte.focus(); return; }
      St.creer("veille", { espace_id: e.id, compte: compte.value.trim() || null, lien: lien.value.trim() || null, note: note.value.trim() || null, visibilite: "interne" }).then(function () { St.dessiner(false); });
    } }, [el("div", { class: "deux-colonnes" }, [champ("Compte", compte), champ("Lien", lien)]), champ("Note", note), el("div", {}, [el("button", { type: "submit", class: "btn-plein", text: "Ajouter à la veille" })])]);
    return el("div", { class: "rubrique-etroite" }, [ajout, vs.length ? el("ul", { class: "liste-veille" }, vs.map(function (v) {
      var p = v.publication_id && St.publication(v.publication_id);
      return el("li", { class: "bloc" }, [
        el("div", {}, [el("b", { text: v.compte || "Repérage" }), el("small", { text: " · " + St.ilya(v.cree_le) }),
          v.lien && /^https?:\/\//.test(v.lien) ? el("a", { class: "lien-externe", href: v.lien, target: "_blank", rel: "noopener noreferrer", text: v.lien.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60) }) : null,
          v.note ? el("p", { text: v.note }) : null]),
        el("div", { class: "actions-ligne" }, [
          p ? el("a", { class: "btn-texte", href: "#p/" + p.id, text: "Voir la publication" }) : el("button", { type: "button", class: "btn-texte", onclick: function () { versPublication(e, v); } }, [St.icone("plus"), "En faire une publication"]),
          el("button", { type: "button", class: "btn-icone", "aria-label": "Supprimer", onclick: function () { confirmer("Supprimer ce repérage ?", "Il disparaît de la veille.", "Supprimer", function () { St.supprimer("veille", { id: v.id }).then(function () { St.dessiner(false); }); }); } }, [St.icone("corbeille")])
        ])
      ]);
    })) : St.vide("Rien en veille pour " + e.nom + ".")]);
  };
  function versPublication(e, v) {
    St.creer("publications", { espace_id: e.id, titre: (v.note || ("Inspiration : " + (v.compte || ""))).split("\n")[0].slice(0, 100), legende: "", statut: "idee", visibilite: "interne",
      reseaux: (e.reseaux || []).slice(0, 1).concat((e.reseaux || []).length ? [] : ["instagram"]), format: "post", hashtags: [], mentions: [], etapes: [], etiquettes: ["veille"] }).then(function (p) {
      St.creer("notes_internes", { espace_id: e.id, publication_id: p.id, contenu: "Vu en veille : " + [v.compte, v.lien, v.note].filter(Boolean).join(" · ") });
      return St.maj("veille", v.id, { publication_id: p.id }).then(function () { St.aller("p/" + p.id); });
    });
  }

  // ======================================================================
  // Partenariats : influenceurs, marques amies, échanges
  // ======================================================================
  var ETAPES_PART = [["repere", "Repéré"], ["contacte", "Contacté"], ["en-discussion", "En discussion"], ["accord", "Accord"], ["realise", "Réalisé"], ["refuse", "Refusé"]];
  V.rub_partenariats = function (r, e) {
    var ps = S.partenaires.filter(function (x) { return x.espace_id === e.id; });
    return el("div", {}, [
      el("div", { class: "barre-outils" }, [el("p", { class: "phrase", text: "Influenceurs, commerces voisins, marques amies : qui l'on contacte et ce que l'on échange." }),
        el("button", { type: "button", class: "btn-plein", onclick: function () { editerPartenaire(e); } }, [St.icone("plus"), "Nouveau partenaire"])]),
      colonnes(ETAPES_PART, ps, "statut", function (x) {
        return el("button", { type: "button", class: "carte-colonne", onclick: function () { editerPartenaire(e, x); } }, [el("b", { text: x.nom }),
          el("small", { text: [x.compte, x.reseau && (St.RESEAUX[x.reseau] || {}).nom, x.audience ? nombre(x.audience) + " abonnés" : null].filter(Boolean).join(" · ") }),
          x.contreparties ? el("span", { class: "extrait", text: x.contreparties }) : null]);
      }, function (id, statut) { St.maj("partenaires", id, { statut: statut }).then(function () { St.dessiner(false); }); })
    ]);
  };
  function editerPartenaire(e, x) {
    x = x || {};
    var nom = texte(x.nom), compte = texte(x.compte, { aide: "@compte" }), reseau = choix([["", "Réseau"]].concat(Object.keys(St.RESEAUX).map(function (k) { return [k, St.RESEAUX[k].nom]; })), x.reseau, { nom: "Réseau" });
    var audience = texte(x.audience, { type: "number", attrs: { min: 0 } }), contact = texte(x.contact, { aide: "e-mail, téléphone" }), contre = texte(x.contreparties, { lignes: 2, aide: "Produits offerts, visibilité croisée…" });
    var statut = choix(ETAPES_PART, x.statut || "repere", { nom: "Étape" });
    St.fenetre({ titre: x.id ? x.nom : "Nouveau partenaire", sous: e.nom, corps: [champ("Nom", nom), el("div", { class: "deux-colonnes" }, [champ("Compte", compte), champ("Réseau", reseau)]),
      el("div", { class: "deux-colonnes" }, [champ("Audience", audience), champ("Étape", statut)]), champ("Contact", contact), champ("Contreparties", contre)],
      actions: [x.id ? { texte: "Supprimer", danger: true, action: function (fermer) { fermer(); confirmer("Supprimer " + x.nom + " ?", "Le partenaire disparaît de la liste.", "Supprimer", function () { St.supprimer("partenaires", { id: x.id }).then(function () { St.dessiner(false); }); }); } } : null,
        { texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
          if (!nom.value.trim()) { nom.focus(); return; }
          var champs = { nom: nom.value.trim(), compte: compte.value.trim() || null, reseau: reseau.value || null, audience: audience.value ? +audience.value : null, contact: contact.value.trim() || null, contreparties: contre.value.trim() || null, statut: statut.value };
          (x.id ? St.maj("partenaires", x.id, champs) : St.creer("partenaires", Object.assign({ espace_id: e.id, visibilite: "interne", echanges: [], publications: [] }, champs))).then(function () { fermer(); St.dessiner(false); });
        } }].filter(Boolean) });
  }

  // Colonnes à glisser (partenariats, tâches, prospects) ; sur téléphone, la fiche de chaque carte permet de changer d'étape
  function colonnes(etapes, items, cle, carte, deplacer) {
    return el("div", { class: "colonnes" }, etapes.map(function (et) {
      var col = el("section", { class: "colonne", "aria-label": et[1],
        ondragover: function (ev) { ev.preventDefault(); col.classList.add("survol"); }, ondragleave: function () { col.classList.remove("survol"); },
        ondrop: function (ev) { ev.preventDefault(); col.classList.remove("survol"); var id = ev.dataTransfer.getData("text/plain"); if (id) deplacer(id, et[0]); } },
        [el("header", {}, [el("h2", { text: et[1] }), el("span", { class: "compte", text: String(items.filter(function (x) { return x[cle] === et[0]; }).length) })])]
          .concat(items.filter(function (x) { return x[cle] === et[0]; }).map(function (x) {
            var c = carte(x); c.draggable = true; c.addEventListener("dragstart", function (ev) { ev.dataTransfer.setData("text/plain", x.id); ev.dataTransfer.effectAllowed = "move"; }); return c;
          })));
      return col;
    }));
  }

  // ======================================================================
  // Temps et facturation : temps passé face au forfait, factures (numérotées à l'émission) et devis
  // ======================================================================
  function minutesDe(t) {
    t = String(t || "").trim().toLowerCase().replace(",", ".");
    var m = /^(\d+(?:\.\d+)?)\s*h\s*(\d{1,2})?$/.exec(t); if (m) return Math.round(+m[1] * 60 + (+m[2] || 0));
    m = /^(\d+)\s*(min|mn|m)?$/.exec(t); if (m) return +m[1];
    return 0;
  }
  function duree(min) { var h = Math.floor(min / 60), m = min % 60; return h ? h + " h" + (m ? " " + St.pad(m) : "") : m + " min"; }
  var STATUTS_FACT = { brouillon: "Brouillon", emise: "Émise", payee: "Payée", annulee: "Annulée", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé" };
  function totaux(lignes) {
    var ht = 0, tva = 0;
    (lignes || []).forEach(function (l) { var x = (+l.quantite || 0) * (+l.prix_ht || 0); ht += x; tva += x * (+l.tva || 0) / 100; });
    ht = Math.round(ht * 100) / 100; tva = Math.round(tva * 100) / 100;
    return { total_ht: ht, total_tva: tva, total_ttc: Math.round((ht + tva) * 100) / 100 };
  }
  V.rub_facturation = function (r, e) {
    var pr = St.prive(e.id), debut = St.iso(new Date()).slice(0, 8) + "01";
    var ts = S.temps.filter(function (t) { return t.espace_id === e.id; }).sort(function (a, b) { return String(b.jour).localeCompare(String(a.jour)); });
    var duMois = ts.filter(function (t) { return t.jour >= debut; }).reduce(function (s, t) { return s + t.minutes; }, 0), prevu = (+pr.heures_forfait || 0) * 60;
    var part = prevu ? Math.min(100, Math.round(duMois / prevu * 100)) : 0;
    var jour = el("input", { type: "date", value: St.iso(new Date()), "aria-label": "Jour" }), dureeI = texte("", { aide: "1h30, 45…", attrs: { "aria-label": "Durée", inputmode: "text" } }), note = texte("", { aide: "Ce qui a été fait", attrs: { "aria-label": "Note" } });
    var temps = el("section", { class: "bloc" }, [
      el("header", {}, [el("h2", { text: "Temps passé" }), el("span", { class: "compte", text: duree(duMois) + (prevu ? " sur " + duree(prevu) : "") })]),
      prevu ? el("div", { class: "jauge" + (duMois > prevu ? " depasse" : ""), role: "progressbar", "aria-valuenow": part, "aria-valuemin": 0, "aria-valuemax": 100 }, [el("i", { style: { width: part + "%" } })]) : el("p", { class: "aide", text: "Aucun forfait d'heures renseigné pour ce client." }),
      el("form", { class: "saisie-temps", onsubmit: function (ev) {
        ev.preventDefault(); var mn = minutesDe(dureeI.value); if (!mn) { dureeI.focus(); return; }
        St.creer("temps", { espace_id: e.id, jour: jour.value || St.iso(new Date()), minutes: mn, note: note.value.trim() || null }).then(function () { St.dessiner(false); });
      } }, [jour, dureeI, note, el("button", { type: "submit", class: "btn-plein", text: "Ajouter" })]),
      ts.length ? el("ul", { class: "liste-temps" }, ts.slice(0, 12).map(function (t) {
        return el("li", {}, [el("span", { class: "mono", text: St.fmt(t.jour + "T12:00:00", { day: "numeric", month: "short" }) }), el("span", { text: t.note || "" }), el("b", { class: "mono", text: duree(t.minutes) }),
          el("button", { type: "button", class: "btn-icone", "aria-label": "Supprimer", onclick: function () { St.supprimer("temps", { id: t.id }).then(function () { St.dessiner(false); }); } }, [St.icone("fermer")])]);
      })) : null
    ]);
    var fs = S.factures.filter(function (f) { return f.espace_id === e.id; }).sort(function (a, b) { return (b.numero || 1e9) - (a.numero || 1e9) || String(b.cree_le).localeCompare(String(a.cree_le)); });
    var ds = S.devis.filter(function (d) { return d.espace_id === e.id; }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    return el("div", { class: "pile" }, [temps,
      el("section", { class: "bloc" }, [el("header", {}, [el("h2", { text: "Factures" }), el("span", { class: "compte", text: String(fs.length) }),
        el("button", { type: "button", class: "btn-texte bloc-lien", onclick: function () { editerPiece("factures", { espace_id: e.id }); } }, [St.icone("plus"), "Nouvelle facture"])]),
        fs.length ? tablePieces("factures", fs) : St.vide("Aucune facture pour " + e.nom + ".")]),
      el("section", { class: "bloc" }, [el("header", {}, [el("h2", { text: "Devis" }), el("span", { class: "compte", text: String(ds.length) }),
        el("button", { type: "button", class: "btn-texte bloc-lien", onclick: function () { editerPiece("devis", { espace_id: e.id }); } }, [St.icone("plus"), "Nouveau devis"])]),
        ds.length ? tablePieces("devis", ds) : St.vide("Aucun devis.")])
    ]);
  };
  function tablePieces(table, pieces) {
    var fact = table === "factures";
    return el("div", { class: "table-defile" }, [el("table", { class: "table-chiffres pieces" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "N°" }), el("th", { text: "Objet" }), el("th", { text: "Date" }), el("th", { class: "n", text: "TTC" }), el("th", { text: "État" }), el("th", { text: "" })])]),
      el("tbody", {}, pieces.map(function (f) {
        var actions = [];
        if (f.statut === "brouillon") actions.push(el("button", { type: "button", class: "btn-texte", text: "Modifier", onclick: function () { editerPiece(table, f); } }));
        if (fact && f.statut === "brouillon") actions.push(el("button", { type: "button", class: "btn-texte", text: "Émettre", onclick: function () { emettre(f); } }));
        if (fact && f.statut === "emise") actions.push(el("button", { type: "button", class: "btn-texte", text: "Payée", onclick: function () { St.maj("factures", f.id, { statut: "payee", payee_le: St.iso(new Date()) }).then(function () { St.dessiner(false); }); } }));
        if (!fact && f.statut === "brouillon") actions.push(el("button", { type: "button", class: "btn-texte", text: "Marquer envoyé", onclick: function () { St.maj("devis", f.id, { statut: "envoye", date_devis: f.date_devis || St.iso(new Date()) }).then(function () { St.dessiner(false); }); } }));
        if (!fact && f.statut === "envoye") { actions.push(el("button", { type: "button", class: "btn-texte", text: "Accepté", onclick: function () { St.maj("devis", f.id, { statut: "accepte" }).then(function () { St.dessiner(false); }); } })); actions.push(el("button", { type: "button", class: "btn-texte", text: "Refusé", onclick: function () { St.maj("devis", f.id, { statut: "refuse" }).then(function () { St.dessiner(false); }); } })); }
        actions.push(f.pdf_path ? el("button", { type: "button", class: "btn-texte", onclick: function () { ouvrirPdf(f.pdf_path); } }, [St.icone("imprimer"), "PDF"])
          : el("button", { type: "button", class: "btn-texte", onclick: function () { imprimerPiece(table, f); } }, [St.icone("imprimer"), "PDF"]));
        var d = fact ? f.date_facture : f.date_devis;
        return el("tr", {}, [el("td", { class: "mono", text: f.numero ? String(f.numero) : "—" }), el("td", { text: [f.objet, f.periode].filter(Boolean).join(" · ") || "Sans objet" }),
          el("td", { class: "mono", text: d ? St.fmt(d + "T12:00:00", { day: "numeric", month: "short", year: "numeric" }) : "—" }), el("td", { class: "n", text: euros(f.total_ttc) }),
          el("td", {}, [el("span", { class: "etat-piece e-" + f.statut, text: STATUTS_FACT[f.statut] || f.statut })]), el("td", { class: "actions-ligne" }, actions)]);
      }))
    ])]);
  }
  function ouvrirPdf(chemin) {
    if (St.X.demo) { St.signaler("Démonstration : pas de PDF", true); return; }
    var w = window.open("", "_blank");
    St.X.db.storage.from("livrables").createSignedUrl(chemin, 600).then(function (r) {
      if (r.error || !r.data) { if (w) w.close(); St.signaler("PDF introuvable", true); return; }
      if (w) w.location = r.data.signedUrl; else location.href = r.data.signedUrl;
    });
  }
  function emettre(f) {
    confirmer("Émettre la facture ?", "Elle reçoit le numéro suivant et ne se modifie plus ensuite. Rien n'est envoyé au client : vous l'envoyez vous-même.", "Émettre", function () {
      var auj = new Date(), ech = new Date(auj); ech.setDate(ech.getDate() + 30);
      St.maj("factures", f.id, { statut: "emise", date_facture: St.iso(auj), echeance: f.echeance || St.iso(ech) }).then(function (x) { St.signaler("Facture n° " + ((x && x.numero) || "") + " émise"); St.dessiner(false); });
    });
  }
  // Fiche d'une facture ou d'un devis : client, objet, lignes (quantité, prix HT, TVA par ligne : 20 % par défaut)
  function editerPiece(table, base) {
    var fact = table === "factures", f = Object.assign({}, base), e = f.espace_id && St.espace(f.espace_id), pr = e ? St.prive(e.id) : {};
    var lignes = (f.lignes && f.lignes.length ? f.lignes : [{ libelle: fact ? "Gestion des réseaux sociaux" + (e ? " · " + e.nom : "") : "Accompagnement réseaux sociaux (mensuel)", quantite: 1, prix_ht: pr.forfait_mensuel_ht || 0, tva: 20 }]).map(function (l) { return Object.assign({}, l); });
    var client = choix([["", f.prospect_id ? "Prospect : " + ((S.prospects.filter(function (p) { return p.id === f.prospect_id; })[0] || {}).nom || "") : "Choisir un client"]].concat(S.espaces.map(function (x) { return [x.id, x.nom]; })), f.espace_id || "", { nom: "Client" });
    var objet = texte(f.objet, { aide: fact ? "Community management" : "Proposition d'accompagnement" });
    var mois = St.fmt(new Date(), { month: "long", year: "numeric" });
    var periode = texte(f.periode || (fact ? mois.charAt(0).toUpperCase() + mois.slice(1) : ""), { aide: "Novembre 2026" });
    var valable = el("input", { type: "date", value: f.valable_jusque || St.iso(St.ajouterJours(new Date(), 30)), "aria-label": "Valable jusqu'au" });
    var zone = el("div", { class: "lignes-piece" }), tot = el("div", { class: "totaux-piece" });
    var majTotaux = function () { var t = totaux(lignes); tot.textContent = ""; [["Total HT", t.total_ht], ["TVA", t.total_tva], ["Total TTC", t.total_ttc]].forEach(function (x) { tot.appendChild(el("span", { text: x[0] })); tot.appendChild(el("b", { class: "mono", text: euros(x[1]) })); }); };
    var rendre = function () {
      zone.textContent = "";
      zone.appendChild(el("div", { class: "ligne-piece tete" }, [el("small", { text: "Désignation" }), el("small", { text: "Qté" }), el("small", { text: "Prix HT" }), el("small", { text: "TVA" }), el("span")]));
      lignes.forEach(function (l, i) {
        zone.appendChild(el("div", { class: "ligne-piece" }, [
          el("input", { type: "text", value: l.libelle || "", "aria-label": "Désignation", oninput: function (ev) { l.libelle = ev.target.value; } }),
          el("input", { type: "number", step: "0.25", min: 0, value: l.quantite, "aria-label": "Quantité", oninput: function (ev) { l.quantite = +ev.target.value; majTotaux(); } }),
          el("input", { type: "number", step: "0.01", min: 0, value: l.prix_ht, "aria-label": "Prix HT", oninput: function (ev) { l.prix_ht = +ev.target.value; majTotaux(); } }),
          choix([[20, "20 %"], [10, "10 %"], [5.5, "5,5 %"], [0, "0 %"]], l.tva, { nom: "TVA", attrs: { onchange: function (ev) { l.tva = +ev.target.value; majTotaux(); } } }),
          el("button", { type: "button", class: "btn-icone", "aria-label": "Retirer la ligne", onclick: function () { lignes.splice(i, 1); rendre(); } }, [St.icone("fermer")])
        ]));
      });
      zone.appendChild(el("button", { type: "button", class: "btn-texte", onclick: function () { lignes.push({ libelle: "", quantite: 1, prix_ht: 0, tva: 20 }); rendre(); } }, [St.icone("plus"), "Ajouter une ligne"]));
      majTotaux();
    };
    rendre();
    St.fenetre({ titre: f.id ? (fact ? "Modifier la facture" : "Modifier le devis") : (fact ? "Nouvelle facture" : "Nouveau devis"), classe: "large",
      sous: fact ? "Enregistrée en brouillon : le numéro est attribué à l'émission." : "Le numéro (D" + new Date().getFullYear() + "-…) est attribué quand il est envoyé.",
      corps: [el("div", { class: "deux-colonnes" }, [champ("Client", client), champ("Objet", objet)]), fact ? champ("Période", periode) : champ("Valable jusqu'au", valable), zone, tot],
      actions: [f.id ? { texte: "Supprimer le brouillon", danger: true, action: function (fermer) { fermer(); confirmer("Supprimer ce brouillon ?", "Il n'a pas de numéro : rien ne se perd dans la suite des factures.", "Supprimer", function () { St.supprimer(table, { id: f.id }).then(function () { St.dessiner(false); }); }); } } : null,
        { texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
          var champs = Object.assign({ espace_id: client.value || null, objet: objet.value.trim() || (fact ? "Community management" : "Proposition"), lignes: lignes.filter(function (l) { return l.libelle || l.prix_ht; }) }, totaux(lignes));
          if (fact) champs.periode = periode.value.trim() || null; else champs.valable_jusque = valable.value || null;
          if (!champs.espace_id && !f.prospect_id) { client.focus(); return; }
          (f.id ? St.maj(table, f.id, champs) : St.creer(table, Object.assign({ statut: "brouillon", prospect_id: f.prospect_id || null }, champs))).then(function () { fermer(); St.signaler(fact ? "Facture enregistrée en brouillon" : "Devis enregistré"); St.dessiner(false); });
        } }].filter(Boolean) });
  }
  function imprimerPiece(table, f) {
    var fact = table === "factures", ent = entreprise(), e = f.espace_id && St.espace(f.espace_id), pr = e ? St.prive(e.id) : {}, pp = f.prospect_id && S.prospects.filter(function (p) { return p.id === f.prospect_id; })[0];
    var dest = e ? { nom: pr.raison_sociale || e.nom, adresse: pr.adresse, siret: pr.siret, email: pr.email_facturation } : pp ? { nom: pp.nom, adresse: "", email: pp.email } : {};
    var brouillon = f.statut === "brouillon", titre = (fact ? "Facture" : "Devis") + (f.numero ? " n° " + f.numero : brouillon ? " (brouillon)" : "");
    var d = fact ? f.date_facture : f.date_devis, ligne = function (t) { return t ? echapper(t).replace(/\n/g, "<br>") + "<br>" : ""; };
    if (!ent.nom) St.signaler("Pensez à remplir l'identité de l'entreprise dans Réglages", true);
    imprimer(titre + " · " + (dest.nom || ""),
      (brouillon ? '<div class="brouillon">BROUILLON</div>' : "") +
      '<div class="deux"><div><h1>' + echapper(ent.nom || MARQUE.proprietaire || "") + '</h1><div class="filet"></div><p class="petit">' + ligne(ent.activite) + ligne(ent.adresse) +
      (ent.siret ? "SIRET " + echapper(ent.siret) + "<br>" : "") + (ent.tva_intra ? "TVA intracommunautaire " + echapper(ent.tva_intra) + "<br>" : "") + ligne(ent.email) + ligne(ent.telephone) + '</p></div>' +
      '<div style="text-align:right"><h2 style="margin-top:6px">' + echapper(titre) + '</h2><p class="petit">' + (d ? "Date : " + St.fmt(d + "T12:00:00", { day: "numeric", month: "long", year: "numeric" }) + "<br>" : "") +
      (fact && f.echeance ? "Échéance : " + St.fmt(f.echeance + "T12:00:00", { day: "numeric", month: "long", year: "numeric" }) + "<br>" : "") +
      (!fact && f.valable_jusque ? "Valable jusqu'au " + St.fmt(f.valable_jusque + "T12:00:00", { day: "numeric", month: "long", year: "numeric" }) : "") + '</p>' +
      '<p style="margin-top:18px"><b>' + echapper(dest.nom || "") + '</b><br><span class="petit">' + ligne(dest.adresse) + (dest.siret ? "SIRET " + echapper(dest.siret) + "<br>" : "") + ligne(dest.email) + '</span></p></div></div>' +
      '<p><b>Objet :</b> ' + echapper(f.objet || "") + (f.periode ? " · " + echapper(f.periode) : "") + '</p>' +
      '<table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix HT</th><th class="n">TVA</th><th class="n">Total HT</th></tr></thead><tbody>' +
      (f.lignes || []).map(function (l) { return '<tr><td>' + echapper(l.libelle) + '</td><td class="n">' + String(l.quantite).replace(".", ",") + '</td><td class="n">' + euros(l.prix_ht) + '</td><td class="n">' + String(l.tva).replace(".", ",") + ' %</td><td class="n">' + euros((+l.quantite || 0) * (+l.prix_ht || 0)) + '</td></tr>'; }).join("") +
      '</tbody></table><table class="totaux"><tr><td>Total HT</td><td class="n">' + euros(f.total_ht) + '</td></tr><tr><td>TVA</td><td class="n">' + euros(f.total_tva) + '</td></tr><tr><td>Total TTC</td><td class="n">' + euros(f.total_ttc) + '</td></tr></table>' +
      '<p class="petit" style="margin-top:28px">' + ligne(ent.conditions || "Paiement à 30 jours par virement.") + (ent.iban_affiche ? "IBAN : " + echapper(ent.iban_affiche) + "<br>" : "") +
      (fact ? "Pénalités de retard : trois fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d'escompte pour paiement anticipé." : "Bon pour accord : date et signature du client.") + '</p>');
  }

  // ======================================================================
  // Notes internes : ce que Lili garde pour elle sur un client (jamais visible du client)
  // ======================================================================
  V.rub_notes = function (r, e) {
    var ns = S.notes.filter(function (n) { return n.espace_id === e.id; }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    var saisie = texte("", { lignes: 3, aide: "Une préférence, un point d'attention, une info du dernier rendez-vous" });
    return el("div", { class: "rubrique-etroite" }, [
      el("form", { class: "bloc formulaire", onsubmit: function (ev) { ev.preventDefault(); if (!saisie.value.trim()) return; St.creer("notes_internes", { espace_id: e.id, contenu: saisie.value.trim() }).then(function () { St.dessiner(false); }); } },
        [champ("Nouvelle note", saisie, "Jamais visible du client."), el("div", {}, [el("button", { type: "submit", class: "btn-plein", text: "Ajouter" })])]),
      ns.length ? el("ul", { class: "liste-notes" }, ns.map(function (n) {
        var p = n.publication_id && St.publication(n.publication_id);
        return el("li", { class: "bloc" }, [el("p", { text: n.contenu }), el("small", {}, [St.ilya(n.cree_le), p ? el("a", { href: "#p/" + p.id, text: " · " + (p.titre || "Publication") }) : null]),
          el("button", { type: "button", class: "btn-icone", "aria-label": "Supprimer la note", onclick: function () { confirmer("Supprimer cette note ?", "Elle sera définitivement effacée.", "Supprimer", function () { St.supprimer("notes_internes", { id: n.id }).then(function () { St.dessiner(false); }); }); } }, [St.icone("corbeille")])]);
      })) : St.vide("Aucune note sur " + e.nom + ".")
    ]);
  };

  // ======================================================================
  // Fiche d'un client : nom, couleur, logo, réseaux, état ; coordonnées de facturation et forfait (jamais visibles du client)
  // ======================================================================
  St.editerEspace = function (e) {
    var pr = St.prive(e.id), nom = texte(e.nom), couleur = el("input", { type: "color", value: e.couleur || "#1E1A17", "aria-label": "Couleur" });
    var statut = choix([["actif", "Actif"], ["pause", "En pause"], ["archive", "Archivé (masqué)"]], e.statut || "actif", { nom: "État" });
    var res = el("div", { class: "cases" }, Object.keys(St.RESEAUX).map(function (k) { return el("label", { class: "case" }, [el("input", { type: "checkbox", value: k, checked: (e.reseaux || []).indexOf(k) >= 0 }), St.RESEAUX[k].nom]); }));
    var logo = el("input", { type: "file", accept: "image/*", "aria-label": "Logo" });
    var p = { raison_sociale: texte(pr.raison_sociale), adresse: texte(pr.adresse, { lignes: 2 }), siret: texte(pr.siret), email_facturation: texte(pr.email_facturation, { type: "email" }),
      forfait_mensuel_ht: texte(pr.forfait_mensuel_ht, { type: "number", attrs: { min: 0, step: "10" } }), heures_forfait: texte(pr.heures_forfait, { type: "number", attrs: { min: 0, step: "0.5" } }) };
    St.fenetre({ titre: "Fiche de " + e.nom, classe: "large", sous: "La couleur et le logo habillent l'espace du client ; la facturation reste entre vous et le studio.", corps: [
      el("div", { class: "deux-colonnes" }, [champ("Nom", nom), champ("État", statut)]), el("div", { class: "deux-colonnes" }, [champ("Couleur de la marque", couleur), champ("Logo", logo, "PNG ou JPG carré")]),
      champ("Réseaux", res), el("h3", { class: "titre-fiche", text: "Facturation (interne)" }),
      el("div", { class: "deux-colonnes" }, [champ("Raison sociale", p.raison_sociale), champ("SIRET", p.siret)]), champ("Adresse", p.adresse),
      el("div", { class: "deux-colonnes" }, [champ("E-mail de facturation", p.email_facturation), champ("Forfait mensuel HT (€)", p.forfait_mensuel_ht)]), champ("Heures prévues par mois", p.heures_forfait)],
      actions: [{ texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
        if (!nom.value.trim()) { nom.focus(); return; }
        var champs = { nom: nom.value.trim(), couleur: couleur.value, statut: statut.value, reseaux: Array.from(res.querySelectorAll("input:checked")).map(function (x) { return x.value; }), modifie_le: maintenant() };
        var prive = { espace_id: e.id }; Object.keys(p).forEach(function (k) { var v = p[k].value.trim(); prive[k] = v === "" ? null : (/forfait|heures/.test(k) ? +v : v); });
        var f = logo.files && logo.files[0], envoiLogo = Promise.resolve();
        if (f) {
          var chemin = e.id + "/logo-" + St.uuid().slice(0, 8) + "." + ((f.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4));
          envoiLogo = St.X.demo ? Promise.resolve().then(function () { e.logo_url = URL.createObjectURL(f); })
            : St.X.db.storage.from("medias").upload(chemin, f, { contentType: f.type }).then(function (r) { if (r.error) throw r.error; champs.logo_path = chemin; });
        }
        envoiLogo.then(function () { return Promise.all([St.maj("espaces", e.id, champs), St.enregistrer("espaces_prive", prive)]); })
          .then(function () { return St.X.demo ? null : St.charger(); })
          .then(function () { fermer(); St.signaler("Fiche enregistrée"); St.dessiner(false); }, function (x) { St.signaler("Non enregistré : " + x.message, true); });
      } }] });
  };

  // Résumés des tuiles de la page client
  St.resumes = {
    brief: function (e) { var b = briefDe(e); return b ? (b.visibilite === "partage" ? "Partagé · " : "Interne · ") + liste(b.piliers).length + " piliers" : "À rédiger"; },
    messages: function (e) { var ms = S.messages.filter(function (m) { return m.espace_id === e.id; }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }); return ms[0] ? "Dernier " + St.ilya(ms[0].cree_le) : "Aucun message"; },
    rapports: function (e) { var m = S.rapports.filter(function (x) { return x.espace_id === e.id; }).map(function (x) { return x.mois; }).sort().pop(); return m ? "Dernier : " + NOMS_MOIS(m) : "Aucun chiffre"; },
    veille: function (e) { var n = S.veille.filter(function (x) { return x.espace_id === e.id; }).length; return n + " repérage" + (n > 1 ? "s" : ""); },
    partenariats: function (e) { var n = S.partenaires.filter(function (x) { return x.espace_id === e.id; }).length; return n + " partenaire" + (n > 1 ? "s" : ""); },
    facturation: function (e) { var debut = St.iso(new Date()).slice(0, 8) + "01", mn = S.temps.filter(function (t) { return t.espace_id === e.id && t.jour >= debut; }).reduce(function (s, t) { return s + t.minutes; }, 0), pr = St.prive(e.id); return duree(mn) + (pr.heures_forfait ? " sur " + pr.heures_forfait + " h ce mois" : " ce mois"); },
    notes: function (e) { var n = S.notes.filter(function (x) { return x.espace_id === e.id; }).length; return n + " note" + (n > 1 ? "s" : ""); },
    equipe: function (e) { var n = S.membres.filter(function (m) { return m.espace_id === e.id; }).length; return n ? n + " personne" + (n > 1 ? "s" : "") + " invitée" + (n > 1 ? "s" : "") : "Inviter le client"; }
  };

  // ======================================================================
  // Tâches : colonnes à glisser
  // ======================================================================
  var ETAPES_TACHE = [["a-faire", "À faire"], ["en-cours", "En cours"], ["en-revision", "En relecture"], ["fait", "Fait"]];
  V.taches = function (r) {
    var cl = (r.query && r.query.client) || "", il14 = St.iso(St.ajouterJours(new Date(), -14)), auj = St.iso(new Date());
    var ts = S.taches.filter(function (t) { return (!cl || t.espace_id === cl) && (t.statut !== "fait" || !t.fait_le || t.fait_le.slice(0, 10) >= il14); })
      .sort(function (a, b) { return String(a.echeance || "9").localeCompare(String(b.echeance || "9")); });
    var filtre = el("select", { class: "choix-client", "aria-label": "Client", onchange: function (ev) { St.aller("taches" + (ev.target.value ? "?client=" + ev.target.value : "")); } },
      [el("option", { value: "", text: "Tous les clients" })].concat(St.espacesActifs().map(function (e) { return el("option", { value: e.id, selected: e.id === cl, text: e.nom }); })));
    return el("div", { class: "vue-taches" }, [
      St.entete(null, "Tâches", ts.filter(function (t) { return t.statut !== "fait" && t.echeance && t.echeance < auj; }).length + " en retard. Glissez une carte pour changer son étape.",
        [filtre, el("button", { type: "button", class: "btn-plein", onclick: function () { editerTache({ espace_id: cl || null }); } }, [St.icone("plus"), "Nouvelle tâche"])]),
      colonnes(ETAPES_TACHE, ts, "statut", function (t) {
        var e = t.espace_id && St.espace(t.espace_id);
        return el("button", { type: "button", class: "carte-colonne p-" + t.priorite + (t.statut !== "fait" && t.echeance && t.echeance < auj ? " retard" : ""), onclick: function () { editerTache(t); } }, [
          el("b", { text: t.titre }),
          el("small", {}, [e ? el("i", { class: "pastille-client", style: { "--c": e.couleur } }) : null, e ? e.nom : "Général", t.echeance ? " · " + St.quand(t.echeance + "T12:00:00") : ""])]);
      }, function (id, statut) { St.maj("taches", id, { statut: statut, fait_le: statut === "fait" ? maintenant() : null }).then(function () { St.dessiner(false); }); })
    ]);
  };
  function editerTache(t) {
    t = t || {};
    var titre = texte(t.titre, { aide: "Ce qu'il faut faire" }), notes = texte(t.notes, { lignes: 3 }), ech = el("input", { type: "date", value: t.echeance || "", "aria-label": "Échéance" });
    var cl = choix([["", "Général (sans client)"]].concat(St.espacesActifs().map(function (e) { return [e.id, e.nom]; })), t.espace_id || "", { nom: "Client" });
    var prio = choix([["haute", "Haute"], ["moyenne", "Moyenne"], ["basse", "Basse"]], t.priorite || "moyenne", { nom: "Priorité" }), statut = choix(ETAPES_TACHE, t.statut || "a-faire", { nom: "Étape" });
    St.fenetre({ titre: t.id ? "Tâche" : "Nouvelle tâche", corps: [champ("Titre", titre), el("div", { class: "deux-colonnes" }, [champ("Client", cl), champ("Échéance", ech)]),
      el("div", { class: "deux-colonnes" }, [champ("Priorité", prio), champ("Étape", statut)]), champ("Notes", notes)],
      actions: [t.id ? { texte: "Supprimer", danger: true, action: function (fermer) { fermer(); confirmer("Supprimer « " + t.titre + " » ?", "La tâche sera définitivement effacée.", "Supprimer", function () { St.supprimer("taches", { id: t.id }).then(function () { St.dessiner(false); }); }); } } : null,
        { texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) {
          if (!titre.value.trim()) { titre.focus(); return; }
          var champs = { titre: titre.value.trim(), notes: notes.value.trim() || null, echeance: ech.value || null, espace_id: cl.value || null, priorite: prio.value, statut: statut.value,
            fait_le: statut.value === "fait" ? (t.fait_le || maintenant()) : null };
          (t.id ? St.maj("taches", t.id, champs) : St.creer("taches", champs)).then(function () { fermer(); St.dessiner(false); });
        } }].filter(Boolean) });
  }

  // ======================================================================
  // Prospects : du premier contact à la signature (qui crée l'espace du nouveau client)
  // ======================================================================
  var ETAPES_PROSPECT = [["contact", "Premier contact"], ["premier-echange", "Échange"], ["proposition", "Proposition"], ["signe", "Signé"], ["perdu", "Perdu"]];
  V.prospects = function () {
    var ps = S.prospects, enCours = ps.filter(function (p) { return ["contact", "premier-echange", "proposition"].indexOf(p.etape) >= 0; });
    var potentiel = enCours.reduce(function (s, p) { return s + (+p.montant_mensuel || 0); }, 0);
    return el("div", { class: "vue-prospects" }, [
      St.entete(null, "Prospects", enCours.length + " en cours" + (potentiel ? ", " + euros(potentiel) + " HT par mois en jeu" : "") + ".",
        [el("button", { type: "button", class: "btn-plein", onclick: function () { editerProspect(); } }, [St.icone("plus"), "Nouveau prospect"])]),
      colonnes(ETAPES_PROSPECT, ps, "etape", function (p) {
        var retard = p.prochaine_action_le && p.prochaine_action_le < St.iso(new Date());
        return el("button", { type: "button", class: "carte-colonne" + (retard ? " retard" : ""), onclick: function () { editerProspect(p); } }, [el("b", { text: p.nom }),
          el("small", { text: [p.contact, p.montant_mensuel ? euros(p.montant_mensuel) + " / mois" : null].filter(Boolean).join(" · ") }),
          p.prochaine_action ? el("span", { class: "extrait", text: p.prochaine_action + (p.prochaine_action_le ? " · " + St.quand(p.prochaine_action_le + "T12:00:00") : "") }) : null,
          p.espace_id && St.espace(p.espace_id) ? el("span", { class: "etiquette", text: "Espace créé" }) : null]);
      }, function (id, etape) { St.maj("prospects", id, { etape: etape }).then(function () { St.dessiner(false); }); })
    ]);
  };
  function editerProspect(p) {
    p = p || {};
    var nom = texte(p.nom, { aide: "Nom de la marque" }), contact = texte(p.contact, { aide: "Prénom Nom" }), email = texte(p.email, { type: "email" }), tel = texte(p.telephone, { attrs: { inputmode: "tel" } });
    var source = texte(p.source, { aide: "Bouche-à-oreille, Instagram…" }), montant = texte(p.montant_mensuel, { type: "number", attrs: { min: 0, step: "10" } });
    var etape = choix(ETAPES_PROSPECT, p.etape || "contact", { nom: "Étape" }), action = texte(p.prochaine_action, { aide: "Relancer, envoyer la proposition…" });
    var le = el("input", { type: "date", value: p.prochaine_action_le || "", "aria-label": "Pour le" }), notes = texte(p.notes, { lignes: 3 });
    var devis = p.id ? S.devis.filter(function (d) { return d.prospect_id === p.id; }) : [];
    var lire = function () { return { nom: nom.value.trim(), contact: contact.value.trim() || null, email: email.value.trim() || null, telephone: tel.value.trim() || null, source: source.value.trim() || null,
      montant_mensuel: montant.value ? +montant.value : null, etape: etape.value, prochaine_action: action.value.trim() || null, prochaine_action_le: le.value || null, notes: notes.value.trim() || null }; };
    var sauver = function () { if (!nom.value.trim()) { nom.focus(); return null; } return p.id ? St.maj("prospects", p.id, lire()) : St.creer("prospects", lire()); };
    St.fenetre({ titre: p.id ? p.nom : "Nouveau prospect", classe: "large", corps: [
      el("div", { class: "deux-colonnes" }, [champ("Marque", nom), champ("Étape", etape)]), el("div", { class: "deux-colonnes" }, [champ("Contact", contact), champ("E-mail", email)]),
      el("div", { class: "deux-colonnes" }, [champ("Téléphone", tel), champ("Source", source)]), el("div", { class: "deux-colonnes" }, [champ("Montant mensuel HT", montant), champ("Prochaine action le", le)]),
      champ("Prochaine action", action), champ("Notes", notes),
      devis.length ? el("p", { class: "aide", text: "Devis : " + devis.map(function (d) { return (d.numero || "brouillon") + " (" + euros(d.total_ttc) + ", " + (STATUTS_FACT[d.statut] || d.statut).toLowerCase() + ")"; }).join(", ") }) : null,
      el("div", { class: "actions-ligne" }, [
        el("button", { type: "button", class: "btn-texte", onclick: function () { var s = sauver(); if (s) s.then(function (x) { document.querySelector("dialog[open]").close(); editerPiece("devis", { prospect_id: x.id, espace_id: x.espace_id || null, objet: "Accompagnement réseaux sociaux", lignes: [{ libelle: "Gestion des réseaux sociaux (mensuel)", quantite: 1, prix_ht: x.montant_mensuel || 0, tva: 20 }] }); }); } }, [St.icone("euro"), "Préparer un devis"]),
        !p.espace_id ? el("button", { type: "button", class: "btn-texte", onclick: function () { var s = sauver(); if (s) s.then(function (x) { document.querySelector("dialog[open]").close(); creerEspace(x); }); } }, [St.icone("plus"), "Signé : créer son espace"]) : null
      ])],
      actions: [p.id ? { texte: "Supprimer", danger: true, action: function (fermer) { fermer(); confirmer("Supprimer " + p.nom + " ?", "Le prospect sera définitivement effacé.", "Supprimer", function () { St.supprimer("prospects", { id: p.id }).then(function () { St.dessiner(false); }); }); } } : null,
        { texte: "Annuler" }, { texte: "Enregistrer", principal: true, action: function (fermer) { var s = sauver(); if (s) s.then(function () { fermer(); St.dessiner(false); }); } }].filter(Boolean) });
  }
  function creerEspace(p) {
    var base = p.nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client", slug = base, i = 2;
    while (St.espaceSlug(slug) || ["calendrier", "publications", "mediatheque", "valider", "p", "mails", "taches", "prospects", "reglages", "brief", "rapports", "messages"].indexOf(slug) >= 0) slug = base + "-" + i++;
    confirmer("Créer l'espace de " + p.nom + " ?", "Un espace vide (adresse #" + slug + "), à compléter ensuite : couleur, logo, réseaux, puis l'invitation du client.", "Créer l'espace", function () {
      St.creer("espaces", { slug: slug, nom: p.nom, statut: "actif", couleur: "#1E1A17", reseaux: ["instagram"], heures_defaut: {}, ordre: S.espaces.length + 1 }).then(function (e) {
        return St.creer("espaces_prive", { espace_id: e.id, raison_sociale: p.nom, email_facturation: p.email, forfait_mensuel_ht: p.montant_mensuel })
          .then(function () { return St.maj("prospects", p.id, { espace_id: e.id, etape: "signe" }); })
          .then(function () { St.signaler("Espace créé"); St.aller(e.slug + "/equipe"); });
      });
    });
  }

  // ======================================================================
  // Réglages : l'identité de l'entreprise (en-tête des factures et devis)
  // ======================================================================
  V.reglages = function () {
    var ent = entreprise(), champs = [["nom", "Nom commercial", "Lili Rouzier"], ["activite", "Activité", "Community manager"], ["adresse", "Adresse", "", 2], ["siret", "SIRET", ""],
      ["tva_intra", "TVA intracommunautaire", "FR…"], ["email", "E-mail de facturation", ""], ["telephone", "Téléphone", ""], ["iban_affiche", "IBAN affiché sur les factures", "FR76 …"],
      ["conditions", "Conditions de paiement", "Paiement à 30 jours par virement.", 2]];
    var saisies = {};
    var form = el("form", { class: "bloc formulaire", onsubmit: function (ev) {
      ev.preventDefault(); var v = {}; Object.keys(saisies).forEach(function (k) { v[k] = saisies[k].value.trim(); });
      St.enregistrer("reglages", { cle: "entreprise", valeur: v, modifie_le: maintenant() }).then(function () { St.signaler("Réglages enregistrés"); });
    } }, champs.map(function (c) { saisies[c[0]] = texte(ent[c[0]], { lignes: c[3], aide: c[2] }); return champ(c[1], saisies[c[0]]); })
      .concat([el("div", {}, [el("button", { type: "submit", class: "btn-plein", text: "Enregistrer" })])]));
    return el("div", { class: "rubrique-etroite" }, [St.entete(null, "Réglages", "L'en-tête de vos factures et devis. TVA à 20 % par défaut sur chaque ligne."),
      el("h2", { class: "titre-section", text: "Votre entreprise" }), form,
      el("h2", { class: "titre-section", text: "Assistant" }),
      el("div", { class: "bloc" }, [el("p", { text: (MARQUE.assistant || "L'assistant") + " lit vos briefs, vos publications et vos rapports, et crée des brouillons (statut Idée, invisibles des clients). Il ne valide, ne programme et n'envoie jamais rien : c'est toujours vous qui cliquez." }),
        el("p", { class: "aide", text: "Ouvrez-le avec la touche / ou le bouton de la barre latérale. Le brief du jour est préparé chaque matin à 6 h." })])]);
  };

  // ======================================================================
  // L'assistant : une conversation (touche /), dictée possible au micro
  // ======================================================================
  var conversation = [];
  V.assistant = function () {
    var nomA = MARQUE.assistant || "l'assistant", r = S.route;
    var e = r.nom === "client" ? St.espaceSlug(r.param) : r.nom === "p" && St.publication(r.param) ? St.espace(St.publication(r.param).espace_id) : null;
    var fil = el("div", { class: "fil-assistant", role: "log", "aria-live": "polite" });
    var rendre = function () {
      fil.textContent = "";
      if (!conversation.length) fil.appendChild(el("div", { class: "suggestions" }, [el("p", { class: "aide", text: "Par exemple :" })].concat([
        e ? "Trois idées de posts pour " + e.nom + " la semaine prochaine" : "Trois idées de posts pour la semaine prochaine, client par client",
        e ? "Fais le bilan du mois dernier pour " + e.nom : "Qu'est-ce qui attend une validation depuis plus de trois jours ?",
        "Réécris cette légende en plus court : …"
      ].map(function (s) { return el("button", { type: "button", class: "puce", text: s, onclick: function () { saisie.value = s; saisie.focus(); } }); }))));
      conversation.forEach(function (m) {
        fil.appendChild(el("div", { class: "message" + (m.qui === "moi" ? " moi" : "") + (m.erreur ? " erreur" : "") }, [
          el("div", {}, [el("small", { text: m.qui === "moi" ? "Vous" : nomA }), el("p", { text: m.texte }),
            (m.brouillons || []).length ? el("ul", { class: "brouillons" }, m.brouillons.map(function (b) { return el("li", {}, [el("a", { href: "#p/" + b.id, onclick: function () { d.close(); } }, [St.icone("publications"), b.titre || "Brouillon"])]); })) : null])
        ]));
      });
      if (attente) fil.appendChild(el("div", { class: "message attente" }, [el("p", { text: nomA + " réfléchit…" })]));
      fil.scrollTop = fil.scrollHeight;
    };
    var attente = false;
    var saisie = el("textarea", { rows: 2, placeholder: "Demander à " + nomA + "…", "aria-label": "Votre demande" });
    var envoyer = function () {
      var t = saisie.value.trim(); if (!t || attente) return;
      saisie.value = ""; conversation.push({ qui: "moi", texte: t }); attente = true; rendre();
      var fin = function (m) { attente = false; conversation.push(m); rendre(); };
      if (St.X.demo) { setTimeout(function () { fin({ qui: "assistant", texte: "En démonstration, " + nomA + " ne répond pas : il travaille sur les vraies données du studio, avec sa clé. En ligne, il lit les briefs, les publications et les rapports, et crée des brouillons que vous relisez." }); }, 500); return; }
      St.appel("assistant", { texte: t, client: e ? e.slug : null, nom_assistant: MARQUE.assistant || null, historique: conversation.slice(0, -1).filter(function (m) { return !m.erreur; }).slice(-8).map(function (m) { return { qui: m.qui, texte: m.texte }; }) })
        .then(function (res) {
          fin({ qui: "assistant", texte: res.texte, brouillons: res.brouillons });
          if ((res.brouillons || []).length) St.charger().then(function () { St.dessiner(false); });
        }, function (x) { fin({ qui: "assistant", texte: x.message, erreur: true }); });
    };
    saisie.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); envoyer(); } });
    var Reco = window.SpeechRecognition || window.webkitSpeechRecognition, reco = null;
    var micro = Reco ? el("button", { type: "button", class: "btn-icone micro", "aria-label": "Dicter", title: "Dicter", onclick: function () {
      if (reco) { reco.stop(); return; }
      reco = new Reco(); reco.lang = "fr-FR"; reco.interimResults = true; var avant = saisie.value ? saisie.value + " " : "";
      reco.onresult = function (ev) { saisie.value = avant + Array.from(ev.results).map(function (x) { return x[0].transcript; }).join(""); };
      reco.onend = function () { reco = null; micro.classList.remove("actif"); saisie.focus(); };
      reco.onerror = function () { St.signaler("Le micro n'est pas disponible", true); };
      micro.classList.add("actif"); reco.start();
    } }, [St.icone("micro")]) : null;
    var d = St.fenetre({ titre: nomA.charAt(0).toUpperCase() + nomA.slice(1), sous: (e ? "Sur " + e.nom + ". " : "") + "Il crée des brouillons ; rien ne part sans vous.", classe: "large assistant",
      corps: [fil, el("div", { class: "saisie-message" }, [saisie, micro, el("button", { type: "button", class: "btn-plein", onclick: envoyer, text: "Envoyer" })])],
      actions: [conversation.length ? { texte: "Nouvelle conversation", action: function () { conversation = []; rendre(); } } : null, { texte: "Fermer" }].filter(Boolean) });
    d.addEventListener("close", function () { if (reco) reco.stop(); });
    rendre();
  };

  // ======================================================================
  // Le brief du jour (Aujourd'hui) : préparé à 6 h par la fonction serveur, ou à la demande
  // ======================================================================
  function briefLocal() {
    var pubs = St.publicationsVisibles(), auj = new Date();
    var duJour = pubs.filter(function (p) { return p.date_prevue && St.memeJour(p.date_prevue, auj); });
    var modifs = pubs.filter(function (p) { return p.statut === "modifs-demandees"; }), attente = pubs.filter(function (p) { return p.statut === "a-valider"; });
    var courts = St.espacesActifs().filter(function (e) { var a = St.avance(e.id); return a.jours != null && a.jours <= 2; });
    return [modifs.length ? "À reprendre d'abord : " + modifs.map(function (p) { return "« " + (p.titre || "Sans titre") + " » (" + (St.espace(p.espace_id) || {}).nom + ")"; }).join(", ") + "." : null,
      duJour.length ? duJour.length + " publication" + (duJour.length > 1 ? "s" : "") + " aujourd'hui, pour " + Array.from(new Set(duJour.map(function (p) { return (St.espace(p.espace_id) || {}).nom; }))).join(", ") + "." : "Aucune publication aujourd'hui.",
      attente.length ? attente.length + " publication" + (attente.length > 1 ? "s attendent" : " attend") + " une réponse des clients." : null,
      courts.length ? "Programmation courte chez " + courts.map(function (e) { return e.nom; }).join(", ") + " : à remplir cette semaine." : null].filter(Boolean).join("\n");
  }
  St.blocBriefDuJour = function () {
    var b = S.briefsJour.filter(function (x) { return x.jour === St.iso(new Date()); })[0], contenu = b ? b.contenu : St.X.demo ? briefLocal() : "";
    var bouton = el("button", { type: "button", class: "btn-texte bloc-lien", onclick: function () {
      if (St.X.demo) { St.signaler("Démonstration : le brief est calculé sur place"); return; }
      bouton.disabled = true; bouton.textContent = "Préparation…";
      St.appel("brief-du-jour", {}).then(function () { return St.charger(); }).then(function () { St.dessiner(false); }, function (x) { St.signaler(x.message, true); bouton.disabled = false; bouton.textContent = "Actualiser"; });
    } }, ["Actualiser"]);
    return el("section", { class: "bloc brief-du-jour" }, [
      el("header", {}, [el("h2", { text: "Brief du jour" }), bouton]),
      contenu ? el("div", { class: "brief-texte" }, contenu.split("\n").filter(Boolean).map(function (l) { return el("p", { text: l.replace(/^[-•]\s*/, "") }); }))
        : St.vide("Le brief de ce matin n'est pas encore prêt."),
      b ? el("small", { class: "aide", text: "Préparé " + St.ilya(b.cree_le) + (b.par_ia ? " par " + (MARQUE.assistant || "l'assistant") : "") }) : null
    ]);
  };
})(window.Studio);
