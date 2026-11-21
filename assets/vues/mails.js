/* Mails : la boîte Gmail de Lili dans le studio (fonction serveur « messagerie », session de Lili avec son code).
   Dossiers, recherche, lecture (HTML isolé, images distantes bloquées jusqu'au clic), répondre, transférer, écrire,
   archiver, corbeille (jamais d'effacement définitif). L'expéditeur est rapproché de son client quand on le connaît.
   Adresse : #mails  (?message=… au retour de Google) */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;
  var M = { dossier: "INBOX", q: "", mails: [], suite: null, ouvert: null, lecture: null, dossiers: [], charge: false, erreur: "", boites: null, images: false };

  // En démonstration : une boîte fictive, pour voir l'écran
  function demo() {
    var h = function (n) { return new Date(Date.now() - n * 3600000).toISOString(); };
    return [
      { id: "d1", de: "Inès Morel <ines@maison-ondine.exemple>", objet: "Photos de l'atelier couronnes", extrait: "Bonjour Lili, je vous envoie les photos de samedi, dites-moi si…", date: h(1), lu: false, pieces: true },
      { id: "d2", de: "Claire Dubois <claire@cafe-lumiere.exemple>", objet: "Carte de Noël : les prix", extrait: "Voici les prix définitifs pour la carte : chaï 4,50 €…", date: h(5), lu: true },
      { id: "d3", de: "Hugo Lemaire <hugo@atelier-sable.exemple>", objet: "Article LinkedIn", extrait: "Merci pour le premier jet, je relis ce soir et je reviens vers vous.", date: h(26), lu: true },
      { id: "d4", de: "Imprimerie Duval <contact@imprimerie.exemple>", objet: "Devis flyers A5", extrait: "Suite à votre demande, veuillez trouver notre devis en pièce jointe.", date: h(50), lu: true, pieces: true }
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
  // Client de l'expéditeur : une personne membre d'un espace, à la même adresse (ou au même domaine)
  function clientDe(de) {
    var a = adresse(de), p = S.personnes.filter(function (x) { return x.email && x.email.toLowerCase() === a; })[0];
    if (p) { var m = S.membres.filter(function (x) { return x.personne_id === p.id; })[0]; if (m) return St.espace(m.espace_id); }
    if (St.X.demo) { var dom = a.split("@")[1] || ""; return St.espacesActifs().filter(function (e) { return dom.indexOf(e.slug) === 0; })[0] || null; }
    return null;
  }
  function charger(plus) {
    if (St.X.demo) { M.mails = demo(); M.boites = [{ email: "lili@demo.exemple" }]; M.dossiers = [{ id: "INBOX", nom: "Boîte de réception", type: "reception", non_lus: 1 }, { id: "STARRED", nom: "Suivis" }, { id: "SENT", nom: "Envoyés" }, { id: "DRAFT", nom: "Brouillons" }, { id: "TRASH", nom: "Corbeille" }]; return Promise.resolve(); }
    M.charge = true; M.erreur = "";
    var p = M.boites ? Promise.resolve() : appel({ action: "etat" }).then(function (r) { M.boites = r.boites || []; });
    return p.then(function () {
      if (!M.boites.length) return;
      return Promise.all([
        M.dossiers.length ? null : appel({ action: "dossiers" }).then(function (r) { M.dossiers = r.dossiers || []; }),
        appel({ action: "lister", dossier: M.q ? "" : M.dossier, q: M.q, suite: plus ? M.suite : "" }).then(function (r) { M.mails = (plus ? M.mails : []).concat(r.mails || []); M.suite = r.suite; })
      ]);
    }).catch(function (e) { M.erreur = e.message; }).then(function () { M.charge = false; });
  }
  function redessiner() { var z = document.getElementById("vue-mails"); if (z) z.replaceWith(V.mails(S.route, true)); }

  V.mails = function (r, sansCharger) {
    var q = (r && r.query) || {};
    if (q.message) { St.signaler(q.message, /impossible|refusée|expiré/i.test(q.message)); history.replaceState(null, "", "#mails"); M.boites = null; M.dossiers = []; }
    var page = el("div", { class: "vue-mails", id: "vue-mails" });
    if (!sansCharger && !M.charge) { charger().then(redessiner); }
    page.appendChild(St.entete(null, "Mails", M.boites && M.boites[0] ? M.boites[0].email + (St.X.demo ? " (démonstration)" : "") : null,
      M.boites && M.boites.length ? [el("button", { type: "button", class: "btn-plein", onclick: function () { ecrire({}); } }, [St.icone("plus"), "Écrire"])] : null));
    if (M.boites && !M.boites.length) {
      page.appendChild(el("div", { class: "relier-boite" }, [St.icone("mail", "grande-ic"), el("h2", { text: "Reliez votre boîte Gmail" }),
        el("p", { text: "Vos mails arrivent ici, à côté de vos clients : lire, répondre, archiver, sans quitter le studio. Google vous demandera l'accès à Gmail ; rien n'est jamais effacé définitivement." }),
        el("button", { type: "button", class: "btn-plein", onclick: relier }, ["Relier ma boîte Gmail"])]));
      return page;
    }
    if (!M.boites) { page.appendChild(el("p", { class: "aside", text: "Ouverture de la boîte…" })); return page; }
    if (M.boites[0] && M.boites[0].erreur) page.appendChild(el("p", { class: "alerte-texte" }, ["La connexion à Gmail a un souci : " + M.boites[0].erreur + " ", el("button", { type: "button", class: "btn-texte", text: "Relier à nouveau", onclick: relier })]));
    var recherche = el("form", { class: "mails-recherche", role: "search", onsubmit: function (ev) { ev.preventDefault(); M.q = champ.value.trim(); M.ouvert = null; charger().then(redessiner); } },
      [el("input", { type: "search", placeholder: "Rechercher dans Gmail (de:, objet, mots…)", value: M.q, "aria-label": "Rechercher" })]);
    var champ = recherche.firstChild;
    var dossiers = el("nav", { class: "mails-dossiers", "aria-label": "Dossiers" }, M.dossiers.filter(function (d) { return d.type !== "indesirables"; }).map(function (d) {
      return el("button", { type: "button", "aria-current": !M.q && d.id === M.dossier ? "true" : null, onclick: function () { M.dossier = d.id; M.q = ""; M.ouvert = null; charger().then(redessiner); } },
        [el("span", { text: d.nom }), d.non_lus ? el("b", { text: String(d.non_lus) }) : null]);
    }));
    var liste = el("ul", { class: "mails-liste" }, M.mails.map(function (m) {
      var e = clientDe(m.de);
      return el("li", { class: (m.lu ? "" : "non-lu") + (M.ouvert === m.id ? " ouvert" : "") }, [el("button", { type: "button", onclick: function () { ouvrir(m); } }, [
        el("span", { class: "mails-de" }, [e ? el("i", { class: "pastille-client", style: { "--c": e.couleur }, title: e.nom }) : null, nom(m.de)]),
        el("span", { class: "mails-date", text: St.memeJour(m.date, new Date()) ? St.hm(m.date) : St.fmt(m.date, { day: "numeric", month: "short" }) }),
        el("b", { class: "mails-objet", text: m.objet || "(sans objet)" }), el("span", { class: "mails-extrait", text: m.extrait || "" })
      ])]);
    }));
    var colonneListe = el("div", { class: "mails-colonne" }, [recherche, M.charge && !M.mails.length ? el("p", { class: "aside", text: "Chargement…" }) : null,
      M.erreur ? el("p", { class: "alerte-texte", text: M.erreur }) : null,
      M.mails.length ? liste : (!M.charge ? St.vide(M.q ? "Aucun mail ne correspond." : "Aucun mail ici.") : null),
      M.suite ? el("button", { type: "button", class: "btn-texte", text: "Plus de mails", onclick: function () { charger(true).then(redessiner); } }) : null]);
    var lecteur = el("section", { class: "mails-lecteur", "aria-label": "Lecture" }, [M.lecture ? contenuLecture(M.lecture) : St.vide("Choisissez un mail à lire.")]);
    page.appendChild(el("div", { class: "mails-cadre" + (M.ouvert ? " lecture" : "") }, [dossiers, colonneListe, lecteur]));
    return page;
  };
  function relier() {
    if (St.X.demo) return St.signaler("En démonstration, aucune boîte n'est reliée.");
    St.X.db.functions.invoke("connexion-google", { body: {} }).then(function (r) {
      if (r.error || !r.data || !r.data.url) return St.signaler("Impossible d'ouvrir Google : " + ((r.data && r.data.erreur) || (r.error && r.error.message) || ""), true);
      location.href = r.data.url;
    });
  }
  function ouvrir(m) {
    M.ouvert = m.id; M.images = false; m.lu = true;
    if (St.X.demo) { M.lecture = { id: m.id, de: m.de, a: "Lili Rouzier <lili@demo.exemple>", objet: m.objet, date: m.date, texte: m.extrait + "\n\nBelle journée,\n" + nom(m.de).split(" ")[0], html: "", pieces: m.pieces ? [{ id: "1", nom: "document.pdf", taille: 182000 }] : [] }; redessiner(); return; }
    M.lecture = { chargement: true, objet: m.objet, de: m.de }; redessiner();
    appel({ action: "lire", id: m.id }).then(function (l) { M.lecture = l; redessiner(); }).catch(function (e) { M.lecture = null; St.signaler(e.message, true); redessiner(); });
  }
  function contenuLecture(l) {
    if (l.chargement) return el("p", { class: "aside", text: "Ouverture…" });
    var e = clientDe(l.de);
    var actions = el("div", { class: "mails-actions" }, [
      el("button", { type: "button", class: "btn-icone mobile-seul", "aria-label": "Revenir à la liste", onclick: function () { M.ouvert = null; M.lecture = null; redessiner(); } }, [St.icone("retour")]),
      el("button", { type: "button", class: "btn-texte", text: "Répondre", onclick: function () { ecrire({ mode: "repondre", origine: l }); } }),
      el("button", { type: "button", class: "btn-texte", text: "Répondre à tous", onclick: function () { ecrire({ mode: "repondre_tous", origine: l }); } }),
      el("button", { type: "button", class: "btn-texte", text: "Transférer", onclick: function () { ecrire({ mode: "transferer", origine: l }); } }),
      el("span", { class: "espace" }),
      el("button", { type: "button", class: "btn-texte", text: "Archiver", onclick: function () { ranger(l, "archiver"); } }),
      el("button", { type: "button", class: "btn-texte danger", onclick: function () { ranger(l, "corbeille"); } }, [St.icone("corbeille"), "Corbeille"])
    ]);
    var corps;
    if (l.html) {
      var html = l.html.replace(/cid:([^"'\s)]+)/g, function (x, cid) { return (l.images || {})[cid] || x; });
      var bloque = !M.images && /<img[^>]+src=["']?https?:/i.test(html);
      if (bloque) html = html.replace(/(<img[^>]+)src=(["']?)https?:/gi, "$1data-bloque=$2https:");
      var cadre = el("iframe", { class: "mails-html", sandbox: "allow-popups allow-popups-to-escape-sandbox", title: "Contenu du mail", referrerpolicy: "no-referrer" });
      cadre.srcdoc = '<base target="_blank"><meta name="referrer" content="no-referrer"><style>body{font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#1E1A17;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}</style>' + html;
      cadre.addEventListener("load", function () { try { cadre.style.height = Math.min(4000, cadre.contentDocument.documentElement.scrollHeight + 20) + "px"; } catch (x) { cadre.style.height = "70vh"; } });
      corps = el("div", {}, [bloque ? el("p", { class: "aside" }, ["Images distantes bloquées. ", el("button", { type: "button", class: "btn-texte", text: "Les afficher", onclick: function () { M.images = true; redessiner(); } })]) : null, cadre]);
    } else corps = el("div", { class: "mails-texte", text: l.texte || "" });
    return el("article", { class: "mail-lu" }, [actions,
      el("h2", { class: "mail-objet", text: l.objet || "(sans objet)" }),
      el("p", { class: "mail-entete" }, [el("b", { text: nom(l.de) }), " <" + adresse(l.de) + ">", e ? el("a", { class: "puce-client", href: "#" + e.slug, style: { "--c": e.couleur } }, [el("i", { class: "pastille-client" }), e.nom]) : null,
        el("br"), el("small", { text: "À " + (l.a || "") + (l.cc ? " · Cc " + l.cc : "") + " · " + St.fmt(l.date, { weekday: "long", day: "numeric", month: "long" }) + " " + St.hm(l.date) })]),
      corps,
      (l.pieces || []).length ? el("div", { class: "mail-pieces" }, l.pieces.map(function (p) {
        return el("button", { type: "button", class: "puce", onclick: function () { telecharger(l, p); } }, [St.icone("deposer"), p.nom + " · " + Math.max(1, Math.round((p.taille || 0) / 1024)) + " Ko"]);
      })) : null
    ]);
  }
  function telecharger(l, p) {
    if (St.X.demo) return St.signaler("Pièce jointe de démonstration.");
    appel({ action: "piece", id: l.id, piece: p.id }).then(function (x) {
      var a = el("a", { href: "data:" + (x.type || "application/octet-stream") + ";base64," + x.contenu, download: x.nom }); document.body.appendChild(a); a.click(); a.remove();
    }).catch(function (e) { St.signaler(e.message, true); });
  }
  function ranger(l, quoi) {
    M.mails = M.mails.filter(function (m) { return m.id !== l.id; }); M.ouvert = null; M.lecture = null; redessiner();
    St.signaler(quoi === "corbeille" ? "Mis à la corbeille (récupérable dans Gmail)" : "Archivé");
    appel({ action: "ranger", id: l.id, quoi: quoi }).catch(function (e) { St.signaler(e.message, true); charger().then(redessiner); });
  }
  // Écrire, répondre, transférer : envoi seulement sur le clic de Lili ; brouillon possible
  function ecrire(o) {
    var l = o.origine, mode = o.mode || "nouveau";
    var re = function (s) { return /^(re|tr|fwd)\s*:/i.test(s || "") ? s : (mode === "transferer" ? "Tr : " : "Re : ") + (s || ""); };
    var a = el("input", { type: "text", placeholder: "À", value: mode === "repondre" || mode === "repondre_tous" ? adresse(l.de) : (o.a || ""), "aria-label": "Destinataires", list: "adresses-clients" });
    var cc = el("input", { type: "text", placeholder: "Cc", value: mode === "repondre_tous" ? [l.a, l.cc].filter(Boolean).join(", ").split(",").map(function (x) { return adresse(x); }).filter(function (x) { return x && M.boites[0] && x !== M.boites[0].email; }).join(", ") : "", "aria-label": "Copie" });
    var objet = el("input", { type: "text", placeholder: "Objet", value: l ? re(l.objet) : (o.objet || ""), "aria-label": "Objet" });
    var texte = el("textarea", { rows: 10, placeholder: mode === "transferer" ? "Un mot avant le message transféré…" : "Votre message", "aria-label": "Message" });
    var fichiers = el("input", { type: "file", multiple: true, "aria-label": "Pièces jointes" });
    var liste = el("datalist", { id: "adresses-clients" }, S.personnes.filter(function (p) { return p.email && p.role !== "proprietaire"; }).map(function (p) { return el("option", { value: p.email, text: p.nom }); }));
    function lirePieces() {
      return Promise.all(Array.prototype.slice.call(fichiers.files || []).map(function (f) {
        return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok({ nom: f.name, type: f.type, contenu: String(r.result).split(",")[1] }); }; r.readAsDataURL(f); });
      }));
    }
    function partir(envoyer, fermer) {
      if (envoyer && !a.value.trim()) { a.focus(); return; }
      if (St.X.demo) { fermer(); St.signaler(envoyer ? "En démonstration, rien n'est envoyé." : "Brouillon (démonstration)"); return; }
      lirePieces().then(function (pieces) {
        return appel({ action: envoyer ? "envoyer" : "brouillon", mode: mode, origine: l ? l.id : null, a: a.value, cc: cc.value, objet: objet.value, texte: texte.value, pieces: pieces });
      }).then(function () { fermer(); St.signaler(envoyer ? "Message envoyé" : "Brouillon enregistré dans Gmail"); })
        .catch(function (e) { St.signaler(e.message, true); });
    }
    St.fenetre({ titre: mode === "nouveau" ? "Nouveau message" : mode === "transferer" ? "Transférer" : "Répondre", classe: "large ecrire-mail",
      corps: [liste, a, cc, objet, texte, el("label", { class: "aside" }, ["Pièces jointes : ", fichiers])],
      actions: [{ texte: "Annuler" }, { texte: "Brouillon", action: function (f) { partir(false, f); } }, { texte: "Envoyer", principal: true, action: function (f) { partir(true, f); } }] });
  }
})(window.Studio);
