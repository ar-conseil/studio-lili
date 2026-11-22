/* Studio Lili — le noyau : état, données (Supabase ou démonstration), coquille, routeur, raccourcis, temps réel.
   Les pages sont dans assets/vues/*.js et s'inscrivent dans Studio.V. L'entrée (connexion, code) est dans assets/app.js,
   qui appelle Studio.ouvrir() une fois le code saisi.
   Adresses : #  #calendrier  #publications  #mediatheque  #p/<id>  #valider (client)  #<client>  #<client>/<rubrique> */
window.Studio = (function () {
  "use strict";
  var MARQUE = window.MARQUE || {};
  var S = {
    moi: null, role: "proprietaire", espaces: [], prives: [], comptes: [], membres: [], personnes: [], medias: [], publications: [],
    pubMedias: [], commentaires: [], versions: [], operations: [], tempsForts: [], taches: [], journal: [], notes: [], notifications: [], boitesMail: [],
    briefs: [], messages: [], rapports: [], signaturesDevis: [], mailsNonLus: 0, alertesSecurite: [], veille: [], partenaires: [], temps: [], devis: [], factures: [], prospects: [], reglages: [], briefsJour: [], rdv: [],
    urls: {}, route: { nom: "", param: "", rubrique: "", query: {} }, voirCommeEspace: null
  };
  var X = { db: null, demo: false, quitter: null, verrouiller: null, coquille: null, page: null, demarre: false };
  var V = {};   // pages : V.nom = function (route) -> élément

  // ======================================================================
  // Petites aides
  // ======================================================================
  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.keys(v).forEach(function (p) { n.style.setProperty(p, v[p]); });
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (enfants || []).forEach(function (e) { if (e != null && e !== false) n.appendChild(typeof e === "string" || typeof e === "number" ? document.createTextNode(String(e)) : e); });
    return n;
  }
  var JOUR = 86400000;
  function debutJour(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function ajouterJours(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function lundi(d) { var x = debutJour(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { d = new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hm(d) { d = new Date(d); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function memeJour(a, b) { return iso(a) === iso(b); }
  function fmt(d, o) { return new Intl.DateTimeFormat("fr-FR", o).format(new Date(d)); }
  function joursEntre(a, b) { return Math.round((debutJour(b) - debutJour(a)) / JOUR); }
  function quand(d) {
    var j = joursEntre(new Date(), d);
    if (j === 0) return "aujourd'hui"; if (j === 1) return "demain"; if (j === -1) return "hier";
    if (j > 1 && j < 7) return fmt(d, { weekday: "long" });
    return fmt(d, { day: "numeric", month: "short" });
  }
  function ilya(d) {
    var m = Math.round((Date.now() - new Date(d)) / 60000);
    if (m < 2) return "à l'instant"; if (m < 60) return "il y a " + m + " min";
    var h = Math.round(m / 60); if (h < 24) return "il y a " + h + " h";
    var j = Math.round(h / 24); return j === 1 ? "hier" : "il y a " + j + " jours";
  }
  // Couleur de marque lisible sous un texte blanc (contraste AA ≥ 4,5) : foncée par petits pas si elle est trop claire
  var cacheFonce = {};
  function foncee(hex) {
    if (!hex || hex.charAt(0) !== "#" || hex.length !== 7) return hex;
    if (cacheFonce[hex]) return cacheFonce[hex];
    var c = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
    var lum = function (v) { return v.map(function (x) { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }).reduce(function (t, x, i) { return t + x * [.2126, .7152, .0722][i]; }, 0); };
    for (var k = 0; k < 30 && 1.05 / (lum(c) + .05) < 4.5; k++) c = c.map(function (x) { return Math.round(x * .92); });
    return (cacheFonce[hex] = "#" + c.map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""));
  }
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : "x".repeat(32).replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }).replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-4$3-$4-").slice(0, 36); }
  function initiales(nom) { return String(nom || "?").replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(function (m) { return m[0]; }).join("").toUpperCase(); }
  // Retour arrière sans jamais quitter le site (arrivée directe par le lien d'un e-mail : on va à l'accueil)
  var pagesVues = 0;
  window.addEventListener("hashchange", function () { pagesVues++; });
  function revenir(defaut) { if (pagesVues > 0) history.back(); else location.hash = defaut || "#"; }
  function enSaisie() { var a = document.activeElement; return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)); }

  var ICONES = {
    aujourdhui: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
    calendrier: '<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4"/>',
    publications: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5 10.5l2-2.5 1.7 2 1.8-2 1.5 2.5"/>',
    mediatheque: '<path d="M2 4.5h4l1.2 1.5H14v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>',
    valider: '<path d="m3.5 8.5 3 3 6-7"/>',
    plus: '<path d="M8 3v10M3 8h10"/>', colonnes: '<rect x="2" y="2.5" width="3.2" height="11" rx="1"/><rect x="6.4" y="2.5" width="3.2" height="7" rx="1"/><rect x="10.8" y="2.5" width="3.2" height="9" rx="1"/>', agrandir: '<path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/>', recherche: '<circle cx="7" cy="7" r="4.5"/><path d="m10.4 10.4 3.6 3.6"/>', haut: '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>', bas: '<path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/>', fleche: '<path d="M6 3.5 10.5 8 6 12.5"/>', retour: '<path d="M10 3.5 5.5 8 10 12.5"/>',
    fermer: '<path d="M4 4l8 8M12 4l-8 8"/>', menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
    taches: '<rect x="2.5" y="2.5" width="11" height="11" rx="3"/><path d="m5.5 8 1.8 1.8L10.8 6"/>',
    commentaire: '<path d="M13.5 7.5a5.5 5.5 0 0 1-8 4.9L2.5 13.5l1-2.9a5.5 5.5 0 1 1 10-3.1z"/>',
    deposer: '<path d="M8 11V3M5 6l3-3 3 3M3 12.5h10"/>', oeil: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
    cadenas: '<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>', sortir: '<path d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11 13.5 8l-3-3M13.5 8H6"/>',
    corbeille: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9"/>', lien: '<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.6.6M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.6-.6"/>',
    installer: '<path d="M8 2.5v7.5M5 7l3 3 3-3M3 12.5h10"/>',
    mail: '<rect x="1.5" y="3" width="13" height="10" rx="2"/><path d="m2.5 4.5 5.5 4 5.5-4"/>',
    etincelle: '<path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8 6.7 6.7z"/>',
    brief: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5"/>',
    rapports: '<path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5"/>',
    euro: '<path d="M11.5 4a4.5 4.5 0 1 0 0 8M3 7h6M3 9.2h6"/>',
    personnes: '<circle cx="6" cy="5.5" r="2.3"/><path d="M1.8 13.5a4.2 4.2 0 0 1 8.4 0M10.8 3.4a2.3 2.3 0 0 1 0 4.4M12 9.6a4.2 4.2 0 0 1 2.2 3.9"/>',
    prospects: '<path d="M2 3h12l-4.5 5.5V13l-3 1.2V8.5z"/>',
    reglages: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    micro: '<rect x="6" y="1.8" width="4" height="7.5" rx="2"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.2"/>',
    imprimer: '<path d="M4.5 6V2h7v4M4.5 11.5H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1.5"/><path d="M4.5 9.5h7V14h-7z"/>',
    bouclier: '<path d="M8 1.8 13 3.6v4.1c0 3.2-2.1 5.6-5 6.5-2.9-.9-5-3.3-5-6.5V3.6z"/><path d="m5.8 8 1.6 1.6 2.9-3"/>',
    etoile: '<path d="M8 1.9l1.85 3.9 4.25.5-3.15 2.95.85 4.2L8 11.35 4.2 13.45l.85-4.2L1.9 6.3l4.25-.5z"/>',
    trombone: '<path d="M10.5 4.5 5.3 9.7a1.4 1.4 0 0 0 2 2l5.4-5.4a2.8 2.8 0 0 0-4-4L3.3 7.7a4.2 4.2 0 0 0 6 6l4.2-4.2"/>',
    archiver: '<rect x="2" y="2.5" width="12" height="3" rx="1"/><path d="M3 5.5v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7M6.5 8.5h3"/>',
    rafraichir: '<path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3.2h-3.2"/>',
    etiquette: '<path d="M2.5 2.5h5.3l6 6-5.3 5.3-6-6z"/><circle cx="5.3" cy="5.3" r="1"/>',
    horloge: '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.3 1.6"/>',
    lu: '<path d="M2 6.5 8 2.5l6 4V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/><path d="m2.5 7 5.5 3.6L13.5 7"/>',
    soleil: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
    plume: '<path d="M13.5 2.5c-4 0-8 3.5-9 8.5l-1 2.5 2.5-1c5-1 8.5-5 8.5-9z"/><path d="M4.5 11.5 9 7"/>',
    envoyer: '<path d="M14 2 7 9M14 2 9.5 14 7 9 2 6.5z"/>',
    gras: '<path d="M4.5 2.5h4.2a2.6 2.6 0 0 1 0 5.2H4.5zM4.5 7.7h5a2.9 2.9 0 0 1 0 5.8h-5z"/>',
    italique: '<path d="M7 2.5h5M4 13.5h5M10 2.5 6.5 13.5"/>',
    souligne: '<path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 14h9"/>',
    liste: '<path d="M6 4h7.5M6 8h7.5M6 12h7.5"/><circle cx="3" cy="4" r=".6"/><circle cx="3" cy="8" r=".6"/><circle cx="3" cy="12" r=".6"/>',
    citation: '<path d="M3 10.5c0-3 1-5 3.5-6M9 10.5c0-3 1-5 3.5-6"/><circle cx="4.3" cy="11" r="1.4"/><circle cx="10.3" cy="11" r="1.4"/>',
    cloche: '<path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1 1.5H3zM6.5 14.5a1.6 1.6 0 0 0 3 0"/>'
  };
  function icone(nom, classe) { var s = el("span", { class: "ic " + (classe || ""), "aria-hidden": "true" }); s.innerHTML = '<svg viewBox="0 0 16 16">' + (ICONES[nom] || "") + "</svg>"; return s; }

  var STATUTS = {
    "idee": "Idée", "en-creation": "En création", "a-valider": "À valider", "modifs-demandees": "Modifs demandées",
    "valide": "Validé", "programme": "Programmé", "publie": "Publié"
  };
  var ORDRE_STATUTS = ["idee", "en-creation", "a-valider", "modifs-demandees", "valide", "programme", "publie"];
  var RESEAUX = {
    instagram: { court: "IG", nom: "Instagram" }, facebook: { court: "FB", nom: "Facebook" }, linkedin: { court: "in", nom: "LinkedIn" },
    tiktok: { court: "TT", nom: "TikTok" }, pinterest: { court: "P", nom: "Pinterest" }, google: { court: "G", nom: "Google Business" }
  };
  var FORMATS = { post: "Post", carrousel: "Carrousel", reel: "Reel", story: "Story", article: "Article", couverture: "Couverture", video: "Vidéo" };
  var ETAPES = { rediger: "Rédiger", tourner: "Tourner", monter: "Monter", visuel: "Créer le visuel" };
  // Heure par défaut d'une nouvelle publication (décision du 21/11/2026 : selon le réseau, réglable par espace)
  var HEURES = { instagram: "12:30", facebook: "12:30", tiktok: "12:30", story: "09:00", linkedin: "08:30", pinterest: "20:00", google: "10:00" };

  function pastilleStatut(s) { return el("span", { class: "statut s-" + s, text: STATUTS[s] || s }); }
  function pastillesReseaux(liste) { return el("span", { class: "reseaux" }, (liste || []).map(function (r) { return el("span", { class: "res r-" + r, title: (RESEAUX[r] || {}).nom || r, text: (RESEAUX[r] || {}).court || r }); })); }

  // ======================================================================
  // Accès aux données
  // ======================================================================
  function espace(id) { return S.espaces.filter(function (e) { return e.id === id; })[0] || null; }
  function espaceSlug(slug) { return S.espaces.filter(function (e) { return e.slug === slug; })[0] || null; }
  function personne(id) { return S.personnes.filter(function (p) { return p.id === id; })[0] || null; }
  function publication(id) { return S.publications.filter(function (p) { return p.id === id; })[0] || null; }
  function media(id) { return S.medias.filter(function (m) { return m.id === id; })[0] || null; }
  function prive(id) { return S.prives.filter(function (p) { return p.espace_id === id; })[0] || {}; }
  function mediasDe(pubId) {
    return S.pubMedias.filter(function (x) { return x.publication_id === pubId; }).sort(function (a, b) { return a.rang - b.rang; })
      .map(function (x) { return media(x.media_id); }).filter(Boolean);
  }
  function commentairesDe(pubId) { return S.commentaires.filter(function (c) { return c.publication_id === pubId; }).sort(function (a, b) { return String(a.cree_le).localeCompare(String(b.cree_le)); }); }
  function comptesDe(espaceId) { return S.comptes.filter(function (c) { return c.espace_id === espaceId; }).sort(function (a, b) { return a.rang - b.rang; }); }
  function estLili() { return S.role === "proprietaire"; }
  function publicationsVisibles() { return S.publications.filter(function (p) { return !p.corbeille_le; }); }
  function espacesActifs() { return S.espaces.filter(function (e) { return e.statut !== "archive"; }).sort(function (a, b) { return (a.ordre - b.ordre) || a.nom.localeCompare(b.nom); }); }
  // « Programmé jusqu'au » : dernière publication programmée ou validée datée de l'espace ; seuils validés le 21/11/2026
  function avance(espaceId) {
    var dates = S.publications.filter(function (p) { return p.espace_id === espaceId && !p.corbeille_le && (p.statut === "programme" || p.statut === "valide") && p.date_prevue; })
      .map(function (p) { return new Date(p.date_prevue); });
    if (!dates.length) return { jusque: null, jours: null, niveau: "vide", texte: "Rien de programmé" };
    var max = new Date(Math.max.apply(null, dates)), j = joursEntre(new Date(), max);
    var niveau = j < 0 ? "retard" : j <= 2 ? "urgent" : j <= 7 ? "semaine" : j <= 14 ? "ok" : "avance";
    return { jusque: max, jours: j, niveau: niveau, texte: j < 0 ? "En retard de " + (-j) + " j" : "Programmé jusqu'au " + fmt(max, { day: "numeric", month: "short" }) + " · " + j + " j" };
  }

  // Lecture : tout ce que la personne connectée a le droit de voir (les règles de la base filtrent)
  var TABLES = [["espaces", "espaces"], ["comptes", "comptes"], ["membres", "membres"], ["personnes", "personnes"], ["medias", "medias"],
    ["publications", "publications"], ["publication_medias", "pubMedias"], ["commentaires", "commentaires"], ["versions", "versions"],
    ["operations", "operations"], ["temps_forts", "tempsForts"], ["journal", "journal"], ["notifications", "notifications"],
    ["briefs", "briefs"], ["messages", "messages"], ["rapports", "rapports"], ["veille", "veille"], ["partenaires", "partenaires"],
    ["devis", "devis"], ["devis_signatures", "signaturesDevis"]];
  var TABLES_LILI = [["espaces_prive", "prives"], ["taches", "taches"], ["notes_internes", "notes"],
    ["comptes_mail", "boitesMail", "id, email, droits, derniere_erreur, cree_le"],
    ["securite_alertes", "alertesSecurite"], ["rendez_vous", "rdv"], ["temps", "temps"], ["factures", "factures"], ["prospects", "prospects"], ["reglages", "reglages"], ["briefs_jour", "briefsJour"]];
  function charger(seules) {
    if (X.demo) {
      if (!X.donneesDemo) {
        var d = window.DEMO_DONNEES();
        X.donneesDemo = d;
        S.espaces = d.espaces; S.prives = d.espaces_prive; S.comptes = d.comptes; S.membres = d.membres; S.personnes = d.personnes;
        S.medias = d.medias; S.publications = d.publications; S.pubMedias = d.publication_medias; S.commentaires = d.commentaires;
        S.versions = d.versions; S.operations = d.operations; S.tempsForts = d.temps_forts; S.taches = d.taches; S.journal = d.journal; S.notes = d.notes_internes;
        ["briefs", "messages", "rapports", "veille", "partenaires", "temps", "devis", "factures", "prospects", "reglages"].forEach(function (k) { S[k] = d[k] || []; });
        S.rdv = d.rendez_vous || [];
        S.signaturesDevis = d.devis_signatures || [];
        S.notifications = d.journal.map(function (j, i) { return { id: i + 1, personne_id: d.lili, journal_id: j.id, lue_le: null, cree_le: j.cree_le }; });
        S.medias.forEach(function (m) { S.urls[m.chemin] = m.url; if (m.apercu_url) S.urls[m.chemin + "#apercu"] = m.apercu_url; });
        // ?demo=maison-ondine : ouvre directement la démonstration comme la cliente de cette marque
        var vc = (new URLSearchParams(location.search).get("demo") || "").trim(), ev = vc && S.espaces.filter(function (e) { return e.slug === vc; })[0];
        if (ev) S.voirCommeEspace = ev.id;
      }
      appliquerRoleDemo();
      return Promise.resolve();
    }
    var liste = TABLES.concat(estLili() ? TABLES_LILI : []);
    if (seules) liste = liste.filter(function (t) { return seules.indexOf(t[0]) >= 0; });
    return Promise.all(liste.map(function (t) {
      var n = generations[t[0]] = (generations[t[0]] || 0) + 1;   // seule la réponse la plus récente compte
      var q = X.db.from(t[0]).select(t[2] || "*");
      if (t[0] === "journal") q = q.order("cree_le", { ascending: false }).limit(300);
      if (t[0] === "notifications") q = q.order("cree_le", { ascending: false }).limit(100);
      if (t[0] === "messages") q = q.order("cree_le", { ascending: false }).limit(500);
      if (t[0] === "briefs_jour") q = q.order("jour", { ascending: false }).limit(7);
      if (t[0] === "securite_alertes") q = q.order("cree_le", { ascending: false }).limit(50);
      return q.then(function (r) { if (r.error) throw r.error; if (n === generations[t[0]]) S[t[1]] = r.data || []; });
    })).then(signerMedias);
  }
  var generations = {};
  // Fichiers privés : adresses signées (1 h), par lots. Celles qui expirent dans moins de 15 min sont renouvelées
  // (au rechargement et toutes les 5 min) ; les images déjà affichées reçoivent la nouvelle adresse sans redessiner.
  var DUREE_URL = 3600, MARGE_URL = 15 * 60 * 1000, expirations = {};
  function signerMedias() {
    var chemins = [], limite = Date.now() + MARGE_URL;
    var aSigner = function (c) { return c && (!S.urls[c] || (expirations[c] && expirations[c] < limite)); };
    S.medias.forEach(function (m) { if (aSigner(m.chemin)) chemins.push(m.chemin); if (aSigner(m.apercu_chemin)) chemins.push(m.apercu_chemin); });
    S.espaces.forEach(function (e) { [e.logo_path, e.couverture_path].forEach(function (c) { if (aSigner(c)) chemins.push(c); }); });
    if (!chemins.length) return Promise.resolve();
    var lots = []; for (var i = 0; i < chemins.length; i += 100) lots.push(chemins.slice(i, i + 100));
    var echeance = Date.now() + DUREE_URL * 1000, remplacees = {};
    return Promise.all(lots.map(function (lot) {
      return X.db.storage.from("medias").createSignedUrls(lot, DUREE_URL).then(function (r) {
        (r.data || []).forEach(function (x) {
          if (!x.signedUrl) return;
          if (S.urls[x.path] && S.urls[x.path] !== x.signedUrl) remplacees[S.urls[x.path]] = x.signedUrl;
          S.urls[x.path] = x.signedUrl; expirations[x.path] = echeance;
        });
      });
    })).then(function () {
      if (!Object.keys(remplacees).length) return;
      document.querySelectorAll("img[src], video[src], video[poster], source[src]").forEach(function (n) {
        ["src", "poster"].forEach(function (a) { var v = n.getAttribute(a); if (v && remplacees[v]) n.setAttribute(a, remplacees[v]); });
      });
    });
  }
  setInterval(function () { if (X.demarre && !X.demo && X.db) signerMedias().catch(function () { /* nouvel essai dans 5 min */ }); }, 5 * 60 * 1000);
  function urlMedia(m, apercu) {
    if (!m) return "";
    if (apercu && m.apercu_chemin && S.urls[m.apercu_chemin]) return S.urls[m.apercu_chemin];
    if (apercu && S.urls[m.chemin + "#apercu"]) return S.urls[m.chemin + "#apercu"];
    return S.urls[m.chemin] || "";
  }
  function image(m, o) {
    o = o || {};
    var u = urlMedia(m, o.apercu !== false);
    if (!m || !u) return el("div", { class: "image-vide " + (o.classe || ""), "aria-hidden": "true" }, [icone("publications")]);
    if (m.type === "video") return el("video", { class: o.classe || "", src: urlMedia(m, false), muted: true, playsinline: true, preload: "metadata", loop: true });
    var i = el("img", { class: (o.classe || "") + " charge", src: u, alt: o.alt || "", loading: o.vite ? "eager" : "lazy", decoding: "async", draggable: "false" });
    i.addEventListener("load", function () { i.classList.remove("charge"); });
    return i;
  }
  function urlEspace(e, champ) { return e && (e[champ.replace("_path", "_url")] || S.urls[e[champ]]) || ""; }

  // Écritures : appliquées tout de suite à l'écran, puis en base (ou seulement à l'écran en démonstration)
  var CLES = { publications: "id", medias: "id", commentaires: "id", taches: "id", espaces: "id", espaces_prive: "espace_id", notes_internes: "id", operations: "id", temps_forts: "id", comptes: "id", versions: "id",
    briefs: "espace_id", reglages: "cle", briefs_jour: "jour" };
  var LOCALE = { publications: "publications", medias: "medias", commentaires: "commentaires", taches: "taches", espaces: "espaces", espaces_prive: "prives",
    notes_internes: "notes", operations: "operations", temps_forts: "tempsForts", comptes: "comptes", publication_medias: "pubMedias", versions: "versions",
    briefs: "briefs", messages: "messages", rapports: "rapports", veille: "veille", partenaires: "partenaires", temps: "temps", devis: "devis", factures: "factures",
    prospects: "prospects", reglages: "reglages", briefs_jour: "briefsJour", devis_signatures: "signaturesDevis", securite_alertes: "alertesSecurite", rendez_vous: "rdv", membres: "membres", personnes: "personnes" };
  // Tables sans colonne « cree_le » (la base refuserait une colonne inconnue)
  var SANS_DATE = ["espaces_prive", "comptes", "operations", "temps_forts", "publication_medias", "briefs", "rapports", "temps", "reglages"];
  function maj(table, id, champs) {
    var cle = CLES[table] || "id", liste = S[LOCALE[table]] || [], ligne = liste.filter(function (x) { return x[cle] === id; })[0], avant = ligne ? Object.assign({}, ligne) : null;
    if (ligne) Object.assign(ligne, champs);
    if (X.demo) {
      if (table === "publications") effetsDemo(ligne, avant);
      if (table === "factures" && ligne && ["emise", "payee"].indexOf(ligne.statut) >= 0 && !ligne.numero) { ligne.numero = prochainNumero(); ligne.date_facture = ligne.date_facture || iso(new Date()); }
      return Promise.resolve(ligne);
    }
    return X.db.from(table).update(champs).eq(cle, id).select().then(function (r) {
      // La base ne renvoie pas d'erreur quand une règle refuse la modification : seulement aucune ligne
      var err = r.error || (!(r.data || []).length ? { message: REFUS } : null);
      if (err) { if (ligne && avant) { Object.assign(ligne, avant); repeindreApresEchec(); } signaler("Non enregistré : " + err.message, true); throw err; }
      if (ligne && r.data && r.data[0]) Object.assign(ligne, r.data[0]);
      return ligne;
    });
  }
  var REFUS = "vous n'avez pas le droit de modifier cet élément";
  // Après un échec, l'écran reprend l'état de la base ; jamais pendant une saisie (le texte tapé reste sous les yeux)
  function repeindreApresEchec() { setTimeout(function () { if (X.demarre && !enSaisie()) dessiner(false); }, 0); }
  function creer(table, ligne) {
    if (!ligne.id && (CLES[table] || "id") === "id" && table !== "publication_medias") ligne.id = uuid();
    if (SANS_DATE.indexOf(table) < 0) ligne.cree_le = ligne.cree_le || new Date().toISOString();
    var liste = S[LOCALE[table]]; if (liste) liste.push(ligne);
    if (X.demo) {
      if (table === "commentaires") { ligne.auteur_id = S.moi.id; if (ligne.cible === "visuel" && !ligne.parent_id) ligne.numero = Math.max.apply(null, [0].concat(commentairesDe(ligne.publication_id).map(function (c) { return c.numero || 0; }))) + 1; }
      if (table === "publications") { ligne.auteur_id = ligne.auteur_id || S.moi.id; ligne.version_courante = 0; }
      if (table === "messages") ligne.auteur_id = S.moi.id;
      if (table === "factures" && ["emise", "payee"].indexOf(ligne.statut) >= 0 && !ligne.numero) ligne.numero = prochainNumero();
      return Promise.resolve(ligne);
    }
    var envoi = Object.assign({}, ligne);
    ["url", "apercu_url"].forEach(function (k) { delete envoi[k]; });
    return X.db.from(table).insert(envoi).select().then(function (r) {
      if (r.error) { if (liste) liste.splice(liste.indexOf(ligne), 1); signaler("Non enregistré : " + r.error.message, true); throw r.error; }
      if (r.data && r.data[0]) Object.assign(ligne, r.data[0]);
      return ligne;
    });
  }
  // Enregistrer une ligne dont la clé n'est pas « id » (brief d'un espace, réglage) : créée ou remplacée
  function enregistrer(table, ligne) {
    var cle = CLES[table], liste = S[LOCALE[table]] || [], deja = liste.filter(function (x) { return x[cle] === ligne[cle]; })[0];
    var avant = deja ? Object.assign({}, deja) : null;
    if (deja) Object.assign(deja, ligne); else liste.push(ligne);
    if (X.demo) return Promise.resolve(deja || ligne);
    return X.db.from(table).upsert(ligne, { onConflict: cle }).select().then(function (r) {
      var err = r.error || (!(r.data || []).length ? { message: REFUS } : null);
      if (err) {
        if (deja) { Object.keys(deja).forEach(function (k) { delete deja[k]; }); Object.assign(deja, avant); } else liste.splice(liste.indexOf(ligne), 1);
        repeindreApresEchec(); signaler("Non enregistré : " + err.message, true); throw err;
      }
      if (r.data && r.data[0]) Object.assign(deja || ligne, r.data[0]);
      return deja || ligne;
    });
  }
  // En démonstration seulement : imite la numérotation des factures (en ligne, c'est la base qui numérote)
  function prochainNumero() { return Math.max.apply(null, [91].concat(S.factures.map(function (f) { return f.numero || 0; }))) + 1; }
  // Appel d'une fonction serveur (Supabase Edge Functions) ; l'erreur rendue est celle que la fonction explique
  function appel(nom, corps) {
    return X.db.functions.invoke(nom, { body: corps || {} }).then(function (r) {
      if (r.error) return (r.error.context && r.error.context.json ? r.error.context.json().catch(function () { return {}; }) : Promise.resolve({})).then(function (j) { throw new Error((j && j.erreur) || r.error.message); });
      return r.data;
    });
  }
  function supprimer(table, filtre) {
    var liste = S[LOCALE[table]] || [], retires = [];
    for (var i = liste.length - 1; i >= 0; i--) if (Object.keys(filtre).every(function (k) { return liste[i][k] === filtre[k]; })) retires.push(liste.splice(i, 1)[0]);
    if (X.demo) return Promise.resolve();
    var q = X.db.from(table).delete(); Object.keys(filtre).forEach(function (k) { q = q.eq(k, filtre[k]); });
    return q.select().then(function (r) {
      var err = r.error || (retires.length && !(r.data || []).length ? { message: "vous n'avez pas le droit de supprimer cet élément" } : null);
      if (err) { retires.reverse().forEach(function (x) { liste.push(x); }); repeindreApresEchec(); signaler("Non supprimé : " + err.message, true); throw err; }
    });
  }
  // Réponse d'un client : la seule écriture de statut qui lui soit permise (fonction de la base)
  function repondre(pubId, decision, message) {
    var p = publication(pubId);
    if (X.demo) {
      var avant = Object.assign({}, p); p.statut = decision; if (decision === "valide") { p.valide_par = S.moi.id; p.valide_le = new Date().toISOString(); }
      if (message) creer("commentaires", { publication_id: pubId, cible: "general", contenu: message, visibilite: "partage", version: p.version_courante });
      effetsDemo(p, avant); return Promise.resolve(decision);
    }
    return X.db.rpc("repondre_publication", { p_id: pubId, p_decision: decision, p_message: message || null }).then(function (r) {
      if (r.error) { signaler(r.error.message, true); throw r.error; }
      return charger().then(function () { return decision; });
    });
  }
  // En démonstration, imite les automatismes de la base (version figée à l'envoi, journal)
  function effetsDemo(p, avant) {
    if (!p || !avant || p.statut === avant.statut) return;
    if (["idee", "en-creation"].indexOf(p.statut) < 0) p.visibilite = "partage";
    if (p.statut === "a-valider") {
      p.version_courante = (avant.version_courante || 0) + 1; p.envoye_le = new Date().toISOString();
      S.versions.push({ id: uuid(), publication_id: p.id, numero: p.version_courante, titre: p.titre, legende: p.legende, medias: mediasDe(p.id).map(function (m) { return m.id; }), cree_le: p.envoye_le });
    }
    S.journal.unshift({ id: Date.now(), espace_id: p.espace_id, acteur_id: S.moi.id, action: "publication.statut", objet_id: p.id, details: { de: avant.statut, vers: p.statut, titre: p.titre }, visibilite: p.visibilite, cree_le: new Date().toISOString() });
  }

  // Dépôt d'un fichier : original + vignette légère (640 px) dans « medias/<espace>/ », puis la ligne de la médiathèque
  function vignette(fichier) {
    return new Promise(function (ok) {
      if (!/^image\//.test(fichier.type) || /gif|svg/.test(fichier.type)) return ok(null);
      var img = new Image(), url = URL.createObjectURL(fichier);
      img.onload = function () {
        var k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); ok({ blob: b, largeur: img.width, hauteur: img.height }); }, "image/jpeg", .82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    });
  }
  function televerser(fichier, espaceId, dossier) {
    var id = uuid(), ext = (fichier.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    var type = /^video\//.test(fichier.type) ? "video" : /^image\//.test(fichier.type) ? "image" : "document";
    var chemin = espaceId + "/" + id + "." + ext;
    return vignette(fichier).then(function (v) {
      var ligne = { id: id, espace_id: espaceId, chemin: chemin, type: type, mime: fichier.type, nom_fichier: fichier.name, taille: fichier.size,
        largeur: v && v.largeur, hauteur: v && v.hauteur, dossier: dossier || null, etiquettes: [], depose_par: S.moi.id, visibilite: "partage" };
      if (X.demo) {
        var u = URL.createObjectURL(fichier); S.urls[chemin] = u; ligne.url = u; return creer("medias", ligne);
      }
      var envois = [X.db.storage.from("medias").upload(chemin, fichier, { contentType: fichier.type, upsert: false })];
      if (v && v.blob) { ligne.apercu_chemin = espaceId + "/" + id + "-apercu.jpg"; envois.push(X.db.storage.from("medias").upload(ligne.apercu_chemin, v.blob, { contentType: "image/jpeg" })); }
      return Promise.all(envois).then(function (r) {
        var err = r.filter(function (x) { return x.error; })[0]; if (err) throw err.error;
        return creer("medias", ligne);
      }).then(function (m) { return signerMedias().then(function () { return m; }); });
    });
  }

  // ======================================================================
  // Messages et fenêtres
  // ======================================================================
  function signaler(texte, erreur) {
    var t = el("div", { class: "toast" + (erreur ? " erreur" : ""), role: "status", text: texte });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("vu"); });
    setTimeout(function () { t.classList.remove("vu"); setTimeout(function () { t.remove(); }, 300); }, erreur ? 6000 : 3200);
  }
  // Fenêtre simple : { titre, corps: [éléments], actions: [{ texte, principal, danger, action }] } ; feuille du bas sur téléphone
  function fenetre(o) {
    var d = el("dialog", { class: "fenetre" + (o.classe ? " " + o.classe : "") });
    var fermer = function () { d.close(); };
    d.appendChild(el("form", { method: "dialog", class: "fenetre-corps", onsubmit: function (ev) {
      ev.preventDefault(); var p = (o.actions || []).filter(function (a) { return a.principal; })[0]; if (p) p.action(fermer);
    } }, [
      o.titre ? el("h2", { text: o.titre }) : null,
      o.sous ? el("p", { class: "fenetre-sous", text: o.sous }) : null
    ].concat(o.corps || []).concat([el("div", { class: "fenetre-actions" }, (o.actions || []).map(function (a) {
      return el("button", { type: a.principal ? "submit" : "button", class: a.principal ? "btn-plein" : a.danger ? "btn-texte danger" : "btn-texte", text: a.texte,
        onclick: a.principal ? null : function () { (a.action || fermer)(fermer); } });
    }))])));
    d.addEventListener("close", function () { d.remove(); });
    document.body.appendChild(d); d.showModal();
    var champ = d.querySelector("textarea, input:not([type=hidden])"); if (champ) setTimeout(function () { champ.focus(); }, 30);
    return d;
  }

  // ======================================================================
  // Coquille : barre latérale façon Notion, barre du haut, barre d'onglets sur téléphone
  // ======================================================================
  // Glisser un client dans la barre latérale pour changer l'ordre (souris : dès qu'on bouge de 6 px ; doigt : appui
  // de 0,35 s). L'ordre est renuméroté pour tous les clients non archivés, comme les flèches de la page Clients.
  function glisserClients(nav) {
    // L'étiquette prise suit le pointeur ; les autres s'écartent en douceur pour lui faire place. Le vrai
    // déplacement dans la liste ne se fait qu'au lâcher (puis l'ordre est enregistré).
    var etat = null;
    var liens = function () { return Array.prototype.slice.call(nav.children); };
    var nettoyer = function (items) { items.forEach(function (a) { a.style.transition = ""; a.style.transform = ""; }); };
    var decalages = function (e) {
      // Place visée : nombre d'autres étiquettes dont le milieu est au-dessus du milieu de l'étiquette prise
      var milieu = e.rects[e.idx].top + e.rects[e.idx].height / 2 + e.dy, cible = 0;
      e.items.forEach(function (a, i) { if (i !== e.idx && milieu > e.rects[i].top + e.rects[i].height / 2) cible++; });
      e.cible = cible;
      var H = e.rects[e.idx].height + e.ecart;
      e.items.forEach(function (a, i) {
        if (i === e.idx) return;
        var y = (e.idx < cible && i > e.idx && i <= cible) ? -H : (cible < e.idx && i >= cible && i < e.idx) ? H : 0;
        a.style.transform = y ? "translateY(" + y + "px)" : "";
      });
    };
    var finir = function () {
      if (!etat) return;
      var e = etat; etat = null; clearTimeout(e.minuteur);
      document.removeEventListener("pointermove", bouger, true); document.removeEventListener("pointerup", finir, true); document.removeEventListener("pointercancel", finir, true);
      if (!e.actif) return;
      var bloque = function (c) { c.preventDefault(); c.stopPropagation(); nav.removeEventListener("click", bloque, true); };
      nav.addEventListener("click", bloque, true);
      setTimeout(function () { nav.removeEventListener("click", bloque, true); }, 400);
      // L'étiquette se pose à sa nouvelle place, puis la liste est remise dans le bon ordre sans saut
      var fin = 0, H = e.ecart;
      if (e.cible > e.idx) for (var i = e.idx + 1; i <= e.cible; i++) fin += e.rects[i].height + H;
      if (e.cible < e.idx) for (var j = e.cible; j < e.idx; j++) fin -= e.rects[j].height + H;
      e.lien.style.transition = "transform .16s ease, box-shadow .16s ease"; e.lien.style.transform = "translateY(" + fin + "px)";
      e.lien.classList.remove("glisse");
      setTimeout(function () {
        nav.classList.remove("en-glisse");
        var reste = e.items.filter(function (a) { return a !== e.lien; });
        nav.insertBefore(e.lien, reste[e.cible] || null);
        nettoyer(e.items);
        var ordre = liens().map(function (a) { return a.dataset.espace; });
        if (ordre.join() === espacesActifs().map(function (x) { return x.id; }).join()) return;
        Promise.all(ordre.map(function (id, n) { var x = espace(id); return !x || x.ordre === n + 1 ? null : maj("espaces", id, { ordre: n + 1 }); }))
          .then(function () { dessinerCoquille(); signaler("Ordre des clients enregistré"); }, function () { dessinerCoquille(); });
      }, 170);
    };
    var demarrer = function () {
      var e = etat; e.actif = true;
      e.items = liens(); e.idx = e.items.indexOf(e.lien); e.rects = e.items.map(function (a) { return a.getBoundingClientRect(); });
      e.ecart = e.items.length > 1 ? Math.max(0, e.rects[1].top - e.rects[0].bottom) : 0;
      e.min = e.rects[0].top - e.rects[e.idx].top - 6; e.max = e.rects[e.rects.length - 1].bottom - e.rects[e.idx].bottom + 6;
      e.items.forEach(function (a) { if (a !== e.lien) a.style.transition = "transform .18s ease"; });
      e.lien.classList.add("glisse"); nav.classList.add("en-glisse");
      if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {}
    };
    var bouger = function (ev) {
      if (!etat) return;
      var dy = ev.clientY - etat.y;
      if (!etat.actif) {
        if (etat.tactile) { if (Math.abs(dy) > 8 || Math.abs(ev.clientX - etat.x) > 8) { clearTimeout(etat.minuteur); etat = null; } return; }
        if (Math.abs(dy) < 6) return;
        demarrer();
      }
      ev.preventDefault();
      etat.dy = Math.max(etat.min, Math.min(etat.max, dy));
      etat.lien.style.transform = "translateY(" + etat.dy + "px) scale(1.02)";
      decalages(etat);
    };
    nav.addEventListener("pointerdown", function (ev) {
      var a = ev.target.closest(".cote-clients > a.cote-lien");
      if (!a || ev.button > 0 || ev.target.closest(".cote-sous")) return;
      etat = { lien: a, y: ev.clientY, x: ev.clientX, dy: 0, actif: false, tactile: ev.pointerType !== "mouse" };
      if (etat.tactile) etat.minuteur = setTimeout(function () { if (etat) { demarrer(); etat.lien.style.transform = "scale(1.02)"; } }, 350);
      document.addEventListener("pointermove", bouger, true); document.addEventListener("pointerup", finir, true); document.addEventListener("pointercancel", finir, true);
    });
    nav.addEventListener("dragstart", function (ev) { ev.preventDefault(); });
    nav.addEventListener("touchmove", function (ev) { if (etat && etat.actif) ev.preventDefault(); }, { passive: false });
  }
  var sousFermes = {};   // clients dont Lili a replié les rubriques dans la barre latérale
  function lienCote(href, nom, ic, actif, compte, touche) {
    var a = el("a", { href: href, class: "cote-lien", "aria-current": actif ? "page" : null, title: touche ? nom + " (touche " + touche + ")" : null }, [
      typeof ic === "string" ? icone(ic) : ic, el("span", { class: "cote-texte", text: nom }), compte ? el("span", { class: "cote-compte", text: String(compte) }) : null
    ]);
    return a;
  }
  function espacesClient() { return S.espaces.filter(function (e) { return S.membres.some(function (m) { return m.espace_id === e.id && m.personne_id === S.moi.id; }); }); }
  function dessinerCoquille() {
    var c = X.coquille, r = S.route, lili = estLili(), aValider = publicationsVisibles().filter(function (p) { return p.statut === "a-valider"; });
    c.textContent = "";
    var tete = lili
      ? el("a", { class: "cote-tete", href: "#" }, [el("img", { src: MARQUE.icone || "assets/marque/icone.svg", alt: "", width: 32, height: 32 }), el("span", {}, [el("b", { text: MARQUE.outil || "Studio" }), el("small", { text: MARQUE.proprietaire || "" })])])
      : (function () { var e = espacesClient()[0] || {}; return el("a", { class: "cote-tete", href: "#", style: { "--c": e.couleur || "#1E1A17" } }, [logoEspace(e, "petit"), el("span", {}, [el("b", { text: e.nom || "Votre espace" }), el("small", { text: "par " + (MARQUE.proprietaire || "") })])]); })();
    var nav = el("nav", { class: "cote-nav", "aria-label": "Navigation" }, lili ? [
      lienCote("#", "Aujourd'hui", "aujourdhui", r.nom === "", null, "0"),
      lienCote("#calendrier", "Calendrier", "calendrier", r.nom === "calendrier", null, "C"),
      lienCote("#publications", "Publications", "publications", r.nom === "publications", aValider.length || null, "P"),
      lienCote("#mediatheque", "Médiathèque", "mediatheque", r.nom === "mediatheque", null, "M"),
      lienCote("#mails", "Mails", "mail", r.nom === "mails", S.mailsNonLus || null, "E"),
      lienCote("#taches", "Tâches", "taches", r.nom === "taches", S.taches.filter(function (t) { return t.statut !== "fait" && t.echeance && t.echeance <= iso(new Date()); }).length || null),
      lienCote("#prospects", "Prospects", "prospects", r.nom === "prospects")
    ] : [
      (espacesClient()[0] || {}).vue_client === "planning" ? lienCote("#", "Planning", "liste", r.nom === "" || r.nom === "planning") : lienCote("#", "Accueil", "aujourdhui", r.nom === ""),
      lienCote("#valider", "À valider", "valider", r.nom === "valider", aValider.length || null),
      (espacesClient()[0] || {}).vue_client === "planning" ? null : lienCote("#planning", "Planning", "liste", r.nom === "planning"),
      lienCote("#calendrier", "Calendrier", "calendrier", r.nom === "calendrier"),
      lienCote("#publications", "Publications", "publications", r.nom === "publications"),
      lienCote("#mediatheque", "Médiathèque", "mediatheque", r.nom === "mediatheque"),
      lienCote("#brief", "Brief", "brief", r.nom === "brief"),
      lienCote("#rapports", "Rapports", "rapports", r.nom === "rapports"),
      lienCote("#messages", "Messages", "commentaire", r.nom === "messages"),
      devisDuClient().length ? lienCote("#devis", "Devis", "euro", r.nom === "devis", devisDuClient().filter(function (d) { return d.statut === "envoye"; }).length || null) : null
    ]);
    var clients = lili ? [el("div", { class: "cote-titre-ligne" }, [el("a", { class: "cote-titre", href: "#clients", title: "Tous les clients", "aria-current": r.nom === "clients" ? "page" : null, text: "Clients" }),
      el("button", { type: "button", class: "btn-icone cote-ajout", "aria-label": "Nouveau client", title: "Nouveau client", onclick: function () { menu(false); if (window.Studio.nouveauClient) window.Studio.nouveauClient(); } }, [icone("plus")])]), el("nav", { class: "cote-clients", "aria-label": "Clients" }, espacesActifs().map(function (e, i) {
      var actif = r.nom === "client" && r.param === e.slug;
      var a = lienCote("#" + e.slug, e.nom, el("i", { class: "pastille-client", style: { "--c": e.couleur } }), actif, null, i < 9 ? String(i + 1) : null);
      a.dataset.espace = e.id;
      // Un second clic sur le client ouvert replie ses rubriques ; un clic de plus les rouvre.
      var ouvert = actif && !sousFermes[e.slug];
      if (actif) a.setAttribute("aria-expanded", ouvert ? "true" : "false");
      if (ouvert) a.appendChild(el("span", { class: "cote-sous" }, rubriquesClient().map(function (x) {
        return el("a", { href: "#" + e.slug + "/" + x.id, "aria-current": r.rubrique === x.id ? "page" : null, text: x.nom });
      })));
      a.addEventListener("click", function (ev) {
        if (!actif || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.target.closest(".cote-sous")) return;
        if (ouvert) { ev.preventDefault(); sousFermes[e.slug] = true; dessinerCoquille(); return; }
        delete sousFermes[e.slug];
        if (location.hash === "#" + e.slug) { ev.preventDefault(); dessinerCoquille(); }
      });
      return a;
    }))] : [];
    if (lili && clients[1]) glisserClients(clients[1]);
    var nonLues = S.notifications.filter(function (n) { return !n.lue_le && (!S.moi || n.personne_id === S.moi.id); }).length;
    var bas = el("div", { class: "cote-bas" }, [
      X.demo ? voirComme() : null,
      el("button", { type: "button", class: "cote-lien", id: "btn-notifications", onclick: function () { if (V.notifications) V.notifications(); } },
        [icone("cloche"), el("span", { class: "cote-texte", text: "Notifications" }), nonLues ? el("span", { class: "cote-compte", text: String(nonLues) }) : null]),
      el("button", { type: "button", class: "installer", "data-installer": "", hidden: !window.__installable, onclick: function () { if (window.__installer) window.__installer(); } }, [icone("installer"), "Installer l'application"]),
      lili ? lienCote("#reglages", "Réglages", "reglages", r.nom === "reglages", S.alertesSecurite.filter(function (a) { return !a.vu_le && a.niveau !== "info"; }).length || null) : null,
      !lili ? lienCote("#compte", "Mon compte", "cadenas", r.nom === "compte") : null,
      !lili ? el("a", { href: "guide.html", target: "_blank", rel: "noopener", class: "cote-lien" }, [icone("brief"), el("span", { class: "cote-texte", text: "Comment ça marche" })]) : null,
      !X.peutVerrouiller || X.peutVerrouiller() ? el("button", { type: "button", class: "cote-lien", onclick: function () { if (X.verrouiller) X.verrouiller(); } }, [icone("cadenas"), el("span", { class: "cote-texte", text: "Verrouiller" })]) : null,
      el("button", { type: "button", class: "cote-lien", onclick: function () { if (X.quitter) X.quitter(); } }, [icone("sortir"), el("span", { class: "cote-texte", text: "Se déconnecter" })])
    ]);
    var cote = el("aside", { class: "cote", id: "cote", "aria-label": "Menu" }, [
      el("div", { class: "cote-haut" }, [tete, el("button", { type: "button", class: "btn-icone fermer-menu", "aria-label": "Fermer le menu", onclick: function () { menu(false); } }, [icone("fermer")])]),
      lili ? el("button", { type: "button", class: "cote-nouveau", title: "Nouvelle publication (touche N)", onclick: function () { nouvellePublication(); } }, [icone("plus"), el("span", { text: "Nouvelle publication" }), el("kbd", { text: "N" })]) : null,
      nav
    ].concat(clients).concat([bas]));
    var fil = el("nav", { class: "fil", "aria-label": "Fil d'Ariane" }, filAriane());
    var barre = el("header", { class: "barre" }, [
      el("button", { type: "button", class: "btn-icone ouvrir-menu", "aria-label": "Ouvrir le menu", onclick: function () { menu(true); } }, [icone("menu")]),
      fil,
      el("button", { type: "button", class: "barre-recherche", "aria-label": "Rechercher dans le studio (⌘K)", onclick: function () { if (window.Studio.rechercher) window.Studio.rechercher(); } },
        [icone("recherche"), el("span", { class: "barre-recherche-texte", text: "Rechercher" }), el("kbd", { text: /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K" })]),
      el("span", { class: "barre-heure", id: "barre-heure", text: fmt(new Date(), { weekday: "long", day: "numeric", month: "long" }) + " · " + hm(new Date()) })
    ]);
    var basTel = el("nav", { class: "nav-bas", "aria-label": "Navigation principale" }, (lili ? [
      ["#", "aujourdhui", "Aujourd'hui", r.nom === ""], ["#calendrier", "calendrier", "Calendrier", r.nom === "calendrier"],
      ["#publications", "publications", "Publications", r.nom === "publications"], ["#mediatheque", "mediatheque", "Médias", r.nom === "mediatheque"]
    ] : [
      ["#", "aujourdhui", "Accueil", r.nom === ""], ["#valider", "valider", "À valider", r.nom === "valider"],
      ["#calendrier", "calendrier", "Calendrier", r.nom === "calendrier"], ["#mediatheque", "mediatheque", "Médias", r.nom === "mediatheque"]
    ]).map(function (x) { return el("a", { href: x[0], "aria-current": x[3] ? "page" : null }, [icone(x[1]), el("span", { text: x[2] })]); })
      .concat([el("button", { type: "button", onclick: function () { menu(true); } }, [icone("menu"), el("span", { text: "Plus" })])]));
    X.page = el("main", { class: "page", id: "page" });
    c.appendChild(cote); c.appendChild(el("div", { class: "voile", onclick: function () { menu(false); } })); c.appendChild(barre); c.appendChild(X.page); c.appendChild(basTel);
  }
  function menu(ouvert) { document.documentElement.classList.toggle("menu-ouvert", ouvert); }
  function filAriane() {
    var r = S.route, morceaux = [];
    var noms = { "": estLili() ? "Aujourd'hui" : "Accueil", calendrier: "Calendrier", publications: "Publications", mediatheque: "Médiathèque", valider: "À valider", mails: "Mails",
      taches: "Tâches", prospects: "Prospects", reglages: "Réglages", clients: "Clients", planning: "Planning", devis: "Devis", compte: "Mon compte", brief: "Brief et ligne éditoriale", rapports: "Rapports", messages: "Messages" };
    if (r.nom === "client" && !estLili()) morceaux.push(el("span", { text: "Page introuvable" }));
    else if (r.nom === "client") {
      var e = espaceSlug(r.param);
      morceaux.push(el("a", { href: "#" + r.param, text: e ? e.nom : "" }));
      var rub = rubriquesClient().filter(function (x) { return x.id === r.rubrique; })[0];
      if (rub) morceaux.push(el("span", { text: rub.nom }));
    } else if (r.nom === "p") {
      var p = publication(r.param), ep = p && espace(p.espace_id);
      if (ep && estLili()) morceaux.push(el("a", { href: "#" + ep.slug, text: ep.nom }));
      morceaux.push(el("span", { text: p ? (p.titre || "Sans titre") : "Publication" }));
    } else morceaux.push(el("span", { text: noms[r.nom] || "" }));
    var res = [];
    morceaux.forEach(function (m, i) { if (i) res.push(el("span", { class: "fil-sep", text: "/" })); res.push(m); });
    return res;
  }
  function logoEspace(e, taille) {
    var u = urlEspace(e, "logo_path");
    return el("span", { class: "logo-espace " + (taille || ""), style: { "--c": (e && e.couleur) || "#1E1A17", "--cf": foncee((e && e.couleur) || "#1E1A17") } }, [u ? el("img", { src: u, alt: "" }) : el("b", { text: initiales(e && e.nom) })]);
  }
  // Devis que le client peut voir (en ligne, la base filtre ; en démonstration, même règle ici)
  function devisDuClient() {
    if (estLili()) return [];
    var e = S.voirCommeEspace || (espacesClient()[0] || {}).id;
    return S.devis.filter(function (d) { return d.espace_id === e && ["envoye", "accepte", "refuse"].indexOf(d.statut) >= 0; });
  }
  function rubriquesClient() {
    return [{ id: "calendrier", nom: "Calendrier", icone: "calendrier" }, { id: "publications", nom: "Publications", icone: "publications" }, { id: "planning", nom: "Planning (vue client)", icone: "liste" }, { id: "mediatheque", nom: "Médiathèque", icone: "mediatheque" },
      { id: "brief", nom: "Brief", icone: "brief" }, { id: "messages", nom: "Messages", icone: "commentaire" }, { id: "rapports", nom: "Rapports", icone: "rapports" },
      { id: "veille", nom: "Veille", icone: "oeil" }, { id: "partenariats", nom: "Partenariats", icone: "lien" }, { id: "facturation", nom: "Temps et facturation", icone: "euro" },
      { id: "notes", nom: "Notes internes", icone: "cadenas" }, { id: "equipe", nom: "Équipe", icone: "personnes" }];
  }

  // En démonstration : voir le studio comme Lili, ou comme la cliente d'une des marques
  function voirComme() {
    var sel = el("select", { class: "voir-comme", "aria-label": "Voir comme", onchange: function (ev) { S.voirCommeEspace = ev.target.value || null; appliquerRoleDemo(); location.hash = ""; dessiner(true); } },
      [el("option", { value: "", text: "Voir comme : Lili" })].concat(S.espaces.map(function (e) { return el("option", { value: e.id, selected: S.voirCommeEspace === e.id, text: "Voir comme : " + e.nom }); })));
    return el("label", { class: "voir-comme-zone" }, [el("span", { text: "Démonstration" }), sel]);
  }
  function appliquerRoleDemo() {
    var d = X.donneesDemo; if (!d) return;
    if (!S.voirCommeEspace) { S.role = "proprietaire"; S.moi = personne(d.lili); return; }
    var m = S.membres.filter(function (x) { return x.espace_id === S.voirCommeEspace; })[0];
    if (!m) {   // espace sans client invité : un visiteur d'aperçu, le temps de voir l'espace comme lui
      var id = "apercu-" + S.voirCommeEspace;
      if (!personne(id)) S.personnes.push({ id: id, nom: "Client (aperçu)", role: "client" });
      m = { espace_id: S.voirCommeEspace, personne_id: id, role: "client" }; S.membres.push(m);
    }
    S.role = "client"; S.moi = personne(m.personne_id);
  }
  // Ce qu'un client voit en démonstration : la même règle que la base (son espace, ce qui est partagé, ses idées)
  function visible(p) {
    if (estLili() || !X.demo) return true;   // en ligne, les règles de la base ont déjà filtré
    var e = S.voirCommeEspace || (espacesClient()[0] || {}).id;
    return p.espace_id === e && (p.visibilite === "partage" || p.auteur_id === S.moi.id);
  }

  // ======================================================================
  // Routeur et rendu
  // ======================================================================
  var RESERVES = ["", "calendrier", "publications", "mediatheque", "valider", "p", "mails", "taches", "prospects", "reglages", "clients", "planning", "brief", "rapports", "messages", "devis", "compte"];
  function lireRoute() {
    var h = decodeURIComponent(location.hash.replace(/^#/, "")), q = {}, i = h.indexOf("?");
    if (i >= 0) { new URLSearchParams(h.slice(i + 1)).forEach(function (v, k) { q[k] = v; }); h = h.slice(0, i); }
    var m = h.split("/");
    if (m[0] === "p") return { nom: "p", param: m[1] || "", rubrique: "", query: q };
    if (RESERVES.indexOf(m[0]) >= 0) return { nom: m[0], param: "", rubrique: "", query: q };
    return { nom: "client", param: m[0], rubrique: m[1] || "", query: q };
  }
  var mouvementReduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function avecTransition(maj) {
    if (mouvementReduit || !document.startViewTransition || !X.dejaDessine) { X.dejaDessine = true; maj(); return; }
    var t = document.startViewTransition(maj);
    t.ready.catch(function () {}); t.finished.catch(function () {}); t.updateCallbackDone.catch(function () {});
  }
  function vueCourante() {
    var r = S.route;
    if (r.nom === "") return estLili() ? V.aujourdhui(r) : ((espacesClient()[0] || {}).vue_client === "planning" && V.planning ? V.planning(r) : V.accueilClient(r));
    if (r.nom === "valider") return V.valider(r);
    if (r.nom === "planning") return V.planning ? V.planning(r) : introuvable();
    if (r.nom === "calendrier") return V.calendrier(r);
    if (r.nom === "publications") return V.publications(r);
    if (r.nom === "mediatheque") return V.mediatheque(r);
    if (r.nom === "mails") return estLili() ? V.mails(r) : introuvable();
    if (["taches", "prospects", "reglages", "clients"].indexOf(r.nom) >= 0) return estLili() ? V[r.nom](r) : introuvable();
    if (r.nom === "compte") return !estLili() && V.compte ? V.compte(r) : introuvable();
    if (r.nom === "devis") { var ed = espacesClient()[0]; return !estLili() && ed && V.devisClient ? V.devisClient(r, ed) : introuvable(); }
    if (["brief", "rapports", "messages"].indexOf(r.nom) >= 0) { var ec = espacesClient()[0]; return !estLili() && ec ? V["rub_" + r.nom](r, ec) : introuvable(); }
    if (r.nom === "p") return publication(r.param) && visible(publication(r.param)) ? V.publication(r) : introuvable();
    if (r.nom === "client") { var e = espaceSlug(r.param); return e && estLili() ? V.client(r, e) : introuvable(); }
    return introuvable();
  }
  // Vacances de Lili : bandeau chez les clients (absence « pour tous » des temps forts) et rappel chez Lili
  function bandeauVacances() {
    var auj = iso(new Date());
    if (estLili()) {
      var v = V.vacancesActives ? V.vacancesActives() : null; if (!v || v.debut > auj) return null;
      return el("div", { class: "bandeau-vacances" }, [icone("soleil"), el("span", { text: "Vous êtes en vacances jusqu'au " + fmt(v.fin + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) + " : réponse automatique et notifications en pause." }),
        el("button", { type: "button", class: "btn-texte", text: "Je suis de retour", onclick: function () { if (V.finVacances) V.finVacances(); } })]);
    }
    var a = S.tempsForts.filter(function (t) { return !t.espace_id && t.type === "absence" && t.debut <= auj && (t.fin || t.debut) >= auj; })[0];
    if (!a) return null;
    var retour = ajouterJours(new Date((a.fin || a.debut) + "T12:00:00"), 1);
    return el("div", { class: "bandeau-vacances" }, [icone("soleil"), el("span", { text: (MARQUE.proprietaire || "Lili").split(" ")[0] + " est en congés jusqu'au " + fmt((a.fin || a.debut) + "T12:00:00", { weekday: "long", day: "numeric", month: "long" }) +
      ". Vos messages l'attendent ; elle vous répond à son retour, le " + fmt(retour, { weekday: "long", day: "numeric", month: "long" }) + "." })]);
  }
  function introuvable() { return el("section", { class: "vide-page" }, [el("h1", { class: "titre-page", text: "Page introuvable" }), el("p", { text: "Cette page n'existe pas ou ne vous est pas ouverte." }), el("a", { class: "btn-plein", href: "#", text: "Revenir à l'accueil" })]); }
  function dessiner(transition) {
    if (!X.demarre) return;
    var defil = window.scrollY, faire = function () {
      dessinerCoquille();
      var v; try { v = vueCourante(); } catch (e) { console.error(e); v = el("p", { class: "erreur-page", text: "Cette page n'a pas pu s'afficher : " + e.message }); }
      var bandeau = bandeauVacances(); if (bandeau) X.page.appendChild(bandeau);
      X.page.appendChild(v);
      var e = S.route.nom === "client" ? espaceSlug(S.route.param) : S.route.nom === "p" && publication(S.route.param) ? espace(publication(S.route.param).espace_id) : !estLili() ? espacesClient()[0] : null;
      document.documentElement.style.setProperty("--marque", (e && e.couleur) || "var(--encre)");
      if (e && e.couleur) { X.page.style.setProperty("--c", e.couleur); X.page.style.setProperty("--cf", foncee(e.couleur)); }   // la couleur du client teinte sa page
      document.title = (filAriane().map(function (x) { return x.textContent; }).filter(function (t) { return t && t !== "/"; }).reverse().join(" · ") || "Studio") + " · " + (MARQUE.outil || "Studio");
    };
    if (transition) avecTransition(function () { faire(); window.scrollTo(0, 0); });
    else { faire(); window.scrollTo(0, defil); }
  }
  function router() { S.route = lireRoute(); menu(false); dessiner(true); }
  function aller(h) { if (location.hash === "#" + h || (h === "" && !location.hash)) router(); else location.hash = h; }

  function nouvellePublication(espaceId, date) {
    var r = S.route, e = espaceId || (r.nom === "client" && espaceSlug(r.param) || {}).id;
    var lancer = function (eid) {
      var es = espace(eid), res = (es && es.reseaux && es.reseaux.length ? es.reseaux.slice(0, 1) : ["instagram"]);
      var h = ((es && es.heures_defaut) || {})[res[0]] || HEURES[res[0]] || "12:30";
      var d = date ? new Date(date) : null; if (d) { d.setHours(+h.slice(0, 2), +h.slice(3, 5), 0, 0); }
      creer("publications", { espace_id: eid, titre: "", reseaux: res, format: "post", statut: "idee", visibilite: "interne", date_prevue: d ? d.toISOString() : null, legende: "", hashtags: [], mentions: [], etapes: [], etiquettes: [] })
        .then(function (p) { aller("p/" + p.id); });
    };
    if (e) return lancer(e);
    var choix = el("div", { class: "choix-espaces" }, espacesActifs().map(function (x) {
      return el("button", { type: "button", class: "choix-espace", style: { "--c": x.couleur }, onclick: function () { f.close(); lancer(x.id); } }, [logoEspace(x, "petit"), el("span", { text: x.nom })]);
    }));
    var f = fenetre({ titre: "Nouvelle publication", sous: "Pour quel client ?", corps: [choix], actions: [{ texte: "Annuler" }] });
  }

  // Raccourcis clavier
  document.addEventListener("keydown", function (ev) {
    if (!X.demarre || ev.metaKey || ev.ctrlKey || ev.altKey || document.querySelector("dialog[open]")) return;
    if (enSaisie()) { if (ev.key === "Escape") document.activeElement.blur(); return; }
    var k = ev.key, r = S.route;
    if (r.nom === "mails" && estLili() && V.toucheMails && V.toucheMails(ev)) { ev.preventDefault(); return; }
    if (estLili() && (k === "n" || k === "N")) { ev.preventDefault(); nouvellePublication(); }
    else if (k === "0") aller("");
    else if (k === "c" || k === "C") aller("calendrier");
    else if (k === "p" || k === "P") aller("publications");
    else if (k === "m" || k === "M") aller("mediatheque");
    else if (estLili() && (k === "e" || k === "E")) aller("mails");
    else if (estLili() && k === "/") { ev.preventDefault(); if (V.assistant) V.assistant(); }
    else if (estLili() && /^[1-9]$/.test(k)) { var e = espacesActifs()[+k - 1]; if (e) aller(e.slug); }
    else if (k === "Escape" && r.nom === "client" && r.rubrique) aller(r.param);
    else if (k === "Escape" && r.nom === "p") revenir();
    else if (r.nom === "client" && r.rubrique && (k === "ArrowLeft" || k === "ArrowRight") && !(r.rubrique === "calendrier")) {
      var rs = rubriquesClient(), i = rs.findIndex(function (x) { return x.id === r.rubrique; }) + (k === "ArrowRight" ? 1 : -1);
      if (rs[i]) aller(r.param + "/" + rs[i].id);
    } else if (V.touche && V.touche(ev)) ev.preventDefault();
  });
  window.addEventListener("hashchange", function () { if (X.demarre) router(); });
  setInterval(function () { var b = document.getElementById("barre-heure"); if (b) b.textContent = fmt(new Date(), { weekday: "long", day: "numeric", month: "long" }) + " · " + hm(new Date()); }, 30000);

  // Temps réel : toute modification d'une table suivie recharge les données (regroupées), sauf pendant une saisie
  var attente = null, enAttente = false;
  // Temps réel : on ne recharge que les tables qui ont bougé (regroupées sur 400 ms), et on ne redessine pas pendant
  // une saisie, une fenêtre ouverte, un glisser, ou tant qu'une réponse tapée n'est pas envoyée.
  var aRecharger = {};
  function saisieNonEnvoyee() {
    return Array.prototype.some.call(document.querySelectorAll("#page textarea, #page input[type=text], #page [contenteditable=true]"), function (n) {
      return n.dataset.tape && !n.dataset.auto && String(n.isContentEditable ? n.textContent : n.value).trim() !== "";
    });
  }
  document.addEventListener("input", function (ev) { if (ev.target && ev.target.dataset) ev.target.dataset.tape = "1"; }, true);
  function rafraichir() {
    if (!X.demarre || X.demo) return;
    if (enSaisie() || saisieNonEnvoyee() || document.querySelector("dialog[open]") || X.glisse) { enAttente = true; return; }
    var tables = Object.keys(aRecharger); aRecharger = {}; enAttente = false;
    charger(tables.length ? tables : null).then(function () { if (X.demarre) dessiner(false); }, function () { /* nouvel essai au prochain événement */ });
  }
  function abonner() {
    if (X.demo || X.canal) return;
    X.canal = X.db.channel("studio");
    ["publications", "publication_medias", "commentaires", "medias", "versions", "espaces", "taches", "journal", "operations", "notifications", "comptes_mail",
      "briefs", "messages", "rapports", "veille", "partenaires", "temps", "devis", "factures", "prospects", "membres", "briefs_jour", "devis_signatures", "temps_forts", "reglages", "securite_alertes", "rendez_vous"].forEach(function (t) {
      // Les suppressions ne passent pas par les règles de la base (Supabase envoie l'identifiant de toute ligne
      // effacée) : seule Lili les écoute ; chez un client, la corbeille est une modification, et le reste se voit
      // au retour sur l'onglet.
      (estLili() ? ["*"] : ["INSERT", "UPDATE"]).forEach(function (ev) {
        X.canal.on("postgres_changes", { event: ev, schema: "public", table: t }, function () {
          aRecharger[t] = true;
          clearTimeout(attente); attente = setTimeout(rafraichir, 400);
        });
      });
    });
    X.canal.subscribe();
  }
  document.addEventListener("focusout", function () { setTimeout(function () { if (enAttente && X.demarre && !enSaisie()) rafraichir(); }, 300); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && X.demarre && !X.demo && !enSaisie() && !saisieNonEnvoyee()) { aRecharger = {}; charger().then(function () { dessiner(false); }, function () {}); } });

  // ======================================================================
  // Démarrage (appelé par l'entrée une fois le code saisi)
  // ======================================================================
  // Thème choisi dans Réglages > Apparence (sinon celui de l'appareil)
  try { var theme = localStorage.getItem("studio-theme"); if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme); } catch (x) { /* stockage indisponible */ }
  function ouvrir(o) {
    X.db = o.db; X.demo = !!o.demo; X.quitter = o.quitter; X.verrouiller = o.verrouiller; X.peutVerrouiller = o.peutVerrouiller; X.coquille = o.coquille;
    X.coquille.innerHTML = '<div class="squelette" role="status" aria-label="Chargement"><i class="s-titre"></i><div class="s-grille"><i></i><i></i><i></i></div></div>';
    var pret;
    if (X.demo) pret = charger();
    else pret = X.db.auth.getUser().then(function (r) {
      var u = r.data.user; S.role = ((u && u.app_metadata) || {}).role || "client";
      return X.db.from("personnes").select("*").eq("id", u.id).maybeSingle().then(function (p) {
        S.moi = p.data || { id: u.id, nom: u.email, role: S.role }; S.role = S.moi.role || S.role;
      });
    }).then(charger);
    return pret.then(function () { X.demarre = true; S.route = lireRoute(); dessiner(false); abonner(); })
      .catch(function (e) { X.coquille.textContent = ""; X.coquille.appendChild(el("p", { class: "erreur-page", text: "Le studio n'a pas pu se charger : " + e.message })); });
  }
  function fermer() { X.demarre = false; if (X.canal && X.db) { X.db.removeChannel(X.canal); X.canal = null; } if (V.quitterPresence) V.quitterPresence(); }

  return {
    S: S, X: X, V: V, el: el, signerMedias: signerMedias, revenir: revenir, foncee: foncee, icone: icone, fmt: fmt, iso: iso, hm: hm, quand: quand, ilya: ilya, memeJour: memeJour, joursEntre: joursEntre,
    debutJour: debutJour, ajouterJours: ajouterJours, lundi: lundi, pad: pad, uuid: uuid, initiales: initiales, enSaisie: enSaisie,
    RESERVES: RESERVES, STATUTS: STATUTS, ORDRE_STATUTS: ORDRE_STATUTS, RESEAUX: RESEAUX, FORMATS: FORMATS, ETAPES: ETAPES, HEURES: HEURES,
    pastilleStatut: pastilleStatut, pastillesReseaux: pastillesReseaux, logoEspace: logoEspace, urlEspace: urlEspace,
    espace: espace, espaceSlug: espaceSlug, personne: personne, publication: publication, media: media, prive: prive, mediasDe: mediasDe,
    commentairesDe: commentairesDe, comptesDe: comptesDe, estLili: estLili, publicationsVisibles: function () { return publicationsVisibles().filter(visible); },
    espacesActifs: espacesActifs, espacesClient: espacesClient, avance: avance, visible: visible, rubriquesClient: rubriquesClient,
    image: image, urlMedia: urlMedia, maj: maj, creer: creer, enregistrer: enregistrer, appel: appel, supprimer: supprimer, repondre: repondre, televerser: televerser, charger: charger,
    signaler: signaler, fenetre: fenetre, dessiner: dessiner, aller: aller, nouvellePublication: nouvellePublication, ouvrir: ouvrir, fermer: fermer
  };
})();
