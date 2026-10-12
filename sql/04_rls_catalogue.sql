-- Étape 5, table 1 : RLS sur le catalogue (grossistes + produits)
-- À lancer une seule fois dans Supabase → SQL Editor.
--
-- Règle : toute personne connectée peut LIRE les grossistes et les produits.
-- Personne ne peut les MODIFIER depuis l'app (aucune règle d'écriture = écriture refusée).
-- Toi, tu gardes la main : le SQL Editor et le Table Editor de Supabase (import CSV compris)
-- passent par un compte administrateur qui n'est pas soumis à la RLS.

alter table public.grossistes enable row level security;
alter table public.products   enable row level security;

create policy "les connectés lisent les grossistes" on public.grossistes
  for select to authenticated using (true);

create policy "les connectés lisent les produits" on public.products
  for select to authenticated using (true);

-- Vérification : les deux tables doivent avoir rowsecurity = true
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('grossistes', 'products');
