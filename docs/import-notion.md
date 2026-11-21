# Plan d'import Notion -> cockpit

> État au 21 novembre 2026 : **en attente de l'export** de « Mon espace CM » (Markdown & CSV, sous-pages incluses).
> Ce document a deux moitiés : le modèle cible du cockpit (prêt) et la correspondance avec le Notion de Lili
> (à remplir après analyse de l'export). Rien ne sera importé avant la validation d'Antonin.
> Ce fichier est public (dépôt GitHub) : il décrit des structures, jamais des contenus. Les noms de clients
> n'y figurent pas ; ils restent dans `~/.lili/notion-structure.md`.

## Méthode

1. Export Notion décompressé dans `~/.lili/notion-export/` (hors dépôt, dossier en 700).
2. `node outils/notion-analyse.mjs` -> `~/.lili/notion-structure.md` : arborescence, bases, colonnes et leur type,
   valeurs des statuts et des listes de choix, pages modèles, médias. Aucun texte de page recopié.
3. Lecture des pages clés (routines, modèles, brief) pour comprendre les usages, pas seulement les champs.
4. Tableau de correspondance ci-dessous, rempli base par base et propriété par propriété, avec ce qui est
   amélioré dans le cockpit et ce qui est volontairement abandonné.
5. Validation d'Antonin, puis script d'import `outils/import-notion.mjs` (étape 6) : écrit dans `.donnees/` puis en
   base par l'API d'administration, rejouable (identifiant Notion gardé dans `notion_id`), avec un mode aperçu.

## Modèle cible (ce que le cockpit sait représenter)

| Objet du cockpit | Rôle | Champs principaux |
|---|---|---|
| `espaces` | un client / une marque | nom, logo, couleur de marque, comptes par réseau (nom affiché, photo de profil), forfait mensuel, statut (actif, en pause, archivé) |
| `membres` | qui accède à un espace | user, rôle (`proprietaire`, `client`, `invite`), nom affiché |
| `publications` | l'objet central | espace, réseaux, format (post, carrousel, reel, story, article LinkedIn), date et heure, légende, hashtags, mentions, lien, statut, note interne, visibilité |
| `publication_medias` | visuels d'une publication, dans l'ordre | média, rang |
| `versions` | historique d'une publication | numéro, légende, médias, auteur, date |
| `commentaires` | fils sur une publication | cible (visuel avec position x/y, ou légende), parent, auteur, résolu, visibilité |
| `medias` | médiathèque | espace, fichier (Storage), dossier, étiquettes, déposé par, visibilité |
| `taches` | tâches de Lili | espace, titre, statut (a-faire, en-cours, en-revision, fait), échéance, priorité |
| `briefs` | brief et ligne éditoriale | cible, ton, piliers, mots à utiliser / à éviter, charte (couleurs, typos, logos), concurrents, objectifs |
| `temps_forts` | événements en fond du calendrier | jour ou période, libellé, portée (tous clients ou un espace) |
| `veille` | comptes suivis et trouvailles | espace, compte, lien, capture, note, transformé en publication |
| `partenaires` | influenceurs et partenaires | compte, audience, contact, statut, contreparties, échanges, publications liées |
| `rapports` | chiffres mensuels | espace, mois, réseau, abonnés, portée, engagement, meilleures publications, commentaire |
| `temps` | temps passé | espace, jour, durée, tâche ou publication, note |
| `devis`, `factures` | facturation micro-entreprise | numérotation continue, lignes, mention art. 293 B du CGI |
| `prospects` | pipeline commercial | contact, étape (contact, premier échange, proposition, signé) -> devient un espace |
| `journal` | activité par espace | qui, quoi, quand : base des notifications |

Statuts de publication : `idee` -> `en-creation` -> `a-valider` -> `modifs-demandees` -> `valide` -> `programme` -> `publie`.
Visibilité par défaut : `interne` pour les idées, notes, temps et facturation ; `partage` à partir de `a-valider`.

## Correspondance Notion -> cockpit

_À remplir après l'analyse de l'export._

| Notion (base / page / propriété) | Cockpit | Transformation | Remarques |
|---|---|---|---|
| | | | |

### Valeurs de statut

| Statut Notion | Statut cockpit |
|---|---|
| | |

### Ce que Notion fait et que le cockpit doit reprendre (usages, vues, routines, modèles)

_À remplir._

### Ce qui est abandonné, et pourquoi

_À remplir._

### Questions pour Lili

_À remplir._
