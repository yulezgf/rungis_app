-- Comptes clients chez un grossiste (étape A) : pas de compte accepté, pas de commande.
-- À lancer une seule fois dans Supabase → SQL Editor, puis pousser le code.
-- ⚠️ Après ce script, un client ne peut plus commander chez un grossiste tant que
--    sa demande d'ouverture de compte n'a pas été acceptée par l'équipe de ce grossiste.

-- 1. Les comptes : un client, un grossiste, un statut
create table if not exists public.customer_accounts (
  customer_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  grossiste_id    uuid not null references public.grossistes (id) on delete cascade,
  status          text not null default 'en attente' check (status in ('en attente', 'accepté', 'refusé')),
  existing_number text,        -- « j'ai déjà un compte chez eux, n° … » (déclaré par le client)
  account_number  text,        -- numéro client confirmé par le grossiste
  requested_at    timestamptz not null default now(),
  decided_at      timestamptz,
  primary key (customer_id, grossiste_id)
);

alter table public.customer_accounts enable row level security;

-- LIRE : le client voit ses demandes ; l'équipe voit celles faites à son grossiste
drop policy if exists "lire ses comptes" on public.customer_accounts;
create policy "lire ses comptes" on public.customer_accounts
  for select to authenticated
  using (customer_id = auth.uid() or grossiste_id = public.my_grossiste_id());

-- DEMANDER : un client, pour lui-même. Il ne peut remplir que le grossiste et son éventuel
-- numéro existant : le statut part forcément « en attente » (valeur par défaut).
drop policy if exists "un client demande un compte" on public.customer_accounts;
create policy "un client demande un compte" on public.customer_accounts
  for insert to authenticated
  with check (customer_id = auth.uid() and public.my_grossiste_id() is null);

-- DÉCIDER : l'équipe du grossiste concerné, uniquement statut / numéro / date de décision
drop policy if exists "l'équipe décide" on public.customer_accounts;
create policy "l'équipe décide" on public.customer_accounts
  for update to authenticated
  using (grossiste_id = public.my_grossiste_id())
  with check (grossiste_id = public.my_grossiste_id());

revoke insert, update, delete on public.customer_accounts from anon, authenticated;
grant insert (grossiste_id, existing_number) on public.customer_accounts to authenticated;
grant update (status, account_number, decided_at) on public.customer_accounts to authenticated;

-- 2. L'équipe peut lire le nom des clients qui lui ont demandé un compte
--    (en plus de ceux qui ont déjà commandé, sql/02)
drop policy if exists "l'équipe voit ses demandeurs" on public.profiles;
create policy "l'équipe voit ses demandeurs" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.customer_accounts ca
      where ca.customer_id = profiles.id
        and ca.grossiste_id = public.my_grossiste_id()
    )
  );

-- 3. LE VERROU : on ne crée une commande que chez un grossiste où son compte est accepté
drop policy if exists "un client crée ses commandes" on public.orders;
create policy "un client crée ses commandes" on public.orders
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and public.my_grossiste_id() is null
    and exists (
      select 1 from public.customer_accounts ca
      where ca.customer_id = auth.uid()
        and ca.grossiste_id = orders.grossiste_id
        and ca.status = 'accepté'
    )
  );

-- 4. (Facultatif) Un grossiste fictif pour tes tests : enlève les « -- » pour le créer
-- insert into public.grossistes (name, specialites) values ('Grossiste Test', 'Test');
