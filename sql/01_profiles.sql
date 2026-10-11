-- Étape 2 : profils utilisateurs
-- À lancer une seule fois dans Supabase → SQL Editor.

-- 1. La table : un profil par compte (même id que auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'grossiste')),
  display_name text,                                      -- nom de la boutique, ou prénom du préparateur
  grossiste_id uuid references public.grossistes (id),    -- rempli seulement pour l'équipe d'un grossiste
  created_at timestamptz not null default now(),
  -- un membre d'équipe doit toujours être rattaché à un grossiste
  constraint grossiste_rattache check (role = 'client' or grossiste_id is not null)
);

-- 2. Sécurité, dès la création :
--    chacun ne lit que son profil, et ne peut modifier QUE son nom.
--    Le rôle et le grossiste ne se changent qu'ici, dans le SQL Editor (par toi).
alter table public.profiles enable row level security;

create policy "lire son profil" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "modifier son profil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 3. Création automatique du profil (rôle client) à chaque nouveau compte
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Profils pour les comptes déjà créés (le tien, à l'étape 1)
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
