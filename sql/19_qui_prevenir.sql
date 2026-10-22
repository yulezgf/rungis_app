-- Notifications (partie 2a) : QUI prévenir quand un client envoie une commande.
-- Règle (CLAUDE.md, règle 3) : jamais une seule personne. On prévient :
--   - les vendeurs DE SERVICE du grossiste…
--   - …dont un des rayons est dans la commande (ou qui n'ont choisi aucun rayon = tous les rayons) ;
--   - s'il y a une ligne « À répartir », ou si le grossiste n'a pas de rayon : tous les vendeurs de service ;
--   - si PERSONNE ne correspond (personne de service) : toute l'équipe du grossiste.
-- « security definer » : la fonction lit les téléphones des vendeurs, que le client n'a pas le droit de voir ;
-- elle ne répond que pour une commande du client qui l'appelle.
-- À lancer une seule fois dans Supabase → SQL Editor (relançable), puis pousser le code.

create or replace function public.push_targets_new_order(p_order_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  g             uuid;
  order_rayons  uuid[];
  has_unsorted  boolean;
  has_rayons    boolean;
begin
  -- Seulement pour une commande de la personne qui appelle
  select o.grossiste_id into g from public.orders o where o.id = p_order_id and o.customer_id = auth.uid();
  if g is null then
    return;
  end if;

  select coalesce(array_agg(distinct ol.rayon_id) filter (where ol.rayon_id is not null), '{}'),
         coalesce(bool_or(ol.rayon_id is null), false)
    into order_rayons, has_unsorted
  from public.order_lines ol
  where ol.order_id = p_order_id;

  has_rayons := exists (select 1 from public.rayons r where r.grossiste_id = g);

  return query
  with concernes as (
    select p.id
    from public.profiles p
    where p.role = 'grossiste' and p.grossiste_id = g and p.on_duty
      and (not has_rayons or has_unsorted or p.rayon_ids = '{}' or p.rayon_ids && order_rayons)
  ),
  destinataires as (
    select c.id from concernes c
    union
    -- Personne de concerné : toute l'équipe (une commande n'est jamais laissée sans personne de prévenu)
    select p.id from public.profiles p
    where p.role = 'grossiste' and p.grossiste_id = g and not exists (select 1 from concernes)
  )
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where s.user_id in (select d.id from destinataires d);
end;
$$;

revoke execute on function public.push_targets_new_order(uuid) from public, anon;
grant execute on function public.push_targets_new_order(uuid) to authenticated;
