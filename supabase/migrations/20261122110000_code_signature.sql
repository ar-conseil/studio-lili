-- Signature des devis comme dans Evoalys : un code à 6 chiffres reçu par e-mail, à saisir pour signer.
-- Les codes ne sont lisibles par personne depuis le navigateur (seule la fonction « signer-devis » les écrit et les lit).
create table public.devis_codes (
  devis_id uuid not null references public.devis(id) on delete cascade,
  personne_id uuid not null references public.personnes(id) on delete cascade,
  code_hash text not null,                    -- SHA-256 du code ; le code lui-même n'est jamais gardé
  email text not null,                        -- adresse à laquelle il a été envoyé
  expire_le timestamptz not null,             -- 10 minutes
  essais smallint not null default 0,         -- 5 au plus
  cree_le timestamptz not null default now(),
  primary key (devis_id, personne_id)
);
alter table public.devis_codes enable row level security;   -- aucune politique : rien pour les rôles du navigateur
revoke all on public.devis_codes from anon, authenticated;
grant all on public.devis_codes to service_role;

-- La preuve garde l'adresse vérifiée par le code et l'heure de la vérification
alter table public.devis_signatures add column email_verifie text, add column code_verifie_le timestamptz;
