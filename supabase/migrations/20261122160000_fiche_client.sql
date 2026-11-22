-- Fiche client complète (22/11/2026) : le métier de la marque (« Fleuriste », « Café »…), affiché sur les cartes et
-- dans l'en-tête de son espace. Le reste de la fiche (comptes réseaux, heures par défaut, couverture, facturation)
-- existait déjà dans le schéma ; Lili le modifie désormais depuis l'application.
alter table public.espaces add column if not exists metier text;
