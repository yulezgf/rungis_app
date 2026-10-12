-- Étape 5, table 2 : RLS sur les commandes (orders)
-- À lancer une seule fois dans Supabase → SQL Editor.
--
-- Rappel : my_grossiste_id() (sql/02) renvoie le grossiste de la personne connectée,
-- ou null si c'est un client.

alter table public.orders enable row level security;

-- LIRE : le client voit SES commandes ; l'équipe voit celles de SON grossiste.
-- (C'est aussi ce qui protège la page /suivi : une commande n'est plus visible que par eux.)
create policy "lire ses commandes" on public.orders
  for select to authenticated
  using (
    customer_id = auth.uid()
    or grossiste_id = public.my_grossiste_id()
  );

-- CRÉER : seul un client, et uniquement pour lui-même
-- (customer_id est rempli automatiquement par default auth.uid()).
create policy "un client crée ses commandes" on public.orders
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and public.my_grossiste_id() is null
  );

-- MODIFIER (prise en charge « Je prends » / « Reprendre ») : l'équipe du grossiste,
-- et la commande doit rester chez ce grossiste.
create policy "l'équipe modifie ses commandes" on public.orders
  for update to authenticated
  using (grossiste_id = public.my_grossiste_id())
  with check (grossiste_id = public.my_grossiste_id());

-- SUPPRIMER : personne depuis l'app (aucune règle).

-- Vérification
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'orders';
