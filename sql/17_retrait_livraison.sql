-- Retrait sur place ou livraison : choisi par le client à l'envoi de la commande,
-- affiché en gros au préparateur (il ne prépare pas pareil un retrait à 5h et un chargement camion).
-- À lancer une seule fois dans Supabase → SQL Editor (relançable), puis pousser le code.

alter table public.orders
  add column if not exists fulfillment text not null default 'retrait'
  check (fulfillment in ('retrait', 'livraison'));

-- Les commandes déjà passées valent « retrait » (valeur par défaut).
