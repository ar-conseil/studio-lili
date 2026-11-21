# Studio Lili — consignes pour Claude

Le cockpit de **Lili Rouzier**, community manager freelance (micro-entreprise) : l'outil dans lequel elle travaille avec
ses clients, en direct, à deux. Nom de travail « studio-lili » ; le nom définitif, le logo et le nom de l'assistant IA
seront choisis par Lili et vivront dans **une seule constante** (`assets/marque.js`, à créer à l'étape 4).
Langue : français, sans émoticônes, ni dans l'interface ni dans les commits.

Modèle assumé : le cockpit d'Antonin (dépôt `ar-conseil/cockpit`, clone local `~/cockpit`). On reprend son architecture
et sa qualité ; **on ne touche jamais à ce dépôt ni à sa base Supabase**.

## Architecture (reprise du cockpit d'Antonin)
- Site statique sans build, GitHub Pages (dépôt PUBLIC `ar-conseil/studio-lili`, branche `main`, racine) :
  `index.html`, `assets/app.js`, `assets/style.css`, `assets/config.js` (URL + clé anon, écrit par `outils/deployer.sh`).
- supabase-js en CDN (version épinglée), polices par Google Fonts, aucune autre dépendance lourde.
- Coquille façon Notion : barre latérale fixe, barre fine avec fil d'Ariane, seule la page change (transition de vue),
  pas de flou d'arrière-plan, barre d'onglets en bas sur téléphone. Raccourcis clavier, PWA installable, temps réel.
- Identité : **piste « Papier »** (choisie le 21/11/2026) : papier crème #FBF8F3, barre latérale #F4EFE7, encre chaude
  #1E1A17, filets #E7E0D5, accent terre cuite #A9553A ; titres en Bodoni Moda 500, texte en Geist, heures et
  montants en Geist Mono ; cartes blanches bordées d'un filet (rayon 16 px), images arrondies 10 px ; citations et
  commentaires des clients en Bodoni italique. Référence : `maquettes/maquette.html?piste=papier`. Les pistes Galerie
  et Atelier sont écartées.
- Cache GitHub Pages (10 min) : à chaque modification de `app.js` ou `style.css`, changer `?v=AAAAMMJJx` dans `index.html`.

## Différence majeure avec le cockpit d'Antonin : plusieurs personnes
| Rôle | Qui | Voit |
|---|---|---|
| `proprietaire` | Lili | tout (clients, notes internes, temps, facturation, prospects) |
| `client` | une ou plusieurs personnes par marque | uniquement son espace, et seulement ce qui est `partage` |
| `invite` | photographe, partenaire, freelance | seulement les éléments partagés avec lui |

- Inscriptions fermées ; Lili invite depuis le cockpit (lien magique Supabase Auth). Connexion par lien ou mot de passe.
- Tables `espaces` (un par client/marque) et `membres` (`espace_id`, `user_id`, `role`) ; RLS sur CHAQUE table.
- Tout élément porte `visibilite` (`interne` | `partage`) ; `interne` ne sort jamais vers un client.
  Un client ne voit jamais : notes internes, temps passé, facturation, autres clients, statuts `idee` et `en-creation`
  (sauf partage explicite par Lili).
- Tests SQL des politiques (`supabase/tests/`) lancés avant chaque déploiement : un client A ne voit jamais un post du
  client B, ni une note interne de son propre espace.
- Storage : buckets `medias` et `livrables`, chemins `espace_id/...`, politiques alignées sur `membres`.
- `grant` explicites et `alter publication supabase_realtime add table` pour ce qui doit bouger en direct.
- Journal d'activité par espace : base des notifications et de l'historique.

## Où sont les choses
- Le studio (étape 4) : `assets/studio.js` = noyau (état `Studio.S`, lecture et écriture Supabase ou démonstration,
  adresses signées des fichiers, coquille, routeur, raccourcis, temps réel). Pages dans `assets/vues/` :
  `communs.js` (cartes, aperçus fidèles Instagram / Facebook / LinkedIn / TikTok / Pinterest / Google dessinés en
  HTML, bulles épinglées), `lili.js` (Aujourd'hui, page client et rubriques, publications), `calendrier.js` (mois,
  semaine, liste, glisser, fériés et temps forts calculés, opérations et absences en bandes), `publication.js` (fiche,
  visuels du carrousel, commentaires épinglés, fil, versions comparées), `client.js` (accueil client, validation en
  deux gestes, médiathèque). Styles : `assets/studio.css` (piste Papier, téléphone compris).
- Adresses : `#`, `#calendrier?vue=mois|semaine|liste&jour=…&client=…`, `#publications?statut=…`, `#mediatheque`,
  `#p/<id>`, `#valider` (client), `#<slug-client>` et `#<slug>/calendrier|publications|mediatheque`.
  Clavier : N nouvelle publication, 0 accueil, C calendrier, P publications, M médiathèque, 1-9 clients, Échap retour,
  ← → rubriques ou période du calendrier, T aujourd'hui.
- Étape 5, en direct et notifications : `assets/vues/direct.js` (présence Realtime sur `#p/<id>` : avatars de qui
  regarde, « … écrit » diffusé sans rien enregistrer ; cloche des notifications et abonnement de l'appareil au Web Push).
  Base : `supabase/migrations/20261121120000_mails_notifications.sql` (table `comptes_mail` : jetons Gmail jamais
  lisibles par le navigateur ; déclencheur `journal_notifier` : un client qui agit prévient Lili ; Lili prévient les
  clients seulement pour ce qui vient de son geste et leur est destiné : envoi pour validation, publication en ligne,
  commentaire ou message partagé. Jamais d'e-mail à un client sans un clic de Lili ; rien d'interne ne part).
  Fonctions : `supabase/functions/notifier` (pg_cron toutes les 5 min : un Web Push par personne et par passage ; un
  e-mail groupé par client quand la plus ancienne nouveauté a 10 min, envoyé depuis le Gmail de Lili ; GET = clé
  publique VAPID ; POST {test} = essai), `connexion-google` (relier le Gmail de Lili, OAuth, état signé),
  `messagerie` (Gmail : dossiers, liste, lecture, pièces, ranger, envoyer, brouillon ; Lili avec code seulement).
  Partagé : `_partage/commun.ts` (appelant, aal2, clé de synchro), `google.ts`, `gmail.ts` (repris du cockpit).
  Clés : `~/.lili/vapid.env` et `~/.lili/cle-synchro` (créées par le déploiement), secrets Supabase.
- Page Mails (`#mails`, touche E, Lili seule) : `assets/vues/mails.js` ; HTML des mails dans un iframe isolé, images
  distantes bloquées jusqu'au clic ; expéditeur rapproché de son client (adresse d'un membre).
- **Démonstration** : `?demo` (comme Lili) ou `?demo=<slug>` (comme la cliente de cette marque), données fictives de
  `assets/demo.js` (dates calculées autour d'aujourd'hui), rien n'est enregistré ; un sélecteur « Voir comme » est dans
  la barre latérale. Sert aussi à vérifier chaque écran avant mise en ligne.
- Entrée et coquille : `index.html`, `assets/app.js`, `assets/style.css`. `assets/marque.js` = LA constante du nom de
  l'outil, de la propriétaire, de l'assistant et des fichiers du logo. `assets/config.js` vide = mode aperçu
  (écrans visibles sans base ; `?ecran=code|enrolement|nouveau|app` pour en voir un).
- Entrée comme Evoalys : e-mail + mot de passe (ou lien par e-mail), puis **code à 6 chiffres** (Supabase MFA TOTP,
  QR code à scanner à la première connexion). Code obligatoire pour Lili et les invités, facultatif pour les clients
  (`app_metadata.role = "client"`, posé côté serveur). Code redemandé après 30 min d'absence ou d'inactivité, et par
  « Verrouiller » ; 5 codes faux = déconnexion. Les politiques RLS de Lili exigeront `aal2` (étape 3).
- Application installable (`manifest.webmanifest`, `sw.js` sans cache) : bouton « Installer l'application » (Chrome,
  Edge : bureau du Mac ou du PC), astuce affichée sur iPhone (Partager › Sur l'écran d'accueil) et Safari Mac
  (Fichier › Ajouter au Dock).
- Logo (piste « Didone » choisie le 21/11/2026, LR en Bodoni Moda, filet terre cuite) : `assets/marque/` ;
  `outils/logo/dessiner.py <polices>` vectorise les lettres (fonttools + uharfbuzz, dans un environnement Python à
  part), `outils/logo/icones.sh` rend les PNG avec Chrome sans écran. Les deux autres pistes restent dans
  `assets/marque/pistes/` (planche : `pistes/planche.html`).
- Aperçu local : `python3 -m http.server 8772 --bind 127.0.0.1` à la racine (le port 8771 est pris par un autre outil).
- `docs/import-notion.md` : plan de correspondance Notion -> cockpit (à valider par Antonin avant tout import).
- `outils/notion-analyse.mjs` : lit l'export Notion (`~/.lili/notion-export/`) et décrit sa STRUCTURE (bases, colonnes,
  valeurs des statuts, arborescence) sans recopier de contenu client. Sortie dans `~/.lili/` uniquement.
- `supabase/migrations/20261121100000_studio.sql` : tout le schéma, les fonctions de droits, les automatismes et le
  temps réel ; `20261121110000_stockage.sql` : fichiers (buckets `medias`, `livrables`, chemins `<espace_id>/...`).
  Ce que le client ne voit jamais est dans des tables à part (`espaces_prive`, `notes_internes`, `taches`, `temps`,
  `factures`, `devis`, `prospects`) plutôt que dans des colonnes : une politique ne filtre que des lignes.
  Droits : `est_proprietaire()` (rôle « proprietaire » ET jeton aal2 = code saisi), `role_dans(espace)`,
  `peut_lire(espace, visibilite)`, `peut_lire_publication(id)`, `partage_avec_moi(type, id)` pour les invités.
  Toutes renvoient vrai ou faux, jamais NULL (coalesce) : un NULL a déjà laissé passer un client chez un autre.
  Paramètres des fonctions SQL préfixés `p_` quand une colonne porte le même nom (sinon la colonne l'emporte).
  Un client ne change un statut que par `repondre_publication(id, 'valide' | 'modifs-demandees', message)`.
  Une version est figée à chaque passage « à valider » (c'est ce que le client compare). Facture émise : numéro
  suivant (suite de Notion : 92). Les automatismes qui imposent « partage » ne jouent que pour un client connecté
  (l'import et les fonctions serveur, sans personne connectée, décident eux-mêmes).
- Tests des droits : `supabase/tests/droits.sql` (une transaction annulée, « ÉCHEC : … » au premier écart). En local :
  `npm test` (PGlite + `supabase/tests/supabase-local.sql`, imitation d'auth et de storage) ; en ligne : étape 3 du
  déploiement. Tout nouveau droit = un test qui le prouve, et un test qui prouve le refus.
- `outils/deployer.sh [--proprietaire <e-mail>]` : tests locaux, migrations (`~/.lili/migrations-appliquees`), tests en
  ligne, réglages de connexion (inscriptions fermées, TOTP, Google et Microsoft si `~/.lili/oauth.env`), fonctions,
  `assets/config.js` ; `--proprietaire` invite Lili et pose son rôle côté serveur.
- Connexion par Google ou Microsoft : boutons sur l'écran d'entrée ; seuls les comptes déjà invités entrent (même
  adresse e-mail), le code à 6 chiffres est demandé ensuite comme pour le mot de passe.

## Secrets et données (règles absolues)
- Secrets dans `~/.lili/` (dossier en 700, jamais dans le dépôt) : `supabase.env` (SUPABASE_ACCESS_TOKEN,
  SUPABASE_PROJECT_REF), export Notion, notes. Seule la clé anon va dans `assets/config.js`.
- **Ne jamais lancer `supabase login`** : le CLI du Mac est connecté au compte du club (hvb-app). Le CLI n'est pas
  installé globalement : `npx --yes supabase@<version>` avec `SUPABASE_ACCESS_TOKEN` lu dans `~/.lili/supabase.env`.
- `ANTHROPIC_API_KEY` : secret Supabase uniquement.
- Aucune donnée client dans le dépôt ni dans les journaux en clair. Données de départ dans `.donnees/` (gitignoré).
- Données de démonstration : marques fictives uniquement, présentées comme telles.
- Jamais de publication sur un réseau social ni d'e-mail à un client sans un clic de Lili.
- Aucune suppression définitive sans confirmation ; corbeille de 30 jours pour publications et médias.

## Ordre de travail et état
1. Lecture du modèle + plan d'import Notion + ce fichier -> validation d'Antonin. **En attente de validation**
   (21 novembre 2026) : modèle lu, export analysé, plan rédigé, 9 questions ouvertes pour Lili en fin de plan.
2. Trois pistes visuelles (maquettes HTML statiques) -> choix. **Fait : piste « Papier » choisie le 21/11/2026** : `maquettes/`
   (Papier, Galerie, Atelier ; `maquette.html?piste=…&vue=aujourdhui|validation`, captures dans `maquettes/captures/`,
   marques fictives et photos Unsplash). Logos et couleurs des vrais clients trouvés en ligne : `~/.lili/logos-clients/`
   (hors dépôt), à valider.
3. Schéma Supabase complet + RLS + tests de droits. **Fait le 21/11/2026** (tests locaux au vert ; à rejouer en ligne au
   premier déploiement, dès que le projet Supabase existe).
4. Coquille, Aujourd'hui, Clients, Calendrier, Publication avec aperçus, validation client, commentaires épinglés, médiathèque.
   **Fait le 21/11/2026** (vérifié en démonstration sur ordinateur et téléphone : validation, demande de modification,
   bulle épinglée, glisser du calendrier). Pas encore : présence en direct, notifications (étape 5), grille Instagram,
   tâches en colonnes.
5. Temps réel (présence, commentaires, statuts), notifications e-mail et Web Push. **Fait le 21/11/2026**, plus la page
   Mails (Gmail de Lili). À faire par Lili : relier sa boîte Gmail (page Mails), activer les notifications sur ses
   appareils (cloche). Les e-mails aux clients partent dès que sa boîte est reliée.
6. Import réel des données Notion.
7. Brief, Veille, Partenariats, Rapports, Temps & facturation, Prospects, assistant IA.
8. PWA, page de connexion, page de confidentialité (RGPD, hébergement Supabase UE).
9. Recette : espace « client démo » (marque fictive), parcours complets ordinateur et téléphone, tests RLS, Lighthouse > 90.
10. Guides : `docs/guide-lili.md` et « Comment valider vos publications ».

Après chaque étape : commit clair, mise à jour de ce fichier, note à Antonin (ce qui est fait, ce qu'il doit faire).

## Décisions
- 21/11/2026 : **connexion Google** : projet Google Cloud « Studio Lili » (`studio-lili-515417`, compte d'Antonin),
  client OAuth web (retours : `…supabase.co/auth/v1/callback` et `…/functions/v1/connexion-google` pour Gmail), clés
  dans `~/.lili/oauth.env`, activée dans Supabase. Passage « en production » à confirmer par Antonin (bouton refusé
  par la sécurité de l'agent) ; sinon seuls les utilisateurs test peuvent entrer avec Google. Microsoft : reporté
  (le bouton reste masqué tant que le fournisseur n'est pas actif, lu dans les réglages publics de Supabase).
- 21/11/2026 : **projet Supabase `studio-lili`** (ref `jilxunfapbtqtrgkxdha`, Paris eu-west-3, instance Micro) dans
  l'organisation « Lili Rouzier » du compte Supabase du club (antonin.rouzier@harnes-volleyball.fr), passée au **plan Pro**
  (25 $/mois, plafond de dépenses actif) : le compte avait déjà ses 2 projets gratuits. Clé d'accès « studio-lili
  deploiement » limitée à ce seul projet (vérifié : elle ne voit que lui), sans expiration, dans `~/.lili/supabase.env`.
  Schéma déployé et tests des droits passés en ligne le 21/11/2026. Même jour, à la demande d'Antonin, les projets
  `hvb-app` (club) et `palomano-equipe` ont été transférés dans cette organisation Pro (environ 45 $/mois au total) ;
  le cockpit d'Antonin est sur un autre compte Supabase et n'a pas bougé ; Evoalys est chez Scaleway.
  Compte propriétaire de Lili créé (rôle « proprietaire » côté serveur et dans `personnes` ; son adresse n'est pas
  écrite ici, dépôt public) ; lien d'invitation (24 h) dans `~/.lili/invitation.txt`. L'envoi d'e-mails intégré de
  Supabase ne sert que les membres de l'organisation : invitations et notifications aux clients demanderont un
  service d'envoi (étape 5). Mot de passe de la base généré par Supabase, non
  conservé (inutile : tout passe par l'API d'administration ; le régénérer dans le tableau de bord au besoin).
- 21/11/2026 : **les mails de Lili (Gmail) dans son cockpit**, comme la page Mails du cockpit d'Antonin (fonction
  `messagerie`, Gmail par OAuth). À faire à l'étape 5, avec le client OAuth Google qui sert aussi à « Continuer avec Google ».
- 21/11/2026 : dépôt local `~/studio-lili` (à côté de `~/cockpit`), branche `main` ; dépôt GitHub public créé.
- 21/11/2026 : **Lili est redevable de la TVA depuis octobre 2024** (factures à 20 %). Pas de mention « art. 293 B »
  (le brief de départ se trompait). Taux de TVA stocké par ligne de devis / facture.
- 21/11/2026 : export Notion reçu (`~/.lili/notion-export/`, 373 publications, 47 factures n° 42 à 91, 138 visuels).
  Plan de correspondance dans `docs/import-notion.md` ; correspondance client par client dans
  `~/.lili/import-notion-clients.md` (hors dépôt). Constats retenus pour le modèle : comptes multiples par espace
  (profils LinkedIn des dirigeants), opérations commerciales datées, étapes de création séparées du statut,
  clients qui proposent des idées, état de programmation calculé et non saisi.
- 21/11/2026 (réponses d'Antonin) : tout l'historique importé ; numéros de facture manquants sans importance (suite à 92) ;
  heure par défaut par réseau ; tâches perso non séparées ; seuils d'avance validés ; logos et couleurs des clients
  cherchés en ligne puis validés (`~/.lili/logos-clients/`) ; **brief du jour = agent automatique en continu 7 j / 7**
  (fonction serveur + pg_cron, comme Victor et Evoalys).
- 21/11/2026 : **entrée par code, comme Evoalys** (« mot de passe et code à 6 chiffres ») : connexion e-mail + mot de
  passe (ou lien magique), puis code à 6 chiffres d'une application d'authentification (Supabase MFA, TOTP). L'app
  s'installe sur le bureau et l'écran d'accueil (PWA). Logo de Lili : sobre et classe (`assets/marque/`).
