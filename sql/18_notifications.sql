-- Notifications aux préparateurs (session 1) : adresses de notification des téléphones,
-- « Je suis de service » et rayons du vendeur dans son profil.
-- Règle (CLAUDE.md, règle 3) : une commande n'est JAMAIS confiée à une seule personne, même pour prévenir :
-- on préviendra tous les vendeurs de service du rayon concerné, puis toute l'équipe (escalade).
-- À lancer une seule fois dans Supabase → SQL Editor (relançable), puis pousser le code.

-- 1. Une ligne par téléphone (ou navigateur) qui a activé les notifications
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint   text not null unique, -- adresse fournie par le navigateur (Google, Apple, Mozilla…)
  p256dh     text not null,        -- clés de chiffrement du téléphone
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Chacun ne voit, n'ajoute et ne retire QUE ses propres téléphones
drop policy if exists "mes téléphones" on public.push_subscriptions;
create policy "mes téléphones" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Dans le profil du vendeur : de service ou pas, et ses rayons
alter table public.profiles add column if not exists on_duty boolean not null default true;
alter table public.profiles add column if not exists rayon_ids uuid[] not null default '{}';

-- Le vendeur peut régler lui-même ces deux réglages (en plus de son prénom)
grant update (display_name, on_duty, rayon_ids) on public.profiles to authenticated;
