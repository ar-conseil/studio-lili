#!/bin/zsh
# Met en ligne le studio de Lili sur Supabase, avec le seul jeton d'accès (API d'administration ; jamais `supabase login`).
# Accès lus dans ~/.lili/ (jamais dans le dépôt) :
#   supabase.env  SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
#   oauth.env     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MS_CLIENT_ID, MS_CLIENT_SECRET (facultatif : boutons Google / Microsoft)
#
#   outils/deployer.sh                               tests locaux, schéma, tests des droits en ligne, connexion, fonctions, config.js
#   outils/deployer.sh --proprietaire <e-mail>       en plus : compte de Lili (rôle propriétaire) et lien d'invitation dans ~/.lili/invitation.txt
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source ~/.lili/supabase.env; set +a
: "${SUPABASE_ACCESS_TOKEN:?jeton manquant dans ~/.lili/supabase.env}" "${SUPABASE_PROJECT_REF:?identifiant du projet manquant}"
SB=(npx --yes supabase@2.122.0)
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF"
SITE="https://ar-conseil.github.io/studio-lili/"
PRIVE=$(mktemp -d ~/.lili/tmp.XXXX); trap 'rm -rf "$PRIVE"' EXIT
APPLIQUEES=~/.lili/migrations-appliquees

sql() { # fichier SQL -> exécuté sur la base par l'API d'administration ; s'arrête à la première erreur
  python3 -I -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$1" > "$PRIVE/corps.json"
  local code; code=$(curl -s -o "$PRIVE/reponse.json" -w '%{http_code}' -X POST "$API/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @"$PRIVE/corps.json")
  [[ "$code" == 2* ]] || { print "   ERREUR $code : $(head -c 800 "$PRIVE/reponse.json")"; exit 1; }
}

echo "1. Tests des droits sur le Mac (PGlite)"
[ -d node_modules/@electric-sql/pglite ] || npm install --silent
node outils/tester-droits.mjs | tail -1

echo "2. Schéma (chaque migration une seule fois)"
for m in supabase/migrations/*.sql; do
  if grep -qx "$(basename "$m")" "$APPLIQUEES" 2>/dev/null; then echo "   déjà appliquée : $(basename "$m")"; continue; fi
  sql "$m" && basename "$m" >> "$APPLIQUEES" && echo "   appliquée : $(basename "$m")"
done

echo "3. Tests des droits sur la base en ligne (transaction annulée : rien ne reste)"
sql supabase/tests/droits.sql && echo "   tous les tests passent"

echo "4. Connexion : inscriptions fermées, code à 6 chiffres, Google et Microsoft"
[ -f ~/.lili/oauth.env ] && { set -a; source ~/.lili/oauth.env; set +a; }
python3 -I - "$PRIVE/auth.json" "$SITE" <<'PY'
import json, os, sys
c = {
  "disable_signup": True,                       # personne ne s'inscrit seul : Lili invite
  "site_url": sys.argv[2],
  "uri_allow_list": sys.argv[2] + ",http://localhost:8772/",
  "password_min_length": 10,
  "mfa_totp_enroll_enabled": True, "mfa_totp_verify_enabled": True, "mfa_max_enrolled_factors": 10,
  "mailer_otp_exp": 86400,                     # liens valables 24 h (invitation, connexion)
  "password_hibp_enabled": True,               # mots de passe déjà fuités sur internet refusés (Have I Been Pwned)
  "rate_limit_verify": 15, "rate_limit_otp": 10,   # tentatives de vérification et de code resserrées (par 5 min / heure)
  "sessions_inactivity_timeout": 720,          # heures : une session inutilisée 30 jours expire (mot de passe et code à nouveau)
  # Modèles de Supabase (inutilisés tant que le crochet envoi-auth est actif : c'est lui qui rédige et envoie)
  "mailer_subjects_invite": "Votre espace avec Lili Rouzier",
  "mailer_templates_invite_content": "<p>Bonjour,</p><p>Lili Rouzier vous ouvre votre espace : calendrier, publications à valider, médiathèque et messages.</p><p><a href=\"{{ .ConfirmationURL }}\">Entrer dans mon espace</a></p><p>Vous choisirez votre mot de passe en arrivant.</p>",
  "mailer_subjects_magic_link": "Votre lien de connexion",
  "mailer_templates_magic_link_content": "<p>Bonjour,</p><p><a href=\"{{ .ConfirmationURL }}\">Se connecter</a></p><p>Ce lien ne sert qu'une fois. Si vous n'avez rien demandé, ignorez ce message.</p>",
  "mailer_subjects_recovery": "Nouveau mot de passe",
  "mailer_templates_recovery_content": "<p>Bonjour,</p><p><a href=\"{{ .ConfirmationURL }}\">Choisir un nouveau mot de passe</a></p><p>Si vous n'avez rien demandé, ignorez ce message.</p>",
}
g, gs = os.environ.get("GOOGLE_CLIENT_ID"), os.environ.get("GOOGLE_CLIENT_SECRET")
if g and gs: c.update(external_google_enabled=True, external_google_client_id=g, external_google_secret=gs)
m, ms = os.environ.get("MS_CLIENT_ID"), os.environ.get("MS_CLIENT_SECRET")
if m and ms: c.update(external_azure_enabled=True, external_azure_client_id=m, external_azure_secret=ms,
                      external_azure_url="https://login.microsoftonline.com/common")
json.dump(c, open(sys.argv[1], "w"))
print("   Google : " + ("activé" if g and gs else "pas de clés dans ~/.lili/oauth.env") + " · Microsoft : " + ("activé" if m and ms else "pas de clés"))
PY
code=$(curl -s -o "$PRIVE/reponse.json" -w '%{http_code}' -X PATCH "$API/config/auth" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" --data-binary @"$PRIVE/auth.json")
[[ "$code" == 2* ]] || { echo "   ERREUR $code : $(head -c 600 "$PRIVE/reponse.json")"; exit 1; }

echo "5. Fonctions serveur, leurs secrets et la tâche planifiée des notifications"
[ -f ~/.lili/cle-synchro ] || ( umask 077; openssl rand -hex 24 > ~/.lili/cle-synchro )
# Secret du crochet d'envoi des e-mails de connexion (Standard Webhooks : « v1,whsec_ » + 32 octets en base64)
[ -f ~/.lili/crochet-email ] || ( umask 077; printf 'v1,whsec_%s\n' "$(openssl rand -base64 32)" > ~/.lili/crochet-email )
if [ ! -f ~/.lili/vapid.env ]; then   # clés des notifications sur téléphone et ordinateur (Web Push), créées une fois
  ( umask 077; npx --yes web-push@3.6.7 generate-vapid-keys --json | python3 -I -c 'import json,sys; k=json.load(sys.stdin); print("VAPID_PUBLIQUE="+k["publicKey"]); print("VAPID_PRIVEE="+k["privateKey"])' > ~/.lili/vapid.env )
fi
( umask 077
  printf 'CLE_SYNCHRO=%s\nSITE_URL=%s\nSEND_EMAIL_HOOK_SECRET=%s\n' "$(cat ~/.lili/cle-synchro)" "$SITE" "$(cat ~/.lili/crochet-email)" > "$PRIVE/secrets.env"
  cat ~/.lili/vapid.env >> "$PRIVE/secrets.env"
  [ -f ~/.lili/oauth.env ] && grep -E '^GOOGLE_CLIENT_(ID|SECRET)=.+' ~/.lili/oauth.env >> "$PRIVE/secrets.env" || true
  [ -f ~/.lili/anthropic.env ] && grep -E '^ANTHROPIC_API_KEY=.+' ~/.lili/anthropic.env >> "$PRIVE/secrets.env" || true )
"${SB[@]}" secrets set --project-ref "$SUPABASE_PROJECT_REF" --env-file "$PRIVE/secrets.env" >/dev/null && echo "   secrets à jour"
fonctions=(supabase/functions/*/index.ts(N))
for f in $fonctions; do f=${f:h:t}
  # chaque fonction vérifie elle-même l'appelant (session de Lili, ou clé de synchro des tâches planifiées)
  "${SB[@]}" functions deploy "$f" --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt --use-api >/dev/null && echo "   $f déployée"
done
# E-mails de connexion (mot de passe oublié, lien) : Supabase les confie à la fonction envoi-auth, qui les envoie
# depuis la boîte Gmail de Lili (le service intégré de Supabase n'écrit qu'aux membres de l'organisation)
python3 -I -c 'import json,sys; json.dump({"hook_send_email_enabled": True, "hook_send_email_uri": sys.argv[1], "hook_send_email_secrets": open(sys.argv[2]).read().strip()}, open(sys.argv[3], "w"))' \
  "https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/envoi-auth" ~/.lili/crochet-email "$PRIVE/crochet.json"
code=$(curl -s -o "$PRIVE/reponse.json" -w '%{http_code}' -X PATCH "$API/config/auth" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" --data-binary @"$PRIVE/crochet.json")
[[ "$code" == 2* ]] && echo "   e-mails de connexion confiés à envoi-auth (boîte Gmail de Lili)" || { echo "   ERREUR crochet $code : $(head -c 600 "$PRIVE/reponse.json")"; exit 1; }
cat > "$PRIVE/cron.sql" <<SQL
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('$(cat ~/.lili/cle-synchro)', 'cle_synchro') where not exists (select 1 from vault.secrets where name = 'cle_synchro');
select cron.unschedule('notifier') where exists (select 1 from cron.job where jobname = 'notifier');
select cron.schedule('notifier', '*/5 * * * *', \$\$ select net.http_post(url := 'https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/notifier',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle-synchro', (select decrypted_secret from vault.decrypted_secrets where name = 'cle_synchro')),
    body := '{}'::jsonb, timeout_milliseconds := 60000) \$\$);
-- Ménage : journal des tâches 7 jours, notifications traitées 60 jours
select cron.unschedule('menage') where exists (select 1 from cron.job where jobname = 'menage');
select cron.schedule('menage', '23 3 * * *', \$\$ delete from cron.job_run_details where end_time < now() - interval '7 days';
  delete from public.notifications where cree_le < now() - interval '60 days';
  delete from public.assistant_journal where cree_le < now() - interval '90 days';
  delete from public.briefs_jour where jour < current_date - 60;
  delete from public.mails_programmes where statut in ('envoye', 'annule') and cree_le < now() - interval '30 days'; \$\$);
-- Envois programmés de Lili : chaque minute, la fonction messagerie envoie ceux qui sont arrivés à l'heure
select cron.unschedule('mails-programmes') where exists (select 1 from cron.job where jobname = 'mails-programmes');
select cron.schedule('mails-programmes', '* * * * *', \$\$ select net.http_post(url := 'https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/messagerie',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle-synchro', (select decrypted_secret from vault.decrypted_secrets where name = 'cle_synchro')),
    body := '{"action": "programmes"}'::jsonb, timeout_milliseconds := 60000) \$\$);
-- La vigie : ronde de sécurité toutes les 10 minutes, jour et nuit
select cron.unschedule('vigie') where exists (select 1 from cron.job where jobname = 'vigie');
select cron.schedule('vigie', '*/10 * * * *', \$\$ select net.http_post(url := 'https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/vigie',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle-synchro', (select decrypted_secret from vault.decrypted_secrets where name = 'cle_synchro')),
    body := '{}'::jsonb, timeout_milliseconds := 120000) \$\$);
-- Brief du jour : chaque matin à 5 h UTC (6 h à Paris l'hiver, 7 h l'été), 7 jours sur 7
select cron.unschedule('brief-du-jour') where exists (select 1 from cron.job where jobname = 'brief-du-jour');
select cron.schedule('brief-du-jour', '0 5 * * *', \$\$ select net.http_post(url := 'https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/brief-du-jour',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle-synchro', (select decrypted_secret from vault.decrypted_secrets where name = 'cle_synchro')),
    body := '{}'::jsonb, timeout_milliseconds := 120000) \$\$);
-- Factures de fin de mois : le dernier jour du mois à 6 h UTC, un brouillon par client au forfait (rien n'est envoyé)
select cron.unschedule('factures-du-mois') where exists (select 1 from cron.job where jobname = 'factures-du-mois');
select cron.schedule('factures-du-mois', '0 6 28-31 * *', \$\$ select public.preparer_factures_du_mois(current_date)
  where current_date = (date_trunc('month', current_date) + interval '1 month - 1 day')::date \$\$);
-- Compte pro (Revolut, lecture seule) : relu toutes les heures
select cron.unschedule('banque') where exists (select 1 from cron.job where jobname = 'banque');
select cron.schedule('banque', '17 * * * *', \$\$ select net.http_post(url := 'https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/banque',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle-synchro', (select decrypted_secret from vault.decrypted_secrets where name = 'cle_synchro')),
    body := '{}'::jsonb, timeout_milliseconds := 120000) \$\$);
SQL
sql "$PRIVE/cron.sql" && echo "   tâches « notifier » (5 min), « mails-programmes » (1 min), « vigie » (10 min), « brief-du-jour » (chaque matin), « factures-du-mois », « banque » (1 h) et « menage »"

echo "6. Clé publique du site (assets/config.js)"
curl -s "$API/api-keys" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" > "$PRIVE/cles.json"
ANON=$(python3 -I -c 'import json,sys; print([x for x in json.load(open(sys.argv[1])) if x.get("name")=="anon"][0]["api_key"])' "$PRIVE/cles.json")
cat > assets/config.js <<JS
/* Adresse du projet Supabase et clé publique (« anon »), écrites par outils/deployer.sh.
   Cette clé est faite pour être publique : sans connexion, la base ne renvoie rien (règles RLS).
   Ne jamais mettre ici la clé service_role. */
window.STUDIO_CONFIG = {
  url: "https://$SUPABASE_PROJECT_REF.supabase.co",
  cle: "$ANON"
};
JS
echo "   écrite (à commiter : GitHub Pages la sert au site)"

if [[ "${1:-}" == "--proprietaire" && -n "${2:-}" ]]; then
  echo "7. Invitation de Lili (rôle propriétaire)"
  SERVICE=$(python3 -I -c 'import json,sys; print([x for x in json.load(open(sys.argv[1])) if x.get("name")=="service_role"][0]["api_key"])' "$PRIVE/cles.json")
  # Lien d'invitation généré sans e-mail (l'envoi intégré de Supabase ne sert que les membres de l'organisation) :
  # rangé dans ~/.lili/invitation.txt, à transmettre à Lili. Il ne sert qu'une fois et expire après 24 h.
  python3 -I -c 'import json,sys; print(json.dumps({"type": "invite", "email": sys.argv[1], "data": {"nom": "Lili Rouzier"}, "redirect_to": sys.argv[2]}))' "$2" "$SITE" > "$PRIVE/invite.json"
  code=$(curl -s -o "$PRIVE/reponse.json" -w '%{http_code}' -X POST "https://$SUPABASE_PROJECT_REF.supabase.co/auth/v1/admin/generate_link" \
    -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" --data-binary @"$PRIVE/invite.json")
  [[ "$code" == 2* ]] || { echo "   ERREUR $code : $(head -c 600 "$PRIVE/reponse.json")"; exit 1; }
  ( umask 077; python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["action_link"])' "$PRIVE/reponse.json" > ~/.lili/invitation.txt )
  ID=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$PRIVE/reponse.json")
  # Rôle posé côté serveur (app_metadata), jamais modifiable par l'intéressée ; recopié dans public.personnes
  curl -s -o /dev/null -X PUT "https://$SUPABASE_PROJECT_REF.supabase.co/auth/v1/admin/users/$ID" -H "apikey: $SERVICE" \
    -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d '{"app_metadata":{"role":"proprietaire"}}'
  printf "update public.personnes set role = 'proprietaire', nom = 'Lili Rouzier' where id = '%s';\n" "$ID" > "$PRIVE/role.sql"
  sql "$PRIVE/role.sql"
  echo "   lien d'invitation dans ~/.lili/invitation.txt (24 h, une seule fois) : à transmettre à Lili ;"
  echo "   en arrivant, elle choisit son mot de passe puis relie son code à 6 chiffres"
fi
echo "Terminé."
