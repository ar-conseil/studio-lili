-- Fin de l'audit du 22/11/2026 : durcissements mineurs.

-- 1. Droits techniques inutiles retirés aux comptes connectés (vider une table, déclencheurs, clés étrangères) :
--    l'API ne les expose pas, mais rien ne doit les garder. Les visiteurs (anon) n'ont déjà aucun droit.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- 2. Fichiers : seulement des types connus (photos, vidéos, sons, PDF, bureautique, fichiers de création, archives).
--    Une page web ou un script ne peut plus être déposé, quel que soit son nom.
do $$
declare types text[] := array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif', 'image/tiff', 'image/svg+xml',
  'image/vnd.adobe.photoshop', 'application/postscript', 'application/illustrator',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets set allowed_mime_types = types where id in ('medias', 'livrables');
  end if;
end $$;

-- 3. Un client ne dépose ni SVG ni page web (ils peuvent contenir du code) ; Lili garde les logos en SVG.
create or replace function public.peut_deposer_fichier(p_bucket text, p_chemin text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(case
    when public.est_proprietaire() then true
    when lower(p_chemin) ~ '\.(svg|svgz|html?|xhtml|xht|js|mjs|xml)$' then false
    when p_bucket = 'medias' and split_part(p_chemin, '/', 1) = 'personnes' then split_part(p_chemin, '/', 2) = auth.uid()::text
    when p_bucket = 'medias' and split_part(p_chemin, '/', 2) <> 'marque' and split_part(p_chemin, '/', 1) ~ '^[0-9a-f-]{36}$'
      then public.role_dans(split_part(p_chemin, '/', 1)::uuid) = 'client'
    else false
  end, false)
$$;

-- 4. Le garde de la porte d'entrée ne peut pas être inondé : au plus 600 traces par minute au total, toutes adresses
--    confondues (en plus de la limite par adresse IP, dans la fonction « garde »).
create function public.garde_place_libre() returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.securite_evenements where cree_le > now() - interval '1 minute') < 600
$$;
revoke all on function public.garde_place_libre() from public, anon, authenticated;
grant execute on function public.garde_place_libre() to service_role;
