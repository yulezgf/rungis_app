-- Rayons (étape 1) : chez les grossistes de viande rouge, une commande est préparée par rayon
-- (Bœuf, Veau, Agneau, Sous-vide, Triperie), chacun avec son vendeur, mais reste UNE commande :
-- un numéro de bon, une facture, une caisse.
-- À lancer une seule fois dans Supabase → SQL Editor (relançable sans danger), puis pousser le code.

-- 1. Les rayons d'un grossiste (un grossiste sans rayon fonctionne comme avant)
create table if not exists public.rayons (
  id           uuid primary key default gen_random_uuid(),
  grossiste_id uuid not null references public.grossistes (id) on delete cascade,
  name         text not null,
  position     int not null default 0, -- ordre d'affichage
  unique (grossiste_id, name)
);

alter table public.rayons enable row level security;
drop policy if exists "les connectés lisent les rayons" on public.rayons;
create policy "les connectés lisent les rayons" on public.rayons
  for select to authenticated using (true);

-- 2. Le rayon se règle PAR PRODUIT ET PAR GROSSISTE, dans l'assortiment :
--    une bavette sous vide est du bœuf, mais elle part au rayon Sous-vide.
alter table public.assortiments
  add column if not exists rayon_id uuid references public.rayons (id) on delete set null;

-- 3. Chaque ligne de commande garde le rayon où elle a été envoyée.
--    null = « À répartir » (produit non classé chez ce grossiste, ou ligne libre).
alter table public.order_lines
  add column if not exists rayon_id uuid references public.rayons (id) on delete set null;

-- 4. À la création d'une ligne, la base la range toute seule dans son rayon
--    (d'après l'assortiment du grossiste de la commande).
create or replace function public.set_order_line_rayon() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.product_id is not null then
    select a.rayon_id into new.rayon_id
    from public.orders o
    join public.assortiments a on a.grossiste_id = o.grossiste_id and a.product_id = new.product_id
    where o.id = new.order_id;
  else
    new.rayon_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_order_line_rayon on public.order_lines;
create trigger set_order_line_rayon
  before insert on public.order_lines
  for each row execute function public.set_order_line_rayon();

-- 5. L'équipe peut ranger une ligne « À répartir » dans un de SES rayons
--    (le trigger sql/08 n'interdit que de toucher aux choix du client : rayon_id n'en fait pas partie).
--    Un rayon d'un autre grossiste est refusé :
create or replace function public.check_order_line_rayon() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.rayon_id is not null and new.rayon_id is distinct from old.rayon_id and not exists (
    select 1 from public.rayons r join public.orders o on o.grossiste_id = r.grossiste_id
    where r.id = new.rayon_id and o.id = new.order_id
  ) then
    raise exception 'Ce rayon n''appartient pas au grossiste de la commande.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_order_line_rayon on public.order_lines;
create trigger check_order_line_rayon
  before update on public.order_lines
  for each row execute function public.check_order_line_rayon();

-- 6. Les rayons d'Eurodis, et le classement de son assortiment actuel par catégorie.
--    (Les produits sous vide seront classés en « Sous-vide » quand ils seront ajoutés au référentiel.)
insert into public.rayons (grossiste_id, name, position)
select g.id, r.name, r.position
from public.grossistes g
cross join (values ('Bœuf', 1), ('Veau', 2), ('Agneau', 3), ('Sous-vide', 4), ('Triperie', 5)) as r(name, position)
where g.name = 'Eurodis'
on conflict (grossiste_id, name) do nothing;

update public.assortiments a
set rayon_id = r.id
from public.products p, public.rayons r, public.grossistes g
where a.product_id = p.id
  and a.grossiste_id = g.id and g.name = 'Eurodis'
  and r.grossiste_id = g.id
  and a.rayon_id is null
  and r.name = case p.category
                 when 'Bœuf' then 'Bœuf'
                 when 'Veau' then 'Veau'
                 when 'Agneau' then 'Agneau'
                 when 'Abats' then 'Triperie'
                 when 'Tripes' then 'Triperie'
               end;

-- Vérification : l'assortiment d'Eurodis et le rayon de chaque produit
select p.name as produit, p.category as categorie, coalesce(r.name, '— à répartir —') as rayon
from public.assortiments a
join public.grossistes g on g.id = a.grossiste_id
join public.products p on p.id = a.product_id
left join public.rayons r on r.id = a.rayon_id
where g.name = 'Eurodis'
order by r.position nulls last, p.name;
