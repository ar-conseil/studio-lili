-- Idée proposée par un client avec des pièces jointes (23/11/2026) : il rattache SES fichiers à SON idée, rien d'autre.
create policy client_joint_idee on public.publication_medias for insert to authenticated with check (
  exists (select 1 from public.publications p
          where p.id = publication_id and p.statut = 'idee' and p.auteur_id = auth.uid()
            and coalesce(public.role_dans(p.espace_id) = 'client', false))
  and exists (select 1 from public.medias m
              where m.id = media_id and m.depose_par = auth.uid()
                and m.espace_id = (select p2.espace_id from public.publications p2 where p2.id = publication_id)));
