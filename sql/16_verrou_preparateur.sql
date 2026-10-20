-- Verrou « qu'on peut reprendre » (décidé le 2026-10-20) :
-- seul le vendeur qui a PRIS un rayon (ou la commande, chez un grossiste sans rayon)
-- peut changer le statut de ses lignes. Les autres doivent d'abord cliquer « Reprendre »
-- (geste volontaire, visible de tous, inscrit dans l'historique).
-- Évite qu'un collègue mette « prêt » sur une préparation en cours, sans recréer le problème
-- d'origine : on peut TOUJOURS reprendre une commande si quelqu'un est absent.
-- À lancer une seule fois dans Supabase → SQL Editor (relançable).

create or replace function public.check_order_line_lock() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  holder text;
begin
  -- Hors de l'app (SQL Editor, personne de connecté) : pas de verrou
  if auth.uid() is null then
    return new;
  end if;

  -- Une prise en charge (« Je prends » / « Reprendre ») ne change que assigned_to / assigned_at :
  -- toujours permise. Ranger une ligne « À répartir » dans un rayon aussi.
  if new.status is not distinct from old.status
     and new.substituted_name is not distinct from old.substituted_name then
    return new;
  end if;

  -- Celui qui tient la ligne : le vendeur du rayon, sinon celui qui a pris toute la commande
  select coalesce(old.assigned_to, o.assigned_to) into holder
  from public.orders o where o.id = new.order_id;

  if holder is null then
    raise exception 'Personne n''a pris ce produit : clique d''abord sur « Je prends ».';
  end if;

  if holder is distinct from public.my_display_name() then
    raise exception '% prépare ce produit : clique sur « Reprendre » pour t''en occuper.', holder;
  end if;

  return new;
end;
$$;

drop trigger if exists check_order_line_lock on public.order_lines;
create trigger check_order_line_lock
  before update on public.order_lines
  for each row execute function public.check_order_line_lock();
