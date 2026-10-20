-- 1. Unité « carton » (colis) : le rayon Sous-vide vend des pièces désossées en cartons.
--    Les pièces sur os (demi-veau, basse, cuisseau, AV5, aloyau, train de côte…) restent en « carcasse ».
-- 2. Prise en charge PAR RAYON (étape 2) : « Moussa prend l'Agneau » inscrit Moussa
--    sur les lignes Agneau de la commande. Un grossiste sans rayon garde la prise en charge
--    de toute la commande (orders.assigned_to), comme avant.
-- À lancer une seule fois dans Supabase → SQL Editor (relançable), puis pousser le code.

-- 1a. Lignes libres : unité « carton » autorisée
alter table public.order_lines drop constraint if exists order_lines_custom_unit_check;
alter table public.order_lines
  add constraint order_lines_custom_unit_check check (custom_unit in ('unité', 'carcasse', 'carton', 'kg'));

-- 1b. Référentiel : si une règle limite products.unit, on la remplace pour accepter « carton »
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.products'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%unit%'
  loop
    execute format('alter table public.products drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.products drop constraint if exists products_unit_check;
alter table public.products
  add constraint products_unit_check check (unit in ('unité', 'carcasse', 'carton', 'kg'));

-- 2a. Qui prépare chaque ligne (rempli quand un vendeur prend le rayon de la ligne)
alter table public.order_lines add column if not exists assigned_to text;
alter table public.order_lines add column if not exists assigned_at timestamptz;

-- 2b. L'historique garde aussi le rayon pris (null = toute la commande)
alter table public.assignment_history
  add column if not exists rayon_id uuid references public.rayons (id) on delete set null;

-- 2c. Comme pour l'historique : on ne peut inscrire sur une ligne que SON propre prénom
create or replace function public.check_order_line_assignee() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is not null
     and new.assigned_to is distinct from (select display_name from public.profiles where id = auth.uid())
     and auth.uid() is not null then
    raise exception 'On ne peut prendre une ligne qu''à son propre nom.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_order_line_assignee on public.order_lines;
create trigger check_order_line_assignee
  before update on public.order_lines
  for each row execute function public.check_order_line_assignee();
