-- Factures plus complètes (22/11/2026), sur le modèle des factures de Lili : TVA intracommunautaire du client
-- (facturation interne, jamais visible de lui) et référence du client (bon de commande) sur les factures et devis.
-- Mêmes tables, mêmes règles d'accès : rien de neuf à protéger.
alter table public.espaces_prive add column if not exists tva_intra text;
alter table public.factures add column if not exists reference text;
alter table public.devis add column if not exists reference text;
