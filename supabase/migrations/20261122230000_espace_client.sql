-- Espace client plus complet (22/11/2026) : ses factures, ses rendez-vous avec Lili, et le PDF exact de ses pièces.

-- 1. Factures : le client voit celles de son espace une fois émises (jamais les brouillons ni celles d'un autre)
create policy client_lit on public.factures for select to authenticated using (
  espace_id is not null and statut in ('emise', 'payee') and coalesce(public.role_dans(espace_id) = 'client', false));

-- 2. Rendez-vous : ceux que Lili coche « visible par le client » (réunion, shooting) apparaissent dans son espace.
--    Le client ne lit pas la table (les notes de Lili y sont) : seulement titre, horaires et lieu, par cette fonction.
alter table public.rendez_vous add column if not exists partage boolean not null default false;
create or replace function public.mes_rendez_vous() returns table (id uuid, espace_id uuid, titre text, debut timestamptz, fin timestamptz, lieu text, partage boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.espace_id, r.titre, r.debut, r.fin, r.lieu, r.partage from public.rendez_vous r
  where r.partage and r.espace_id is not null and coalesce(public.role_dans(r.espace_id) = 'client', false)
    and coalesce(r.fin, r.debut) >= now() - interval '1 day'
$$;
revoke all on function public.mes_rendez_vous() from public, anon;
grant execute on function public.mes_rendez_vous() to authenticated;

-- 3. En-tête et destinataire d'une facture ou d'un devis, pour que le PDF vu par le client soit celui que Lili envoie.
--    Seulement pour une pièce que l'appelant a le droit de voir ; rien d'autre des réglages ni de la fiche interne.
create or replace function public.piece_pour_pdf(p_table text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_espace uuid; v_ok boolean := false; v_ent jsonb; v_dest jsonb;
begin
  if p_table = 'factures' then
    select f.espace_id, f.statut in ('emise', 'payee') into v_espace, v_ok from public.factures f where f.id = p_id;
  elsif p_table = 'devis' then
    select d.espace_id, d.statut in ('envoye', 'accepte', 'refuse') into v_espace, v_ok from public.devis d where d.id = p_id;
  else raise exception 'pièce inconnue'; end if;
  if v_espace is null then raise exception 'pièce introuvable'; end if;
  if not (public.est_proprietaire() or (coalesce(v_ok, false) and coalesce(public.role_dans(v_espace) = 'client', false))) then
    raise exception 'accès refusé';
  end if;
  select jsonb_build_object('nom', r.valeur->>'nom', 'nom_legal', r.valeur->>'nom_legal', 'activite', r.valeur->>'activite', 'adresse', r.valeur->>'adresse',
    'siret', r.valeur->>'siret', 'tva_intra', r.valeur->>'tva_intra', 'naf', r.valeur->>'naf', 'email', r.valeur->>'email', 'telephone', r.valeur->>'telephone',
    'conditions', r.valeur->>'conditions', 'iban_affiche', r.valeur->>'iban_affiche')
    into v_ent from public.reglages r where r.cle = 'entreprise';
  select jsonb_build_object('nom', coalesce(nullif(p.raison_sociale, ''), e.nom), 'adresse', p.adresse, 'siret', p.siret, 'tva', p.tva_intra, 'email', p.email_facturation)
    into v_dest from public.espaces e left join public.espaces_prive p on p.espace_id = e.id where e.id = v_espace;
  return jsonb_build_object('entreprise', coalesce(v_ent, '{}'::jsonb), 'destinataire', coalesce(v_dest, '{}'::jsonb));
end $$;
revoke all on function public.piece_pour_pdf(text, uuid) from public, anon;
grant execute on function public.piece_pour_pdf(text, uuid) to authenticated;
