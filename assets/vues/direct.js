/* En direct : qui regarde la publication (avatars), qui est en train d'écrire (Supabase Realtime, présence et
   diffusion, sans rien enregistrer), et les notifications : la cloche, la liste des nouveautés, l'abonnement de
   l'appareil aux notifications (Web Push, service worker sw.js). */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V;

  // ---------- Présence sur une publication ----------
  var P = { id: null, canal: null, etat: {}, frappe: {}, dernier: 0, minuteries: {} };
  function quitter() {
    if (P.canal && St.X.db) { try { P.canal.untrack(); } catch (e) { /* déjà parti */ } St.X.db.removeChannel(P.canal); }
    P.canal = null; P.id = null; P.etat = {}; P.frappe = {};
  }
  V.quitterPresence = quitter;
  window.addEventListener("hashchange", function () { if (P.id && location.hash.indexOf("#p/" + P.id) !== 0) quitter(); });
  function peindre() {
    var z = document.getElementById("presence-pub"); if (!z) return;
    z.textContent = "";
    var autres = Object.keys(P.etat).map(function (k) { return P.etat[k][0]; }).filter(function (x) { return x && x.id !== (S.moi && S.moi.id); });
    autres.forEach(function (x) {
      z.appendChild(el("span", { class: "presence-avatar" + (x.role === "proprietaire" ? " lili" : ""), title: x.nom + " regarde cette publication" + (x.image ? " (image " + x.image + ")" : ""), text: St.initiales(x.nom) }));
    });
    if (autres.length) z.appendChild(el("span", { class: "presence-texte", text: autres.length === 1 ? autres[0].nom.split(" ")[0] + " est là" : autres.length + " personnes ici" }));
    var f = document.getElementById("frappe-pub"); if (!f) return;
    var qui = Object.keys(P.frappe).filter(function (k) { return P.frappe[k] && k !== (S.moi && S.moi.id); }).map(function (k) { return P.frappe[k]; });
    f.textContent = ""; f.hidden = !qui.length;
    if (qui.length) { f.appendChild(document.createTextNode(qui.join(", ") + (qui.length > 1 ? " écrivent" : " écrit") + " ")); f.appendChild(el("span", { class: "points" }, [el("i"), el("i"), el("i")])); }
  }
  St.presence = function (pubId, image) {
    if (St.X.demo || !St.X.db || !S.moi) return;
    if (P.id === pubId && P.canal) { P.canal.track({ id: S.moi.id, nom: S.moi.nom || "", role: S.role, image: image || 1 }); setTimeout(peindre, 0); return; }
    quitter(); P.id = pubId;
    P.canal = St.X.db.channel("publication:" + pubId, { config: { presence: { key: S.moi.id } } });
    P.canal.on("presence", { event: "sync" }, function () { P.etat = P.canal.presenceState(); peindre(); });
    P.canal.on("broadcast", { event: "frappe" }, function (m) {
      var x = m.payload || {}; if (!x.id) return;
      P.frappe[x.id] = x.nom; peindre();
      clearTimeout(P.minuteries[x.id]); P.minuteries[x.id] = setTimeout(function () { delete P.frappe[x.id]; peindre(); }, 4000);
    });
    P.canal.subscribe(function (statut) { if (statut === "SUBSCRIBED") P.canal.track({ id: S.moi.id, nom: S.moi.nom || "", role: S.role, image: image || 1 }); });
  };
  // Prévenir les autres que l'on écrit (au plus toutes les 2 secondes)
  St.signalerFrappe = function () {
    if (!P.canal || Date.now() - P.dernier < 2000) return;
    P.dernier = Date.now();
    P.canal.send({ type: "broadcast", event: "frappe", payload: { id: S.moi.id, nom: (S.moi.nom || "").split(" ")[0] } });
  };

  // ---------- Notifications ----------
  function texteJournal(j) {
    var acteur = (St.personne(j.acteur_id) || {}).nom || "Quelqu'un", prenom = acteur.split(" ")[0], d = j.details || {};
    var t = d.titre ? "« " + d.titre + " »" : "une publication";
    if (j.action === "publication.statut") return d.vers === "a-valider" ? t + " attend " + (St.estLili() ? "le client" : "votre validation")
      : d.vers === "valide" ? prenom + " a validé " + t : d.vers === "modifs-demandees" ? prenom + " demande une modification sur " + t
      : d.vers === "publie" ? t + " est en ligne" : t + " : " + (St.STATUTS[d.vers] || d.vers);
    if (j.action === "commentaire.ajoute") return prenom + " a commenté " + t + (d.extrait ? " : « " + d.extrait + " »" : "");
    if (j.action === "media.depose") return prenom + " a déposé " + (d.nom ? "« " + d.nom + " »" : "un fichier");
    if (j.action === "publication.idee") return prenom + " propose une idée : " + (d.titre || "");
    if (j.action === "message.envoye") return prenom + " a écrit : « " + (d.extrait || "") + " »";
    return prenom + " · " + j.action;
  }
  V.notifications = function () {
    var miennes = S.notifications.filter(function (n) { return !S.moi || n.personne_id === S.moi.id; });
    var journal = function (id) { return S.journal.filter(function (j) { return j.id === id; })[0]; };
    var liste = miennes.map(function (n) { return { n: n, j: journal(n.journal_id) }; }).filter(function (x) { return x.j; });
    var corps = [liste.length ? el("ul", { class: "liste-notifs" }, liste.slice(0, 40).map(function (x) {
      var e = St.espace(x.j.espace_id) || {};
      return el("li", { class: x.n.lue_le ? "" : "non-lue" }, [el("a", { href: x.j.objet_type === "publication" || x.j.action.indexOf("publication") === 0 || x.j.action === "commentaire.ajoute" ? "#p/" + x.j.objet_id : "#", onclick: function () { f.close(); } }, [
        St.logoEspace(e, "petit"), el("span", {}, [el("b", { text: texteJournal(x.j) }), el("small", { text: (e.nom ? e.nom + " · " : "") + St.ilya(x.j.cree_le) })])])]);
    })) : St.vide("Rien de nouveau pour l'instant."), zoneAppareil()];
    var f = St.fenetre({ titre: "Notifications", classe: "notifs", corps: corps, actions: [{ texte: "Fermer" }] });
    // Ouvrir la liste vaut lecture
    var aLire = miennes.filter(function (n) { return !n.lue_le; });
    if (aLire.length) {
      var t = new Date().toISOString(); aLire.forEach(function (n) { n.lue_le = t; });
      if (!St.X.demo) St.X.db.from("notifications").update({ lue_le: t }).in("id", aLire.map(function (n) { return n.id; })).then(function () {});
      f.addEventListener("close", function () { St.dessiner(false); });
    }
  };

  // Recevoir les notifications sur cet appareil (téléphone avec l'app installée, ordinateur)
  function zoneAppareil() {
    var z = el("div", { class: "zone-appareil" });
    var ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (St.X.demo) { z.appendChild(el("p", { class: "aside", text: "En démonstration, les notifications de l'appareil ne sont pas branchées." })); return z; }
    if (!ok) {
      var ios = /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone;
      z.appendChild(el("p", { class: "aside", text: ios ? "Sur iPhone : installez d'abord l'application (Partager › Sur l'écran d'accueil), puis ouvrez-la pour activer les notifications." : "Ce navigateur ne sait pas recevoir de notifications." }));
      return z;
    }
    var etat = el("p", { class: "aside" });
    var bouton = el("button", { type: "button", class: "btn-plein", onclick: abonner }, [St.icone("cloche"), "Recevoir les notifications sur cet appareil"]);
    z.appendChild(bouton); z.appendChild(etat);
    if (St.estLili()) z.appendChild(el("button", { type: "button", class: "btn-texte", text: "Envoyer une notification d'essai", onclick: function () {
      St.X.db.functions.invoke("notifier", { body: { test: true } }).then(function (r) { etat.textContent = r.error ? "Essai impossible : " + r.error.message : r.data.envoyees ? "Essai envoyé." : "Aucun appareil abonné pour l'instant."; });
    } }));
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) {
      if (s) { bouton.hidden = true; etat.textContent = "Cet appareil reçoit les notifications."; }
      else if (Notification.permission === "denied") { bouton.hidden = true; etat.textContent = "Les notifications sont bloquées pour ce site dans les réglages du navigateur."; }
    }).catch(function () {});
    function abonner() {
      bouton.disabled = true; etat.textContent = "Activation…";
      Promise.all([fetch(St.X.db.functionsUrl ? St.X.db.functionsUrl + "/notifier" : (window.STUDIO_CONFIG.url + "/functions/v1/notifier")).then(function (r) { return r.json(); }), navigator.serviceWorker.ready])
        .then(function (x) {
          if (!x[0].cle) throw new Error("clés des notifications absentes");
          var cle = Uint8Array.from(atob(x[0].cle.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - x[0].cle.length % 4) % 4)), function (c) { return c.charCodeAt(0); });
          return x[1].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle });
        }).then(function (s) {
          var j = s.toJSON();
          return St.X.db.from("push_abonnements").upsert({ endpoint: j.endpoint, personne_id: S.moi.id, abonnement: j, appareil: navigator.userAgent.slice(0, 120) });
        }).then(function (r) {
          if (r && r.error) throw r.error;
          bouton.hidden = true; etat.textContent = "C'est fait : cet appareil recevra les notifications.";
        }).catch(function (e) { bouton.disabled = false; etat.textContent = Notification.permission === "denied" ? "Refusé : autorisez les notifications pour ce site dans les réglages." : "Impossible : " + e.message; });
    }
    return z;
  }
})(window.Studio);
