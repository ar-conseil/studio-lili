-- Tests des droits : à lancer avant chaque déploiement (outils/tester-droits.mjs en local, outils/deployer.sh en ligne).
-- Tout se passe dans une transaction annulée à la fin : rien ne reste dans la base. Au premier écart, une erreur
-- « ÉCHEC : … » arrête tout. Personnes et marques fictives.
begin;

create schema essais;
grant usage on schema essais to anon, authenticated;
create function essais.devenir(u uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
create function essais.verifier(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'ÉCHEC : %', message; end if;
end $$;
create function essais.doit_echouer(requete text, message text) returns void language plpgsql as $$
begin
  begin
    execute requete;
  exception when others then
    return;
  end;
  raise exception 'ÉCHEC (aurait dû être refusé) : %', message;
end $$;
grant execute on all functions in schema essais to anon, authenticated;

-- ---------- Le décor ----------
-- Lili, deux personnes chez le client A, une chez le client B, un photographe invité chez A
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-a000-000000000001', 'lili@essai.invalid', '{"role":"proprietaire"}'),
  ('00000000-0000-4000-a000-0000000000a1', 'a1@essai.invalid', '{"role":"client"}'),
  ('00000000-0000-4000-a000-0000000000a2', 'a2@essai.invalid', '{"role":"client"}'),
  ('00000000-0000-4000-a000-0000000000b1', 'b1@essai.invalid', '{"role":"client"}'),
  ('00000000-0000-4000-a000-0000000000c1', 'photo@essai.invalid', '{"role":"invite"}');
insert into public.espaces (id, slug, nom) values
  ('10000000-0000-4000-a000-00000000000a', 'essai-a', 'Marque A (essai)'),
  ('10000000-0000-4000-a000-00000000000b', 'essai-b', 'Marque B (essai)');
insert into public.espaces_prive (espace_id, raison_sociale, forfait_mensuel_ht, note_interne) values
  ('10000000-0000-4000-a000-00000000000a', 'A SAS', 650, 'Client exigeant sur les délais');
insert into public.membres (espace_id, personne_id, role) values
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'client'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a2', 'client'),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-0000000000b1', 'client'),
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000c1', 'invite');
insert into public.publications (id, espace_id, titre, statut) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a', 'A à valider', 'a-valider'),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-00000000000a', 'A idée interne', 'idee'),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-00000000000b', 'B à valider', 'a-valider'),
  ('20000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-00000000000a', 'A pour le photographe', 'valide');
insert into public.partages (objet_type, objet_id, personne_id) values
  ('publication', '20000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-0000000000c1');
insert into public.notes_internes (espace_id, publication_id, contenu) values
  ('10000000-0000-4000-a000-00000000000a', '20000000-0000-4000-a000-000000000001', 'Note de Lili, jamais vue du client');
insert into public.commentaires (id, publication_id, contenu, visibilite) values
  ('40000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'Commentaire partagé', 'partage'),
  ('40000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', 'Commentaire interne', 'interne');
insert into public.medias (id, espace_id, chemin, visibilite) values
  ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a/m1.jpg', 'partage'),
  ('30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a/m2.jpg', 'interne'),
  ('30000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b/m3.jpg', 'partage');
insert into storage.objects (bucket_id, name) values
  ('medias', '10000000-0000-4000-a000-00000000000a/m1.jpg'), ('medias', '10000000-0000-4000-a000-00000000000a/m2.jpg'),
  ('medias', '10000000-0000-4000-a000-00000000000b/m3.jpg'), ('livrables', '10000000-0000-4000-a000-00000000000a/factures/f92.pdf'),
  ('livrables', '10000000-0000-4000-a000-00000000000a/partage/rapport-novembre.pdf');
insert into public.messages (espace_id, auteur_id, contenu) values ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'Message A');
insert into public.taches (titre, espace_id) values ('Tâche de Lili', '10000000-0000-4000-a000-00000000000a');
insert into public.temps (espace_id, minutes) values ('10000000-0000-4000-a000-00000000000a', 90);
insert into public.factures (espace_id, objet, statut, numero) values ('10000000-0000-4000-a000-00000000000a', 'Octobre', 'payee', (select coalesce(max(numero), 90) + 1 from public.factures));
insert into public.briefs (espace_id, ton, visibilite) values ('10000000-0000-4000-a000-00000000000a', 'Chaleureux', 'partage');
insert into public.rapports (espace_id, mois, reseau, abonnes, visibilite) values ('10000000-0000-4000-a000-00000000000a', '2026-10-01', 'instagram', 1200, 'interne');
insert into public.reglages (cle, valeur) values ('entreprise', '{"siret": "000 000 000 00000"}') on conflict (cle) do update set valeur = excluded.valeur;
insert into public.briefs_jour (jour, contenu) values (current_date, 'Brief de Lili') on conflict (jour) do update set contenu = excluded.contenu;
insert into public.assistant_journal (personne_id, demande) values ('00000000-0000-4000-a000-000000000001', 'Idées pour Noël');
insert into public.messages (espace_id, auteur_id, contenu) values ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-0000000000b1', 'Message B');
insert into public.comptes_mail (personne_id, email, refresh_token, jeton_acces) values ('00000000-0000-4000-a000-000000000001', 'lili-gmail@essai.invalid', 'jeton-secret', 'acces-secret');
-- La seconde personne de A a activé la double authentification ; un robot s'est fait prendre au piège
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values (gen_random_uuid(), '00000000-0000-4000-a000-0000000000a2', 'totp', 'verified', now(), now());
insert into public.securite_evenements (type, compte, ip) values ('piege', 'r•••@robot.invalid', '203.0.113.7');
insert into public.securite_alertes (cle, niveau, titre) values ('essai', 'alerte', 'Alerte d''essai');

-- ---------- Personne non connectée : rien ----------
set local role anon;
select essais.doit_echouer('select 1 from public.publications', 'anon lit les publications');
select essais.doit_echouer('select 1 from public.espaces', 'anon lit les espaces');
reset role;

-- ---------- Lili sans son code (jeton aal1) : rien ----------
select essais.devenir('00000000-0000-4000-a000-000000000001', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.publications) = 0, 'Lili sans code ne voit aucune publication');
select essais.verifier((select count(*) from public.factures) = 0, 'Lili sans code ne voit aucune facture');
select essais.doit_echouer($q$insert into public.espaces (slug, nom) values ('essai-sans-code', 'Sans code')$q$, 'Lili sans code crée un client');
select essais.verifier((select count(*) from public.banque_operations) = 0, 'Lili sans code ne voit pas son compte pro');
select essais.doit_echouer('select public.preparer_factures_du_mois()', 'Lili sans code prépare les factures du mois');
select essais.doit_echouer($q$insert into public.signature_images (type, contenu) values ('image/png', 'iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$q$, 'Lili sans code dépose une image de signature');
reset role;

-- ---------- Lili avec son code : tout ----------
select essais.devenir('00000000-0000-4000-a000-000000000001', 'aal2');
set local role authenticated;
select essais.verifier((select count(*) from public.publications where espace_id::text like '10000000-%') = 4, 'Lili voit les 4 publications d''essai');
select essais.verifier((select count(*) from public.commentaires where publication_id::text like '20000000-%') = 2, 'Lili voit les commentaires internes');
select essais.verifier((select count(*) from public.espaces_prive where espace_id::text like '10000000-%') = 1, 'Lili voit la partie privée des espaces');
select essais.verifier((select count(*) from storage.objects where name like '10000000-%') = 5, 'Lili voit tous les fichiers d''essai');
-- Passage « à valider » : version figée ; idée qui avance : journal interne
update public.publications set statut = 'en-creation' where id = '20000000-0000-4000-a000-000000000002';
update public.publications set statut = 'modifs-demandees' where id = '20000000-0000-4000-a000-000000000001';
update public.publications set statut = 'a-valider', legende = 'Légende v2' where id = '20000000-0000-4000-a000-000000000001';
select essais.verifier((select max(numero) from public.versions where publication_id = '20000000-0000-4000-a000-000000000001') = 1, 'une version figée à l''envoi');
select essais.verifier((select visibilite from public.publications where id = '20000000-0000-4000-a000-000000000002') = 'interne', 'une publication en création reste interne');
-- Facture émise : numéro suivant
insert into public.factures (espace_id, objet, statut) values ('10000000-0000-4000-a000-00000000000a', 'Novembre', 'emise');
select essais.verifier((select numero from public.factures where objet = 'Novembre') = (select max(numero) from public.factures where objet <> 'Novembre') + 1, 'la facture émise prend le numéro suivant (92 sur une base vide)');
select essais.verifier(exists (select 1 from public.comptes_mail where email = 'lili-gmail@essai.invalid'), 'Lili voit sa boîte Gmail reliée');
insert into public.signature_images (type, contenu) values ('image/png', 'iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
select essais.verifier((select count(*) from public.signature_images) = 1, 'Lili dépose et relit une image de sa signature');
select essais.doit_echouer($q$insert into public.signature_images (type, contenu) values ('text/html', 'iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$q$, 'Lili dépose autre chose qu''une image dans la signature');
select essais.verifier(exists (select 1 from public.reglages where cle = 'entreprise') and exists (select 1 from public.briefs_jour where jour = current_date) and exists (select 1 from public.assistant_journal where demande = 'Idées pour Noël'), 'Lili voit ses réglages, son brief et son assistant');
insert into public.devis (espace_id, objet, statut) values ('10000000-0000-4000-a000-00000000000a', 'Forfait 2027', 'envoye');
select essais.verifier((select numero from public.devis where objet = 'Forfait 2027') like 'D' || to_char(current_date, 'YYYY') || '-___', 'le devis envoyé prend un numéro D<année>-<n°>');
insert into public.devis (espace_id, objet, statut) values ('10000000-0000-4000-a000-00000000000a', 'Brouillon A', 'brouillon'), ('10000000-0000-4000-a000-00000000000b', 'Devis B', 'envoye');
insert into public.mails_programmes (personne_id, envoyer_le, contenu) values ('00000000-0000-4000-a000-000000000001', now() + interval '1 day', '{"objet": "Envoi de demain"}');
select essais.verifier(exists (select 1 from public.mails_programmes where contenu ->> 'objet' = 'Envoi de demain'), 'Lili programme un envoi');
select essais.doit_echouer('select refresh_token from public.comptes_mail', 'le navigateur de Lili lit le jeton Gmail');
select essais.doit_echouer('select jeton_acces from public.comptes_mail', 'le navigateur de Lili lit le jeton d''accès Gmail');
-- Comptabilité : compte pro relié (lecture seule, jetons illisibles), factures automatiques de fin de mois
reset role;
insert into public.banque_liaisons (id, cle_api, nom) values ('30000000-0000-4000-a000-000000000001', 'r_prod_secret', 'Compte pro');
insert into public.banque_operations (id, liaison_id, date, montant, libelle) values ('op-essai-1', '30000000-0000-4000-a000-000000000001', now(), 1980, 'Virement client');
update public.espaces_prive set facture_auto = true, forfait_mensuel_ht = 500 where espace_id::text like '10000000-%';
set local role authenticated;
select essais.verifier((select count(*) from public.banque_operations) = 1 and (select nom from public.banque_liaisons) = 'Compte pro', 'Lili voit son compte pro et ses opérations');
select essais.doit_echouer('select cle_api from public.banque_liaisons', 'le navigateur de Lili lit la clé API Revolut');
select essais.doit_echouer($$update public.banque_operations set montant = 1$$, 'Lili change le montant d''une opération bancaire');
update public.banque_operations set categorie = 'client' where id = 'op-essai-1';
insert into public.banque_operations (id, date, montant, libelle) values ('csv:essai', now(), -50, 'Import du relevé');
select essais.verifier(exists (select 1 from public.banque_operations where id = 'csv:essai'), 'Lili importe une opération de son relevé');
select essais.verifier((select categorie from public.banque_operations where id = 'op-essai-1') = 'client', 'Lili classe une opération');
select essais.verifier(public.preparer_factures_du_mois() = 1, 'Lili prépare la facture du mois du client au forfait');
select essais.verifier(public.preparer_factures_du_mois() = 0, 'une seule facture automatique par client et par mois');
select essais.verifier((select statut from public.factures where auto_mois = to_char(current_date, 'YYYY-MM')) = 'brouillon', 'la facture automatique reste un brouillon (rien n''est émis ni envoyé)');
-- Espace client : factures émises et rendez-vous partagés
insert into public.factures (id, espace_id, objet, statut) values ('40000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a', 'Facture A', 'emise'),
  ('40000000-0000-4000-a000-0000000000aa', '10000000-0000-4000-a000-00000000000a', 'Brouillon A', 'brouillon'), ('40000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b', 'Facture B', 'emise');
insert into public.rendez_vous (espace_id, titre, debut, partage) values ('10000000-0000-4000-a000-00000000000a', 'Point A', now() + interval '1 day', true),
  ('10000000-0000-4000-a000-00000000000a', 'Interne A', now() + interval '1 day', false), ('10000000-0000-4000-a000-00000000000b', 'Point B', now() + interval '1 day', true);
select essais.verifier(public.piece_pour_pdf('factures', '40000000-0000-4000-a000-00000000000b') ? 'entreprise', 'Lili obtient l''en-tête du PDF de n''importe quelle facture');
-- Audit du 22/11 : Lili commente une idée interne sans cocher « Lili seule » : rien ne sort vers le client
insert into public.commentaires (publication_id, contenu, visibilite) values ('20000000-0000-4000-a000-000000000002', 'Idée à creuser, budget serré', 'partage');
select essais.verifier((select visibilite from public.publications where id = '20000000-0000-4000-a000-000000000002') = 'interne', 'l''idée du décor est interne');
select essais.verifier(not exists (select 1 from public.journal where objet_id = '20000000-0000-4000-a000-000000000002' and action = 'commentaire.ajoute' and visibilite = 'partage'), 'un commentaire sur une idée interne reste interne dans le journal');
select essais.verifier(not exists (select 1 from public.notifications n join public.journal j on j.id = n.journal_id where j.objet_id = '20000000-0000-4000-a000-000000000002' and j.action = 'commentaire.ajoute'), 'un commentaire sur une idée interne ne prévient personne');
-- Nouveau client créé depuis l'application (bouton « Nouveau client »)
insert into public.espaces (id, slug, nom, couleur, reseaux) values ('10000000-0000-4000-a000-00000000000c', 'essai-c', 'Marque C (essai)', '#335544', array['instagram','linkedin']);
insert into public.espaces_prive (espace_id, raison_sociale, email_facturation) values ('10000000-0000-4000-a000-00000000000c', 'C SARL', 'compta@essai.invalid');
select essais.verifier(exists (select 1 from public.espaces where slug = 'essai-c') and exists (select 1 from public.espaces_prive where espace_id = '10000000-0000-4000-a000-00000000000c'), 'Lili crée un nouveau client depuis l''application');
-- Fiche client : Lili modifie tout (métier, heures, comptes affichés dans les aperçus)
update public.espaces set metier = 'Fleuriste', heures_defaut = '{"instagram": "11:15"}', ordre = 3 where id = '10000000-0000-4000-a000-00000000000a';
insert into public.comptes (espace_id, reseau, nom_affiche, identifiant) values ('10000000-0000-4000-a000-00000000000a', 'instagram', 'Marque A', 'marque.a');
select essais.verifier((select metier from public.espaces where id = '10000000-0000-4000-a000-00000000000a') = 'Fleuriste' and exists (select 1 from public.comptes where identifiant = 'marque.a'), 'Lili modifie la fiche et les comptes d''un client');
-- Rendez-vous : Lili seule
insert into public.rendez_vous (espace_id, titre, debut, fin, lieu) values ('10000000-0000-4000-a000-00000000000a', 'Point mensuel avec A', now() + interval '2 days', now() + interval '2 days 1 hour', 'Visio');
select essais.verifier(exists (select 1 from public.rendez_vous where titre = 'Point mensuel avec A'), 'Lili note un rendez-vous');
reset role;
-- La signature d'un devis n'est écrite que par la fonction serveur (rôle service)
insert into public.devis_signatures (devis_id, personne_id, nom_signataire, signature, empreinte)
  select id, '00000000-0000-4000-a000-0000000000a1', 'A1 Essai', 'data:image/png;base64,AAAA', 'empreinte' from public.devis where objet = 'Forfait 2027';
-- Le devis envoyé à A (geste de Lili) prévient les deux personnes du client A, et pas B
select essais.verifier((select count(distinct n.personne_id) from public.notifications n join public.journal j on j.id = n.journal_id
  where j.action = 'devis.envoye' and j.espace_id = '10000000-0000-4000-a000-00000000000a') = 2, 'le devis envoyé prévient les 2 personnes du client A');
-- L'envoi pour validation (geste de Lili, partagé) prévient les deux personnes du client A, et personne d'autre
select essais.verifier((select count(distinct personne_id) from public.notifications n join public.journal j on j.id = n.journal_id
  where j.objet_id = '20000000-0000-4000-a000-000000000001' and j.details ->> 'vers' = 'a-valider') = 2, 'l''envoi pour validation prévient les 2 personnes du client A');
select essais.verifier(not exists (select 1 from public.notifications n join public.journal j on j.id = n.journal_id where j.visibilite = 'interne'), 'aucune notification pour une activité interne');
select essais.verifier(not exists (select 1 from public.notifications n join public.journal j on j.id = n.journal_id where n.personne_id = '00000000-0000-4000-a000-0000000000b1' and j.espace_id = '10000000-0000-4000-a000-00000000000a'), 'le client B n''est prévenu de rien chez A');

-- ---------- Client A ----------
select essais.devenir('00000000-0000-4000-a000-0000000000a1', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.espaces) = 1, 'A ne voit que son espace');
select essais.verifier(not exists (select 1 from public.espaces where slug = 'essai-b'), 'A ne voit pas l''espace B');
select essais.verifier(not exists (select 1 from public.espaces where slug = 'essai-c'), 'A ne voit pas le nouveau client C');
select essais.verifier(exists (select 1 from public.comptes where identifiant = 'marque.a'), 'A voit les comptes de sa marque (aperçus)');
update public.espaces set metier = 'Pirate', nom = 'Pirate' where id = '10000000-0000-4000-a000-00000000000a';   -- sans effet : aucune ligne modifiable
select essais.doit_echouer($q$insert into public.comptes (espace_id, reseau, nom_affiche) values ('10000000-0000-4000-a000-00000000000a', 'instagram', 'Faux compte')$q$, 'A ajoute un compte à sa fiche');
select essais.verifier((select count(*) from public.rendez_vous) = 0, 'A ne voit pas les rendez-vous de Lili, même ceux de sa marque');
select essais.doit_echouer($q$insert into public.rendez_vous (espace_id, titre, debut) values ('10000000-0000-4000-a000-00000000000a', 'Rendez-vous imposé', now())$q$, 'A ajoute un rendez-vous dans l''agenda de Lili');
select essais.verifier((select count(*) from public.personnes where email like 'a_@essai.invalid') = 2, 'A voit sa collègue de la même marque');
select essais.doit_echouer($q$select public.devis_prendre_essai('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1')$q$, 'A compte lui-même ses essais de code');
select essais.doit_echouer($q$insert into public.espaces (slug, nom) values ('essai-pirate', 'Pirate')$q$, 'un client crée un espace');
select essais.verifier((select count(*) from public.publications where espace_id = '10000000-0000-4000-a000-00000000000b') = 0, 'A ne voit aucun post de B');
select essais.verifier(not exists (select 1 from public.publications where id = '20000000-0000-4000-a000-000000000002'), 'A ne voit pas l''idée en création de son espace');
select essais.verifier(exists (select 1 from public.publications where id = '20000000-0000-4000-a000-000000000001'), 'A voit la publication à valider');
select essais.verifier((select count(*) from public.commentaires) = 1, 'A ne voit pas le commentaire interne');
select essais.verifier((select count(*) from public.notes_internes) = 0, 'A ne voit aucune note interne');
select essais.verifier((select count(*) from public.espaces_prive) = 0, 'A ne voit pas forfait, raison sociale ni note interne de l''espace');
select essais.verifier((select count(*) from public.taches) = 0, 'A ne voit pas les tâches de Lili');
select essais.verifier((select count(*) from public.temps) = 0, 'A ne voit pas le temps passé');
select essais.verifier(not exists (select 1 from public.factures where statut not in ('emise', 'payee') or espace_id is distinct from '10000000-0000-4000-a000-00000000000a'), 'A ne voit que les factures émises de son espace (ni brouillon, ni celles des autres)');
select essais.verifier((select count(*) from public.prospects) = 0, 'A ne voit pas les prospects');
select essais.verifier((select count(*) from public.rapports) = 0, 'A ne voit pas un rapport non publié');
select essais.verifier((select count(*) from public.briefs) = 1, 'A voit le brief partagé');
select essais.verifier((select count(*) from public.medias) = 1, 'A ne voit que le média partagé de son espace');
select essais.verifier((select count(*) from public.journal where visibilite = 'interne') = 0, 'A ne voit rien d''interne dans le journal');
select essais.verifier(not exists (select 1 from public.journal where objet_id = '20000000-0000-4000-a000-000000000002'), 'A ne voit pas l''activité de l''idée interne');
select essais.verifier((select count(*) from storage.objects where bucket_id = 'medias') = 1, 'A ne lit que le fichier du média partagé');
select essais.verifier((select count(*) from storage.objects where bucket_id = 'livrables') = 1, 'A lit le rapport partagé, pas la facture');
select essais.verifier((select count(*) from public.versions) = 1, 'A voit la version envoyée');
select essais.verifier((select count(*) from public.notifications) >= 1 and not exists (select 1 from public.notifications where personne_id <> '00000000-0000-4000-a000-0000000000a1'), 'A ne voit que ses propres notifications');
select essais.verifier((select count(*) from public.comptes_mail) = 0, 'A ne voit pas la boîte Gmail de Lili');
select essais.verifier((select count(*) from public.reglages) = 0, 'A ne voit pas les réglages de Lili (SIRET, IBAN…)');
select essais.verifier((select count(*) from public.signature_images) = 0, 'A ne voit pas les images de signature de Lili');
select essais.verifier((select count(*) from public.banque_operations) = 0 and (select count(*) from public.banque_liaisons) = 0, 'A ne voit pas le compte pro de Lili');
select essais.doit_echouer('select cle_api from public.banque_liaisons', 'A lit la clé API Revolut');
select essais.doit_echouer($$insert into public.banque_operations (id, date, montant) values ('csv:pirate', now(), 1)$$, 'A ajoute une opération au compte de Lili');
select essais.doit_echouer('select public.preparer_factures_du_mois()', 'A prépare des factures');
select essais.verifier(exists (select 1 from public.factures where objet = 'Facture A'), 'A voit sa facture émise');
select essais.verifier(not exists (select 1 from public.factures where objet in ('Brouillon A', 'Facture B')), 'A ne voit ni le brouillon de sa facture ni la facture de B');
select essais.verifier(exists (select 1 from public.mes_rendez_vous() where titre = 'Point A') and not exists (select 1 from public.mes_rendez_vous() where titre in ('Interne A', 'Point B')), 'A voit seulement le rendez-vous partagé de son espace (sans les notes)');
select essais.verifier((select count(*) from public.rendez_vous) = 0, 'A ne lit pas la table des rendez-vous (notes de Lili)');
select essais.verifier((public.piece_pour_pdf('factures', '40000000-0000-4000-a000-00000000000a') -> 'destinataire' ->> 'nom') is not null, 'A obtient l''en-tête du PDF de sa facture');
select essais.doit_echouer($$select public.piece_pour_pdf('factures', '40000000-0000-4000-a000-00000000000b')$$, 'A obtient l''en-tête de la facture de B');
select essais.doit_echouer($$select public.piece_pour_pdf('factures', '40000000-0000-4000-a000-0000000000aa')$$, 'A obtient l''en-tête d''un brouillon');
update public.factures set statut = 'payee' where objet = 'Facture A';   -- sans effet : lecture seule
select essais.verifier((select statut from public.factures where objet = 'Facture A') = 'emise', 'A ne modifie pas sa facture');
select essais.doit_echouer($q$insert into public.signature_images (type, contenu) values ('image/png', 'iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$q$, 'A dépose une image de signature');
select essais.verifier((select count(*) from public.briefs_jour) = 0, 'A ne voit pas le brief du jour de Lili');
select essais.verifier((select count(*) from public.assistant_journal) = 0, 'A ne voit pas ce que Lili demande à son assistant');
select essais.verifier((select count(*) from public.devis) = 1 and exists (select 1 from public.devis where objet = 'Forfait 2027'), 'A ne voit que le devis envoyé de son espace (ni brouillon, ni celui de B)');
select essais.verifier((select count(*) from public.devis_signatures) = 1, 'A voit la signature de son devis');
select essais.verifier((select count(*) from public.mails_programmes) = 0, 'A ne voit pas les envois programmés de Lili');
select essais.doit_echouer('select 1 from public.devis_codes', 'A lit les codes de signature');
select essais.doit_echouer($$insert into public.devis_signatures (devis_id, nom_signataire, signature, empreinte) select id, 'faux', 'x', 'x' from public.devis where objet = 'Forfait 2027'$$, 'A écrit une signature sans passer par la fonction');
update public.devis set statut = 'accepte', total_ttc = 1 where objet = 'Forfait 2027';   -- sans effet : aucune ligne modifiable
select essais.verifier((select statut from public.devis where objet = 'Forfait 2027') = 'envoye', 'A ne modifie pas son devis');
select essais.verifier(not exists (select 1 from public.messages where contenu = 'Message B'), 'A ne lit pas les messages de B');
select essais.doit_echouer($$insert into public.reglages (cle, valeur) values ('pirate', '{}')$$, 'A écrit dans les réglages de Lili');
select essais.doit_echouer($$update public.notifications set personne_id = '00000000-0000-4000-a000-0000000000b1'$$, 'A détourne une notification');
-- Écritures interdites
select essais.doit_echouer($$insert into public.publications (espace_id, titre, statut, auteur_id, visibilite) values ('10000000-0000-4000-a000-00000000000b', 'intrusion', 'idee', '00000000-0000-4000-a000-0000000000a1', 'partage')$$, 'A crée une publication chez B');
select essais.doit_echouer($$insert into public.publications (espace_id, titre, statut, auteur_id, visibilite) values ('10000000-0000-4000-a000-00000000000a', 'auto-validé', 'valide', '00000000-0000-4000-a000-0000000000a1', 'partage')$$, 'A crée une publication déjà validée');
select essais.doit_echouer($$insert into public.commentaires (publication_id, contenu, visibilite) values ('20000000-0000-4000-a000-000000000001', 'en douce', 'interne')$$, 'A écrit un commentaire interne');
select essais.doit_echouer($$insert into public.commentaires (publication_id, contenu) values ('20000000-0000-4000-a000-000000000003', 'chez B')$$, 'A commente un post de B');
select essais.doit_echouer($$insert into public.medias (espace_id, chemin, depose_par) values ('10000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b/x.jpg', '00000000-0000-4000-a000-0000000000a1')$$, 'A dépose un média chez B');
select essais.doit_echouer($$insert into storage.objects (bucket_id, name) values ('medias', '10000000-0000-4000-a000-00000000000b/x.jpg')$$, 'A dépose un fichier dans le dossier de B');
select essais.doit_echouer($$insert into storage.objects (bucket_id, name) values ('livrables', '10000000-0000-4000-a000-00000000000a/partage/faux.pdf')$$, 'A dépose un livrable');
select essais.doit_echouer($$update public.personnes set role = 'proprietaire' where id = '00000000-0000-4000-a000-0000000000a1'$$, 'A se donne le rôle de Lili');
select essais.doit_echouer($$insert into public.membres (espace_id, personne_id) values ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-0000000000a1')$$, 'A s''ajoute à l''espace B');
select essais.doit_echouer($$select public.repondre_publication('20000000-0000-4000-a000-000000000003', 'valide')$$, 'A valide un post de B');
select essais.doit_echouer($$select public.repondre_publication('20000000-0000-4000-a000-000000000001', 'modifs-demandees', '')$$, 'A demande une modification sans dire laquelle');
update public.publications set statut = 'publie' where id = '20000000-0000-4000-a000-000000000001';   -- sans effet : aucune ligne modifiable
delete from public.publications where id = '20000000-0000-4000-a000-000000000001';                   -- sans effet
-- Écritures permises
insert into public.publications (espace_id, titre, statut, auteur_id, visibilite) values ('10000000-0000-4000-a000-00000000000a', 'Idée de A', 'idee', '00000000-0000-4000-a000-0000000000a1', 'partage');
insert into public.commentaires (publication_id, cible, x, y, contenu) values ('20000000-0000-4000-a000-000000000001', 'visuel', .4, .3, 'Plus de lumière ici');
select essais.doit_echouer($$update public.commentaires set publication_id = '20000000-0000-4000-a000-000000000002' where contenu = 'Plus de lumière ici'$$, 'A déplace son commentaire sur une idée interne');
select essais.doit_echouer($q$insert into storage.objects (bucket_id, name) values ('medias', '10000000-0000-4000-a000-00000000000a/30000000-0000-4000-a000-0000000000f1.svg')$q$, 'A dépose un SVG (qui peut contenir du code)');
select essais.doit_echouer($q$insert into storage.objects (bucket_id, name) values ('medias', '10000000-0000-4000-a000-00000000000a/page.html')$q$, 'A dépose une page web');
select essais.doit_echouer('truncate public.reglages', 'A vide une table');
update public.commentaires set contenu = 'Plus de lumière ici' , resolu = false where contenu = 'Plus de lumière ici';
insert into public.medias (id, espace_id, chemin, apercu_chemin, depose_par, nom_fichier) values ('30000000-0000-4000-a000-00000000000d', '10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a/30000000-0000-4000-a000-00000000000d.jpg', '10000000-0000-4000-a000-00000000000a/30000000-0000-4000-a000-00000000000d-apercu.jpg', '00000000-0000-4000-a000-0000000000a1', 'depot.jpg');
insert into storage.objects (bucket_id, name) values ('medias', '10000000-0000-4000-a000-00000000000a/30000000-0000-4000-a000-00000000000d.jpg');
-- Audit du 22/11 : un dépôt ne peut viser que sa propre adresse, et rien ne se déplace après coup
select essais.doit_echouer($$insert into public.medias (espace_id, chemin, apercu_chemin, depose_par) values ('10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a/30000000-0000-4000-a000-0000000000e1.jpg', '10000000-0000-4000-a000-00000000000a/m2.jpg', '00000000-0000-4000-a000-0000000000a1')$$, 'A déclare comme vignette le fichier interne m2 (pour en obtenir l''adresse)');
select essais.doit_echouer($$insert into public.medias (id, espace_id, chemin, depose_par) values ('30000000-0000-4000-a000-0000000000e2', '10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a/autre-chose.jpg', '00000000-0000-4000-a000-0000000000a1')$$, 'A dépose à une adresse qui n''est pas la sienne');
select essais.doit_echouer($$update public.medias set espace_id = '10000000-0000-4000-a000-00000000000b' where id = '30000000-0000-4000-a000-00000000000d'$$, 'A déplace son média chez B');
select essais.doit_echouer($$update public.medias set apercu_chemin = '10000000-0000-4000-a000-00000000000a/m2.jpg' where id = '30000000-0000-4000-a000-00000000000d'$$, 'A fait pointer son média vers un fichier interne');
update public.medias set dossier = 'Shooting', etiquettes = array['noel'] where id = '30000000-0000-4000-a000-00000000000d';
select essais.verifier((select dossier from public.medias where id = '30000000-0000-4000-a000-00000000000d') = 'Shooting', 'A range son propre média');
insert into public.messages (espace_id, auteur_id, contenu) values ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'Bonjour Lili');
select essais.verifier(public.repondre_publication('20000000-0000-4000-a000-000000000001', 'valide') = 'valide', 'A valide sa publication');
reset role;

select essais.verifier((select statut from public.publications where id = '20000000-0000-4000-a000-000000000001') = 'valide', 'la publication est validée (et pas publiée par A)');
select essais.verifier((select valide_par from public.publications where id = '20000000-0000-4000-a000-000000000001') = '00000000-0000-4000-a000-0000000000a1', 'la validation est au nom de A');
select essais.verifier((select numero from public.commentaires where contenu = 'Plus de lumière ici') = 1, 'la bulle sur le visuel porte le numéro 1');
select essais.verifier((select auteur_id from public.commentaires where contenu = 'Plus de lumière ici') = '00000000-0000-4000-a000-0000000000a1', 'le commentaire est au nom de A');
select essais.verifier(exists (select 1 from public.notifications n join public.journal j on j.id = n.journal_id
  where n.personne_id = '00000000-0000-4000-a000-000000000001' and j.details ->> 'vers' = 'valide'), 'la validation de A prévient Lili');

select essais.verifier((select nom from public.espaces where id = '10000000-0000-4000-a000-00000000000a') = 'Marque A (essai)' and (select metier from public.espaces where id = '10000000-0000-4000-a000-00000000000a') = 'Fleuriste', 'A ne modifie pas la fiche de sa marque');

-- ---------- Client B : rien de A ----------
select essais.devenir('00000000-0000-4000-a000-0000000000b1', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.publications where espace_id = '10000000-0000-4000-a000-00000000000a') = 0, 'B ne voit aucun post de A, même partagé');
select essais.verifier((select count(*) from public.commentaires) = 0, 'B ne voit aucun commentaire de A');
select essais.verifier((select count(*) from public.medias where espace_id = '10000000-0000-4000-a000-00000000000a') = 0, 'B ne voit aucun média de A');
select essais.verifier((select count(*) from public.messages where espace_id = '10000000-0000-4000-a000-00000000000a') = 0 and (select count(*) from public.messages) = 1, 'B ne voit pas les messages de A, seulement les siens');
select essais.verifier((select count(*) from public.devis) = 1 and exists (select 1 from public.devis where objet = 'Devis B') and (select count(*) from public.devis_signatures) = 0, 'B ne voit que son devis, et aucune signature de A');
select essais.verifier((select count(*) from public.journal where espace_id = '10000000-0000-4000-a000-00000000000a') = 0, 'B ne voit pas le journal de A');
select essais.verifier((select count(*) from public.personnes where email like 'a_@essai.invalid') = 0, 'B ne voit pas les personnes de A');
select essais.verifier((select count(*) from storage.objects where name like '10000000-0000-4000-a000-00000000000a/%') = 0, 'B ne lit aucun fichier de A');
reset role;

-- ---------- Double authentification vérifiée par la base ----------
select essais.devenir('00000000-0000-4000-a000-0000000000a2', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.espaces) = 0 and (select count(*) from public.publications) = 0, 'un client qui a activé son code ne voit rien sans l''avoir saisi');
reset role;
select essais.devenir('00000000-0000-4000-a000-0000000000a2', 'aal2');
set local role authenticated;
select essais.verifier((select count(*) from public.espaces) = 1, 'avec son code, il retrouve son espace');
select essais.verifier((select count(*) from public.securite_evenements) = 0 and (select count(*) from public.securite_alertes) = 0, 'un client ne lit pas le journal de sécurité');
select essais.doit_echouer('select public.vigie_controles()', 'un client lance les contrôles de la vigie');
reset role;
select essais.devenir('00000000-0000-4000-a000-0000000000c1', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.publications) = 0 and (select count(*) from public.espaces) = 0, 'un invité sans son code ne voit rien');
reset role;
select essais.devenir('00000000-0000-4000-a000-000000000001', 'aal2');
set local role authenticated;
select essais.verifier(exists (select 1 from public.securite_evenements where type = 'piege') and exists (select 1 from public.securite_alertes where cle = 'essai'), 'Lili lit son journal de sécurité');
reset role;

-- ---------- Photographe invité chez A : seulement ce qu'on lui a partagé ----------
select essais.devenir('00000000-0000-4000-a000-0000000000c1', 'aal2');
set local role authenticated;
select essais.verifier((select count(*) from public.publications) = 1, 'l''invité ne voit que la publication partagée avec lui');
select essais.verifier((select count(*) from public.messages) = 0, 'l''invité ne lit pas les messages du client');
select essais.verifier((select count(*) from public.briefs) = 0, 'l''invité ne lit pas le brief');
select essais.verifier((select count(*) from public.medias) = 0, 'l''invité ne voit pas la médiathèque');
select essais.verifier((select count(*) from public.rendez_vous) = 0, 'l''invité ne voit pas l''agenda de Lili');
select essais.doit_echouer($q$insert into public.espaces (slug, nom) values ('essai-invite', 'Invité')$q$, 'un invité crée un espace');
select essais.verifier((select count(*) from public.personnes where email like 'a_@essai.invalid') = 0, 'l''invité ne voit ni le nom ni l''adresse des clients');
select essais.verifier(exists (select 1 from public.personnes where role = 'proprietaire'), 'l''invité voit Lili');
reset role;

-- ---------- Code de signature d'un devis : 5 essais au plus, comptés d'un seul geste ----------
insert into public.devis_codes (devis_id, personne_id, code_hash, email, expire_le)
  select id, '00000000-0000-4000-a000-0000000000a1', 'empreinte', 'a1@essai.invalid', now() + interval '10 minutes' from public.devis where objet = 'Devis B';
select essais.verifier((select array_agg(public.devis_prendre_essai((select id from public.devis where objet = 'Devis B'), '00000000-0000-4000-a000-0000000000a1')) from generate_series(1, 7))
  = array[1, 2, 3, 4, 5, null, null]::smallint[], 'le code accepte 5 essais, pas un de plus');

select 'Droits vérifiés : tous les tests passent' as resultat;
rollback;
