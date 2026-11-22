-- Rendez-vous de Lili (22/11/2026) : réunions client, shootings, appels… Créés à la main ou par l'assistant (« ajoute
-- un rendez-vous avec Palomano jeudi à 10 h »). Visibles de Lili seule, comme ses tâches : jamais d'un client.
create table public.rendez_vous (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid references public.espaces(id) on delete set null,   -- client concerné, facultatif
  titre text not null,
  debut timestamptz not null,
  fin timestamptz,
  lieu text,
  notes text,
  cree_par uuid references public.personnes(id) on delete set null default auth.uid(),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (fin is null or fin >= debut)
);
create index rendez_vous_debut on public.rendez_vous (debut);
alter table public.rendez_vous enable row level security;
create policy proprietaire on public.rendez_vous for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
grant select, insert, update, delete on public.rendez_vous to authenticated;
grant all on public.rendez_vous to service_role;
create trigger rendez_vous_toucher before update on public.rendez_vous for each row execute function public.toucher();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rendez_vous;
  end if;
end $$;
