-- Remise à zéro des commandes de test (décidée le 2026-10-12, avant l'activation de la RLS).
-- ⚠️ DESTRUCTIF ET DÉFINITIF : efface TOUTES les commandes, leurs lignes et l'historique
--    des préparateurs, et fait repartir la numérotation des bons à #1.
--    Ne touche pas : comptes, profils, grossistes, produits.
-- ⚠️ NE JAMAIS RELANCER une fois le pilote commencé (vraies commandes).

-- 1. Vérifier avant d'effacer : ce qui va disparaître
select
  (select count(*) from public.orders)             as commandes,
  (select count(*) from public.order_lines)        as lignes,
  (select count(*) from public.assignment_history) as historique;

-- 2. Effacer et remettre le compteur des numéros de bon à zéro.
--    "truncate" vide les tables d'un coup ; "restart identity" remet le serial order_number à 1.
--    Si une autre table dépendait de ces commandes, Postgres refuserait (rien ne serait effacé).
truncate table public.assignment_history, public.order_lines, public.orders restart identity;

-- 3. Vérifier : tout doit être à 0
select
  (select count(*) from public.orders)             as commandes,
  (select count(*) from public.order_lines)        as lignes,
  (select count(*) from public.assignment_history) as historique;
