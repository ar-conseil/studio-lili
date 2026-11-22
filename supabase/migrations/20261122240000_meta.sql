-- Publication directe sur Instagram et Facebook (22/11/2026), par l'API officielle de Meta.
-- Lili relie une fois son compte Facebook (celui qui gère les Pages et les comptes Instagram de ses clients), associe
-- chaque compte à un client, puis publie ou programme une publication. RIEN ne part sans son clic : une diffusion
-- n'existe que si Lili l'a demandée ; pg_cron ne fait qu'exécuter ce qu'elle a programmé. Lili seule, avec son code.

-- 1. Liaison Meta : jeton longue durée de Lili (jamais lisible du navigateur)
create table public.meta_liaison (
  id uuid primary key default gen_random_uuid(),
  personne_id uuid references public.personnes(id) on delete cascade default auth.uid(),
  meta_user_id text, nom text,
  jeton text, expire_le timestamptz,
  derniere_erreur text,
  cree_le timestamptz not null default now(), modifie_le timestamptz not null default now()
);
alter table public.meta_liaison enable row level security;
create policy proprietaire on public.meta_liaison for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.meta_liaison from anon, authenticated;
grant select (id, personne_id, meta_user_id, nom, expire_le, derniere_erreur, cree_le, modifie_le) on public.meta_liaison to authenticated;
grant delete on public.meta_liaison to authenticated;
grant all on public.meta_liaison to service_role;

-- 2. Comptes trouvés (Pages Facebook et comptes Instagram professionnels), associés par Lili à un client
create table public.meta_comptes (
  id uuid primary key default gen_random_uuid(),
  liaison_id uuid references public.meta_liaison(id) on delete cascade,
  reseau text not null check (reseau in ('instagram', 'facebook')),
  meta_id text not null,                            -- identifiant Instagram (ig-user-id) ou de la Page
  page_id text,                                     -- la Page Facebook qui porte le compte (pour son jeton)
  nom text, identifiant text, photo_url text,
  jeton_page text,                                  -- jeton de la Page (jamais lisible du navigateur)
  espace_id uuid references public.espaces(id) on delete set null,
  cree_le timestamptz not null default now(), modifie_le timestamptz not null default now(),
  unique (reseau, meta_id)
);
alter table public.meta_comptes enable row level security;
create policy proprietaire on public.meta_comptes for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.meta_comptes from anon, authenticated;
grant select (id, liaison_id, reseau, meta_id, page_id, nom, identifiant, photo_url, espace_id, cree_le, modifie_le) on public.meta_comptes to authenticated;
grant update (espace_id) on public.meta_comptes to authenticated;
grant all on public.meta_comptes to service_role;

-- 3. Diffusions : une par publication et par réseau, créée seulement par le geste de Lili
create table public.diffusions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  reseau text not null check (reseau in ('instagram', 'facebook')),
  compte_id uuid references public.meta_comptes(id) on delete set null,
  etat text not null default 'programmee' check (etat in ('programmee', 'en-cours', 'publiee', 'erreur', 'annulee')),
  prevue_le timestamptz not null default now(),
  medias jsonb not null default '[]',               -- fichiers préparés pour Meta (JPEG recadrés), chemins du stockage
  conteneur text,                                   -- conteneur Instagram en préparation (vidéo)
  meta_media_id text, lien text,
  erreur text, tentatives int not null default 0,
  publiee_le timestamptz,
  cree_par uuid references public.personnes(id) on delete set null default auth.uid(),
  cree_le timestamptz not null default now(), modifie_le timestamptz not null default now(),
  unique (publication_id, reseau)
);
create index diffusions_file on public.diffusions (prevue_le) where etat in ('programmee', 'en-cours');
alter table public.diffusions enable row level security;
create policy proprietaire on public.diffusions for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.diffusions from anon, authenticated;
grant select, insert, delete on public.diffusions to authenticated;
grant update (etat, prevue_le, medias, compte_id, erreur, tentatives, modifie_le) on public.diffusions to authenticated;
grant all on public.diffusions to service_role;
create trigger diffusions_toucher before update on public.diffusions for each row execute function public.toucher();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.diffusions;
    alter publication supabase_realtime add table public.meta_comptes;
  end if;
end $$;
