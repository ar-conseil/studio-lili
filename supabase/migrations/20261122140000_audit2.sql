-- Suite de l'audit du 22/11/2026.

-- 1. Code de signature d'un devis : l'essai est compté AVANT la comparaison, en une seule opération (des requêtes
--    lancées en même temps ne peuvent plus dépasser 5 essais) ; au plus 5 codes envoyés par heure.
alter table public.devis_codes add column envois smallint not null default 1, add column envois_depuis timestamptz not null default now();
create function public.devis_prendre_essai(p_devis uuid, p_personne uuid) returns smallint language sql security definer set search_path = '' as $$
  update public.devis_codes set essais = essais + 1
  where devis_id = p_devis and personne_id = p_personne and essais < 5 and expire_le > now()
  returning essais
$$;
revoke all on function public.devis_prendre_essai(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devis_prendre_essai(uuid, uuid) to service_role;

-- 2. Présence en direct (« qui regarde », « … écrit ») : canaux privés « publication:<id> », ouverts seulement à qui
--    peut lire la publication. (Le schéma realtime n'existe que sur Supabase, pas dans les tests locaux.)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'realtime')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'realtime' and c.relname = 'messages') then
    execute $p$
      create policy studio_presence_lire on realtime.messages for select to authenticated using (
        realtime.topic() ~ '^publication:[0-9a-f-]{36}$'
        and public.peut_lire_publication(substr(realtime.topic(), 13)::uuid))
    $p$;
    execute $p$
      create policy studio_presence_ecrire on realtime.messages for insert to authenticated with check (
        realtime.topic() ~ '^publication:[0-9a-f-]{36}$'
        and public.peut_lire_publication(substr(realtime.topic(), 13)::uuid))
    $p$;
  end if;
end $$;
