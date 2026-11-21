-- Mails programmés, signature électronique des devis par les clients, devis visibles du client une fois envoyés.

-- Envois programmés (« Envoyer demain à 8 h ») : la fonction « messagerie » les envoie à l'heure. Lili seule.
create table public.mails_programmes (
  id uuid primary key default gen_random_uuid(),
  personne_id uuid not null references public.personnes(id) on delete cascade,
  envoyer_le timestamptz not null,
  contenu jsonb not null,                     -- destinataires, objet, HTML, pièces jointes (vidées après l'envoi)
  statut text not null default 'prevu' check (statut in ('prevu', 'envoye', 'erreur', 'annule')),
  erreur text,
  envoye_le timestamptz,
  cree_le timestamptz not null default now()
);
create index mails_programmes_a_envoyer on public.mails_programmes (envoyer_le) where statut = 'prevu';
alter table public.mails_programmes enable row level security;
create policy proprietaire on public.mails_programmes for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
grant select, insert, update, delete on public.mails_programmes to authenticated;
grant all on public.mails_programmes to service_role;

-- Signature électronique simple d'un devis (preuve) : écrite seulement par la fonction « signer-devis »
create table public.devis_signatures (
  devis_id uuid primary key references public.devis(id) on delete cascade,
  personne_id uuid references public.personnes(id) on delete set null,
  nom_signataire text not null,
  signature text not null,                    -- image PNG (data URL) tracée par le client
  empreinte text not null,                    -- SHA-256 du contenu du devis signé
  ip text,
  agent text,
  signe_le timestamptz not null default now()
);
alter table public.devis_signatures enable row level security;
create policy proprietaire on public.devis_signatures for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
create policy client_lit on public.devis_signatures for select to authenticated using (
  exists (select 1 from public.devis d where d.id = devis_id and coalesce(public.role_dans(d.espace_id) = 'client', false)));
grant select on public.devis_signatures to authenticated;
grant all on public.devis_signatures to service_role;

-- Le client voit les devis de son espace une fois envoyés (jamais les brouillons, jamais ceux d'un prospect)
create policy client_lit on public.devis for select to authenticated using (
  espace_id is not null and statut in ('envoye', 'accepte', 'refuse') and coalesce(public.role_dans(espace_id) = 'client', false));

-- Devis envoyé par Lili à un client : une ligne de journal partagée, qui prévient les clients de l'espace
create function public.devis_journal() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.espace_id is not null and new.statut = 'envoye' and (tg_op = 'INSERT' or old.statut is distinct from 'envoye') and auth.uid() is not null then
    insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
    values (new.espace_id, auth.uid(), 'devis.envoye', 'devis', new.id, jsonb_build_object('numero', new.numero, 'objet', new.objet), 'partage');
  end if;
  return null;
end $$;
create trigger devis_journal after insert or update on public.devis for each row execute function public.devis_journal();

-- Qui est prévenu : un client qui agit prévient Lili ; Lili prévient les clients pour ce qui leur est destiné,
-- dont maintenant le devis à signer
create or replace function public.journal_notifier() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  select p.role into r from public.personnes p where p.id = new.acteur_id;
  if r in ('client', 'invite') then
    insert into public.notifications (personne_id, journal_id)
    select p.id, new.id from public.personnes p where p.role = 'proprietaire';
  elsif r = 'proprietaire' and new.visibilite = 'partage' and new.espace_id is not null and (
        (new.action = 'publication.statut' and new.details ->> 'vers' in ('a-valider', 'publie'))
        or new.action in ('commentaire.ajoute', 'message.envoye', 'devis.envoye')) then
    insert into public.notifications (personne_id, journal_id)
    select m.personne_id, new.id from public.membres m where m.espace_id = new.espace_id and m.role = 'client';
  end if;
  return null;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.devis_signatures, public.mails_programmes;
  end if;
end $$;
