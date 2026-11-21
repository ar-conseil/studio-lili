/* Studio Lili — entrée de l'application et coquille.
   Entrée comme Evoalys : e-mail et mot de passe (ou lien par e-mail), puis code à 6 chiffres d'une application
   d'authentification (Supabase MFA, TOTP). Le code est redemandé à chaque ouverture de l'app après 30 minutes
   d'absence, et après 30 minutes sans activité ; « Verrouiller » le redemande tout de suite.
   Code obligatoire pour Lili et les invités ; facultatif pour les clients (app_metadata.role = "client").
   Sans assets/config.js rempli (projet Supabase pas encore créé) : aperçu, les écrans s'enchaînent sans rien enregistrer.
   Pour voir un écran en aperçu : ?ecran=code, ?ecran=enrolement, ?ecran=nouveau, ?ecran=app. */
(function () {
  "use strict";

  var CFG = window.STUDIO_CONFIG || {};
  var MARQUE = window.MARQUE || {};
  var APERCU = !CFG.url || !CFG.cle || !window.supabase;
  var VERROU_MS = 30 * 60000;              // absence ou inactivité au-delà de laquelle le code est redemandé
  var ESSAIS_MAX = 5;                      // codes faux avant déconnexion complète
  var CLE_ACTIVITE = "studio.activite";    // dernière activité, en millisecondes (cet appareil seulement)

  var db = APERCU ? null : window.supabase.createClient(CFG.url, CFG.cle, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var $ = function (id) { return document.getElementById(id); };
  var entree = $("entree"), coquille = $("coquille"), message = $("message");
  var etat = { facteur: null, essais: 0, ouvert: false };

  // ---------- Petites aides ----------
  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (e) { /* stockage indisponible : le code sera redemandé */ } }
  function dire(texte, erreur) { message.textContent = texte || ""; message.classList.toggle("erreur", !!erreur); }
  function vue(id) {
    ["vue-connexion", "vue-lien", "vue-code", "vue-enrolement", "vue-nouveau"].forEach(function (v) { $(v).hidden = v !== id; });
    entree.hidden = false; coquille.hidden = true; etat.ouvert = false; dire("");
    var premier = $(id).querySelector("input:not([type=hidden])");
    if (premier) setTimeout(function () { premier.focus(); }, 60);
  }
  function occupe(form, oui) { var b = form.querySelector("button[type=submit]"); if (b) b.disabled = oui; }
  function noterActivite() { ecrire(CLE_ACTIVITE, String(Date.now())); }
  function absentDepuis() { var t = +lire(CLE_ACTIVITE) || 0; return Date.now() - t; }
  document.querySelectorAll("[data-marque]").forEach(function (n) { if (MARQUE[n.dataset.marque]) n.textContent = MARQUE[n.dataset.marque]; });

  // ---------- Saisie du code : un champ, six cases ----------
  function brancherCode(boite, champ, valider) {
    function peindre() {
      var v = champ.value.replace(/\D/g, "").slice(0, 6);
      if (v !== champ.value) champ.value = v;
      var cases = boite.querySelectorAll("span");
      cases.forEach(function (c, i) {
        c.textContent = v[i] || "";
        c.classList.toggle("rempli", i < v.length);
        c.classList.toggle("courant", i === Math.min(v.length, 5) && document.activeElement === champ);
      });
      boite.classList.remove("erreur", "ok");
      if (v.length === 6) valider(v);
    }
    champ.addEventListener("input", peindre);
    champ.addEventListener("focus", function () { boite.classList.add("actif"); peindre(); });
    champ.addEventListener("blur", function () { boite.classList.remove("actif"); peindre(); });
    boite.addEventListener("click", function () { champ.focus(); });
    return {
      vider: function () { champ.value = ""; peindre(); champ.focus(); },
      erreur: function () { boite.classList.remove("erreur"); void boite.offsetWidth; boite.classList.add("erreur"); if (navigator.vibrate) navigator.vibrate([30, 40, 30]); },
      ok: function () { boite.classList.add("ok"); }
    };
  }
  var enCours = false;
  var code = brancherCode($("code"), $("code-champ"), function (v) { verifierCode(v); });
  var codeEnrolement = brancherCode($("code-enrolement"), $("code-enrolement-champ"), function (v) { activerCode(v); });
  $("vue-code").addEventListener("submit", function (ev) { ev.preventDefault(); var v = $("code-champ").value; if (v.length === 6) verifierCode(v); else dire("Six chiffres, s'il vous plaît.", true); });
  $("vue-enrolement").addEventListener("submit", function (ev) { ev.preventDefault(); var v = $("code-enrolement-champ").value; if (v.length === 6) activerCode(v); else dire("Six chiffres, s'il vous plaît.", true); });

  // ---------- Après connexion : quel écran ? ----------
  function codeExige(user) { return ((user && user.app_metadata) || {}).role !== "client"; }
  var suiteEnCours = null;
  function suite() { // un seul enchaînement à la fois (connexion et événements de session arrivent ensemble)
    if (APERCU) return ouvrir();
    if (!suiteEnCours) suiteEnCours = enchainer().then(function () { suiteEnCours = null; }, function () { suiteEnCours = null; });
    return suiteEnCours;
  }
  function enchainer() {
    return db.auth.getSession().then(function (r) {
      var session = r.data.session;
      if (!session) return vue("vue-connexion");
      return Promise.all([db.auth.mfa.getAuthenticatorAssuranceLevel(), db.auth.mfa.listFactors()]).then(function (x) {
        var niveau = x[0].data || {}, facteurs = ((x[1].data || {}).totp || []).filter(function (f) { return f.status === "verified"; });
        etat.facteur = facteurs[0] || null;
        if (!etat.facteur) return codeExige(session.user) ? preparerEnrolement() : ouvrir();
        // Code demandé : pas encore saisi pour cette session, ou absence trop longue sur cet appareil
        if (niveau.currentLevel !== "aal2" || absentDepuis() > VERROU_MS) return demanderCode();
        ouvrir();
      });
    }).catch(function (e) { vue("vue-connexion"); dire("Connexion impossible : " + e.message, true); });
  }
  function demanderCode(titre) {
    vue("vue-code");
    $("code-titre").textContent = titre || "Votre code";
    code.vider();
  }
  function verifierCode(v) {
    if (enCours) return; enCours = true;
    var fin = function () { enCours = false; };
    if (APERCU) {
      // Aperçu : tout code à 6 chiffres est accepté, sauf 000000 pour montrer une erreur
      setTimeout(function () { fin(); if (v === "000000") { code.erreur(); dire("Code incorrect. Réessayez.", true); code.vider(); } else { code.ok(); ouvrir(); } }, 250);
      return;
    }
    db.auth.mfa.challengeAndVerify({ factorId: etat.facteur.id, code: v }).then(function (r) {
      fin();
      if (r.error) {
        etat.essais++;
        code.erreur(); code.vider();
        if (etat.essais >= ESSAIS_MAX) { dire("Trop d'essais : reconnectez-vous.", true); return db.auth.signOut(); }
        dire("Code incorrect. Il change toutes les 30 secondes : prenez le plus récent.", true);
        return;
      }
      etat.essais = 0; code.ok(); ouvrir();
    }).catch(function (e) { fin(); dire(e.message, true); });
  }

  // ---------- Première fois : relier une application d'authentification ----------
  function preparerEnrolement() {
    vue("vue-enrolement");
    var qr = $("qr");
    if (APERCU) { qr.classList.add("exemple"); qr.textContent = "Ici, le QR code à scanner"; $("secret").textContent = "EXEMPLE-DE-CLE-SECRETE"; return; }
    qr.textContent = "";
    // Un essai précédent non terminé laisse un facteur « non vérifié » : on le retire avant d'en créer un neuf.
    return db.auth.mfa.listFactors().then(function (r) {
      var restes = (((r.data || {}).all) || []).filter(function (f) { return f.status !== "verified"; });
      return Promise.all(restes.map(function (f) { return db.auth.mfa.unenroll({ factorId: f.id }); }));
    }).then(function () {
      return db.auth.mfa.enroll({ factorType: "totp", friendlyName: (MARQUE.outil || "Studio") + " · " + new Date().toLocaleDateString("fr-FR") });
    }).then(function (r) {
      if (r.error) throw r.error;
      etat.facteur = r.data;
      var img = document.createElement("img"); img.alt = ""; img.src = r.data.totp.qr_code; qr.appendChild(img);
      $("secret").textContent = r.data.totp.secret;
    }).catch(function (e) { dire("Impossible de préparer le code : " + e.message, true); });
  }
  function activerCode(v) {
    if (enCours) return; enCours = true;
    if (APERCU) { setTimeout(function () { enCours = false; codeEnrolement.ok(); ouvrir(); }, 250); return; }
    db.auth.mfa.challengeAndVerify({ factorId: etat.facteur.id, code: v }).then(function (r) {
      enCours = false;
      if (r.error) { codeEnrolement.erreur(); codeEnrolement.vider(); dire("Code incorrect. Vérifiez l'heure de votre téléphone et prenez le plus récent.", true); return; }
      codeEnrolement.ok(); ouvrir();
    }).catch(function (e) { enCours = false; dire(e.message, true); });
  }

  // ---------- L'application ----------
  function ouvrir() {
    noterActivite();
    entree.hidden = true; coquille.hidden = false; etat.ouvert = true;
    var maintenant = new Date();
    $("date-du-jour").textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(maintenant);
    var h = maintenant.getHours(), prenom = (MARQUE.proprietaire || "").split(" ")[0];
    $("bonjour").textContent = (h < 5 || h >= 18 ? "Bonsoir" : "Bonjour") + (prenom ? " " + prenom : "");
    document.title = "Aujourd'hui · " + (MARQUE.outil || "Studio");
  }
  function verrouiller() {
    if (!etat.ouvert) return;
    ecrire(CLE_ACTIVITE, "0");
    if (APERCU || etat.facteur) demanderCode("Code, s'il vous plaît");
  }
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (t) {
    var dernier = 0;
    document.addEventListener(t, function () { var n = Date.now(); if (etat.ouvert && n - dernier > 20000) { dernier = n; noterActivite(); } }, { passive: true });
  });
  setInterval(function () { if (etat.ouvert && absentDepuis() > VERROU_MS) verrouiller(); }, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && etat.ouvert && absentDepuis() > VERROU_MS) verrouiller(); });
  $("btn-verrouiller").addEventListener("click", verrouiller);
  $("btn-quitter").addEventListener("click", function () { ecrire(CLE_ACTIVITE, "0"); if (APERCU) return vue("vue-connexion"); db.auth.signOut(); });
  $("btn-autre-compte").addEventListener("click", function () { ecrire(CLE_ACTIVITE, "0"); if (APERCU) return vue("vue-connexion"); db.auth.signOut(); });

  // ---------- Connexion ----------
  var formConnexion = $("vue-connexion");
  formConnexion.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = $("email").value.trim(), mdp = $("mot-de-passe").value;
    if (!email || !mdp) return dire("E-mail et mot de passe, s'il vous plaît.", true);
    if (APERCU) return preparerEnrolement();
    occupe(formConnexion, true); dire("Connexion…");
    db.auth.signInWithPassword({ email: email, password: mdp }).then(function (r) {
      occupe(formConnexion, false);
      if (r.error) return dire("E-mail ou mot de passe incorrect.", true);
      $("mot-de-passe").value = ""; etat.essais = 0; // la suite vient de l'événement SIGNED_IN
    });
  });
  // Google ou Microsoft : retour sur le site, puis code à 6 chiffres comme pour le mot de passe.
  // Un compte Google ou Microsoft à la même adresse qu'un compte invité s'y rattache ; les inconnus sont refusés.
  document.querySelectorAll("[data-fournisseur]").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.dataset.fournisseur;
      if (APERCU) return preparerEnrolement();
      dire("Ouverture de " + (f === "google" ? "Google" : "Microsoft") + "…");
      db.auth.signInWithOAuth({ provider: f, options: { redirectTo: location.origin + location.pathname, scopes: f === "azure" ? "email openid profile" : undefined } })
        .then(function (r) { if (r.error) dire("Connexion impossible : " + r.error.message, true); });
    });
  });
  // Retour d'un fournisseur avec une erreur (compte non invité, refus…) : message clair, sans détail technique
  (function () {
    var p = new URLSearchParams(location.hash.slice(1) || location.search);
    if (p.get("error")) {
      dire(/signup|not allowed|disabled/i.test(p.get("error_description") || "") ? "Ce compte n'a pas encore accès : demandez une invitation à Lili." : "Connexion refusée : " + (p.get("error_description") || p.get("error")), true);
      history.replaceState(null, "", location.pathname);
    }
  })();
  $("btn-lien").addEventListener("click", function () {
    var email = $("email").value.trim();
    if (!email) { dire("Indiquez d'abord votre e-mail.", true); $("email").focus(); return; }
    if (APERCU) return vue("vue-lien");
    db.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
      // Même réponse que le compte existe ou non : on ne révèle pas qui a accès.
      if (r.error && !/not allowed|signups/i.test(r.error.message)) return dire(r.error.message, true);
      vue("vue-lien");
    });
  });
  $("btn-oubli").addEventListener("click", function () {
    var email = $("email").value.trim();
    if (!email) { dire("Indiquez d'abord votre e-mail.", true); $("email").focus(); return; }
    if (APERCU) return dire("Un e-mail de réinitialisation vient de partir.");
    db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function () {
      dire("Si ce compte existe, un e-mail de réinitialisation vient de partir.");
    });
  });
  document.querySelectorAll("[data-retour]").forEach(function (b) { b.addEventListener("click", function () { vue("vue-connexion"); }); });
  $("vue-nouveau").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var mdp = $("nouveau-mdp").value;
    if (mdp.length < 10) return dire("10 caractères au moins.", true);
    if (APERCU) return vue("vue-connexion");
    db.auth.updateUser({ password: mdp }).then(function (r) {
      if (r.error) return dire(r.error.message, true);
      $("nouveau-mdp").value = ""; suite();
    });
  });

  // ---------- Installation sur le bureau ou l'écran d'accueil ----------
  var invitation = null;
  var installee = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function montrerInstaller(oui) { document.querySelectorAll("[data-installer]").forEach(function (b) { b.hidden = !oui; }); }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); invitation = e; montrerInstaller(true); });
  window.addEventListener("appinstalled", function () { invitation = null; montrerInstaller(false); });
  document.querySelectorAll("[data-installer]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!invitation) return;
      invitation.prompt();
      invitation.userChoice.then(function () { invitation = null; montrerInstaller(false); });
    });
  });
  if (!installee) {
    // Safari ne propose pas de bouton : on dit où se trouve la commande.
    var ua = navigator.userAgent, ios = !/Android/.test(ua) && (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    var safariMac = !ios && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
    var astuce = ios ? "Pour l'installer : bouton Partager, puis « Sur l'écran d'accueil »."
      : safariMac ? "Pour l'installer : menu Fichier, puis « Ajouter au Dock »." : "";
    if (astuce) document.querySelectorAll("[data-astuce]").forEach(function (p) { p.textContent = astuce; p.hidden = false; });
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () { /* l'app marche sans */ });

  // ---------- Démarrage ----------
  if (APERCU) {
    $("apercu").hidden = false;
    var ecran = new URLSearchParams(location.search).get("ecran");
    if (ecran === "code") demanderCode();
    else if (ecran === "enrolement") preparerEnrolement();
    else if (ecran === "nouveau") vue("vue-nouveau");
    else if (ecran === "app") ouvrir();
    else vue("vue-connexion");
    return;
  }
  db.auth.onAuthStateChange(function (evenement) {
    // Sortir du rappel avant de relire la base (sinon supabase-js peut se bloquer sur son verrou de session).
    setTimeout(function () {
      if (evenement === "PASSWORD_RECOVERY") return vue("vue-nouveau");
      if (evenement === "SIGNED_OUT") { etat.facteur = null; vue("vue-connexion"); return; }
      if (evenement === "SIGNED_IN" || evenement === "INITIAL_SESSION") { if (!etat.ouvert) suite(); }
    }, 0);
  });
})();
