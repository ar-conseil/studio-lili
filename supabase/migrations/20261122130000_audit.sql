-- Corrections de l'audit du 22/11/2026.

-- 1. Un commentaire sur une publication interne (idée, en création, ou gardée « Lili seule ») ne sort jamais vers le
--    client : la ligne de journal prend la visibilité la plus stricte du commentaire et de la publication, donc pas
--    de notification, pas d'e-mail, rien dans le fil d'activité du client.
create or replace function public.commentaire_apres() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
  select p.espace_id, new.auteur_id, 'commentaire.ajoute', 'publication', p.id,
         jsonb_build_object('commentaire', new.id, 'titre', p.titre, 'extrait', left(new.contenu, 140)),
         case when new.visibilite = 'partage' and p.visibilite = 'partage' then 'partage' else 'interne' end
  from public.publications p where p.id = new.publication_id;
  return null;
end $$;

-- 2. Un client ne dépose un fichier qu'à sa propre adresse : <espace>/<id>.<ext>, vignette <espace>/<id>-apercu.jpg.
--    (Avant, il pouvait déclarer le chemin d'un fichier interne existant et en obtenir l'adresse.)
drop policy deposer on public.medias;
create policy deposer on public.medias for insert to authenticated with check (
  public.role_dans(espace_id) = 'client' and visibilite = 'partage' and depose_par = auth.uid()
  and chemin like espace_id::text || '/' || id::text || '.%' and position('/' in substr(chemin, length(espace_id::text) + 2)) = 0
  and (apercu_chemin is null or apercu_chemin = espace_id::text || '/' || id::text || '-apercu.jpg'));

-- 3. Ce qu'une personne autre que Lili ne peut pas changer après coup : où se trouve la ligne (espace, publication,
--    fil), qui l'a écrite, et l'adresse des fichiers. Elle garde la main sur le texte, « résolu », le classement et la
--    corbeille de ses propres éléments.
create function public.garder_place() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.est_proprietaire() or auth.uid() is null then return new; end if;
  if tg_table_name = 'commentaires' then
    if (new.publication_id, new.parent_id, new.auteur_id, new.cible, new.media_id, new.numero, new.version, new.visibilite)
         is distinct from (old.publication_id, old.parent_id, old.auteur_id, old.cible, old.media_id, old.numero, old.version, old.visibilite) then
      raise exception 'modification non autorisée' using errcode = '42501';
    end if;
  end if;
  if tg_table_name = 'medias' then
    if (new.espace_id, new.chemin, new.apercu_chemin, new.depose_par, new.visibilite)
         is distinct from (old.espace_id, old.chemin, old.apercu_chemin, old.depose_par, old.visibilite) then
      raise exception 'modification non autorisée' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger commentaires_garder_place before update on public.commentaires for each row execute function public.garder_place();
create trigger medias_garder_place before update on public.medias for each row execute function public.garder_place();
