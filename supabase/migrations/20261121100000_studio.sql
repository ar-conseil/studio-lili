-- Studio Lili : schéma complet, droits (RLS) et automatismes.
-- Trois sortes de personnes (table personnes, rôle posé côté serveur, jamais par l'intéressé) :
--   proprietaire  Lili : voit et modifie tout, à condition d'avoir saisi son code à 6 chiffres (jeton « aal2 ») ;
--   client        voit son espace (table membres), seulement ce qui est « partage » ; valide, commente, dépose des médias ;
--   invite        photographe, partenaire : seulement les éléments partagés avec lui (table partages).
-- Règle d'or : un élément « interne » ne sort jamais vers un client. Les tests sont dans supabase/tests/droits.sql.

-- ======================================================================
-- Personnes, espaces, membres
-- ======================================================================
create table public.personnes (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '',
  email text,
  avatar_path text,                                  -- Storage « medias » : personnes/<id>/...
  role text not null default 'client' check (role in ('proprietaire', 'client', 'invite')),
  cree_le timestamptz not null default now()
);

create table public.espaces (                         -- un client / une marque : ce que ses membres peuvent voir
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                         -- adresse : #maison-ondine
  nom text not null,
  statut text not null default 'actif' check (statut in ('actif', 'pause', 'archive')),
  couleur text not null default '#1E1A17',
  logo_path text,
  couverture_path text,
  reseaux text[] not null default '{}',              -- réseaux par défaut
  heures_defaut jsonb not null default '{}',         -- {"instagram":"12:30","story":"09:00",...} ; vide = heures du studio
  ordre smallint not null default 0,
  notion_id text unique,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table public.espaces_prive (                  -- ce que le client ne voit jamais : facturation, notes de Lili
  espace_id uuid primary key references public.espaces(id) on delete cascade,
  raison_sociale text,
  adresse text,
  email_facturation text,
  siret text,
  forfait_mensuel_ht numeric,
  type_contrat text,
  heures_forfait numeric,                            -- temps prévu par mois
  note_interne text,
  notion_id text
);

create table public.membres (
  espace_id uuid not null references public.espaces(id) on delete cascade,
  personne_id uuid not null references public.personnes(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'invite')),
  fonction text,                                     -- « responsable marketing », « photographe »…
  notifier_mail boolean not null default true,
  cree_le timestamptz not null default now(),
  primary key (espace_id, personne_id)
);
create index membres_personne on public.membres (personne_id);

create table public.comptes (                         -- comptes de l'espace sur les réseaux, pour les aperçus fidèles
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  reseau text not null check (reseau in ('instagram', 'facebook', 'linkedin', 'tiktok', 'pinterest', 'google')),
  nom_affiche text not null,
  identifiant text,
  avatar_path text,
  rang smallint not null default 0
);
create index comptes_espace on public.comptes (espace_id);

-- ======================================================================
-- Fonctions de droits (appelées par les politiques ; definer pour lire membres et personnes sans boucle)
-- ======================================================================
create function public.est_proprietaire() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.personnes p where p.id = auth.uid() and p.role = 'proprietaire')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
create function public.role_dans(e uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.membres m where m.espace_id = e and m.personne_id = auth.uid()
$$;
create function public.voit_espace(e uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.est_proprietaire() or public.role_dans(e) is not null, false)
$$;
-- Un élément de l'espace e, de visibilité vis : Lili, ou un client si c'est partagé
create function public.peut_lire(e uuid, vis text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.est_proprietaire() or (vis = 'partage' and public.role_dans(e) = 'client'), false)
$$;

create table public.partages (                        -- ce qu'un invité peut voir, élément par élément
  objet_type text not null check (objet_type in ('publication', 'media')),
  objet_id uuid not null,
  personne_id uuid not null references public.personnes(id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (objet_type, objet_id, personne_id)
);
create function public.partage_avec_moi(t text, id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partages s where s.objet_type = t and s.objet_id = id and s.personne_id = auth.uid())
$$;

-- ======================================================================
-- Calendrier : opérations commerciales, temps forts (fériés, soldes, absences)
-- ======================================================================
create table public.operations (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  libelle text not null,
  debut date,
  fin date,
  couleur text,
  visibilite text not null default 'partage' check (visibilite in ('interne', 'partage')),
  notion_id text
);
create index operations_espace on public.operations (espace_id);

create table public.temps_forts (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid references public.espaces(id) on delete cascade,   -- vide = pour tous (fériés, fête des mères…)
  libelle text not null,
  debut date not null,
  fin date,
  type text not null default 'commercial' check (type in ('ferie', 'commercial', 'evenement', 'absence')),
  visibilite text not null default 'partage' check (visibilite in ('interne', 'partage')),
  notion_id text
);
create index temps_forts_debut on public.temps_forts (debut);

-- ======================================================================
-- Médiathèque
-- ======================================================================
create table public.medias (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  chemin text not null unique,                       -- Storage « medias » : <espace_id>/<id>.<ext>
  type text not null default 'image' check (type in ('image', 'video', 'document')),
  mime text,
  nom_fichier text,
  taille bigint,
  largeur int,
  hauteur int,
  duree numeric,
  apercu_chemin text,                                -- vignette légère (chargement progressif)
  dossier text,
  etiquettes text[] not null default '{}',
  depose_par uuid references public.personnes(id) on delete set null,
  visibilite text not null default 'partage' check (visibilite in ('interne', 'partage')),
  corbeille_le timestamptz,                          -- corbeille de 30 jours
  notion_id text,
  cree_le timestamptz not null default now()
);
create index medias_espace on public.medias (espace_id, cree_le desc);

-- ======================================================================
-- Publications : l'objet central
-- ======================================================================
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  titre text not null default '',
  reseaux text[] not null default '{}',
  compte_id uuid references public.comptes(id) on delete set null,
  format text not null default 'post' check (format in ('post', 'carrousel', 'reel', 'story', 'article', 'couverture', 'video')),
  date_prevue timestamptz,
  fin timestamptz,                                   -- story ou opération sur plusieurs jours
  legende text not null default '',
  hashtags text[] not null default '{}',
  mentions text[] not null default '{}',
  lien text,
  script text,                                       -- voix off d'un reel
  statut text not null default 'idee'
    check (statut in ('idee', 'en-creation', 'a-valider', 'modifs-demandees', 'valide', 'programme', 'publie')),
  etapes text[] not null default '{}',               -- à faire pendant la création : rediger, tourner, monter, visuel
  etiquettes text[] not null default '{}',
  operation_id uuid references public.operations(id) on delete set null,
  lien_en_ligne text,                                -- adresse de la publication une fois en ligne
  rang_grille int,                                   -- ordre choisi dans l'aperçu de la grille Instagram
  auteur_id uuid references public.personnes(id) on delete set null,
  visibilite text not null default 'interne' check (visibilite in ('interne', 'partage')),
  version_courante int not null default 0,
  envoye_le timestamptz,                             -- dernier envoi au client pour validation
  valide_par uuid references public.personnes(id) on delete set null,
  valide_le timestamptz,
  corbeille_le timestamptz,
  notion_id text unique,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index publications_espace_date on public.publications (espace_id, date_prevue);
create index publications_date on public.publications (date_prevue) where corbeille_le is null;

create table public.publication_medias (
  publication_id uuid not null references public.publications(id) on delete cascade,
  media_id uuid not null references public.medias(id) on delete cascade,
  rang smallint not null default 0,
  primary key (publication_id, media_id)
);
create index publication_medias_media on public.publication_medias (media_id);

-- Une version = l'état envoyé au client à chaque passage « à valider » : il compare v1 et v2 côte à côte.
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  numero int not null,
  titre text,
  legende text,
  hashtags text[],
  medias uuid[] not null default '{}',               -- dans l'ordre du carrousel
  auteur_id uuid references public.personnes(id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (publication_id, numero)
);

create table public.commentaires (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  parent_id uuid references public.commentaires(id) on delete cascade,
  auteur_id uuid references public.personnes(id) on delete set null,
  cible text not null default 'general' check (cible in ('visuel', 'legende', 'general')),
  media_id uuid references public.medias(id) on delete set null,
  x numeric check (x between 0 and 1),               -- position de la bulle sur le visuel (0 à 1)
  y numeric check (y between 0 and 1),
  numero int,                                        -- numéro de la bulle sur la publication
  version int,
  contenu text not null,
  resolu boolean not null default false,
  visibilite text not null default 'partage' check (visibilite in ('interne', 'partage')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index commentaires_publication on public.commentaires (publication_id, cree_le);

create table public.notes_internes (                  -- notes de Lili sur un espace ou une publication
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade,
  contenu text not null,
  cree_le timestamptz not null default now()
);

-- ======================================================================
-- Messages, brief, veille, partenariats, rapports
-- ======================================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  auteur_id uuid references public.personnes(id) on delete set null,
  contenu text not null,
  pieces jsonb not null default '[]',                -- [{media_id}] ou [{chemin, nom}]
  cree_le timestamptz not null default now()
);
create index messages_espace on public.messages (espace_id, cree_le desc);

create table public.briefs (
  espace_id uuid primary key references public.espaces(id) on delete cascade,
  cible text, ton text, piliers jsonb not null default '[]', mots_oui text[] not null default '{}', mots_non text[] not null default '{}',
  charte jsonb not null default '{}',                -- {couleurs:[], typos:[], logos:[media_id]}
  concurrents jsonb not null default '[]', objectifs text,
  visibilite text not null default 'partage' check (visibilite in ('interne', 'partage')),
  modifie_le timestamptz not null default now()
);

create table public.veille (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  compte text, lien text, capture_media_id uuid references public.medias(id) on delete set null, note text,
  publication_id uuid references public.publications(id) on delete set null,   -- idée transformée en publication
  visibilite text not null default 'interne' check (visibilite in ('interne', 'partage')),
  cree_le timestamptz not null default now()
);

create table public.partenaires (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid references public.espaces(id) on delete set null,
  nom text not null, compte text, reseau text, audience int, contact text,
  statut text not null default 'repere' check (statut in ('repere', 'contacte', 'en-discussion', 'accord', 'realise', 'refuse')),
  contreparties text, echanges jsonb not null default '[]', publications uuid[] not null default '{}',
  visibilite text not null default 'interne' check (visibilite in ('interne', 'partage')),
  cree_le timestamptz not null default now()
);

create table public.rapports (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  mois date not null,                                -- premier jour du mois
  reseau text not null,
  abonnes int, portee int, impressions int, engagement numeric, interactions int,
  meilleures uuid[] not null default '{}',
  commentaire text,
  source text not null default 'saisie' check (source in ('saisie', 'metricool', 'meta')),
  visibilite text not null default 'interne' check (visibilite in ('interne', 'partage')),   -- partagé quand le rapport est publié
  unique (espace_id, mois, reseau)
);

-- ======================================================================
-- Côté Lili seulement : tâches, temps, devis, factures, prospects
-- ======================================================================
create table public.taches (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid references public.espaces(id) on delete set null,     -- vide : tâche générale ou personnelle
  publication_id uuid references public.publications(id) on delete set null,
  titre text not null,
  notes text,
  statut text not null default 'a-faire' check (statut in ('a-faire', 'en-cours', 'en-revision', 'fait')),
  echeance date,
  priorite text not null default 'moyenne' check (priorite in ('haute', 'moyenne', 'basse')),
  categorie text,
  fait_le timestamptz,
  notion_id text unique,
  cree_le timestamptz not null default now()
);
create index taches_ouvertes on public.taches (echeance) where statut <> 'fait';

create table public.temps (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid not null references public.espaces(id) on delete cascade,
  jour date not null default current_date,
  minutes int not null check (minutes > 0),
  publication_id uuid references public.publications(id) on delete set null,
  tache_id uuid references public.taches(id) on delete set null,
  note text
);
create index temps_espace on public.temps (espace_id, jour);

create table public.devis (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid references public.espaces(id) on delete set null,
  prospect_id uuid,
  numero text unique,                                -- D2026-001, attribué à l'envoi
  objet text not null, lignes jsonb not null default '[]',   -- [{libelle, quantite, prix_ht, tva}]
  total_ht numeric, total_tva numeric, total_ttc numeric,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'envoye', 'accepte', 'refuse')),
  date_devis date, valable_jusque date, pdf_path text,
  cree_le timestamptz not null default now()
);

create table public.factures (
  id uuid primary key default gen_random_uuid(),
  espace_id uuid references public.espaces(id) on delete set null,
  numero int unique,                                 -- numérotation continue, attribuée à l'émission (suite de Notion : 92)
  objet text, periode text, lignes jsonb not null default '[]',
  total_ht numeric, total_tva numeric, total_ttc numeric,   -- TVA à 20 % depuis octobre 2024, taux gardé par ligne
  statut text not null default 'brouillon' check (statut in ('brouillon', 'emise', 'payee', 'annulee')),
  date_facture date, echeance date, payee_le date, viree boolean not null default false,
  pdf_path text, notion_id text unique,
  cree_le timestamptz not null default now()
);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  nom text not null, contact text, email text, telephone text, source text,
  etape text not null default 'contact' check (etape in ('contact', 'premier-echange', 'proposition', 'signe', 'perdu')),
  montant_mensuel numeric, notes text, prochaine_action text, prochaine_action_le date,
  espace_id uuid references public.espaces(id) on delete set null,     -- espace créé à la signature
  cree_le timestamptz not null default now()
);

-- ======================================================================
-- Journal d'activité et notifications
-- ======================================================================
create table public.journal (
  id bigint generated always as identity primary key,
  espace_id uuid references public.espaces(id) on delete cascade,
  acteur_id uuid references public.personnes(id) on delete set null,
  action text not null,                              -- publication.statut, commentaire.ajoute, media.depose, message.envoye…
  objet_type text, objet_id uuid,
  details jsonb not null default '{}',
  visibilite text not null default 'partage' check (visibilite in ('interne', 'partage')),
  cree_le timestamptz not null default now()
);
create index journal_espace on public.journal (espace_id, cree_le desc);

create table public.notifications (                   -- file d'envoi : regroupées par la fonction serveur (étape 5)
  id bigint generated always as identity primary key,
  personne_id uuid not null references public.personnes(id) on delete cascade,
  journal_id bigint references public.journal(id) on delete cascade,
  lue_le timestamptz, mail_le timestamptz, push_le timestamptz,
  cree_le timestamptz not null default now()
);
create index notifications_attente on public.notifications (personne_id) where mail_le is null;

create table public.push_abonnements (
  endpoint text primary key,
  personne_id uuid not null references public.personnes(id) on delete cascade,
  abonnement jsonb not null, appareil text,
  cree_le timestamptz not null default now()
);

-- ======================================================================
-- Automatismes
-- ======================================================================
create function public.toucher() returns trigger language plpgsql set search_path = '' as $$
begin
  new.modifie_le := now();
  return new;
end $$;
create trigger espaces_toucher before update on public.espaces for each row execute function public.toucher();
create trigger publications_toucher before update on public.publications for each row execute function public.toucher();
create trigger commentaires_toucher before update on public.commentaires for each row execute function public.toucher();
create trigger briefs_toucher before update on public.briefs for each row execute function public.toucher();

create function public.taches_fait() returns trigger language plpgsql set search_path = '' as $$
begin
  new.fait_le := case when new.statut = 'fait' then coalesce(new.fait_le, now()) else null end;
  return new;
end $$;
create trigger taches_fait before insert or update on public.taches for each row execute function public.taches_fait();

-- Nouveau compte (invitation) : sa fiche, avec le rôle posé par le serveur dans app_metadata
create function public.nouvelle_personne() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.personnes (id, email, nom, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'nom', split_part(coalesce(new.email, ''), '@', 1)),
          case when new.raw_app_meta_data ->> 'role' in ('proprietaire', 'client', 'invite') then new.raw_app_meta_data ->> 'role' else 'client' end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger personnes_creer after insert on auth.users for each row execute function public.nouvelle_personne();

-- Publication : passage « à valider » = nouvelle version, visible par le client ; validation datée ; journal
create function public.publication_avant() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.auteur_id := coalesce(new.auteur_id, auth.uid());
    if new.statut not in ('idee', 'en-creation') then new.visibilite := 'partage'; end if;
    return new;
  end if;
  if new.statut is distinct from old.statut then
    if new.statut not in ('idee', 'en-creation') then new.visibilite := 'partage'; end if;
    if new.statut = 'a-valider' then
      new.version_courante := old.version_courante + 1;
      new.envoye_le := now();
      new.valide_par := null; new.valide_le := null;
    end if;
    if new.statut = 'valide' and old.statut in ('a-valider', 'modifs-demandees') then
      new.valide_par := coalesce(new.valide_par, auth.uid()); new.valide_le := coalesce(new.valide_le, now());
    end if;
  end if;
  return new;
end $$;
create trigger publications_avant before insert or update on public.publications for each row execute function public.publication_avant();

create function public.publication_apres() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.statut is distinct from old.statut then
    if new.statut = 'a-valider' then
      insert into public.versions (publication_id, numero, titre, legende, hashtags, medias, auteur_id)
      values (new.id, new.version_courante, new.titre, new.legende, new.hashtags,
              coalesce((select array_agg(pm.media_id order by pm.rang) from public.publication_medias pm where pm.publication_id = new.id), '{}'),
              auth.uid());
    end if;
    insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
    values (new.espace_id, auth.uid(), 'publication.statut', 'publication', new.id,
            jsonb_build_object('de', old.statut, 'vers', new.statut, 'titre', new.titre), new.visibilite);
  elsif tg_op = 'INSERT' and new.auteur_id is not null and public.role_dans(new.espace_id) = 'client' then
    insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
    values (new.espace_id, new.auteur_id, 'publication.idee', 'publication', new.id, jsonb_build_object('titre', new.titre), 'partage');
  end if;
  return null;
end $$;
create trigger publications_apres after insert or update on public.publications for each row execute function public.publication_apres();

-- Commentaire : auteur et numéro de bulle posés par le serveur ; journal
create function public.commentaire_avant() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.auteur_id := coalesce(auth.uid(), new.auteur_id);
  if new.cible = 'visuel' and new.parent_id is null and new.numero is null then
    new.numero := coalesce((select max(c.numero) from public.commentaires c where c.publication_id = new.publication_id), 0) + 1;
  end if;
  new.version := coalesce(new.version, (select p.version_courante from public.publications p where p.id = new.publication_id));
  return new;
end $$;
create trigger commentaires_avant before insert on public.commentaires for each row execute function public.commentaire_avant();

create function public.commentaire_apres() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
  select p.espace_id, new.auteur_id, 'commentaire.ajoute', 'publication', p.id,
         jsonb_build_object('commentaire', new.id, 'titre', p.titre, 'extrait', left(new.contenu, 140)), new.visibilite
  from public.publications p where p.id = new.publication_id;
  return null;
end $$;
create trigger commentaires_apres after insert on public.commentaires for each row execute function public.commentaire_apres();

create function public.media_apres() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
  values (new.espace_id, new.depose_par, 'media.depose', 'media', new.id, jsonb_build_object('nom', new.nom_fichier), new.visibilite);
  return null;
end $$;
create trigger medias_apres after insert on public.medias for each row execute function public.media_apres();

create function public.message_avant() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.auteur_id := coalesce(auth.uid(), new.auteur_id);
  return new;
end $$;
create trigger messages_avant before insert on public.messages for each row execute function public.message_avant();
create function public.message_apres() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.journal (espace_id, acteur_id, action, objet_type, objet_id, details, visibilite)
  values (new.espace_id, new.auteur_id, 'message.envoye', 'message', new.id, jsonb_build_object('extrait', left(new.contenu, 140)), 'partage');
  return null;
end $$;
create trigger messages_apres after insert on public.messages for each row execute function public.message_apres();

-- Média déposé par un client connecté : à son nom, partagé (l'import et les fonctions serveur, sans personne connectée, décident)
create function public.media_avant() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.est_proprietaire() then
    new.depose_par := auth.uid();
    new.visibilite := 'partage';
  end if;
  return new;
end $$;
create trigger medias_avant before insert on public.medias for each row execute function public.media_avant();

-- Facture émise : numéro suivant, sans trou ni doublon (verrou le temps de la transaction)
create function public.facture_numero() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.statut in ('emise', 'payee') and new.numero is null then
    perform pg_advisory_xact_lock(hashtext('factures_numero'));
    new.numero := coalesce((select max(f.numero) from public.factures f), 91) + 1;
    new.date_facture := coalesce(new.date_facture, current_date);
  end if;
  return new;
end $$;
create trigger factures_numero before insert or update on public.factures for each row execute function public.facture_numero();

-- ======================================================================
-- Réponse d'un client à une publication : seule façon pour lui de changer un statut
-- ======================================================================
create function public.repondre_publication(p_id uuid, p_decision text, p_message text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare p public.publications;
begin
  if p_decision not in ('valide', 'modifs-demandees') then raise exception 'Décision inconnue'; end if;
  select * into p from public.publications where id = p_id for update;
  if not found then raise exception 'Publication introuvable'; end if;
  -- coalesce : « pas membre » donne NULL, qui ne doit jamais laisser passer
  if not coalesce(public.est_proprietaire() or (public.role_dans(p.espace_id) = 'client' and p.visibilite = 'partage' and p.corbeille_le is null), false) then
    raise exception 'Accès refusé';
  end if;
  if p.statut <> 'a-valider' then raise exception 'Cette publication n''attend pas de réponse'; end if;
  if p_decision = 'modifs-demandees' and coalesce(trim(p_message), '') = '' then raise exception 'Dites ce qu''il faut changer'; end if;
  update public.publications set statut = p_decision,
         valide_par = case when p_decision = 'valide' then auth.uid() end,
         valide_le = case when p_decision = 'valide' then now() end
   where id = p_id;
  if coalesce(trim(p_message), '') <> '' then
    insert into public.commentaires (publication_id, cible, contenu, visibilite) values (p_id, 'general', p_message, 'partage');
  end if;
  return p_decision;
end $$;

-- ======================================================================
-- Droits
-- ======================================================================
alter table public.personnes enable row level security;
alter table public.espaces enable row level security;
alter table public.espaces_prive enable row level security;
alter table public.membres enable row level security;
alter table public.comptes enable row level security;
alter table public.partages enable row level security;
alter table public.operations enable row level security;
alter table public.temps_forts enable row level security;
alter table public.medias enable row level security;
alter table public.publications enable row level security;
alter table public.publication_medias enable row level security;
alter table public.versions enable row level security;
alter table public.commentaires enable row level security;
alter table public.notes_internes enable row level security;
alter table public.messages enable row level security;
alter table public.briefs enable row level security;
alter table public.veille enable row level security;
alter table public.partenaires enable row level security;
alter table public.rapports enable row level security;
alter table public.taches enable row level security;
alter table public.temps enable row level security;
alter table public.devis enable row level security;
alter table public.factures enable row level security;
alter table public.prospects enable row level security;
alter table public.journal enable row level security;
alter table public.notifications enable row level security;
alter table public.push_abonnements enable row level security;

-- Lili (avec son code) : tout, partout
do $$
declare t text;
begin
  foreach t in array array['personnes','espaces','espaces_prive','membres','comptes','partages','operations','temps_forts','medias',
    'publications','publication_medias','versions','commentaires','notes_internes','messages','briefs','veille','partenaires','rapports',
    'taches','temps','devis','factures','prospects','journal','notifications','push_abonnements'] loop
    execute format('create policy proprietaire on public.%I for all to authenticated using (public.est_proprietaire()) with check (public.est_proprietaire())', t);
  end loop;
end $$;

-- Personnes : soi-même, et les personnes des espaces que l'on partage (noms dans les commentaires) ; Lili toujours
create policy soi on public.personnes for select to authenticated using (id = auth.uid());
create policy voisins on public.personnes for select to authenticated using (
  role = 'proprietaire' and exists (select 1 from public.membres m where m.personne_id = auth.uid())
  or exists (select 1 from public.membres a join public.membres b on a.espace_id = b.espace_id
             where a.personne_id = auth.uid() and b.personne_id = personnes.id));
create policy soi_modifier on public.personnes for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Espaces et ce qui les décrit : les membres
create policy membres on public.espaces for select to authenticated using (public.role_dans(id) is not null);
create policy moi on public.membres for select to authenticated using (personne_id = auth.uid() or public.role_dans(espace_id) = 'client');
create policy membres on public.comptes for select to authenticated using (public.role_dans(espace_id) is not null);
create policy moi on public.partages for select to authenticated using (personne_id = auth.uid());

-- Calendrier
create policy partage on public.operations for select to authenticated using (public.peut_lire(espace_id, visibilite));
create policy pour_tous on public.temps_forts for select to authenticated using (espace_id is null and visibilite = 'partage');
create policy partage on public.temps_forts for select to authenticated using (espace_id is not null and public.peut_lire(espace_id, visibilite));

-- Publications : le client voit ce qui est partagé (hors corbeille) et ses propres idées ; l'invité, ce qu'on lui a partagé
create policy partage on public.publications for select to authenticated using (
  corbeille_le is null and (
    (visibilite = 'partage' and public.role_dans(espace_id) = 'client')
    or (auteur_id = auth.uid() and public.role_dans(espace_id) = 'client')
    or (public.role_dans(espace_id) = 'invite' and public.partage_avec_moi('publication', id))));
-- Le client peut proposer une idée (jamais un autre statut, jamais pour un autre espace)
create policy idee_client on public.publications for insert to authenticated with check (
  public.role_dans(espace_id) = 'client' and statut = 'idee' and auteur_id = auth.uid() and visibilite = 'partage');
create function public.peut_lire_publication(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.publications x where x.id = p and x.corbeille_le is null and coalesce(
    public.est_proprietaire()
    or (x.visibilite = 'partage' and public.role_dans(x.espace_id) = 'client')
    or (x.auteur_id = auth.uid() and public.role_dans(x.espace_id) = 'client')
    or (public.role_dans(x.espace_id) = 'invite' and public.partage_avec_moi('publication', x.id)), false))
$$;
create policy partage on public.publication_medias for select to authenticated using (public.peut_lire_publication(publication_id));
create policy partage on public.versions for select to authenticated using (public.peut_lire_publication(publication_id));

-- Commentaires : partagés, sur une publication que l'on voit ; on écrit en son nom, on modifie les siens
create policy partage on public.commentaires for select to authenticated using (visibilite = 'partage' and public.peut_lire_publication(publication_id));
create policy ecrire on public.commentaires for insert to authenticated with check (
  visibilite = 'partage' and public.peut_lire_publication(publication_id) and (auteur_id is null or auteur_id = auth.uid()));
create policy les_miens on public.commentaires for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid() and visibilite = 'partage');

-- Médiathèque : le client voit et dépose dans son espace ; l'invité voit ce qu'on lui a partagé
create policy partage on public.medias for select to authenticated using (
  corbeille_le is null and (public.peut_lire(espace_id, visibilite) or (public.role_dans(espace_id) = 'invite' and public.partage_avec_moi('media', id))));
create policy deposer on public.medias for insert to authenticated with check (
  public.role_dans(espace_id) = 'client' and visibilite = 'partage' and depose_par = auth.uid()
  and split_part(chemin, '/', 1) = espace_id::text);
create policy les_miens on public.medias for update to authenticated using (depose_par = auth.uid() and public.role_dans(espace_id) = 'client')
  with check (depose_par = auth.uid() and visibilite = 'partage');

-- Messages : les clients de l'espace
create policy clients on public.messages for select to authenticated using (public.role_dans(espace_id) = 'client');
create policy ecrire on public.messages for insert to authenticated with check (public.role_dans(espace_id) = 'client' and auteur_id = auth.uid());

-- Brief, veille, partenariats, rapports : ce que Lili a partagé
create policy partage on public.briefs for select to authenticated using (public.peut_lire(espace_id, visibilite));
create policy partage on public.veille for select to authenticated using (public.peut_lire(espace_id, visibilite));
create policy partage on public.partenaires for select to authenticated using (espace_id is not null and public.peut_lire(espace_id, visibilite));
create policy partage on public.rapports for select to authenticated using (public.peut_lire(espace_id, visibilite));

-- Journal, notifications, abonnements : les siens
create policy partage on public.journal for select to authenticated using (espace_id is not null and public.peut_lire(espace_id, visibilite));
create policy les_miennes on public.notifications for select to authenticated using (personne_id = auth.uid());
create policy les_miennes_lues on public.notifications for update to authenticated using (personne_id = auth.uid()) with check (personne_id = auth.uid());
create policy les_miens on public.push_abonnements for all to authenticated using (personne_id = auth.uid()) with check (personne_id = auth.uid());

-- Privilèges : rien pour « anon » ; les politiques ci-dessus filtrent les lignes de « authenticated ».
-- Supabase donne par défaut tous les droits à anon sur les nouvelles tables : on retire ce réglage pour les migrations à venir.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;
alter default privileges in schema public revoke all on sequences from anon;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Ce qu'un client ne doit jamais pouvoir modifier lui-même, même sur ses lignes
revoke update on public.personnes from authenticated;
grant update (nom, avatar_path) on public.personnes to authenticated;
revoke update on public.notifications from authenticated;
grant update (lue_le) on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.est_proprietaire(), public.role_dans(uuid), public.voit_espace(uuid), public.peut_lire(uuid, text),
  public.partage_avec_moi(text, uuid), public.peut_lire_publication(uuid), public.repondre_publication(uuid, text, text) to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ======================================================================
-- Temps réel : ce qui doit bouger en direct (présence et frappe passent par les canaux Realtime, sans table)
-- ======================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.publications, public.publication_medias, public.commentaires, public.medias,
      public.messages, public.versions, public.journal, public.taches, public.espaces, public.notifications;
  end if;
end $$;
