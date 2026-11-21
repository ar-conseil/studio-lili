-- Étape 5 : la boîte Gmail de Lili reliée au studio, et la file des notifications (e-mail et téléphone).

-- ---------- Boîtes mail reliées (Gmail de Lili) : les jetons ne sont jamais lisibles par le navigateur ----------
create table public.comptes_mail (
  id uuid primary key default gen_random_uuid(),
  personne_id uuid not null references public.personnes(id) on delete cascade,
  fournisseur text not null default 'google' check (fournisseur in ('google')),
  email text not null unique,
  refresh_token text,
  jeton_acces text,
  jeton_expire_le timestamptz,
  droits text,
  derniere_erreur text,
  cree_le timestamptz not null default now()
);
alter table public.comptes_mail enable row level security;
create policy proprietaire on public.comptes_mail for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire());
revoke all on public.comptes_mail from anon, authenticated;
grant select (id, personne_id, fournisseur, email, droits, derniere_erreur, cree_le) on public.comptes_mail to authenticated;
grant delete on public.comptes_mail to authenticated;
grant all on public.comptes_mail to service_role;

-- ---------- Qui prévenir de quoi ----------
-- Un client agit (valide, demande une modification, commente, dépose, propose une idée, écrit) : Lili est prévenue.
-- Lili agit sur ce qui est partagé : les clients de l'espace sont prévenus, mais seulement pour ce qui vient d'un geste
-- de Lili qui s'adresse à eux (envoi pour validation, publication en ligne, commentaire ou message partagé) : jamais
-- d'e-mail à un client sans un clic de Lili. Rien d'interne ne part vers un client.
create function public.journal_notifier() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  select p.role into r from public.personnes p where p.id = new.acteur_id;
  if r in ('client', 'invite') then
    insert into public.notifications (personne_id, journal_id)
    select p.id, new.id from public.personnes p where p.role = 'proprietaire';
  elsif r = 'proprietaire' and new.visibilite = 'partage' and new.espace_id is not null and (
        (new.action = 'publication.statut' and new.details ->> 'vers' in ('a-valider', 'publie'))
        or new.action in ('commentaire.ajoute', 'message.envoye')) then
    insert into public.notifications (personne_id, journal_id)
    select m.personne_id, new.id from public.membres m where m.espace_id = new.espace_id and m.role = 'client';
  end if;
  return null;
end $$;
create trigger journal_notifier after insert on public.journal for each row execute function public.journal_notifier();

-- Nouveaux champs : envoi groupé (pas un e-mail par action) et préférence de chaque client
alter table public.notifications add column if not exists essais smallint not null default 0;
create index if not exists notifications_push on public.notifications (personne_id) where push_le is null;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.comptes_mail;
  end if;
end $$;
