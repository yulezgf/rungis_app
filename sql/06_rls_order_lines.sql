-- Étape 5, table 3 : RLS sur les lignes de commande (order_lines)
-- À lancer une seule fois dans Supabase → SQL Editor.
--
-- Astuce : la sous-requête sur orders est elle-même filtrée par la RLS de orders (sql/05).
-- « La commande existe pour moi » veut donc dire « j'ai le droit de voir cette commande ».

alter table public.order_lines enable row level security;

-- LIRE : une ligne est visible si sa commande est visible
-- (client de la commande, ou équipe du grossiste).
create policy "lire les lignes de ses commandes" on public.order_lines
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_lines.order_id)
  );

-- CRÉER : le client, uniquement dans SA commande,
-- et uniquement avec un produit du catalogue de CE grossiste.
create policy "le client ajoute des lignes à sa commande" on public.order_lines
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      join public.products p on p.grossiste_id = o.grossiste_id
      where o.id = order_lines.order_id
        and o.customer_id = auth.uid()
        and p.id = order_lines.product_id
    )
  );

-- MODIFIER (statut, substitution) : l'équipe du grossiste de la commande.
create policy "l'équipe met à jour les lignes" on public.order_lines
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_lines.order_id
        and o.grossiste_id = public.my_grossiste_id()
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_lines.order_id
        and o.grossiste_id = public.my_grossiste_id()
    )
  );

-- SUPPRIMER : personne depuis l'app (aucune règle).

-- Vérification
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'order_lines';
