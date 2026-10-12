-- Étape 6 : la base fait respecter les règles de substitution (règle métier 4)
-- À lancer une seule fois dans Supabase → SQL Editor.
--
-- Un trigger est du code qui s'exécute dans la base à chaque modification d'une ligne
-- de commande, AVANT l'enregistrement. S'il lève une erreur, rien n'est enregistré,
-- et l'app affiche le message. Il s'applique à tout le monde, quelle que soit la façon
-- dont la modification arrive (app, API, SQL Editor).

create function public.check_order_line_update() returns trigger
language plpgsql
as $$
begin
  -- 1. Les choix du client ne se modifient pas après l'envoi
  --    (produit, quantité, mode et liste de substitution).
  if new.order_id is distinct from old.order_id
     or new.product_id is distinct from old.product_id
     or new.quantity is distinct from old.quantity
     or new.substitution_mode is distinct from old.substitution_mode
     or new.substitution_list is distinct from old.substitution_list then
    raise exception 'Les choix du client (produit, quantité, substitution) ne peuvent pas être modifiés.';
  end if;

  -- 2. Une ligne qui n'est pas « substitué » n'a pas de remplaçant.
  if new.status <> 'substitué' then
    new.substituted_name := null;
    return new;
  end if;

  -- 3. « substitué » : le remplaçant doit respecter le mode choisi par le client.
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

create trigger check_order_line_update
  before update on public.order_lines
  for each row execute function public.check_order_line_update();
