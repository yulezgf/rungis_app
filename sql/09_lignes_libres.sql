-- Lignes libres : le client peut commander un produit qui n'est pas (encore) dans la liste de référence.
-- La base de produits est la liste de référence construite par l'utilisateur, pas le catalogue
-- du grossiste : elle aide à aller vite, mais ne limite jamais ce qu'on peut commander.
-- À lancer une seule fois dans Supabase → SQL Editor.

-- 1. Une ligne = SOIT un produit de la liste (product_id), SOIT un nom saisi (custom_name + custom_unit).
alter table public.order_lines alter column product_id drop not null;

alter table public.order_lines
  add column custom_name text,
  add column custom_unit text check (custom_unit in ('unité', 'carcasse', 'kg'));

alter table public.order_lines
  add constraint produit_ou_nom_saisi check (
    (product_id is not null and custom_name is null and custom_unit is null)
    or (product_id is null and coalesce(trim(custom_name), '') <> '' and custom_unit is not null)
  );

-- 2. RLS : le client peut maintenant ajouter une ligne sans produit de la liste.
--    Si un produit de la liste est utilisé, il doit toujours être celui de ce grossiste.
drop policy "le client ajoute des lignes à sa commande" on public.order_lines;

create policy "le client ajoute des lignes à sa commande" on public.order_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_lines.order_id
        and o.customer_id = auth.uid()
        and (
          order_lines.product_id is null
          or exists (
            select 1 from public.products p
            where p.id = order_lines.product_id
              and p.grossiste_id = o.grossiste_id
          )
        )
    )
  );

-- 3. Trigger (sql/08) : le nom saisi et son unité font partie des choix du client,
--    ils ne se modifient pas non plus après l'envoi.
create or replace function public.check_order_line_update() returns trigger
language plpgsql
as $$
begin
  if new.order_id is distinct from old.order_id
     or new.product_id is distinct from old.product_id
     or new.custom_name is distinct from old.custom_name
     or new.custom_unit is distinct from old.custom_unit
     or new.quantity is distinct from old.quantity
     or new.substitution_mode is distinct from old.substitution_mode
     or new.substitution_list is distinct from old.substitution_list then
    raise exception 'Les choix du client (produit, quantité, substitution) ne peuvent pas être modifiés.';
  end if;

  if new.status <> 'substitué' then
    new.substituted_name := null;
    return new;
  end if;

  if new.substitution_mode = 'none' then
    raise exception 'Le client refuse toute substitution pour ce produit : mettre la ligne en rupture.';
  end if;

  if coalesce(trim(new.substituted_name), '') = '' then
    raise exception 'Indiquer le produit de remplacement.';
  end if;

  if new.substitution_mode = 'restricted'
     and not (new.substituted_name = any (coalesce(new.substitution_list, '{}'))) then
    raise exception 'Ce remplaçant n''est pas dans la liste autorisée par le client.';
  end if;

  if new.substitution_mode = 'open' and not exists (
    select 1
    from public.orders o
    join public.products p on p.grossiste_id = o.grossiste_id
    where o.id = new.order_id
      and p.name = new.substituted_name
  ) then
    raise exception 'Le remplaçant doit être un produit du catalogue de ce grossiste.';
  end if;

  return new;
end;
$$;
