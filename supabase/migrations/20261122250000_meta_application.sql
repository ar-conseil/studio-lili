-- Identifiants de l'application Meta de Lili (22/11/2026) : collés par Lili dans Réglages › Réseaux sociaux, gardés
-- côté serveur. Le navigateur ne lit jamais la clé secrète ; il ne voit que l'App ID et si la configuration existe.
create table public.meta_application (
  id boolean primary key default true check (id),   -- une seule ligne
  app_id text, app_secret text, config_id text,
  modifie_le timestamptz not null default now()
);
alter table public.meta_application enable row level security;
create policy proprietaire on public.meta_application for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.meta_application from anon, authenticated;
grant select (id, app_id, config_id, modifie_le) on public.meta_application to authenticated;
grant all on public.meta_application to service_role;
