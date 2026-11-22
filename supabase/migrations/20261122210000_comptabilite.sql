-- Comptabilité et suivi (22/11/2026) : factures automatiques de fin de mois, suivi des envois et des relances,
-- compte pro relié (Revolut Business) en lecture seule. Lili seule (code saisi) ; rien de tout ceci n'est visible d'un client.

-- 1. Factures : envoi et relance suivis, mois des factures automatiques (une seule par client et par mois)
alter table public.factures add column if not exists envoyee_le timestamptz;
alter table public.factures add column if not exists relancee_le timestamptz;
alter table public.factures add column if not exists auto_mois text check (auto_mois is null or auto_mois ~ '^\d{4}-\d{2}$');
create unique index if not exists factures_auto_unique on public.factures (espace_id, auto_mois) where auto_mois is not null;

-- 2. Fiche client (facturation interne) : facture automatique chaque fin de mois, et son libellé
alter table public.espaces_prive add column if not exists facture_auto boolean not null default false;
alter table public.espaces_prive add column if not exists facture_libelle text;

-- 3. Préparer les factures du mois : un brouillon par client actif « facture automatique » avec un forfait mensuel.
--    Lancé par pg_cron le dernier jour du mois, ou par Lili (bouton « Préparer les factures du mois »). Rien n'est
--    émis ni envoyé : Lili relit, puis « Émettre et envoyer » (un clic, depuis sa boîte Gmail).
create or replace function public.preparer_factures_du_mois(p_jour date default current_date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_mois text := to_char(p_jour, 'YYYY-MM');
  v_noms text[] := array['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  v_periode text := v_noms[extract(month from p_jour)::int] || ' ' || extract(year from p_jour)::int;
  v_n integer := 0;
  r record;
begin
  -- Depuis le navigateur : Lili seule, avec son code. Depuis pg_cron (personne de connecté) : autorisé.
  if auth.uid() is not null and not public.est_proprietaire() then raise exception 'réservé à la propriétaire'; end if;
  for r in
    select e.id, e.nom, p.forfait_mensuel_ht, p.facture_libelle
    from public.espaces e join public.espaces_prive p on p.espace_id = e.id
    where e.statut = 'actif' and p.facture_auto and coalesce(p.forfait_mensuel_ht, 0) > 0
      and not exists (select 1 from public.factures f where f.espace_id = e.id and f.auto_mois = v_mois)
  loop
    insert into public.factures (espace_id, objet, periode, lignes, total_ht, total_tva, total_ttc, statut, auto_mois)
    values (r.id, 'Community management', v_periode,
      jsonb_build_array(jsonb_build_object('libelle', coalesce(nullif(r.facture_libelle, ''), 'Prestation social media & community manager'), 'quantite', 1, 'prix_ht', r.forfait_mensuel_ht, 'tva', 20)),
      round(r.forfait_mensuel_ht, 2), round(r.forfait_mensuel_ht * 0.2, 2), round(r.forfait_mensuel_ht * 1.2, 2), 'brouillon', v_mois);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.preparer_factures_du_mois(date) from public, anon;
grant execute on function public.preparer_factures_du_mois(date) to authenticated, service_role;

-- 4. Compte pro relié (Revolut Business, clé API en lecture seule) : la clé n'est JAMAIS lisible du navigateur
create table public.banque_liaisons (
  id uuid primary key default gen_random_uuid(),
  fournisseur text not null default 'revolut' check (fournisseur in ('revolut')),
  cle_api text,                                     -- clé API Revolut (lecture seule), jamais renvoyée au navigateur
  nom text,                                         -- nom du compte (affiché)
  derniere_synchro timestamptz, derniere_erreur text,
  cree_le timestamptz not null default now()
);
alter table public.banque_liaisons enable row level security;
create policy proprietaire on public.banque_liaisons for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.banque_liaisons from anon, authenticated;
grant select (id, fournisseur, nom, derniere_synchro, derniere_erreur, cree_le) on public.banque_liaisons to authenticated;
grant delete on public.banque_liaisons to authenticated;
grant all on public.banque_liaisons to service_role;

-- 5. Opérations du compte (lecture seule, recopiées par la fonction « banque ») ; Lili peut les rapprocher d'une facture
create table public.banque_operations (
  id text primary key,                              -- identifiant Revolut de l'opération (et de sa jambe)
  liaison_id uuid references public.banque_liaisons(id) on delete cascade,
  compte text, date timestamptz not null, montant numeric not null, devise text not null default 'EUR',
  libelle text, contrepartie text, reference text, type text, etat text,
  solde_apres numeric,
  facture_id uuid references public.factures(id) on delete set null,
  categorie text check (categorie is null or categorie in ('client', 'urssaf', 'tva', 'impots', 'depense', 'perso', 'virement', 'autre')),
  cree_le timestamptz not null default now()
);
create index banque_operations_date on public.banque_operations (date desc);
alter table public.banque_operations enable row level security;
create policy proprietaire on public.banque_operations for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.banque_operations from anon, authenticated;
grant select on public.banque_operations to authenticated;
grant update (facture_id, categorie) on public.banque_operations to authenticated;
grant all on public.banque_operations to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.banque_operations;
  end if;
end $$;
