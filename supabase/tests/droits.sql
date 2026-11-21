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
insert into public.factures (espace_id, objet, statut, numero) values ('10000000-0000-4000-a000-00000000000a', 'Octobre', 'payee', 91);
insert into public.briefs (espace_id, ton, visibilite) values ('10000000-0000-4000-a000-00000000000a', 'Chaleureux', 'partage');
insert into public.rapports (espace_id, mois, reseau, abonnes, visibilite) values ('10000000-0000-4000-a000-00000000000a', '2026-10-01', 'instagram', 1200, 'interne');
insert into public.comptes_mail (personne_id, email, refresh_token, jeton_acces) values ('00000000-0000-4000-a000-000000000001', 'lili-gmail@essai.invalid', 'jeton-secret', 'acces-secret');

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
reset role;

-- ---------- Lili avec son code : tout ----------
select essais.devenir('00000000-0000-4000-a000-000000000001', 'aal2');
set local role authenticated;
select essais.verifier((select count(*) from public.publications) = 4, 'Lili voit les 4 publications');
select essais.verifier((select count(*) from public.commentaires) = 2, 'Lili voit les commentaires internes');
select essais.verifier((select count(*) from public.espaces_prive) = 1, 'Lili voit la partie privée des espaces');
select essais.verifier((select count(*) from storage.objects) = 5, 'Lili voit tous les fichiers');
-- Passage « à valider » : version figée ; idée qui avance : journal interne
update public.publications set statut = 'en-creation' where id = '20000000-0000-4000-a000-000000000002';
update public.publications set statut = 'modifs-demandees' where id = '20000000-0000-4000-a000-000000000001';
update public.publications set statut = 'a-valider', legende = 'Légende v2' where id = '20000000-0000-4000-a000-000000000001';
select essais.verifier((select max(numero) from public.versions where publication_id = '20000000-0000-4000-a000-000000000001') = 1, 'une version figée à l''envoi');
select essais.verifier((select visibilite from public.publications where id = '20000000-0000-4000-a000-000000000002') = 'interne', 'une publication en création reste interne');
-- Facture émise : numéro suivant
insert into public.factures (espace_id, objet, statut) values ('10000000-0000-4000-a000-00000000000a', 'Novembre', 'emise');
select essais.verifier((select max(numero) from public.factures) = 92, 'la facture émise prend le numéro 92');
select essais.verifier((select count(*) from public.comptes_mail) = 1, 'Lili voit sa boîte Gmail reliée');
select essais.doit_echouer('select refresh_token from public.comptes_mail', 'le navigateur de Lili lit le jeton Gmail');
select essais.doit_echouer('select jeton_acces from public.comptes_mail', 'le navigateur de Lili lit le jeton d''accès Gmail');
reset role;
-- L'envoi pour validation (geste de Lili, partagé) prévient les deux personnes du client A, et personne d'autre
select essais.verifier((select count(distinct personne_id) from public.notifications n join public.journal j on j.id = n.journal_id
  where j.objet_id = '20000000-0000-4000-a000-000000000001' and j.details ->> 'vers' = 'a-valider') = 2, 'l''envoi pour validation prévient les 2 personnes du client A');
select essais.verifier(not exists (select 1 from public.notifications n join public.journal j on j.id = n.journal_id where j.visibilite = 'interne'), 'aucune notification pour une activité interne');
select essais.verifier(not exists (select 1 from public.notifications where personne_id = '00000000-0000-4000-a000-0000000000b1'), 'le client B n''est prévenu de rien chez A');

-- ---------- Client A ----------
select essais.devenir('00000000-0000-4000-a000-0000000000a1', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.espaces) = 1, 'A ne voit que son espace');
select essais.verifier(not exists (select 1 from public.espaces where slug = 'essai-b'), 'A ne voit pas l''espace B');
select essais.verifier((select count(*) from public.publications where espace_id = '10000000-0000-4000-a000-00000000000b') = 0, 'A ne voit aucun post de B');
select essais.verifier(not exists (select 1 from public.publications where id = '20000000-0000-4000-a000-000000000002'), 'A ne voit pas l''idée en création de son espace');
select essais.verifier(exists (select 1 from public.publications where id = '20000000-0000-4000-a000-000000000001'), 'A voit la publication à valider');
select essais.verifier((select count(*) from public.commentaires) = 1, 'A ne voit pas le commentaire interne');
select essais.verifier((select count(*) from public.notes_internes) = 0, 'A ne voit aucune note interne');
select essais.verifier((select count(*) from public.espaces_prive) = 0, 'A ne voit pas forfait, raison sociale ni note interne de l''espace');
select essais.verifier((select count(*) from public.taches) = 0, 'A ne voit pas les tâches de Lili');
select essais.verifier((select count(*) from public.temps) = 0, 'A ne voit pas le temps passé');
select essais.verifier((select count(*) from public.factures) = 0, 'A ne voit pas la facturation');
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
insert into public.medias (espace_id, chemin, depose_par, nom_fichier) values ('10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000a/depot.jpg', '00000000-0000-4000-a000-0000000000a1', 'depot.jpg');
insert into storage.objects (bucket_id, name) values ('medias', '10000000-0000-4000-a000-00000000000a/depot.jpg');
insert into public.messages (espace_id, auteur_id, contenu) values ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'Bonjour Lili');
select essais.verifier(public.repondre_publication('20000000-0000-4000-a000-000000000001', 'valide') = 'valide', 'A valide sa publication');
reset role;

select essais.verifier((select statut from public.publications where id = '20000000-0000-4000-a000-000000000001') = 'valide', 'la publication est validée (et pas publiée par A)');
select essais.verifier((select valide_par from public.publications where id = '20000000-0000-4000-a000-000000000001') = '00000000-0000-4000-a000-0000000000a1', 'la validation est au nom de A');
select essais.verifier((select numero from public.commentaires where contenu = 'Plus de lumière ici') = 1, 'la bulle sur le visuel porte le numéro 1');
select essais.verifier((select auteur_id from public.commentaires where contenu = 'Plus de lumière ici') = '00000000-0000-4000-a000-0000000000a1', 'le commentaire est au nom de A');
select essais.verifier(exists (select 1 from public.notifications n join public.journal j on j.id = n.journal_id
  where n.personne_id = '00000000-0000-4000-a000-000000000001' and j.details ->> 'vers' = 'valide'), 'la validation de A prévient Lili');

-- ---------- Client B : rien de A ----------
select essais.devenir('00000000-0000-4000-a000-0000000000b1', 'aal1');
set local role authenticated;
select essais.verifier((select count(*) from public.publications where espace_id = '10000000-0000-4000-a000-00000000000a') = 0, 'B ne voit aucun post de A, même partagé');
select essais.verifier((select count(*) from public.commentaires) = 0, 'B ne voit aucun commentaire de A');
select essais.verifier((select count(*) from public.medias where espace_id = '10000000-0000-4000-a000-00000000000a') = 0, 'B ne voit aucun média de A');
select essais.verifier((select count(*) from public.messages) = 0, 'B ne voit pas les messages de A');
select essais.verifier((select count(*) from public.journal where espace_id = '10000000-0000-4000-a000-00000000000a') = 0, 'B ne voit pas le journal de A');
select essais.verifier((select count(*) from public.personnes where email like 'a_@essai.invalid') = 0, 'B ne voit pas les personnes de A');
select essais.verifier((select count(*) from storage.objects where name like '10000000-0000-4000-a000-00000000000a/%') = 0, 'B ne lit aucun fichier de A');
reset role;

-- ---------- Photographe invité chez A : seulement ce qu'on lui a partagé ----------
select essais.devenir('00000000-0000-4000-a000-0000000000c1', 'aal2');
set local role authenticated;
select essais.verifier((select count(*) from public.publications) = 1, 'l''invité ne voit que la publication partagée avec lui');
select essais.verifier((select count(*) from public.messages) = 0, 'l''invité ne lit pas les messages du client');
select essais.verifier((select count(*) from public.briefs) = 0, 'l''invité ne lit pas le brief');
select essais.verifier((select count(*) from public.medias) = 0, 'l''invité ne voit pas la médiathèque');
reset role;

select 'Droits vérifiés : tous les tests passent' as resultat;
rollback;
