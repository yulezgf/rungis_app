-- Étape 5, table 4 : RLS sur l'historique des prises en charge (assignment_history)
-- À lancer une seule fois dans Supabase → SQL Editor.
-- Dernière table : après ce script, toutes les tables de l'app sont protégées.

alter table public.assignment_history enable row level security;

-- LIRE : l'équipe du grossiste de la commande (les clients n'en ont pas besoin).
create policy "l'équipe lit l'historique de ses commandes" on public.assignment_history
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = assignment_history.order_id
        and o.grossiste_id = public.my_grossiste_id()
    )
  );

-- ÉCRIRE (« Je prends » / « Reprendre ») : l'équipe du grossiste de la commande,
-- et uniquement sous son propre nom : impossible d'inscrire le prénom d'un collègue.
create policy "l'équipe inscrit ses prises en charge" on public.assignment_history
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = assignment_history.order_id
        and o.grossiste_id = public.my_grossiste_id()
    )
    and assigned_to = (select display_name from public.profiles where id = auth.uid())
  );

-- MODIFIER / SUPPRIMER : personne (un historique ne se réécrit pas).

-- Vérification finale : toutes les tables doivent avoir rowsecurity = true
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
order by tablename;
