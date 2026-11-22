/* Ma signature de mail, comme Evoalys (22/11/2026) : photo, informations, aperçu en direct, puis « Copier pour Gmail »
   (HTML riche à coller dans Gmail › Paramètres › Signature), « Copier pour Gmail (version image) » (la carte en images,
   identique partout), « Télécharger en JPEG » et « Utiliser pour les mails du studio ».
   Chaque propriétaire (Lili, Antonin) a la sienne : reglages.signature_carte = { <id de la personne>: {...} }.
   Les images (photo dans son anneau, carte, bouton d'avis) vont dans la table signature_images (privée) et sont servies
   par la fonction « signature » à qui connaît leur clé aléatoire : Gmail les affiche sans connexion, le stockage du
   studio reste privé. En démonstration, tout reste dans la page (images en data:). */
(function (St) {
  "use strict";
  var el = St.el, S = St.S, A = St.aides, MARQUE = window.MARQUE || {}, CFG = window.STUDIO_CONFIG || {};
  var TERRE = "#A9553A", TERRE_F = "#7A3A24", ENCRE = "#1E1A17", ENCRE2 = "#5F574F", FILET = "#E7E0D5", PAPIER = "#FBF8F3", OR = "#D99A1E";
  // Adresse publique du site (le logo doit être lisible par les messageries, même quand Lili travaille en local)
  var SITE = /^https:/.test(location.href) ? new URL(".", location.href).href : "https://ar-conseil.github.io/studio-lili/";
  var LOGO = SITE + "assets/marque/signature-lr.png";
  var DEGRADE = "background:" + TERRE + ";background-image:linear-gradient(135deg," + TERRE + "," + TERRE_F + ");";
  var LARGEUR = 560;

  function reglage(cle) { return ((S.reglages.filter(function (r) { return r.cle === cle; })[0] || {}).valeur) || {}; }
  function moi() { return (S.moi && S.moi.id) || "demo"; }
  function defauts() {
    var e = reglage("entreprise");
    return { nom: (S.moi && S.moi.nom) || e.nom || MARQUE.proprietaire || "", fonction: e.activite || MARQUE.metier || "Community manager",
      telephone: e.telephone || "", email: (S.moi && S.moi.email) || e.email || "", site: e.site || "", phrase: "Vos réseaux, racontés avec soin.",
      avis: false, lien_avis: e.avis_google || "" };
  }
  function e(s) { return A.echapper(s == null ? "" : String(s)); }
  function siteCourt(s) { return String(s || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""); }
  function siteLien(s) { s = String(s || "").trim(); return !s ? "" : /^https?:\/\//.test(s) ? s : "https://" + s; }
  function telLien(t) { var c = String(t || "").replace(/[^\d+]/g, ""); return c.charAt(0) === "0" && c.length === 10 ? "+33" + c.slice(1) : c; }
  function avisOk(r) { return !!(r.avis && /^https:\/\//.test(r.lien_avis || "")); }
  function lignes(r) {
    return [r.telephone ? ["T", r.telephone, "tel:" + telLien(r.telephone)] : null, r.email ? ["@", r.email, "mailto:" + r.email] : null,
      r.site ? ["W", siteCourt(r.site), siteLien(r.site)] : null].filter(Boolean);
  }

  // ---------- La signature en HTML pour les messageries (tableaux, styles en ligne) ----------
  function html(r, img, version) {
    var colonnes = 4, phrase = r.phrase ? '<tr><td style="padding:12px 4px 0 4px;font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:13px;line-height:18px;color:#8B8178;">' + e(r.phrase) + "</td></tr>" : "";
    var table = function (corps) { return '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Arial,Helvetica,sans-serif;color:' + ENCRE2 + ';border-collapse:separate;width:' + LARGEUR + 'px;max-width:' + LARGEUR + 'px;">' + corps + phrase + "</table>"; };
    if (version === "image") {   // la carte et le bouton d'avis en images : rendu identique dans toutes les messageries
      return table('<tr><td style="padding:0;"><a href="' + e(siteLien(r.site) || "mailto:" + r.email) + '" style="text-decoration:none;"><img src="' + e(img.carte) + '" width="' + LARGEUR + '" alt="' + e(r.nom + (r.fonction ? " · " + r.fonction : "")) + '" style="display:block;width:' + LARGEUR + 'px;height:auto;border:0;"></a></td></tr>' +
        (avisOk(r) && img.bande ? '<tr><td style="padding:0;"><a href="' + e(r.lien_avis) + '" style="text-decoration:none;"><img src="' + e(img.bande) + '" width="' + LARGEUR + '" alt="Laisser un avis Google" style="display:block;width:' + LARGEUR + 'px;height:auto;border:0;"></a></td></tr>' : ""));
    }
    var puce = function (l) {
      return '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:separate;"><tr><td width="20" height="20" align="center" valign="middle" bgcolor="' + TERRE + '" style="width:20px;height:20px;min-width:20px;border-radius:10px;' + DEGRADE +
        'color:#ffffff;font-size:10px;font-weight:700;line-height:20px;mso-line-height-rule:exactly;text-align:center;font-family:Arial,Helvetica,sans-serif;">' + l + "</td></tr></table>";
    };
    var ls = lignes(r).map(function (x, i, t) {
      var bas = i < t.length - 1 ? "6px" : "0";
      return '<tr><td style="padding:0 8px ' + bas + ' 0;vertical-align:middle;">' + puce(x[0]) + '</td><td style="padding:0 0 ' + bas + ' 0;font-size:13px;line-height:20px;vertical-align:middle;"><a href="' + e(x[2]) + '" style="color:' + ENCRE2 + ';text-decoration:none;font-weight:600;">' + e(x[1]) + "</a></td></tr>";
    }).join("");
    var avis = avisOk(r) ? '<tr><td colspan="' + colonnes + '" style="padding:0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;"><tr>' +
      '<td style="background:' + PAPIER + ';border-top:1px solid ' + FILET + ';border-radius:0 0 16px 16px;padding:11px 22px 11px 28px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;"><tr>' +
      '<td style="font-size:12px;line-height:18px;color:' + ENCRE2 + ';vertical-align:middle;"><span style="color:' + OR + ';font-size:14px;letter-spacing:1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</span>&nbsp;Satisfait de mon accompagnement&nbsp;?</td>' +
      '<td align="right" style="vertical-align:middle;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" align="right" style="border-collapse:separate;"><tr><td bgcolor="' + TERRE + '" style="border-radius:16px;' + DEGRADE + 'padding:7px 16px;mso-padding-alt:7px 16px;">' +
      '<a href="' + e(r.lien_avis) + '" style="color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">Laisser un avis Google</a></td></tr></table></td></tr></table></td></tr></table></td></tr>' : "";
    return table('<tr><td style="border:1px solid ' + FILET + ';border-radius:16px;background:#ffffff;box-shadow:0 6px 22px rgba(30,26,23,.08);overflow:hidden;padding:0;">' +
      '<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="border-collapse:collapse;"><tr>' +
      '<td width="6" style="width:6px;min-width:6px;background:' + TERRE + ';background-image:linear-gradient(180deg,' + TERRE + ' 0%,' + TERRE_F + ' 100%);border-radius:16px 0 0 ' + (avisOk(r) ? "0" : "16px") + ';font-size:0;line-height:0;">&nbsp;</td>' +
      '<td width="90" style="width:90px;padding:22px 16px 22px 22px;vertical-align:middle;"><img src="' + e(img.avatar) + '" width="90" height="90" alt="' + e(r.nom) + '" style="display:block;width:90px;height:90px;border:0;outline:none;"></td>' +
      '<td style="padding:20px 12px 20px 4px;vertical-align:middle;"><div style="font-family:\'Bodoni Moda\',\'Bodoni 72\',Didot,Georgia,serif;font-size:23px;line-height:27px;font-weight:500;color:' + ENCRE + ';">' + e(r.nom) + "</div>" +
      (r.fonction ? '<div style="font-size:11px;line-height:16px;font-weight:700;color:' + TERRE + ';letter-spacing:1.6px;text-transform:uppercase;padding-top:4px;padding-bottom:14px;">' + e(r.fonction) + "</div>" : '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>') +
      (ls ? '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">' + ls + "</table>" : "") + "</td>" +
      '<td width="132" style="width:132px;padding:20px 20px 20px 6px;vertical-align:middle;border-left:1px solid ' + FILET + ';"><a href="' + e(siteLien(r.site) || SITE) + '" style="text-decoration:none;"><img src="' + e(img.logo || LOGO) + '" width="96" height="96" alt="' + e(MARQUE.proprietaire || "") + '" style="display:block;width:96px;height:96px;border:0;margin-left:18px;"></a></td>' +
      "</tr>" + avis + "</table></td></tr>");
  }
  function texte(r) { return ["--", r.nom, r.fonction, r.telephone, r.email, siteCourt(r.site), r.phrase].filter(Boolean).join("\n"); }

  // ---------- Dessins (canvas) : la photo dans son anneau, la carte, le bouton d'avis ----------
  function chargerImage(src) {
    return new Promise(function (ok, ko) { var i = new Image(); i.crossOrigin = "anonymous"; i.onload = function () { ok(i); }; i.onerror = function () { ko(new Error("Image illisible")); }; i.src = src; });
  }
  function toile(l, h, k) { var c = document.createElement("canvas"); c.width = Math.round(l * k); c.height = Math.round(h * k); var x = c.getContext("2d"); x.scale(k, k); return { c: c, x: x }; }
  function carrePhoto(img) {   // recadrée au carré (centre), 360 × 360, en JPEG : rien d'autre du fichier n'est gardé
    var t = toile(360, 360, 1), cote = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    t.x.drawImage(img, ((img.naturalWidth || img.width) - cote) / 2, ((img.naturalHeight || img.height) - cote) / 2, cote, cote, 0, 0, 360, 360);
    return t.c;
  }
  function degrade(x, x0, y0, x1, y1) { var g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, TERRE); g.addColorStop(1, TERRE_F); return g; }
  function avatar(photo, nom) {   // 180 × 180 (90 affichés, net sur écran Retina) ; PNG transparent autour de l'anneau
    var t = toile(90, 90, 2), x = t.x;
    x.beginPath(); x.arc(45, 45, 45, 0, Math.PI * 2); x.fillStyle = degrade(x, 0, 0, 90, 90); x.fill();
    x.save(); x.beginPath(); x.arc(45, 45, 41.5, 0, Math.PI * 2); x.clip();
    if (photo) x.drawImage(photo, 3.5, 3.5, 83, 83);
    else { x.fillStyle = PAPIER; x.fillRect(0, 0, 90, 90); x.fillStyle = ENCRE; x.font = "500 32px 'Bodoni Moda', Didot, Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(St.initiales(nom) || "?", 45, 47); }
    x.restore();
    return t.c;
  }
  function rond(x, l, t, w, h, r) { r = [].concat(r); var a = r[0], b = r[1] != null ? r[1] : a, c = r[2] != null ? r[2] : a, d = r[3] != null ? r[3] : a;
    x.beginPath(); x.moveTo(l + a, t); x.lineTo(l + w - b, t); x.arcTo(l + w, t, l + w, t + b, b); x.lineTo(l + w, t + h - c); x.arcTo(l + w, t + h, l + w - c, t + h, c);
    x.lineTo(l + d, t + h); x.arcTo(l, t + h, l, t + h - d, d); x.lineTo(l, t + a); x.arcTo(l, t, l + a, t, a); x.closePath(); }
  function couper(x, s, max) { s = String(s || ""); if (x.measureText(s).width <= max) return s; while (s && x.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; }
  function espace(x, s, px) { var w = 0; for (var i = 0; i < s.length; i++) w += x.measureText(s[i]).width + px; return w; }
  function hauteurCarte(r) { var n = lignes(r).length; return Math.max(134, 40 + 27 + (r.fonction ? 34 : 12) + (n ? n * 20 + (n - 1) * 6 : 0)); }
  // La carte du haut (photo, nom, fonction, coordonnées, logo). bas : coins du bas arrondis (pas de bande d'avis dessous)
  function dessinerCarte(x, oy, r, av, logo, bas) {
    var H = hauteurCarte(r), rayons = [16, 16, bas ? 16 : 0, bas ? 16 : 0];
    x.save(); rond(x, 0.5, oy + 0.5, LARGEUR - 1, H - (bas ? 1 : 0.5), rayons); x.fillStyle = "#ffffff"; x.fill(); x.clip();
    x.fillStyle = degrade(x, 0, oy, 0, oy + H); x.fillRect(0, oy, 6, H);
    x.restore();
    x.save(); rond(x, 0.5, oy + 0.5, LARGEUR - 1, H - (bas ? 1 : 0.5), rayons); x.strokeStyle = FILET; x.lineWidth = 1; x.stroke(); x.restore();
    x.drawImage(av, 28, oy + (H - 90) / 2, 90, 90);
    var n = lignes(r).length, contenu = 27 + (r.fonction ? 34 : 12) + (n ? n * 20 + (n - 1) * 6 : 0), y = oy + (H - contenu) / 2, tx = 136, max = LARGEUR - 132 - tx - 12;
    x.textBaseline = "alphabetic"; x.textAlign = "left";
    x.fillStyle = ENCRE; x.font = "500 23px 'Bodoni Moda', 'Bodoni 72', Didot, Georgia, serif"; x.fillText(couper(x, r.nom, max), tx, y + 21);
    y += 27;
    if (r.fonction) {
      x.fillStyle = TERRE; x.font = "700 11px Geist, Arial, sans-serif"; var f = String(r.fonction).toUpperCase(), cx = tx;
      for (var i = 0; i < f.length && cx < tx + max; i++) { x.fillText(f[i], cx, y + 15); cx += x.measureText(f[i]).width + 1.6; }
      y += 34;
    } else y += 12;
    lignes(r).forEach(function (l) {
      x.beginPath(); x.arc(tx + 10, y + 10, 10, 0, Math.PI * 2); x.fillStyle = degrade(x, tx, y, tx + 20, y + 20); x.fill();
      x.fillStyle = "#ffffff"; x.font = "700 10px Geist, Arial, sans-serif"; x.textAlign = "center"; x.fillText(l[0], tx + 10, y + 13.5);
      x.textAlign = "left"; x.fillStyle = ENCRE2; x.font = "600 13px Geist, Arial, sans-serif"; x.fillText(couper(x, l[1], max - 28), tx + 28, y + 14.5);
      y += 26;
    });
    x.fillStyle = FILET; x.fillRect(LARGEUR - 132, oy + 1, 1, H - 2);
    if (logo) x.drawImage(logo, LARGEUR - 132 + 24, oy + (H - 96) / 2, 96, 96);
    return H;
  }
  function dessinerBande(x, oy) {
    var H = 46;
    x.save(); rond(x, 0.5, oy, LARGEUR - 1, H - 0.5, [0, 0, 16, 16]); x.fillStyle = PAPIER; x.fill(); x.strokeStyle = FILET; x.lineWidth = 1; x.stroke(); x.restore();
    x.fillStyle = FILET; x.fillRect(1, oy, LARGEUR - 2, 1);
    x.textBaseline = "middle"; x.textAlign = "left";
    x.fillStyle = OR; x.font = "14px Arial, sans-serif"; x.fillText("★★★★★", 28, oy + H / 2 + 1);
    var dx = 28 + x.measureText("★★★★★").width + 6;
    x.fillStyle = ENCRE2; x.font = "400 12.5px Geist, Arial, sans-serif"; x.fillText("Satisfait de mon accompagnement ?", dx, oy + H / 2 + 1);
    x.font = "700 12px Geist, Arial, sans-serif"; var bt = "Laisser un avis Google", bw = x.measureText(bt).width + 32, bx = LARGEUR - 22 - bw, by = oy + (H - 30) / 2;
    rond(x, bx, by, bw, 30, 15); x.fillStyle = degrade(x, bx, by, bx + bw, by + 30); x.fill();
    x.fillStyle = "#ffffff"; x.fillText(bt, bx + 16, oy + H / 2 + 1);
    return H;
  }
  function polices() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(["500 23px 'Bodoni Moda'", "700 11px Geist", "600 13px Geist", "400 12.5px Geist"].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  // ---------- Dépôt d'une image (privée, servie par sa clé) ----------
  function deposer(canvas, type) {
    var data = canvas.toDataURL(type, 0.9);
    if (St.X.demo) return Promise.resolve(data);
    return St.X.db.from("signature_images").insert({ type: type, contenu: data.split(",")[1] }).select("cle").single().then(function (x) {
      if (x.error) throw new Error(x.error.message);
      return CFG.url + "/functions/v1/signature?k=" + x.data.cle;
    });
  }

  // ---------- Presse-papiers ----------
  function copier(htmlTexte, texteBrut) {
    // Promesses dans le ClipboardItem : accepté par Safari même quand l'image se prépare encore (geste conservé)
    var h = Promise.resolve(htmlTexte), t = Promise.resolve(texteBrut);
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      return navigator.clipboard.write([new ClipboardItem({ "text/html": h.then(function (v) { return new Blob([v], { type: "text/html" }); }), "text/plain": t.then(function (v) { return new Blob([v], { type: "text/plain" }); }) })])
        .catch(function () { return h.then(copierAncien); });
    }
    return h.then(copierAncien);
  }
  function copierAncien(v) {
    var d = el("div", { contenteditable: "true", style: { position: "fixed", left: "-9999px", top: "0" }, html: v }); document.body.appendChild(d);
    var s = getSelection(), plage = document.createRange(); plage.selectNodeContents(d); s.removeAllRanges(); s.addRange(plage);
    var ok = document.execCommand("copy"); s.removeAllRanges(); d.remove();
    if (!ok) throw new Error("Copie refusée par le navigateur");
  }

  // ---------- La page : Ma photo, Mes informations, Aperçu ----------
  // La carte enregistrée, en HTML pour les messageries (réponse automatique de vacances) ; null si elle n'est pas prête
  St.signatureCarteHtml = function () {
    var r = reglage("signature_carte")[moi()];
    if (!r || !r.avatar_url || (!St.X.demo && /^data:/.test(r.avatar_url))) return null;
    return html(Object.assign(defauts(), r), { avatar: r.avatar_url, logo: LOGO });
  };
  St.carteSignature = function (carte) {
    var tout = reglage("signature_carte"), r = Object.assign(defauts(), tout[moi()] || {});
    var local = { photo: null, avatar: null, logo: null, change: false };   // ce qui n'est pas encore enregistré
    var apercu = el("div", { class: "sig-apercu" }), note = el("p", { class: "aide sig-note", "aria-live": "polite" });
    var rond90 = el("div", { class: "sig-photo" });

    function avatarCourant() { return local.avatar || r.avatar_url || ""; }
    function peindre() {
      apercu.innerHTML = html(r, { avatar: avatarCourant() || "data:image/gif;base64,R0lGODlhAQABAAAAACw=", logo: LOGO });
      rond90.textContent = ""; var a = avatarCourant(); if (a) rond90.appendChild(el("img", { src: a, alt: "" }));
    }
    // L'anneau suit le nom tant qu'il n'y a pas de photo (initiales)
    function refaireAvatar() {
      return polices().then(function () {
        var p = local.photo ? chargerImage(local.photo.toDataURL("image/jpeg", 0.9)) : r.photo_url ? chargerImage(r.photo_url) : Promise.resolve(null);
        return p.catch(function () { return null; }).then(function (img) { local.avatar = avatar(img, r.nom).toDataURL("image/png"); peindre(); });
      });
    }
    var champs = {};
    function saisie(cle, libelle, o) {
      o = o || {}; var i = A.texte(r[cle], { aide: o.aide, type: o.type, attrs: o.attrs });
      i.addEventListener("input", function () { r[cle] = i.value.trim(); local.change = true; if (cle === "nom" && !r.photo_url && !local.photo) refaireAvatar(); else peindre(); });
      champs[cle] = i; return A.champ(libelle, i);
    }
    var caseAvis = el("input", { type: "checkbox", checked: !!r.avis, onchange: function () { r.avis = caseAvis.checked; local.change = true; peindre(); } });

    // Enregistrer : dépose ce qui a changé (photo, anneau), puis garde les réglages de cette personne
    function enregistrer(silence) {
      if (r.avis && r.lien_avis && !/^https:\/\//.test(r.lien_avis)) { champs.lien_avis.focus(); St.signaler("Le lien de l'avis doit commencer par https://", true); return Promise.reject(new Error("lien")); }
      var etapes = Promise.resolve();
      if (local.photo) etapes = etapes.then(function () { return deposer(local.photo, "image/jpeg"); }).then(function (u) { r.photo_url = u; local.photo = null; });
      if (local.avatar || !r.avatar_url) etapes = etapes.then(function () { return local.avatar ? null : refaireAvatar(); })
        .then(function () { return chargerImage(local.avatar); }).then(function (img) { var t = toile(90, 90, 2); t.x.drawImage(img, 0, 0, 90, 90); return deposer(t.c, "image/png"); })
        .then(function (u) { r.avatar_url = u; local.avatar = null; });
      return etapes.then(function () {
        r.image = null;   // la version image sera redessinée
        var v = Object.assign({}, reglage("signature_carte")); v[moi()] = r;
        return St.enregistrer("reglages", { cle: "signature_carte", valeur: v, modifie_le: new Date().toISOString() });
      }).then(function () { local.change = false; peindre(); if (!silence) St.signaler("Signature enregistrée"); return r; });
    }
    function pret() { return local.change || local.photo || local.avatar || !r.avatar_url ? enregistrer(true) : Promise.resolve(r); }

    // La carte en images (version image et JPEG)
    function images(avecBande, ensemble) {
      return polices().then(function () { return Promise.all([chargerImage(r.avatar_url || local.avatar), chargerImage(LOGO).catch(function () { return null; })]); }).then(function (x) {
        var H = hauteurCarte(r), bande = avisOk(r) && avecBande, k = 2;
        if (ensemble) {   // une seule image (JPEG à télécharger) : carte, bande et phrase, sur fond blanc
          var marge = 24, hp = r.phrase ? 30 : 0, t = toile(LARGEUR + marge * 2, H + (bande ? 46 : 0) + hp + marge * 2, k);
          t.x.fillStyle = "#ffffff"; t.x.fillRect(0, 0, LARGEUR + marge * 2, t.c.height); t.x.translate(marge, marge);
          dessinerCarte(t.x, 0, r, x[0], x[1], !bande); if (bande) dessinerBande(t.x, H);
          if (r.phrase) { t.x.fillStyle = "#8B8178"; t.x.font = "italic 400 14px 'Bodoni Moda', Georgia, serif"; t.x.textBaseline = "alphabetic"; t.x.textAlign = "left"; t.x.fillText(r.phrase, 4, H + (bande ? 46 : 0) + 24); }
          return { tout: t.c };
        }
        var c = toile(LARGEUR, H, k); c.x.fillStyle = "#ffffff"; c.x.fillRect(0, 0, LARGEUR, H); dessinerCarte(c.x, 0, r, x[0], x[1], !bande);
        var b = null; if (bande) { b = toile(LARGEUR, 46, k); b.x.fillStyle = "#ffffff"; b.x.fillRect(0, 0, LARGEUR, 46); dessinerBande(b.x, 0); }
        return { carte: c.c, bande: b && b.c };
      });
    }
    function versionImage() {
      var empreinte = JSON.stringify([r.nom, r.fonction, r.telephone, r.email, r.site, avisOk(r), r.avatar_url]);
      if (r.image && r.image.pour === empreinte) return Promise.resolve(r.image);
      return images(true).then(function (x) {
        return Promise.all([deposer(x.carte, "image/jpeg"), x.bande ? deposer(x.bande, "image/jpeg") : null]);
      }).then(function (u) {
        r.image = { pour: empreinte, carte: u[0], bande: u[1] };
        var v = Object.assign({}, reglage("signature_carte")); v[moi()] = r;
        return St.enregistrer("reglages", { cle: "signature_carte", valeur: v, modifie_le: new Date().toISOString() }).then(function () { return r.image; });
      });
    }
    var COLLER = "Copiée. Dans Gmail : Paramètres › Voir tous les paramètres › Général › Signature, collez-la (⌘V), puis « Enregistrer les modifications » en bas de la page.";
    function action(bouton, travail, message) {
      return function () {
        bouton.disabled = true; note.textContent = "Préparation…";
        Promise.resolve().then(travail).then(function () { note.textContent = message; St.signaler(message.split(".")[0]); },
          function (err) { if (err && err.message !== "lien") { note.textContent = ""; St.signaler("Impossible : " + err.message, true); } else note.textContent = ""; })
          .then(function () { bouton.disabled = false; });
      };
    }
    var bCopier = el("button", { type: "button", class: "btn-plein" }, [St.icone("mail"), "Copier pour Gmail"]);
    bCopier.onclick = action(bCopier, function () { var p = pret(); return copier(p.then(function () { return html(r, { avatar: r.avatar_url, logo: LOGO }); }), p.then(function () { return texte(r); })); }, COLLER);
    var bImage = el("button", { type: "button", class: "btn-ligne" }, ["Copier pour Gmail (version image)"]);
    bImage.onclick = action(bImage, function () { var p = pret().then(versionImage); return copier(p.then(function (im) { return html(r, im, "image"); }), p.then(function () { return texte(r); })); }, COLLER);
    var bJpeg = el("button", { type: "button", class: "btn-ligne" }, [St.icone("deposer"), "Télécharger en JPEG"]);
    bJpeg.onclick = action(bJpeg, function () {
      var avant = local.avatar || r.avatar_url ? Promise.resolve() : refaireAvatar();
      return avant.then(function () { return images(true, true); }).then(function (x) {
        return new Promise(function (ok) { x.tout.toBlob(function (b) { var a = el("a", { href: URL.createObjectURL(b), download: "signature-" + (St.initiales(r.nom) || "mail").toLowerCase() + ".jpg" }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); ok(); }, "image/jpeg", 0.92); });
      });
    }, "Téléchargée : la signature en JPEG, 2 fois plus nette que l'écran.");
    var bStudio = el("button", { type: "button", class: "btn-texte" }, [St.icone("valider"), "Utiliser pour les mails écrits dans le studio"]);
    bStudio.onclick = action(bStudio, function () {
      return pret().then(function () {
        var sg = St.signatures(), liste = sg.liste.filter(function (s) { return s.id !== "s-carte-" + moi(); });
        liste.unshift({ id: "s-carte-" + moi(), nom: "Carte avec photo" + (S.moi && S.moi.nom ? " (" + S.moi.nom.split(" ")[0] + ")" : ""), html: html(r, { avatar: r.avatar_url, logo: LOGO }) });
        return St.enregistrer("reglages", { cle: "signatures", valeur: { liste: liste, nouveau: "s-carte-" + moi(), reponse: sg.reponse }, modifie_le: new Date().toISOString() }).then(function () { St.dessiner(false); });
      });
    }, "C'est la signature des nouveaux messages écrits dans le studio (onglet ci-dessous pour changer).");

    // Ma photo
    var fichier = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic", capture: null, hidden: true, onchange: function () {
      var f = fichier.files && fichier.files[0]; fichier.value = ""; if (!f) return;
      if (f.size > 15 * 1024 * 1024) return St.signaler("Photo trop lourde (15 Mo au plus)", true);
      var u = URL.createObjectURL(f);
      chargerImage(u).then(function (img) { URL.revokeObjectURL(u); local.photo = carrePhoto(img); local.change = true; return refaireAvatar(); })
        .then(function () { St.signaler("Photo recadrée : « Enregistrer » pour la garder"); }, function () { St.signaler("Cette image ne se lit pas : essayez un JPEG ou un PNG", true); });
    } });
    var retirer = el("button", { type: "button", class: "btn-texte", text: "Retirer", onclick: function () {
      local.photo = null; r.photo_url = null; r.avatar_url = null; local.change = true; refaireAvatar();
    } });

    var blocPhoto = carte("personnes", "Ma photo", "Elle s'affiche dans votre signature. Sans photo, ce sont vos initiales.", [
      el("div", { class: "sig-photo-ligne" }, [rond90, fichier,
        el("button", { type: "button", class: "btn-plein", onclick: function () { fichier.click(); } }, [St.icone("deposer"), r.photo_url ? "Changer de photo" : "Ajouter ma photo"]),
        retirer, el("p", { class: "aide", text: "Sur téléphone, vous pouvez la prendre directement. Elle est recadrée au carré." })])]);
    var blocInfos = carte("plume", "Mes informations", "Proposées depuis Réglages › Entreprise ; modifiables ici.", [
      saisie("nom", "Prénom NOM"), saisie("fonction", "Fonction", { aide: "Community manager" }), saisie("telephone", "Téléphone", { attrs: { inputmode: "tel", autocomplete: "tel" } }),
      saisie("email", "E-mail", { type: "email" }), saisie("site", "Site ou Instagram", { aide: "https://…" }), saisie("phrase", "Phrase sous la carte", { aide: "Vos réseaux, racontés avec soin." }),
      el("label", { class: "case-ligne" }, [caseAvis, el("span", { text: "Afficher le bouton « Laisser un avis Google »" })]),
      saisie("lien_avis", "Lien de l'avis Google", { aide: "https://g.page/r/…" }),
      el("div", {}, [el("button", { type: "button", class: "btn-plein", onclick: function () { enregistrer().catch(function (err) { if (err.message !== "lien") St.signaler(err.message, true); }); } }, [St.icone("valider"), "Enregistrer"])])]);
    var blocApercu = carte("mail", "Aperçu", "Collez-la dans Gmail, ou utilisez-la pour les mails écrits dans le studio. La version image a le même rendu partout (Outlook, téléphones).", [
      el("div", { class: "sig-cadre" }, [apercu]),
      el("div", { class: "actions-ligne sig-actions" }, [bCopier, bImage, bJpeg]), el("div", {}, [bStudio]), note]);

    peindre();
    if (!r.avatar_url) refaireAvatar();
    return el("div", { class: "pile" }, [blocPhoto, el("div", { class: "sig-deux" }, [blocInfos, blocApercu])]);
  };
})(window.Studio);
