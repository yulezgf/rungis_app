-- Étape 3c : chaque commande sait quel client l'a passée
-- À lancer une seule fois dans Supabase → SQL Editor.

-- 1. La colonne : remplie automatiquement avec la personne connectée (auth.uid())
--    au moment où la commande est créée. Le code n'a rien à envoyer, et ne peut pas l'oublier.
--    Les 22 anciennes commandes de test restent sans client (null).
alter table public.orders
  add column customer_id uuid default auth.uid() references public.profiles (id);

-- 2. Le grossiste de la personne connectée (null pour un client).
--    "security definer" : la fonction lit profiles sans être bloquée par sa propre sécurité,
--    ce qui évite une boucle infinie dans la règle ci-dessous.
create function public.my_grossiste_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select grossiste_id from public.profiles where id = auth.uid();
$$;

-- 3. L'équipe d'un grossiste peut lire le profil (le nom) des clients
--    qui ont passé au moins une commande chez ce grossiste. Rien de plus.
create policy "l'équipe voit ses clients" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.customer_id = profiles.id
        and o.grossiste_id = public.my_grossiste_id()
    )
  );
