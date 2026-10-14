-- Commentaire du client pour le préparateur (« Un mot pour le préparateur »)
-- À lancer une seule fois dans Supabase → SQL Editor, puis pousser le code.

-- 1. Le commentaire, facultatif, 500 caractères maximum
alter table public.orders
  add column if not exists comment text check (char_length(comment) <= 500);

-- 2. Verrou : sur une commande, l'équipe ne peut modifier QUE la prise en charge.
--    Le commentaire, le client, le grossiste… restent tels que le client les a envoyés.
--    (La RLS dit QUELLES commandes on peut modifier ; ces droits disent QUELLES colonnes.)
revoke update on public.orders from anon, authenticated;
grant update (assigned_to, assigned_at) on public.orders to authenticated;
