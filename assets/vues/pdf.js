/* PDF des devis et factures (22/11/2026), fabriqués dans le navigateur, sans bibliothèque : polices standard de tout
   lecteur PDF (Helvetica pour le texte, Times pour les titres, encodage WinAnsi : accents, €, guillemets), logo et
   signature en JPEG. St.pdfPiece(table, piece) -> Promise<Blob>. Même contenu que la page imprimable. */
(function (St) {
  "use strict";
  var S = St.S, MARQUE = window.MARQUE || {};
  // Largeurs des caractères 32 à 255 (millièmes de la taille), WinAnsi ; Helvetica = Arial, Times = Times New Roman
  var HEL = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,376,556,1000,222,556,333,1000,556,556,333,1000,667,333,1000,1000,611,1000,1000,222,222,333,333,350,556,1000,333,1000,500,333,944,1000,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,0,737,552,400,549,333,333,333,576,537,333,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,549,611,556,556,556,556,500,556,500];
  var HELB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,376,556,1000,278,556,500,1000,556,556,333,1000,667,333,1000,1000,611,1000,1000,278,278,500,500,350,556,1000,333,1000,556,333,944,1000,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,0,737,552,400,549,333,333,333,576,556,333,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,549,611,611,611,611,611,556,611,556];
  var TIM = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,501,500,1000,333,500,444,1000,500,500,333,1000,556,333,889,1000,611,1000,1000,333,333,444,444,350,500,1000,333,980,389,333,722,1000,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,0,760,500,400,549,300,300,333,576,453,333,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,549,500,500,500,500,500,500,500,500];
  var POLICES = { r: { n: 1, l: HEL }, b: { n: 2, l: HELB }, t: { n: 3, l: TIM }, ti: { n: 4, l: TIM } };
  var WIN = { "€": 128, "‚": 130, "„": 132, "…": 133, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146,
    "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159,
    " ": 160, " ": 32, " ": 32, "−": 45, "‑": 45 };
  function octets(s) {
    var out = [];
    Array.from(String(s == null ? "" : s)).forEach(function (ch) {
      var c = ch.charCodeAt(0);
      if (WIN[ch] != null) out.push(WIN[ch]);
      else if (c >= 32 && c <= 255 && !(c >= 127 && c <= 159)) out.push(c);
      else if (c === 9 || c === 10 || c === 13) out.push(32);
      else { var n = ch.normalize("NFD").charCodeAt(0); out.push(n >= 32 && n < 127 ? n : 63); }
    });
    return out;
  }
  function largeur(s, p, t, esp) { var l = POLICES[p || "r"].l, o = octets(s); return o.reduce(function (a, b) { return a + (l[b - 32] || 500); }, 0) * t / 1000 + (esp || 0) * Math.max(0, o.length - 1); }
  function hex(s) { return "<" + octets(s).map(function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("") + ">"; }
  function couleur(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return (parseInt(h.substr(i, 2), 16) / 255).toFixed(3); }).join(" "); }
  function n(x) { return (Math.round(x * 100) / 100).toString(); }
  // Coupe un texte en lignes qui tiennent dans la largeur donnée (retours à la ligne gardés)
  function couper(s, p, t, max) {
    var lignes = [];
    String(s == null ? "" : s).split(/\n/).forEach(function (para) {
      var mots = para.split(/ +/), l = "";
      mots.forEach(function (m) {
        var essai = l ? l + " " + m : m;
        if (largeur(essai, p, t) <= max || !l) { l = essai; while (largeur(l, p, t) > max && l.length > 1) { var i = l.length - 1; while (i > 1 && largeur(l.slice(0, i), p, t) > max) i--; lignes.push(l.slice(0, i)); l = l.slice(i); } }
        else { lignes.push(l); l = m; }
      });
      lignes.push(l);
    });
    return lignes;
  }

  // ---------- Le document : pages, texte, traits, images ----------
  var L = 595.28, H = 841.89;
  function Doc() { this.pages = []; this.images = []; this.page(); }
  Doc.prototype.page = function () { this.ops = []; this.pages.push(this.ops); return this; };
  Doc.prototype.texte = function (x, y, s, o) {
    o = o || {}; var p = o.p || "r", t = o.t || 10, w = largeur(s, p, t, o.esp);
    if (o.a === "droite") x -= w; else if (o.a === "centre") x -= w / 2;
    this.ops.push("BT /F" + POLICES[p].n + " " + t + " Tf " + n(o.esp || 0) + " Tc " + couleur(o.c || "#1E1A17") + " rg " + n(x) + " " + n(y) + " Td " + hex(s) + " Tj ET");
    return w;
  };
  // Petites capitales espacées : les étiquettes (DATE, FACTURÉ À…)
  Doc.prototype.etiquette = function (x, y, s, o) { return this.texte(x, y, String(s).toUpperCase(), Object.assign({ p: "b", t: 6.8, esp: 1.1, c: "#8B8178" }, o || {})); };
  // Rectangle aux coins arrondis, plein
  Doc.prototype.arrondi = function (x, y, w, h, r, c) {
    var k = r * .5523;
    this.ops.push(couleur(c) + " rg " + [n(x + r), n(y), "m", n(x + w - r), n(y), "l", n(x + w - r + k), n(y), n(x + w), n(y + r - k), n(x + w), n(y + r), "c", n(x + w), n(y + h - r), "l",
      n(x + w), n(y + h - r + k), n(x + w - r + k), n(y + h), n(x + w - r), n(y + h), "c", n(x + r), n(y + h), "l", n(x + r - k), n(y + h), n(x), n(y + h - r + k), n(x), n(y + h - r), "c",
      n(x), n(y + r), "l", n(x), n(y + r - k), n(x + r - k), n(y), n(x + r), n(y), "c", "f"].join(" "));
  };
  Doc.prototype.rect = function (x, y, w, h, c) { this.ops.push(couleur(c) + " rg " + n(x) + " " + n(y) + " " + n(w) + " " + n(h) + " re f"); };
  Doc.prototype.cadre = function (x, y, w, h, c, ep) { this.ops.push(couleur(c) + " RG " + (ep || .8) + " w " + n(x) + " " + n(y) + " " + n(w) + " " + n(h) + " re S"); };
  Doc.prototype.trait = function (x1, y1, x2, y2, c, ep) { this.ops.push(couleur(c) + " RG " + (ep || .6) + " w " + n(x1) + " " + n(y1) + " m " + n(x2) + " " + n(y2) + " l S"); };
  Doc.prototype.image = function (img, x, y, w, h) {
    if (!img) return; var i = this.images.indexOf(img); if (i < 0) { this.images.push(img); i = this.images.length - 1; }
    this.ops.push("q " + n(w) + " 0 0 " + n(h) + " " + n(x) + " " + n(y) + " cm /Im" + (i + 1) + " Do Q");
  };
  Doc.prototype.filigrane = function (s) {
    var a = Math.PI / 9, c = Math.cos(a).toFixed(4), si = Math.sin(a).toFixed(4), t = 84, w = largeur(s, "b", t);
    this.ops.unshift("BT /F2 " + t + " Tf " + couleur("#F3E3DC") + " rg " + c + " " + si + " " + (-si) + " " + c + " " + n(L / 2 - w / 2 * c) + " " + n(H / 2 - w / 2 * si) + " Tm " + hex(s) + " Tj ET");
  };
  Doc.prototype.blob = function (titre) {
    var morceaux = [], taille = 0, pos = [];
    var ajoute = function (x) { if (typeof x === "string") { var b = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) b[i] = x.charCodeAt(i) & 255; x = b; } morceaux.push(x); taille += x.length; };
    var objets = [];   // chaque objet : [en-tête, flux binaire facultatif]
    var nPolices = 4, premierImage = 3 + nPolices, premierePage = premierImage + this.images.length;
    objets.push(["<< /Type /Catalog /Pages 2 0 R >>"]);
    objets.push(["<< /Type /Pages /Count " + this.pages.length + " /Kids [" + this.pages.map(function (p, i) { return (premierePage + i * 2) + " 0 R"; }).join(" ") + "] >>"]);
    ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Italic"].forEach(function (f) { objets.push(["<< /Type /Font /Subtype /Type1 /BaseFont /" + f + " /Encoding /WinAnsiEncoding >>"]); });
    this.images.forEach(function (im) { objets.push(["<< /Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + im.octets.length + " >>", im.octets]); });
    var ressources = "<< /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> /XObject << " + this.images.map(function (im, i) { return "/Im" + (i + 1) + " " + (premierImage + i) + " 0 R"; }).join(" ") + " >> >>";
    this.pages.forEach(function (ops, i) {
      var flux = ops.join("\n");
      objets.push(["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + L + " " + H + "] /Resources " + ressources + " /Contents " + (premierePage + i * 2 + 1) + " 0 R >>"]);
      objets.push(["<< /Length " + flux.length + " >>", flux]);
    });
    objets.push(["<< /Title " + hex(titre || "") + " /Producer (Studio) /CreationDate (D:" + new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14) + ") >>"]);
    ajoute("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    objets.forEach(function (o, i) {
      pos.push(taille); ajoute((i + 1) + " 0 obj\n" + o[0] + "\n");
      if (o[1] != null) { ajoute("stream\n"); ajoute(o[1]); ajoute("\nendstream\n"); }
      ajoute("endobj\n");
    });
    var xref = taille;
    ajoute("xref\n0 " + (objets.length + 1) + "\n0000000000 65535 f \n" + pos.map(function (p) { return ("0000000000" + p).slice(-10) + " 00000 n \n"; }).join(""));
    ajoute("trailer\n<< /Size " + (objets.length + 1) + " /Root 1 0 R /Info " + objets.length + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(morceaux, { type: "application/pdf" });
  };

  // Une image (adresse ou data:) en JPEG sur fond blanc, pour le PDF
  function jpeg(src, max) {
    if (!src) return Promise.resolve(null);
    return new Promise(function (ok) {
      var i = new Image(); i.crossOrigin = "anonymous";
      i.onload = function () {
        var r = Math.min(1, (max || 600) / Math.max(i.naturalWidth, i.naturalHeight)), w = Math.max(1, Math.round(i.naturalWidth * r)), h = Math.max(1, Math.round(i.naturalHeight * r));
        var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(i, 0, 0, w, h);
        try {
          var d = atob(c.toDataURL("image/jpeg", .92).split(",")[1]), b = new Uint8Array(d.length); for (var k = 0; k < d.length; k++) b[k] = d.charCodeAt(k);
          ok({ w: w, h: h, octets: b });
        } catch (e) { ok(null); }
      };
      i.onerror = function () { ok(null); };
      i.src = src;
    });
  }

  function date(d) { return d ? St.fmt(String(d).length === 10 ? d + "T12:00:00" : d, { day: "numeric", month: "long", year: "numeric" }) : ""; }
  function nomFichier(table, f, dest) {
    var t = table === "factures" ? "Facture" : "Devis";
    return (t + (f.numero ? " " + f.numero : f.statut === "brouillon" ? " brouillon" : "") + (dest && dest.nom ? " - " + dest.nom : "")).replace(/[\\/:*?"<>|]+/g, " ").trim() + ".pdf";
  }
  function destinataire(f) {
    var e = f.espace_id && St.espace(f.espace_id), pr = e && St.prive ? (St.prive(e.id) || {}) : {}, pp = f.prospect_id && (S.prospects || []).filter(function (p) { return p.id === f.prospect_id; })[0];
    return e ? { nom: pr.raison_sociale || e.nom, adresse: pr.adresse, siret: pr.siret, tva: pr.tva_intra, email: pr.email_facturation } : pp ? { nom: pp.nom, adresse: "", email: pp.email } : {};
  }
  St.nomPdfPiece = function (table, f) { return nomFichier(table, f, destinataire(f)); };

  // ======================================================================
  // La facture ou le devis
  // ======================================================================
  St.pdfPiece = function (table, f) {
    var A = St.aides, fact = table === "factures", ent = A.entreprise(), euros = A.euros, dest = destinataire(f);
    var sg = !fact && (S.signaturesDevis || []).filter(function (x) { return x.devis_id === f.id; })[0];
    var brouillon = f.statut === "brouillon", genre = fact ? "Facture" : "Devis", titre = genre + (f.numero ? " n° " + f.numero : brouillon ? " (brouillon)" : "");
    var logo = new URL("assets/marque/signature-lr.png", location.href).href;
    return Promise.all([jpeg(logo, 220), sg && sg.signature ? jpeg(sg.signature, 700) : null]).then(function (imgs) {
      var doc = new Doc(), G = 50, D = L - 50, LG = D - G;
      var ENCRE = "#1E1A17", GRIS = "#5F574F", PALE = "#8B8178", TERRE = "#A9553A", FILET = "#E7E0D5", CREME = "#F4EFE7", PAPIER = "#FBF8F3";
      var lignes = f.lignes || [], detail = lignes.some(function (l) { return +l.quantite !== 1; });
      var siren = String(ent.siret || "").replace(/\s/g, "").slice(0, 9);
      var reglement = String(ent.conditions || "À réception").trim(), court = reglement.length <= 22 && reglement.indexOf("\n") < 0;
      // Filet terre cuite en haut de chaque page
      var haut = function () { doc.rect(0, H - 5, L, 5, TERRE); };
      haut();
      var y = H - 52;
      // En-tête : logo, nom commercial, activité ; à droite le genre et le numéro
      if (imgs[0]) doc.image(imgs[0], G, y - 44, 44, 44);
      var xn = imgs[0] ? G + 58 : G;
      doc.texte(xn, y - 19, ent.nom || MARQUE.proprietaire || "", { p: "t", t: 22 });
      if (ent.activite) doc.etiquette(xn, y - 35, ent.activite, { c: TERRE, t: 7, esp: 1.4 });
      doc.etiquette(D, y - 8, brouillon ? genre + " · brouillon" : genre, { a: "droite", c: TERRE, t: 7.5, esp: 1.6 });
      doc.texte(D, y - 38, f.numero ? "N° " + f.numero : "—", { p: "t", t: 30, a: "droite" });
      y -= 72;
      // Bandeau des repères : date, échéance ou validité, référence, montant
      var dt = fact ? f.date_facture : f.date_devis;
      var reperes = [["Date d'émission", dt ? date(dt) : "—"],
        fact ? (f.echeance && !court ? ["Échéance", date(f.echeance)] : ["Règlement", court ? reglement : f.echeance ? date(f.echeance) : "—"]) : ["Valable jusqu'au", f.valable_jusque ? date(f.valable_jusque) : "—"],
        f.reference ? ["Référence", f.reference] : f.periode ? ["Période", f.periode] : null,
        [fact ? "Montant TTC" : "Total TTC", euros(f.total_ttc)]].filter(Boolean);
      var bh = 50, bw = LG / reperes.length;
      doc.arrondi(G, y - bh, LG, bh, 10, CREME);
      reperes.forEach(function (r, i) {
        var x = G + 16 + i * bw, der = i === reperes.length - 1;
        if (i) doc.trait(G + i * bw, y - bh + 12, G + i * bw, y - 12, "#E0D6C8");
        doc.etiquette(x, y - 19, r[0]);
        var t = der ? 12 : 10; while (t > 7 && largeur(r[1], der ? "b" : "r", t) > bw - 26) t -= .5;
        doc.texte(x, y - 36, couper(r[1], der ? "b" : "r", t, bw - 26)[0], { p: der ? "b" : "r", t: t, c: der ? TERRE : ENCRE });
      });
      y -= bh + 30;
      // De / Facturé à
      var col2 = G + LG / 2 + 10, wcol = LG / 2 - 20;
      var bloc = function (x, yy, etiq, nom, lignesB) {
        doc.etiquette(x, yy, etiq); yy -= 17;
        couper(nom || "", "b", 11, wcol).forEach(function (l) { doc.texte(x, yy, l, { p: "b", t: 11 }); yy -= 14; });
        yy -= 1;
        lignesB.forEach(function (l) { couper(l, "r", 9, wcol).forEach(function (x2) { doc.texte(x, yy, x2, { t: 9, c: GRIS }); yy -= 12.5; }); });
        return yy;
      };
      var de = [].concat(ent.nom_legal && ent.nom ? [ent.nom] : [], String(ent.adresse || "").split(/\n/).filter(Boolean),
        ent.siret ? ["SIRET " + ent.siret] : [], ent.tva_intra ? ["TVA intracommunautaire " + ent.tva_intra] : [], [ent.email, ent.telephone].filter(Boolean).length ? [[ent.email, ent.telephone].filter(Boolean).join(" · ")] : []);
      var pour = [].concat(String(dest.adresse || "").split(/\n/).filter(Boolean), dest.siret ? ["SIRET " + dest.siret] : [], dest.tva ? ["TVA intracommunautaire " + dest.tva] : [], dest.email ? [dest.email] : []);
      var y1 = bloc(G, y, "De", ent.nom_legal || ent.nom || MARQUE.proprietaire, de);
      var y2 = bloc(col2, y, fact ? "Facturé à" : "Pour", dest.nom, pour);
      doc.rect(col2 - 12, y2 + 6, 1.6, y - y2 + 2, TERRE);
      y = Math.min(y1, y2) - 22;
      // Objet, en italique
      var objet = (f.objet || "") + (f.periode && !reperes.some(function (r) { return r[0] === "Période"; }) ? " · " + f.periode : "");
      if (objet) { doc.etiquette(G, y, "Objet"); y -= 18; couper(objet, "ti", 14, LG).forEach(function (l) { doc.texte(G, y, l, { p: "ti", t: 14 }); y -= 17; }); y -= 10; }
      // Tableau
      var cols = detail ? [["Qté", 330], ["Prix HT", 418], ["TVA", 470], ["Montant HT", D]] : [["TVA", 430], ["Montant HT", D]];
      var largDes = (detail ? 290 : 350);
      var entete = function () {
        doc.etiquette(G, y, "Désignation");
        cols.forEach(function (c) { doc.etiquette(c[1], y, c[0], { a: "droite" }); });
        y -= 9; doc.rect(G, y, LG, 1, ENCRE); y -= 19;
      };
      var suite = function () { doc.page(); haut(); y = H - 60; };
      entete();
      lignes.forEach(function (l) {
        var des = couper(l.libelle || "", "r", 10, largDes), h = des.length * 13.5 + 14;
        if (y - h < 110) { suite(); entete(); }
        var yl = y;
        des.forEach(function (x, i) { doc.texte(G, yl, x, { t: 10, c: i ? GRIS : ENCRE }); yl -= 13.5; });
        var montant = (+l.quantite || 0) * (+l.prix_ht || 0), v = detail ? [String(l.quantite == null ? "" : l.quantite).replace(".", ","), euros(l.prix_ht)] : [];
        v = v.concat([String(l.tva == null ? "" : l.tva).replace(".", ",") + " %", euros(montant)]);
        cols.forEach(function (c, i) { var der = i === cols.length - 1; doc.texte(c[1], y, v[i], { t: 10, p: der ? "b" : "r", c: der ? ENCRE : GRIS, a: "droite" }); });
        y -= h; doc.trait(G, y + 10, D, y + 10, FILET);
      });
      // Totaux (TVA par taux) et règlement
      var taux = {}; lignes.forEach(function (l) { var t = +l.tva || 0; taux[t] = (taux[t] || 0) + (+l.quantite || 0) * (+l.prix_ht || 0) * t / 100; });
      var lt = [["Total HT", euros(f.total_ht)]].concat(Object.keys(taux).sort().map(function (t) { return ["TVA " + String(t).replace(".", ",") + " %", euros(taux[t])]; }));
      if (y - (lt.length * 18 + 60) < 110) suite();
      y -= 6;
      var tx = G + LG * .55, yt = y;
      lt.forEach(function (t) { doc.texte(tx, yt, t[0], { t: 10, c: GRIS }); doc.texte(D, yt, t[1], { t: 10, a: "droite" }); yt -= 18; });
      yt -= 14;
      doc.arrondi(tx - 14, yt - 13, D - tx + 14, 36, 9, ENCRE);
      doc.texte(tx, yt, "Total TTC", { p: "b", t: 11, c: "#FBF8F3" }); doc.texte(D - 14, yt - 1, euros(f.total_ttc), { p: "b", t: 15, c: "#FFFFFF", a: "droite" });
      // À gauche : règlement, IBAN
      var yg = y;
      if (!(fact && court)) {
        doc.etiquette(G, yg, fact ? "Règlement" : "Conditions"); yg -= 16;
        couper(reglement, "r", 9.5, LG * .45).forEach(function (l) { doc.texte(G, yg, l, { t: 9.5 }); yg -= 13; });
        yg -= 4;
      }
      if (ent.iban_affiche) {
        doc.etiquette(G, yg, "IBAN"); yg -= 14; doc.texte(G, yg, ent.iban_affiche, { t: 9.5 }); yg -= 13;
      }
      y = Math.min(yt - 14, yg) - 30;
      // Devis : bon pour accord ou signature électronique et sa preuve
      if (!fact) {
        if (sg) {
          var preuve = "Signature électronique" + (sg.email_verifie ? " avec code à usage unique envoyé à " + sg.email_verifie + (sg.code_verifie_le ? " et saisi le " + date(sg.code_verifie_le) + " à " + St.hm(sg.code_verifie_le) : "") : " simple") +
            (sg.ip ? ", adresse IP " + sg.ip : "") + ". Empreinte SHA-256 du devis signé : " + (sg.empreinte || "");
          var lp = couper(preuve, "r", 7.5, LG - 32), ih = imgs[1] ? Math.min(64, 220 * imgs[1].h / imgs[1].w) : 0, iw = imgs[1] ? ih * imgs[1].w / imgs[1].h : 0;
          var hb = 40 + ih + 8 + lp.length * 10 + 10;
          if (y - hb < 90) suite();
          doc.arrondi(G, y - hb, LG, hb, 10, PAPIER); doc.cadre(G, y - hb, LG, hb, FILET, .6);
          var ys = y - 20;
          doc.etiquette(G + 16, ys, "Bon pour accord", { c: TERRE });
          doc.texte(G + 16, ys - 15, "Signé électroniquement par " + (sg.nom_signataire || "") + " le " + date(sg.signe_le) + " à " + St.hm(sg.signe_le), { t: 9.5 });
          ys -= 22;
          if (imgs[1]) { doc.image(imgs[1], G + 16, ys - ih, iw, ih); ys -= ih + 8; }
          lp.forEach(function (l) { ys -= 10; doc.texte(G + 16, ys, l, { t: 7.5, c: PALE }); });
          y -= hb + 20;
        } else {
          if (y - 90 < 90) suite();
          doc.arrondi(D - 250, y - 86, 250, 86, 10, PAPIER); doc.cadre(D - 250, y - 86, 250, 86, FILET, .6);
          doc.etiquette(D - 234, y - 20, "Bon pour accord", { c: TERRE });
          doc.texte(D - 234, y - 34, "Date et signature du client", { t: 8.5, c: PALE });
          y -= 106;
        }
      }
      // Remerciement et mentions légales
      var mentions = fact ? ["En cas de retard de paiement, des pénalités seront exigibles au taux de 3 fois le taux d'intérêt légal.",
        "Une indemnité forfaitaire de 40 € pour frais de recouvrement sera également due en cas de retard de paiement.", "Pas d'escompte pour paiement anticipé."] : [];
      var lm = []; mentions.forEach(function (m) { lm = lm.concat(couper(m, "r", 8, LG)); });
      if (y - 30 - lm.length * 11 < 70) suite();
      doc.texte(G, y, fact ? "Merci pour votre confiance." : "Au plaisir de travailler ensemble.", { p: "ti", t: 13, c: TERRE }); y -= 20;
      lm.forEach(function (l) { doc.texte(G, y, l, { t: 8, c: PALE }); y -= 11; });
      // Pied de chaque page (mentions de l'entreprise, page n sur N) et filigrane des brouillons
      var pied1 = [ent.nom_legal || ent.nom, siren.length === 9 ? "SIREN " + siren : null, ent.naf ? "NAF " + ent.naf : null].filter(Boolean).join(" · ");
      var pied2 = ent.tva_intra ? "TVA intracommunautaire " + ent.tva_intra : "";
      doc.pages.forEach(function (ops, i) {
        doc.ops = ops;
        doc.trait(G, 50, D, 50, FILET);
        doc.texte(L / 2, 35, pied1, { t: 7.5, c: PALE, a: "centre" });
        if (pied2) doc.texte(L / 2, 25, pied2, { t: 7.5, c: PALE, a: "centre" });
        doc.texte(D, 35, (i + 1) + "/" + doc.pages.length, { t: 7.5, c: PALE, a: "droite" });
        if (brouillon) doc.filigrane("BROUILLON");
      });
      return doc.blob(titre + (dest.nom ? " · " + dest.nom : ""));
    });
  };
  // Ouvrir le PDF dans un nouvel onglet (ou le télécharger si le navigateur bloque l'onglet)
  St.ouvrirPdfPiece = function (table, f) {
    var w = window.open("", "_blank"), nom = St.nomPdfPiece(table, f);
    St.pdfPiece(table, f).then(function (b) {
      var url = URL.createObjectURL(new File([b], nom, { type: "application/pdf" }));
      if (w) w.location = url; else { var a = document.createElement("a"); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 300000);
    }).catch(function (e) { if (w) w.close(); St.signaler("PDF impossible : " + e.message, true); });
  };
  St.telechargerPdfPiece = function (table, f) {
    var nom = St.nomPdfPiece(table, f);
    St.pdfPiece(table, f).then(function (b) {
      var url = URL.createObjectURL(b), a = document.createElement("a"); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }).catch(function (e) { St.signaler("PDF impossible : " + e.message, true); });
  };
})(window.Studio);
