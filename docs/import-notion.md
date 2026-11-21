# Plan d'import Notion -> cockpit

> État au 21 novembre 2026 : export de « Mon espace CM » reçu et analysé (Markdown & CSV, sous-pages incluses).
> **Import réalisé le 21/11/2026** par `outils/import-notion.mjs --ecrire` (aperçu sans `--ecrire`), après validation
> d'Antonin de la liste des espaces, des comptes Palomano (ceux de Lille) et des logos et couleurs trouvés en ligne.
> Résultat en base : 11 espaces (10 logos, 6 couvertures), 19 comptes, 362 publications (241 visibles des clients),
> 136 visuels (124 vignettes, 12 vidéos) et 201 liens, 114 notes internes (texte des fiches Notion et colonnes NOTES /
> BROUILLONS), 33 tâches, 14 opérations, 4 absences, 47 factures (n° 42 à 91) et leurs PDF. Deux clients facturés
> autrefois sans espace : leurs factures sont gardées sans espace (objet = « Community management · <client> »).
> La correspondance client par client (marques, raisons sociales, comptes) est privée : `~/.lili/import-espaces.json`.
> Ce fichier est public : il décrit des structures et des volumes, jamais des contenus. Les noms des clients et la
> correspondance client par client sont dans `~/.lili/import-notion-clients.md` (hors dépôt).

## Méthode

1. Export décompressé dans `~/.lili/notion-export/` (dossier en 700, 331 Mo, 691 fichiers).
2. `node outils/notion-analyse.mjs` -> `~/.lili/notion-structure.md` (structure seulement).
3. Lecture des pages clés : accueil « Mon espace CM », « Édito & infos », « NOTES & TO DO », « Facturation »,
   « État de programmation », quelques fiches de publication par client.
4. Ce plan. Puis, après validation, `outils/import-notion.mjs` (étape 6) : mode aperçu d'abord, écriture dans
   `.donnees/` puis en base ; rejouable grâce à `notion_id` gardé sur chaque ligne importée.

## Ce que contient le Notion de Lili

| Élément Notion | Volume | Rôle aujourd'hui |
|---|---|---|
| Page d'accueil « Mon espace CM » | 1 | raccourcis (brief du jour, to do, facturation, calendriers), avancement des publications, à faire de la semaine, liste rapide sans date, échéances, liens vers les espaces clients, une citation |
| « Brief du jour » | lien | une page générée par Claude hors de Notion (lien claude.ai), ouverte chaque matin |
| « Édito & infos » | 1 page, 8 clients + 1 client partagé | une vignette (photo Unsplash) par client, qui ouvre son calendrier éditorial |
| Calendriers éditoriaux (une base par client ; un client a deux bases, Instagram et Facebook) | 7 bases, 373 publications | le cœur du travail : titre, date, format, statut, légende, visuels, case « Done » |
| Fiches de publication | ~370 pages | les mêmes champs, plus parfois des notes ; 138 visuels (jpg, png, mp4) rattachés |
| « Absences et vacances » | 1 base, 4 lignes | congés et télétravail de l'équipe d'un client, pour caler les publications |
| « État de programmation » | 1 base, 12 lignes | par client : programmé jusqu'au, avance en jours, statut coloré (en retard, urgent, à traiter cette semaine, OK, bonne avance), canaux, lien vers l'espace client |
| « Deadlines » et vues de tâches | 1 base, 17 tâches | tâches datées, liées à un client (tirages au sort, piges, reporting, épingler un post, stories) |
| Listes à cocher « NOTES & TO DO » et accueil | ~16 cases | liste rapide sans date en trois rubriques : Créations de visuels / vidéos, Programmation, Autre (des éléments personnels s'y mêlent) |
| « Facturation » › Clients | 1 base, 7 lignes | nom, actif, adresse, e-mail, SIRET, tarif mensuel HT, type de contrat (mensuel) |
| « Facturation » › Factures | 1 base, 47 factures (n° 42 à 91) | date, période (mois), HT, **TVA 20 %**, TTC, URSSAF 26,94 % du HT, « à virer » (HT - URSSAF), statut (acquittée / en attente), payée le, virée, PDF |
| Factures PDF | 47 | exports d'un logiciel de facturation externe |

Constats qui guident le cockpit :
- **Aucune validation client** dans Notion : elle se fait ailleurs (messages, mails). C'est le manque principal.
- **Statut et format sont mélangés** : la colonne FORMAT contient aussi « à programmer », « visuel à créer »,
  « à tourner » ; la colonne CATÉGORIE sert parfois de statut ; la case « Done » double le statut.
  Le cockpit sépare format, statut et étapes de création.
- **Un client écrit déjà ses propres idées** (colonne « Created by » sur un calendrier partagé) : le client doit pouvoir
  proposer des idées dans son espace.
- **Un client a plusieurs comptes** (page entreprise et profils LinkedIn de ses dirigeants, colonne CLIENT) : il faut des
  comptes par espace, chacun avec son nom et sa photo pour l'aperçu.
- **Les opérations commerciales du client** (colonne ACTUALITÉ : Noël, carte cadeau, jeu concours, Black Friday,
  calendrier de l'Avent, événements) structurent le calendrier : elles deviennent des opérations datées en fond du
  calendrier, auxquelles les publications se rattachent.
- **L'état de programmation est tenu à la main** : le cockpit le calcule tout seul à partir des publications.
- **Les légendes** sont vides pour 240 publications sur 373 ; 10 contiennent seulement le lien de la publication en ligne.
- **Rien sur** le brief et la ligne éditoriale, la veille (sauf des tâches « pige »), les partenariats, les rapports
  (sauf une tâche « reporting »), le temps passé : ces rubriques naissent vides dans le cockpit.

## Modèle cible (ce que le cockpit sait représenter)

| Objet du cockpit | Rôle | Champs principaux |
|---|---|---|
| `espaces` | un client / une marque | nom, raison sociale, logo, couleur, couverture, statut (actif, en pause, archivé), forfait mensuel HT, type de contrat, coordonnées de facturation (adresse, e-mail, SIRET), réseaux par défaut, note interne |
| `comptes` | comptes de l'espace sur les réseaux | espace, réseau, nom affiché, identifiant, photo de profil, rang (le compte principal en premier) |
| `membres` | qui accède à un espace | user, rôle (`proprietaire`, `client`, `invite`), nom affiché |
| `operations` | opérations commerciales d'un espace | espace, libellé, début, fin, couleur |
| `temps_forts` | fond du calendrier | jour ou période, libellé, type (`ferie`, `commercial`, `absence`), portée (tous ou un espace) |
| `publications` | l'objet central | espace, compte(s), réseaux, format, date et heure, fin (story sur plusieurs jours), légende, hashtags, mentions, lien, script de voix off, statut, étapes de création, opération, lien de la publication en ligne, auteur, note interne, visibilité, `notion_id` |
| `publication_medias` | visuels d'une publication, dans l'ordre | média, rang |
| `versions` | historique d'une publication | numéro, légende, médias, auteur, date |
| `commentaires` | fils sur une publication | cible (visuel avec position x/y, ou légende), parent, auteur, résolu, visibilité |
| `medias` | médiathèque | espace, fichier (Storage), type (image, vidéo, document), dossier, étiquettes, déposé par, visibilité |
| `taches` | tâches de Lili | espace (ou aucun), titre, statut (`a-faire`, `en-cours`, `en-revision`, `fait`), échéance, priorité, catégorie, `notion_id` |
| `briefs` | brief et ligne éditoriale | cible, ton, piliers, mots à utiliser / à éviter, charte, concurrents, objectifs |
| `veille`, `partenaires`, `rapports`, `temps`, `prospects` | rubriques de l'étape 7 | (vides à l'import) |
| `factures`, `devis` | facturation | numéro continu, date, période, lignes, HT, taux de TVA, TVA, TTC, statut, payée le, PDF, `notion_id` |
| `journal` | activité par espace | qui, quoi, quand : base des notifications |

Statuts de publication : `idee` -> `en-creation` -> `a-valider` -> `modifs-demandees` -> `valide` -> `programme` -> `publie`.
Étapes de création (cases sur une publication `en-creation`) : rédiger, tourner, monter, créer le visuel.

## Correspondance Notion -> cockpit

### Clients

| Notion | Cockpit | Transformation |
|---|---|---|
| Base « Clients » (facturation) | `espaces` | nom -> `raison_sociale` (c'est le nom de l'entité facturée, souvent différent de la marque), actif -> statut, adresse, e-mail, SIRET, tarif mensuel HT -> forfait, type de contrat ; rattachement à la marque d'après la réponse de Lili (question 3) |
| Pages clients de « Édito & infos » | `espaces` | rapprochement par le nom (sans émoticône ni casse) ; la photo de vignette devient la couverture provisoire |
| Lignes de « État de programmation » sans calendrier | `espaces` ou `comptes` | selon la réponse de Lili (question 3) |
| Client partagé (Notion d'un tiers) | `espaces` vide | absent de l'export : à importer depuis l'export de son propriétaire, ou à démarrer à neuf |
| « Canaux » (état de programmation) | `espaces.reseaux` | réseaux par défaut de l'espace |
| Couleur, logo, photo de profil | — | n'existent pas dans Notion : à fournir par Lili (ou récupérés plus tard) |

### Publications (les 7 calendriers éditoriaux)

| Notion | Cockpit | Transformation |
|---|---|---|
| PUBLICATIONS (titre) | `publications.titre` | tel quel ; 5 lignes sans titre et sans contenu ignorées |
| DATES | `date`, `fin` | « 21 novembre 2026 » -> date à l'heure par défaut du réseau (question 4) ; plage -> début et fin ; 38 sans date -> statut `idee` |
| Calendrier d'origine | `reseaux` | base Instagram -> Instagram, base Facebook -> Facebook ; colonne RÉSEAU si remplie ; sinon réseaux par défaut de l'espace. Pour le client à deux calendriers, une publication présente dans les deux le même jour avec le même titre devient une seule publication à deux réseaux |
| FORMAT | `format` | POST -> post ; CARROUSSEL / CARROUSEL -> carrousel ; REEL -> reel ; STORY -> story ; Couverture -> couverture (format ajouté) ; TIRAGE AU SORT -> post + étiquette « jeu concours » ; À PROGRAMMER, VISUEL À CRÉER, À TOURNER -> statut ou étapes (ligne suivante) |
| STATUT, CATÉGORIE (quand elle sert de statut), FORMAT parasite, Done | `statut`, `etapes` | voir le tableau des statuts |
| LÉGENDE / LEGENDE / Texte | `legende` | texte tel quel, hashtags repérés et copiés dans `hashtags` ; si la légende n'est qu'un lien -> `lien_en_ligne` |
| VISUEL / Fichiers et médias | `medias` + `publication_medias` | fichiers envoyés dans Storage `medias/<espace>/import-notion/`, ordre conservé |
| ACTUALITÉ | `operations` + `publications.operation_id` | une opération par valeur et par espace ; dates lues dans le libellé quand il en porte (« 27 nov 31 déc », « 22-25 avril »), sinon bornées par la première et la dernière publication rattachée ; émoticônes retirées |
| CLIENT (calendrier à plusieurs comptes) | `comptes` + `publications.compte_id` | un compte par valeur ; « A + B » -> deux comptes ; « Événements / actualités » -> compte principal |
| Created by | `auteur` | Lili -> Lili ; une personne du client -> membre client de l'espace (créé sans invitation tant que Lili ne l'invite pas) |
| NOTES, BROUILLONS | `note_interne` | visibles par Lili seulement |
| VOIX OFF | `script` | |
| cont@ct | `lien` | |

### Statuts

Règle, dans l'ordre : la première ligne qui s'applique l'emporte.

| Notion | Statut cockpit | Étapes cochées à faire |
|---|---|---|
| POSTÉ, ou Done = oui et date passée | `publie` | — |
| PROGRAMMÉ (toutes graphies), ou Done = oui et date à venir | `programme` | — |
| À PROGRAMMER, À POSTER | `valide` | — |
| À RÉDIGER | `en-creation` | rédiger |
| À TOURNER | `en-creation` | tourner |
| À MONTER | `en-creation` | monter |
| VISUEL À CRÉER | `en-creation` | créer le visuel |
| sans statut, Done = non, avec légende ou visuel | `en-creation` | — |
| sans statut, Done = non, ni légende ni visuel, ou sans date | `idee` | — |

Les publications en retard (date passée, ni programmées ni publiées) gardent leur statut et sont signalées dans
« Aujourd'hui ». Visibilité à l'import : `publie`, `programme` et `valide` -> `partage` (le client retrouve son
historique) ; `idee` et `en-creation` -> `interne`.

### Calendrier, tâches, suivi

| Notion | Cockpit | Transformation |
|---|---|---|
| « Absences et vacances » | `temps_forts` type `absence`, portée l'espace | Congés, TT -> libellé ; affichés en fond du calendrier de ce client |
| « Deadlines » | `taches` | Client -> espace ; Statut (Terminé / À faire) -> `fait` / `a-faire` (la case à cocher double le statut) ; échéance ; Catégorie -> catégorie |
| Listes à cocher de l'accueil et de « NOTES & TO DO » | `taches` sans échéance | rubrique -> catégorie (Créations, Programmation, Autre) ; espace deviné par le nom du client dans le titre, sinon aucun |
| Éléments personnels des listes | `taches` sans espace | importés avec les autres (question 6) |
| « Notes » de « NOTES & TO DO » | rien | notes personnelles, non importées |
| « État de programmation » | calcul automatique | « programmé jusqu'au » = dernière publication `programme` de l'espace ; avance = jours d'ici là ; pastille par seuil (question 8) ; affiché sur Aujourd'hui et sur la carte de chaque client. Les notes de la base -> note interne de l'espace |
| Raccourcis de l'accueil | barre latérale | Aujourd'hui, Tâches, Facturation, Calendrier |
| « Brief du jour » (page claude.ai) | page Aujourd'hui + assistant | même rôle, nourri par les vraies données du cockpit (question 7) |
| Citations sur les pages | une citation du jour sur Aujourd'hui | touche éditoriale reprise dans le design |

### Facturation

| Notion | Cockpit | Transformation |
|---|---|---|
| Base « Factures » | `factures` (historique) | n°, date, période, HT, taux 20 %, TVA, TTC, statut (Acquittée -> payée, En attente -> émise), payée le, PDF dans Storage `livrables/<espace>/factures/` ; rattachées à l'espace par le nom du client |
| URSSAF 26,94 %, « à virer » | calcul | affichés pour Lili seulement, taux réglable ; non stockés |
| « Viré » | `factures.viree` | case gardée |
| Numérotation | suite à 92 | trous constatés (48, 77, 78) : question 2 |

## Ce qui est abandonné, et pourquoi

- La case « Done » : remplacée par les statuts, qui disent la même chose sans contradiction possible.
- Les vues en double (« Sans titre ») : ce sont des filtres sur les mêmes bases ; le cockpit a ses propres vues.
- Le tableau « État de programmation » tenu à la main : calculé.
- Les vignettes Unsplash des clients : provisoires, remplacées par le logo et la couverture de chaque marque.
- Les notes personnelles de « NOTES & TO DO » : sans rapport avec l'activité.

## Questions pour Lili

1. ~~TVA~~ **Réglé le 21/11/2026** : Lili est redevable de la TVA depuis octobre 2024. Devis et factures à 20 %,
   sans la mention « art. 293 B » prévue au brief de départ (taux gardé par ligne, pour le cas d'une autre TVA).
2. **Réglé** : les numéros manquants (48, 77, 78) ne posent pas de problème ; l'historique est importé tel quel et la
   suite démarre à 92.
3. **Réglé le 21/11/2026** (liste des 11 espaces validée par Antonin). Rappel de la question : « État de programmation » compte 12 lignes pour 8 calendriers, et la base
   « Clients » de la facturation porte les raisons sociales, dont plusieurs ne ressemblent pas au nom de la marque.
   Pour chaque raison sociale : quelle marque ? Pour chaque ligne sans calendrier : espace à part, ou compte d'un autre
   espace ? Tableau à compléter : `~/.lili/import-notion-clients.md` (une recherche en ligne aide à le pré-remplir).
4. **Réglé** (« le plus pratique ») : heure par défaut selon le réseau, réglable par espace : Instagram, Facebook et
   TikTok 12 h 30, stories 9 h, LinkedIn 8 h 30, Pinterest 20 h, Google Business 10 h.
5. **Réglé** : tout l'historique est importé, depuis la première publication.
6. **Réglé** : pas de séparation ; les tâches personnelles sont importées avec les autres, sans espace client. Les
   « Notes » personnelles de « NOTES & TO DO » ne sont pas des tâches et restent hors du cockpit.
7. **Réglé** : le brief du jour devient un agent automatique, en continu 7 j / 7, comme dans Evoalys et le cockpit
   d'Antonin (fonction serveur lancée par pg_cron) : brief préparé chaque matin, puis tenu à jour au fil de la journée
   (validations, commentaires, retards, publications du jour). Étape 7.
8. **Réglé** : seuils validés (en retard sous 0 jour, urgent 0 à 2, cette semaine 3 à 7, OK 8 à 14, bonne avance au-delà).
9. **Réglé** : l'espace du client partagé est créé vide (son Notion n'était pas dans l'export).
10. **Réglé** : logos, couleurs et comptes cherchés en ligne (sources officielles), rangés dans `~/.lili/logos-clients/`
    et soumis à validation avant usage.
