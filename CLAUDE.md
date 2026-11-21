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
- Identité propre à Lili (plus éditoriale et chaleureuse) : trois pistes visuelles à proposer, choix d'Antonin avant
  de généraliser (étape 2). Tant que rien n'est choisi, ne pas figer de palette.
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
- `docs/import-notion.md` : plan de correspondance Notion -> cockpit (à valider par Antonin avant tout import).
- `outils/notion-analyse.mjs` : lit l'export Notion (`~/.lili/notion-export/`) et décrit sa STRUCTURE (bases, colonnes,
  valeurs des statuts, arborescence) sans recopier de contenu client. Sortie dans `~/.lili/` uniquement.
- `supabase/migrations/` : schéma (étape 3). `supabase/functions/` : fonctions serveur (notifications, assistant…).
- `outils/deployer.sh` (à écrire, sur le modèle de celui d'Antonin) : migrations, fonctions, cron, `assets/config.js`.

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
2. Trois pistes visuelles (maquettes HTML statiques) -> choix.
3. Schéma Supabase complet + RLS + tests de droits.
4. Coquille, Aujourd'hui, Clients, Calendrier, Publication avec aperçus, validation client, commentaires épinglés, médiathèque.
5. Temps réel (présence, commentaires, statuts), notifications e-mail et Web Push.
6. Import réel des données Notion.
7. Brief, Veille, Partenariats, Rapports, Temps & facturation, Prospects, assistant IA.
8. PWA, page de connexion, page de confidentialité (RGPD, hébergement Supabase UE).
9. Recette : espace « client démo » (marque fictive), parcours complets ordinateur et téléphone, tests RLS, Lighthouse > 90.
10. Guides : `docs/guide-lili.md` et « Comment valider vos publications ».

Après chaque étape : commit clair, mise à jour de ce fichier, note à Antonin (ce qui est fait, ce qu'il doit faire).

## Décisions
- 21/11/2026 : dépôt local `~/studio-lili` (à côté de `~/cockpit`), branche `main` ; dépôt GitHub public créé.
- 21/11/2026 : **Lili est redevable de la TVA depuis octobre 2024** (factures à 20 %). Pas de mention « art. 293 B »
  (le brief de départ se trompait). Taux de TVA stocké par ligne de devis / facture.
- 21/11/2026 : export Notion reçu (`~/.lili/notion-export/`, 373 publications, 47 factures n° 42 à 91, 138 visuels).
  Plan de correspondance dans `docs/import-notion.md` ; correspondance client par client dans
  `~/.lili/import-notion-clients.md` (hors dépôt). Constats retenus pour le modèle : comptes multiples par espace
  (profils LinkedIn des dirigeants), opérations commerciales datées, étapes de création séparées du statut,
  clients qui proposent des idées, état de programmation calculé et non saisi.
