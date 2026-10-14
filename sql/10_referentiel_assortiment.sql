-- Référentiel commun + assortiment par grossiste + top 10 (décidé le 2026-10-14)
-- À lancer une seule fois dans Supabase → SQL Editor, puis pousser le code tout de suite après.
--
-- Avant : chaque produit appartenait à un seul grossiste (products.grossiste_id).
-- Après :
--   - products = le RÉFÉRENTIEL : chaque produit existe une seule fois (nom, métier, catégorie, unité) ;
--   - assortiments = « tel grossiste vend tel produit » ;
--   - le client peut commander tout produit du référentiel chez n'importe quel grossiste
--     (et une ligne libre s'il n'est pas dans le référentiel) : rien ne bloque jamais.

-- 1. Le métier de chaque produit (Boucherie aujourd'hui ; Fruits et légumes, etc. plus tard)
alter table public.products add column metier text not null default 'Boucherie';

-- 2. L'assortiment, rempli à partir de l'ancien rattachement produit → grossiste
create table public.assortiments (
  grossiste_id uuid not null references public.grossistes (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (grossiste_id, product_id)
);

insert into public.assortiments (grossiste_id, product_id)
select grossiste_id, id from public.products where grossiste_id is not null;

-- 3. Fusion des doublons (même nom, ex. « Poulet entier » chez deux grossistes) :
--    on garde un seul produit, vendu par tous les grossistes qui l'avaient.
create temporary table doublons as
select id, keep_id
from (
  select id, first_value(id) over (partition by lower(trim(name)) order by id) as keep_id
  from public.products
) t
where id <> keep_id;

insert into public.assortiments (grossiste_id, product_id)
select a.grossiste_id, d.keep_id
from public.assortiments a join doublons d on d.id = a.product_id
on conflict do nothing;

-- Les lignes de commande qui pointaient vers un doublon pointent vers le produit gardé.
-- Le trigger interdit normalement de changer le produit d'une ligne : on le coupe le temps de l'opération.
alter table public.order_lines disable trigger check_order_line_update;
update public.order_lines ol set product_id = d.keep_id from doublons d where ol.product_id = d.id;
alter table public.order_lines enable trigger check_order_line_update;

delete from public.products p using doublons d where p.id = d.id;
drop table doublons;

-- Un nom ne peut plus exister deux fois dans le référentiel
create unique index products_nom_unique on public.products (lower(trim(name)));

-- L'ancien rattachement n'est plus utilisé par le code (gardé pour l'instant, à supprimer plus tard)
alter table public.products alter column grossiste_id drop not null;
comment on column public.products.grossiste_id is 'OBSOLÈTE depuis sql/10 : remplacé par la table assortiments';

-- 4. RLS de l'assortiment : lecture pour les connectés, aucune écriture depuis l'app
alter table public.assortiments enable row level security;
create policy "les connectés lisent les assortiments" on public.assortiments
  for select to authenticated using (true);

-- 5. Une ligne de commande peut utiliser n'importe quel produit du référentiel
drop policy "le client ajoute des lignes à sa commande" on public.order_lines;
create policy "le client ajoute des lignes à sa commande" on public.order_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_lines.order_id
        and o.customer_id = auth.uid()
    )
    and (
      order_lines.product_id is null
      or exists (select 1 from public.products p where p.id = order_lines.product_id)
    )
  );

-- 6. Trigger : en « Substitut libre », le remplaçant doit être un produit du référentiel
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

  if new.substitution_mode = 'open'
     and not exists (select 1 from public.products p where p.name = new.substituted_name) then
    raise exception 'Le remplaçant doit être un produit de la liste.';
  end if;

  return new;
end;
$$;

-- 7. Top 10 pour un client chez un grossiste :
--    d'abord SES produits les plus commandés chez ce grossiste,
--    puis les meilleures ventes du grossiste (tous clients),
--    puis le reste de l'assortiment (utile pour un nouveau grossiste sans historique).
--    security definer : la fonction compte toutes les commandes, mais ne renvoie que des produits,
--    jamais qui a commandé quoi.
create function public.top_products(p_grossiste_id uuid, p_limit int default 10)
returns table (id uuid, name text, unit text, category text)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select ol.product_id, count(*) as n
    from public.order_lines ol join public.orders o on o.id = ol.order_id
    where o.grossiste_id = p_grossiste_id and o.customer_id = auth.uid() and ol.product_id is not null
    group by ol.product_id
  ),
  everyone as (
    select ol.product_id, count(*) as n
    from public.order_lines ol join public.orders o on o.id = ol.order_id
    where o.grossiste_id = p_grossiste_id and ol.product_id is not null
    group by ol.product_id
  )
  select p.id, p.name, p.unit, p.category
  from public.products p
  left join mine m on m.product_id = p.id
  left join everyone e on e.product_id = p.id
  where m.product_id is not null
     or e.product_id is not null
     or exists (select 1 from public.assortiments a where a.grossiste_id = p_grossiste_id and a.product_id = p.id)
  order by coalesce(m.n, 0) desc, coalesce(e.n, 0) desc, p.name
  limit p_limit;
$$;

revoke execute on function public.top_products(uuid, int) from public, anon;
grant execute on function public.top_products(uuid, int) to authenticated;

-- Vérifications
select g.name as grossiste, count(*) as produits_dans_assortiment
from public.assortiments a join public.grossistes g on g.id = a.grossiste_id
group by g.name order by g.name;

select count(*) as produits_dans_referentiel from public.products;
