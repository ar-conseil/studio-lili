-- Étape 7 : réglages de l'entreprise de Lili, brief du jour, journal de l'assistant, numérotation des devis.

-- Ce que Lili ne saisit qu'une fois (identité de l'entreprise pour devis et factures, préférences) : Lili seule
create table public.reglages (
  cle text primary key,                       -- « entreprise » : { nom, activite, adresse, siret, tva_intra, email, telephone, iban_affiche, conditions }
  valeur jsonb not null default '{}',
  modifie_le timestamptz not null default now()
);
alter table public.reglages enable row level security;
create policy proprietaire on public.reglages for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
grant select, insert, update, delete on public.reglages to authenticated;
grant all on public.reglages to service_role;

-- Le brief du jour, préparé chaque matin par la fonction « brief-du-jour » (et à la demande) : Lili seule
create table public.briefs_jour (
  jour date primary key,
  contenu text not null,                      -- quelques lignes lisibles
  donnees jsonb not null default '{}',        -- les chiffres dont il est tiré
  par_ia boolean not null default false,
  cree_le timestamptz not null default now()
);
alter table public.briefs_jour enable row level security;
create policy proprietaire on public.briefs_jour for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
grant select on public.briefs_jour to authenticated;
grant all on public.briefs_jour to service_role;

-- Ce que l'on a demandé à l'assistant et ce qu'il a fait (brouillons créés) : Lili seule, gardé 90 jours
create table public.assistant_journal (
  id bigint generated always as identity primary key,
  personne_id uuid references public.personnes(id) on delete cascade,
  demande text not null,
  reponse text,
  brouillons uuid[] not null default '{}',
  cree_le timestamptz not null default now()
);
alter table public.assistant_journal enable row level security;
create policy proprietaire on public.assistant_journal for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
grant select on public.assistant_journal to authenticated;
grant all on public.assistant_journal to service_role;

-- Devis envoyé : numéro D<année>-<n°>, continu dans l'année
create function public.devis_numero() returns trigger language plpgsql security definer set search_path = '' as $$
declare annee text := to_char(coalesce(new.date_devis, current_date), 'YYYY');
begin
  if new.statut in ('envoye', 'accepte', 'refuse') and new.numero is null then
    perform pg_advisory_xact_lock(hashtext('devis_numero'));
    new.numero := 'D' || annee || '-' || lpad((coalesce((select max(split_part(d.numero, '-', 2)::int) from public.devis d where d.numero like 'D' || annee || '-%'), 0) + 1)::text, 3, '0');
    new.date_devis := coalesce(new.date_devis, current_date);
  end if;
  return new;
end $$;
create trigger devis_numero before insert or update on public.devis for each row execute function public.devis_numero();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.briefs_jour, public.briefs, public.rapports, public.veille, public.partenaires,
      public.temps, public.devis, public.factures, public.prospects, public.membres;
  end if;
end $$;
