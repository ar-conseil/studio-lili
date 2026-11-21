/* Données de démonstration (?demo, ou site sans base) : quatre marques FICTIVES, photos libres d'Unsplash.
   Les dates sont calculées autour d'aujourd'hui pour que la démonstration reste vivante. Rien n'est enregistré. */
window.DEMO_DONNEES = function () {
  "use strict";
  var J = 86400000, auj = new Date(); auj.setHours(0, 0, 0, 0);
  function jour(n, h, m) { var d = new Date(auj.getTime() + n * J); d.setHours(h || 12, m || 0, 0, 0); return d.toISOString(); }
  function u(id, w, h) { return "https://images.unsplash.com/photo-" + id + "?w=" + (w || 900) + "&h=" + (h || 1125) + "&fit=crop&q=72&auto=format"; }
  var LILI = "d0000000-0000-4000-a000-000000000001";
  var P = {
    ines: "d0000000-0000-4000-a000-0000000000a1", claire: "d0000000-0000-4000-a000-0000000000b1",
    hugo: "d0000000-0000-4000-a000-0000000000c1", sarah: "d0000000-0000-4000-a000-0000000000e1"
  };
  var E = {
    ondine: "e0000000-0000-4000-a000-00000000000a", lumiere: "e0000000-0000-4000-a000-00000000000b",
    sable: "e0000000-0000-4000-a000-00000000000c", ecrin: "e0000000-0000-4000-a000-00000000000e"
  };
  var PHOTOS = {
    bouquet: "1487530811176-3780de880c2d", tulipes: "1490750967868-88aa4486c946", fleur: "1525310072745-f49212b5ac6d",
    cafes: "1495474472287-4d71bcdd2085", latte: "1509042239860-f550ce710b93", cafe: "1501339847302-ac426a4a7cbb",
    poterie: "1493106641515-6b5631de4bb9", cadres: "1513519245088-0e12902e5a38",
    ongles: "1604654894610-df63bc536371", serum: "1515377905703-c4788e51af15", cheveux: "1522337360788-8b13dee7a37e",
    boutique: "1441986300917-64674bd600d8", portants: "1470309864661-68328b2cd0a5"
  };
  var espaces = [
    { id: E.ondine, slug: "maison-ondine", nom: "Maison Ondine", statut: "actif", couleur: "#3E5B4A", reseaux: ["instagram", "facebook"], ordre: 1, couverture_url: u(PHOTOS.tulipes, 1400, 600), metier: "Fleuriste" },
    { id: E.lumiere, slug: "cafe-lumiere", nom: "Café Lumière", statut: "actif", couleur: "#8A5A3C", reseaux: ["instagram", "facebook"], ordre: 2, couverture_url: u(PHOTOS.cafe, 1400, 600), metier: "Café" },
    { id: E.sable, slug: "atelier-sable", nom: "Atelier Sable", statut: "actif", couleur: "#2F4A6B", reseaux: ["linkedin", "instagram"], ordre: 3, couverture_url: u(PHOTOS.cadres, 1400, 600), metier: "Céramiste" },
    { id: E.ecrin, slug: "studio-ecrin", nom: "Studio Écrin", statut: "actif", couleur: "#9C4660", reseaux: ["instagram", "tiktok"], ordre: 4, couverture_url: u(PHOTOS.serum, 1400, 600), metier: "Onglerie" }
  ];
  var prives = [
    { espace_id: E.ondine, raison_sociale: "Ondine SARL (fictive)", forfait_mensuel_ht: 650, heures_forfait: 12 },
    { espace_id: E.lumiere, raison_sociale: "Lumière & Co (fictive)", forfait_mensuel_ht: 500, heures_forfait: 10 },
    { espace_id: E.sable, raison_sociale: "Atelier Sable (fictive)", forfait_mensuel_ht: 420, heures_forfait: 8 },
    { espace_id: E.ecrin, raison_sociale: "Écrin Beauté (fictive)", forfait_mensuel_ht: 480, heures_forfait: 9 }
  ];
  var comptes = [
    { id: "c1", espace_id: E.ondine, reseau: "instagram", nom_affiche: "maisonondine", identifiant: "maisonondine", rang: 0 },
    { id: "c2", espace_id: E.ondine, reseau: "facebook", nom_affiche: "Maison Ondine", rang: 1 },
    { id: "c3", espace_id: E.lumiere, reseau: "instagram", nom_affiche: "cafe.lumiere", rang: 0 },
    { id: "c4", espace_id: E.lumiere, reseau: "facebook", nom_affiche: "Café Lumière", rang: 1 },
    { id: "c5", espace_id: E.sable, reseau: "linkedin", nom_affiche: "Atelier Sable", rang: 0 },
    { id: "c6", espace_id: E.sable, reseau: "instagram", nom_affiche: "atelier.sable", rang: 1 },
    { id: "c7", espace_id: E.ecrin, reseau: "instagram", nom_affiche: "studio.ecrin", rang: 0 },
    { id: "c8", espace_id: E.ecrin, reseau: "tiktok", nom_affiche: "studio.ecrin", rang: 1 }
  ];
  var personnes = [
    { id: LILI, nom: "Lili Rouzier", role: "proprietaire" },
    { id: P.ines, nom: "Inès Morel", role: "client" }, { id: P.claire, nom: "Claire Dubois", role: "client" },
    { id: P.hugo, nom: "Hugo Lemaire", role: "client" }, { id: P.sarah, nom: "Sarah Benali", role: "client" }
  ];
  var membres = [
    { espace_id: E.ondine, personne_id: P.ines, role: "client", fonction: "Gérante" },
    { espace_id: E.lumiere, personne_id: P.claire, role: "client", fonction: "Responsable communication" },
    { espace_id: E.sable, personne_id: P.hugo, role: "client", fonction: "Fondateur" },
    { espace_id: E.ecrin, personne_id: P.sarah, role: "client", fonction: "Gérante" }
  ];
  // Médias : un par photo et par espace où elle sert
  var medias = [], n = 0;
  function media(espace, photo, dossier) {
    var id = "a0000000-0000-4000-a000-" + String(++n).padStart(12, "0");
    medias.push({ id: id, espace_id: espace, chemin: espace + "/" + id + ".jpg", type: "image", nom_fichier: photo + ".jpg", dossier: dossier || "Photos",
      etiquettes: [], visibilite: "partage", depose_par: LILI, cree_le: jour(-30 + n), url: u(PHOTOS[photo]), apercu_url: u(PHOTOS[photo], 480, 600) });
    return id;
  }
  var M = {
    bouquet: media(E.ondine, "bouquet", "Bouquets"), tulipes: media(E.ondine, "tulipes", "Saison"), fleur: media(E.ondine, "fleur", "Saison"),
    boutique: media(E.ondine, "boutique", "Boutique"),
    cafes: media(E.lumiere, "cafes", "Comptoir"), latte: media(E.lumiere, "latte", "Comptoir"), cafe: media(E.lumiere, "cafe", "Salle"),
    poterie: media(E.sable, "poterie", "Atelier"), cadres: media(E.sable, "cadres", "Exposition"),
    ongles: media(E.ecrin, "ongles", "Poses"), serum: media(E.ecrin, "serum", "Soins"), cheveux: media(E.ecrin, "cheveux", "Ambiance"),
    portants: media(E.ecrin, "portants", "Ambiance")
  };
  var operations = [
    { id: "o1", espace_id: E.ondine, libelle: "Couronnes de l'Avent", debut: jour(2).slice(0, 10), fin: jour(20).slice(0, 10), couleur: "#3E5B4A", visibilite: "partage" },
    { id: "o2", espace_id: E.lumiere, libelle: "Carte cadeau de Noël", debut: jour(-5).slice(0, 10), fin: jour(30).slice(0, 10), couleur: "#8A5A3C", visibilite: "partage" }
  ];
  var tempsForts = [
    { id: "t1", espace_id: E.lumiere, libelle: "Fermeture annuelle", debut: jour(33).slice(0, 10), fin: jour(40).slice(0, 10), type: "absence", visibilite: "partage" }
  ];
  var pubs = [], pm = [];
  function pub(o, visuels) {
    var id = "b0000000-0000-4000-a000-" + String(pubs.length + 1).padStart(12, "0");
    var p = Object.assign({ id: id, titre: "", reseaux: ["instagram"], format: "post", legende: "", hashtags: [], mentions: [], etapes: [], etiquettes: [],
      statut: "idee", visibilite: "interne", version_courante: 0, auteur_id: LILI, cree_le: jour(-25) }, o);
    if (["idee", "en-creation"].indexOf(p.statut) < 0) p.visibilite = "partage";
    if (p.statut !== "idee" && p.statut !== "en-creation") p.version_courante = p.version_courante || 1;
    pubs.push(p);
    (visuels || []).forEach(function (m, i) { pm.push({ publication_id: id, media_id: m, rang: i }); });
    return id;
  }
  // Maison Ondine
  pub({ espace_id: E.ondine, titre: "Le bouquet de saison", format: "carrousel", reseaux: ["instagram", "facebook"], date_prevue: jour(4, 12, 30), statut: "a-valider", envoye_le: jour(-1, 9),
    legende: "Le bouquet de saison est arrivé : renoncules, eucalyptus et une touche de cuivre pour accompagner les premiers froids. À composer en boutique ou à commander jusqu'à vendredi.", hashtags: ["fleuristelille", "bouquetdesaison", "maisonondine"], operation_id: null }, [M.bouquet, M.fleur, M.boutique]);
  pub({ espace_id: E.ondine, titre: "Atelier couronnes de l'Avent", format: "post", date_prevue: jour(6, 18), statut: "a-valider", envoye_le: jour(-2, 10), operation_id: "o1",
    legende: "Samedi, on fabrique ensemble sa couronne de l'Avent : sapin, baies et rubans. Six places par séance, réservation en boutique.", hashtags: ["atelierfloral", "couronnedelavent"] }, [M.tulipes]);
  pub({ espace_id: E.ondine, titre: "Coulisses du matin", format: "story", date_prevue: jour(0, 9), statut: "programme", legende: "6 h 30, arrivage du marché." }, [M.boutique]);
  pub({ espace_id: E.ondine, titre: "La fleur du mois", format: "post", date_prevue: jour(-6, 12, 30), statut: "publie", legende: "La renoncule, star de novembre.", hashtags: ["fleurdumois"] }, [M.fleur]);
  pub({ espace_id: E.ondine, titre: "Idée : vidéo composition en accéléré", format: "reel", statut: "idee", etapes: ["tourner", "monter"] }, []);
  pub({ espace_id: E.ondine, titre: "Tirage au sort de l'Avent", format: "post", date_prevue: jour(9, 12), statut: "en-creation", etapes: ["visuel"], operation_id: "o1",
    legende: "Pour fêter l'Avent, un bouquet à gagner chaque semaine." }, []);
  // Café Lumière
  pub({ espace_id: E.lumiere, titre: "Deux cafés, un samedi", format: "post", reseaux: ["instagram", "facebook"], date_prevue: jour(0, 12, 30), statut: "publie", legende: "Le samedi a le goût d'un flat white à deux.", hashtags: ["cafelille", "brunch"] }, [M.cafes]);
  pub({ espace_id: E.lumiere, titre: "Carte de Noël", format: "carrousel", date_prevue: jour(3, 12, 30), statut: "a-valider", envoye_le: jour(0, 8, 40), operation_id: "o2",
    legende: "Pain d'épices, chaï à la cannelle et chocolat chaud à l'ancienne : la carte de Noël arrive lundi.", hashtags: ["cartedenoel", "cafelumiere"] }, [M.latte, M.cafes]);
  pub({ espace_id: E.lumiere, titre: "Reel latte art", format: "reel", date_prevue: jour(1, 18), statut: "modifs-demandees", envoye_le: jour(-2), version_courante: 2,
    legende: "Trois gestes pour un cœur parfait.", script: "Plan serré sur la tasse, verser lentement, révéler le cœur." }, [M.latte]);
  pub({ espace_id: E.lumiere, titre: "La carte cadeau", format: "post", date_prevue: jour(7, 12, 30), statut: "valide", operation_id: "o2", legende: "Offrez une pause : la carte cadeau Café Lumière, dès 15 €." }, [M.cafe]);
  pub({ espace_id: E.lumiere, titre: "Nouvelle salle", format: "post", date_prevue: jour(-9, 12, 30), statut: "publie", legende: "Plus de place, même lumière." }, [M.cafe]);
  pub({ espace_id: E.lumiere, titre: "Brunch du dimanche", format: "story", date_prevue: jour(5, 9), statut: "programme", legende: "Réservez avant samedi midi." }, [M.cafes]);
  // Atelier Sable
  pub({ espace_id: E.sable, titre: "Les mains dans la terre", format: "article", reseaux: ["linkedin"], compte_id: "c5", date_prevue: jour(0, 8, 30), statut: "en-creation", etapes: ["rediger"],
    legende: "Vingt ans de tournage : ce que la terre m'a appris sur la patience et sur le métier." }, [M.poterie]);
  pub({ espace_id: E.sable, titre: "Exposition de décembre", format: "post", reseaux: ["instagram", "linkedin"], date_prevue: jour(2, 12, 30), statut: "programme", legende: "Douze pièces, une seule cuisson au bois. Vernissage jeudi 18 h." }, [M.cadres, M.poterie]);
  pub({ espace_id: E.sable, titre: "Portrait d'artisan", format: "article", reseaux: ["linkedin"], date_prevue: jour(-4, 8, 30), statut: "publie", legende: "Ce que j'ai appris en ouvrant mon atelier." }, [M.poterie]);
  // Studio Écrin
  pub({ espace_id: E.ecrin, titre: "Tendance noir laqué", format: "reel", reseaux: ["instagram", "tiktok"], date_prevue: jour(0, 19), statut: "a-valider", envoye_le: jour(-2, 11),
    legende: "Noir laqué et reflets dorés : la pose qui va tout changer cet hiver.", hashtags: ["nailart", "ongles", "studioecrin"] }, [M.ongles]);
  pub({ espace_id: E.ecrin, titre: "Soin du mois", format: "post", date_prevue: jour(8, 12, 30), statut: "en-creation", etapes: ["visuel"], legende: "Le soin hydratant qui sauve les mains en décembre." }, [M.serum]);
  pub({ espace_id: E.ecrin, titre: "Nos plus belles poses de novembre", format: "carrousel", date_prevue: jour(-2, 12, 30), statut: "publie", legende: "Merci pour ce mois de novembre !" }, [M.ongles, M.cheveux]);
  pub({ espace_id: E.ecrin, titre: "Idée de la cliente : avant / après", format: "reel", statut: "idee", auteur_id: P.sarah, visibilite: "partage" }, []);

  var commentaires = [
    { id: "k1", publication_id: pubs[0].id, auteur_id: LILI, cible: "visuel", media_id: M.bouquet, x: .58, y: .34, numero: 1, version: 1,
      contenu: "On garde ce cadrage serré pour la première image ? Les deux suivantes montrent la boutique.", resolu: false, visibilite: "partage", cree_le: jour(0, 8, 10) },
    { id: "k2", publication_id: pubs[7].id, auteur_id: P.claire, cible: "visuel", media_id: M.latte, x: .3, y: .62, numero: 1, version: 1,
      contenu: "On peut garder la tasse en premier plan, mais sans le pot de fleurs ?", resolu: false, visibilite: "partage", cree_le: jour(0, 14, 20) },
    { id: "k3", publication_id: pubs[8].id, auteur_id: P.claire, cible: "general", version: 1,
      contenu: "Plus court au début, et la musique plus douce s'il te plaît.", resolu: false, visibilite: "partage", cree_le: jour(-1, 17) },
    { id: "k4", publication_id: pubs[1].id, auteur_id: P.ines, cible: "legende", version: 1,
      contenu: "Parfait pour moi, on peut programmer.", resolu: false, visibilite: "partage", cree_le: jour(-1, 19) },
    { id: "k5", publication_id: pubs[0].id, auteur_id: LILI, cible: "general", version: 1,
      contenu: "Penser à recadrer la 3e image pour Facebook.", resolu: false, visibilite: "interne", cree_le: jour(0, 8, 15) }
  ];
  var versions = [
    { id: "v1", publication_id: pubs[8].id, numero: 1, titre: "Reel latte art", legende: "Trois gestes pour un cœur parfait, et une tasse qui fait du bien.", medias: [M.latte], cree_le: jour(-3) },
    { id: "v2", publication_id: pubs[8].id, numero: 2, titre: "Reel latte art", legende: "Trois gestes pour un cœur parfait.", medias: [M.latte], cree_le: jour(-2) },
    { id: "v3", publication_id: pubs[0].id, numero: 1, titre: "Le bouquet de saison", legende: pubs[0].legende, medias: [M.bouquet, M.fleur, M.boutique], cree_le: jour(-1, 9) }
  ];
  var taches = [
    { id: "t-1", titre: "Reporting de novembre", espace_id: E.lumiere, statut: "a-faire", echeance: jour(-1).slice(0, 10), priorite: "haute", categorie: "Autre" },
    { id: "t-2", titre: "Planning de décembre à positionner", espace_id: null, statut: "a-faire", echeance: jour(0).slice(0, 10), priorite: "moyenne", categorie: "Programmation" },
    { id: "t-3", titre: "Tirage au sort de l'Avent", espace_id: E.ondine, statut: "a-faire", echeance: jour(2).slice(0, 10), priorite: "moyenne", categorie: "Programmation" },
    { id: "t-4", titre: "Monter le reel de l'équipe", espace_id: E.ecrin, statut: "en-cours", echeance: null, priorite: "moyenne", categorie: "Créations" },
    { id: "t-5", titre: "Payer la CFE", espace_id: null, statut: "a-faire", echeance: jour(5).slice(0, 10), priorite: "haute", categorie: "Autre" }
  ];
  var journal = [
    { id: 1, espace_id: E.lumiere, acteur_id: P.claire, action: "publication.statut", objet_id: pubs[8].id, details: { de: "a-valider", vers: "modifs-demandees", titre: "Reel latte art" }, visibilite: "partage", cree_le: jour(-1, 17) },
    { id: 2, espace_id: E.ondine, acteur_id: P.ines, action: "commentaire.ajoute", objet_id: pubs[1].id, details: { titre: pubs[1].titre }, visibilite: "partage", cree_le: jour(-1, 19) },
    { id: 3, espace_id: E.ecrin, acteur_id: P.sarah, action: "publication.idee", objet_id: pubs[pubs.length - 1].id, details: { titre: "Idée de la cliente : avant / après" }, visibilite: "partage", cree_le: jour(-1, 11) }
  ];
  return { lili: LILI, personnesDemo: P, espaces: espaces, espaces_prive: prives, comptes: comptes, personnes: personnes, membres: membres,
    medias: medias, publications: pubs, publication_medias: pm, commentaires: commentaires, versions: versions, operations: operations,
    temps_forts: tempsForts, taches: taches, journal: journal, notes_internes: [{ id: "n1", espace_id: E.ondine, publication_id: pubs[0].id, contenu: "Inès préfère les visuels sans texte." }] };
};
