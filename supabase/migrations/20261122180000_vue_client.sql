-- Accueil de l'espace d'un client (22/11/2026) : « classique » (accueil, validation, calendrier) ou « planning » (la base
-- des publications façon Notion, pour les clients habitués à Notion). Choisi par Lili dans la fiche du client.
alter table public.espaces add column if not exists vue_client text not null default 'classique' check (vue_client in ('classique', 'planning'));
