/* Devis côté client (#devis) : les devis que Lili lui a envoyés, à lire et à signer en ligne.
   Comme dans Evoalys : « Bon pour accord » coché, nom saisi, signature tracée, puis un code à 6 chiffres reçu par
   e-mail. La preuve (adresse vérifiée, date, IP, empreinte du devis) est gardée par la fonction « signer-devis ». */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, V = St.V, MARQUE = window.MARQUE || {}, A = St.aides;
  var auj = function () { return St.iso(new Date()); };
  function signature(d) { return S.signaturesDevis.filter(function (x) { return x.devis_id === d.id; })[0] || null; }
  function etat(d) {
    var sg = signature(d);
    if (sg || d.statut === "accepte") return ["signe", sg ? "Signé le " + St.fmt(sg.signe_le, { day: "numeric", month: "long" }) : "Accepté"];
    if (d.statut === "refuse") return ["refuse", "Refusé"];
    if (d.valable_jusque && d.valable_jusque < auj()) return ["expire", "Expiré"];
    return ["a-signer", "À signer"];
  }

  V.devisClient = function (r, e) {
    var ds = S.devis.filter(function (d) { return d.espace_id === e.id && ["envoye", "accepte", "refuse"].indexOf(d.statut) >= 0; })
      .sort(function (a, b) { return String(b.date_devis || b.cree_le).localeCompare(String(a.date_devis || a.cree_le)); });
    var ouvert = r.query && r.query.d && ds.filter(function (d) { return d.id === r.query.d; })[0];
    if (ouvert) return detail(ouvert, e);
    return el("div", { class: "rubrique-etroite" }, [St.entete(null, "Devis", "Les propositions de " + (MARQUE.proprietaire || "Lili") + ", à lire et à signer en ligne."),
      ds.length ? el("div", { class: "pile" }, ds.map(function (d) {
        var et = etat(d);
        return el("a", { class: "bloc carte-devis", href: "#devis?d=" + d.id }, [
          el("div", {}, [el("small", { class: "surtitre", text: (d.numero || "Devis") + (d.date_devis ? " · " + St.fmt(d.date_devis + "T12:00:00", { day: "numeric", month: "long", year: "numeric" }) : "") }),
            el("b", { class: "titre-devis", text: d.objet || "Devis" }),
            el("small", { text: et[0] === "a-signer" && d.valable_jusque ? "À signer avant le " + St.fmt(d.valable_jusque + "T12:00:00", { day: "numeric", month: "long" }) : "" })]),
          el("div", { class: "carte-devis-droite" }, [el("b", { class: "mono", text: A.euros(d.total_ttc) + " TTC" }), el("span", { class: "etat-devis e-" + et[0], text: et[1] })])]);
      })) : St.vide("Aucun devis pour l'instant.")]);
  };

  function detail(d, e) {
    var et = etat(d), sg = signature(d);
    var lignes = el("div", { class: "table-defile" }, [el("table", { class: "table-chiffres" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "Désignation" }), el("th", { class: "n", text: "Qté" }), el("th", { class: "n", text: "Prix HT" }), el("th", { class: "n", text: "Total HT" })])]),
      el("tbody", {}, (d.lignes || []).map(function (l) { return el("tr", {}, [el("td", { text: l.libelle }), el("td", { class: "n", text: String(l.quantite).replace(".", ",") }), el("td", { class: "n", text: A.euros(l.prix_ht) }), el("td", { class: "n", text: A.euros((+l.quantite || 0) * (+l.prix_ht || 0)) })]); }))])]);
    var totaux = el("div", { class: "totaux-piece" }, [["Total HT", d.total_ht], ["TVA", d.total_tva], ["Total TTC", d.total_ttc]].reduce(function (l, x) { return l.concat([el("span", { text: x[0] }), el("b", { class: "mono", text: A.euros(x[1]) })]); }, []));
    var bas;
    if (sg) bas = el("section", { class: "bloc signe-bloc" }, [el("h2", { text: "Signé" }), el("p", { text: "Bon pour accord, signé électroniquement par " + sg.nom_signataire + " le " + St.fmt(sg.signe_le, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " à " + St.hm(sg.signe_le) + "." }),
      el("img", { class: "signature-image", src: sg.signature, alt: "Signature" }),
      el("p", { class: "aide", text: (sg.email_verifie ? "Identité confirmée par un code envoyé à " + sg.email_verifie + ". " : "") + "Lili a reçu votre accord. Merci !" })]);
    else if (et[0] === "a-signer") bas = blocSignature(d);
    else bas = el("p", { class: "aide", text: et[0] === "expire" ? "Ce devis a expiré : demandez-en un nouveau à Lili (rubrique Messages)." : "Ce devis n'est plus à signer." });
    return el("div", { class: "rubrique-etroite" }, [
      el("a", { class: "retour-client", href: "#devis" }, [St.icone("retour"), el("span", { text: "Tous les devis" })]),
      St.entete((d.numero || "Devis") + " · " + (MARQUE.proprietaire || ""), d.objet || "Devis", d.valable_jusque && et[0] === "a-signer" ? "Valable jusqu'au " + St.fmt(d.valable_jusque + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) + "." : null,
        [el("button", { type: "button", class: "btn-texte", onclick: function () { A.imprimerPiece("devis", d); } }, [St.icone("imprimer"), "PDF"])]),
      el("section", { class: "bloc" }, [lignes, totaux]),
      bas]);
  }

  // La zone de signature : cocher, écrire son nom, tracer, valider
  function blocSignature(d) {
    var accord = el("input", { type: "checkbox" });
    var nomI = el("input", { type: "text", value: (S.moi && S.moi.nom && S.moi.nom !== "Client (aperçu)" ? S.moi.nom : ""), placeholder: "Prénom et nom", autocomplete: "name", "aria-label": "Votre nom" });
    var pad = pave();
    // Comme dans Evoalys : un code à 6 chiffres reçu par e-mail confirme la signature
    var codeI = el("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, placeholder: "6 chiffres", class: "code-signature", "aria-label": "Code reçu par e-mail" });
    var zoneCode = el("div", { class: "etape-code", hidden: true }, [el("p", { class: "phrase", id: "code-envoye" }), A.champ("Code reçu par e-mail", codeI),
      el("button", { type: "button", class: "btn-texte petit", text: "Renvoyer un code", onclick: function () { demanderCode(); } })]);
    var verifier = function () {
      if (!accord.checked) { St.signaler("Cochez « Bon pour accord »", true); return false; }
      if (nomI.value.trim().length < 3) { nomI.focus(); St.signaler("Indiquez votre nom", true); return false; }
      if (pad.vide()) { St.signaler("Tracez votre signature dans le cadre", true); return false; }
      return true;
    };
    var demanderCode = function () {
      if (!verifier()) return;
      bouton.disabled = true; bouton.textContent = "Envoi du code…";
      var montre = function (email) { zoneCode.hidden = false; zoneCode.querySelector("#code-envoye").textContent = "Un code à 6 chiffres vient de partir à " + email + ". Il est valable 10 minutes."; bouton.disabled = false; bouton.textContent = "Signer le devis"; etape = 2; setTimeout(function () { codeI.focus(); }, 50); };
      if (St.X.demo) { montre("votre adresse (démonstration : le code est 123456)"); return; }
      St.appel("signer-devis", { action: "code", devis_id: d.id }).then(function (r) { montre(r.email); }, function (x) { St.signaler(x.message, true); bouton.disabled = false; bouton.textContent = etape === 2 ? "Signer le devis" : "Recevoir mon code par e-mail"; });
    };
    var etape = 1;
    var bouton = el("button", { type: "button", class: "btn-plein grand", onclick: function () {
      if (etape === 1) return demanderCode();
      if (!verifier()) return;
      var code = codeI.value.replace(/\D/g, "");
      if (code.length !== 6) { codeI.focus(); return St.signaler("Saisissez les 6 chiffres reçus par e-mail", true); }
      bouton.disabled = true; bouton.textContent = "Signature…";
      var corps = { action: "signer", devis_id: d.id, code: code, nom: nomI.value.trim(), signature: pad.image(), accord: true };
      var fini = function (r) {
        S.signaturesDevis.push({ devis_id: d.id, nom_signataire: corps.nom, signature: corps.signature, signe_le: (r && r.signe_le) || new Date().toISOString(),
          empreinte: (r && r.empreinte) || "démonstration", email_verifie: (r && r.email_verifie) || "adresse de démonstration", code_verifie_le: new Date().toISOString() });
        d.statut = "accepte"; St.signaler("Devis signé : Lili est prévenue. Merci !"); St.dessiner(true);
      };
      if (St.X.demo) { if (code !== "123456") { bouton.disabled = false; bouton.textContent = "Signer le devis"; return St.signaler("Code incorrect (démonstration : 123456)", true); } return fini(null); }
      St.appel("signer-devis", corps).then(fini, function (x) { St.signaler(x.message, true); bouton.disabled = false; bouton.textContent = "Signer le devis"; });
    } }, [St.icone("mail"), "Recevoir mon code par e-mail"]);
    return el("section", { class: "bloc signature-bloc" }, [el("h2", { text: "Signer en ligne" }),
      el("label", { class: "case-option" }, [accord, el("span", {}, [el("b", { text: "Bon pour accord" }), el("small", { text: "J'accepte ce devis, son montant de " + A.euros(d.total_ttc) + " TTC et ses conditions." })])]),
      A.champ("Votre nom", nomI),
      el("div", { class: "champ" }, [el("span", { text: "Votre signature" }), pad.el, el("small", { text: "Du doigt sur téléphone, à la souris sur ordinateur." })]),
      zoneCode, bouton,
      el("p", { class: "aide", text: "Signature électronique avec code à usage unique : votre adresse e-mail vérifiée, la date, l'heure, votre adresse IP et l'empreinte du devis sont gardées comme preuve. Vous la retrouvez sur le PDF du devis." })]);
  }
  // Pavé de signature : trait lissé, net sur écran Retina, effaçable
  function pave() {
    var c = el("canvas", { class: "pave-signature", "aria-label": "Zone de signature", role: "img" }), ctx = c.getContext("2d"), trace = false, vide = true, dernier = null;
    var mise = function () { var r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1; if (!r.width) return; c.width = r.width * k; c.height = r.height * k; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1E1A17"; vide = true; };
    var point = function (ev) { var r = c.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    c.addEventListener("pointerdown", function (ev) { ev.preventDefault(); c.setPointerCapture(ev.pointerId); trace = true; dernier = point(ev); ctx.beginPath(); ctx.arc(dernier[0], dernier[1], 1, 0, 7); ctx.fillStyle = "#1E1A17"; ctx.fill(); vide = false; });
    c.addEventListener("pointermove", function (ev) { if (!trace) return; var p = point(ev); ctx.beginPath(); ctx.moveTo(dernier[0], dernier[1]); ctx.quadraticCurveTo(dernier[0], dernier[1], (dernier[0] + p[0]) / 2, (dernier[1] + p[1]) / 2); ctx.lineTo(p[0], p[1]); ctx.stroke(); dernier = p; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { c.addEventListener(t, function () { trace = false; }); });
    requestAnimationFrame(mise); window.addEventListener("resize", function () { if (vide) mise(); });
    var effacer = el("button", { type: "button", class: "btn-texte petit", text: "Effacer", onclick: function () { ctx.clearRect(0, 0, c.width, c.height); vide = true; } });
    return { el: el("div", { class: "pave-cadre" }, [c, effacer]), vide: function () { return vide; },
      image: function () {   // fond blanc, pour une signature lisible partout (PDF, mode sombre)
        var o = document.createElement("canvas"); o.width = c.width; o.height = c.height; var x = o.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0);
        var k = Math.min(1, 900 / o.width), p = document.createElement("canvas"); p.width = Math.round(o.width * k); p.height = Math.round(o.height * k); p.getContext("2d").drawImage(o, 0, 0, p.width, p.height);
        return p.toDataURL("image/png");
      } };
  }
})(window.Studio);
