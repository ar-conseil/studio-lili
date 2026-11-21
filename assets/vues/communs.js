/* Éléments partagés par les pages : carte de publication, aperçus fidèles des réseaux (dessinés en HTML/CSS, sans
   capture ni logo de marque), en-tête de page, bulles de commentaires épinglés. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S;

  // ---------- Carte de publication (le visuel en héros) ----------
  St.cartePublication = function (p, o) {
    o = o || {};
    var e = St.espace(p.espace_id) || {}, ms = St.mediasDe(p.id), c = St.commentairesDe(p.id).filter(function (x) { return !x.resolu && x.visibilite === "partage"; }).length;
    var a = el("a", { class: "carte-pub" + (o.compacte ? " compacte" : ""), href: "#p/" + p.id, style: { "--c": e.couleur }, "data-id": p.id }, [
      el("div", { class: "carte-pub-visuel" }, [
        ms[0] ? St.image(ms[0], { classe: "carte-pub-img" }) : el("div", { class: "carte-pub-sans" }, [el("span", { text: St.FORMATS[p.format] || "" })]),
        ms.length > 1 ? el("span", { class: "carte-pub-nb", text: "1/" + ms.length }) : null,
        St.pastilleStatut(p.statut)
      ]),
      el("div", { class: "carte-pub-texte" }, [
        o.sansClient ? null : el("p", { class: "client-nom", style: { "--c": e.couleur }, text: e.nom || "" }),
        el("b", { text: p.titre || "Sans titre" }),
        el("small", {}, [St.pastillesReseaux(p.reseaux), " " + (St.FORMATS[p.format] || "") + (p.date_prevue ? " · " + St.quand(p.date_prevue) + " " + St.hm(p.date_prevue) : " · sans date"),
          c ? el("span", { class: "carte-pub-com" }, [St.icone("commentaire"), String(c)]) : null])
      ])
    ]);
    return a;
  };

  // ---------- Ligne de publication (listes d'Aujourd'hui) ----------
  St.lignePublication = function (p, droite) {
    var e = St.espace(p.espace_id) || {}, m = St.mediasDe(p.id)[0];
    return el("a", { class: "ligne-pub", href: "#p/" + p.id, style: { "--c": e.couleur } }, [
      el("span", { class: "ligne-pub-visuel" }, [m ? St.image(m, {}) : el("span", { class: "ligne-pub-sans", text: (St.FORMATS[p.format] || "").slice(0, 1) })]),
      el("span", { class: "ligne-pub-texte" }, [
        el("span", { class: "client-nom", text: e.nom || "" }),
        el("b", { text: p.titre || "Sans titre" }),
        el("small", {}, [St.pastillesReseaux(p.reseaux), " " + (St.FORMATS[p.format] || "") + (p.date_prevue ? " · " + St.hm(p.date_prevue) : "")])
      ]),
      droite || St.pastilleStatut(p.statut)
    ]);
  };

  // ---------- En-tête de page ----------
  St.entete = function (surtitre, titre, phrase, actions) {
    return el("header", { class: "entete" }, [
      el("div", {}, [surtitre ? el("p", { class: "surtitre", text: surtitre }) : null, el("h1", { class: "titre-page", text: titre }), phrase ? el("p", { class: "phrase", text: phrase }) : null]),
      actions ? el("div", { class: "entete-actions" }, actions) : null
    ]);
  };
  St.bloc = function (titre, compte, corps, o) {
    o = o || {};
    return el("section", { class: "bloc" + (o.classe ? " " + o.classe : "") }, [
      el("header", {}, [el("h2", { text: titre }), compte != null ? el("span", { class: "compte", text: String(compte) }) : null, o.lien ? el("a", { class: "bloc-lien", href: o.lien[0], text: o.lien[1] }) : null]),
      corps
    ]);
  };
  St.vide = function (texte, action) { return el("div", { class: "etat-vide" }, [el("p", { text: texte }), action || null]); };

  // ======================================================================
  // Aperçus fidèles : la publication telle qu'elle apparaîtra, au nom et avec la photo du compte du client
  // ======================================================================
  var SVG = {
    coeur: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    bulle: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z"/>',
    avion: '<path d="M21 4 10 14M21 4l-6.5 16-3.5-6-6-3.5z"/>',
    signet: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
    pouce: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2 3l-1 3h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>',
    partage: '<path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v3"/>',
    musique: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'
  };
  function ic(n, cls) { var s = el("span", { class: "ap-ic " + (cls || ""), "aria-hidden": "true" }); s.innerHTML = '<svg viewBox="0 0 24 24">' + SVG[n] + "</svg>"; return s; }
  function compteDe(p, reseau) {
    var cs = St.comptesDe(p.espace_id), e = St.espace(p.espace_id) || {};
    var c = cs.filter(function (x) { return x.id === p.compte_id && x.reseau === reseau; })[0] || cs.filter(function (x) { return x.reseau === reseau; })[0];
    return { nom: (c && c.nom_affiche) || e.nom || "", identifiant: (c && c.identifiant) || "", avatar: c && c.avatar_path && S.urls[c.avatar_path], espace: e };
  }
  function avatar(compte, classe) {
    return el("span", { class: "ap-avatar " + (classe || ""), style: { "--c": compte.espace.couleur || "#1E1A17" } }, [compte.avatar ? el("img", { src: compte.avatar, alt: "" }) : el("b", { text: St.initiales(compte.espace.nom || compte.nom) })]);
  }
  function texteLegende(p, max) {
    var t = (p.legende || "").trim(), h = (p.hashtags || []).map(function (x) { return "#" + x; }).join(" ");
    var plein = t + (h ? (t ? "\n\n" : "") + h : "");
    if (!max || plein.length <= max) return { texte: plein, coupe: false };
    return { texte: plein.slice(0, max).replace(/\s+\S*$/, ""), coupe: true };
  }
  function legendeAvecTags(texte) {
    var f = document.createDocumentFragment();
    String(texte).split(/(#[\p{L}\p{N}_]+|@[\w.]+)/u).forEach(function (m) { f.appendChild(/^[#@]/.test(m) ? el("span", { class: "ap-tag", text: m }) : document.createTextNode(m)); });
    return f;
  }
  // Visuel ou carrousel, avec les bulles épinglées (o.bulles = [commentaires], o.surClic(x, y, mediaId))
  function zoneVisuel(p, ratio, o) {
    o = o || {};
    var ms = St.mediasDe(p.id), i = Math.min(o.index || 0, Math.max(0, ms.length - 1)), m = ms[i];
    var z = el("div", { class: "ap-visuel", style: { "aspect-ratio": ratio } }, [
      m ? St.image(m, { apercu: false, vite: true }) : el("div", { class: "ap-sans-visuel" }, [el("span", { text: "Visuel à venir" })])
    ]);
    if (ms.length > 1) {
      z.appendChild(el("span", { class: "ap-compteur", text: (i + 1) + "/" + ms.length }));
      if (i > 0) z.appendChild(el("button", { type: "button", class: "ap-nav precedent", "aria-label": "Image précédente", onclick: function (ev) { ev.stopPropagation(); o.changer && o.changer(i - 1); } }, [St.icone("retour")]));
      if (i < ms.length - 1) z.appendChild(el("button", { type: "button", class: "ap-nav suivant", "aria-label": "Image suivante", onclick: function (ev) { ev.stopPropagation(); o.changer && o.changer(i + 1); } }, [St.icone("fleche")]));
    }
    (o.bulles || []).filter(function (c) { return c.cible === "visuel" && (!c.media_id || !m || c.media_id === m.id) && c.x != null; }).forEach(function (c) {
      z.appendChild(el("button", { type: "button", class: "bulle-epinglee" + (c.resolu ? " resolue" : "") + (o.active === c.id ? " active" : ""), style: { left: (c.x * 100) + "%", top: (c.y * 100) + "%" },
        title: c.contenu, "aria-label": "Commentaire " + c.numero, onclick: function (ev) { ev.stopPropagation(); o.choisirBulle && o.choisirBulle(c); } }, [String(c.numero || "•")]));
    });
    if (o.surClic && m) {
      z.classList.add("commentable");
      z.addEventListener("click", function (ev) {
        if (ev.target.closest("button")) return;
        var r = z.getBoundingClientRect();
        o.surClic(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)), m.id, z);
      });
    }
    if (ms.length > 1) z.appendChild(el("span", { class: "ap-points" }, ms.map(function (x, k) { return el("i", { class: k === i ? "on" : "" }); })));
    return z;
  }
  St.zoneVisuel = zoneVisuel;

  var APERCUS = {
    instagram: function (p, o) {
      var c = compteDe(p, "instagram"), vertical = p.format === "story" || p.format === "reel";
      if (vertical) return apercuVertical(p, o, c, "instagram");
      var l = texteLegende(p, o.plein ? 0 : 125);
      return el("article", { class: "ap ap-instagram" }, [
        el("header", {}, [avatar(c, "anneau"), el("span", { class: "ap-noms" }, [el("b", { text: c.identifiant || c.nom }), el("small", { text: p.lieu || "" })]), el("span", { class: "ap-plus", text: "···" })]),
        zoneVisuel(p, "4 / 5", o),
        el("div", { class: "ap-actions" }, [ic("coeur"), ic("bulle"), ic("avion"), el("span", { class: "ap-espace" }), ic("signet")]),
        el("p", { class: "ap-legende" }, [el("b", { text: (c.identifiant || c.nom) + " " }), legendeAvecTags(l.texte), l.coupe ? el("span", { class: "ap-plus-texte", text: "… plus" }) : null]),
        el("p", { class: "ap-date", text: p.date_prevue ? St.fmt(p.date_prevue, { day: "numeric", month: "long" }) : "" })
      ]);
    },
    facebook: function (p, o) {
      var c = compteDe(p, "facebook"), l = texteLegende(p, o.plein ? 0 : 280);
      return el("article", { class: "ap ap-facebook" }, [
        el("header", {}, [avatar(c), el("span", { class: "ap-noms" }, [el("b", { text: c.nom }), el("small", { text: (p.date_prevue ? St.fmt(p.date_prevue, { day: "numeric", month: "long" }) + " à " + St.hm(p.date_prevue) : "Brouillon") + " · Public" })]), el("span", { class: "ap-plus", text: "···" })]),
        el("p", { class: "ap-legende" }, [legendeAvecTags(l.texte), l.coupe ? el("span", { class: "ap-plus-texte", text: "… Voir plus" }) : null]),
        zoneVisuel(p, "1 / 1", o),
        el("div", { class: "ap-barre" }, [el("span", {}, [ic("pouce"), "J'aime"]), el("span", {}, [ic("bulle"), "Commenter"]), el("span", {}, [ic("partage"), "Partager"])])
      ]);
    },
    linkedin: function (p, o) {
      var c = compteDe(p, "linkedin"), l = texteLegende(p, o.plein ? 0 : 210);
      return el("article", { class: "ap ap-linkedin" }, [
        el("header", {}, [avatar(c, "carre"), el("span", { class: "ap-noms" }, [el("b", { text: c.nom }), el("small", { text: (St.espace(p.espace_id) || {}).metier || "Entreprise" }), el("small", { text: p.date_prevue ? St.quand(p.date_prevue) + " · Public" : "Brouillon" })])]),
        el("p", { class: "ap-legende" }, [legendeAvecTags(l.texte), l.coupe ? el("span", { class: "ap-plus-texte", text: "… voir plus" }) : null]),
        zoneVisuel(p, p.format === "article" ? "1.91 / 1" : "1 / 1", o),
        el("div", { class: "ap-barre" }, [el("span", {}, [ic("pouce"), "J'aime"]), el("span", {}, [ic("bulle"), "Commenter"]), el("span", {}, [ic("partage"), "Republier"]), el("span", {}, [ic("avion"), "Envoyer"])])
      ]);
    },
    tiktok: function (p, o) { return apercuVertical(p, o, compteDe(p, "tiktok"), "tiktok"); },
    pinterest: function (p, o) {
      var c = compteDe(p, "pinterest");
      return el("article", { class: "ap ap-pinterest" }, [zoneVisuel(p, "2 / 3", o), el("b", { class: "ap-titre", text: p.titre || "" }), el("span", { class: "ap-noms" }, [avatar(c), el("small", { text: c.nom })])]);
    },
    google: function (p, o) {
      var c = compteDe(p, "google");
      return el("article", { class: "ap ap-google" }, [el("header", {}, [avatar(c), el("span", { class: "ap-noms" }, [el("b", { text: c.nom }), el("small", { text: p.date_prevue ? St.quand(p.date_prevue) : "" })])]),
        zoneVisuel(p, "4 / 3", o), el("p", { class: "ap-legende", text: texteLegende(p, 300).texte }), p.lien ? el("span", { class: "ap-bouton-lien", text: "En savoir plus" }) : null]);
    }
  };
  function apercuVertical(p, o, c, reseau) {
    var l = texteLegende(p, 90);
    return el("article", { class: "ap ap-vertical ap-" + reseau + (p.format === "story" ? " story" : "") }, [
      zoneVisuel(p, "9 / 16", o),
      el("div", { class: "ap-calque" }, [
        p.format === "story" ? el("div", { class: "ap-story-haut" }, [el("span", { class: "ap-progression" }, St.mediasDe(p.id).map(function () { return el("i"); }).concat(St.mediasDe(p.id).length ? [] : [el("i")])),
          el("span", { class: "ap-noms" }, [avatar(c), el("b", { text: c.identifiant || c.nom }), el("small", { text: "2 h" })])]) : null,
        p.format !== "story" ? el("div", { class: "ap-cote-droit" }, [ic("coeur"), ic("bulle"), ic("avion"), reseau === "tiktok" ? ic("signet") : null]) : null,
        p.format !== "story" ? el("div", { class: "ap-bas" }, [el("span", { class: "ap-noms" }, [avatar(c), el("b", { text: "@" + (c.identifiant || c.nom) })]),
          el("p", { class: "ap-legende" }, [legendeAvecTags(l.texte), l.coupe ? el("span", { class: "ap-plus-texte", text: "… plus" }) : null]),
          el("span", { class: "ap-son" }, [ic("musique"), "Son original · " + (c.identifiant || c.nom)])]) : null
      ])
    ]);
  }
  // Aperçu d'une publication pour un réseau (le premier par défaut)
  St.apercu = function (p, reseau, o) {
    var r = reseau || (p.reseaux || [])[0] || "instagram";
    return (APERCUS[r] || APERCUS.instagram)(p, o || {});
  };
})(window.Studio);
