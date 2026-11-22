/* Publication directe sur Instagram et Facebook (22/11/2026), Lili seule.
   - Réglages › Réseaux sociaux : relier son compte Facebook (une fois), associer chaque Page et compte Instagram à
     un client ; étapes pour déclarer l'application Meta tant que ce n'est pas fait.
   - Fiche d'une publication : bloc « Publication en ligne » : publier maintenant, ou programmer à la date prévue ;
     état par réseau (programmée, en ligne avec le lien, erreur et « Réessayer »). Rien ne part sans ce clic.
   Les visuels sont préparés dans le navigateur pour Instagram (JPEG, format entre 4:5 et 1,91:1, 1440 px au plus),
   déposés dans le stockage privé (<espace>/diffusion/…) ; le serveur donne à Meta une adresse signée d'une heure. */
(function (St) {
  "use strict";
  var el = St.el, S = St.S;
  var RESEAUX = [["instagram", "Instagram"], ["facebook", "Facebook"]];

  function liaison() { return (S.metaLiaison || [])[0] || null; }
  function compteDe(espaceId, reseau) { return (S.metaComptes || []).filter(function (c) { return c.espace_id === espaceId && c.reseau === reseau; })[0] || null; }
  function diffusionsDe(pubId) { return (S.diffusions || []).filter(function (d) { return d.publication_id === pubId; }); }
  function recharger() { return St.charger(["meta_liaison", "meta_comptes", "diffusions", "publications"]).then(function () { St.dessiner(false); }); }

  // ======================================================================
  // Réglages › Réseaux sociaux
  // ======================================================================
  St.ongletReseaux = function (q) {
    q = q || {};
    if (q.meta) { St.signaler(q.meta === "ok" ? "Facebook et Instagram reliés : associez chaque compte à son client" : "Liaison impossible : " + q.meta, q.meta !== "ok"); history.replaceState(null, "", "#reglages?onglet=reseaux"); }
    var li = liaison(), comptes = (S.metaComptes || []).slice().sort(function (a, b) { return (a.reseau + (a.nom || "")).localeCompare(b.reseau + (b.nom || "")); });
    var icones = { "Instagram et Facebook": "publications", "Comptes et clients": "personnes" };
    var carte = function (titre, phrase, corps) {
      return el("section", { class: "bloc carte-reglage" }, [el("header", { class: "carte-reglage-tete" }, [el("span", { class: "pastille-ic" }, [St.icone(icones[titre] || "etincelle")]),
        el("div", {}, [el("h2", { text: titre }), phrase ? el("p", { class: "phrase", text: phrase }) : null])]), el("div", { class: "carte-reglage-corps" }, corps || [])]);
    };
    var relier = function () {
      if (St.X.demo) return St.signaler("Démonstration : la liaison se fait sur le vrai studio", true);
      St.appel("meta", { action: "connecter" }).then(function (r) { location.href = r.url; }, function (e) { St.signaler(e.message, true); });
    };
    var actualiser = function () {
      if (St.X.demo) return St.signaler("Démonstration : rien à actualiser");
      St.appel("meta", { action: "actualiser" }).then(function (r) { St.signaler(r.comptes + " comptes trouvés"); return recharger(); }, function (e) { St.signaler(e.message, true); });
    };
    var expire = li && li.expire_le ? Math.round((new Date(li.expire_le) - new Date()) / 86400000) : null;
    var blocs = [carte("Instagram et Facebook", li ? "Relié avec le compte Facebook de " + (li.nom || "Lili") + ". Le studio publie seulement quand vous cliquez « Publier maintenant » ou « Programmer »."
      : "Reliez une fois le compte Facebook qui gère les Pages et les comptes Instagram de vos clients : vous publierez ensuite directement depuis la fiche d'une publication.", [
      li && li.derniere_erreur ? el("p", { class: "alerte-texte", text: "Dernière erreur : " + li.derniere_erreur }) : null,
      li && expire != null && expire < 15 ? el("p", { class: "alerte-texte", text: expire > 0 ? "L'accord de Facebook expire dans " + expire + " jours : reliez à nouveau." : "L'accord de Facebook a expiré : reliez à nouveau." }) : null,
      el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [
        el("button", { type: "button", class: li ? "btn-texte" : "btn-plein", onclick: relier }, [St.icone("lien"), li ? "Relier à nouveau" : "Relier Facebook et Instagram"]),
        li ? el("button", { type: "button", class: "btn-texte", onclick: actualiser }, [St.icone("rafraichir"), "Actualiser la liste des comptes"]) : null])])];
    if (comptes.length) blocs.push(carte("Comptes et clients", "Associez chaque compte au client pour lequel vous publiez.", [
      el("ul", { class: "liste-comptes-meta" }, comptes.map(function (c) {
        var choix = el("select", { "aria-label": "Client de " + (c.nom || ""), onchange: function () {
          St.maj("meta_comptes", c.id, { espace_id: choix.value || null }).then(function () { St.signaler(choix.value ? "Associé à " + St.espace(choix.value).nom : "Association retirée"); St.dessiner(false); });
        } }, [el("option", { value: "", text: "Aucun client" })].concat(St.espacesActifs().map(function (e) { return el("option", { value: e.id, selected: e.id === c.espace_id, text: e.nom }); })));
        return el("li", {}, [c.photo_url ? el("img", { src: c.photo_url, alt: "", class: "meta-avatar" }) : el("span", { class: "meta-avatar vide" }),
          el("span", { class: "meta-nom" }, [el("b", { text: c.nom || c.identifiant || c.meta_id }), el("small", { text: (c.reseau === "instagram" ? "Instagram" : "Page Facebook") + (c.identifiant ? " · @" + c.identifiant : "") })]), choix]);
      }))]));
    // Les identifiants de l'application, collés par Lili (la clé secrète part au serveur et n'en revient jamais)
    var ap = (S.metaApplication || [])[0] || null, retour = (window.STUDIO_CONFIG || {}).url ? (window.STUDIO_CONFIG || {}).url + "/functions/v1/meta" : "https://<projet>.supabase.co/functions/v1/meta";
    var champId = el("input", { type: "text", inputmode: "numeric", value: ap ? ap.app_id || "" : "", placeholder: "App ID (que des chiffres)", "aria-label": "App ID" });
    var champSecret = el("input", { type: "password", autocomplete: "off", placeholder: ap ? "Clé secrète déjà enregistrée (laisser vide pour la garder)" : "Clé secrète de l'application", "aria-label": "Clé secrète" });
    var champConfig = el("input", { type: "text", inputmode: "numeric", value: ap ? ap.config_id || "" : "", placeholder: "Identifiant de la configuration", "aria-label": "Identifiant de configuration" });
    var enregistrer = function () {
      if (St.X.demo) return St.signaler("Démonstration : rien n'est enregistré", true);
      St.signaler("Vérification auprès de Meta…");
      St.appel("meta", { action: "identifiants", app_id: champId.value.trim(), app_secret: champSecret.value.trim(), config_id: champConfig.value.trim() })
        .then(function () { St.signaler("Application Meta enregistrée : vous pouvez relier Facebook et Instagram"); return St.charger(["meta_application"]); })
        .then(function () { St.dessiner(false); }, function (e) { St.signaler(e.message, true); });
    };
    var copier = function (t) { return el("button", { type: "button", class: "btn-texte petit", onclick: function () { navigator.clipboard.writeText(t).then(function () { St.signaler("Copié"); }); } }, [St.icone("copier"), "Copier"]); };
    var b = function (t) { return el("b", { text: t }); };
    blocs.push(carte(ap ? "Application Meta" : "La première fois : créer l'application Meta", ap ? "Enregistrée (App ID " + ap.app_id + "). Vous pouvez la modifier ici." : "Une seule fois, sur ordinateur, connectée à votre compte Facebook (environ 15 minutes). Elle n'a pas besoin d'être validée par Meta : vous êtes la seule à l'utiliser.", [
      ap ? null : el("ol", { class: "etapes-liaison" }, [
        el("li", {}, ["Ouvrez ", el("a", { href: "https://developers.facebook.com/apps/", target: "_blank", rel: "noopener", text: "developers.facebook.com/apps" }), " avec votre compte Facebook. La première fois, Meta vous inscrit comme développeuse : acceptez."]),
        el("li", {}, ["« Créer une app ». Nom : ", b("Studio Lili"), ", votre e-mail. Cas d'utilisation : cochez ", b("Gérer tout sur votre Page"), " et ", b("Gérer les messages et le contenu sur Instagram"), ". Portefeuille business : le vôtre, ou « pas maintenant ». Puis « Créer l'app »."]),
        el("li", {}, ["Dans le cas d'utilisation Instagram, choisissez la configuration ", b("avec Facebook Login"), " (pas « Instagram Login »)."]),
        el("li", {}, ["Menu ", b("Facebook Login for Business › Paramètres"), " : dans « URI de redirection OAuth valides », collez :", el("code", { text: retour }), copier(retour), " puis Enregistrer."]),
        el("li", {}, ["Menu ", b("Facebook Login for Business › Configurations › Créer"), " : nom « Studio Lili », type de jeton ", b("Jeton d'accès utilisateur"), ", et cochez les autorisations : ",
          el("code", { text: "pages_show_list, pages_read_engagement, pages_manage_posts, business_management, instagram_basic, instagram_content_publish, instagram_manage_insights, read_insights, publish_video, ads_read" }),
          ". Notez l'", b("identifiant de configuration"), " affiché."]),
        el("li", {}, ["Menu ", b("Paramètres de l'app › Général"), " : copiez l'", b("ID de l'app"), " et la ", b("Clé secrète"), " (« Afficher »)."]),
        el("li", {}, ["Collez les trois ci-dessous, « Enregistrer », puis « Relier Facebook et Instagram » plus haut."])]),
      el("div", { class: "pile-serree" }, [champId, champSecret, champConfig]),
      el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [el("button", { type: "button", class: ap ? "btn-texte" : "btn-plein", onclick: enregistrer }, [St.icone("valider"), "Enregistrer"])]),
      el("p", { class: "aide", text: "La clé secrète est vérifiée auprès de Meta puis gardée sur le serveur : elle ne s'affiche plus jamais ici." })]));
    return el("div", { class: "pile" }, blocs);
  };

  // ======================================================================
  // Fiche d'une publication : « Publication en ligne »
  // ======================================================================
  St.blocDiffusion = function (p) {
    var cibles = RESEAUX.filter(function (r) { return (p.reseaux || []).indexOf(r[0]) >= 0; });
    if (!cibles.length) return el("p", { class: "aide", text: "Choisissez Instagram ou Facebook dans « Réseaux » pour publier directement depuis le studio." });
    var ds = diffusionsDe(p.id), lignes = cibles.map(function (r) {
      var c = compteDe(p.espace_id, r[0]), d = ds.filter(function (x) { return x.reseau === r[0]; })[0];
      var etat = !c ? el("small", { class: "alerte-texte", text: "aucun compte associé (Réglages › Réseaux sociaux)" })
        : !d || d.etat === "annulee" ? el("small", { text: (c.identifiant ? "@" + c.identifiant : c.nom || "") + " · pas encore programmée" })
        : d.etat === "publiee" ? el("small", { class: "ok-texte" }, ["En ligne " + (d.publiee_le ? St.ilya(d.publiee_le) : "") + " · ", d.lien ? el("a", { href: d.lien, target: "_blank", rel: "noopener", text: "voir" }) : null])
        : d.etat === "erreur" ? el("small", { class: "alerte-texte", text: "Erreur : " + (d.erreur || "inconnue") })
        : d.etat === "en-cours" ? el("small", { text: "Publication en cours…" })
        : el("small", { text: "Programmée le " + St.fmt(d.prevue_le, { weekday: "short", day: "numeric", month: "short" }) + " à " + St.hm(d.prevue_le) + (d.erreur ? " · nouvel essai (" + d.erreur + ")" : "") });
      var annuler = d && (d.etat === "programmee" || d.etat === "erreur") ? el("button", { type: "button", class: "btn-texte petit", text: "Annuler", onclick: function () { annulerDiffusion(p, r[0]); } }) : null;
      return el("li", {}, [el("span", { class: "diff-reseau" }, [St.pastillesReseaux ? St.pastillesReseaux([r[0]]) : null, el("b", { text: r[1] })]), etat, annuler]);
    });
    var possibles = cibles.filter(function (r) { var c = compteDe(p.espace_id, r[0]), d = ds.filter(function (x) { return x.reseau === r[0]; })[0]; return c && (!d || ["annulee", "erreur", "programmee"].indexOf(d.etat) >= 0); });
    var futur = p.date_prevue && new Date(p.date_prevue) > new Date();
    return el("div", { class: "bloc-diffusion" }, [el("ul", { class: "liste-diffusion" }, lignes),
      possibles.length ? el("div", { class: "actions-ligne", style: { "justify-content": "flex-start" } }, [
        futur && possibles.some(function (r) { var d = ds.filter(function (x) { return x.reseau === r[0]; })[0]; return !d || d.etat !== "programmee"; }) ? el("button", { type: "button", class: "btn-plein", onclick: function () { lancer(p, possibles, "prevu"); } }, [St.icone("horloge"), "Programmer le " + St.fmt(p.date_prevue, { day: "numeric", month: "short" }) + " à " + St.hm(p.date_prevue)]) : null,
        el("button", { type: "button", class: futur ? "btn-texte" : "btn-plein", onclick: function () { lancer(p, possibles, "maintenant"); } }, [St.icone("envoyer"), "Publier maintenant"])]) : null]);
  };
  function annulerDiffusion(p, reseau) {
    if (St.X.demo) { S.diffusions = S.diffusions.filter(function (d) { return !(d.publication_id === p.id && d.reseau === reseau); }); St.dessiner(false); return; }
    St.appel("meta", { action: "annuler", publication_id: p.id, reseau: reseau }).then(recharger, function (e) { St.signaler(e.message, true); });
  }

  // Visuels pour Instagram : JPEG, format ramené entre 4:5 et 1,91:1 (recadrage centré), 1440 px de large au plus
  function preparerImage(m, chemin, ratioImpose) {
    return St.fichierBlob({ media: m }).then(function (b) {
      return new Promise(function (ok, ko) {
        var u = URL.createObjectURL(b), i = new Image();
        i.onload = function () {
          var w = i.naturalWidth, h = i.naturalHeight, r = w / h, sx = 0, sy = 0, sw = w, sh = h;
          var cible = ratioImpose || (r < 0.8 ? 0.8 : r > 1.91 ? 1.91 : r);   // carrousel : tout au format du premier visuel
          if (r > cible) { sw = h * cible; sx = (w - sw) / 2; } else if (r < cible) { sh = w / cible; sy = (h - sh) / 2; }
          if (!ratioImpose) preparerImage.ratio = cible;
          var k = Math.min(1, 1440 / sw), c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
          var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, sx, sy, sw, sh, 0, 0, c.width, c.height);
          URL.revokeObjectURL(u);
          c.toBlob(function (jpg) { jpg ? ok(jpg) : ko(new Error("image illisible")); }, "image/jpeg", 0.92);
        };
        i.onerror = function () { URL.revokeObjectURL(u); ko(new Error("image illisible : " + (m.nom_fichier || ""))); };
        i.src = u;
      });
    }).then(function (jpg) {
      return St.X.db.storage.from("medias").upload(chemin, jpg, { contentType: "image/jpeg", upsert: true }).then(function (r) { if (r.error) throw r.error; return { chemin: chemin, type: "image" }; });
    });
  }
  function lancer(p, cibles, quand) {
    var ms = St.mediasDe(p.id), noms = cibles.map(function (r) { return r[1]; }).join(" et ");
    var avert = p.statut !== "valide" && p.statut !== "programme" ? el("p", { class: "alerte-texte", text: "Le client n'a pas validé cette publication (statut : " + (St.STATUTS[p.statut] || p.statut).toLowerCase() + ")." }) : null;
    var sansVisuel = !ms.length && cibles.some(function (r) { return r[0] === "instagram"; }) ? el("p", { class: "alerte-texte", text: "Instagram demande au moins un visuel." }) : null;
    St.fenetre({ titre: quand === "maintenant" ? "Publier maintenant sur " + noms + " ?" : "Programmer sur " + noms + " ?",
      sous: quand === "maintenant" ? "La publication part tout de suite, avec ses " + ms.length + " visuel" + (ms.length > 1 ? "s" : "") + " et sa légende." : "Elle partira toute seule le " + St.fmt(p.date_prevue, { weekday: "long", day: "numeric", month: "long" }) + " à " + St.hm(p.date_prevue) + ". Vous pouvez annuler jusque-là.",
      corps: [avert, sansVisuel, el("p", { class: "aide", text: "Les visuels sont préparés pour Instagram (format entre 4:5 et 1,91:1, recadrage centré si besoin)." })],
      actions: [{ texte: "Annuler" }, { texte: quand === "maintenant" ? "Publier" : "Programmer", principal: true, action: function (fermer) {
        if (sansVisuel) return;
        fermer();
        if (St.X.demo) {
          cibles.forEach(function (r) {
            S.diffusions = S.diffusions.filter(function (d) { return !(d.publication_id === p.id && d.reseau === r[0]); });
            S.diffusions.push(quand === "maintenant" ? { id: St.uuid(), publication_id: p.id, reseau: r[0], etat: "publiee", publiee_le: new Date().toISOString(), lien: "https://www.instagram.com/" }
              : { id: St.uuid(), publication_id: p.id, reseau: r[0], etat: "programmee", prevue_le: p.date_prevue });
          });
          St.maj("publications", p.id, { statut: quand === "maintenant" ? "publie" : "programme" });
          St.signaler(quand === "maintenant" ? "Démonstration : publiée (rien n'est parti)" : "Démonstration : programmée"); St.dessiner(false); return;
        }
        St.signaler("Préparation des visuels…");
        // Le premier visuel fixe le format (Instagram recadre tout le carrousel comme le premier), puis les autres
        var liste = ms.slice(0, 20), chemin = function (i) { return p.espace_id + "/diffusion/" + p.id + "-" + (i + 1) + ".jpg"; };
        var premier = !liste.length ? Promise.resolve([]) : (liste[0].type === "video" ? Promise.resolve({ chemin: liste[0].chemin, type: "video" }) : preparerImage(liste[0], chemin(0))).then(function (x) { return [x]; });
        premier.then(function (debut) {
          var ratio = liste.length && liste[0].type !== "video" ? preparerImage.ratio : null;
          return Promise.all(liste.slice(1).map(function (m, i) {
            return m.type === "video" ? Promise.resolve({ chemin: m.chemin, type: "video" }) : preparerImage(m, chemin(i + 1), ratio);
          })).then(function (reste) { return debut.concat(reste); });
        }).then(function (medias) {
          St.signaler(quand === "maintenant" ? "Publication en cours…" : "Programmation…");
          return St.appel("meta", { action: "programmer", publication_id: p.id, reseaux: cibles.map(function (r) { return r[0]; }), quand: quand, medias: medias });
        }).then(function (r) {
          var erreurs = (r.diffusions || []).filter(function (d) { return d.etat === "erreur"; });
          St.signaler(erreurs.length ? "Erreur : " + erreurs.map(function (d) { return d.reseau + " : " + d.erreur; }).join(" ; ") : quand === "maintenant" ? "C'est en ligne" : "Programmée", !!erreurs.length);
          return recharger();
        }).catch(function (e) { St.signaler(e.message, true); recharger(); });
      } }] });
  }
})(window.Studio);
