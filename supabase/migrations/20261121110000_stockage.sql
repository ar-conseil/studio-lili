-- Fichiers (Supabase Storage). Deux espaces de rangement, chemins rangés par espace client :
--   medias     <espace_id>/<media_id>.<ext> (et ses vignettes) : visibles selon la ligne de public.medias
--              <espace_id>/marque/...   logo, couverture, photos de profil des comptes : tous les membres de l'espace
--              personnes/<personne_id>/... photo de chacun : toute personne connectée
--   livrables  <espace_id>/partage/...  rapports PDF, chartes : les clients de l'espace ; le reste (factures, devis) : Lili seule
insert into storage.buckets (id, name, public, file_size_limit)
values ('medias', 'medias', false, 524288000), ('livrables', 'livrables', false, 52428800)
on conflict (id) do nothing;

create function public.peut_lire_fichier(p_bucket text, p_chemin text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(case
    when public.est_proprietaire() then true
    when p_bucket = 'medias' and split_part(p_chemin, '/', 1) = 'personnes' then auth.uid() is not null
    when p_bucket = 'medias' and split_part(p_chemin, '/', 2) = 'marque' then public.role_dans(nullif(split_part(p_chemin, '/', 1), '')::uuid) is not null
    when p_bucket = 'medias' then exists (select 1 from public.medias m where (m.chemin = p_chemin or m.apercu_chemin = p_chemin) and m.corbeille_le is null
                                     and (public.peut_lire(m.espace_id, m.visibilite)
                                          or (public.role_dans(m.espace_id) = 'invite' and public.partage_avec_moi('media', m.id))))
    when p_bucket = 'livrables' and split_part(p_chemin, '/', 2) = 'partage' then public.role_dans(nullif(split_part(p_chemin, '/', 1), '')::uuid) = 'client'
    else false
  end, false)
$$;
-- (paramètres préfixés p_ : dans une fonction SQL, un nom de colonne l'emporte sur un paramètre du même nom)
-- Un client dépose dans son espace (pas dans « marque »), ou sa propre photo
create function public.peut_deposer_fichier(p_bucket text, p_chemin text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(case
    when public.est_proprietaire() then true
    when p_bucket = 'medias' and split_part(p_chemin, '/', 1) = 'personnes' then split_part(p_chemin, '/', 2) = auth.uid()::text
    when p_bucket = 'medias' and split_part(p_chemin, '/', 2) <> 'marque' and split_part(p_chemin, '/', 1) ~ '^[0-9a-f-]{36}$'
      then public.role_dans(split_part(p_chemin, '/', 1)::uuid) = 'client'
    else false
  end, false)
$$;
grant execute on function public.peut_lire_fichier(text, text), public.peut_deposer_fichier(text, text) to authenticated;

create policy "studio lire" on storage.objects for select to authenticated
  using (bucket_id in ('medias', 'livrables') and public.peut_lire_fichier(bucket_id, name));
create policy "studio deposer" on storage.objects for insert to authenticated
  with check (bucket_id in ('medias', 'livrables') and public.peut_deposer_fichier(bucket_id, name));
create policy "studio proprietaire" on storage.objects for all to authenticated
  using (bucket_id in ('medias', 'livrables') and public.est_proprietaire())
  with check (bucket_id in ('medias', 'livrables') and public.est_proprietaire());
