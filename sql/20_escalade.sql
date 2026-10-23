-- Notifications (partie 2b) : ESCALADE.
-- Toutes les minutes, si une commande a été envoyée il y a plus de 30 minutes et que PERSONNE
-- n'a cliqué « Je prends », on prévient TOUTE l'équipe du grossiste (même hors service), une seule fois.
-- Règle 12 de CLAUDE.md : l'escalade porte sur « Je prends », pas sur la durée de préparation.
--
-- ⚠️ AVANT de lancer ce script, range le secret dans le coffre-fort de Supabase (une seule fois),
--    en remplaçant VALEUR par PUSH_WEBHOOK_SECRET copié depuis ton .env.local :
--      select vault.create_secret('VALEUR', 'push_webhook_secret');
--    (Le secret n'est jamais écrit dans ce fichier : il est publié sur GitHub.)
--
-- À lancer une seule fois dans Supabase → SQL Editor (relançable).

-- 0. Les deux outils de Supabase : l'horloge (pg_cron) et l'appel web (pg_net)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Une commande n'est escaladée qu'une fois
alter table public.orders add column if not exists escalated_at timestamptz;

-- 2. Trouve les commandes à escalader, les marque, et demande à notre serveur de prévenir l'équipe.
--    p_minutes : 30 en temps normal ; « select public.escalate_orders(0); » pour tester tout de suite.
create or replace function public.escalate_orders(p_minutes int default 30)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  o        record;
  subs     jsonb;
  secret   text;
  envoyees int := 0;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if secret is null then
    raise warning 'Secret push_webhook_secret absent du coffre-fort : escalade impossible';
    return 0;
  end if;

  for o in
    select ord.id, ord.order_number, ord.grossiste_id, coalesce(p.display_name, 'Un client') as client
    from public.orders ord
    left join public.profiles p on p.id = ord.customer_id
    where ord.escalated_at is null
      and ord.created_at <= now() - make_interval(mins => p_minutes)
      and ord.created_at >= now() - interval '12 hours' -- pas de vieilles commandes oubliées
      and ord.assigned_to is null                       -- personne n'a pris toute la commande…
      and exists (                                      -- …et au moins un produit n'est pris par personne
        select 1 from public.order_lines ol
        where ol.order_id = ord.id and ol.assigned_to is null and ol.status = 'à préparer'
      )
    for update of ord skip locked
  loop
    update public.orders set escalated_at = now() where id = o.id;

    -- Toute l'équipe du grossiste, de service ou non
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]')
      into subs
    from public.push_subscriptions s
    join public.profiles pr on pr.id = s.user_id
    where pr.role = 'grossiste' and pr.grossiste_id = o.grossiste_id;

    if jsonb_array_length(subs) > 0 then
      perform net.http_post(
        url     := 'https://rungis-app.vercel.app/api/push/escalade',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
        body    := jsonb_build_object(
          'subscriptions', subs,
          'title', '⚠️ Commande n° ' || o.order_number || ' en attente',
          'body', o.client || ' — personne ne l''a prise depuis ' || p_minutes || ' min',
          'url', '/grossiste/' || o.grossiste_id,
          'tag', 'commande-' || o.id
        )
      );
      envoyees := envoyees + 1;
    end if;
  end loop;

  return envoyees;
end;
$$;

-- Seuls Supabase (pg_cron) et toi (SQL Editor) peuvent la lancer
revoke execute on function public.escalate_orders(int) from public, anon, authenticated;

-- 3. L'horloge : toutes les minutes
select cron.unschedule('escalade-commandes') where exists (select 1 from cron.job where jobname = 'escalade-commandes');
select cron.schedule('escalade-commandes', '* * * * *', 'select public.escalate_orders(30)');
