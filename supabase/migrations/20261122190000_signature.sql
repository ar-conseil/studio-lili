-- Signature de mail façon Evoalys (22/11/2026) : photo, carte et bouton « avis Google » en images que Gmail doit
-- pouvoir afficher chez le destinataire, sans connexion. Le stockage reste entièrement privé : les images sont ici,
-- lisibles et modifiables par la propriétaire seule (code saisi), et la fonction « signature » en sert UNE à qui
-- connaît sa clé (128 bits aléatoires, nouvelle clé à chaque version). Aucune donnée client : photo professionnelle
-- et coordonnées que la signature publie de toute façon.
create table public.signature_images (
  cle text primary key default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  personne_id uuid not null default auth.uid() references public.personnes(id) on delete cascade,
  type text not null check (type in ('image/jpeg', 'image/png')),
  contenu text not null check (length(contenu) between 100 and 2000000),   -- base64, 1,5 Mo au plus
  cree_le timestamptz not null default now()
);
create index signature_images_personne on public.signature_images (personne_id);
alter table public.signature_images enable row level security;
create policy proprietaire on public.signature_images for all to authenticated
  using (public.est_proprietaire() and personne_id = auth.uid()) with check (public.est_proprietaire() and personne_id = auth.uid());
grant select, insert, delete on public.signature_images to authenticated;
grant all on public.signature_images to service_role;
