-- Compte Revolut personnel (22/11/2026) : pas d'API Revolut pour les comptes non Business. Lili importe le relevé
-- (CSV exporté de l'application Revolut) depuis Comptabilité : elle ajoute et retire elle-même ses opérations.
-- Toujours Lili seule avec son code (politique « proprietaire » déjà en place) ; un client n'a aucun accès.
grant insert, delete on public.banque_operations to authenticated;
