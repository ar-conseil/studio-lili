-- Sécurité renforcée : double authentification vérifiée par la base, journal des tentatives, alertes de la vigie.

-- Membre d'un espace : un invité doit toujours avoir saisi son code (aal2) ; un client qui a activé la double
-- authentification aussi. Sans le code, la base ne lui montre rien (même avec un mot de passe volé).
create or replace function public.role_dans(e uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.membres m
  where m.espace_id = e and m.personne_id = auth.uid()
    and (coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
         or (m.role = 'client' and not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')))
$$;
-- Ce qu'on partage avec un invité : seulement s'il a saisi son code
create or replace function public.partage_avec_moi(t text, id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.partages s where s.objet_type = t and s.objet_id = id and s.personne_id = auth.uid())
$$;

-- Ce que la porte d'entrée a vu : échecs de mot de passe ou de code, robots pris au piège. Écrit par la fonction « garde ».
create table public.securite_evenements (
  id bigint generated always as identity primary key,
  type text not null check (type in ('echec_connexion', 'echec_code', 'piege', 'automate', 'trop_rapide')),
  compte text,                                -- adresse masquée (l•••@gmail.com), jamais en clair
  compte_empreinte text,                      -- SHA-256 de l'adresse, pour regrouper les tentatives
  ip text,
  agent text,
  cree_le timestamptz not null default now()
);
create index securite_evenements_recents on public.securite_evenements (cree_le desc);
alter table public.securite_evenements enable row level security;
create policy proprietaire on public.securite_evenements for select to authenticated using (public.est_proprietaire());
grant select on public.securite_evenements to authenticated;
grant all on public.securite_evenements to service_role;

-- Les alertes de la vigie (rondes toutes les 10 minutes, jour et nuit)
create table public.securite_alertes (
  id bigint generated always as identity primary key,
  cle text not null,                          -- pour ne pas répéter la même alerte
  niveau text not null check (niveau in ('info', 'alerte', 'critique')),
  titre text not null,
  details jsonb not null default '{}',
  vu_le timestamptz,
  cree_le timestamptz not null default now()
);
create index securite_alertes_recentes on public.securite_alertes (cree_le desc);
alter table public.securite_alertes enable row level security;
create policy proprietaire on public.securite_alertes for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
grant select, update on public.securite_alertes to authenticated;
grant all on public.securite_alertes to service_role;

-- Pour la vigie seulement (rôle service) : les connexions récentes (journal d'authentification de Supabase)
create function public.vigie_connexions(depuis timestamptz) returns table (cree_le timestamptz, ip text, action text, compte text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query select a.created_at, a.ip_address::text, a.payload ->> 'action', a.payload ->> 'actor_username'
    from auth.audit_log_entries a where a.created_at >= depuis order by a.created_at;
end $$;
-- … et l'état des protections de la base : tables sans RLS, politiques ouvertes aux visiteurs, stockage public
create function public.vigie_controles() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return jsonb_build_object(
    'sans_rls', (select coalesce(jsonb_agg(t.tablename), '[]') from pg_catalog.pg_tables t where t.schemaname = 'public' and not t.rowsecurity),
    'ouvert_anon', (select coalesce(jsonb_agg(p.tablename || '.' || p.policyname), '[]') from pg_catalog.pg_policies p
                    where p.schemaname in ('public', 'storage') and ('anon' = any (p.roles) or 'public' = any (p.roles))),
    'stockage_public', (select coalesce(jsonb_agg(b.id), '[]') from storage.buckets b where b.public));
end $$;
revoke all on function public.vigie_connexions(timestamptz), public.vigie_controles() from public, anon, authenticated;
grant execute on function public.vigie_connexions(timestamptz), public.vigie_controles() to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.securite_alertes;
  end if;
end $$;
