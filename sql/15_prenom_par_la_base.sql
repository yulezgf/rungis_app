-- La base inscrit ELLE-MÊME le prénom du compte connecté lors d'une prise en charge
-- (« Je prends » / « Reprendre »), au lieu de faire confiance au prénom envoyé par l'app.
-- Avant (sql/14) : la base REFUSAIT si le prénom envoyé n'était pas celui du compte connecté
-- (erreur « On ne peut prendre une ligne qu'à son propre nom » quand deux comptes
-- partagent le même navigateur). Maintenant : elle CORRIGE, toujours avec le vrai nom.
-- À lancer une seule fois dans Supabase → SQL Editor (relançable).

-- Le prénom du compte connecté (null dans le SQL Editor, où personne n'est connecté)
create or replace function public.my_display_name() returns text
language sql stable security definer set search_path = ''
as $$
  select display_name from public.profiles where id = auth.uid();
$$;

-- Trigger commun : si la prise en charge change, on y met le vrai prénom.
-- (Hors connexion, ex. SQL Editor, on laisse la valeur telle quelle.)
create or replace function public.set_assigned_to_me() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to
          or new.assigned_at is distinct from old.assigned_at) then
    new.assigned_to := public.my_display_name();
  end if;
  return new;
end;
$$;

-- 1. Lignes (prise en charge par rayon) : remplace la vérification de sql/14
drop trigger if exists check_order_line_assignee on public.order_lines;
drop function if exists public.check_order_line_assignee();

drop trigger if exists set_assigned_to_me on public.order_lines;
create trigger set_assigned_to_me
  before update on public.order_lines
  for each row execute function public.set_assigned_to_me();

-- 2. Commandes (grossiste sans rayon : « Je prends » prend toute la commande)
drop trigger if exists set_assigned_to_me on public.orders;
create trigger set_assigned_to_me
  before update on public.orders
  for each row execute function public.set_assigned_to_me();

-- 3. Historique : même chose à l'écriture (la règle de sécurité sql/07 vérifie ensuite
--    que c'est bien le nom du compte connecté : c'est désormais toujours le cas)
drop trigger if exists set_assigned_to_me on public.assignment_history;
create trigger set_assigned_to_me
  before insert on public.assignment_history
  for each row execute function public.set_assigned_to_me();
